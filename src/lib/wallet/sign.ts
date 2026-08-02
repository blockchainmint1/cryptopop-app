/**
 * On-device transaction signing. Takes an unsigned PSBT from the server,
 * derives the wallet key from the in-memory mnemonic, signs locally and
 * returns the raw signed hex. The key never leaves the browser.
 */
import { HDKey } from "@scure/bip32";
import { mnemonicToSeedSync } from "@scure/bip39";
import { Transaction } from "@scure/btc-signer";
import { base64 } from "@scure/base";

/** TEXITcoin's registered SLIP-0044 coin type (texitcoin.org/build). */
const DERIVATION_PATH = "m/44'/696969'/0'/0/0";
/** Pre-registration path — still spendable for seeds created before the switch. */
const LEGACY_DERIVATION_PATH = "m/44'/0'/0'/0/0";

export function derivePrivateKeyAtPath(mnemonic: string, path: string): Uint8Array {
  const seed = mnemonicToSeedSync(mnemonic);
  const root = HDKey.fromMasterSeed(seed);
  const child = root.derive(path);
  if (!child.privateKey) throw new Error("Could not derive signing key");
  return child.privateKey;
}

export function derivePrivateKey(mnemonic: string): Uint8Array {
  return derivePrivateKeyAtPath(mnemonic, DERIVATION_PATH);
}

/** Sign every input of a base64 PSBT with the wallet key and finalize it. */
export function signPsbt(psbtBase64: string, mnemonic: string): string {
  const tx = Transaction.fromPSBT(base64.decode(psbtBase64), {
    allowUnknownInputs: true,
    allowUnknownOutputs: true,
    allowLegacyWitnessUtxo: true,
  });

  // Inputs may belong to either the canonical 696969' key or an older 0' key,
  // so try both and require at least one to have matched.
  let signed = 0;
  for (const path of [DERIVATION_PATH, LEGACY_DERIVATION_PATH]) {
    try {
      signed += tx.sign(derivePrivateKeyAtPath(mnemonic, path));
    } catch {
      /* key doesn't match any input — try the next path */
    }
  }
  if (signed === 0) throw new Error("No inputs matched this wallet's keys");

  tx.finalize();
  return tx.hex;
}

