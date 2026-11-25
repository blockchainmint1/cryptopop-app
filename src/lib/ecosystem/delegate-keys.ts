/**
 * Trading-pocket key derivation for all 19 approved Seeds chains:
 * - 5 core chains: TXC, ISK, BTC, LTC, EVM
 * - 11 extra chains: DOGE, BCH, DASH, TRX, SOL, ZEC, XRP, ATOM, RUNE, ADA, XMR
 * - 3 accept-and-hold chains: XLM, TON, SUI
 *
 * Every key is a hardened account at the site's reserved trading branch
 * (1106..2105, never 0), so main-wallet funds are never reachable.
 */
import * as ecc from "@bitcoinerlab/secp256k1";
import { BIP32Factory, type BIP32Interface } from "bip32";
import { ed25519 } from "@noble/curves/ed25519";
import { hmac } from "@noble/hashes/hmac";
import { pbkdf2 } from "@noble/hashes/pbkdf2";
import { sha512 } from "@noble/hashes/sha512";
import { keccak_256 } from "@noble/hashes/sha3";
import { base58 } from "@scure/base";
import { mnemonicToEntropy } from "@scure/bip39";
import { wordlist as englishWordlist } from "@scure/bip39/wordlists/english.js";
import { normalizeMnemonic } from "@/lib/wallet/vault";
import { HOLD_FORMAT, HOLD_LABEL, holdAccountPath, holdPublicHalf, isHoldChain, SEEDS_HOLD_COINS_LIVE, type HoldChain } from "./hold-coins";

const bip32 = BIP32Factory(ecc);
const H = 0x80000000;

/* ------------------------------ 5 core chains ------------------------------ */

export const POCKET_CHAINS = ["TXC", "ISK", "BTC", "LTC", "EVM"] as const;
export type PocketChain = (typeof POCKET_CHAINS)[number];

export const CORE_CHAIN_LABEL: Record<PocketChain, string> = {
  TXC: "TXC / TSD",
  ISK: "IskanderCoin",
  BTC: "Bitcoin",
  LTC: "Litecoin",
  EVM: "Ethereum / EVM",
};

const CORE_PATH: Record<PocketChain, [number, number]> = {
  TXC: [44, 696969],
  ISK: [44, 969696],
  BTC: [84, 0],
  LTC: [44, 2],
  EVM: [44, 60],
};

const LTC_BIP32 = { bip32: { public: 0x019da462, private: 0x019d9cfe }, wif: 0xb0 };

export function accountPath(chain: PocketChain, account: number): string {
  const [purpose, coin] = CORE_PATH[chain];
  return `m/${purpose}'/${coin}'/${account}'`;
}

export function coreChainRoot(seed: Uint8Array, chain: PocketChain): BIP32Interface {
  return bip32.fromSeed(seed, chain === "LTC" ? LTC_BIP32 : undefined);
}

/* -------------------------- 11 extra + 3 hold chains ----------------------- */

export const EXTRA_CHAINS = ["DOGE", "BCH", "DASH", "TRX", "SOL", "ZEC", "XRP", "ATOM", "RUNE", "ADA", "XMR"] as const;
export type ExtraChain = (typeof EXTRA_CHAINS)[number];

export const EXTRA_FORMAT: Record<ExtraChain, string> = {
  DOGE: "bip32",
  BCH: "bip32",
  DASH: "bip32",
  TRX: "bip32",
  ZEC: "bip32",
  XRP: "bip32",
  ATOM: "bip32",
  RUNE: "bip32",
  SOL: "slip10-ed25519",
  ADA: "cip1852-icarus",
  XMR: "slip10-ed25519-monero-trezor",
};

export function isExtraChain(c: string): c is ExtraChain {
  return (EXTRA_CHAINS as readonly string[]).includes(c);
}

export type LinkExtraChain = ExtraChain | HoldChain;

export function isLinkExtraChain(c: string, live: boolean = SEEDS_HOLD_COINS_LIVE): c is LinkExtraChain {
  return isExtraChain(c) || (live && isHoldChain(c));
}

export function linkExtraFormat(c: LinkExtraChain): string {
  return isHoldChain(c) ? HOLD_FORMAT[c] : EXTRA_FORMAT[c];
}

