// Token-mint wizard server functions. Owner-only.
//   - getMyActiveOrg: which org does this user own / manage?
//   - createOrgMinterWallet: generate the org's TXC minter keypair (idempotent)
//   - getMinterFundingStatus: poll mempool for TXC balance on the minter addr
//   - issueOrgPopToken: broadcast the Omni issuance, poll for property id

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachSupabaseAuth } from "./auth-client-middleware";

// Funding floor — covers one issuance (~1500 sats) plus headroom for a
// handful of mints. UI tells the org to send at least this much TXC.
const MIN_FUNDING_SATS = 20_000;

export const getMyActiveOrg = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Pick the most recently joined org where the caller is an owner/admin.
    const { data: memberships, error } = await supabaseAdmin
      .from("organization_members")
      .select(
        "org_id, role, created_at, organizations:org_id ( id, slug, name, tagline, logo_url, accent_color, pop_token_name, pop_token_symbol, txc_property_id, minter_wallet_address, is_featured, status )",
      )
      .eq("user_id", context.userId)
      .in("role", ["owner", "admin"])
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) throw new Error(error.message);
    const row = memberships?.[0];
    if (!row) return { org: null };
    const org = row.organizations as unknown as {
      id: string;
      slug: string;
      name: string;
      tagline: string | null;
      logo_url: string | null;
      accent_color: string | null;
      pop_token_name: string | null;
      pop_token_symbol: string | null;
      txc_property_id: number | null;
      minter_wallet_address: string | null;
      is_featured: boolean;
      status: string;
    } | null;
    if (!org) return { org: null };
    return {
      org: {
        ...org,
        role: row.role as "owner" | "admin",
        mintComplete: org.txc_property_id !== null,
        hasMinterWallet: org.minter_wallet_address !== null,
      },
    };
  });

async function assertOwner(userId: string, orgId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("organization_members")
    .select("role")
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .eq("role", "owner")
    .maybeSingle();
  if (!data) throw new Error("forbidden");
}

export const createOrgMinterWallet = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input) => z.object({ orgId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertOwner(context.userId, data.orgId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: org, error: orgErr } = await supabaseAdmin
      .from("organizations")
      .select("id, minter_wallet_address, txc_property_id")
      .eq("id", data.orgId)
      .maybeSingle();
    if (orgErr) throw new Error(orgErr.message);
    if (!org) throw new Error("org_not_found");
    if (org.txc_property_id) {
      throw new Error("already_minted");
    }

    // Idempotent: if address already set + secret already stored, return.
    if (org.minter_wallet_address) {
      const { data: existing } = await supabaseAdmin
        .from("organization_wallet_secrets")
        .select("org_id")
        .eq("org_id", data.orgId)
        .maybeSingle();
      if (existing) {
        return { address: org.minter_wallet_address, created: false };
      }
    }

    const { generateMinterKeypair } = await import("./txc.server");
    const { writeEncryptedWif } = await import("./org-minter.server");
    const { address, wif } = generateMinterKeypair();
    await writeEncryptedWif(data.orgId, wif);
    const { error: upErr } = await supabaseAdmin
      .from("organizations")
      .update({ minter_wallet_address: address })
      .eq("id", data.orgId);
    if (upErr) throw new Error(upErr.message);
    return { address, created: true };
  });

