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
import { mintGrant } from "./txc.server";

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
      txHash: string | null;
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

    // No accuracy gate — geofence radius itself is the trust boundary.
    // Indoors / wifi-only fixes commonly report 1000m+ accuracy worldwide.

    const parsed = parseQrPayload(data.qr);
    if (!parsed) return { ok: false, reason: "invalid_qr" };

    if (!verifyEventSig(parsed.eventId, parsed.sig, secret)) {
      return { ok: false, reason: "bad_signature" };
    }

    // Load event (admin client — claim flow needs to read regardless of RLS)
    const { data: event } = await supabaseAdmin
      .from("events")
      .select("id, name, cover_url, lat, lng, radius_m, start_at, end_at, base_reward, qr_active_minutes_before")
      .eq("id", parsed.eventId)
      .maybeSingle();
    if (!event) return { ok: false, reason: "event_not_found" };

    const now = new Date();
    const activeFrom = new Date(
      new Date(event.start_at).getTime() - (event.qr_active_minutes_before ?? 0) * 60_000,
    );
    if (activeFrom > now) return { ok: false, reason: "event_not_started" };
    if (new Date(event.end_at) < now) return { ok: false, reason: "event_ended" };

    const dist = distanceMeters(data.lat, data.lng, event.lat, event.lng);
    if (dist > event.radius_m) return { ok: false, reason: "outside_geofence" };

    // Wallet — must be present and valid (provisioned client-side on /app
    // first load; we no longer fabricate a server-side placeholder because
    // those weren't real TXC addresses and would cause minted POP to be
    // unspendable).
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("wallet_address")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.wallet_address) {
      return { ok: false, reason: "no_wallet" };
    }

    // Already claimed?
    const { data: existing } = await supabaseAdmin
      .from("claims")
      .select("id")
      .eq("user_id", userId)
      .eq("event_id", event.id)
      .maybeSingle();
    if (existing) return { ok: false, reason: "already_claimed" };

    const envReward = Number(process.env.SCAN_REWARD);
    const reward = Number.isFinite(envReward) && envReward > 0
      ? envReward
      : Number(event.base_reward);

    // Insert claim (status pending — chain settle happens after)
    const { data: claimRow, error: claimErr } = await supabaseAdmin
      .from("claims")
      .insert({
        user_id: userId,
        event_id: event.id,
        wallet_address: profile.wallet_address,
        lat: data.lat,
        lng: data.lng,
        base_reward: reward,
        quiz_reward: 0,
        referral_reward: 0,
        total: reward,
        status: "pending",
        qr_payload: data.qr,
        scanned_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (claimErr || !claimRow) {
      console.error("[claim] insert failed", claimErr);
      throw new Error("Could not record claim. Please try again.");
    }

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
    if (mirrorErr) {
      console.error("[claim] balance mirror upsert failed", mirrorErr);
      throw new Error("Could not update balance. Please try again.");
    }

    // Stage 2 — mint on TXC. Inline await keeps it simple and works in the
    // Worker runtime (background tasks die after the response). User waits
    // an extra ~1–3s but gets a real tx hash back.
    let txHash: string | null = null;
    try {
      // On-chain attribution memo (rides in the Omni OP_RETURN via grantdata).
      // Format: "POP|<event-name>|<YYYY-MM-DD>|<lat>,<lng>|q:<sig8>"
      // Capped at 60 bytes server-side; truncate event name first to stay safe.
      const day = new Date().toISOString().slice(0, 10);
      const geo = `${data.lat.toFixed(3)},${data.lng.toFixed(3)}`;
      const sig8 = parsed.sig.slice(0, 8);
      const evName = event.name.slice(0, 18);
      const memo = `POP|${evName}|${day}|${geo}|q:${sig8}`;

      const result = await mintGrant({
        amount: reward,
        toAddress: profile.wallet_address,
        memo,
      });
      txHash = result.txHash;
      await supabaseAdmin
        .from("claims")
        .update({ status: "minted", tx_hash: txHash })
        .eq("id", claimRow.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("mintGrant failed:", msg);
      await supabaseAdmin
        .from("claims")
        .update({ status: "failed", error: msg })
        .eq("id", claimRow.id);
      // Don't fail the user-facing claim — POP is already credited; the mint
      // can be retried from an admin tool later.
    }

    return {
      ok: true,
      eventId: event.id,
      eventName: event.name,
      coverUrl: event.cover_url,
      reward,
      newBalance,
      txHash,
    };
  });
