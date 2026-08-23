/** Top up / cash out RPCs — thin wrappers around the VectorPay relay. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const startSchema = z.object({
  side: z.enum(["buy", "sell"]),
  usd: z.number().min(25).max(1000),
  asset: z.string().min(1).max(12),
  chain: z.string().min(1).max(16),
  assetAmount: z.string().max(32).optional(),
  address: z.string().max(120).nullable().optional(),
  name: z.string().min(2).max(120),
  email: z.string().email().max(200),
  acceptedDisclaimers: z.array(z.string().max(64)).max(32),
  origin: z.string().max(200).optional(),
});

export const getHandoffStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { handoffConfigured } = await import("./handoff.server");
  return { ready: handoffConfigured(), provider: "VectorPay" };
});

export const startHandoffOrder = createServerFn({ method: "POST" })
  .inputValidator((input) => startSchema.parse(input))
  .handler(async ({ data }) => {
    const { postOrder, cashoutDepositAddress, handoffConfigured } = await import("./handoff.server");
    const feeUsd = Math.round(data.usd * 0.01 * 100) / 100;
    const orderId = `CP-${Date.now().toString(36).toUpperCase()}-${Math.random()
      .toString(36)
      .slice(2, 6)
      .toUpperCase()}`;

    if (!handoffConfigured()) {
      return {
        orderId,
        feeUsd,
        registered: false,
        handoffUrl: null,
        detail: "Top up isn't switched on yet — check back shortly.",
      };
    }

    const destination =
      data.side === "sell"
        ? (cashoutDepositAddress(data.chain) ?? data.address ?? null)
        : (data.address ?? null);
    if (data.side === "sell" && !destination) {
      return {
        orderId,
        feeUsd,
        registered: false,
        handoffUrl: null,
        detail: `No deposit address configured for ${data.chain}.`,
      };
    }

    const assetAmount = data.assetAmount ?? data.usd.toFixed(2);
    const chargedUsd =
      data.side === "buy"
        ? Math.round((data.usd + feeUsd) * 100) / 100
        : Math.round(data.usd * 100) / 100;

    const origin = data.origin?.replace(/\/$/, "");
    const returnUrl = origin ? `${origin}/wallet/order/${orderId}` : undefined;

    const relay = await postOrder({
      side: data.side,
      reference: orderId,
      account_ref: data.email.toLowerCase(),
      customer_name: data.name,
      customer_email: data.email,
      asset: data.asset,
      chain: data.chain,
      ...(destination ? { destination_address: destination } : {}),
      usd_amount: chargedUsd.toFixed(2),
      asset_amount: assetAmount,
      ...(returnUrl ? { return_url: returnUrl, cancel_url: returnUrl } : {}),
      rate: "1",
      fee_bps: 100,
      fee_usd: feeUsd.toFixed(2),
      accepted_disclaimers: data.acceptedDisclaimers,
    });

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("onramp_orders").insert({
        wallet_address: destination ?? "",
        asset: data.asset.toLowerCase(),
        amount_usd: chargedUsd,
        status: relay.ok ? "submitted" : "failed",
        provider: "vectorpay",
        reference: orderId,
        failure_reason: relay.detail,
      });
    } catch (e) {
      console.error("[handoff] order record failed", e);
    }

    return {
      orderId,
      feeUsd,
      registered: relay.ok,
      detail: relay.detail,
      handoffUrl: relay.checkoutUrl,
    };
  });
