import { createServerFn } from "@tanstack/react-start";

/** Demo partner church — later this comes from the database per wallet. */
export const GIVE_CHURCH = {
  name: "Christ Church of the Valley",
  short: "CCV",
  address: "Tst3dVnJbFrnx5ChmK6qj9F3M8YNsHWR44",
};
export const GIVE_CHURCH_PCT = 8;
export const GIVE_PLATFORM_PCT = 2;
const DEMO_PLATFORM_ADDRESS = "TmmoqqhcfBZWRG8feCTE2c4N4BsADgwD1m";

/** eGiving config. The platform wallet comes from GIVE_PLATFORM_ADDRESS when set. */
export const getGiveConfig = createServerFn({ method: "GET" }).handler(async () => {
  const env = process.env.GIVE_PLATFORM_ADDRESS?.trim();
  const platformAddress = env && /^T[A-Za-z0-9]{25,40}$/.test(env) ? env : DEMO_PLATFORM_ADDRESS;
  return { church: GIVE_CHURCH, churchPct: GIVE_CHURCH_PCT, platformPct: GIVE_PLATFORM_PCT, platformAddress };
});
