import { parseSignedCauses, type Charity } from "./charities";

export const CAUSES_URL = "https://app.nectar-pay.com/api/public/v1/egiving/causes";

/** Fetch NectarPay's signed causes list fresh and verify its signature. Null = unavailable or not trusted. */
export async function fetchVerifiedCauses(): Promise<Charity[] | null> {
  try {
    const res = await fetch(CAUSES_URL, { headers: { accept: "application/json" } });
    if (!res.ok) return null;
    const j = (await res.json()) as { signed_payload?: string; signer?: string; signature?: string };
    return parseSignedCauses({ signed_payload: String(j.signed_payload ?? ""), signer: String(j.signer ?? ""), signature: String(j.signature ?? "") });
  } catch {
    return null;
  }
}
