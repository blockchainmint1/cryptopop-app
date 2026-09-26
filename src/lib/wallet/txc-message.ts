/**
 * TEXITcoin message signing (Bitcoin-style "Signed Message" format).
 *
 * Pure JS — safe in the browser (signing with the on-device key) and on the
 * server (verifying). Compatible with NectarPay's wallet-signature verifier:
 * prefix "\x1aTEXITcoin Signed Message:\n", compact recoverable signature,
 * base64, P2PKH compressed key.
 */
import { secp256k1 } from "@noble/curves/secp256k1";
import { sha256 } from "@noble/hashes/sha256";
import { ripemd160 } from "@noble/hashes/ripemd160";
import { createBase58check, base64 } from "@scure/base";

const PREFIX = "\x1aTEXITcoin Signed Message:\n";
const TXC_P2PKH = 0x42;
const b58 = createBase58check(sha256);

function varInt(n: number): Uint8Array {
  if (n < 0xfd) return new Uint8Array([n]);
  const b = new Uint8Array(3);
  b[0] = 0xfd;
  new DataView(b.buffer).setUint16(1, n, true);
  return b;
}

export function txcMagicHash(message: string): Uint8Array {
  const enc = new TextEncoder();
  const p = enc.encode(PREFIX);
  const m = enc.encode(message);
  const len = varInt(m.length);
  const buf = new Uint8Array(p.length + len.length + m.length);
  buf.set(p, 0);
  buf.set(len, p.length);
  buf.set(m, p.length + len.length);
  return sha256(sha256(buf));
}

export function pubkeyToTxcAddress(pub: Uint8Array): string {
  const payload = new Uint8Array(21);
  payload[0] = TXC_P2PKH;
  payload.set(ripemd160(sha256(pub)), 1);
  return b58.encode(payload);
}

/** Sign with a 32-byte private key → base64 compact signature. */
export function signTxcMessage(privateKey: Uint8Array, message: string): string {
  const sig = secp256k1.sign(txcMagicHash(message), privateKey, { lowS: true });
  const out = new Uint8Array(65);
  out[0] = 27 + 4 + sig.recovery; // +4 = compressed pubkey
  out.set(sig.toCompactRawBytes(), 1);
  return base64.encode(out);
}

/** True when `signature` over `message` was made by `address`'s key. */
export function verifyTxcMessage(address: string, message: string, signature: string): boolean {
  try {
    const bytes = base64.decode(signature.replace(/\s+/g, ""));
    if (bytes.length !== 65) return false;
    const flag = bytes[0] - 27;
    if (flag < 0 || flag > 7) return false;
    const recovery = flag & 3;
    const compressed = flag >= 4;
    const pub = secp256k1.Signature.fromCompact(bytes.slice(1))
      .addRecoveryBit(recovery)
      .recoverPublicKey(txcMagicHash(message))
      .toRawBytes(compressed);
    return pubkeyToTxcAddress(pub) === address;
  } catch {
    return false;
  }
}
