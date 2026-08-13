import { REGIONS, type RegionId } from "@/lib/wallet/assets";

const REGION_KEY = "cryptopop.wallet.region";

function isRegion(v: string | null): v is RegionId {
  return !!v && REGIONS.some((r) => r.id === v);
}

/**
 * Best-effort market guess from the device — no network, no permissions.
 * Uses the IANA time zone first, then the browser locale region.
 */
export function detectRegion(): RegionId {
  if (typeof window === "undefined") return "tx";
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
    if (/Manila|Philippines/i.test(tz)) return "ph";

    const locales = [
      ...(navigator.languages ?? []),
      navigator.language ?? "",
    ].filter(Boolean);
    for (const l of locales) {
      const country = l.split("-")[1]?.toUpperCase();
      if (country === "PH") return "ph";
    }

    // Anywhere in Asia that isn't otherwise mapped still gets the PH market,
    // since that's the only Asian POP market today.
    if (/^Asia\//.test(tz)) return "ph";
  } catch {
    /* ignore */
  }
  return "tx";
}

/** True once the user has explicitly picked a market in settings. */
export function hasStoredRegion(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return isRegion(window.localStorage.getItem(REGION_KEY));
  } catch {
    return false;
  }
}

export function loadRegion(): RegionId {
  if (typeof window === "undefined") return "tx";
  try {
    const raw = window.localStorage.getItem(REGION_KEY);
    if (isRegion(raw)) return raw;
  } catch {
    /* ignore */
  }
  return detectRegion();
}

export function saveRegion(id: RegionId) {
  try {
    window.localStorage.setItem(REGION_KEY, id);
  } catch {
    /* ignore */
  }
}
