/**
 * Universal QR/scan router.
 *
 * One camera, many payloads. Everything the wallet can scan funnels through
 * `parseScan()` which returns a discriminated intent the UI acts on:
 *
 *  - payment  → merchant/peer request: address + optional amount + asset
 *  - award    → a CryptoPOP code that grants POP (claim/scan tokens)
 *  - pass     → an event pass / check-in QR (handled by the app route)
 *  - address  → a bare wallet address to send to
 *  - words    → a BIP39 recovery phrase (import / cold-storage coin)
 *  - link     → an in-app URL to navigate to
 *  - unknown  → anything else (copied to clipboard)
 *
 * Supported payment encodings:
 *   txc:T…?amount=12.50&asset=tsd&label=Merchant&memo=Order%20123
 *   texitcoin:T…?amount=…   pop:T…?amount=…   tsd:T…?amount=…
 *   https://app.cryptopop.org/pay?to=T…&amount=…&asset=tsd
 *   {"cryptopop":"pay","to":"T…","amount":12.5,"asset":"tsd","merchant":"…"}
 */
import { isValidTxcAddress } from "@/lib/wallet";
import { assetFromOmniId, normalizeAsset, type AssetId } from "./assets";

export type ScanIntent =
  | {
      kind: "payment";
      to: string;
      amount: number | null;
      asset: AssetId;
      merchant: string | null;
      memo: string | null;
      raw: string;
    }
  | { kind: "award"; token: string; path: string; raw: string }
  | { kind: "checkin"; eventId: string; sig: string; raw: string }
  | { kind: "pass"; path: string; raw: string }
  | { kind: "address"; address: string; raw: string }
  | { kind: "words"; phrase: string; raw: string }
  | { kind: "link"; path: string; raw: string }
  | { kind: "nectarpay"; invoiceId: string; nonce: string | null; raw: string }
  | {
      kind: "wallet_login";
      host: string;
      nonce: string;
      callback: string;
      /** Challenge id (deep-link flow) — null for the QR envelope flow. */
      id: string | null;
      /** Exact message to sign when the site supplies one. */
      message: string | null;
      expiresAt: number | null;
      raw: string;
    }
  | { kind: "unknown"; raw: string };


const PAY_SCHEMES = ["txc", "texitcoin", "tsd", "pop", "cryptopop", "bitcoin"];

