// Non-custodial TXC wallet (browser side).
// BIP39 mnemonic → BIP32 HD seed → secp256k1 pubkey → HASH160 → base58check
// with TXC's P2PKH version byte (0x42, "T" prefix).
//
// Path: m/44'/0'/0'/0/0  (TXC has no registered SLIP-44 coin type that we
// could verify; using 0' until we have confirmation. The mnemonic remains
// authoritative — we can re-derive on any path later.)

import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from "bip39";
import { BIP32Factory } from "bip32";
import * as ecc from "@bitcoinerlab/secp256k1";
import bs58check from "bs58check";
import { ripemd160 } from "@noble/hashes/ripemd160";
import { sha256 } from "@noble/hashes/sha2";

const MNEMONIC_KEY = "cryptopop:mnemonic";
const TXC_P2PKH = 0x42;

const bip32 = BIP32Factory(ecc);

function hash160(buf: Uint8Array): Uint8Array {
  return ripemd160(sha256(buf));
}

export function getOrCreateMnemonic(): string {
  let m = localStorage.getItem(MNEMONIC_KEY);
  if (!m || !validateMnemonic(m)) {
    m = generateMnemonic(128);
    localStorage.setItem(MNEMONIC_KEY, m);
  }
  return m;
}

export function deriveTxcAddress(mnemonic: string): string {
  const seed = mnemonicToSeedSync(mnemonic);
  const root = bip32.fromSeed(seed);
  const child = root.derivePath("m/44'/0'/0'/0/0");
  const pubkey = child.publicKey;
  const h160 = hash160(pubkey);
  const payload = new Uint8Array(21);
  payload[0] = TXC_P2PKH;
  payload.set(h160, 1);
  return bs58check.encode(payload);
}

// True iff `addr` decodes to a valid P2PKH address with TXC's version byte.
export function isValidTxcAddress(addr: string): boolean {
  try {
    const decoded = bs58check.decode(addr);
    return decoded.length === 21 && decoded[0] === TXC_P2PKH;
  } catch {
    return false;
  }
}

export function clearWallet() {
  localStorage.removeItem(MNEMONIC_KEY);
}
