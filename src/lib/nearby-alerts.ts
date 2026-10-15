/** Phone-only settings for "You're near" alerts. Location never leaves the phone. */
export const NEARBY_KEY = "cp-nearby-alerts";
export const NEARBY_RADIUS_M = 150;
const SEEN_KEY = "cp-nearby-seen";
const STORE_COOLDOWN_MS = 4 * 3600_000;
const DAILY_CAP = 3;

export function nearbyEnabled(): boolean {
  try {
    return localStorage.getItem(NEARBY_KEY) === "on";
  } catch {
    return false;
  }
}

export function setNearbyEnabled(on: boolean) {
  try {
    localStorage.setItem(NEARBY_KEY, on ? "on" : "off");
    window.dispatchEvent(new Event("cp-nearby-changed"));
  } catch {
    /* ignore */
  }
}

export function distanceM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const toR = (d: number) => (d * Math.PI) / 180;
  const dLat = toR(bLat - aLat);
  const dLng = toR(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toR(aLat)) * Math.cos(toR(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

type Seen = Record<string, number>;
function readSeen(): Seen {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? "{}") as Seen;
  } catch {
    return {};
  }
}

/** True if we may alert for this store now (4h per store, 3 per day); records it when true. */
export function claimAlertSlot(storeId: string): boolean {
  const now = Date.now();
  const seen = readSeen();
  for (const k of Object.keys(seen)) if (now - seen[k]! > 24 * 3600_000) delete seen[k];
  if (seen[storeId] && now - seen[storeId]! < STORE_COOLDOWN_MS) return false;
  if (Object.keys(seen).length >= DAILY_CAP) return false;
  seen[storeId] = now;
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
  } catch {
    /* ignore */
  }
  return true;
}
