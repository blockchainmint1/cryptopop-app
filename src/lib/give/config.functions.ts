import { createServerFn } from "@tanstack/react-start";
import { GIVE_CHURCH, GIVE_DEFAULT_DISCOUNT_PCT, GIVE_PLATFORM_ADDRESS } from "./constants";

/**
 * eGiving config as the server sees it. The wallet compares these addresses to
 * the ones pinned in the app and refuses to pay if they differ.
 */
export const getGiveConfig = createServerFn({ method: "GET" }).handler(async () => {
  return { church: GIVE_CHURCH, platformAddress: GIVE_PLATFORM_ADDRESS, defaultDiscountPct: GIVE_DEFAULT_DISCOUNT_PCT };
});
