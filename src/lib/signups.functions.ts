import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachSupabaseAuth } from "./auth-client-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { enqueueTransactionalEmail } from "./email/send.server";

// Admin-only columns (includes PII). Never expose to public endpoints.
const adminColumns =
  "id, full_name, email, mobile_number, instagram_handle, telegram_handle, is_friend, pop_credits, completed_activities, signup_source, status, signed_up_at, checked_in_at";

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
});

// Public: create a signup without exposing the private signups table to public reads.
export const createEventSignup = createServerFn({ method: "POST" })
  .inputValidator((input) => eventSignupSchema.parse(input))
  .handler(async ({ data }) => {
    const instagram = data.instagram_handle?.replace(/^@/, "").trim() || null;
    const telegram = data.telegram_handle?.replace(/^@/, "").trim() || null;
    const { data: inserted, error } = await supabaseAdmin
      .from("event_signups")
      .insert({
        full_name: data.full_name,
        email: data.email.toLowerCase(),
        mobile_number: data.mobile_number,
        instagram_handle: instagram,
        telegram_handle: telegram,
        is_friend: data.is_friend,
        pop_credits: 10,
        completed_activities: ["signup"],
        signup_source: "website",
        status: "confirmed",
      })
      .select("id")
      .single();
    if (error) {
      console.error("[createEventSignup]", error);
      if (error.code === "23505") throw new Error("duplicate_signup");
      throw new Error("signup_failed");
    }
    return { id: inserted.id };
  });

// Public: fetch a signup by its id (the id IS the pass — possession of the
// UUID is the access token). Returns only non-PII pass fields. Returns null
// when not found.
export const getSignupById = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("event_signups")
      .select(passColumns)
      .eq("id", data.id)
      .maybeSingle();
    if (error) {
      console.error("[getSignupById]", error);
      throw new Error("lookup_failed");
    }
    return { signup: row };
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
      .select("id, checked_in_at")
      .eq("id", data.id)
      .maybeSingle();
    if (!existing) throw new Error("Signup not found");
    if (existing.checked_in_at) {
      return { ok: true, alreadyCheckedIn: true, checkedInAt: existing.checked_in_at };
    }
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from("event_signups")
      .update({ checked_in_at: now, checked_in_by: context.userId })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true, alreadyCheckedIn: false, checkedInAt: now };
  });
