import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachSupabaseAuth } from "./auth-client-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  decryptSeed,
  encryptSeed,
  type EncryptedBlob,
} from "./wallet-crypto.server";
import {
  deriveTxcAddressServer,
  isValidMnemonic,
  newMnemonic,
} from "./wallet-derive.server";

/**
 * Ensure the signed-in user has an encrypted seed backup on the server.
 *
 * Two modes:
 *  - Client passes its existing mnemonic (from localStorage) → we just back it up.
 *  - No mnemonic exists anywhere → server generates a fresh one, stores the
 *    backup, returns the mnemonic so the browser can persist it locally.
 *
 * Idempotent: if a backup already exists for this user, returns that one
 * (decrypted) instead of overwriting. This guarantees the local wallet and
 * the backup always match.
 */
export const ensureWalletBackup = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        clientMnemonic: z.string().min(1).max(512).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{ mnemonic: string; address: string; source: "existing" | "client" | "generated" }> => {
      const { userId } = context;

      const { data: existing, error: readErr } = await supabaseAdmin
        .from("wallet_backups")
        .select("ciphertext, iv, salt, version, wallet_address")
        .eq("user_id", userId)
        .maybeSingle();
      if (readErr) {
        console.error("[wallet-backup] read failed", readErr);
        throw new Error("Wallet backup unavailable. Please try again.");
      }

      if (existing) {
        const mnemonic = decryptSeed({
          ciphertext: existing.ciphertext,
          iv: existing.iv,
          salt: existing.salt,
          version: existing.version,
        } as EncryptedBlob);
        return {
          mnemonic,
          address: existing.wallet_address,
          source: "existing",
        };
      }

      let mnemonic: string;
      let source: "client" | "generated";
      if (data.clientMnemonic && isValidMnemonic(data.clientMnemonic)) {
        mnemonic = data.clientMnemonic;
        source = "client";
      } else {
        mnemonic = newMnemonic();
        source = "generated";
      }

      const address = deriveTxcAddressServer(mnemonic);
      const blob = encryptSeed(mnemonic);

      const { error: upErr } = await supabaseAdmin
        .from("wallet_backups")
        .insert({
          user_id: userId,
          wallet_address: address,
          ciphertext: blob.ciphertext,
          iv: blob.iv,
          salt: blob.salt,
          version: blob.version,
        });
      if (upErr) throw new Error(`backup write failed: ${upErr.message}`);

      // Mirror to profiles so the rest of the app keeps working unchanged.
      await supabaseAdmin
        .from("profiles")
        .upsert(
          { id: userId, wallet_address: address, updated_at: new Date().toISOString() },
          { onConflict: "id" },
        );

      return { mnemonic, address, source };
    },
  );

/**
 * Returns the seed phrase for the signed-in user. Used by the recover-wallet
 * page when someone shows up on a new device (or after clearing storage).
 */
export const recoverWalletSeed = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(
    async ({ context }): Promise<{ mnemonic: string | null; address: string | null }> => {
      const { userId } = context;
      const { data, error } = await supabaseAdmin
        .from("wallet_backups")
        .select("ciphertext, iv, salt, version, wallet_address")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw new Error(`recover failed: ${error.message}`);
      if (!data) return { mnemonic: null, address: null };
      const mnemonic = decryptSeed({
        ciphertext: data.ciphertext,
        iv: data.iv,
        salt: data.salt,
        version: data.version,
      } as EncryptedBlob);
      return { mnemonic, address: data.wallet_address };
    },
  );
