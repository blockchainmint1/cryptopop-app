import type { AssetId } from "@/lib/wallet/assets";

const HIDDEN_KEY = "cryptopop.wallet.hiddenChains";

export function loadHiddenChains(): AssetId[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HIDDEN_KEY);
    return raw ? (JSON.parse(raw) as AssetId[]) : [];
  } catch {
    return [];
  }
}

export function saveHiddenChains(v: AssetId[]) {
  try {
    window.localStorage.setItem(HIDDEN_KEY, JSON.stringify(v));
  } catch {
    /* ignore */
  }
}

export function toggleHiddenChain(current: AssetId[], id: AssetId): AssetId[] {
  const next = current.includes(id) ? current.filter((c) => c !== id) : [...current, id];
  saveHiddenChains(next);
  return next;
}
