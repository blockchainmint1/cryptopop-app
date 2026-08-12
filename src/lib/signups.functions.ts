import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachSupabaseAuth } from "./auth-client-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { enqueueTransactionalEmail } from "./email/send.server";
import { ensureEmailWallet, awardPop, validateTxcAddress } from "./email-wallet.server";
import { getRewardAmount } from "./reward-rules.server";
import { notifyEventSignup } from "./telegram.server";

// Admin-only columns (includes PII). Never expose to public endpoints.
const adminColumns =
  "id, full_name, email, mobile_number, instagram_handle, telegram_handle, is_friend, guest_count, pop_credits, completed_activities, signup_source, status, signed_up_at, checked_in_at";

// Public pass columns — what the holder of the pass UUID can see.
// Excludes PII (email, mobile, IG, Telegram) to avoid leaking contact info
// to anyone who obtains the pass UUID.
const passColumns =
  "id, full_name, pop_credits, completed_activities, status, signed_up_at, checked_in_at";

const eventSignupSchema = z.object({
  full_name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254),
  mobile_number: z.string().trim().max(32).optional().nullable(),
  instagram_handle: z.string().trim().max(64).optional().nullable(),
  telegram_handle: z.string().trim().max(64).optional().nullable(),
  is_friend: z.boolean(),
  guest_count: z.number().int().min(0).max(20).default(0),
  event_slug: z.string().trim().max(120).optional().nullable(),
  external_wallet: z.string().trim().min(26).max(48).optional().nullable(),
});

// Public: RSVP happens in-app, but the CryptoPOP hub owns the signup record.
// We relay the form server-to-server (no CORS, partner key stays server-side);
// the hub enforces capacity, the RSVP window, first-event-only POP, minting to
// the user's wallet, the confirmation email and the Telegram alert.
// We keep a local mirror row so the pass + door check-in work offline of the hub.
export const createEventSignup = createServerFn({ method: "POST" })
  .inputValidator((input) => eventSignupSchema.parse(input))
  .handler(async ({ data }) => {
    const lcEmail = data.email.toLowerCase();
    const mobile = data.mobile_number?.trim() || null;
    const guestCount = data.is_friend ? data.guest_count : 0;

    if (!data.event_slug) throw new Error("event_not_found");

    // Validate the wallet locally so we fail fast with a friendly message.
    let externalWallet: string | null = null;
    const rawExternal = data.external_wallet?.trim();
    if (rawExternal) {
      try {
        externalWallet = validateTxcAddress(rawExternal);
      } catch {
        throw new Error("invalid_wallet_address");
      }
    }

    const { hubCreateSignup } = await import("./pop-hub-signup.server");
    const hub = await hubCreateSignup({
      event_slug: data.event_slug,
      full_name: data.full_name,
      email: lcEmail,
      mobile_number: mobile,
      is_friend: data.is_friend,
      guest_count: guestCount,
      external_wallet: externalWallet,
    });

    // Local mirror (best-effort). Never awards POP or sends mail — the hub did.
    try {
      let eventId: string | null = null;
      const { data: ev } = await supabaseAdmin
        .from("events")
        .select("id")
        .eq("slug", data.event_slug)
        .maybeSingle();
      eventId = ev?.id ?? null;
      if (!eventId) {
        const { listPublicEvents } = await import("@/lib/public-events.functions");
        const remote = (await listPublicEvents()).find((e) => e.slug === data.event_slug);
        if (remote) {
          const { data: created } = await supabaseAdmin
            .from("events")
            .insert({
              slug: remote.slug,
              name: remote.name,
              description: remote.description,
              start_at: remote.start_at,
              end_at: remote.end_at,
              time_zone: remote.time_zone,
              lat: remote.lat ?? 0,
              lng: remote.lng ?? 0,
              capacity: remote.capacity,
              cover_url: remote.cover_url,
              market_slug: remote.market_slug,
            })
            .select("id")
            .single();
          eventId = created?.id ?? null;
        }
      }
      await supabaseAdmin.from("event_signups").upsert(
        {
          id: hub.id,
          full_name: data.full_name,
          email: lcEmail,
          mobile_number: mobile,
          is_friend: data.is_friend,
          guest_count: guestCount,
          pop_credits: hub.pop_awarded,
          completed_activities: ["signup"],
          signup_source: "pop-wallet",
          status: "confirmed",
          event_id: eventId,
          external_wallet: externalWallet,
        },
        { onConflict: "id" },
      );
    } catch (e) {
      console.error("[createEventSignup] local mirror", e);
    }

    return {
      id: hub.id,
      walletAddress: hub.wallet_address ?? externalWallet,
      popAwarded: hub.pop_awarded,
      firstEvent: hub.first_event,
    };
  });


