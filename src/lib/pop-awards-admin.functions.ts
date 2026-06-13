// Admin: list POP award ledger and retry individual rows.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachSupabaseAuth } from "./auth-client-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { mintGrant } from "./txc.server";
import { awardPop } from "./email-wallet.server";

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("forbidden");
}

export const listPopAwards = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        status: z.enum(["all", "pending", "sent", "failed"]).default("all"),
        source: z.string().trim().max(64).optional(),
        q: z.string().trim().max(120).optional(),
        limit: z.number().int().min(1).max(500).default(200),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    let query = supabaseAdmin
      .from("pop_awards")
      .select(
        "id, email, wallet_address, amount, source, source_id, status, tx_hash, error, created_at, sent_at",
      )
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (data.status !== "all") query = query.eq("status", data.status);
    if (data.source) query = query.eq("source", data.source);
    if (data.q) {
      const like = `%${data.q.replace(/[%_]/g, "")}%`;
      query = query.or(
        `email.ilike.${like},wallet_address.ilike.${like},tx_hash.ilike.${like}`,
      );
    }
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    // Summary stats across all rows (not just the filtered page)
    const { data: stats } = await supabaseAdmin
      .from("pop_awards")
      .select("status, amount");
    const summary = (stats ?? []).reduce(
      (acc, r) => {
        const amt = Number(r.amount ?? 0);
        acc.total += 1;
        acc.totalPop += amt;
        if (r.status === "sent") {
          acc.sent += 1;
          acc.sentPop += amt;
        } else if (r.status === "pending") acc.pending += 1;
        else if (r.status === "failed") acc.failed += 1;
        return acc;
      },
      { total: 0, totalPop: 0, sent: 0, sentPop: 0, pending: 0, failed: 0 },
    );

    return { awards: rows ?? [], summary };
  });

export const retryPopAward = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("pop_awards")
      .select("id, wallet_address, amount, source, status")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Award not found");
    if (row.status === "sent") {
      return { ok: true, alreadySent: true };
    }
    try {
      const result = await mintGrant({
        amount: Number(row.amount),
        toAddress: row.wallet_address,
        memo: (row.source ?? "retry").slice(0, 60),
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
      return { ok: true, txHash: result.txHash };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await supabaseAdmin
        .from("pop_awards")
        .update({ status: "failed", error: msg.slice(0, 500) })
        .eq("id", row.id);
      throw new Error(msg);
    }
  });

// Admin: manually mint POP to either an email (uses the email's custodial
// wallet) or a raw TXC wallet address. Records a ledger entry tagged
// source='manual' so it shows up in the awards log.
export const manualAwardPop = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        recipient: z.string().trim().min(1).max(200),
        amount: z.number().int().min(1).max(1_000_000),
        memo: z.string().trim().max(60).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const sourceId = `${context.userId}:${Date.now()}`;
    const memo = (data.memo || "manual").slice(0, 60);
    const isEmail = data.recipient.includes("@");

    if (isEmail) {
      const res = await awardPop({
        email: data.recipient,
        amount: data.amount,
        source: "manual",
        sourceId,
        memo,
      });
      if (res.status === "failed") throw new Error("Mint failed — see ledger");
      return { ok: true, mode: "email" as const, status: res.status };
    }

    // Raw wallet address path — ledger row + direct mint, no email wallet.
    const addr = data.recipient;
    if (!/^[A-Za-z0-9]{20,80}$/.test(addr)) {
      throw new Error("Recipient must be an email or a wallet address");
    }
    const { data: row, error: insErr } = await supabaseAdmin
      .from("pop_awards")
      .insert({
        email: `manual+${sourceId}@cryptopop.local`,
        wallet_address: addr,
        amount: data.amount,
        source: "manual",
        source_id: sourceId,
        status: "pending",
      })
      .select("id")
      .single();
    if (insErr) throw new Error(insErr.message);
    try {
      const result = await mintGrant({ amount: data.amount, toAddress: addr, memo });
      await supabaseAdmin
        .from("pop_awards")
        .update({
          status: "sent",
          tx_hash: result.txHash,
          sent_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      return { ok: true, mode: "wallet" as const, status: "sent" as const, txHash: result.txHash };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await supabaseAdmin
        .from("pop_awards")
        .update({ status: "failed", error: msg.slice(0, 500) })
        .eq("id", row.id);
      throw new Error(msg);
    }
  });
