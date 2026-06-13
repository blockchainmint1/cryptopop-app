import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachSupabaseAuth } from "./auth-client-middleware";

const MEMPOOL_BASE = "https://mempool.texitcoin.org/api";

const Input = z.object({ address: z.string().min(20).max(64) });

/**
 * Returns the native TXC chain balance (in TXC, not satoshis) for an address.
 * Failures return `null` so the UI can render a dash without breaking.
 * Auth-gated to prevent the endpoint from being abused as a public proxy.
 */
export const getTxcBalance = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input) => Input.parse(input))
  .handler(async ({ data }): Promise<{ txc: number | null }> => {
    try {
      const res = await fetch(`${MEMPOOL_BASE}/address/${data.address}`);
      if (!res.ok) return { txc: null };
      const json = (await res.json()) as {
        chain_stats?: { funded_txo_sum?: number; spent_txo_sum?: number };
        mempool_stats?: { funded_txo_sum?: number; spent_txo_sum?: number };
      };
      const c = json.chain_stats ?? {};
      const m = json.mempool_stats ?? {};
      const sats =
        (c.funded_txo_sum ?? 0) -
        (c.spent_txo_sum ?? 0) +
        (m.funded_txo_sum ?? 0) -
        (m.spent_txo_sum ?? 0);
      return { txc: sats / 1e8 };
    } catch (e) {
      console.error("[getTxcBalance]", e);
      return { txc: null };
    }
  });

export type TxcTx = {
  txid: string;
  confirmed: boolean;
  block_time: number | null;
  /** net sats delta for the queried address (positive = received, negative = sent) */
  delta_sats: number;
};

/**
 * Returns recent on-chain transactions for an address, with the net delta
 * for that address pre-computed so the UI can render +/- without re-parsing vins/vouts.
 */
export const getTxcTxs = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input) => Input.parse(input))
  .handler(async ({ data }): Promise<{ txs: TxcTx[] }> => {
    try {
      const res = await fetch(`${MEMPOOL_BASE}/address/${data.address}/txs`);
      if (!res.ok) return { txs: [] };
      type Vin = { prevout?: { scriptpubkey_address?: string; value?: number } };
      type Vout = { scriptpubkey_address?: string; value?: number };
      type Tx = {
        txid: string;
        status?: { confirmed?: boolean; block_time?: number };
        vin?: Vin[];
        vout?: Vout[];
      };
      const list = (await res.json()) as Tx[];
      const addr = data.address;
      const txs: TxcTx[] = list.slice(0, 15).map((t) => {
        const sentSats = (t.vin ?? [])
          .filter((v) => v.prevout?.scriptpubkey_address === addr)
          .reduce((s, v) => s + (v.prevout?.value ?? 0), 0);
        const receivedSats = (t.vout ?? [])
          .filter((v) => v.scriptpubkey_address === addr)
          .reduce((s, v) => s + (v.value ?? 0), 0);
        return {
          txid: t.txid,
          confirmed: !!t.status?.confirmed,
          block_time: t.status?.block_time ?? null,
          delta_sats: receivedSats - sentSats,
        };
      });
      return { txs };
    } catch (e) {
      console.error("[getTxcTxs]", e);
      return { txs: [] };
    }
  });
