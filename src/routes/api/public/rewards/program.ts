// NectarPay → CryptoPOP: a merchant created/updated their rewards program.
// Signed with HMAC-SHA256 (hex) of the raw body using NECTARPAY_REWARDS_SECRET,
// sent in the `x-nectarpay-signature` header.
import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";

const Body = z.object({
  storeId: z.string().trim().min(1).max(80),
  storeName: z.string().trim().min(1).max(120),
  logoUrl: z.string().url().max(500).nullable().optional(),
  marketSlug: z.string().trim().max(40).nullable().optional(),
  ratePct: z.number().min(0).max(20),
  issueType: z.enum(["store", "community"]),
  enabled: z.boolean(),
  applyToCommunity: z.boolean().optional(),
});

export const Route = createFileRoute("/api/public/rewards/program")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["NECTARPAY_REWARDS_SECRET"];
        if (!secret) return new Response("Rewards not configured", { status: 503 });
        const body = await request.text();
        const sig = Buffer.from(request.headers.get("x-nectarpay-signature") ?? "");
        const exp = Buffer.from(createHmac("sha256", secret).update(body).digest("hex"));
        if (sig.length !== exp.length || !timingSafeEqual(sig, exp)) {
          return new Response("Invalid signature", { status: 401 });
        }
        const parsed = Body.safeParse(JSON.parse(body || "{}"));
        if (!parsed.success) return Response.json({ error: "invalid_body" }, { status: 400 });
        const b = parsed.data;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: existing } = await supabaseAdmin
          .from("reward_programs")
          .select("id, community_status")
          .eq("nectar_store_id", b.storeId)
          .maybeSingle();
        const status =
          b.applyToCommunity && (!existing || ["none", "declined"].includes(existing.community_status))
            ? "pending"
            : (existing?.community_status ?? "none");
        const row = {
          nectar_store_id: b.storeId,
          store_name: b.storeName,
          logo_url: b.logoUrl ?? null,
          market_slug: b.marketSlug ?? null,
          rate_bps: Math.round(b.ratePct * 100),
          issue_type: b.issueType,
          enabled: b.enabled,
          community_status: status,
        };
        const { data, error } = await supabaseAdmin
          .from("reward_programs")
          .upsert(row, { onConflict: "nectar_store_id" })
          .select("id, community_status, community_balance, community_credit_limit")
          .single();
        if (error) return Response.json({ error: "save_failed" }, { status: 500 });
        return Response.json({ ok: true, program: data });
      },
    },
  },
});