// Public: fetch a signup by its id (the id IS the pass — possession of the
// UUID is the access token). Returns only non-PII pass fields. Returns null
// when not found.
export const getSignupById = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("event_signups")
      .select(passColumns + ", email")
      .eq("id", data.id)
      .maybeSingle();
    if (error) {
      console.error("[getSignupById]", error);
      throw new Error("lookup_failed");
    }
    if (!row) {
      // Pass was created on the hub (or the local mirror never landed) —
      // fall back to the hub's non-PII pass endpoint.
      const { hubGetPass } = await import("./pop-hub-signup.server");
      const pass = await hubGetPass(data.id);
      if (!pass) return { signup: null };
      return {
        signup: {
          id: pass.id,
          full_name: pass.full_name,
          pop_credits: pass.pop_credits,
          completed_activities: ["signup"],
          status: pass.status,
          signed_up_at: null,
          checked_in_at: pass.checked_in_at,
        },
      };
    }

    const r = row as unknown as Record<string, unknown> & { email: string };

    // Reconcile displayed POP with the ledger (source of truth for on-chain awards).
    // Count 'sent' and 'pending' so users see credit before the broadcast confirms;
    // 'failed' rows are excluded.
    const { data: awards } = await supabaseAdmin
      .from("pop_awards")
      .select("amount,status")
      .eq("email", r.email)
      .in("status", ["sent", "pending"]);
    const ledgerPop = (awards ?? []).reduce(
      (sum, a) => sum + Number(a.amount ?? 0),
      0,
    );

    // Strip email from the response (passColumns contract excludes PII).
    const { email: _email, ...passFields } = r;
    return { signup: { ...passFields, pop_credits: ledgerPop } };
  });

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("forbidden");
}

// Door check-in + on-the-spot Add Guest can be done by either an admin
// or a gatekeeper (role scoped ONLY to /admin/checkin).
async function assertAdminOrGatekeeper(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "gatekeeper"])
    .limit(1)
    .maybeSingle();
  if (!data) throw new Error("forbidden");
}

// Admin: search signups by name/email/phone
export const searchSignups = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ q: z.string().trim().max(120).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    let query = supabaseAdmin
      .from("event_signups")
      .select(adminColumns)
      .order("signed_up_at", { ascending: false })
      .limit(100);
    const q = data.q?.trim();
    if (q) {
      const like = `%${q.replace(/[%_]/g, "")}%`;
      query = query.or(
        `full_name.ilike.${like},email.ilike.${like},mobile_number.ilike.${like}`,
      );
    }
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return { signups: rows ?? [] };
  });

