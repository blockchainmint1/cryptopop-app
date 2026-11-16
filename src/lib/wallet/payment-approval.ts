/**
 * One gate before any outgoing payment is signed or a sensitive setting is
 * changed: a fresh Face ID / fingerprint check when the person has turned it
 * on (web passkey or the older native build). Call it first in the click
 * handler, before any other await, so phone browsers still treat it as part
 * of the tap.
 *
 * Fail closed: the "approval required" flag comes from the unlocked,
 * password-decrypted wallet in memory. If it is set and the passkey copy is
 * missing or out of date, the wallet password is asked for instead.
 */
import { isNative } from "@/lib/native/platform";
import { confirmWithBiometric } from "@/lib/native/biometric";
import { passkeyApprove } from "./passkey-unlock";
import { askForPassword } from "./password-prompt";
import { checkVaultPassword, loadSession, normalizeMnemonic } from "./vault";

export const PAYMENT_NOT_APPROVED =
  "Payment cancelled — the Face ID / fingerprint check didn't pass. Nothing was sent.";
export const CHANGE_NOT_APPROVED =
  "Not changed — the Face ID / fingerprint check didn't pass.";

export async function approvePayment(mnemonic: string, reason: string): Promise<boolean> {
  if (isNative()) return confirmWithBiometric(reason);
  const session = loadSession();
  // The wallet must still be unlocked, and it must be the one about to sign.
  if (!session || normalizeMnemonic(session.mnemonic) !== normalizeMnemonic(mnemonic)) return false;
  return passkeyApprove(session, {
    askPassword: () => askForPassword(reason),
    checkPassword: checkVaultPassword,
  });
}
