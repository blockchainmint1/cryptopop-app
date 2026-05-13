import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachSupabaseAuth } from "./auth-client-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  signEventId,
  verifyEventSig,
  parseQrPayload,
  buildQrPayload,
  distanceMeters,
} from "./qr.server";

const SignInput = z.object({ eventId: z.string().uuid() });

export const signEventQr = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input) => SignInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Admin-only
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roles) throw new Error("forbidden");

    const secret = process.env.QR_HMAC_SECRET;
    if (!secret) throw new Error("QR_HMAC_SECRET not configured");

    const sig = signEventId(data.eventId, secret);
    return { qr: buildQrPayload(data.eventId, sig), sig };
  });

const ClaimInput = z.object({
  qr: z.string().min(8).max(512),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(100000).optional(),
});

export type ClaimResult =
  | {
      ok: true;
      eventId: string;
      eventName: string;
      coverUrl: string | null;
      reward: number;
      newBalance: number;
    }
  | { ok: false; reason: ClaimError };

export type ClaimError =
  | "invalid_qr"
  | "bad_signature"
  | "event_not_found"
  | "event_not_started"
  | "event_ended"
  | "outside_geofence"
  | "low_gps_accuracy"
  | "already_claimed"
  | "no_wallet";

export const claimPop = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input) => ClaimInput.parse(input))
  .handler(async ({ data, context }): Promise<ClaimResult> => {
    const { userId } = context;
    const secret = process.env.QR_HMAC_SECRET;
    if (!secret) throw new Error("QR_HMAC_SECRET not configured");

    // GPS sanity
    if (data.accuracy !== undefined && data.accuracy > 100) {
      return { ok: false, reason: "low_gps_accuracy" };
    }

    const parsed = parseQrPayload(data.qr);
    if (!parsed) return { ok: false, reason: "invalid_qr" };

    if (!verifyEventSig(parsed.eventId, parsed.sig, secret)) {
      return { ok: false, reason: "bad_signature" };
    }

    // Load event (admin client — claim flow needs to read regardless of RLS)
    const { data: event } = await supabaseAdmin
      .from("events")
      .select("id, name, cover_url, lat, lng, radius_m, start_at, end_at, base_reward")
      .eq("id", parsed.eventId)
      .maybeSingle();
    if (!event) return { ok: false, reason: "event_not_found" };

    const now = new Date();
    if (new Date(event.start_at) > now) return { ok: false, reason: "event_not_started" };
    if (new Date(event.end_at) < now) return { ok: false, reason: "event_ended" };

    const dist = distanceMeters(data.lat, data.lng, event.lat, event.lng);
    if (dist > event.radius_m) return { ok: false, reason: "outside_geofence" };

    // Wallet — auto-provision a server-side placeholder if missing so a fresh
    // user can claim without bouncing back to /app first. The real key
    // material still lives client-side in localStorage; this address is just
    // a payout target the chain settler will overwrite once the user opens
    // their wallet on this device.
    let { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("wallet_address")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.wallet_address) {
      const rand = crypto.getRandomValues(new Uint8Array(24));
      const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
      let acc = 0n;
      for (const b of rand) acc = (acc << 8n) | BigInt(b);
      let tail = "";
      while (tail.length < 33) {
        tail = BASE58[Number(acc % 58n)] + tail;
        acc = acc / 58n || 1n;
      }
      const addr = "T" + tail.slice(0, 33);
      await supabaseAdmin.from("profiles").update({ wallet_address: addr }).eq("id", userId);
      profile = { wallet_address: addr };
    }

    // Already claimed?
    const { data: existing } = await supabaseAdmin
      .from("claims")
      .select("id")
      .eq("user_id", userId)
      .eq("event_id", event.id)
      .maybeSingle();
    if (existing) return { ok: false, reason: "already_claimed" };

    const reward = Number(event.base_reward);

    // Insert claim (status pending — chain settle happens later)
    const { error: claimErr } = await supabaseAdmin.from("claims").insert({
      user_id: userId,
      event_id: event.id,
      wallet_address: profile.wallet_address!,
      lat: data.lat,
      lng: data.lng,
      base_reward: reward,
      quiz_reward: 0,
      referral_reward: 0,
      total: reward,
      status: "pending",
    });
    if (claimErr) throw new Error(claimErr.message);

    // Upsert balance mirror
    const { data: prev } = await supabaseAdmin
      .from("pop_balance_mirror")
      .select("balance, events_attended")
      .eq("user_id", userId)
      .maybeSingle();

    const newBalance = Number(prev?.balance ?? 0) + reward;
    const newAttended = (prev?.events_attended ?? 0) + 1;

    const { error: mirrorErr } = await supabaseAdmin
      .from("pop_balance_mirror")
      .upsert(
        {
          user_id: userId,
          balance: newBalance,
          events_attended: newAttended,
          last_synced_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
    if (mirrorErr) throw new Error(mirrorErr.message);

    return {
      ok: true,
      eventId: event.id,
      eventName: event.name,
      coverUrl: event.cover_url,
      reward,
      newBalance,
    };
  });
