import { NFC_ACCOUNT } from "@/lib/wallet/nfc-cards";

/**
 * Dependency-free limits for Trading-pocket branches (hardened account numbers).
 * honest.money decides which branch each trading site gets; these are the
 * wallet's own hard limits that no registry entry can widen.
 */
export const POCKET_BASE_ACCOUNT = 1106;
/** Hard ceiling: a site can never push us onto an arbitrary account. */
export const POCKET_MAX_ACCOUNT = POCKET_BASE_ACCOUNT + 999;
/** HME Wallet's tap-card pocket branch, also reserved across the ecosystem. */
const HME_CARD_ACCOUNT = 1107;
/** Branches reserved for other HME features that a trading site must never get. */
export const NON_TRADING_ACCOUNTS: ReadonlySet<number> = new Set([HME_CARD_ACCOUNT, NFC_ACCOUNT]);

export function isPocketAccount(account: number): boolean {
  return Number.isInteger(account) && account >= POCKET_BASE_ACCOUNT && account <= POCKET_MAX_ACCOUNT;
}

/** May this account ever be handed to a trading site? */
export function isDelegableAccount(account: number): boolean {
  return isPocketAccount(account) && !NON_TRADING_ACCOUNTS.has(account);
}