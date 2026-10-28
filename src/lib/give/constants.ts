/**
 * eGiving recipients are pinned in the app itself so a compromised server
 * cannot redirect the church or eGiving shares. The server supplies the live
 * addresses from the GIVE_CHURCH / GIVE_FEE secrets; the wallet compares them
 * against these pinned values and refuses to pay on any mismatch. These pins
 * must match the secrets, or every payment fails closed.
 */
export const GIVE_CHURCH = {
  name: "Christ Church of the Valley",
  short: "CCV",
  address: "Tst3dVnJbFrnx5ChmK6qj9F3M8YNsHWR44",
} as const;

export const GIVE_PLATFORM_ADDRESS = "TmmoqqhcfBZWRG8feCTE2c4N4BsADgwD1m";

/** Discount used when paying a plain address (no NectarPay invoice). */
export const GIVE_DEFAULT_DISCOUNT_PCT = 10;

export function configMatchesPinned(cfg: { church: { address: string }; platformAddress: string }) {
  return cfg.church.address === GIVE_CHURCH.address && cfg.platformAddress === GIVE_PLATFORM_ADDRESS;
}
