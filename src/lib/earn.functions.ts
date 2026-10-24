import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const windowSchema = z.enum(["day", "week", "month", "quarter", "all"]);
const windowInput = z.object({ window: windowSchema.default("week") });

function sinceFor(w: z.infer<typeof windowSchema>): string | null {
  const now = Date.now();
  const day = 86400000;
  switch (w) {
    case "day": return new Date(now - day).toISOString();
    case "week": return new Date(now - 7 * day).toISOString();
    case "month": return new Date(now - 30 * day).toISOString();
    case "quarter": return new Date(now - 91 * day).toISOString();
    case "all": return null;
  }
}

export const getEarnActions = createServerFn({ method: "GET" }).handler(async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data } = await sb
    .from("reward_rules")
    .select("action_key, label, description, pop_amount, enabled")
    .eq("enabled", true)
    .order("pop_amount", { ascending: false });
  return { actions: data ?? [] };
});

export const getMerchants = createServerFn({ method: "GET" }).handler(async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data } = await sb
    .from("merchants")
    .select("id, market_slug, name, category, address, lat, lng, pop_per_visit, website, logo_url")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  return { merchants: data ?? [] };
});

export const getLeaderboard = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => windowInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = sinceFor(data.window);
    let q = supabaseAdmin
      .from("pop_awards")
      .select("wallet_address, amount, created_at")
      .eq("status", "sent");
    if (since) q = q.gte("created_at", since);
    const { data: rows } = await q.limit(5000);
    const totals = new Map<string, number>();
    for (const r of rows ?? []) {
      const k = r.wallet_address ?? "";
      if (!k) continue;
      totals.set(k, (totals.get(k) ?? 0) + Number(r.amount));
    }
    const leaders = [...totals.entries()]
      .map(([address, total]) => ({ display: `${address.slice(0, 6)}…${address.slice(-4)}`, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 25);
    return { window: data.window, leaders };
  });

export const getHeatmap = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => windowInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = sinceFor(data.window);
    let q = supabaseAdmin
      .from("qr_redemptions")
      .select("lat, lng, pop_amount, created_at")
      .not("lat", "is", null)
      .not("lng", "is", null);
    if (since) q = q.gte("created_at", since);
    const { data: rows } = await q.limit(5000);
    const cells = new Map<string, { lat: number; lng: number; weight: number; count: number }>();
    for (const r of rows ?? []) {
      if (r.lat === null || r.lng === null) continue;
      const lat = Math.round(r.lat * 100) / 100, lng = Math.round(r.lng * 100) / 100;
      const key = `${lat}:${lng}`, old = cells.get(key);
      cells.set(key, { lat, lng, weight: (old?.weight ?? 0) + Number(r.pop_amount), count: (old?.count ?? 0) + 1 });
    }
    return { window: data.window, points: [...cells.values()].filter((c) => c.count >= 3).map(({ count: _count, ...p }) => p) };
  });

export const getRecentActivity = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("pop_awards")
    .select("wallet_address, amount, source, created_at")
    .eq("status", "sent")
    .order("created_at", { ascending: false })
    .limit(20);
  return {
    activity: (data ?? []).map((r) => ({
      display: `${r.wallet_address.slice(0, 6)}…${r.wallet_address.slice(-4)}`,
      amount: Number(r.amount),
      source: r.source,
      at: r.created_at,
    })),
  };
});
