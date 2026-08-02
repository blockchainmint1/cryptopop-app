// Server-side TXC wallet derivation. Mirrors src/lib/wallet.ts but runs in
// the server (no localStorage, no Buffer polyfill).

import { HDKey } from "@scure/bip32";
import { createBase58check } from "@scure/base";
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { ripemd160 } from "@noble/hashes/ripemd160";
import { sha256 } from "@noble/hashes/sha256";

const TXC_P2PKH = 0x42;
const base58check = createBase58check(sha256);

function hash160(buf: Uint8Array): Uint8Array {
  return ripemd160(sha256(buf));
}

export function newMnemonic(): string {
  return generateMnemonic(wordlist, 128);
}

export function isValidMnemonic(m: string): boolean {
  return validateMnemonic(m, wordlist);
}

/** TEXITcoin's registered SLIP-0044 coin type (texitcoin.org/build). */
export const TXC_PATH = "m/44'/696969'/0'/0/0";
/** Pre-registration path (Bitcoin's slot) — legacy compatibility only. */
export const TXC_LEGACY_PATH = "m/44'/0'/0'/0/0";

export function deriveTxcAddressAtPathServer(mnemonic: string, path: string): string {
  const seed = mnemonicToSeedSync(mnemonic);
  const root = HDKey.fromMasterSeed(seed);
  const child = root.derive(path);
  if (!child.publicKey) throw new Error("failed to derive public key");
  const h160 = hash160(child.publicKey);
  const payload = new Uint8Array(21);
  payload[0] = TXC_P2PKH;
  payload.set(h160, 1);
  return base58check.encode(payload);
}

export function deriveTxcAddressServer(mnemonic: string): string {
  return deriveTxcAddressAtPathServer(mnemonic, TXC_PATH);
}

export function deriveLegacyTxcAddressServer(mnemonic: string): string {
  return deriveTxcAddressAtPathServer(mnemonic, TXC_LEGACY_PATH);
}

