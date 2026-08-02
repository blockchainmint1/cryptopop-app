/**
 * POP Hub client.
 *
 * The wallet is a thin, non-custodial client. It never holds the QR HMAC
 * secret, the minter seed, or event data. It scans a code, grabs the user's
 * TXC receive address, and asks the hub (the main CryptoPOP site) to verify
 * the code and mint the POP reward to that address.
 *
 * Contract: POST {HUB}/api/public/claim  (CORS-enabled, no auth)
 */

export const POP_HUB_URL =
  (import.meta.env.VITE_POP_HUB_URL as string | undefined)?.replace(/\/$/, "") ||
  "https://cryptopop.org";

export type HubClaimError =
  | "invalid_qr"
  | "bad_signature"
  | "event_not_found"
  | "event_not_started"
  | "event_ended"
  | "outside_geofence"
  | "low_gps_accuracy"
  | "already_claimed"
  | "no_wallet"
  | "invalid_address"
  | "server_error"
  | "hub_unreachable";

export type HubClaimResult =
  | {
      ok: true;
      eventId: string;
      eventName: string;
      coverUrl: string | null;
      reward: number;
      newBalance: number;
      txHash: string | null;
    }
  | { ok: false; reason: HubClaimError };

export type HubClaimInput = {
  qr: string;
  address: string;
  lat: number;
  lng: number;
  accuracy?: number;
};

const VALID_REASONS = new Set<string>([
  "invalid_qr",
  "bad_signature",
  "event_not_found",
  "event_not_started",
  "event_ended",
  "outside_geofence",
  "low_gps_accuracy",
  "already_claimed",
  "no_wallet",
  "invalid_address",
  "server_error",
]);

export async function claimAtHub(input: HubClaimInput): Promise<HubClaimResult> {
  let res: Response;
  try {
    res = await fetch(`${POP_HUB_URL}/api/public/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        qr: input.qr,
        address: input.address,
        lat: input.lat,
        lng: input.lng,
        accuracy: input.accuracy,
        client: "cryptopop-wallet",
      }),
    });
  } catch {
    return { ok: false, reason: "hub_unreachable" };
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    return { ok: false, reason: "hub_unreachable" };
  }

  const payload = body as Record<string, unknown> | null;
  if (!payload || typeof payload !== "object") {
    return { ok: false, reason: "hub_unreachable" };
  }

  if (payload.ok === true) {
    return {
      ok: true,
      eventId: String(payload.eventId ?? ""),
      eventName: String(payload.eventName ?? "CryptoPOP event"),
      coverUrl: typeof payload.coverUrl === "string" ? payload.coverUrl : null,
      reward: Number(payload.reward ?? 0),
      newBalance: Number(payload.newBalance ?? 0),
      txHash: typeof payload.txHash === "string" ? payload.txHash : null,
    };
  }

  const reason = typeof payload.reason === "string" ? payload.reason : "";
  return {
    ok: false,
    reason: (VALID_REASONS.has(reason) ? reason : "hub_unreachable") as HubClaimError,
  };
}
