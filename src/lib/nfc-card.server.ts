// NFC tap-to-pay card service (server only).
// Holds ONLY per-card pocket keys (m/44'/696969'/1110'/0/N), encrypted at rest.
// Main wallet keys never reach the server.
import { secp256k1 } from "@noble/curves/secp256k1";
import { Transaction } from "@scure/btc-signer";
import { base64, hex } from "@scure/base";
import { pubkeyToTxcAddress, verifyTxcMessage } from "@/lib/wallet/txc-message";
import { validateSend } from "@/lib/wallet/transaction-policy";

const enc = new TextEncoder();
type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];
export async function admin(): Promise<Admin> {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

function cardSecret(): string {
  const s = process.env.CARD_KEY_ENC;
  if (!s) throw new Error("Card service is not configured");
  return s;
}

export function normalizeUid(raw: string): string {
  return raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

async function hmacHex(key: string, msg: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex.encode(new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(msg))));
}

export async function hashUid(uid: string): Promise<string> {
  return hmacHex(cardSecret(), `card-uid:${normalizeUid(uid)}`);
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/** Verify a partner request: hex HMAC-SHA256(secret, ts + "." + content), ±300s. */
/** Short public fingerprint of the shared secret, so both apps can compare copies without revealing it. */
async function secretPrint(secret: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(secret)));
  return hex.encode(d).slice(0, 8);
}

export async function verifyPartner(ts: string | null, sig: string | null, content: string): Promise<boolean> {
  const secret = process.env.NFC_PAY_SECRET;
  const reject = async (why: string) => {
    console.warn(`[card/pay] rejected: ${why}`, {
      ts, sigLen: sig?.length ?? 0, bodyLen: content.length,
      skewSec: ts && /^\d+$/.test(ts) ? Math.round(Date.now() / 1000 - Number(ts)) : null,
      secretFp: secret ? await secretPrint(secret) : null, secretLen: secret?.length ?? 0,
    });
    return false;
  };
  if (!secret) return reject("NFC_PAY_SECRET missing on server");
  if (!ts || !/^\d{9,11}$/.test(ts)) return reject("x-hme-timestamp missing or not unix seconds");
  if (!sig || !/^[0-9a-f]{64}$/i.test(sig)) return reject("x-hme-signature missing or not 64 hex chars");
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return reject("timestamp more than 5 minutes off");
  if (!safeEqual(await hmacHex(secret, `${ts}.${content}`), sig.toLowerCase())) return reject("signature mismatch (secret or signed text differs)");
  return true;
}

async function aesKey(): Promise<CryptoKey> {
  const raw = await crypto.subtle.digest("SHA-256", enc.encode(`card-key:${cardSecret()}`));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptKey(keyHex: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(), new Uint8Array(hex.decode(keyHex))));
  const out = new Uint8Array(12 + ct.length);
  out.set(iv);
  out.set(ct, 12);
  return base64.encode(out);
}

async function decryptKey(blob: string): Promise<Uint8Array> {
  const b = base64.decode(blob);
  return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: b.slice(0, 12) }, await aesKey(), b.slice(12)));
}

export function addressOfKey(keyHex: string): string {
  return pubkeyToTxcAddress(secp256k1.getPublicKey(hex.decode(keyHex), true));
}

export async function hashPin(pin: string, saltB64?: string): Promise<{ hash: string; salt: string }> {
  const salt = saltB64 ? base64.decode(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  const k = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: new Uint8Array(salt), iterations: 100_000 }, k, 256);
  return { hash: base64.encode(new Uint8Array(bits)), salt: base64.encode(salt) };
}

/** Owner envelope: TXC message signature over `cp-card|action|ts|body`. */
export function verifyOwner(env: { owner: string; ts: number; action: string; body: string; sig: string }, action: string) {
  if (env.action !== action) throw new Error("Wrong action");
  if (Math.abs(Date.now() / 1000 - env.ts) > 300) throw new Error("Request expired — check the phone's clock");
  const msg = `cp-card|${env.action}|${env.ts}|${env.body}`;
  if (!verifyTxcMessage(env.owner, msg, env.sig)) throw new Error("Signature check failed");
}

