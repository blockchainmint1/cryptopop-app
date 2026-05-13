// Non-custodial TXC wallet — STUB.
// Generates a BIP39 mnemonic on first use, stored in localStorage.
// The on-chain address is a deterministic placeholder derived from the
// mnemonic; real secp256k1 + TXC base58check derivation is wired in at the
// end of the build (see plan).

import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from "bip39";

const MNEMONIC_KEY = "cryptopop:mnemonic";

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function toBase58(bytes: Uint8Array, length: number): string {
  let out = "";
  let acc = 0n;
  for (const b of bytes) acc = (acc << 8n) | BigInt(b);
  while (out.length < length) {
    const rem = Number(acc % 58n);
    acc = acc / 58n;
    out = BASE58[rem] + out;
    if (acc === 0n) acc = BigInt(bytes[out.length % bytes.length] ?? 1);
  }
  return out.slice(0, length);
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
  // STUB: deterministic placeholder. Real impl will use bitcoinjs-lib with
  // TXC network params (P2PKH version byte → "T..." legacy address).
  const seed = mnemonicToSeedSync(mnemonic);
  const tail = toBase58(seed.slice(0, 24), 33);
  return "T" + tail;
}

export function clearWallet() {
  localStorage.removeItem(MNEMONIC_KEY);
}
