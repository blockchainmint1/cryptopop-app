/**
 * Wallet asset registry (client-safe).
 *
 * TSD — Texas Stable Dollar — is the native spend asset on the TEXITcoin
 * chain (Omni layer 2). POP is the loyalty/reward token, TXC is the base coin
 * that pays network fees.
 */
export const ASSETS = [
  { id: "tsd", name: "TSD", label: "Texas Stable Dollar", network: "TEXITcoin · Omni", decimals: 2 },
  { id: "pop", name: "POP", label: "CryptoPOP", network: "TEXITcoin · Omni", decimals: 0 },
  { id: "txc", name: "TXC", label: "TEXITcoin", network: "TEXITcoin", decimals: 8 },
] as const;

export type AssetId = (typeof ASSETS)[number]["id"];

export const ASSET_IDS = ASSETS.map((a) => a.id) as readonly AssetId[];

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
  if (v === "texas stable dollar" || v === "usd" || v === "$") return "tsd";
  return isAssetId(v) ? (v as AssetId) : null;
}
