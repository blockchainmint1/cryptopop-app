// Server-side TXC wallet derivation. Mirrors src/lib/wallet.ts but runs in
// the server (no localStorage, no Buffer polyfill).

import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from "bip39";
import { BIP32Factory } from "bip32";
import * as ecc from "@bitcoinerlab/secp256k1";
import bs58check from "bs58check";
import { ripemd160 } from "@noble/hashes/ripemd160";
import { sha256 } from "@noble/hashes/sha256";

const TXC_P2PKH = 0x42;
const bip32 = BIP32Factory(ecc);

function hash160(buf: Uint8Array): Uint8Array {
  return ripemd160(sha256(buf));
}

export function newMnemonic(): string {
  return generateMnemonic(128);
}

export function isValidMnemonic(m: string): boolean {
  return validateMnemonic(m);
}

export function deriveTxcAddressServer(mnemonic: string): string {
  const seed = mnemonicToSeedSync(mnemonic);
  const root = bip32.fromSeed(seed);
  const child = root.derivePath("m/44'/0'/0'/0/0");
  const h160 = hash160(child.publicKey);
  const payload = new Uint8Array(21);
  payload[0] = TXC_P2PKH;
  payload.set(h160, 1);
  return bs58check.encode(payload);
}
