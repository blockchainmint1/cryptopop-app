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
  mobile_number: z.string().trim().min(3).max(32),
  instagram_handle: z.string().trim().max(64).optional().nullable(),
  telegram_handle: z.string().trim().max(64).optional().nullable(),
  is_friend: z.boolean(),
  guest_count: z.number().int().min(0).max(20).default(0),
  event_slug: z.string().trim().max(120).optional().nullable(),
  external_wallet: z.string().trim().min(26).max(48).optional().nullable(),
});

// Public: create a signup without exposing the private signups table to public reads.
export const createEventSignup = createServerFn({ method: "POST" })
  .inputValidator((input) => eventSignupSchema.parse(input))
  .handler(async ({ data }) => {
    const instagram = data.instagram_handle?.replace(/^@/, "").trim() || null;
    const telegram = data.telegram_handle?.replace(/^@/, "").trim() || null;
    const signupReward = await getRewardAmount("event_signup", 10);

    // Resolve event_id from slug so the signup is linked to its event.
    let eventId: string | null = null;
    if (data.event_slug) {
      const { data: ev } = await supabaseAdmin
        .from("events")
        .select("id")
        .eq("slug", data.event_slug)
        .maybeSingle();
      eventId = ev?.id ?? null;
    }

    // Optional: user-supplied external TXC wallet. If provided & valid we mint
    // POP directly to it and skip creating a custodial wallet for their email.
    let externalWallet: string | null = null;
    const rawExternal = data.external_wallet?.trim();
    if (rawExternal) {
      try {
        externalWallet = validateTxcAddress(rawExternal);
      } catch {
        throw new Error("invalid_wallet_address");
      }
    }

    const { data: inserted, error } = await supabaseAdmin
      .from("event_signups")
      .insert({
        full_name: data.full_name,
        email: data.email.toLowerCase(),
        mobile_number: data.mobile_number,
        instagram_handle: instagram,
        telegram_handle: telegram,
        is_friend: data.is_friend,
        guest_count: data.is_friend ? data.guest_count : 0,
        pop_credits: signupReward,
        completed_activities: ["signup"],
        signup_source: "website",
        status: "confirmed",
        event_id: eventId,
        external_wallet: externalWallet,
      })
      .select("id")
      .single();
    if (error) {
      console.error("[createEventSignup]", error);
      if (error.code === "23505") throw new Error("duplicate_signup");
      throw new Error("signup_failed");
    }
    const lcEmail = data.email.toLowerCase();

    // Resolve the wallet shown in the confirmation email + POP mint target.
    // If the user gave us their own TXC address, use it and do NOT spin up a
    // custodial email wallet. Otherwise ensure their custodial one exists.
    let walletAddress: string | null = externalWallet;
    if (!externalWallet) {
      try {
        const w = await ensureEmailWallet(lcEmail);
        walletAddress = w.walletAddress;
      } catch (e) {
        console.error("[createEventSignup] ensureEmailWallet", e);
      }
    }
    try {
      await awardPop({
        email: lcEmail,
        amount: signupReward,
        source: "event_signup",
        sourceId: inserted.id,
        memo: "CryptoPOP signup",
        walletOverride: externalWallet,
      });
    } catch (e) {
      // awardPop catches mint failures internally; this only catches insert
      // failures (e.g. RLS/constraint). Don't break the signup.
      console.error("[createEventSignup] awardPop", e);
    }


    // Telegram notification (awaited so it lands before Worker terminates)
    await notifyEventSignup({
      fullName: data.full_name,
      email: lcEmail,
      mobile: data.mobile_number,
      instagram,
      telegram,
      isFriend: data.is_friend,
      guestCount: data.is_friend ? data.guest_count : 0,
      signupId: inserted.id,
    });

    // Fire-and-forget confirmation email (failures don't break signup)
    enqueueTransactionalEmail({
      templateName: "event-confirmation",
      recipientEmail: lcEmail,
      idempotencyKey: `event-confirm-${inserted.id}`,
      templateData: {
        name: data.full_name,
        passId: inserted.id,
        walletAddress,
      },
    }).catch((e) => console.error("[createEventSignup] email enqueue", e));
    return { id: inserted.id, walletAddress };
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
    if (!row) return { signup: null };
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

// Admin: mark a signup as checked-in (idempotent — no-op if already checked in)
export const checkInSignup = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: existing } = await supabaseAdmin
      .from("event_signups")
      .select("id, full_name, checked_in_at")
      .eq("id", data.id)
      .maybeSingle();
    if (!existing) throw new Error("Signup not found");
    if (existing.checked_in_at) {
      return {
        ok: true,
        alreadyCheckedIn: true,
        checkedInAt: existing.checked_in_at,
        fullName: existing.full_name,
      };
    }
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from("event_signups")
      .update({ checked_in_at: now, checked_in_by: context.userId })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return {
      ok: true,
      alreadyCheckedIn: false,
      checkedInAt: now,
      fullName: existing.full_name,
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
    await assertAdmin(context.userId);

    const { data: ev, error: evErr } = await supabaseAdmin
      .from("events")
      .select("id, name, start_at, end_at, time_zone, lat, lng")
      .eq("id", data.event_id)
      .maybeSingle();
    if (evErr || !ev) throw new Error("Event not found");

    const lcEmail = data.email.toLowerCase();
    const signupReward = await getRewardAmount("event_signup", 10);

    const { data: inserted, error } = await supabaseAdmin
      .from("event_signups")
      .insert({
        full_name: data.full_name,
        email: lcEmail,
        mobile_number: data.mobile_number?.trim() || "",
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
      if (error.code === "23505") throw new Error("This email is already registered for this event.");
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

    // Telegram notification
    notifyEventSignup({
      fullName: data.full_name,
      email: lcEmail,
      mobile: data.mobile_number ?? "",
      instagram: null,
      telegram: null,
      isFriend: data.guest_count > 0,
      guestCount: data.guest_count,
      signupId: inserted.id,
    }).catch((e) => console.error("[adminAddGuest] telegram", e));

    // Confirmation email — same template used by the public RSVP flow.
    enqueueTransactionalEmail({
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
    }).catch((e) => console.error("[adminAddGuest] email enqueue", e));

    return { id: inserted.id, walletAddress };
  });


