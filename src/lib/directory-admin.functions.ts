// Admin view of our copy of NectarPay's merchant directory: how fresh it is,
// how much of it a shopper can actually use, and a button to pull it now.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DirectoryStatus = {
  lastRunAt: string | null;
  lastOkAt: string | null;
  lastStatus: string;
  lastError: string | null;
  lastCount: number | null;
  lastRemoved: number | null;
  cursor: string | null;
  active: number;
  named: number;
  cityOnly: number;
  withPin: number;
  acceptsTsd: number;
};

async function assertAdmin(sb: { rpc: (n: string, a: Record<string, unknown>) => Promise<{ data: unknown }> }, userId: string) {
  const { data } = await sb.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

export const getDirectoryStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DirectoryStatus> => {
    const sb = context.supabase;
    await assertAdmin(sb, context.userId);

    const [state, active, named, cityOnly, withPin, acceptsTsd] = await Promise.all([
      sb.from("nectarpay_sync_state").select("*").eq("id", 1).single(),
      sb.from("nectarpay_stores").select("id", { count: "exact", head: true }).eq("is_active", true),
      sb.from("nectarpay_stores").select("id", { count: "exact", head: true }).eq("is_active", true).not("name", "is", null),
      sb.from("nectarpay_stores").select("id", { count: "exact", head: true }).eq("is_active", true).eq("listing", "city_only"),
      sb.from("nectarpay_stores").select("id", { count: "exact", head: true }).eq("is_active", true).not("lat", "is", null),
      sb.from("nectarpay_stores").select("id", { count: "exact", head: true }).eq("is_active", true).contains("accepts", ["TSD"]),
    ]);

    const first = [state, active, named, cityOnly, withPin, acceptsTsd].find((r) => r.error);
    if (first?.error) throw new Error(first.error.message);

    const s = state.data as Record<string, unknown> | null;
    const asText = (v: unknown) => (v == null ? null : String(v));
    const asNumber = (v: unknown) => (v == null ? null : Number(v));

    return {
      lastRunAt: asText(s?.last_run_at),
      lastOkAt: asText(s?.last_ok_at),
      lastStatus: asText(s?.last_status) ?? "never",
      lastError: asText(s?.last_error),
      lastCount: asNumber(s?.last_count),
      lastRemoved: asNumber(s?.last_removed),
      cursor: asText(s?.cursor),
      active: active.count ?? 0,
      named: named.count ?? 0,
      cityOnly: cityOnly.count ?? 0,
      withPin: withPin.count ?? 0,
      acceptsTsd: acceptsTsd.count ?? 0,
    };
  });

/** Pull NectarPay's feed right now instead of waiting for the hourly timer. */
export const syncDirectoryNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    await assertAdmin(sb, context.userId);
    const { runNectarpaySync } = await import("./nectarpay-sync.server");
    return runNectarpaySync({ force: true });
  });