// Admin: mark a signup as checked-in (idempotent — no-op if already checked in).
// On first check-in, mints POP for the attendee + each accompanying guest
// (25 POP per head by default, configurable via the `event_checkin` reward rule).
export const checkInSignup = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        // Optional override of the guest count recorded at signup — lets the
        // door scanner reflect how many people actually walked in together.
        guest_count: z.number().int().min(0).max(20).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdminOrGatekeeper(context.userId);
    const { data: existing } = await supabaseAdmin
      .from("event_signups")
      .select("id, full_name, email, external_wallet, guest_count, checked_in_at")
      .eq("id", data.id)
      .maybeSingle();
    if (!existing) throw new Error("Signup not found");
    const perHead = await getRewardAmount("event_checkin", 25);

    if (existing.checked_in_at) {
      // Re-scan of an already-checked-in pass. If the door person set a guest
      // count on the stepper, treat it as an additional wave that showed up
      // later — increment the recorded guest_count and mint POP for the delta
      // only. Idempotent per (source, source_id): repeated identical top-ups
      // with the same resulting total are a no-op.
      const addedHeads = Math.max(0, data.guest_count ?? 0);
      if (addedHeads > 0) {
        const newGuestCount = (existing.guest_count ?? 0) + addedHeads;
        await supabaseAdmin
          .from("event_signups")
          .update({ guest_count: newGuestCount })
          .eq("id", data.id);
        const topUp = perHead * addedHeads;
        if (topUp > 0 && existing.email) {
          try {
            await awardPop({
              email: existing.email,
              amount: topUp,
              source: "event_checkin",
              sourceId: `${existing.id}:g${newGuestCount}`,
              memo: `Check-in +${addedHeads}`,
              walletOverride: existing.external_wallet,
            });
          } catch (e) {
            console.error("[checkInSignup] top-up awardPop", e);
          }
        }
        return {
          ok: true,
          alreadyCheckedIn: true,
          toppedUp: true,
          addedHeads,
          checkedInAt: existing.checked_in_at,
          fullName: existing.full_name,
          popAwarded: topUp,
          heads: addedHeads,
        };
      }
      return {
        ok: true,
        alreadyCheckedIn: true,
        toppedUp: false,
        addedHeads: 0,
        checkedInAt: existing.checked_in_at,
        fullName: existing.full_name,
        popAwarded: 0,
        heads: 0,
      };
    }
    const now = new Date().toISOString();

    // Persist the door-observed guest count when supplied so records match reality.
    const guestCount =
      typeof data.guest_count === "number"
        ? data.guest_count
        : (existing.guest_count ?? 0);

    const update: {
      checked_in_at: string;
      checked_in_by: string;
      guest_count?: number;
    } = {
      checked_in_at: now,
      checked_in_by: context.userId,
    };
    if (typeof data.guest_count === "number") {
      update.guest_count = guestCount;
    }
    const { error } = await supabaseAdmin
      .from("event_signups")
      .update(update)
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    // Award POP per head (attendee + guests). Idempotent via (source, source_id).
    const heads = 1 + Math.max(0, guestCount);
    const total = perHead * heads;
    if (total > 0 && existing.email) {
      try {
        await awardPop({
          email: existing.email,
          amount: total,
          source: "event_checkin",
          sourceId: existing.id,
          memo: heads > 1 ? `Check-in ×${heads}` : "Event check-in",
          walletOverride: existing.external_wallet,
        });
      } catch (e) {
        console.error("[checkInSignup] awardPop", e);
      }
    }

    return {
      ok: true,
      alreadyCheckedIn: false,
      checkedInAt: now,
      fullName: existing.full_name,
      popAwarded: total,
      heads,
    };
  });

