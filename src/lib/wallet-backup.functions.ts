import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachSupabaseAuth } from "./auth-client-middleware";

// Retired: never derive, store, or return custodial private keys.
export const ensureWalletBackup = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async (): Promise<{ secret: string; address: string; source: "existing" | "reconciled" | "fresh" }> => {
    throw new Error("Email-managed wallets have been retired. Open your on-device wallet instead.");
  });
export const recoverWalletSeed = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async (): Promise<{ secret: string | null; address: string | null }> => {
    throw new Error("Server wallet key export has been permanently disabled.");
  });
