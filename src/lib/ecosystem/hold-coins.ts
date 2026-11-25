/**
 * Stellar (XLM), TON and Sui trading-pocket keys for Seeds ("accept-and-hold").
 *
 * All three are SLIP-0010 ed25519, hardened only:
 * - XLM m/44'/148'/N'        public half = Stellar strkey "G…" address (SEP-0005/0023)
 * - TON m/44'/607'/N'        public half = lowercase hex 32-byte key (W5 v5R1 address in tests)
 * - SUI m/44'/784'/N'/0'/0'  public half = "0x" + lowercase hex blake2b-256(0x00 ‖ pub)
 * Private half for all three: lowercase hex 32-byte SLIP-0010 key.
 */
import { blake2b } from "@noble/hashes/blake2b";
import { sha256 } from "@noble/hashes/sha256";
import { base32nopad, base64urlnopad, hex } from "@scure/base";

/** Live on Seeds as of Nov 25 2026 (matches HME Wallet). */
export const SEEDS_HOLD_COINS_LIVE = true;

export const HOLD_CHAINS = ["XLM", "TON", "SUI"] as const;
export type HoldChain = (typeof HOLD_CHAINS)[number];

export const HOLD_FORMAT: Record<HoldChain, string> = {
  XLM: "slip10-ed25519-stellar-g-address",
  TON: "slip10-ed25519-ton-w5-hex-pubkey",
  SUI: "slip10-ed25519-sui-0x-address",
};

export const HOLD_LABEL: Record<HoldChain, string> = { XLM: "Stellar", TON: "TON", SUI: "Sui" };

export function isHoldChain(c: string): c is HoldChain {
  return (HOLD_CHAINS as readonly string[]).includes(c);
}

export function holdAccountPath(chain: HoldChain, account: number): string {
  if (chain === "XLM") return `m/44'/148'/${account}'`;
  if (chain === "TON") return `m/44'/607'/${account}'`;
  return `m/44'/784'/${account}'/0'/0'`;
}

function crc16xmodem(b: Uint8Array): number {
  let crc = 0;
  for (const byte of b) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc;
}

function need32(pub: Uint8Array): void {
  if (pub.length !== 32) throw new Error("ed25519 public keys are 32 bytes");
}

export function xlmAddress(pub: Uint8Array): string {
  need32(pub);
  const body = new Uint8Array(33);
  body[0] = 6 << 3; // account id, "G"
  body.set(pub, 1);
  const crc = crc16xmodem(body);
  return base32nopad.encode(Uint8Array.of(...body, crc & 0xff, crc >> 8));
}

export function suiAddress(pub: Uint8Array): string {
  need32(pub);
  const data = new Uint8Array(33);
  data.set(pub, 1); // flag 0x00 = ed25519
  return "0x" + hex.encode(blake2b(data, { dkLen: 32 }));
}

const TON_W5_CODE_HASH = "20834b7b72b112147e1b2fb457b84e74d1a30f04f737d4f62a668e9552d2b72f";
const TON_W5_CODE_DEPTH = 6;
const TON_W5_WALLET_ID = 0x7fffff11;

function tonDataCellHash(pub: Uint8Array): Uint8Array {
  const bits: number[] = [1];
  const pushUint = (v: number, n: number) => {
    for (let i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1);
  };
  pushUint(0, 32);
  pushUint(TON_W5_WALLET_ID, 32);
  for (const byte of pub) pushUint(byte, 8);
  bits.push(0);
  const padded = [...bits, 1];
  while (padded.length % 8) padded.push(0);
  const data = new Uint8Array(padded.length / 8);
  padded.forEach((b, i) => {
    if (b) data[i >> 3]! |= 0x80 >> (i & 7);
  });
  const d2 = Math.floor(bits.length / 8) + Math.ceil(bits.length / 8);
  return sha256(Uint8Array.of(0, d2, ...data));
}

/** TON W5 user-friendly, non-bounceable, mainnet, workchain 0 address (UQ…). */
export function tonAddress(pub: Uint8Array): string {
  need32(pub);
  const repr = new Uint8Array(71);
  repr.set([2, 1, 0x34, 0, TON_W5_CODE_DEPTH, 0, 0]);
  repr.set(hex.decode(TON_W5_CODE_HASH), 7);
  repr.set(tonDataCellHash(pub), 39);
  const body = new Uint8Array(34);
  body[0] = 0x51;
  body[1] = 0x00;
  body.set(sha256(repr), 2);
  const crc = crc16xmodem(body);
  return base64urlnopad.encode(Uint8Array.of(...body, crc >> 8, crc & 0xff));
}

/** The public half Seeds expects for each hold coin. */
export function holdPublicHalf(chain: HoldChain, pub: Uint8Array): string {
  if (chain === "XLM") return xlmAddress(pub);
  if (chain === "TON") {
    need32(pub);
    return hex.encode(pub);
  }
  return suiAddress(pub);
}