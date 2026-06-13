// Admin: list, create, and stat events
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachSupabaseAuth } from "./auth-client-middleware";

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("forbidden");
}

export type AdminEventRow = {
  id: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  lat: number;
  lng: number;
  radius_m: number;
  start_at: string;
  end_at: string;
  base_reward: number;
  referral_reward: number;
  created_at: string;
  signup_count: number;
  claim_count: number;
};

export const listAdminEvents = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: events, error } = await supabaseAdmin
      .from("events")
      .select(
        "id, name, description, cover_url, lat, lng, radius_m, start_at, end_at, base_reward, referral_reward, created_at",
      )
      // Hide legacy seed/test rows — those live under POP Awards now.
      .not("name", "ilike", "CryptoPOP Test Drop%")
      .order("start_at", { ascending: false });
    if (error) throw new Error(error.message);

    const ids = (events ?? []).map((e) => e.id);
    const [signupsRes, claimsRes] = await Promise.all([
      ids.length
        ? supabaseAdmin.from("event_signups").select("event_id").in("event_id", ids)
        : Promise.resolve({ data: [] as { event_id: string | null }[], error: null }),
      ids.length
        ? supabaseAdmin.from("claims").select("event_id").in("event_id", ids)
        : Promise.resolve({ data: [] as { event_id: string }[], error: null }),
    ]);

    const signupCounts = new Map<string, number>();
    for (const r of (signupsRes.data ?? []) as { event_id: string | null }[]) {
      if (!r.event_id) continue;
      signupCounts.set(r.event_id, (signupCounts.get(r.event_id) ?? 0) + 1);
    }
    const claimCounts = new Map<string, number>();
    for (const r of (claimsRes.data ?? []) as { event_id: string }[]) {
      claimCounts.set(r.event_id, (claimCounts.get(r.event_id) ?? 0) + 1);
    }

    const rows: AdminEventRow[] = (events ?? []).map((e) => ({
      ...e,
      signup_count: signupCounts.get(e.id) ?? 0,
      claim_count: claimCounts.get(e.id) ?? 0,
    }));
    return { events: rows };
  });

const CreateInput = z.object({
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000).optional().nullable(),
  cover_url: z.string().trim().url().max(500).optional().nullable(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radius_m: z.number().int().min(20).max(20000),
  start_at: z.string().min(1),
  end_at: z.string().min(1),
  base_reward: z.number().min(0).max(100000),
  referral_reward: z.number().min(0).max(100000),
});

export const createAdminEvent = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input) => CreateInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("events")
      .insert({
        name: data.name,
        description: data.description ?? null,
        cover_url: data.cover_url ?? null,
        lat: data.lat,
        lng: data.lng,
        radius_m: data.radius_m,
        start_at: data.start_at,
        end_at: data.end_at,
        base_reward: data.base_reward,
        referral_reward: data.referral_reward,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const getAdminStats = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const now = new Date().toISOString();
    const [events, upcoming, signups, claims, popSent, popPending] = await Promise.all([
      supabaseAdmin.from("events").select("id", { count: "exact", head: true }),
      supabaseAdmin
        .from("events")
        .select("id", { count: "exact", head: true })
        .gte("end_at", now),
      supabaseAdmin.from("event_signups").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("claims").select("id", { count: "exact", head: true }),
      supabaseAdmin
        .from("pop_awards")
        .select("amount", { head: false })
        .eq("status", "sent"),
      supabaseAdmin
        .from("pop_awards")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
    ]);

    const popSentTotal = ((popSent.data ?? []) as { amount: number }[]).reduce(
      (sum, r) => sum + Number(r.amount ?? 0),
      0,
    );

    return {
      eventsTotal: events.count ?? 0,
      eventsUpcoming: upcoming.count ?? 0,
      signupsTotal: signups.count ?? 0,
      claimsTotal: claims.count ?? 0,
      popSentTotal,
      popPending: popPending.count ?? 0,
    };
  });
