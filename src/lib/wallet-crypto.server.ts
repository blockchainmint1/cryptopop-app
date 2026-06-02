// Server-only envelope encryption for sandbox POP wallet seeds.
// AES-256-GCM with a per-user random salt + iv. The master key (WALLET_KMS_KEY)
// lives in Lovable Cloud secrets, NEVER in the DB. A DB dump alone leaks
// nothing useful.
//
// POP is non-monetary reward points; the wallet is a sandbox wallet. This
// gives a sensible safety net without pretending to be a custodial bank.

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALGO = "aes-256-gcm";
const KEY_LEN = 32;
const IV_LEN = 12;
const SALT_LEN = 16;

function getMasterKey(): Buffer {
  const raw = process.env.WALLET_KMS_KEY;
  if (!raw || raw.length < 16) {
    throw new Error("WALLET_KMS_KEY not configured");
  }
  return Buffer.from(raw, "utf8");
}

function deriveKey(salt: Buffer): Buffer {
  return scryptSync(getMasterKey(), salt, KEY_LEN);
}

export type EncryptedBlob = {
  ciphertext: string; // base64 (cipher + 16-byte auth tag appended)
  iv: string;         // base64
  salt: string;       // base64
  version: number;
};

export function encryptSeed(plaintext: string): EncryptedBlob {
  const salt = randomBytes(SALT_LEN);
  const iv = randomBytes(IV_LEN);
  const key = deriveKey(salt);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: Buffer.concat([enc, tag]).toString("base64"),
    iv: iv.toString("base64"),
    salt: salt.toString("base64"),
    version: 1,
  };
}

export function decryptSeed(blob: EncryptedBlob): string {
  const salt = Buffer.from(blob.salt, "base64");
  const iv = Buffer.from(blob.iv, "base64");
  const buf = Buffer.from(blob.ciphertext, "base64");
  const tag = buf.subarray(buf.length - 16);
  const enc = buf.subarray(0, buf.length - 16);
  const key = deriveKey(salt);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString("utf8");
}
