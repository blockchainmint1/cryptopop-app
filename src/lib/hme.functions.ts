import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Exchanges an honest.money SSO ticket for a one-time sign-in token for this
 * app. The browser then calls verifyOtp({ token_hash, type: "magiclink" }).
 */
export const exchangeHmeTicket = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(10).max(4000) }).parse(d))
  .handler(async ({ data }) => {
    const { verifyHmeTicket, sendHubEvent } = await import("./hme.server");
    const ticket = await verifyHmeTicket(data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error: nonceErr } = await supabaseAdmin
      .from("hme_sso_nonces")
      .insert({ nonce: ticket.nonce, miner_id: ticket.minerId });
    if (nonceErr) throw new Error("ticket_already_used");

    const email = ticket.email.trim().toLowerCase();
    const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (error || !link?.properties?.hashed_token) throw new Error("sign_in_failed");

    await supabaseAdmin.auth.admin
      .updateUserById(link.user.id, { app_metadata: { hme_member_id: ticket.minerId } })
      .catch(() => undefined);

    void sendHubEvent({ event: "service_used", member_id: ticket.minerId, metadata: { action: "sso_login" } });

    return { tokenHash: link.properties.hashed_token, email, redirect: ticket.redirect ?? null };
  });
