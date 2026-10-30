import { GIVE_CHURCH } from "./constants";
import { verifyTxcMessage } from "@/lib/wallet/txc-message";

/** NectarPay's church-list signing address, pinned in the app. */
export const NECTARPAY_CAUSES_SIGNER = "TmFtZmNYbLmK9uiS3zcXdWUrShB9WqxVdQ";

/** Verify NectarPay's signed list; returns null if unsigned, wrong signer, or altered. */
export function parseSignedCauses(r: { signed_payload: string; signer: string; signature: string }): Charity[] | null {
  if (r.signer !== NECTARPAY_CAUSES_SIGNER) return null;
  try {
    if (!verifyTxcMessage(NECTARPAY_CAUSES_SIGNER, r.signed_payload, r.signature)) return null;
    const p = JSON.parse(r.signed_payload) as { causes?: Array<Record<string, unknown>> };
    return (p.causes ?? [])
      .filter((c) => typeof c.address === "string" && typeof c.name === "string")
      .map((c) => ({
        code: typeof c.code === "string" && c.code ? c.code : String(c.address),
        name: String(c.name),
        city: typeof c.city === "string" ? c.city : "",
        blurb: typeof c.blurb === "string" ? c.blurb : "",
        address: String(c.address),
        featured: c.featured === true,
      }));
  } catch {
    return null;
  }
}

/**
 * Charities a member can choose to support. NectarPay owns the real list
 * (its approved giving recipients); until it publishes a signed feed, only the
 * pinned demo church is offered so the choice can never point at an address
 * the payment safety lock would refuse.
 */
export type Charity = {
  code: string;
  name: string;
  city: string;
  blurb: string;
  address: string;
  featured: boolean;
};

export const CHARITIES: Charity[] = [
  {
    code: GIVE_CHURCH.short,
    name: GIVE_CHURCH.name,
    city: "Arizona",
    blurb: "Our first eGiving church partner.",
    address: GIVE_CHURCH.address,
    featured: true,
  },
];

export const CHOSEN_CHARITY_KEY = "cryptopop.give.charity";

export function searchCharities(q: string, list: Charity[] = CHARITIES): Charity[] {
  const t = q.trim().toLowerCase();
  if (!t) return list;
  return list.filter((c) => `${c.name} ${c.city} ${c.code}`.toLowerCase().includes(t));
}

export function findByCode(code: string, list: Charity[] = CHARITIES): Charity | null {
  const t = code.trim().toUpperCase();
  return list.find((c) => c.code.toUpperCase() === t) ?? null;
}
