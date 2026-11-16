/**
 * Face ID / fingerprint unlock for the installed web app (no APK).
 *
 * Uses a WebAuthn passkey with the PRF extension. The phone's authenticator
 * produces a secret only after a successful face / fingerprint check; we turn
 * that secret into an AES-GCM key (HKDF-SHA256) and keep a second encrypted
 * copy of the vault payload in localStorage. No password and no plaintext key
 * material is ever stored, and nothing is sent to a server — the passkey's
 * secret never leaves the phone's secure hardware / password manager.
 *
 * The password vault stays the source of truth: any vault rewrite (password
 * change, new wallet, removal) deletes this copy, and an unlock whose copy no
 * longer matches the current vault is refused and switched off.
 */
import { clearPasskeyRecord, isValidMnemonic, loadVault, normalizeMnemonic, PASSKEY_KEY, type VaultPayload } from "./vault";

const enc = new TextEncoder();
const dec = new TextDecoder();
const HKDF_INFO = enc.encode("cryptopop-wallet-passkey-unlock-v1");

export const PASSKEY_UNSUPPORTED =
  "This phone can't use Face ID / fingerprint for the web app yet. Keep using your password.";

export interface PasskeyRecord {
  v: 1;
  credId: string;
  rpId: string;
  salt: string;
  iv: string;
  ct: string;
  /** SHA-256 of the password vault ciphertext this copy belongs to. */
  vaultTag: string;
  createdAt: number;
}

/* -------------------------------- encoding -------------------------------- */

function toAB(u: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(u.byteLength);
  new Uint8Array(out).set(u);
  return out;
}

export function b64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64urlDecode(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function rand(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n));
}

/* ------------------------- pure crypto (unit-tested) ------------------------ */

async function keyFromPrf(prf: Uint8Array): Promise<CryptoKey> {
  if (prf.byteLength < 32) throw new Error("Passkey secret too short");
  const base = await crypto.subtle.importKey("raw", toAB(prf), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: new ArrayBuffer(32), info: toAB(HKDF_INFO) },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function aad(r: Pick<PasskeyRecord, "v" | "credId" | "rpId" | "vaultTag">): ArrayBuffer {
  return toAB(enc.encode(`${r.v}|${r.credId}|${r.rpId}|${r.vaultTag}`));
}

export async function vaultTagOf(vaultCiphertext: string): Promise<string> {
  return b64url(await crypto.subtle.digest("SHA-256", toAB(enc.encode(vaultCiphertext))));
}

/** Encrypt the vault payload under the passkey's PRF secret. */
export async function sealPayload(
  prf: Uint8Array,
  payload: VaultPayload,
  meta: { credId: string; rpId: string; salt: string; vaultTag: string },
): Promise<PasskeyRecord> {
  if (!isValidMnemonic(payload.mnemonic)) throw new Error("Wallet phrase isn't valid");
  const base = { v: 1 as const, ...meta };
  const iv = rand(12);
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toAB(iv), additionalData: aad(base) },
    await keyFromPrf(prf),
    toAB(enc.encode(JSON.stringify({ mnemonic: payload.mnemonic, origin: payload.origin, createdAt: payload.createdAt }))),
  );
  return { ...base, iv: b64url(iv), ct: b64url(ct), createdAt: Date.now() };
}

/** Decrypt a passkey copy. Throws on a wrong secret or any tampering. */
export async function openPayload(prf: Uint8Array, rec: PasskeyRecord): Promise<VaultPayload> {
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toAB(b64urlDecode(rec.iv)), additionalData: aad(rec) },
    await keyFromPrf(prf),
    toAB(b64urlDecode(rec.ct)),
  );
  const p = JSON.parse(dec.decode(pt)) as VaultPayload;
  if (typeof p?.mnemonic !== "string" || !isValidMnemonic(p.mnemonic)) throw new Error("Bad wallet copy");
  return { mnemonic: normalizeMnemonic(p.mnemonic), origin: p.origin, createdAt: p.createdAt };
}

