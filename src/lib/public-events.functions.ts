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

type MarketRow = {
  slug: string;
  label: string;
  lat: number | null;
  lng: number | null;
  country: string | null;
};


/**
 * Market catalog. Prefers the main site's public markets API (so locations stay
 * in sync with the hub); falls back to the local pop_markets table.
 */
async function getMarketCatalog(): Promise<MarketRow[]> {
  const { MAIN_SITE_ORIGIN } = await import("@/lib/public-events");
  try {
    const res = await fetch(`${MAIN_SITE_ORIGIN}/api/public/markets`, {
      headers: { accept: "application/json" },
    });
    if (res.ok) {
      const json: unknown = await res.json();
      const rows = Array.isArray(json)
        ? json
        : Array.isArray((json as { markets?: unknown })?.markets)
          ? (json as { markets: unknown[] }).markets
          : [];
      const parsed = rows
        .map((raw) => {
          const r = raw as Record<string, unknown>;
          const slug = typeof r["slug"] === "string" ? r["slug"] : null;
          if (!slug) return null;
          const city = typeof r["city"] === "string" ? r["city"] : slug;
          const region = typeof r["region"] === "string" ? r["region"] : null;
          return {
            slug,
            label: region ? `${city}, ${region}` : city,
            lat: typeof r["lat"] === "number" ? r["lat"] : null,
            lng: typeof r["lng"] === "number" ? r["lng"] : null,
          } satisfies MarketRow;
        })
        .filter((m): m is MarketRow => m !== null);
      if (parsed.length) return parsed;
    }
  } catch {
    // fall through to local catalog
  }

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("pop_markets")
      .select("slug, city, region, lat, lng, sort_order")
      .order("sort_order", { ascending: true });
    return (data ?? []).map((m) => ({
      slug: m.slug as string,
      label: m.region ? `${m.city}, ${m.region}` : (m.city as string),
      lat: m.lat == null ? null : Number(m.lat),
      lng: m.lng == null ? null : Number(m.lng),
    }));
  } catch {
    return [];
  }
}

/** Great-circle distance in km. */
function kmBetween(aLat: number, aLng: number, bLat: number, bLng: number) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** Nearest market within 300km of the event's coordinates. */
function nearestMarket(catalog: MarketRow[], lat: number | null, lng: number | null) {
  if (lat == null || lng == null) return null;
  let best: { slug: string; km: number } | null = null;
  for (const m of catalog) {
    if (m.lat == null || m.lng == null) continue;
    const km = kmBetween(lat, lng, m.lat, m.lng);
    if (!best || km < best.km) best = { slug: m.slug, km };
  }
  return best && best.km <= 300 ? best.slug : null;
}

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
    const catalog = await getMarketCatalog();

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
        // The hub feed can carry a stale/default market tag, so trust the
        // event's own coordinates first and fall back to the feed value.
        const feedMarket = typeof row["market_slug"] === "string" ? row["market_slug"] : null;
        const geoMarket = online ? null : nearestMarket(catalog, rawLat, rawLng);
        const market_slug = geoMarket ?? feedMarket;
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
          market_slug,
          lat: online || rawLat == null ? null : round(rawLat),
          lng: online || rawLng == null ? null : round(rawLng),
          online,
        } satisfies PublicEventListItem;
      })
      .filter((e): e is PublicEventListItem => e !== null)
      .sort((a, b) => +new Date(a.start_at) - +new Date(b.start_at));
  },
);

/** Markets available for filtering the public events list. */
export const listEventMarkets = createServerFn({ method: "GET" }).handler(
  async (): Promise<EventMarketOption[]> => {
    const [events, catalog] = await Promise.all([listPublicEvents(), getMarketCatalog()]);
    const used = new Set(events.map((e) => e.market_slug).filter((s): s is string => !!s));
    const bySlug = new Map(catalog.map((m) => [m.slug, m.label]));
    return Array.from(used)
      .sort()
      .map((slug) => ({
        slug,
        label:
          bySlug.get(slug) ??
          slug
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

