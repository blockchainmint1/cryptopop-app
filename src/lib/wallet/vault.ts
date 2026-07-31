/**
 * Non-custodial CryptoPOP wallet vault.
 *
 * A single BIP39 mnemonic is encrypted with the user's device password
 * (PBKDF2-SHA256 → AES-GCM) and stored in localStorage. The plaintext
 * mnemonic only ever lives in memory (plus a short-lived sessionStorage cache
 * so a page reload doesn't force a re-unlock). Nothing leaves the device.
 */
import { generateMnemonic, validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { encryptJson, decryptJson, type EncryptedBlob } from "./crypto";

const VAULT_KEY = "cryptopop.wallet.vault.v1";
const SESSION_KEY = "cryptopop.wallet.session.v1";
const BACKUP_KEY = "cryptopop.wallet.backed-up.v1";
/** Legacy custodial-era mnemonic key — migrated in on first load. */
const LEGACY_MNEMONIC_KEY = "cryptopop:mnemonic";

/** Idle time before the wallet auto-locks. */
export const AUTO_LOCK_MS = 5 * 60 * 1000;

export type VaultOrigin = "coin" | "generated" | "imported";

export interface VaultMeta {
  origin: VaultOrigin;
  createdAt: number;
}

export interface VaultPayload extends VaultMeta {
  mnemonic: string;
}

interface StoredVault {
  blob: EncryptedBlob;
  meta: VaultMeta;
}

export function loadVault(): StoredVault | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(VAULT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredVault;
    return parsed?.blob?.ct ? parsed : null;
  } catch {
    return null;
  }
}

export function hasVault(): boolean {
  return loadVault() !== null;
}

export function vaultMeta(): VaultMeta | null {
  return loadVault()?.meta ?? null;
}

export function deleteVault(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(VAULT_KEY);
  localStorage.removeItem(BACKUP_KEY);
  localStorage.removeItem(LEGACY_MNEMONIC_KEY);
  clearSession();
}

/** True when a pre-vault plaintext mnemonic is still sitting in localStorage. */
export function legacyMnemonic(): string | null {
  if (typeof window === "undefined") return null;
  const m = localStorage.getItem(LEGACY_MNEMONIC_KEY);
  return m && isValidMnemonic(m) ? m : null;
}

export function createMnemonic(strength: 128 | 256 = 128): string {
  return generateMnemonic(wordlist, strength);
}

export function normalizeMnemonic(m: string): string {
  return m.trim().toLowerCase().replace(/\s+/g, " ");
}

export function isValidMnemonic(m: string): boolean {
  return validateMnemonic(normalizeMnemonic(m), wordlist);
}

export async function createVault(
  mnemonic: string,
  password: string,
  origin: VaultOrigin,
): Promise<VaultPayload> {
  const normalized = normalizeMnemonic(mnemonic);
  if (!isValidMnemonic(normalized)) throw new Error("That recovery phrase isn't valid.");
  if (password.length < 8) throw new Error("Password must be at least 8 characters.");
  const payload: VaultPayload = { mnemonic: normalized, origin, createdAt: Date.now() };
  const blob = await encryptJson(payload, password);
  localStorage.setItem(
    VAULT_KEY,
    JSON.stringify({ blob, meta: { origin, createdAt: payload.createdAt } } satisfies StoredVault),
  );
  localStorage.removeItem(LEGACY_MNEMONIC_KEY);
  // A coin-backed wallet is backed up by definition — the coin IS the backup.
  if (origin === "coin") markBackedUp();
  cacheSession(payload);
  return payload;
}

export async function unlockVault(password: string): Promise<VaultPayload | null> {
  const stored = loadVault();
  if (!stored) return null;
  try {
    const payload = await decryptJson<VaultPayload>(stored.blob, password);
    cacheSession(payload);
    return payload;
  } catch {
    return null;
  }
}

/** Re-encrypt the vault under a new password. */
export async function changeVaultPassword(current: string, next: string): Promise<void> {
  const payload = await unlockVault(current);
  if (!payload) throw new Error("Current password is wrong.");
  await createVault(payload.mnemonic, next, payload.origin);
}

/* ------------------------------ session cache ----------------------------- */

interface SessionEntry extends VaultPayload {
  touchedAt: number;
}

export function cacheSession(payload: VaultPayload): void {
  try {
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ ...payload, touchedAt: Date.now() } satisfies SessionEntry),
    );
  } catch {
    /* ignore */
  }
}

export function loadSession(): VaultPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw) as SessionEntry;
    if (!entry?.mnemonic || Date.now() - entry.touchedAt > AUTO_LOCK_MS) {
      clearSession();
      return null;
    }
    return { mnemonic: entry.mnemonic, origin: entry.origin, createdAt: entry.createdAt };
  } catch {
    return null;
  }
}

export function touchSession(): void {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return;
    const entry = JSON.parse(raw) as SessionEntry;
    entry.touchedAt = Date.now();
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(entry));
  } catch {
    /* ignore */
  }
}

export function clearSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

/* -------------------------------- backups -------------------------------- */

export function markBackedUp(): void {
  try {
    localStorage.setItem(BACKUP_KEY, new Date().toISOString());
  } catch {
    /* ignore */
  }
}

export function isBackedUp(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(BACKUP_KEY) !== null;
}