/** Payment approval rule: the passkey copy must hold exactly the unlocked wallet. */
export function sameWallet(opened: VaultPayload, unlockedMnemonic: string): boolean {
  return normalizeMnemonic(opened.mnemonic) === normalizeMnemonic(unlockedMnemonic);
}

/* --------------------------------- storage -------------------------------- */

export function loadPasskeyRecord(): PasskeyRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PASSKEY_KEY);
    if (!raw) return null;
    const r = JSON.parse(raw) as PasskeyRecord;
    if (r?.v !== 1 || !r.credId || !r.rpId || !r.salt || !r.iv || !r.ct || !r.vaultTag) return null;
    return r;
  } catch {
    return null;
  }
}

export function hasPasskeyUnlock(): boolean {
  return loadPasskeyRecord() !== null;
}

async function currentVaultTag(): Promise<string | null> {
  const v = loadVault();
  return v ? vaultTagOf(v.blob.ct) : null;
}

/* -------------------------------- WebAuthn -------------------------------- */

interface PrfOutputs {
  prf?: { enabled?: boolean; results?: { first?: ArrayBuffer | Uint8Array } };
}

function prfFirst(cred: PublicKeyCredential): Uint8Array | null {
  const ext = cred.getClientExtensionResults() as PrfOutputs;
  const first = ext.prf?.results?.first;
  return first ? new Uint8Array(first instanceof Uint8Array ? first : new Uint8Array(first)) : null;
}

function isCancel(e: unknown): boolean {
  const n = (e as { name?: string })?.name;
  return n === "NotAllowedError" || n === "AbortError";
}

/** Best effort: tell the phone's password manager to hide a passkey we no longer use. */
function forgetCredential(rpId: string, credId: string) {
  try {
    const pkc = PublicKeyCredential as unknown as {
      signalUnknownCredential?: (o: { rpId: string; credentialId: string }) => Promise<void>;
    };
    void pkc.signalUnknownCredential?.({ rpId, credentialId: credId })?.catch(() => undefined);
  } catch {
    /* unsupported */
  }
}

