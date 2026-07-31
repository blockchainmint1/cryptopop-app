/**
 * Public (unauthenticated) chain reads for a non-custodial wallet address.
 * Only exposes data that is already public on the TXC explorer.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const MEMPOOL_BASE = "https://mempool.texitcoin.org/api";

const Input = z.object({ address: z.string().min(20).max(64).regex(/^[A-Za-z0-9]+$/) });

function getPropertyId(): number {
  const raw = process.env.TXC_TOKEN_ID ?? "37";
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : 37;
}

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const url = process.env.TXC_RPC_URL ?? process.env.TXC_RPC_ADDRESS;
  const user = process.env.TXC_RPC_USER;
  const pass = process.env.TXC_RPC_PASS;
  if (!url || !user || !pass) throw new Error("TXC RPC not configured");
  const fullUrl = url.startsWith("http") ? url : `https://${url}`;
  const auth = "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
  const res = await fetch(fullUrl, {
    method: "POST",
    headers: { "content-type": "text/plain", authorization: auth },
    body: JSON.stringify({ jsonrpc: "1.0", id: "cp", method, params }),
  });
  if (!res.ok) throw new Error(`rpc ${method} http ${res.status}`);
  const json = (await res.json()) as { result: T; error: { message: string } | null };
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

export type ChainSummary = { pop: number | null; txc: number | null };

/** POP (Omni token) + native TXC balance for any address. Public explorer data. */
export const getAddressChainSummary = createServerFn({ method: "POST" })
  .inputValidator((input) => Input.parse(input))
  .handler(async ({ data }): Promise<ChainSummary> => {
    const [pop, txc] = await Promise.all([
      (async () => {
        try {
          const result = await rpc<{ balance: string }>("omni_getbalance", [
            data.address,
            getPropertyId(),
          ]);
          const bal = Number(result?.balance ?? 0);
          return Number.isFinite(bal) ? bal : null;
        } catch (e) {
          console.error("[getAddressChainSummary] omni", e);
          return null;
        }
      })(),
      (async () => {
        try {
          const res = await fetch(`${MEMPOOL_BASE}/address/${data.address}`);
          if (!res.ok) return null;
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
          return sats / 1e8;
        } catch (e) {
          console.error("[getAddressChainSummary] txc", e);
          return null;
        }
      })(),
    ]);
    return { pop, txc };
  });
