/**
 * Public (unauthenticated) activity + rewards reads for a non-custodial wallet
 * address. Everything here is either already public on the TXC explorer or is
 * keyed to the address the caller already controls.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const MEMPOOL_BASE = "https://mempool.texitcoin.org/api";

const Input = z.object({
  address: z.string().min(20).max(64).regex(/^[A-Za-z0-9]+$/),
});

export type WalletTx = {
  txid: string;
  time: number | null;
  confirmed: boolean;
  direction: "in" | "out";
  txc: number;
};

export type WalletReward = {
  id: string;
  amount: number;
  source: string;
  status: string;
  tx_hash: string | null;
  created_at: string;
};

export type WalletRank = {
  rank: number | null;
  total: number | null;
  awarded: number | null;
};

type MempoolTx = {
  txid: string;
  status?: { confirmed?: boolean; block_time?: number };
  vin?: { prevout?: { scriptpubkey_address?: string; value?: number } }[];
  vout?: { scriptpubkey_address?: string; value?: number }[];
};

/** Recent native-chain transactions for an address (public explorer data). */
export const getAddressActivity = createServerFn({ method: "POST" })
  .inputValidator((input) => Input.parse(input))
  .handler(async ({ data }): Promise<{ txs: WalletTx[] }> => {
    try {
      const res = await fetch(`${MEMPOOL_BASE}/address/${data.address}/txs`);
      if (!res.ok) return { txs: [] };
      const json = (await res.json()) as MempoolTx[];
      const addr = data.address;
      const txs: WalletTx[] = (json ?? []).slice(0, 25).map((tx) => {
        const inSum = (tx.vin ?? [])
          .filter((v) => v.prevout?.scriptpubkey_address === addr)
          .reduce((a, v) => a + (v.prevout?.value ?? 0), 0);
        const outSum = (tx.vout ?? [])
          .filter((v) => v.scriptpubkey_address === addr)
          .reduce((a, v) => a + (v.value ?? 0), 0);
        const net = outSum - inSum;
        return {
          txid: tx.txid,
          time: tx.status?.block_time ?? null,
          confirmed: Boolean(tx.status?.confirmed),
          direction: net >= 0 ? "in" : "out",
          txc: Math.abs(net) / 1e8,
        };
      });
      return { txs };
    } catch (e) {
      console.error("[getAddressActivity]", e);
      return { txs: [] };
    }
  });

/** Reward history + POP leaderboard rank for an address. */
export const getAddressRewards = createServerFn({ method: "POST" })
  .inputValidator((input) => Input.parse(input))
  .handler(
    async ({ data }): Promise<{ rewards: WalletReward[]; rank: WalletRank }> => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const [rewardsRes, rankRes] = await Promise.all([
        supabaseAdmin
          .from("pop_awards")
          .select("id, amount, source, status, tx_hash, created_at")
          .ilike("wallet_address", data.address)
          .order("created_at", { ascending: false })
          .limit(50),
        supabaseAdmin.rpc("pop_address_rank", { _address: data.address }),
      ]);

      if (rewardsRes.error) console.error("[getAddressRewards] rewards", rewardsRes.error);
      if (rankRes.error) console.error("[getAddressRewards] rank", rankRes.error);

      const row = (rankRes.data as unknown as
        | { rank: number; total: number; balance: number }[]
        | null)?.[0];

      return {
        rewards: (rewardsRes.data ?? []) as WalletReward[],
        rank: {
          rank: row ? Number(row.rank) : null,
          total: row ? Number(row.total) : null,
          awarded: row ? Number(row.balance) : null,
        },
      };
    },
  );