const SECP: Record<Exclude<ExtraChain, "SOL" | "ADA" | "XMR">, [number, number]> = {
  DOGE: [44, 3],
  BCH: [44, 145],
  DASH: [44, 5],
  TRX: [44, 195],
  ZEC: [44, 133],
  XRP: [44, 144],
  ATOM: [44, 118],
  RUNE: [44, 931],
};

export const EXTRA_CHAIN_LABEL: Record<LinkExtraChain, string> = {
  ...HOLD_LABEL,
  DOGE: "Dogecoin",
  BCH: "Bitcoin Cash",
  DASH: "Dash",
  TRX: "TRON",
  SOL: "Solana",
  ZEC: "Zcash",
  XRP: "XRP",
  ATOM: "Cosmos",
  RUNE: "THORChain (RUNE)",
  ADA: "Cardano",
  XMR: "Monero",
};

export function extraAccountPath(chain: LinkExtraChain, account: number): string {
  if (isHoldChain(chain)) return holdAccountPath(chain, account);
  if (chain === "SOL") return `m/44'/501'/${account}'/0'`;
  if (chain === "ADA") return `m/1852'/1815'/${account}'`;
  if (chain === "XMR") return `m/44'/128'/${account}'`;
  const [p, c] = SECP[chain];
  return `m/${p}'/${c}'/${account}'`;
}

export function extraAccountOf(chain: LinkExtraChain, path: unknown): number | null {
  if (!isExtraChain(chain) && !isHoldChain(chain)) return null;
  const m = /^m\/\d+'\/\d+'\/(\d{1,10})'(?:\/0'){0,2}$/.exec(String(path));
  if (!m) return null;
  const n = Number(m[1]);
  return extraAccountPath(chain, n) === path ? n : null;
}

export interface ExtraKey {
  path: string;
  pub: string;
  priv?: string;
}

function toHex(b: Uint8Array): string {
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

function hardenedSegments(path: string): number[] {
  const parts = path.split("/").slice(1);
  return parts.map((p) => {
    if (!p.endsWith("'")) throw new Error("Only hardened steps are allowed here.");
    return Number(p.slice(0, -1));
  });
}

export function slip10Ed25519(seed: Uint8Array, path: string): Uint8Array {
  let I = hmac(sha512, new TextEncoder().encode("ed25519 seed"), seed);
  for (const seg of hardenedSegments(path)) {
    const data = new Uint8Array(37);
    data.set(I.slice(0, 32), 1);
    new DataView(data.buffer).setUint32(33, (seg + H) >>> 0, false);
    const next = hmac(sha512, I.slice(32), data);
    I.fill(0);
    I = next;
  }
  const k = I.slice(0, 32);
  I.fill(0);
  return k;
}

/* ----------------------------- Cardano (Icarus) ---------------------------- */

function leToBig(b: Uint8Array): bigint {
  let n = 0n;
  for (let i = b.length - 1; i >= 0; i--) n = (n << 8n) | BigInt(b[i]!);
  return n;
}
function bigToLe(n: bigint, len: number): Uint8Array {
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    out[i] = Number(n & 0xffn);
    n >>= 8n;
  }
  return out;
}

export function icarusMaster(mnemonic: string, passphrase = ""): Uint8Array {
  const entropy = mnemonicToEntropy(normalizeMnemonic(mnemonic), englishWordlist);
  const k = pbkdf2(sha512, new TextEncoder().encode(passphrase), entropy, { c: 4096, dkLen: 96 });
  entropy.fill(0);
  k[0]! &= 0b11111000;
  k[31]! &= 0b00011111;
  k[31]! |= 0b01000000;
  return k;
}

function icarusHardenedChild(xprv: Uint8Array, index: number): Uint8Array {
  const kL = xprv.slice(0, 32);
  const kR = xprv.slice(32, 64);
  const cc = xprv.slice(64, 96);
  const data = new Uint8Array(1 + 64 + 4);
  data.set(kL, 1);
  data.set(kR, 33);
  new DataView(data.buffer).setUint32(65, (index + H) >>> 0, true);
  data[0] = 0x00;
  const Z = hmac(sha512, cc, data);
  data[0] = 0x01;
  const I = hmac(sha512, cc, data);
  const mod = 1n << 256n;
  const nkL = bigToLe((leToBig(Z.slice(0, 28)) * 8n + leToBig(kL)) % mod, 32);
  const nkR = bigToLe((leToBig(Z.slice(32, 64)) + leToBig(kR)) % mod, 32);
  const out = new Uint8Array(96);
  out.set(nkL, 0);
  out.set(nkR, 32);
  out.set(I.slice(32, 64), 64);
  data.fill(0);
  Z.fill(0);
  kL.fill(0);
  kR.fill(0);
  return out;
}

