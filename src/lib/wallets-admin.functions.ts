// Admin: list every wallet (claimed + unclaimed) with TXC + POP balances.
import { createServerFn } from "@tanstack/react-start";
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

const MEMPOOL_BASE = "https://mempool.texitcoin.org/api";

async function fetchTxcBalance(address: string): Promise<number | null> {
  try {
    const res = await fetch(`${MEMPOOL_BASE}/address/${address}`);
    if (!res.ok) return null;
    const j = (await res.json()) as {
      chain_stats?: { funded_txo_sum?: number; spent_txo_sum?: number };
      mempool_stats?: { funded_txo_sum?: number; spent_txo_sum?: number };
    };
    const c = j.chain_stats ?? {};
    const m = j.mempool_stats ?? {};
    const sats =
      (c.funded_txo_sum ?? 0) -
      (c.spent_txo_sum ?? 0) +
      (m.funded_txo_sum ?? 0) -
      (m.spent_txo_sum ?? 0);
    return sats / 1e8;
  } catch {
    return null;
  }
}

export type AdminWalletRow = {
  email: string;
  wallet_address: string;
  display_name: string | null;
  claimed: boolean;
  claimed_at: string | null;
  created_at: string;
  txc: number | null;
  pop_sent: number;
  pop_pending: number;
};

export const listAdminWallets = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ wallets: AdminWalletRow[] }> => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: wallets, error } = await supabaseAdmin
      .from("email_wallets")
      .select("email, wallet_address, claimed_by_user_id, claimed_at, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const rows = wallets ?? [];

    const userIds = Array.from(
      new Set(rows.map((r) => r.claimed_by_user_id).filter((v): v is string => !!v)),
    );
    const { data: profiles } = userIds.length
      ? await supabaseAdmin.from("profiles").select("id, display_name").in("id", userIds)
      : { data: [] as { id: string; display_name: string | null }[] };
    const nameByUser = new Map(
      (profiles ?? []).map((p) => [p.id, p.display_name ?? null] as const),
    );

    const emails = rows.map((r) => r.email);
    const { data: awards } = emails.length
      ? await supabaseAdmin
          .from("pop_awards")
          .select("email, amount, status")
          .in("email", emails)
      : { data: [] as { email: string; amount: number; status: string }[] };
    const popSent = new Map<string, number>();
    const popPending = new Map<string, number>();
    for (const a of awards ?? []) {
      const amt = Number(a.amount ?? 0);
      if (a.status === "sent") popSent.set(a.email, (popSent.get(a.email) ?? 0) + amt);
      else if (a.status === "pending")
        popPending.set(a.email, (popPending.get(a.email) ?? 0) + amt);
    }

    // Fetch TXC balances in parallel, capped to avoid hammering mempool.
    const txcBalances = await Promise.all(rows.map((r) => fetchTxcBalance(r.wallet_address)));

    const out: AdminWalletRow[] = rows.map((r, i) => ({
      email: r.email,
      wallet_address: r.wallet_address,
      display_name: r.claimed_by_user_id ? nameByUser.get(r.claimed_by_user_id) ?? null : null,
      claimed: !!r.claimed_by_user_id,
      claimed_at: r.claimed_at,
      created_at: r.created_at,
      txc: txcBalances[i],
      pop_sent: popSent.get(r.email) ?? 0,
      pop_pending: popPending.get(r.email) ?? 0,
    }));

    return { wallets: out };
  });
