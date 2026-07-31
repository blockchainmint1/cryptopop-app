/**
 * On-device transaction signing. Takes an unsigned PSBT from the server,
 * derives the wallet key from the in-memory mnemonic, signs locally and
 * returns the raw signed hex. The key never leaves the browser.
 */
import { HDKey } from "@scure/bip32";
import { mnemonicToSeedSync } from "@scure/bip39";
import { Transaction } from "@scure/btc-signer";
import { base64 } from "@scure/base";

const DERIVATION_PATH = "m/44'/0'/0'/0/0";

export function derivePrivateKey(mnemonic: string): Uint8Array {
  const seed = mnemonicToSeedSync(mnemonic);
  const root = HDKey.fromMasterSeed(seed);
  const child = root.derive(DERIVATION_PATH);
  if (!child.privateKey) throw new Error("Could not derive signing key");
  return child.privateKey;
}

/** Sign every input of a base64 PSBT with the wallet key and finalize it. */
export function signPsbt(psbtBase64: string, mnemonic: string): string {
  const priv = derivePrivateKey(mnemonic);
  const tx = Transaction.fromPSBT(base64.decode(psbtBase64), {
    allowUnknownInputs: true,
    allowUnknownOutputs: true,
    allowLegacyWitnessUtxo: true,
  });
  tx.sign(priv);
  tx.finalize();
  return tx.hex;
}
