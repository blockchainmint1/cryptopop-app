import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachSupabaseAuth } from "./auth-client-middleware";

/**
 * In-app account deletion (required by both app stores).
 *
 * Deletes the signed-in user's cloud account, encrypted cloud backup, and push
 * devices. The on-device wallet is separate — removing the wallet from the
 * device is handled locally in wallet settings. On-chain history cannot be
 * deleted.
 */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = context.userId;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Best-effort cleanup of user-owned rows before removing the auth user.
    const tables = ["wallet_vault_backups", "push_devices", "user_roles"];
    for (const table of tables) {
      const { error } = await (supabaseAdmin as any).from(table).delete().eq("user_id", userId);
      if (error) console.error(`account delete: ${table}: ${error.message}`);
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message);

    return { ok: true };
  });
