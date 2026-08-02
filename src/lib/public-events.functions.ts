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
  /** Market this event belongs to (null when unassigned). */
  market_slug: string | null;
  /** Coarse coordinates (~1km) for distance filtering; null for online events. */
  lat: number | null;
  lng: number | null;
  online: boolean;
};

export type EventMarketOption = { slug: string; label: string };

export const listPublicEvents = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicEventListItem[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("events")
      .select("id, slug, name, description, start_at, end_at, time_zone, cover_url, capacity, visibility, market_slug, lat, lng")
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
      const rawLat = typeof row.lat === "number" ? row.lat : null;
      const rawLng = typeof row.lng === "number" ? row.lng : null;
      // Events without real coordinates are treated as online / anywhere.
      const online = rawLat == null || rawLng == null || (rawLat === 0 && rawLng === 0);
      const round = (n: number) => Math.round(n * 100) / 100;
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
        market_slug: (row as { market_slug?: string | null }).market_slug ?? null,
        lat: online || rawLat == null ? null : round(rawLat),
        lng: online || rawLng == null ? null : round(rawLng),
        online,
      };
    });
  },
);

/** Markets available for filtering the public events list. */
export const listEventMarkets = createServerFn({ method: "GET" }).handler(
  async (): Promise<EventMarketOption[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("pop_markets")
      .select("slug, city, region")
      .order("sort_order", { ascending: true });
    if (error || !data) return [];
    return data.map((m) => ({
      slug: m.slug,
      label: m.region ? `${m.city}, ${m.region}` : m.city,
    }));
  },
);

/** Resolves a US ZIP code to coordinates so the list can filter by radius. */
export const geocodeZip = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => {
    const zip = String((d as { zip?: unknown })?.zip ?? "").trim();
    if (!/^\d{5}$/.test(zip)) throw new Error("Enter a 5-digit ZIP code");
    return { zip };
  })
  .handler(async ({ data }): Promise<{ lat: number; lng: number; label: string }> => {
    const key = process.env["GOOGLE_MAPS_API_KEY"];
    if (!key) throw new Error("Location lookup is unavailable right now");
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("components", `postal_code:${data.zip}|country:US`);
    url.searchParams.set("key", key);
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`Location lookup failed (${res.status})`);
    const json = (await res.json()) as {
      status: string;
      results?: { formatted_address: string; geometry: { location: { lat: number; lng: number } } }[];
    };
    const hit = json.results?.[0];
    if (!hit) throw new Error("We couldn't find that ZIP code");
    return {
      lat: hit.geometry.location.lat,
      lng: hit.geometry.location.lng,
      label: hit.formatted_address,
    };
  });
