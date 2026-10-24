/** Client helpers for Honest Money backup: approval redirect + payload packing. */
import type { EncryptedBlob } from "./crypto";
import type { VaultOrigin } from "./vault";

export type HmAction = "save" | "restore" | "delete";
const ACTION_KEY = "cryptopop.hmbackup.action";

export function startHmApproval(action: HmAction, returnPath: string) {
  try {
    sessionStorage.setItem(ACTION_KEY, action);
  } catch {
    /* ignore */
  }
  const returnTo = `${window.location.origin}${returnPath}`;
  window.location.href = `https://honest.money/backup-pass?action=${action}&return_to=${encodeURIComponent(returnTo)}`;
}

/** Reads (and strips) ?hm_backup_pass from the URL after the approval redirect. */
export function takeHmPass(): { pass: string; action: HmAction } | null {
  if (typeof window === "undefined") return null;
  const url = new URL(window.location.href);
  const fragment = new URLSearchParams(url.hash.slice(1));
  const pass = fragment.get("hm_backup_pass") ?? url.searchParams.get("hm_backup_pass");
  if (!pass) return null;
  url.searchParams.delete("hm_backup_pass");
  fragment.delete("hm_backup_pass");
  url.hash = fragment.toString();
  window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  let action: HmAction | null = null;
  try {
    action = sessionStorage.getItem(ACTION_KEY) as HmAction | null;
    sessionStorage.removeItem(ACTION_KEY);
  } catch {
    /* ignore */
  }
  return action ? { pass, action } : null;
}

export function peekHmAction(): HmAction | null {
  if (typeof window === "undefined") return null;
  const url = new URL(window.location.href);
  if (!url.searchParams.get("hm_backup_pass") && !new URLSearchParams(url.hash.slice(1)).get("hm_backup_pass")) return null;
  try {
    return sessionStorage.getItem(ACTION_KEY) as HmAction | null;
  } catch {
    return null;
  }
}

/** Strong-password rule for cloud backup: 12+ chars and 3 of 4 character types. */
export function passwordStrongEnough(pw: string): boolean {
  if (pw.length < 12) return false;
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  return kinds >= 3;
}

export function packBackup(blob: EncryptedBlob, origin: VaultOrigin): string {
  return btoa(JSON.stringify({ v: 1, origin, blob }));
}

export function unpackBackup(b64: string): { blob: EncryptedBlob; origin: VaultOrigin } {
  const parsed = JSON.parse(atob(b64));
  if (parsed?.v !== 1 || !parsed.blob) throw new Error("Unrecognised backup");
  return { blob: parsed.blob, origin: parsed.origin ?? "imported" };
}
