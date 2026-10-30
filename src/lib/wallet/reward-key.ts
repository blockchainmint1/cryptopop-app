/**
 * Which of this wallet's keys paid a store payment, so the reward claim is
 * signed by the same address NectarPay saw paying. Wallets created before the
 * 696969' switch often hold their TSD on the older 0' address.
 */
import { deriveTxcAddress, deriveLegacyTxcAddress, TXC_PATH, TXC_LEGACY_PATH } from "@/lib/wallet";

/** Derivation path of the wallet key that owns `payer`, or null if it isn't ours. */
export function rewardKeyPath(mnemonic: string, payer: string): string | null {
  if (payer === deriveTxcAddress(mnemonic)) return TXC_PATH;
  if (payer === deriveLegacyTxcAddress(mnemonic)) return TXC_LEGACY_PATH;
  return null;
}
