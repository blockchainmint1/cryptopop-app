// Owner-managed NFC card actions. Every call is signed by the wallet's card
// owner key (m/44'/696969'/1110'/1/0) — no login needed, keys stay on device
// except the single card-pocket key sent once at link time.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Addr = z.string().regex(/^T[1-9A-HJ-NP-Za-km-z]{25,40}$/);
const Envelope = z.object({
  owner: Addr,
  ts: z.number().int(),
  action: z.enum(["link", "list", "update", "kill"]),
  body: z.string().max(4000),
  sig: z.string().min(40).max(200),
});
type Env = z.infer<typeof Envelope>;

const LinkBody = z.object({
  uid: z.string().min(4).max(64),
  label: z.string().trim().min(1).max(40),
  pin: z.string().regex(/^\d{4,8}$/),
  perTapUsd: z.number().min(0).max(100000),
  dailyUsd: z.number().min(0).max(1000000),
  pocketIndex: z.number().int().min(0).max(999),
  pocketAddress: Addr,
  pocketKeyHex: z.string().regex(/^[0-9a-f]{64}$/),
  returnAddress: Addr,
});
const UpdateBody = z.object({
  id: z.string().uuid(),
  label: z.string().trim().min(1).max(40).optional(),
  enabled: z.boolean().optional(),
  pin: z.string().regex(/^\d{4,8}$/).optional(),
  perTapUsd: z.number().min(0).max(100000).optional(),
  dailyUsd: z.number().min(0).max(1000000).optional(),
  unlock: z.boolean().optional(),
  newTelegramCode: z.boolean().optional(),
  clearTelegram: z.boolean().optional(),
});
const IdBody = z.object({ id: z.string().uuid() });

async function open<T extends z.ZodTypeAny>(env: Env, action: Env["action"], schema: T): Promise<z.infer<T>> {
  const s = await import("./nfc-card.server");
  s.verifyOwner(env, action);
  return schema.parse(JSON.parse(env.body));
}

export const nfcLinkCard = createServerFn({ method: "POST" })
  .inputValidator((d) => Envelope.parse(d))
  .handler(async ({ data }) => {
    const b = await open(data, "link", LinkBody);
    const s = await import("./nfc-card.server");
    if (s.addressOfKey(b.pocketKeyHex) !== b.pocketAddress) throw new Error("Pocket key doesn't match its address");
    const uid = s.normalizeUid(b.uid);
    if (uid.length < 4) throw new Error("Card ID looks too short");
    const sb = await s.admin();
    const pin = await s.hashPin(b.pin);
    const { data: card, error } = await sb.from("nfc_cards").insert({
      owner_address: data.owner, uid_hash: await s.hashUid(uid), uid_hint: uid.slice(-4), label: b.label,
      pocket_index: b.pocketIndex, pocket_address: b.pocketAddress, return_address: b.returnAddress,
      pin_hash: pin.hash, pin_salt: pin.salt, per_tap_usd: b.perTapUsd, daily_usd: b.dailyUsd,
    }).select("id").single();
    if (error || !card) {
      throw new Error(/uid_hash/.test(error?.message ?? "") ? "That card is already linked" :
        /pocket_index/.test(error?.message ?? "") ? "That pocket number is taken — refresh and try again" : "Couldn't link the card");
    }
    const { error: kErr } = await sb.from("nfc_card_keys").insert({ card_id: card.id, enc_key: await s.encryptKey(b.pocketKeyHex) });
    if (kErr) {
      await sb.from("nfc_cards").delete().eq("id", card.id);
      throw new Error("Couldn't store the card key");
    }
    return { id: card.id };
  });

export const nfcListCards = createServerFn({ method: "POST" })
  .inputValidator((d) => Envelope.parse(d))
  .handler(async ({ data }) => {
    await open(data, "list", z.object({}));
    const s = await import("./nfc-card.server");
    const sb = await s.admin();
    const { data: cards } = await sb.from("nfc_cards")
      .select("id,label,uid_hint,pocket_index,pocket_address,per_tap_usd,daily_usd,enabled,killed_at,pin_fails,tg_code,tg_chat_id,created_at")
      .eq("owner_address", data.owner).order("pocket_index");
    const ids = (cards ?? []).map((c) => c.id);
    const { data: pays } = ids.length
      ? await sb.from("nfc_card_payments").select("id,card_id,merchant_name,amount_usd,status,reason,txid,created_at")
          .in("card_id", ids).order("created_at", { ascending: false }).limit(100)
      : { data: [] };
    const me = await s.tg("getMe", {});
    return {
      botName: (me?.result?.username as string | undefined) ?? null,
      usedIndices: (cards ?? []).map((c) => c.pocket_index),
      cards: (cards ?? []).filter((c) => !c.killed_at).map((c) => ({
        id: c.id, label: c.label, uidHint: c.uid_hint, index: c.pocket_index, address: c.pocket_address,
        perTapUsd: Number(c.per_tap_usd), dailyUsd: Number(c.daily_usd), enabled: c.enabled,
        locked: c.pin_fails >= 5, telegramCode: c.tg_code, telegramLinked: !!c.tg_chat_id,
        payments: (pays ?? []).filter((p) => p.card_id === c.id).slice(0, 20).map((p) => ({
          id: p.id, merchant: p.merchant_name, usd: Number(p.amount_usd), status: p.status, reason: p.reason, txid: p.txid, at: p.created_at,
        })),
      })),
    };
  });

export const nfcUpdateCard = createServerFn({ method: "POST" })
  .inputValidator((d) => Envelope.parse(d))
  .handler(async ({ data }) => {
    const b = await open(data, "update", UpdateBody);
    const s = await import("./nfc-card.server");
    const sb = await s.admin();
    const patch: Record<string, unknown> = {};
    if (b.label !== undefined) patch.label = b.label;
    if (b.enabled !== undefined) patch.enabled = b.enabled;
    if (b.perTapUsd !== undefined) patch.per_tap_usd = b.perTapUsd;
    if (b.dailyUsd !== undefined) patch.daily_usd = b.dailyUsd;
    if (b.unlock) patch.pin_fails = 0;
    if (b.pin) {
      const p = await s.hashPin(b.pin);
      Object.assign(patch, { pin_hash: p.hash, pin_salt: p.salt, pin_fails: 0 });
    }
    if (b.newTelegramCode) {
      const r = crypto.getRandomValues(new Uint8Array(8));
      patch.tg_code = "CP" + Array.from(r, (x) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[x % 32]).join("");
    }
    if (b.clearTelegram) Object.assign(patch, { tg_chat_id: null, tg_code: null });
    const { data: rows } = await sb.from("nfc_cards").update(patch)
      .eq("id", b.id).eq("owner_address", data.owner).is("killed_at", null).select("id");
    if (!rows?.length) throw new Error("Card not found");
    return { ok: true };
  });

export const nfcKillCard = createServerFn({ method: "POST" })
  .inputValidator((d) => Envelope.parse(d))
  .handler(async ({ data }) => {
    const b = await open(data, "kill", IdBody);
    const s = await import("./nfc-card.server");
    const sb = await s.admin();
    const { data: rows } = await sb.from("nfc_cards").update({ enabled: false, killed_at: new Date().toISOString() })
      .eq("id", b.id).eq("owner_address", data.owner).is("killed_at", null).select("id");
    if (!rows?.length) throw new Error("Card not found");
    await sb.from("nfc_card_payments").update({ status: "declined", reason: "Card shut down" })
      .eq("card_id", b.id).eq("status", "approval_required");
    await sb.from("nfc_card_keys").delete().eq("card_id", b.id);
    return { ok: true };
  });
