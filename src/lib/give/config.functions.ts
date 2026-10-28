import { createServerFn } from "@tanstack/react-start";
import { GIVE_CHURCH, GIVE_DEFAULT_DISCOUNT_PCT, GIVE_PLATFORM_ADDRESS } from "./constants";

/**
 * eGiving config as the server sees it. Recipient addresses come from the
 * GIVE_CHURCH and GIVE_FEE secrets (server-only), falling back to the demo
 * addresses pinned in the app. The wallet compares these to its pinned values
 * and refuses to pay on any mismatch, so a compromised server cannot redirect
 * the church or eGiving shares.
 */
export const getGiveConfig = createServerFn({ method: "GET" }).handler(async () => {
  const churchAddress = process.env.GIVE_CHURCH?.trim() || GIVE_CHURCH.address;
  const platformAddress = process.env.GIVE_FEE?.trim() || GIVE_PLATFORM_ADDRESS;
  return {
    church: { ...GIVE_CHURCH, address: churchAddress },
    platformAddress,
    defaultDiscountPct: GIVE_DEFAULT_DISCOUNT_PCT,
  };
});
