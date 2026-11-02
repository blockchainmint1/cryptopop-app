/**
 * Give causes (churches, nonprofits) and their wallets come ONLY from
 * NectarPay's signed causes list, fetched fresh before every Give payment —
 * never saved or built into the app, so retired addresses stop at once.
 * The program's 2% wallet stays pinned here (it is ours, not NectarPay's).
 */
export const GIVE_PLATFORM_ADDRESS = "ToaRhmGqAW7PyvPJvbLJo69mnZwhaaA1vu";

/** Discount used when paying a plain address (no NectarPay invoice). */
export const GIVE_DEFAULT_DISCOUNT_PCT = 10;
