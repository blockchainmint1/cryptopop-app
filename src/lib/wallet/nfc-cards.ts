// NFC tap-to-pay card pockets.
// Each card gets its own pocket on CryptoPOP's dedicated branch
// m/44'/696969'/1110'/0/N — separate from the main wallet (0') and from
// HME Wallet's card branch (1107'). The owner identity that signs card
// settings is m/44'/696969'/1110'/1/0.
import { hex, base64 } from "@scure/base";
import { Transaction } from "@scure/btc-signer";
import { deriveTxcAddressAtPath } from "@/lib/wallet";
import { derivePrivateKeyAtPath } from "./sign";
import { signTxcMessage } from "./txc-message";
import { validateSend } from "./transaction-policy";

export const NFC_ACCOUNT = 1110;
export const nfcPocketPath = (n: number) => `m/44'/696969'/${NFC_ACCOUNT}'/0/${n}`;
export const NFC_OWNER_PATH = `m/44'/696969'/${NFC_ACCOUNT}'/1/0`;

/** Same rule as HME: keep ASCII letters/digits only, uppercase. */
export function normalizeUid(raw: string): string {
  return raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

export function pocketAddress(mnemonic: string, index: number): string {
  return deriveTxcAddressAtPath(mnemonic, nfcPocketPath(index));
}

export function pocketKeyHex(mnemonic: string, index: number): string {
  return hex.encode(derivePrivateKeyAtPath(mnemonic, nfcPocketPath(index)));
}

/** Signed envelope for card settings requests. */
export function ownerEnvelope(mnemonic: string, action: "link" | "list" | "update" | "kill", body: object) {
  const owner = deriveTxcAddressAtPath(mnemonic, NFC_OWNER_PATH);
  const ts = Math.floor(Date.now() / 1000);
  const b = JSON.stringify(body);
  const sig = signTxcMessage(derivePrivateKeyAtPath(mnemonic, NFC_OWNER_PATH), `cp-card|${action}|${ts}|${b}`);
  return { owner, ts, action, body: b, sig };
}

/** Sign a pocket withdrawal on this device with the pocket's own key. */
export function signPocketSend(psbtBase64: string, mnemonic: string, index: number, intent: { asset: "tsd" | "txc"; to: string; amount: number }) {
  const from = pocketAddress(mnemonic, index);
  validateSend(psbtBase64, { ...intent, from }, [from]);
  const tx = Transaction.fromPSBT(base64.decode(psbtBase64), { allowUnknownOutputs: true });
  if (tx.sign(derivePrivateKeyAtPath(mnemonic, nfcPocketPath(index))) === 0) throw new Error("Pocket key didn't match");
  tx.finalize();
  return tx.hex;
}
