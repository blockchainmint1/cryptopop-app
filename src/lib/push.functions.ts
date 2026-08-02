import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachSupabaseAuth } from "./auth-client-middleware";

const registerSchema = z.object({
  token: z.string().min(10).max(500),
  platform: z.enum(["ios", "android", "web"]),
  walletAddress: z.string().max(120).nullable().optional(),
  enabled: z.boolean().optional(),
});

/** Store/refresh this device's push token. Works signed-out (wallet-only users). */
export const registerPushDevice = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => registerSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("push_devices").upsert(
      {
        token: data.token,
        platform: data.platform,
        wallet_address: data.walletAddress ?? null,
        enabled: data.enabled ?? true,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "token" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setPushEnabled = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string(), enabled: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("push_devices")
      .update({ enabled: data.enabled })
      .eq("token", data.token);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

export const getPushOverview = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ count: total }, { count: active }, campaigns] = await Promise.all([
      supabaseAdmin.from("push_devices").select("id", { count: "exact", head: true }),
      supabaseAdmin
        .from("push_devices")
        .select("id", { count: "exact", head: true })
        .eq("enabled", true),
      supabaseAdmin
        .from("push_campaigns")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(25),
    ]);
    return {
      devices: total ?? 0,
      activeDevices: active ?? 0,
      campaigns: campaigns.data ?? [],
      configured: Boolean(process.env["FCM_SERVICE_ACCOUNT_JSON"]),
    };
  });

const sendSchema = z.object({
  title: z.string().min(1).max(80),
  body: z.string().min(1).max(240),
  url: z.string().max(300).optional().nullable(),
  audience: z.enum(["all", "ios", "android"]).default("all"),
});

export const sendPushCampaign = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((d: unknown) => sendSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendPush } = await import("./push.server");

    let query = supabaseAdmin.from("push_devices").select("token").eq("enabled", true);
    if (data.audience !== "all") query = query.eq("platform", data.audience);
    const { data: devices, error } = await query;
    if (error) throw new Error(error.message);
    const tokens = (devices ?? []).map((d) => d.token);

    const { data: campaign } = await supabaseAdmin
      .from("push_campaigns")
      .insert({
        title: data.title,
        body: data.body,
        url: data.url ?? null,
        audience: data.audience,
        status: "sending",
        created_by: context.userId,
      })
      .select("id")
      .single();

    const result = await sendPush(tokens, { title: data.title, body: data.body, url: data.url });

    if (result.invalidTokens.length) {
      await supabaseAdmin.from("push_devices").delete().in("token", result.invalidTokens);
    }
    if (campaign) {
      await supabaseAdmin
        .from("push_campaigns")
        .update({
          status: "sent",
          sent_count: result.sent,
          failed_count: result.failed,
          sent_at: new Date().toISOString(),
        })
        .eq("id", campaign.id);
    }

    return result;
  });
