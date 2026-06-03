// Non-custodial TXC wallet (browser side).
// BIP39 mnemonic → BIP32 HD seed → secp256k1 pubkey → HASH160 → base58check
// with TXC's P2PKH version byte (0x42, "T" prefix).
//
// Path: m/44'/0'/0'/0/0  (TXC has no registered SLIP-44 coin type that we
// could verify; using 0' until we have confirmation. The mnemonic remains
// authoritative — we can re-derive on any path later.)

import { HDKey } from "@scure/bip32";
import { createBase58check } from "@scure/base";
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { ripemd160 } from "@noble/hashes/ripemd160";
import { sha256 } from "@noble/hashes/sha256";

const MNEMONIC_KEY = "cryptopop:mnemonic";
const TXC_P2PKH = 0x42;
const base58check = createBase58check(sha256);

function hash160(buf: Uint8Array): Uint8Array {
  return ripemd160(sha256(buf));
}

export function getOrCreateMnemonic(): string {
  let m = localStorage.getItem(MNEMONIC_KEY);
  if (!m || !validateMnemonic(m, wordlist)) {
    m = generateMnemonic(wordlist, 128);
    localStorage.setItem(MNEMONIC_KEY, m);
  }
  return m;
}

export function getMnemonic(): string | null {
  const m = localStorage.getItem(MNEMONIC_KEY);
  return m && validateMnemonic(m, wordlist) ? m : null;
}

export function setMnemonic(m: string): void {
  if (!validateMnemonic(m, wordlist)) throw new Error("invalid mnemonic");
  localStorage.setItem(MNEMONIC_KEY, m);
}

export function deriveTxcAddress(mnemonic: string): string {
  const seed = mnemonicToSeedSync(mnemonic);
  const root = HDKey.fromMasterSeed(seed);
  const child = root.derive("m/44'/0'/0'/0/0");
  const pubkey = child.publicKey;
  if (!pubkey) throw new Error("failed to derive public key");
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