/** Can this browser offer passkey unlock? (Final PRF support is confirmed at setup.) */
export async function passkeySupported(): Promise<boolean> {
  if (typeof window === "undefined" || !window.isSecureContext || !("PublicKeyCredential" in window)) return false;
  try {
    const caps = await (
      PublicKeyCredential as unknown as { getClientCapabilities?: () => Promise<Record<string, boolean>> }
    ).getClientCapabilities?.();
    if (caps && caps["extension:prf"] === false) return false;
  } catch {
    /* older browsers: decide at setup */
  }
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

async function evalPrf(credId: string, rpId: string, salt: string): Promise<Uint8Array | null> {
  const cred = (await navigator.credentials.get({
    publicKey: {
      challenge: toAB(rand(32)),
      rpId,
      allowCredentials: [{ type: "public-key", id: toAB(b64urlDecode(credId)) }],
      userVerification: "required",
      timeout: 60_000,
      extensions: { prf: { eval: { first: toAB(b64urlDecode(salt)) } } } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null;
  if (!cred) return null;
  if (b64url(cred.rawId) !== credId) throw new Error("A different passkey answered. Use your password.");
  return prfFirst(cred);
}

let pending: { credId: string; rpId: string; salt: string; payload: VaultPayload } | null = null;

async function savePending(prf: Uint8Array) {
  if (!pending) throw new Error("Start Face ID / fingerprint setup again.");
  const tag = await currentVaultTag();
  if (!tag) throw new Error("No wallet on this phone.");
  const rec = await sealPayload(prf, pending.payload, { credId: pending.credId, rpId: pending.rpId, salt: pending.salt, vaultTag: tag });
  // Round-trip check before trusting the copy.
  const back = await openPayload(prf, rec);
  if (!sameWallet(back, pending.payload.mnemonic)) throw new Error("Setup check failed. Try again.");
  localStorage.setItem(PASSKEY_KEY, JSON.stringify(rec));
  pending = null;
}

/**
 * Step 1 of setup: create the passkey. Returns "needs-tap" when the phone wants
 * a second, separate tap to finish (call finishPasskeyEnroll from a button).
 */
export async function startPasskeyEnroll(payload: VaultPayload, label: string): Promise<"done" | "needs-tap"> {
  const rpId = window.location.hostname;
  const salt = b64url(rand(32));
  const cred = (await navigator.credentials.create({
    publicKey: {
      rp: { id: rpId, name: "POP Wallet" },
      user: { id: toAB(rand(16)), name: label, displayName: label },
      challenge: toAB(rand(32)),
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        residentKey: "required",
        requireResidentKey: true,
        userVerification: "required",
      },
      attestation: "none",
      timeout: 60_000,
      extensions: { prf: { eval: { first: toAB(b64urlDecode(salt)) } } } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error("Setup was cancelled.");
  const credId = b64url(cred.rawId);
  const ext = cred.getClientExtensionResults() as PrfOutputs;
  if (ext.prf?.enabled === false) {
    forgetCredential(rpId, credId);
    throw new Error(PASSKEY_UNSUPPORTED);
  }
  pending = { credId, rpId, salt, payload };
  const first = prfFirst(cred);
  if (first) {
    await savePending(first);
    return "done";
  }
  try {
    await finishPasskeyEnroll();
    return "done";
  } catch (e) {
    if (isCancel(e)) return "needs-tap";
    throw e;
  }
}

/** Step 2 of setup (only when step 1 returned "needs-tap"). */
export async function finishPasskeyEnroll(): Promise<void> {
  if (!pending) throw new Error("Start Face ID / fingerprint setup again.");
  const prf = await evalPrf(pending.credId, pending.rpId, pending.salt);
  if (!prf) {
    forgetCredential(pending.rpId, pending.credId);
    pending = null;
    throw new Error(PASSKEY_UNSUPPORTED);
  }
  await savePending(prf);
}

export function cancelPasskeyEnroll() {
  if (pending) forgetCredential(pending.rpId, pending.credId);
  pending = null;
}

/** Unlock with face / fingerprint. Null when the person cancels. */
export async function unlockWithPasskey(): Promise<VaultPayload | null> {
  const rec = loadPasskeyRecord();
  if (!rec) return null;
  let prf: Uint8Array | null;
  try {
    prf = await evalPrf(rec.credId, rec.rpId, rec.salt);
  } catch (e) {
    if (isCancel(e)) return null;
    throw e;
  }
  if (!prf) throw new Error("Face ID / fingerprint unlock didn't work. Use your password.");
  if ((await currentVaultTag()) !== rec.vaultTag) {
    disablePasskeyUnlock();
    throw new Error("Your wallet password changed, so Face ID / fingerprint unlock was turned off. Use your password, then turn it on again in Settings.");
  }
  try {
    return await openPayload(prf, rec);
  } catch {
    throw new Error("Face ID / fingerprint unlock didn't work. Use your password.");
  }
}

/**
 * Fresh face / fingerprint check before a payment. True when passkey unlock
 * isn't turned on; otherwise the passkey's copy must open and match the
 * wallet that is about to sign.
 */
export async function passkeyApprove(unlockedMnemonic: string): Promise<boolean> {
  const rec = loadPasskeyRecord();
  if (!rec) return true;
  try {
    const prf = await evalPrf(rec.credId, rec.rpId, rec.salt);
    if (!prf) return false;
    if ((await currentVaultTag()) !== rec.vaultTag) return false;
    return sameWallet(await openPayload(prf, rec), unlockedMnemonic);
  } catch {
    return false;
  }
}

export function disablePasskeyUnlock(): void {
  const rec = loadPasskeyRecord();
  clearPasskeyRecord();
  if (rec) forgetCredential(rec.rpId, rec.credId);
}
