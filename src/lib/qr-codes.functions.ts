// QR code admin + public scan/redemption server functions.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachSupabaseAuth } from "./auth-client-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
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

const ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
function randomToken(len = 22): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const createSchema = z
  .object({
    label: z.string().trim().min(1).max(120),
    pop_reward: z.number().int().min(1).max(1_000_000),
    event_id: z.string().uuid().nullable().optional(),
    geofence: z
      .object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        radius_m: z.number().int().min(10).max(50_000),
      })
      .nullable()
      .optional(),
    expires_at: z.string().datetime(),
    single_use: z.boolean().default(false),
  })
  .refine((d) => new Date(d.expires_at).getTime() > Date.now(), {
    message: "expires_at must be in the future",
    path: ["expires_at"],
  });

export const createQrCode = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input) => createSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const token = randomToken(22);
    const row = {
      token,
      label: data.label,
      pop_reward: data.pop_reward,
      event_id: data.event_id ?? null,
      lat: data.geofence?.lat ?? null,
      lng: data.geofence?.lng ?? null,
      radius_m: data.geofence?.radius_m ?? null,
      expires_at: data.expires_at,
      single_use: data.single_use,
      created_by: context.userId,
    };
    const { data: inserted, error } = await supabaseAdmin
      .from("qr_codes")
      .insert(row)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { code: inserted };
  });

export const listQrCodes = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        status: z.enum(["all", "active", "inactive", "expired"]).default("all"),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    let query = supabaseAdmin
      .from("qr_codes")
      .select(
        "id, token, label, pop_reward, event_id, lat, lng, radius_m, expires_at, single_use, use_count, active, created_at, events(name)",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.status === "active") {
      query = query.eq("active", true).gt("expires_at", new Date().toISOString());
    } else if (data.status === "inactive") {
      query = query.eq("active", false);
    } else if (data.status === "expired") {
      query = query.lte("expires_at", new Date().toISOString());
    }
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return { codes: rows ?? [] };
  });

export const updateQrCode = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        active: z.boolean().optional(),
        expires_at: z.string().datetime().optional(),
        label: z.string().trim().min(1).max(120).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { id, ...patch } = data;
    const { error } = await supabaseAdmin.from("qr_codes").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteQrCode = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("qr_codes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// PUBLIC: look up a QR code by token. Returns only safe info for rendering
// the claim page (no token, no created_by, no internal counts beyond display).
export const lookupQrCode = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ token: z.string().trim().min(8).max(64) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("qr_codes")
      .select(
        "id, label, pop_reward, lat, lng, radius_m, expires_at, single_use, use_count, active, events(name)",
      )
      .eq("token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return { found: false as const };
    const now = Date.now();
    const expired = new Date(row.expires_at).getTime() <= now;
    const exhausted = row.single_use && row.use_count >= 1;
    return {
      found: true as const,
      label: row.label,
      popReward: row.pop_reward,
      requiresLocation: row.lat !== null && row.lng !== null,
      radiusM: row.radius_m,
      eventName: (row.events as { name: string } | null)?.name ?? null,
      expiresAt: row.expires_at,
      expired,
      disabled: !row.active,
      exhausted,
      singleUse: row.single_use,
    };
  });

export const redeemQrCode = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        token: z.string().trim().min(8).max(64),
        lat: z.number().min(-90).max(90).optional(),
        lng: z.number().min(-180).max(180).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    // Load code
    const { data: code, error: codeErr } = await supabaseAdmin
      .from("qr_codes")
      .select(
        "id, label, pop_reward, lat, lng, radius_m, expires_at, single_use, use_count, active",
      )
      .eq("token", data.token)
      .maybeSingle();
    if (codeErr) throw new Error(codeErr.message);
    if (!code) throw new Error("Code not found");
    if (!code.active) throw new Error("This code has been disabled");
    if (new Date(code.expires_at).getTime() <= Date.now())
      throw new Error("This code has expired");
    if (code.single_use && code.use_count >= 1)
      throw new Error("This code has already been claimed");

    // Geofence check
    if (code.lat !== null && code.lng !== null) {
      if (data.lat === undefined || data.lng === undefined) {
        throw new Error("Location required to claim this code");
      }
      const dist = haversineMeters(code.lat, code.lng, data.lat, data.lng);
      if (dist > (code.radius_m ?? 200)) {
        throw new Error(
          `You're ${Math.round(dist)}m away — must be within ${code.radius_m}m of the location`,
        );
      }
    }

    // Per-user dedupe: try insert redemption first.
    const { data: redemption, error: redErr } = await supabaseAdmin
      .from("qr_redemptions")
      .insert({
        code_id: code.id,
        user_id: context.userId,
        pop_amount: code.pop_reward,
        status: "pending",
        lat: data.lat ?? null,
        lng: data.lng ?? null,
      })
      .select("id")
      .single();
    if (redErr) {
      if (redErr.code === "23505") {
        throw new Error("You've already claimed this code");
      }
      throw new Error(redErr.message);
    }

    // Look up email for awardPop
    const { data: userRow } = await supabaseAdmin.auth.admin.getUserById(
      context.userId,
    );
    const email = userRow?.user?.email;
    if (!email) {
      await supabaseAdmin
        .from("qr_redemptions")
        .update({ status: "failed" })
        .eq("id", redemption.id);
      throw new Error("No email on account");
    }

    // Mint POP
    const award = await awardPop({
      email,
      amount: code.pop_reward,
      source: "qr_code",
      sourceId: `${code.id}:${context.userId}`,
      memo: `QR: ${code.label}`.slice(0, 60),
    });

    // Bump use_count and finalize redemption
    await supabaseAdmin
      .from("qr_codes")
      .update({ use_count: code.use_count + 1 })
      .eq("id", code.id);
    await supabaseAdmin
      .from("qr_redemptions")
      .update({ status: award.status })
      .eq("id", redemption.id);

    if (award.status === "failed") {
      throw new Error("Mint failed — please try again later");
    }
    return {
      ok: true,
      popReward: code.pop_reward,
      label: code.label,
      status: award.status,
    };
  });