function icarusPublic(kL: Uint8Array): Uint8Array {
  const s = leToBig(kL) % ed25519.CURVE.n;
  return ed25519.ExtendedPoint.BASE.multiply(s).toRawBytes();
}

export function cardanoAccountKey(mnemonic: string, passphrase: string, account: number): { pub: string; priv: string } {
  let k = icarusMaster(mnemonic, passphrase);
  for (const seg of [1852, 1815, account]) {
    const next = icarusHardenedChild(k, seg);
    k.fill(0);
    k = next;
  }
  const pub = toHex(icarusPublic(k.slice(0, 32))) + toHex(k.slice(64, 96));
  const priv = toHex(k);
  k.fill(0);
  return { pub, priv };
}

/* --------------------------------- Monero ---------------------------------- */

function scReduce(b: Uint8Array): bigint {
  return leToBig(b) % ed25519.CURVE.n;
}

const XMR_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const XMR_BLOCK_CHARS = [0, 2, 3, 5, 6, 7, 9, 10, 11];
function moneroBase58(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 8) {
    const block = bytes.slice(i, i + 8);
    let n = 0n;
    for (const b of block) n = (n << 8n) | BigInt(b);
    let chunk = "";
    for (let j = 0; j < XMR_BLOCK_CHARS[block.length]!; j++) {
      chunk = XMR_ALPHABET[Number(n % 58n)] + chunk;
      n /= 58n;
    }
    out += chunk;
  }
  return out;
}

export function moneroAccountKey(seed: Uint8Array, account: number): { address: string; spend: string } {
  const k = slip10Ed25519(seed, `m/44'/128'/${account}'`);
  const spend = scReduce(k);
  k.fill(0);
  const spendBytes = bigToLe(spend, 32);
  const vh = keccak_256(spendBytes);
  const view = scReduce(vh);
  vh.fill(0);
  if (spend === 0n || view === 0n) throw new Error("Couldn't make the Monero key.");
  const G = ed25519.ExtendedPoint.BASE;
  const body = new Uint8Array(65);
  body[0] = 0x12; // mainnet standard address
  body.set(G.multiply(spend).toRawBytes(), 1);
  body.set(G.multiply(view).toRawBytes(), 33);
  const full = new Uint8Array(69);
  full.set(body, 0);
  full.set(keccak_256(body).slice(0, 4), 65);
  const out = { address: moneroBase58(full), spend: toHex(spendBytes) };
  spendBytes.fill(0);
  return out;
}

/* -------------------------------- dispatcher ------------------------------- */

export function deriveExtraKey(args: {
  chain: LinkExtraChain;
  account: number;
  seed: Uint8Array;
  mnemonic: string;
  passphrase?: string;
  withPrivate: boolean;
}): ExtraKey {
  const { chain, account, seed, mnemonic, passphrase = "", withPrivate } = args;
  const path = extraAccountPath(chain, account);
  if (isHoldChain(chain)) {
    const k = slip10Ed25519(seed, path);
    const out: ExtraKey = { path, pub: holdPublicHalf(chain, ed25519.getPublicKey(k)) };
    if (withPrivate) out.priv = toHex(k);
    k.fill(0);
    return out;
  }
  if (chain === "SOL") {
    const k = slip10Ed25519(seed, path);
    const out: ExtraKey = { path, pub: base58.encode(ed25519.getPublicKey(k)) };
    if (withPrivate) out.priv = toHex(k);
    k.fill(0);
    return out;
  }
  if (chain === "XMR") {
    const k = moneroAccountKey(seed, account);
    return withPrivate ? { path, pub: k.address, priv: k.spend } : { path, pub: k.address };
  }
  if (chain === "ADA") {
    let k: { pub: string; priv: string };
    try {
      k = cardanoAccountKey(mnemonic, passphrase, account);
    } catch {
      throw new Error("Couldn't make the Cardano key for this wallet's recovery phrase.");
    }
    return withPrivate ? { path, pub: k.pub, priv: k.priv } : { path, pub: k.pub };
  }
  const node = bip32.fromSeed(seed).derivePath(path);
  const out: ExtraKey = { path, pub: node.neutered().toBase58() };
  if (withPrivate) out.priv = node.toBase58();
  return out;
}