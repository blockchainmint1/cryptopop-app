/**
 * Wallet asset registry (client-safe).
 *
 * TSD — Texas Stable Dollar — is the native spend asset on the TEXITcoin
 * chain (Omni layer 2). POP tokens are loyalty/reward points (one per POP
 * region), TXC is the base coin that pays network fees.
 */
export const ASSETS = [
  {
    id: "tsd",
    name: "TSD",
    label: "Texas Stable Dollar",
    chain: "TXC",
    network: "TEXITcoin · Omni",
    decimals: 2,
    omni: 39,
  },
  {
    id: "pop",
    name: "POP",
    label: "POP Points",
    chain: "TXC",
    network: "TEXITcoin · Omni",
    decimals: 0,
    omni: 37,
  },
  {
    id: "phpop",
    name: "phPOP",
    label: "POP Points (Philippines)",
    chain: "TXC",
    network: "TEXITcoin · Omni",
    decimals: 0,
    omni: 40,
  },
  {
    id: "txc",
    name: "TXC",
    label: "TEXITcoin",
    chain: "TXC",
    network: "TEXITcoin",
    decimals: 8,
    omni: null,
  },
] as const;

export type AssetId = (typeof ASSETS)[number]["id"];

export const ASSET_IDS = ASSETS.map((a) => a.id) as readonly AssetId[];

/** POP regions — each region shows its own points token. */
export const REGIONS = [
  { id: "tx", name: "Texas", assets: ["tsd", "pop", "txc"] },
  { id: "ph", name: "Philippines", assets: ["tsd", "phpop", "txc"] },
] as const;

export type RegionId = (typeof REGIONS)[number]["id"];

export function regionMeta(id: RegionId) {
  return REGIONS.find((r) => r.id === id) ?? REGIONS[0];
}

export function regionAssets(id: RegionId) {
  const ids = regionMeta(id).assets as readonly string[];
  return ASSETS.filter((a) => ids.includes(a.id));
}

export function isAssetId(v: string): v is AssetId {
  return (ASSET_IDS as readonly string[]).includes(v.toLowerCase());
}

export function assetMeta(id: AssetId) {
  return ASSETS.find((a) => a.id === id)!;
}

/** Normalise a symbol/ticker from a QR payload into an asset id. */
export function normalizeAsset(raw: string | null | undefined): AssetId | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (v === "texitcoin") return "txc";
  if (v === "cryptopop") return "pop";
  if (v === "phpop" || v === "pop ph") return "phpop";
  if (v === "texas stable dollar" || v === "usd" || v === "$") return "tsd";
  return isAssetId(v) ? (v as AssetId) : null;
}

/**
 * Omni property ids on TEXITcoin, as emitted by POS QR codes (`omni=39`).
 * The property id is authoritative — it beats a free-text ticker.
 */
export const OMNI_PROPERTY_IDS: Record<number, AssetId> = {
  39: "tsd",
  37: "pop",
  40: "phpop",
};

export function assetFromOmniId(raw: string | null | undefined): AssetId | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) ? (OMNI_PROPERTY_IDS[n] ?? null) : null;
}