// ---------- Telegram ----------
const TG = "https://connector-gateway.lovable.dev/telegram";
export async function tg(method: string, body: Record<string, unknown>) {
  const L = process.env.LOVABLE_API_KEY;
  const T = process.env.TELEGRAM_API_KEY;
  if (!L || !T) return null;
  const res = await fetch(`${TG}/${method}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${L}`, "X-Connection-Api-Key": T, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) console.error(`[nfc tg] ${method} ${res.status}: ${text}`);
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function telegramSecret(): Promise<string> {
  const k = process.env.TELEGRAM_API_KEY ?? "";
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(`telegram-webhook:${k}`)));
  return base64.encode(d).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);

export async function askApproval(chatId: string, p: { id: string; amount_usd: number; merchant_name: string | null }, label: string) {
  await tg("sendMessage", {
    chat_id: chatId,
    parse_mode: "HTML",
    text: `💳 <b>Approve tap?</b>\n${esc(label)} wants to pay <b>$${Number(p.amount_usd).toFixed(2)}</b> at ${esc(p.merchant_name ?? "a NectarPay store")}.\nExpires in 15 minutes.`,
    reply_markup: {
      inline_keyboard: [[
        { text: "✅ Approve", callback_data: `nfc:a:${p.id}` },
        { text: "❌ Decline", callback_data: `nfc:d:${p.id}` },
      ]],
    },
  });
}

export async function notify(chatId: string | null, text: string) {
  if (chatId) await tg("sendMessage", { chat_id: chatId, parse_mode: "HTML", text });
}

/** One Telegram chat per wallet: alerts/approvals for every card the owner linked. */
export async function walletChat(ownerAddress: string): Promise<string | null> {
  const sb = await admin();
  const { data } = await sb.from("nfc_wallet_telegram").select("tg_chat_id").eq("owner_address", ownerAddress).maybeSingle();
  return (data?.tg_chat_id as string | null) ?? null;
}

// ---------- Paying ----------
/** Sign and broadcast a reserved payment (status must already be 'sending'). */
export async function executePayment(
  paymentId: string,
  known?: { card: { id: string; owner_address: string }; chat: string | null },
): Promise<{ status: string; txid?: string; reason?: string }> {
  const sb = await admin();
  const { data: p } = await sb.from("nfc_card_payments").select("*").eq("id", paymentId).single();
  if (!p || p.status !== "sending") return { status: p?.status ?? "failed" };
  // Fresh card row (enabled/killed may change) + key + chat, fetched together.
  const [{ data: c }, { data: k }, knownChat] = await Promise.all([
    sb.from("nfc_cards").select("*").eq("id", p.card_id).single(),
    sb.from("nfc_card_keys").select("enc_key").eq("card_id", p.card_id).maybeSingle(),
    known && known.card.id === p.card_id ? Promise.resolve(known.chat) : Promise.resolve(undefined),
  ]);
  const chat = knownChat !== undefined ? knownChat : c ? await walletChat(c.owner_address) : null;
  const fail = async (reason: string) => {
    await sb.from("nfc_card_payments").update({ status: "failed", reason }).eq("id", paymentId);
    await notify(chat, `⚠️ Tap payment of $${Number(p.amount_usd).toFixed(2)} failed: ${esc(reason)}`);
    return { status: "failed", reason };
  };
  if (!c || !k || !c.enabled || c.killed_at) return fail("Card is off");
  try {
    const key = await decryptKey(k.enc_key);
    const { buildUnsignedSend, broadcastRaw } = await import("@/lib/send.server");
    const intent = { asset: "tsd" as const, from: c.pocket_address, to: p.recipient, amount: Number(p.tsd_amount) };
    const built = await buildUnsignedSend(intent);
    validateSend(built.psbtBase64, intent, [c.pocket_address]);
    const tx = Transaction.fromPSBT(base64.decode(built.psbtBase64), { allowUnknownOutputs: true });
    if (tx.sign(key) === 0) throw new Error("Card key didn't match its pocket");
    tx.finalize();
    key.fill(0);
    const txid = await broadcastRaw(tx.hex);
    await Promise.all([
      sb.from("nfc_card_payments").update({ status: "sent", txid }).eq("id", paymentId),
      notify(chat, `✅ ${esc(c.label)} paid <b>$${Number(p.amount_usd).toFixed(2)}</b> at ${esc(p.merchant_name ?? "a NectarPay store")}.`).catch(() => undefined),
    ]);
    return { status: "sent", txid };
  } catch (e) {
    console.error("[nfc pay]", e);
    return fail(e instanceof Error ? e.message : "Payment failed");
  }
}
