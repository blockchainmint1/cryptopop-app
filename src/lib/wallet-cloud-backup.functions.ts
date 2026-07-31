/**
 * Encrypted cloud backup for the non-custodial vault.
 *
 * The blob handed to these functions is ALREADY encrypted on the device with
 * the user's wallet password (PBKDF2 → AES-GCM). The server only ever stores
 * ciphertext keyed to the signed-in account — nobody here can read the phrase.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const blobSchema = z.object({
  v: z.literal(1),
  salt: z.string().min(8).max(256),
  iv: z.string().min(8).max(256),
  ct: z.string().min(8).max(8192),
  it: z.number().int().min(100_000).max(2_000_000),
});

const saveSchema = z.object({
  blob: blobSchema,
  origin: z.enum(["coin", "generated", "imported"]),
  deviceLabel: z.string().max(120).optional(),
});

export const saveWalletCloudBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => saveSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("wallet_vault_backups").upsert(
      {
        user_id: context.userId,
        blob: data.blob,
        origin: data.origin,
        device_label: data.deviceLabel ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const getWalletCloudBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("wallet_vault_backups")
      .select("blob, origin, updated_at, device_label")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return {
      blob: blobSchema.parse(data.blob),
      origin: data.origin as "coin" | "generated" | "imported",
      updatedAt: data.updated_at as string,
      deviceLabel: (data.device_label as string | null) ?? null,
    };
  });

export const deleteWalletCloudBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("wallet_vault_backups")
      .delete()
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
