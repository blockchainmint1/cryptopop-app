import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const requestSchema = z.object({
  city: z.string().trim().min(2).max(80),
  region: z.string().trim().max(80).optional().nullable(),
  country: z.string().trim().max(80).optional().nullable(),
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  why: z.string().trim().max(2000).optional().nullable(),
});

export const getMarkets = createServerFn({ method: "GET" }).handler(async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await sb
    .from("pop_markets")
    .select("slug, city, region, country, status, hero_copy, sort_order, launched_at, lat, lng")
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return { markets: data ?? [] };
});

export const requestMarket = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => requestSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("market_requests").insert({
      city: data.city,
      region: data.region ?? null,
      country: data.country ?? null,
      name: data.name,
      email: data.email.toLowerCase(),
      why: data.why ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