// Admin: manually add a guest to an event, bypassing the public RSVP flow.
// Creates the signup, awards signup POP, and emails the guest their pass +
// event info (same shape the RSVP form triggers).
export const adminAddGuest = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        event_id: z.string().uuid(),
        full_name: z.string().trim().min(1).max(120),
        email: z.string().trim().email().max(254),
        mobile_number: z.string().trim().max(32).optional().nullable(),
        guest_count: z.number().int().min(0).max(20).default(0),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    // Admins add guests from /admin/events; gatekeepers add walk-ins at the door.
    await assertAdminOrGatekeeper(context.userId);

    const { data: ev, error: evErr } = await supabaseAdmin
      .from("events")
      .select("id, name, start_at, end_at, time_zone, lat, lng")
      .eq("id", data.event_id)
      .maybeSingle();
    if (evErr || !ev) throw new Error("Event not found");

    const lcEmail = data.email.toLowerCase();
    const signupReward = await getRewardAmount("event_signup", 10);

    const trimmedMobile = data.mobile_number?.trim() || null;
    const { data: inserted, error } = await supabaseAdmin
      .from("event_signups")
      .insert({
        full_name: data.full_name,
        email: lcEmail,
        mobile_number: trimmedMobile,
        is_friend: data.guest_count > 0,
        guest_count: data.guest_count,
        pop_credits: signupReward,
        completed_activities: ["signup"],
        signup_source: "admin_manual",
        status: "confirmed",
        event_id: ev.id,
      })
      .select("id")
      .single();
    if (error) {
      console.error("[adminAddGuest]", error);
      if (error.code === "23505") {
        // Distinguish email vs mobile collision so the door person sees the
        // real reason instead of a misleading "email already registered".
        const msg = (error.message || "").toLowerCase();
        if (msg.includes("mobile")) {
          throw new Error("That mobile number is already registered on another signup.");
        }
        throw new Error("This email is already registered.");
      }
      throw new Error("Failed to add guest");
    }

    // Custodial wallet + signup POP award (mirrors createEventSignup).
    let walletAddress: string | null = null;
    try {
      const w = await ensureEmailWallet(lcEmail);
      walletAddress = w.walletAddress;
    } catch (e) {
      console.error("[adminAddGuest] ensureEmailWallet", e);
    }
    try {
      await awardPop({
        email: lcEmail,
        amount: signupReward,
        source: "event_signup",
        sourceId: inserted.id,
        memo: "CryptoPOP signup (admin added)",
      });
    } catch (e) {
      console.error("[adminAddGuest] awardPop", e);
    }

    // Format event date for the email in the event's time zone.
    const start = new Date(ev.start_at);
    const end = new Date(ev.end_at);
    const dayLabel = start.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: ev.time_zone,
    });
    const timeFmt = (d: Date) =>
      d
        .toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          timeZone: ev.time_zone,
        })
        .replace(":00 ", " ");
    const eventDate = `${dayLabel} · ${timeFmt(start)}–${timeFmt(end)}`;
    const mapUrl = `https://www.google.com/maps?q=${ev.lat},${ev.lng}`;

    // Telegram notification (awaited — Worker may terminate before
    // fire-and-forget promises resolve).
    try {
      await notifyEventSignup({
        fullName: data.full_name,
        email: lcEmail,
        mobile: data.mobile_number ?? "",
        instagram: null,
        telegram: null,
        isFriend: data.guest_count > 0,
        guestCount: data.guest_count,
        signupId: inserted.id,
      });
    } catch (e) {
      console.error("[adminAddGuest] telegram", e);
    }

    // Confirmation email — same template used by the public RSVP flow.
    // Awaited so the enqueue + email_send_log insert complete before the
    // Worker terminates.
    try {
      await enqueueTransactionalEmail({
        templateName: "event-confirmation",
        recipientEmail: lcEmail,
        idempotencyKey: `event-confirm-${inserted.id}`,
        templateData: {
          name: data.full_name,
          passId: inserted.id,
          eventName: ev.name,
          eventDate,
          mapUrl,
          popCredits: signupReward,
          walletAddress,
        },
      });
    } catch (e) {
      console.error("[adminAddGuest] email enqueue", e);
    }

    return { id: inserted.id, walletAddress };
  });



// Lightweight events list for the door check-in scanner. Admin OR gatekeeper.
// Returns events that are live now or start within the next 7 days, plus any
// event that ended in the last 6 hours (late arrivals). Sorted so the most
// relevant "current" event is first.
export const listCheckinEvents = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminOrGatekeeper(context.userId);
    const now = new Date();
    const lookbackMs = 6 * 60 * 60 * 1000;
    const lookaheadMs = 7 * 24 * 60 * 60 * 1000;
    const fromEnd = new Date(now.getTime() - lookbackMs).toISOString();
    const toStart = new Date(now.getTime() + lookaheadMs).toISOString();

    const { data, error } = await supabaseAdmin
      .from("events")
      .select("id, name, start_at, end_at, time_zone")
      .gte("end_at", fromEnd)
      .lte("start_at", toStart)
      .order("start_at", { ascending: true });
    if (error) throw new Error(error.message);

    const nowTs = now.getTime();
    const events = (data ?? []).map((e) => {
      const startTs = new Date(e.start_at).getTime();
      const endTs = new Date(e.end_at).getTime();
      return { ...e, live: nowTs >= startTs && nowTs <= endTs };
    });
    events.sort((a, b) => {
      if (a.live !== b.live) return a.live ? -1 : 1;
      return new Date(a.start_at).getTime() - new Date(b.start_at).getTime();
    });
    return { events };
  });
