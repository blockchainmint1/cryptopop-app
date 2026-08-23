import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const payloadSchema = z.object({
  reference: z.string().min(4).max(64),
  status: z.string().min(1).max(40),
  txid: z.string().max(200).optional().nullable(),
});

export const Route = createFileRoute("/api/public/vectorpay-status")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const { verifySignature } = await import("@/lib/handoff.server");
        const ok = await verifySignature(raw, request.headers.get("x-beekeeper-signature"));
        if (!ok) return new Response("Invalid signature", { status: 401 });

        let parsed;
        try {
          parsed = payloadSchema.parse(JSON.parse(raw));
        } catch {
          return new Response("Invalid payload", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin
          .from("onramp_orders")
          .update({ status: parsed.status, txid: parsed.txid ?? null })
          .eq("reference", parsed.reference);
        if (error) console.error("[handoff] status update failed", error);

        return new Response("ok");
      },
    },
  },
});