function num(v: string | null): number | null {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function looksLikeWords(text: string): boolean {
  const parts = text.trim().toLowerCase().split(/\s+/);
  return (
    [12, 15, 18, 21, 24].includes(parts.length) && parts.every((w) => /^[a-z]{3,8}$/.test(w))
  );
}

function fromParams(
  to: string,
  p: URLSearchParams,
  schemeAsset: AssetId | null,
  raw: string,
): ScanIntent {
  return {
    kind: "payment",
    to,
    amount: num(p.get("amount") ?? p.get("value") ?? p.get("a")),
    asset:
      // Omni property id is authoritative when the POS supplies it.
      assetFromOmniId(p.get("omni") ?? p.get("propertyid") ?? p.get("property")) ??
      normalizeAsset(p.get("asset") ?? p.get("token") ?? p.get("currency")) ??
      schemeAsset ??
      "tsd",
    merchant: p.get("label") ?? p.get("merchant") ?? p.get("name"),
    memo: p.get("memo") ?? p.get("message") ?? p.get("note"),
    raw,
  };
}

/** Event check-in QR: cryptopop://claim?e=<uuid>&s=<hmac> */
function checkinFrom(p: URLSearchParams, raw: string): ScanIntent | null {
  const eventId = p.get("e") ?? p.get("event");
  const sig = p.get("s") ?? p.get("sig");
  if (!eventId || !sig || !/^[0-9a-f-]{36}$/i.test(eventId) || !/^[0-9a-f]{32,128}$/i.test(sig)) {
    return null;
  }
  return { kind: "checkin", eventId, sig, raw };
}

const NECTAR_HOSTS = /(^|\.)(nectar-pay\.com|honest\.money)$/i;
const INVOICE_ID = /^[A-Za-z0-9_-]{6,80}$/;

function b64urlDecode(s: string): string | null {
  try {
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64 + "===".slice((b64.length + 3) % 4));
    return decodeURIComponent(
      Array.from(bin, (c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0")).join(""),
    );
  } catch {
    return null;
  }
}

function hostOf(u: string): string | null {
  try {
    return new URL(u).hostname;
  } catch {
    return null;
  }
}

/** NectarPay checkout links + "Sign in with wallet" requests. */
function nectarFrom(raw: string): ScanIntent | null {
  // nectar://pay?inv=<id>&t=<nonce>
  let m = raw.match(/^nectar:\/\/pay\?(.*)$/i);
  if (m) {
    const p = new URLSearchParams(m[1]);
    const inv = p.get("inv") ?? p.get("invoice") ?? "";
    if (INVOICE_ID.test(inv)) return { kind: "nectarpay", invoiceId: inv, nonce: p.get("t"), raw };
  }
  // payhme://login?id=&nonce=&cb=&msg=&from=
  m = raw.match(/^payhme:\/\/login\?(.*)$/i);
  if (m) {
    const p = new URLSearchParams(m[1]);
    const nonce = p.get("nonce") ?? "";
    const cb = p.get("cb") ?? "";
    const host = hostOf(cb);
    if (nonce && host && cb.startsWith("https://")) {
      const msg = p.get("msg");
      return {
        kind: "wallet_login",
        host: p.get("from") ?? host,
        nonce,
        callback: cb,
        id: p.get("id"),
        message: msg ? b64urlDecode(msg) : null,
        expiresAt: null,
        raw,
      };
    }
  }
  // {"type":"hm-login", ...}
  if (raw.startsWith("{")) {
    try {
      const j = JSON.parse(raw) as Record<string, unknown>;
      if (j.type === "hm-login" && typeof j.nonce === "string" && typeof j.callback === "string") {
        const host = hostOf(j.callback);
        if (host && j.callback.startsWith("https://")) {
          return {
            kind: "wallet_login",
            host: typeof j.origin === "string" ? j.origin : host,
            nonce: j.nonce,
            callback: j.callback,
            id: null,
            message: null,
            expiresAt: typeof j.expiresAt === "number" ? j.expiresAt : null,
            raw,
          };
        }
      }
    } catch {
      /* not JSON */
    }
  }
  // https://app.nectar-pay.com/pay/<id>?t=…  or  …/i/<id>
  if (/^https:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      if (NECTAR_HOSTS.test(url.hostname)) {
        const pm = url.pathname.match(/^\/(?:pay|i)\/([^/?#]+)\/?$/);
        if (pm && INVOICE_ID.test(pm[1])) {
          return { kind: "nectarpay", invoiceId: pm[1], nonce: url.searchParams.get("t"), raw };
        }
      }
    } catch {
      /* fall through */
    }
  }
  return null;
}

export function parseScan(input: string): ScanIntent {
  const raw = (input ?? "").trim();
  if (!raw) return { kind: "unknown", raw };

  const nectar = nectarFrom(raw);
  if (nectar) return nectar;

  // 1. JSON payloads
  if (raw.startsWith("{")) {
    try {
      const j = JSON.parse(raw) as Record<string, unknown>;
      const type = String(j.type ?? j.cryptopop ?? j.action ?? "").toLowerCase();
      const to = String(j.to ?? j.address ?? j.recipient ?? "");
      const token = String(j.token ?? j.code ?? "");
      if (token && (type.includes("award") || type.includes("pop") || type.includes("claim"))) {
        return { kind: "award", token, path: `/claim/${encodeURIComponent(token)}`, raw };
      }
      if (to && isValidTxcAddress(to)) {
        const amt = Number(j.amount ?? j.value);
        return {
          kind: "payment",
          to,
          amount: Number.isFinite(amt) && amt > 0 ? amt : null,
          asset: normalizeAsset(String(j.asset ?? j.token ?? j.currency ?? "")) ?? "tsd",
          merchant: j.merchant ? String(j.merchant) : j.label ? String(j.label) : null,
          memo: j.memo ? String(j.memo) : null,
          raw,
        };
      }
    } catch {
      /* not JSON after all */
    }
  }

  // 2. URLs (http/https) — CryptoPOP links, claim codes, passes, pay links
  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      const path = url.pathname + url.search;
      const ci = checkinFrom(url.searchParams, raw);
      if (ci) return ci;
      const claim = url.pathname.match(/\/claim\/([^/?#]+)/i);
      if (claim) return { kind: "award", token: decodeURIComponent(claim[1]), path, raw };
      const scanToken = url.searchParams.get("t") ?? url.searchParams.get("token");
      if (/\/(scan|qr)\b/i.test(url.pathname) && scanToken) {
        return { kind: "award", token: scanToken, path, raw };
      }
      if (/\/(my-pass|pass|checkin)\b/i.test(url.pathname)) return { kind: "pass", path, raw };
      const to = url.searchParams.get("to") ?? url.searchParams.get("address");
      if (/\/pay\b/i.test(url.pathname) && to && isValidTxcAddress(to)) {
        return fromParams(to, url.searchParams, null, raw);
      }
      return { kind: "link", path, raw };
    } catch {
      /* fall through */
    }
  }

  // 3. BIP21-style URIs
  const scheme = raw.match(/^([a-z]+):([^?]*)(\?.*)?$/i);
  if (scheme && PAY_SCHEMES.includes(scheme[1].toLowerCase())) {
    const s = scheme[1].toLowerCase();
    const body = scheme[2];
    const params = new URLSearchParams(scheme[3] ?? "");
    // cryptopop://claim?e=<eventId>&s=<sig>  (geofenced event check-in)
    if (s === "cryptopop") {
      const ci = checkinFrom(params, raw);
      if (ci) return ci;
    }
    // cryptopop:award?token=…
    if (s === "cryptopop" && /award|claim|pop/i.test(body)) {
      const token = params.get("token") ?? params.get("t") ?? "";
      if (token) return { kind: "award", token, path: `/claim/${encodeURIComponent(token)}`, raw };
    }
    if (isValidTxcAddress(body)) {
      return fromParams(body, params, normalizeAsset(s), raw);
    }
  }

  // 4. Bare address
  if (isValidTxcAddress(raw)) return { kind: "address", address: raw, raw };

  // 5. Recovery phrase (cold storage coin)
  if (looksLikeWords(raw)) return { kind: "words", phrase: raw.toLowerCase().replace(/\s+/g, " "), raw };

  return { kind: "unknown", raw };
}
