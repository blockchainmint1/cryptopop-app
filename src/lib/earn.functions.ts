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

function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!user || !domain) return "anonymous";
  const head = user.slice(0, 2);
  return `${head}${"•".repeat(Math.max(1, user.length - 2))}@${domain}`;
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
      .select("email, amount, created_at")
      .eq("status", "sent");
    if (since) q = q.gte("created_at", since);
    const { data: rows } = await q.limit(5000);
    const totals = new Map<string, number>();
    for (const r of rows ?? []) {
      const k = (r.email ?? "").toLowerCase();
      if (!k) continue;
      totals.set(k, (totals.get(k) ?? 0) + Number(r.amount));
    }
    const leaders = [...totals.entries()]
      .map(([email, total]) => ({ display: maskEmail(email), total }))
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
    return {
      window: data.window,
      points: (rows ?? []).map((r) => ({ lat: r.lat, lng: r.lng, weight: r.pop_amount })),
    };
  });

export const getRecentActivity = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("pop_awards")
    .select("email, amount, source, created_at")
    .eq("status", "sent")
    .order("created_at", { ascending: false })
    .limit(20);
  return {
    activity: (data ?? []).map((r) => ({
      display: maskEmail(r.email ?? ""),
      amount: Number(r.amount),
      source: r.source,
      at: r.created_at,
    })),
  };
});
