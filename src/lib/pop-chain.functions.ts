// On-chain POP (Omni token #35) balance lookup for a user's TXC wallet.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachSupabaseAuth } from "./auth-client-middleware";

const Input = z.object({ address: z.string().min(20).max(64) });

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

/**
 * Returns on-chain POP balance for the given address by querying Omni token #35.
 * Falls back to `null` on RPC failure so the UI can fall back to the mirror.
 */
export const getPopChainBalance = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input) => Input.parse(input))
  .handler(async ({ data }): Promise<{ balance: number | null }> => {
    try {
      const propertyId = getPropertyId();
      const result = await rpc<{ balance: string; reserved: string }>(
        "omni_getbalance",
        [data.address, propertyId],
      );
      const bal = Number(result?.balance ?? 0);
      return { balance: Number.isFinite(bal) ? bal : null };
    } catch (e) {
      console.error("[getPopChainBalance]", e);
      return { balance: null };
    }
  });
