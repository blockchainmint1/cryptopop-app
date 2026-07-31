// Public, read-only listing of events for the /events page.
import { createServerFn } from "@tanstack/react-start";

export type PublicEventListItem = {
  slug: string;
  name: string;
  description: string | null;
  start_at: string;
  end_at: string;
  time_zone: string;
  cover_url: string | null;
  capacity: number | null;
  taken: number;
  spotsLeft: number | null;
  rsvpOpen: boolean;
  past: boolean;
};

export const listPublicEvents = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicEventListItem[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("events")
      .select("id, slug, name, description, start_at, end_at, time_zone, cover_url, capacity, visibility")
      .eq("visibility", "public")
      .not("slug", "is", null)
      .order("start_at", { ascending: true });
    if (error || !rows) return [];

    const ids = rows.map((r) => r.id);
    const counts = new Map<string, number>();
    if (ids.length) {
      const { data: signups } = await supabaseAdmin
        .from("event_signups")
        .select("event_id, guest_count")
        .in("event_id", ids)
        .neq("status", "cancelled");
      for (const s of signups ?? []) {
        if (!s.event_id) continue;
        counts.set(
          s.event_id,
          (counts.get(s.event_id) ?? 0) + 1 + Math.max(0, Number(s.guest_count ?? 0)),
        );
      }
    }

    const now = Date.now();
    return rows.map((row) => {
      const capacity =
        typeof (row as { capacity?: number | null }).capacity === "number"
          ? (row as { capacity: number }).capacity
          : null;
      const taken = counts.get(row.id) ?? 0;
      const spotsLeft = capacity == null ? null : Math.max(0, capacity - taken);
      const past = new Date(row.end_at).getTime() < now;
      return {
        slug: row.slug as string,
        name: row.name,
        description: row.description,
        start_at: row.start_at,
        end_at: row.end_at,
        time_zone: row.time_zone ?? "America/Chicago",
        cover_url: row.cover_url ?? null,
        capacity,
        taken,
        spotsLeft,
        rsvpOpen: !past && (spotsLeft == null || spotsLeft > 0),
        past,
      };
    });
  },
);
