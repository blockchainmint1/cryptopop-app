/**
 * POP Hub signup client (server-only).
 *
 * The hub (cryptopop.org) owns event capacity, the RSVP window, the
 * first-event-only POP reward, minting, the confirmation email and the
 * Telegram alert. The wallet app collects the form and relays it
 * server-to-server (no CORS, key never touches the browser).
 */
import { POP_HUB_URL } from "./pop-hub";

export type HubSignupInput = {
  event_slug: string;
  full_name: string;
  email: string;
  mobile_number?: string | null;
  is_friend?: boolean;
  guest_count?: number;
  external_wallet?: string | null;
};

export type HubSignupResult = {
  id: string;
  pop_awarded: number;
  first_event: boolean;
  wallet_address: string | null;
};

export type HubPass = {
  id: string;
  full_name: string;
  status: string;
  pop_credits: number;
  checked_in_at: string | null;
  event_name: string | null;
};

function hubKey(): string {
  const key = process.env["POP_PARTNER_KEY"];
  if (!key) throw new Error("hub_not_configured");
  return key;
}

export async function hubCreateSignup(input: HubSignupInput): Promise<HubSignupResult> {
  let res: Response;
  try {
    res = await fetch(`${POP_HUB_URL}/api/public/event-signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cryptopop-key": hubKey(),
      },
      body: JSON.stringify({ ...input, signup_source: "pop-wallet" }),
    });
  } catch (e) {
    console.error("[hubCreateSignup] unreachable", e);
    throw new Error("hub_unreachable");
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* ignore */
  }

  if (!res.ok) {
    const err = (body as { error?: string } | null)?.error;
    throw new Error(err || `hub_error_${res.status}`);
  }

  const r = body as Partial<HubSignupResult> | null;
  if (!r?.id) throw new Error("hub_bad_response");
  return {
    id: r.id,
    pop_awarded: Number(r.pop_awarded ?? 0),
    first_event: Boolean(r.first_event),
    wallet_address: r.wallet_address ?? null,
  };
}

export async function hubGetPass(id: string): Promise<HubPass | null> {
  try {
    const res = await fetch(`${POP_HUB_URL}/api/public/signup/${encodeURIComponent(id)}`, {
      headers: { "x-cryptopop-key": hubKey() },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as Partial<HubPass> | null;
    if (!body?.id) return null;
    return {
      id: body.id,
      full_name: body.full_name ?? "",
      status: body.status ?? "confirmed",
      pop_credits: Number(body.pop_credits ?? 0),
      checked_in_at: body.checked_in_at ?? null,
      event_name: body.event_name ?? null,
    };
  } catch (e) {
    console.error("[hubGetPass]", e);
    return null;
  }
}