export const getMinterFundingStatus = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input) => z.object({ orgId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertOwner(context.userId, data.orgId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("minter_wallet_address, txc_property_id")
      .eq("id", data.orgId)
      .maybeSingle();
    if (!org?.minter_wallet_address) {
      return {
        address: null,
        confirmedSats: 0,
        unconfirmedSats: 0,
        requiredSats: MIN_FUNDING_SATS,
        ready: false,
        alreadyMinted: org?.txc_property_id !== null && org?.txc_property_id !== undefined,
      };
    }
    const { getAddressBalanceSats } = await import("./txc.server");
    try {
      const bal = await getAddressBalanceSats(org.minter_wallet_address);
      return {
        address: org.minter_wallet_address,
        confirmedSats: bal.confirmed,
        unconfirmedSats: bal.unconfirmed,
        requiredSats: MIN_FUNDING_SATS,
        ready: bal.confirmed >= MIN_FUNDING_SATS,
        alreadyMinted: org.txc_property_id !== null,
      };
    } catch (e) {
      console.error("[getMinterFundingStatus]", e);
      return {
        address: org.minter_wallet_address,
        confirmedSats: 0,
        unconfirmedSats: 0,
        requiredSats: MIN_FUNDING_SATS,
        ready: false,
        alreadyMinted: org.txc_property_id !== null,
        error: e instanceof Error ? e.message : "balance lookup failed",
      };
    }
  });

const IssueInput = z.object({
  orgId: z.string().uuid(),
  tokenName: z.string().trim().min(2).max(40),
  tokenSymbol: z
    .string()
    .trim()
    .min(2)
    .max(8)
    .regex(/^[A-Z0-9]+$/, "Symbol must be uppercase letters/numbers"),
});

export const issueOrgPopToken = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input) => IssueInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertOwner(context.userId, data.orgId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: org, error: orgErr } = await supabaseAdmin
      .from("organizations")
      .select("id, slug, txc_property_id, minter_wallet_address")
      .eq("id", data.orgId)
      .maybeSingle();
    if (orgErr) throw new Error(orgErr.message);
    if (!org) throw new Error("org_not_found");
    if (org.txc_property_id) {
      return {
        ok: true as const,
        alreadyIssued: true,
        propertyId: org.txc_property_id,
        txHash: null as string | null,
      };
    }
    if (!org.minter_wallet_address) throw new Error("wallet_not_created");

    // Decrypt WIF for signing
    const { decryptSeed } = await import("./wallet-crypto.server");
    const { data: secret } = await supabaseAdmin
      .from("organization_wallet_secrets")
      .select("encrypted_wif")
      .eq("org_id", data.orgId)
      .maybeSingle();
    if (!secret?.encrypted_wif) throw new Error("wallet_secret_missing");
    const wif = decryptSeed(JSON.parse(secret.encrypted_wif));

    // Funding check
    const { getAddressBalanceSats, issueManagedProperty } = await import("./txc.server");
    const bal = await getAddressBalanceSats(org.minter_wallet_address);
    if (bal.confirmed < MIN_FUNDING_SATS) {
      throw new Error(
        `Minter wallet needs at least ${MIN_FUNDING_SATS} sats (has ${bal.confirmed})`,
      );
    }

    // Broadcast issuance
    const tokenLabel = `${data.tokenName} (${data.tokenSymbol})`;
    const url = `https://cryptopop.org/o/${org.slug}`;
    const result = await issueManagedProperty({
      tokenName: tokenLabel,
      category: "POP",
      subcategory: "Community",
      url,
      minterWif: wif,
    });

    // Persist token metadata immediately so the wizard can show name/symbol.
    await supabaseAdmin
      .from("organizations")
      .update({ pop_token_name: data.tokenName, pop_token_symbol: data.tokenSymbol })
      .eq("id", data.orgId);

    return {
      ok: true as const,
      alreadyIssued: false,
      propertyId: null as number | null,
      txHash: result.txHash,
    };
  });

export const pollIssuanceConfirmation = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ orgId: z.string().uuid(), txHash: z.string().min(8).max(128) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.userId, data.orgId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("txc_property_id")
      .eq("id", data.orgId)
      .maybeSingle();
    if (org?.txc_property_id) {
      return { confirmed: true, propertyId: org.txc_property_id };
    }
    const { getPropertyIdForIssuanceTx } = await import("./txc.server");
    const propertyId = await getPropertyIdForIssuanceTx(data.txHash);
    if (!propertyId) return { confirmed: false, propertyId: null };
    await supabaseAdmin
      .from("organizations")
      .update({ txc_property_id: propertyId })
      .eq("id", data.orgId);
    return { confirmed: true, propertyId };
  });
