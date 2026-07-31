// Public, read-only fetch for the RSVP page so admin edits to an event's
// description/name flow through to the public page without a redeploy.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type PublicEventDb = {
  slug: string;
  name: string;
  description: string | null;
  start_at: string;
  end_at: string;
  time_zone: string;
  lat: number;
  lng: number;
  /** Max attendees (headcount incl. guests). Null = unlimited. */
  capacity: number | null;
  /** Seats already taken (signups + their guests). */
  taken: number;
  /** Seats remaining, or null when unlimited. */
  spotsLeft: number | null;
  /** Whether the public form should accept new signups. */
  rsvpOpen: boolean;
} | null;

export const getPublicEventBySlug = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ slug: z.string().trim().min(1).max(120) }).parse(input))
  .handler(async ({ data }): Promise<PublicEventDb> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("events")
      .select("id, slug, name, description, start_at, end_at, time_zone, lat, lng, capacity")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) return null;
    if (!row || !row.slug) return null;

    const capacity =
      typeof (row as { capacity?: number | null }).capacity === "number"
        ? (row as { capacity: number }).capacity
        : null;

    let taken = 0;
    const { data: signups } = await supabaseAdmin
      .from("event_signups")
      .select("guest_count")
      .eq("event_id", row.id)
      .neq("status", "cancelled");
    taken = (signups ?? []).reduce(
      (sum, s) => sum + 1 + Math.max(0, Number(s.guest_count ?? 0)),
      0,
    );

    const spotsLeft = capacity == null ? null : Math.max(0, capacity - taken);
    const ended = new Date(row.end_at).getTime() < Date.now();
    const rsvpOpen = !ended && (spotsLeft == null || spotsLeft > 0);

    return {
      slug: row.slug,
      name: row.name,
      description: row.description,
      start_at: row.start_at,
      end_at: row.end_at,
      time_zone: row.time_zone ?? "America/Los_Angeles",
      lat: Number(row.lat),
      lng: Number(row.lng),
      capacity,
      taken,
      spotsLeft,
      rsvpOpen,
    };
  });
