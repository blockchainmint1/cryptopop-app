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
 *
 * Fail closed: turning this on also writes an "approval required" flag inside
 * the password-encrypted vault. If that flag is set and the passkey copy is
 * missing or out of date, payments ask for the password instead of passing.
 */
import {
  clearPasskeyRecord,
  isValidMnemonic,
  loadVault,
  normalizeMnemonic,
  PASSKEY_KEY,
  setVaultApproval,
  signalForgottenPasskey,
  type VaultPayload,
} from "./vault";

const enc = new TextEncoder();
const dec = new TextDecoder();
const HKDF_INFO = enc.encode("cryptopop-wallet-passkey-unlock-v1");

export const PASSKEY_UNSUPPORTED =
  "This phone can't use Face ID / fingerprint for the web app yet. Keep using your password.";

export interface PasskeyRecord {
  /** 1 = older test setups (zero HKDF salt); 2 = HKDF salt bound to credId. */
  v: 1 | 2;
  credId: string;
  rpId: string;
  salt: string;
  iv: string;
  ct: string;
  /** SHA-256 of the password vault ciphertext this copy belongs to. */
  vaultTag: string;
  createdAt: number;
  /** How the phone said it reaches this passkey (hint only; never "hybrid"). */
  transports?: string[];
}

/** Half-finished setup is dropped after this long, so the password isn't kept. */
export const PENDING_SETUP_MS = 2 * 60_000;

const KNOWN_TRANSPORTS = new Set(["internal", "usb", "nfc", "ble", "smart-card"]);

/**
 * Transport hint for allowCredentials. Dropping "hybrid" keeps desktop Chrome
 * from offering the cross-device QR flow for a passkey that lives on this
 * device; keeping what the phone reported (instead of forcing "internal")
 * keeps third-party password managers such as 1Password working.
 */
export function passkeyTransports(reported: readonly string[] | undefined | null): AuthenticatorTransport[] {
  const list = (reported ?? []).filter((t) => KNOWN_TRANSPORTS.has(t));
  return (list.length ? list : ["internal"]) as AuthenticatorTransport[];
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

/** Constant-length byte comparison (no early exit). */
export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false;
  let diff = 0;
  for (let i = 0; i < a.byteLength; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** WebAuthn authenticator data: byte 32 holds the flags; 0x04 = user verified. */
export function userVerified(authData: Uint8Array): boolean {
  return authData.byteLength >= 37 && (authData[32] & 0x04) !== 0;
}

/**
 * Checks on a passkey answer: it must be the exact enrolled passkey and the
 * phone must report that the face / fingerprint check really happened.
 */
export function checkAssertion(rawId: Uint8Array, authData: Uint8Array, credId: string): void {
  if (!bytesEqual(rawId, b64urlDecode(credId))) throw new Error("A different passkey answered. Use your password.");
  if (!userVerified(authData)) throw new Error("The phone didn't confirm your face or fingerprint. Use your password.");
}

async function keyFromPrf(prf: Uint8Array, r: Pick<PasskeyRecord, "v" | "credId">): Promise<CryptoKey> {
  if (prf.byteLength !== 32) throw new Error("Passkey secret has the wrong size");
  const base = await crypto.subtle.importKey("raw", toAB(prf), "HKDF", false, ["deriveKey"]);
  // v2 binds the derived key to the passkey id; v1 (older test setups) used a zero salt.
  const salt = r.v === 2 ? toAB(enc.encode(r.credId)) : new ArrayBuffer(32);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt, info: toAB(HKDF_INFO) },
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
  meta: { credId: string; rpId: string; salt: string; vaultTag: string; transports?: string[] },
): Promise<PasskeyRecord> {
  if (!isValidMnemonic(payload.mnemonic)) throw new Error("Wallet phrase isn't valid");
  const { transports, ...rest } = meta;
  const base = { v: 2 as const, ...rest };
  const iv = rand(12);
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toAB(iv), additionalData: aad(base) },
    await keyFromPrf(prf, base),
    toAB(
      enc.encode(
        JSON.stringify({
          mnemonic: payload.mnemonic,
          origin: payload.origin,
          createdAt: payload.createdAt,
          ...(payload.approval ? { approval: payload.approval } : {}),
        }),
      ),
    ),
  );
  return {
    ...base,
    iv: b64url(iv),
    ct: b64url(ct),
    createdAt: Date.now(),
    ...(transports ? { transports: passkeyTransports(transports) } : {}),
  };
}

