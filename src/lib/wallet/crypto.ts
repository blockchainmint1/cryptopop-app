// AES-GCM vault encryption with a PBKDF2-derived key. Browser-only.
const enc = new TextEncoder();
const dec = new TextDecoder();

const PBKDF2_ITERATIONS = 600_000;

function b64encode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// WebCrypto wants a real ArrayBuffer, not the broader ArrayBufferLike.
function toAB(u: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(u.byteLength);
  new Uint8Array(out).set(u);
  return out;
}

async function deriveKey(password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: toAB(salt), iterations, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export interface EncryptedBlob {
  v: 1;
  salt: string;
  iv: string;
  ct: string;
  it: number;
}

export async function encryptJson(data: unknown, password: string): Promise<EncryptedBlob> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, PBKDF2_ITERATIONS);
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toAB(iv) },
    key,
    toAB(enc.encode(JSON.stringify(data))),
  );
  return {
    v: 1,
    salt: b64encode(salt),
    iv: b64encode(iv),
    ct: b64encode(ct),
    it: PBKDF2_ITERATIONS,
  };
}

export async function decryptJson<T>(blob: EncryptedBlob, password: string): Promise<T> {
  const key = await deriveKey(password, b64decode(blob.salt), blob.it ?? PBKDF2_ITERATIONS);
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toAB(b64decode(blob.iv)) },
    key,
    toAB(b64decode(blob.ct)),
  );
  return JSON.parse(dec.decode(pt)) as T;
}
