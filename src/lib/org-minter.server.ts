// Resolve an org's TXC minter (property id + WIF) for the mint pipeline.
// CryptoPOP USA (and any org that hasn't yet stored its own encrypted WIF)
// falls back to env vars (TXC_TOKEN_ID + MINTER_WIF/TXC_WIF) so the flagship
// flow keeps working unchanged.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { decryptSeed, encryptSeed, type EncryptedBlob } from "./wallet-crypto.server";
import { mintGrant, type MintResult } from "./txc.server";

export class OrgNotMintedError extends Error {
  constructor(orgId: string) {
    super(`Organization ${orgId} has not minted its POP token yet`);
    this.name = "OrgNotMintedError";
  }
}

export type OrgMinter = {
  orgId: string;
  propertyId: number;
  minterAddress: string;
  minterWif: string;
};

function envPropertyId(): number {
  const raw = process.env.TXC_TOKEN_ID ?? "37";
  return Number(raw);
}

function envMinterWif(): string | null {
  return process.env.MINTER_WIF ?? process.env.TXC_WIF ?? null;
}

async function readEncryptedWif(orgId: string): Promise<EncryptedBlob | null> {
  const { data } = await supabaseAdmin
    .from("organization_wallet_secrets")
    .select("encrypted_wif")
    .eq("org_id", orgId)
    .maybeSingle();
  if (!data?.encrypted_wif) return null;
  try {
    return JSON.parse(data.encrypted_wif) as EncryptedBlob;
  } catch {
    return null;
  }
}

export async function writeEncryptedWif(orgId: string, wif: string): Promise<void> {
  const blob = encryptSeed(wif);
  const { error } = await supabaseAdmin
    .from("organization_wallet_secrets")
    .upsert(
      { org_id: orgId, encrypted_wif: JSON.stringify(blob), encryption_key_id: "v1" },
      { onConflict: "org_id" },
    );
  if (error) throw new Error(`writeEncryptedWif: ${error.message}`);
}

/**
 * Resolve an org's minter wallet + property id. Order of preference:
 *   1. organization_wallet_secrets row + organizations.txc_property_id
 *   2. env vars (for the legacy CryptoPOP USA flagship row)
 * Throws OrgNotMintedError if neither path yields a usable minter.
 */
export async function resolveOrgMinter(orgId: string): Promise<OrgMinter> {
  const { data: org, error } = await supabaseAdmin
    .from("organizations")
    .select("id, txc_property_id, minter_wallet_address")
    .eq("id", orgId)
    .maybeSingle();
  if (error) throw new Error(`resolveOrgMinter: ${error.message}`);
  if (!org) throw new Error(`Organization ${orgId} not found`);

  const blob = await readEncryptedWif(orgId);
  if (blob && org.txc_property_id && org.minter_wallet_address) {
    return {
      orgId,
      propertyId: org.txc_property_id,
      minterAddress: org.minter_wallet_address,
      minterWif: decryptSeed(blob),
    };
  }

  // Env fallback (legacy flagship)
  const envWif = envMinterWif();
  const envProp = envPropertyId();
  if (envWif && org.txc_property_id === envProp) {
    return {
      orgId,
      propertyId: envProp,
      minterAddress: org.minter_wallet_address ?? "",
      minterWif: envWif,
    };
  }

  throw new OrgNotMintedError(orgId);
}

/** Convenience wrapper: resolve org and mint a grant in one call. */
export async function mintGrantForOrg(
  orgId: string,
  opts: { amount: number; toAddress: string; memo?: string },
): Promise<MintResult> {
  const minter = await resolveOrgMinter(orgId);
  return mintGrant({
    amount: opts.amount,
    toAddress: opts.toAddress,
    memo: opts.memo,
    propertyId: minter.propertyId,
    minterWif: minter.minterWif,
  });
}
