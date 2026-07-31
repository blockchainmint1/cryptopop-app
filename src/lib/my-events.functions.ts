import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachSupabaseAuth } from "./auth-client-middleware";

export type MyEventMembership = {
  /** event_signups row id — used to deep-link into /my-pass */
  signup_id: string;
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
 */
export const getMyEventMemberships = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ memberships: MyEventMembership[] }> => {
    const email = context.claims?.email as string | undefined;
    if (!email) return { memberships: [] };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("event_signups")
      .select("id, signed_up_at, status, checked_in_at, events(slug)")
      .eq("email", email.toLowerCase())
      .order("signed_up_at", { ascending: false })
      .limit(5);

    if (error) {
      console.error("[getMyEventMemberships]", error);
      return { memberships: [] };
    }

    const memberships: MyEventMembership[] = (data ?? []).map((row) => ({
      signup_id: row.id,
      slug:
        (row as { events?: { slug: string | null } | null }).events?.slug ?? "",
      signed_up_at: row.signed_up_at,
      status: row.status,
      checked_in_at: row.checked_in_at,
    }));


    return { memberships };
  });
