/**
 * Dependency-free limits for Trading-pocket branches (hardened account numbers).
 * honest.money decides which branch each trading site gets; these are the
 * wallet's own hard limits that no registry entry can widen.
 */
export const POCKET_BASE_ACCOUNT = 1106;
/** Hard ceiling: a site can never push us onto an arbitrary account. */
export const POCKET_MAX_ACCOUNT = POCKET_BASE_ACCOUNT + 999;
/** Branches reserved for other HME features that a trading site must never get. */
export const NON_TRADING_ACCOUNTS: ReadonlySet<number> = new Set([1107, 1110]); // 1107'/1110' = Tap card pockets

export function isPocketAccount(account: number): boolean {
  return Number.isInteger(account) && account >= POCKET_BASE_ACCOUNT && account <= POCKET_MAX_ACCOUNT;
}

/** May this account ever be handed to a trading site? */
export function isDelegableAccount(account: number): boolean {
  return isPocketAccount(account) && !NON_TRADING_ACCOUNTS.has(account);
}