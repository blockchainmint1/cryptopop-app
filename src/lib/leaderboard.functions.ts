import { createServerFn } from "@tanstack/react-start";

export type LeaderRow = {
  address: string;
  display: string;
  total: number;
};

function maskAddress(a: string): string {
  if (a.length <= 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

/** Public POP scoreboard: top wallets by POP awarded. */
export const getPopLeaderboard = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ leaders: LeaderRow[] }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("pop_awards")
      .select("wallet_address, amount, status")
      .in("status", ["sent", "pending"])
      .not("wallet_address", "is", null)
      .limit(5000);

    if (error) {
      console.error("[getPopLeaderboard]", error);
      return { leaders: [] };
    }

    const totals = new Map<string, number>();
    for (const r of data ?? []) {
      const key = String(r.wallet_address);
      totals.set(key, (totals.get(key) ?? 0) + Number(r.amount ?? 0));
    }

    const leaders = [...totals.entries()]
      .map(([address, total]) => ({ address, display: maskAddress(address), total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 50);

    return { leaders };
  },
);
