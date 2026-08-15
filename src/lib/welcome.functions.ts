import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Default POP granted on wallet activation (hub is authoritative). */
export const WELCOME_POP = 10;

const schema = z.object({
  address: z.string().trim().min(26).max(48),
  email: z.string().trim().email().max(254).optional().nullable(),
  market: z.string().trim().max(64).optional().nullable(),
  client: z.string().trim().max(32).optional().nullable(),
});

export type WelcomeClaimResult = {
  awarded: boolean;
  amount: number;
  reason?: "duplicate" | "no_email" | "failed";
};

/**
 * Wallet activation.
 *
 * The hub (cryptopop.org) owns the welcome grant: it holds the minting keys,
 * picks the right token for the market (Philippines → phPOP, else POP),
 * dedupes by wallet address and email, and stores the activation for CRM.
 * We relay server-to-server so the partner key never reaches the browser.
 */
export const claimWelcomePop = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data }): Promise<WelcomeClaimResult> => {
    const { hubActivateWallet } = await import("./pop-hub-signup.server");
    const { validateTxcAddress } = await import("./email-wallet.server");

    let address: string;
    try {
      address = validateTxcAddress(data.address);
    } catch {
      throw new Error("invalid_wallet_address");
    }

    const email = data.email?.trim().toLowerCase() || null;

    try {
      const res = await hubActivateWallet({
        address,
        market_slug: data.market ?? null,
        email,
        client: data.client ?? "wallet-web",
      });
      if (res.welcome_pop > 0) return { awarded: true, amount: res.welcome_pop };
      if (!email) return { awarded: false, amount: 0, reason: "no_email" };
      return { awarded: false, amount: 0, reason: "duplicate" };
    } catch (e) {
      console.error("[claimWelcomePop]", e);
      return { awarded: false, amount: 0, reason: "failed" };
    }
  });
