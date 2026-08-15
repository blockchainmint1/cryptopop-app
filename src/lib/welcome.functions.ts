import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** POP granted once, the first time someone finishes wallet setup. */
export const WELCOME_POP = 10;

const schema = z.object({
  address: z.string().trim().min(26).max(48),
  email: z.string().trim().email().max(254),
  market: z.string().trim().max(64).optional().nullable(),
});

export type WelcomeClaimResult = {
  awarded: boolean;
  amount: number;
  reason?: "duplicate" | "failed";
};

/**
 * Welcome grant for a brand-new non-custodial wallet.
 *
 * Identity anchor is the email the user optionally supplies at the end of
 * setup: the ledger row is unique on (source, source_id) = ('wallet_signup',
 * email), and we additionally refuse a second grant to the same wallet
 * address. POP is minted straight to the on-device wallet — we never hold it.
 */
export const claimWelcomePop = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data }): Promise<WelcomeClaimResult> => {
    const { validateTxcAddress, awardPop } = await import("./email-wallet.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let address: string;
    try {
      address = validateTxcAddress(data.address);
    } catch {
      throw new Error("invalid_wallet_address");
    }
    const email = data.email.toLowerCase();

    // One welcome grant per wallet address, too — stops one email from
    // seeding an endless stream of fresh phrases.
    const { data: prior } = await supabaseAdmin
      .from("pop_awards")
      .select("id")
      .eq("source", "wallet_signup")
      .eq("wallet_address", address)
      .limit(1);
    if (prior && prior.length > 0) {
      return { awarded: false, amount: 0, reason: "duplicate" };
    }

    const res = await awardPop({
      email,
      amount: WELCOME_POP,
      source: "wallet_signup",
      sourceId: email,
      memo: data.market ? `welcome ${data.market}` : "welcome",
      walletOverride: address,
    });

    if (res.status === "duplicate") return { awarded: false, amount: 0, reason: "duplicate" };
    if (res.status === "failed") return { awarded: false, amount: 0, reason: "failed" };
    return { awarded: true, amount: WELCOME_POP };
  });
