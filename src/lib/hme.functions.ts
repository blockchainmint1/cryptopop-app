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

    await supabaseAdmin.from("hme_sso_nonces").delete().lt("created_at", new Date(Date.now() - 86400_000).toISOString());
    const { error: nonceErr } = await supabaseAdmin
      .from("hme_sso_nonces")
      .insert({ nonce: ticket.nonce, miner_id: ticket.minerId });
    if (nonceErr) throw new Error("ticket_already_used");

    const { data: identity, error: identityError } = await supabaseAdmin.from("hme_member_identities")
      .select("user_id").eq("member_id", ticket.minerId).maybeSingle();
    if (identityError) throw new Error("sign_in_failed");
    let email = ticket.email.trim().toLowerCase();
    if (identity) {
      const { data: account, error: accountError } = await supabaseAdmin.auth.admin.getUserById(identity.user_id);
      if (accountError || !account.user?.email) throw new Error("sign_in_failed");
      // Identity is the stable HME member id, not a recycled/changed email.
      email = account.user.email;
    } else {
      // A verified HME email does not prove ownership of an existing local
      // account. New accounts may be created; existing ones must be signed in.
      const { error: createError } = await supabaseAdmin.auth.admin.createUser({ email, email_confirm: true,
        app_metadata: { hme_member_id: ticket.minerId } });
      if (createError) {
        const { getRequestHeader } = await import("@tanstack/react-start/server");
        const bearer = getRequestHeader("authorization");
        if (!bearer?.startsWith("Bearer ")) throw new Error("Sign in to your existing CryptoPOP account before linking Honest Money.");
        const { data: signedIn, error: signedInError } = await supabaseAdmin.auth.getUser(bearer.slice(7));
        if (signedInError || signedIn.user?.email?.toLowerCase() !== email.toLowerCase())
          throw new Error("Existing account ownership must be confirmed before linking Honest Money.");
      }
    }
    const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (error || !link?.properties?.hashed_token) throw new Error("sign_in_failed");
    if (identity && link.user.id !== identity.user_id) throw new Error("identity_conflict");
    const previousMember = link.user.app_metadata?.["hme_member_id"];
    if (previousMember && previousMember !== ticket.minerId) throw new Error("identity_conflict");
    if (!identity) {
      const { error: bindError } = await supabaseAdmin.from("hme_member_identities")
        .insert({ member_id: ticket.minerId, user_id: link.user.id });
      if (bindError) {
        const { data: existing } = await supabaseAdmin.from("hme_member_identities")
          .select("user_id").eq("member_id", ticket.minerId).maybeSingle();
        if (existing?.user_id !== link.user.id) throw new Error("identity_conflict");
      }
    }
    const { error: metadataError } = await supabaseAdmin.auth.admin.updateUserById(link.user.id,
      { app_metadata: { ...link.user.app_metadata, hme_member_id: ticket.minerId } });
    if (metadataError) throw new Error("sign_in_failed");

    void sendHubEvent({ event: "service_used", member_id: ticket.minerId, metadata: { action: "sso_login" } });

    return { tokenHash: link.properties.hashed_token, email, redirect: ticket.redirect ?? null };
  });
