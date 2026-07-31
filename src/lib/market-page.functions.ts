// Public, read-only data for a single POP market page (/dallas, /lax, ...).
import { createServerFn } from "@tanstack/react-start";

export type MarketMerchant = {
  id: string;
  name: string;
  category: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  pop_per_visit: number;
  website: string | null;
};

export type MarketNewsItem = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  published_at: string;
};

export type MarketEvent = {
  slug: string;
  name: string;
  description: string | null;
  start_at: string;
  end_at: string;
  time_zone: string;
  capacity: number | null;
  spotsLeft: number | null;
};

export type MarketPageData = {
  slug: string;
  shortSlug: string | null;
  city: string;
  region: string | null;
  country: string;
  status: string;
  heroCopy: string | null;
  intro: string | null;
  lat: number | null;
  lng: number | null;
  manager: {
    name: string | null;
    title: string | null;
    bio: string | null;
    photoUrl: string | null;
  };
  merchants: MarketMerchant[];
  news: MarketNewsItem[];
  events: MarketEvent[];
} | null;

export const getMarketPage = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => {
    const slug = typeof d === "string" ? d : (d as { slug?: string })?.slug;
    if (!slug || typeof slug !== "string") throw new Error("slug required");
    return { slug };
  })
  .handler(async ({ data }): Promise<MarketPageData> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: market } = await supabaseAdmin
      .from("pop_markets")
      .select("*")
      .or(`slug.eq.${data.slug},short_slug.eq.${data.slug}`)
      .maybeSingle();
    if (!market) return null;

    const m = market as Record<string, any>;
    const slug = m.slug as string;

    const [{ data: merchants }, { data: news }, { data: events }] = await Promise.all([
      supabaseAdmin
        .from("merchants")
        .select("id, name, category, address, lat, lng, pop_per_visit, website")
        .eq("market_slug", slug)
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      supabaseAdmin
        .from("market_news")
        .select("id, title, body, link, published_at")
        .eq("market_slug", slug)
        .order("published_at", { ascending: false })
        .limit(6),
      supabaseAdmin
        .from("events")
        .select("id, slug, name, description, start_at, end_at, time_zone, capacity, visibility, market_slug")
        .eq("market_slug", slug)
        .eq("visibility", "public")
        .not("slug", "is", null)
        .gte("end_at", new Date().toISOString())
        .order("start_at", { ascending: true }),
    ]);

    const eventRows = (events ?? []) as Array<Record<string, any>>;
    const counts = new Map<string, number>();
    if (eventRows.length) {
      const { data: signups } = await supabaseAdmin
        .from("event_signups")
        .select("event_id, guest_count")
        .in("event_id", eventRows.map((e) => e.id))
        .neq("status", "cancelled");
      for (const s of signups ?? []) {
        if (!s.event_id) continue;
        counts.set(
          s.event_id,
          (counts.get(s.event_id) ?? 0) + 1 + Math.max(0, Number(s.guest_count ?? 0)),
        );
      }
    }

    return {
      slug,
      shortSlug: m.short_slug ?? null,
      city: m.city,
      region: m.region ?? null,
      country: m.country,
      status: m.status,
      heroCopy: m.hero_copy ?? null,
      intro: m.intro ?? null,
      lat: m.lat ?? null,
      lng: m.lng ?? null,
      manager: {
        name: m.manager_name ?? null,
        title: m.manager_title ?? null,
        bio: m.manager_bio ?? null,
        photoUrl: m.manager_photo_url ?? null,
      },
      merchants: (merchants ?? []) as MarketMerchant[],
      news: (news ?? []) as MarketNewsItem[],
      events: eventRows.map((e) => {
        const capacity = typeof e.capacity === "number" ? e.capacity : null;
        const taken = counts.get(e.id) ?? 0;
        return {
          slug: e.slug as string,
          name: e.name as string,
          description: e.description ?? null,
          start_at: e.start_at as string,
          end_at: e.end_at as string,
          time_zone: e.time_zone as string,
          capacity,
          spotsLeft: capacity == null ? null : Math.max(0, capacity - taken),
        };
      }),
    };
  });
