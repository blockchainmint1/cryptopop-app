/**
 * One gate before any outgoing payment is signed or a sensitive setting is
 * changed: a fresh Face ID / fingerprint check when the person has turned it
 * on (web passkey or the older native build). Call it first in the click
 * handler, before any other await, so phone browsers still treat it as part
 * of the tap.
 *
 * Fail closed: the "approval required" flag comes from the unlocked,
 * password-decrypted wallet in memory. If it is set and the passkey copy is
 * missing or out of date, the wallet password is asked for instead. The
 * native shell honours the same flag when its own biometrics are off.
 */
import { isNative } from "@/lib/native/platform";
import { confirmWithBiometric, isNativeBiometricOn } from "@/lib/native/biometric";
import { passkeyApprove, runApproval } from "./passkey-unlock";
import { askForPassword } from "./password-prompt";
import { checkVaultPassword, loadSession, normalizeMnemonic, WALLET_LOCKED_EVENT } from "./vault";

export const PAYMENT_NOT_APPROVED =
  "Payment cancelled — the Face ID / fingerprint check didn't pass. Nothing was sent.";
export const CHANGE_NOT_APPROVED =
  "Not changed — the Face ID / fingerprint check didn't pass.";
export const LOCKED_NOT_APPROVED =
  "Your wallet locked itself for safety. Unlock it and try again — nothing was sent or changed.";

/**
 * The message to show after approvePayment returned false. Says "wallet
 * locked" when that is the real reason, instead of blaming Face ID.
 */
export function notApprovedMessage(kind: "payment" | "change"): string {
  if (typeof window !== "undefined" && !loadSession()) return LOCKED_NOT_APPROVED;
  return kind === "payment" ? PAYMENT_NOT_APPROVED : CHANGE_NOT_APPROVED;
}

function reportLocked() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(WALLET_LOCKED_EVENT));
}

export async function approvePayment(mnemonic: string, reason: string): Promise<boolean> {
  if (isNative() && (await isNativeBiometricOn())) return confirmWithBiometric(reason);
  const session = loadSession();
  if (!session) {
    // Auto-lock already ran: send the person to the unlock screen.
    reportLocked();
    return false;
  }
  // The wallet must be the one about to sign.
  if (normalizeMnemonic(session.mnemonic) !== normalizeMnemonic(mnemonic)) return false;
  const io = { askPassword: () => askForPassword(reason), checkPassword: checkVaultPassword };
  if (isNative()) {
    // Native biometrics off: no web passkey here, but a vault that says
    // "approval required" (Face ID set up on the web) still needs the password.
    return runApproval({
      required: session.approval === "passkey",
      unlockedMnemonic: session.mnemonic,
      record: null,
      passkey: async () => null,
      currentTag: async () => null,
      ...io,
    });
  }
  return passkeyApprove(session, io);
}
