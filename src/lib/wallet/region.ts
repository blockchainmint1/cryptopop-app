import { REGIONS, type RegionId } from "@/lib/wallet/assets";

const REGION_KEY = "cryptopop.wallet.region";

export function loadRegion(): RegionId {
  if (typeof window === "undefined") return "tx";
  try {
    const raw = window.localStorage.getItem(REGION_KEY);
    return REGIONS.some((r) => r.id === raw) ? (raw as RegionId) : "tx";
  } catch {
    return "tx";
  }
}

export function saveRegion(id: RegionId) {
  try {
    window.localStorage.setItem(REGION_KEY, id);
  } catch {
    /* ignore */
  }
}
