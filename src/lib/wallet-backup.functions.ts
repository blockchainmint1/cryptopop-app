import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachSupabaseAuth } from "./auth-client-middleware";

/**
 * One email = one wallet. The user's wallet is the deterministically-derived
 * email_wallet (WALLET_MASTER_SEED + sha256(email)). This server fn:
 *   1. Ensures the email_wallet row exists
 *   2. Claims it for the signed-in user (idempotent)
 *   3. Derives the WIF private key for that address
 *   4. Stores it encrypted in wallet_backups (overwriting any stale entry
 *      from the old random-mnemonic flow)
 *   5. Mirrors the address onto profiles
 *   6. Returns { address, secret } where secret is the WIF
 *
 * Custodial: the master seed lives server-side, so the server can re-derive
 * the same key any time. The user can export the WIF to take self-custody.
 */
export const ensureWalletBackup = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(
    async ({
      context,
    }): Promise<{ secret: string; address: string; source: "existing" | "reconciled" | "fresh" }> => {
      const { userId, claims } = context;
      const email = (claims?.email as string | undefined)?.toLowerCase();
      if (!email) throw new Error("No email on session");

      const [{ supabaseAdmin }, emailWallet, walletCrypto] = await Promise.all([
        import("@/integrations/supabase/client.server"),
        import("./email-wallet.server"),
        import("./wallet-crypto.server"),
      ]);

      // 1+3. Derive the canonical wallet for this email
      const { address, wif } = emailWallet.deriveWalletForEmail(email);

      // 2. Ensure the email_wallets row exists & is claimed by this user
      await emailWallet.ensureEmailWallet(email);
      await supabaseAdmin
        .from("email_wallets")
        .update({ claimed_by_user_id: userId, claimed_at: new Date().toISOString() })
        .eq("email", email)
        .is("claimed_by_user_id", null);

      // 4. Read existing backup (if any). If it matches the canonical address,
      // leave it alone. Otherwise, overwrite — the old random-mnemonic
      // wallet is decommissioned. (POP earned on the old address is
      // orphaned until swept; tracked separately.)
      const { data: existing } = await supabaseAdmin
        .from("wallet_backups")
        .select("wallet_address")
        .eq("user_id", userId)
        .maybeSingle();

      let source: "existing" | "reconciled" | "fresh";
      if (existing?.wallet_address === address) {
        source = "existing";
      } else {
        const blob = walletCrypto.encryptSeed(wif);
        const { error: upErr } = await supabaseAdmin
          .from("wallet_backups")
          .upsert(
            {
              user_id: userId,
              wallet_address: address,
              ciphertext: blob.ciphertext,
              iv: blob.iv,
              salt: blob.salt,
              version: blob.version,
            },
            { onConflict: "user_id" },
          );
        if (upErr) {
          console.error("[wallet-backup] write failed", upErr);
          throw new Error("Could not save wallet backup. Please try again.");
        }
        source = existing ? "reconciled" : "fresh";
      }

      // 5. Mirror to profiles so the rest of the app keeps working
      await supabaseAdmin
        .from("profiles")
        .upsert(
          { id: userId, wallet_address: address, updated_at: new Date().toISOString() },
          { onConflict: "id" },
        );

      return { secret: wif, address, source };
    },
  );

/**
 * Returns the WIF private key for the signed-in user's wallet.
 * Used by the recover-wallet page.
 */
export const recoverWalletSeed = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(
    async ({ context }): Promise<{ secret: string | null; address: string | null }> => {
      const email = (context.claims?.email as string | undefined)?.toLowerCase();
      if (!email) return { secret: null, address: null };
      const { deriveWalletForEmail } = await import("./email-wallet.server");
      const { address, wif } = deriveWalletForEmail(email);
      return { secret: wif, address };
    },
  );