/** Decrypt a passkey copy. Throws on a wrong secret or any tampering. */
export async function openPayload(prf: Uint8Array, rec: PasskeyRecord): Promise<VaultPayload> {
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toAB(b64urlDecode(rec.iv)), additionalData: aad(rec) },
    await keyFromPrf(prf, rec),
    toAB(b64urlDecode(rec.ct)),
  );
  const p = JSON.parse(dec.decode(pt)) as VaultPayload;
  if (typeof p?.mnemonic !== "string" || !isValidMnemonic(p.mnemonic)) throw new Error("Bad wallet copy");
  return {
    mnemonic: normalizeMnemonic(p.mnemonic),
    origin: p.origin,
    createdAt: p.createdAt,
    ...(p.approval === "passkey" ? { approval: "passkey" as const } : {}),
  };
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
    if ((r?.v !== 1 && r?.v !== 2) || !r.credId || !r.rpId || !r.salt || !r.iv || !r.ct || !r.vaultTag) return null;
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
  signalForgottenPasskey(rpId, credId);
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

async function evalPrf(credId: string, rpId: string, salt: string, transports?: string[]): Promise<Uint8Array | null> {
  const cred = (await navigator.credentials.get({
    publicKey: {
      challenge: toAB(rand(32)),
      rpId,
      allowCredentials: [{ type: "public-key", id: toAB(b64urlDecode(credId)), transports: passkeyTransports(transports) }],
      userVerification: "required",
      timeout: 60_000,
      extensions: { prf: { eval: { first: toAB(b64urlDecode(salt)) } } } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null;
  if (!cred) return null;
  const authData = new Uint8Array((cred.response as AuthenticatorAssertionResponse).authenticatorData);
  checkAssertion(new Uint8Array(cred.rawId), authData, credId);
  const prf = prfFirst(cred);
  if (prf && prf.byteLength !== 32) throw new Error("Passkey secret has the wrong size");
  return prf;
}

let pending: {
  credId: string;
  rpId: string;
  salt: string;
  transports: string[];
  payload: VaultPayload;
  password: string;
} | null = null;
let pendingTimer: ReturnType<typeof setTimeout> | null = null;

function clearPendingTimer() {
  if (pendingTimer) clearTimeout(pendingTimer);
  pendingTimer = null;
}

/** Drop a half-made setup: forget the passkey, write nothing, drop the password. */
function abandonPending() {
  clearPendingTimer();
  if (pending) forgetCredential(pending.rpId, pending.credId);
  pending = null;
}

/** True while a setup is waiting for its second tap (password held in memory). */
export function hasPendingPasskeySetup(): boolean {
  return pending !== null;
}

async function savePending(prf: Uint8Array) {
  if (!pending) throw new Error("Start Face ID / fingerprint setup again.");
  const p = pending;
  // 1) Set the "approval required" flag inside the password vault (new ciphertext).
  const { payload, ct } = await setVaultApproval(p.password, "passkey");
  try {
    if (!sameWallet(payload, p.payload.mnemonic)) throw new Error("Setup check failed. Try again.");
    const tag = await vaultTagOf(ct);
    const rec = await sealPayload(prf, payload, { credId: p.credId, rpId: p.rpId, salt: p.salt, vaultTag: tag, transports: p.transports });
    // Round-trip check before trusting the copy.
    const back = await openPayload(prf, rec);
    if (!sameWallet(back, p.payload.mnemonic) || back.approval !== "passkey") throw new Error("Setup check failed. Try again.");
    localStorage.setItem(PASSKEY_KEY, JSON.stringify(rec));
  } catch (e) {
    // Undo the flag so a failed setup doesn't leave payments asking for the password.
    await setVaultApproval(p.password, null).catch(() => undefined);
    throw e;
  }
  clearPendingTimer();
  pending = null;
}

/**
 * Step 1 of setup: create the passkey. Returns "needs-tap" when the phone wants
 * a second, separate tap to finish (call finishPasskeyEnroll from a button).
 * The password is held in memory only until setup finishes or is cancelled,
 * to write the "approval required" flag into the password vault.
 */
export async function startPasskeyEnroll(payload: VaultPayload, password: string, label: string): Promise<"done" | "needs-tap"> {
  abandonPending();
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
  const att = cred.response as AuthenticatorAttestationResponse & {
    getAuthenticatorData?: () => ArrayBuffer;
    getTransports?: () => string[];
  };
  let reported: string[] = [];
  try {
    reported = att.getTransports?.() ?? [];
  } catch {
    /* older browsers */
  }
  const transports = passkeyTransports(reported);
  pending = { credId, rpId, salt, transports, payload, password };
  // Never keep the password around for an abandoned second tap.
  clearPendingTimer();
  pendingTimer = setTimeout(abandonPending, PENDING_SETUP_MS);
  try {
    const authData = att.getAuthenticatorData?.();
    if (authData && !userVerified(new Uint8Array(authData))) {
      throw new Error("The phone didn't confirm your face or fingerprint. Try again.");
    }
    const ext = cred.getClientExtensionResults() as PrfOutputs;
    if (ext.prf?.enabled === false) throw new Error(PASSKEY_UNSUPPORTED);
    const first = prfFirst(cred);
    if (first) {
      if (first.byteLength !== 32) throw new Error(PASSKEY_UNSUPPORTED);
      await savePending(first);
      return "done";
    }
    const prf = await evalPrf(credId, rpId, salt, transports);
    if (!prf) throw new Error(PASSKEY_UNSUPPORTED);
    await savePending(prf);
    return "done";
  } catch (e) {
    // The person can still finish with a second tap if only the prompt was dismissed.
    if (isCancel(e) && pending) return "needs-tap";
    abandonPending();
    throw e;
  }
}

/** Step 2 of setup (only when step 1 returned "needs-tap"). */
export async function finishPasskeyEnroll(): Promise<void> {
  if (!pending) throw new Error("Start Face ID / fingerprint setup again.");
  try {
    const prf = await evalPrf(pending.credId, pending.rpId, pending.salt, pending.transports);
    if (!prf) throw new Error(PASSKEY_UNSUPPORTED);
    await savePending(prf);
  } catch (e) {
    abandonPending();
    throw e;
  }
}

export function cancelPasskeyEnroll() {
  abandonPending();
}

/** Unlock with face / fingerprint. Null when the person cancels. */
export async function unlockWithPasskey(): Promise<VaultPayload | null> {
  const rec = loadPasskeyRecord();
  if (!rec) return null;
  let prf: Uint8Array | null;
  try {
    prf = await evalPrf(rec.credId, rec.rpId, rec.salt, rec.transports);
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

/* --------------------------- payment approval ---------------------------- */

export interface ApprovalDeps {
  /** "approval required" flag from the unlocked (password-decrypted) wallet. */
  required: boolean;
  unlockedMnemonic: string;
  record: PasskeyRecord | null;
  /** Face ID / fingerprint prompt. Throws NotAllowedError when cancelled. */
  passkey: (rec: PasskeyRecord) => Promise<Uint8Array | null>;
  currentTag: () => Promise<string | null>;
  askPassword: () => Promise<string | null>;
  checkPassword: (password: string) => Promise<VaultPayload | null>;
}

/**
 * The approval rule (pure, unit-tested):
 *  - passkey copy present → face / fingerprint prompt first (keeps the tap);
 *    cancelled → refused; copy broken, out of date or unreadable → password.
 *  - no copy but the vault says approval is required → password.
 *  - no copy and not required → allowed (Face ID never turned on).
 * The opened wallet must always be the one about to sign.
 */
export async function runApproval(d: ApprovalDeps): Promise<boolean> {
  const viaPassword = async () => {
    const pw = await d.askPassword();
    if (!pw) return false;
    const p = await d.checkPassword(pw);
    return !!p && sameWallet(p, d.unlockedMnemonic);
  };
  if (!d.record) return d.required ? viaPassword() : true;
  let prf: Uint8Array | null;
  try {
    prf = await d.passkey(d.record);
  } catch (e) {
    if (isCancel(e)) return false;
    return viaPassword();
  }
  if (!prf) return viaPassword();
  if ((await d.currentTag()) !== d.record.vaultTag) return viaPassword();
  let opened: VaultPayload;
  try {
    opened = await openPayload(prf, d.record);
  } catch {
    return viaPassword();
  }
  return sameWallet(opened, d.unlockedMnemonic);
}

/**
 * Fresh face / fingerprint check before a payment or sensitive change.
 * Call first in the tap handler: the passkey prompt is the first await.
 */
export async function passkeyApprove(
  unlocked: Pick<VaultPayload, "mnemonic" | "approval">,
  io: { askPassword: () => Promise<string | null>; checkPassword: (pw: string) => Promise<VaultPayload | null> },
): Promise<boolean> {
  return runApproval({
    required: unlocked.approval === "passkey",
    unlockedMnemonic: unlocked.mnemonic,
    record: loadPasskeyRecord(),
    passkey: (rec) => evalPrf(rec.credId, rec.rpId, rec.salt, rec.transports),
    currentTag: currentVaultTag,
    askPassword: io.askPassword,
    checkPassword: io.checkPassword,
  });
}

/** Removes the passkey copy and tells the phone to drop the passkey. */
export function disablePasskeyUnlock(): void {
  clearPasskeyRecord();
}
