import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachSupabaseAuth } from "./auth-client-middleware";

export type MyEventMembership = {
  /** Slug of a PUBLIC_EVENTS entry the signed-in user is registered for */
  slug: string;
  signed_up_at: string;
  status: string;
  checked_in_at: string | null;
};

/**
 * Returns the public event slugs the signed-in user is registered for,
 * derived from event_signups matched by email. event_signups is admin-only
 * (RLS), so this runs server-side with the admin client.
 *
 * Today event_signups has no event_id/slug column — the table represents the
 * single July 4 BBQ signup list. We surface that as the "july4-marina-bbq"
 * slug. When per-event signups land, this fn changes; the UI shape doesn't.
 */
export const getMyEventMemberships = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ memberships: MyEventMembership[] }> => {
    const email = context.claims?.email as string | undefined;
    if (!email) return { memberships: [] };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("event_signups")
      .select("signed_up_at, status, checked_in_at")
      .eq("email", email.toLowerCase())
      .order("signed_up_at", { ascending: false })
      .limit(5);

    if (error) {
      console.error("[getMyEventMemberships]", error);
      return { memberships: [] };
    }

    const memberships: MyEventMembership[] = (data ?? []).map((row) => ({
      slug: "july4-marina-bbq",
      signed_up_at: row.signed_up_at,
      status: row.status,
      checked_in_at: row.checked_in_at,
    }));

    return { memberships };
  });
