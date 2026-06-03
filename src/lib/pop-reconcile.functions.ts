// Admin-only reconciliation: retry POP awards that previously failed to broadcast.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachSupabaseAuth } from "./auth-client-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { mintGrant } from "./txc.server";

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("forbidden");
}

export const reconcileFailedPopAwards = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ limit: z.number().int().min(1).max(100).default(20) }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    const { data: rows, error } = await supabaseAdmin
      .from("pop_awards")
      .select("id, email, wallet_address, amount, source, error")
      .in("status", ["failed", "pending"])
      .order("created_at", { ascending: true })
      .limit(data.limit);
    if (error) throw new Error(error.message);

    const results: Array<{
      id: string;
      status: "sent" | "failed";
      txHash?: string;
      error?: string;
    }> = [];

    for (const row of rows ?? []) {
      try {
        const result = await mintGrant({
          amount: Number(row.amount),
          toAddress: row.wallet_address,
          memo: (row.source ?? "reconcile").slice(0, 60),
        });
        await supabaseAdmin
          .from("pop_awards")
          .update({
            status: "sent",
            tx_hash: result.txHash,
            error: null,
            sent_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        results.push({ id: row.id, status: "sent", txHash: result.txHash });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await supabaseAdmin
          .from("pop_awards")
          .update({ status: "failed", error: msg.slice(0, 500) })
          .eq("id", row.id);
        results.push({ id: row.id, status: "failed", error: msg });
        // Stop early on infra failure (RPC down, UTXO drained) — retrying
        // every row will just produce identical errors.
        if (/insufficient|no UTXOs|rpc /i.test(msg)) break;
      }
    }

    return {
      attempted: results.length,
      sent: results.filter((r) => r.status === "sent").length,
      failed: results.filter((r) => r.status === "failed").length,
      results,
    };
  });
