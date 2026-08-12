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
  full_name: string;
  pop_credits: number;
  guest_count: number;
  event: {
    name: string;
    description: string | null;
    start_at: string;
    end_at: string;
    time_zone: string;
    lat: number;
    lng: number;
    cover_url: string | null;
  } | null;
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
      .select(
        "id, signed_up_at, status, checked_in_at, full_name, pop_credits, guest_count, events(slug, name, description, start_at, end_at, time_zone, lat, lng, cover_url)",
      )
      .eq("email", email.toLowerCase())
      .neq("status", "cancelled");

    if (error) {
      console.error("[getMyEventMemberships]", error);
      return { memberships: [] };
    }

    const memberships: MyEventMembership[] = (data ?? []).map((row) => {
      const ev = (row as { events?: Record<string, unknown> | null }).events ?? null;
      return {
        signup_id: row.id,
        slug: (ev?.slug as string) ?? "",
        signed_up_at: row.signed_up_at,
        status: row.status,
        checked_in_at: row.checked_in_at,
        full_name: row.full_name,
        pop_credits: Number(row.pop_credits ?? 0),
        guest_count: Number(row.guest_count ?? 0),
        event: ev
          ? {
              name: (ev.name as string) ?? "",
              description: (ev.description as string | null) ?? null,
              start_at: (ev.start_at as string) ?? "",
              end_at: (ev.end_at as string) ?? "",
              time_zone: (ev.time_zone as string) ?? "America/Los_Angeles",
              lat: Number(ev.lat ?? 0),
              lng: Number(ev.lng ?? 0),
              cover_url: (ev.cover_url as string | null) ?? null,
            }
          : null,
      };
    });

    // Chronological order: soonest event first, then past events at the bottom.
    memberships.sort((a, b) => {
      const aStart = a.event?.start_at ? new Date(a.event.start_at).getTime() : Infinity;
      const bStart = b.event?.start_at ? new Date(b.event.start_at).getTime() : Infinity;
      return aStart - bStart;
    });

    return { memberships };
  });
