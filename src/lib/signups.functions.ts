import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachSupabaseAuth } from "./auth-client-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const safeColumns =
  "id, full_name, email, mobile_number, instagram_handle, telegram_handle, is_friend, pop_credits, completed_activities, signup_source, status, signed_up_at, checked_in_at";

// Public: fetch a signup by its id (the id IS the pass — possession of the
// UUID is the access token). Returns null when not found.
export const getSignupById = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("event_signups")
      .select(safeColumns)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
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
      .select(safeColumns)
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
