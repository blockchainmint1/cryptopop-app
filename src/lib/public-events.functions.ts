// Public, read-only listing of events, sourced from the main CryptoPOP website.
import { createServerFn } from "@tanstack/react-start";
import { MAIN_SITE_EVENTS_API } from "@/lib/public-events";

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
    // Events live on the main CryptoPOP website; the wallet is read-only here.
    let payload: unknown;
    try {
      const res = await fetch(MAIN_SITE_EVENTS_API, {
        headers: { accept: "application/json" },
      });
      if (!res.ok) return [];
      payload = await res.json();
    } catch {
      return [];
    }

    const rows = Array.isArray(payload)
      ? payload
      : Array.isArray((payload as { events?: unknown })?.events)
        ? ((payload as { events: unknown[] }).events)
        : Array.isArray((payload as { data?: unknown })?.data)
          ? ((payload as { data: unknown[] }).data)
          : [];

    const now = Date.now();
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
    const round = (n: number) => Math.round(n * 100) / 100;

    return rows
      .map((raw) => {
        const row = raw as Record<string, unknown>;
        const slug = typeof row["slug"] === "string" ? row["slug"] : null;
        const name = typeof row["name"] === "string" ? row["name"] : null;
        const start_at = typeof row["start_at"] === "string" ? row["start_at"] : null;
        if (!slug || !name || !start_at) return null;
        const end_at = typeof row["end_at"] === "string" ? row["end_at"] : start_at;
        const capacity = num(row["capacity"]);
        const taken = num(row["taken"]) ?? 0;
        const spotsLeft =
          num(row["spotsLeft"]) ?? (capacity == null ? null : Math.max(0, capacity - taken));
        const past =
          typeof row["past"] === "boolean" ? row["past"] : new Date(end_at).getTime() < now;
        const rawLat = num(row["lat"]);
        const rawLng = num(row["lng"]);
        const online =
          typeof row["online"] === "boolean"
            ? row["online"]
            : rawLat == null || rawLng == null || (rawLat === 0 && rawLng === 0);
        return {
          slug,
          name,
          description: typeof row["description"] === "string" ? row["description"] : null,
          start_at,
          end_at,
          time_zone: typeof row["time_zone"] === "string" ? row["time_zone"] : "America/Chicago",
          cover_url: typeof row["cover_url"] === "string" ? row["cover_url"] : null,
          capacity,
          taken,
          spotsLeft,
          rsvpOpen:
            typeof row["rsvpOpen"] === "boolean"
              ? row["rsvpOpen"]
              : !past && (spotsLeft == null || spotsLeft > 0),
          past,
          market_slug: typeof row["market_slug"] === "string" ? row["market_slug"] : null,
          lat: online || rawLat == null ? null : round(rawLat),
          lng: online || rawLng == null ? null : round(rawLng),
          online,
        } satisfies PublicEventListItem;
      })
      .filter((e): e is PublicEventListItem => e !== null)
      .sort((a, b) => +new Date(a.start_at) - +new Date(b.start_at));
  },
);

/** Markets available for filtering the public events list (derived from the feed). */
export const listEventMarkets = createServerFn({ method: "GET" }).handler(
  async (): Promise<EventMarketOption[]> => {
    const events = await listPublicEvents();
    const slugs = Array.from(
      new Set(events.map((e) => e.market_slug).filter((s): s is string => !!s)),
    ).sort();
    return slugs.map((slug) => ({
      slug,
      label: slug
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" "),
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
    const serverKey = process.env["GOOGLE_MAPS_SERVER_KEY"];
    if (!serverKey) throw new Error("Location lookup is unavailable right now");
    const url =
      "https://maps.googleapis.com/maps/api/geocode/json?" +
      new URLSearchParams({
        components: `postal_code:${data.zip}|country:US`,
        key: serverKey,
      }).toString();
    const res = await fetch(url);
    if (!res.ok) {
      const body = await res.text();
      console.error(`Geocode failed [${res.status}]: ${body}`);
      throw new Error(`Location lookup failed (${res.status})`);
    }
    const json = (await res.json()) as {
      status: string;
      error_message?: string;
      results?: { formatted_address: string; geometry: { location: { lat: number; lng: number } } }[];
    };
    if (json.status !== "OK") {
      console.error(`Geocode status ${json.status}: ${json.error_message ?? ""}`);
    }
    if (json.status === "REQUEST_DENIED") {
      throw new Error(
        "ZIP search is misconfigured: the Google Maps server key was denied. Check that it has no referrer restrictions and that the Geocoding API is enabled.",
      );
    }

    const hit = json.results?.[0];
    if (!hit) throw new Error("We couldn't find that ZIP code");

    return {
      lat: hit.geometry.location.lat,
      lng: hit.geometry.location.lng,
      label: hit.formatted_address,
    };
  });

