import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Message the wallet signs on-device to prove it owns the TSD destination. */
export function tsdLinkMessage(memberId: string, address: string, issuedAt: string) {
  return `CryptoPOP: link TSD Bridge account\nMember: ${memberId}\nDestination: ${address}\nIssued: ${issuedAt}`;
}

export const linkTsdBridge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    address: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{25,40}$/),
    issuedAt: z.string().datetime(),
    signature: z.string().min(40).max(200),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const member = context.claims?.app_metadata?.["hme_member_id"];
    const email = context.claims?.email;
    if (typeof member !== "string" || !member || typeof email !== "string")
      return { status: "not_ready" as const, reason: "Sign in with Honest Money first." };
    const age = Date.now() - Date.parse(data.issuedAt);
    if (age < -60_000 || age > 5 * 60_000) return { status: "not_ready" as const, reason: "That approval expired. Try again." };
    const message = tsdLinkMessage(member, data.address, data.issuedAt);
    const { verifyTxcMessage } = await import("@/lib/wallet/txc-message");
    if (!verifyTxcMessage(data.address, message, data.signature))
      return { status: "not_ready" as const, reason: "Your wallet's approval didn't check out. Try again." };
    const { linkTsdAccount } = await import("./tsd-partner.server");
    return linkTsdAccount({ memberId: member, email, destination: data.address, message, signature: data.signature });
  });
