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
