// Shared (client + server) types for merchant & community rewards.
// 1 reward = $1 off. Rewards never expire. Redemption must cover the full bill.

export type RewardKind = "store" | "community";

export type RewardBalance = {
  kind: RewardKind;
  /** program id for store rewards, market slug for community rewards */
  key: string;
  label: string;
  logoUrl: string | null;
  amount: number;
};

export type InvoiceRewardOptions = {
  programId: string;
  storeName: string;
  ratePct: number;
  issueType: RewardKind;
  /** Store rewards the customer holds at this store */
  storeBalance: number;
  /** Community rewards the customer holds in this store's market (0 if store isn't approved) */
  communityBalance: number;
  acceptsCommunity: boolean;
};

export function roundCents(n: number) {
  return Math.floor(n * 100 + 1e-6) / 100;
}

export function redeemMessage(invoiceId: string, kind: RewardKind, amount: number) {
  return [
    "CryptoPOP rewards redeem",
    `Invoice: ${invoiceId}`,
    `Kind: ${kind}`,
    `Amount: ${amount.toFixed(2)}`,
  ].join("\n");
}
