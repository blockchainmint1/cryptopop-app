/**
 * ACH onramp RPCs — "Add value" (buy TSD with a bank transfer).
 * Onramp services are provided by VectorPay LLC; bank linking uses Plaid.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Addr = z.string().min(20).max(64).regex(/^[A-Za-z0-9]+$/);

const LinkTokenInput = z.object({ address: Addr });

const FundInput = z.object({
  address: Addr,
  publicToken: z.string().min(10).max(500),
  accountId: z.string().min(1).max(200).nullable().optional(),
  amountUsd: z.number().positive().max(10_000),
});

export const getOnrampStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { readPlaidConfig } = await import("./onramp.server");
  const cfg = readPlaidConfig();
  return { ready: Boolean(cfg), env: cfg?.env ?? null, provider: "VectorPay LLC" };
});

export const createOnrampLinkToken = createServerFn({ method: "POST" })
  .inputValidator((input) => LinkTokenInput.parse(input))
  .handler(async ({ data }) => {
    const { readPlaidConfig, createPlaidLinkToken } = await import("./onramp.server");
    const cfg = readPlaidConfig();
    if (!cfg) throw new Error("Bank onramp isn't configured yet — check back shortly.");
    return createPlaidLinkToken(cfg, data.address);
  });

export const fundWithAch = createServerFn({ method: "POST" })
  .inputValidator((input) => FundInput.parse(input))
  .handler(async ({ data }) => {
    const { readPlaidConfig, exchangeAndDescribe, submitToVectorPay } = await import(
      "./onramp.server"
    );
    const cfg = readPlaidConfig();
    if (!cfg) throw new Error("Bank onramp isn't configured yet — check back shortly.");

    const amountUsd = Math.round(data.amountUsd * 100) / 100;
    const accountId = data.accountId ?? null;
    const link = await exchangeAndDescribe(cfg, data.publicToken, accountId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order, error } = await supabaseAdmin
      .from("onramp_orders")
      .insert({
        wallet_address: data.address,
        asset: "tsd",
        amount_usd: amountUsd,
        status: "pending",
        provider: "vectorpay",
        plaid_item_id: link.itemId,
        plaid_account_id: accountId,
        bank_name: link.bankName,
        account_mask: link.mask,
      })
      .select("id, reference")
      .single();
    if (error || !order) {
      console.error("[onramp] order insert failed", error);
      throw new Error("Could not record your order. Nothing was charged.");
    }

    const result = await submitToVectorPay({
      reference: order.reference,
      amountUsd,
      walletAddress: data.address,
      accessToken: link.accessToken,
      accountId,
    });

    await supabaseAdmin
      .from("onramp_orders")
      .update({ status: result.status, failure_reason: result.failureReason })
      .eq("id", order.id);

    return {
      reference: order.reference,
      status: result.status,
      amountUsd,
      bankName: link.bankName,
      mask: link.mask,
      failureReason: result.failureReason,
    };
  });
