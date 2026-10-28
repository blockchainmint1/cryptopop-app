import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { tsdLinkMessage } from "./tsd-link-message";

export { tsdLinkMessage };

/** One-time nonce from TSD Bridge that the wallet folds into its signed message. */
export const getTsdBridgeNonce = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { getTsdNonce } = await import("./tsd-partner.server");
    return getTsdNonce();
  });

export const linkTsdBridge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    address: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{25,40}$/),
    issuedAt: z.string().datetime(),
    nonce: z.string().regex(/^[A-Za-z0-9_-]{8,128}$/),
    signature: z.string().min(40).max(200),
    ssoTicket: z.string().min(20).max(4096),
    state: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const member = context.claims?.app_metadata?.["hme_member_id"];
    if (typeof member !== "string" || !member)
      return { status: "not_ready" as const, reason: "Sign in with Honest Money first." };
    const age = Date.now() - Date.parse(data.issuedAt);
    if (age < -60_000 || age > 5 * 60_000) return { status: "not_ready" as const, reason: "That approval expired. Try again." };
    const message = tsdLinkMessage(member, data.address, data.nonce, data.issuedAt);
    const { verifyTxcMessage } = await import("@/lib/wallet/txc-message");
    if (!verifyTxcMessage(data.address, message, data.signature))
      return { status: "not_ready" as const, reason: "Your wallet's approval didn't check out. Try again." };
    const { linkTsdAccount } = await import("./tsd-partner.server");
    return linkTsdAccount({ ssoTicket: data.ssoTicket, state: data.state, destination: data.address, message, signature: data.signature, nonce: data.nonce, issuedAt: data.issuedAt });
  });
