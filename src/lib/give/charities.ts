import { GIVE_CHURCH } from "./constants";

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
