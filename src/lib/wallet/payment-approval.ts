/**
 * One gate before any outgoing payment is signed: a fresh Face ID /
 * fingerprint check when the person has turned it on (web passkey or the
 * older native build). Call it first in the click handler, before any other
 * await, so phone browsers still treat it as part of the tap.
 */
import { isNative } from "@/lib/native/platform";
import { confirmWithBiometric } from "@/lib/native/biometric";
import { passkeyApprove } from "./passkey-unlock";

export const PAYMENT_NOT_APPROVED =
  "Payment cancelled — the Face ID / fingerprint check didn't pass. Nothing was sent.";

export async function approvePayment(mnemonic: string, reason: string): Promise<boolean> {
  if (isNative()) return confirmWithBiometric(reason);
  return passkeyApprove(mnemonic);
}
