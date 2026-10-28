import { z } from "zod";

export const TSD_ORIGIN = "https://tsd.honest.money";
export const TOPUP_PROTOCOL = "tsd-topup-v1";
export const TOPUP_TTL_MS = 300_000;
export const TOPUP_REFRESH_MS = 30_000;
// Released Oct 28, 2026 after TSD confirmed the $10 min / $100,000 max for permanent deposit addresses.
export const TOPUP_DEPOSITS_ENABLED = true;

const uuid = z.string().uuid();
const receivingAddress = z.string().regex(/^T[1-9A-HJ-NP-Za-km-z]{25,34}$/);
const evmAddress = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const envelope = z.object({ protocol: z.literal(TOPUP_PROTOCOL), requestId: uuid });
const challengeSchema = envelope.extend({
  type: z.literal("tsd-topup-challenge"), origin: z.string().url().max(200),
  address: receivingAddress, challengeId: uuid, hmeMemberId: uuid,
  expiresAt: z.string().datetime(), message: z.string().max(2000),
});
export type TopupChallenge = z.infer<typeof challengeSchema>;
export type TopupRequest = { origin: string; address: string; requestId: string };

/** Exact UTF-8/LF message from TSD's topup-protocol.ts; no trailing newline. */
export function topupMessage(input: TopupRequest & { challengeId: string; hmeMemberId: string; expiresAt: string }): string {
  return [
    "Texas Stable Dollar — receiving-only wallet connection",
    `Protocol: ${TOPUP_PROTOCOL}`,
    "Bridge: https://tsd.honest.money",
    `Wallet origin: ${input.origin}`,
    `HME member: ${input.hmeMemberId}`,
    `TSD receiving address: ${input.address}`,
    `Request: ${input.requestId}`,
    `Challenge: ${input.challengeId}`,
    `Expires: ${input.expiresAt}`,
    "Purpose: receive TSD from stablecoin top-ups. No spending, cash-out, or payment authorization.",
  ].join("\n");
}

export function trustedTopupEvent(event: Pick<MessageEvent, "origin" | "source" | "data">, popup: Window | null, requestId: string): boolean {
  const parsed = envelope.safeParse(event.data);
  return Boolean(popup && event.source === popup && event.origin === TSD_ORIGIN && parsed.success && parsed.data.requestId === requestId);
}

export function validateTopupChallenge(data: unknown, request: TopupRequest, memberId: string | null, used: ReadonlySet<string>, now = Date.now()): TopupChallenge {
  const c = challengeSchema.parse(data);
  if (c.origin !== request.origin || c.requestId !== request.requestId || c.address !== request.address) throw new Error("The bridge requested a different wallet. Nothing was connected.");
  if (memberId && c.hmeMemberId !== memberId) throw new Error("The bridge is signed in to a different Honest Money account. Reconnect with your wallet's account.");
  const remaining = Date.parse(c.expiresAt) - now;
  if (remaining <= 0 || remaining > TOPUP_TTL_MS) throw new Error("Wallet verification expired or has an invalid expiry. Please reconnect.");
  if (used.has(c.challengeId)) throw new Error("This wallet verification was already used. Please reconnect.");
  if (topupMessage(c) !== c.message) throw new Error("The bridge verification message changed. Nothing was signed.");
  return c;
}

const progressSchema = z.object({
  steps: z.array(z.object({ label: z.string().max(120), detail: z.string().max(500) })).min(1).max(10),
  index: z.number().int().min(0).max(9), number: z.number().int().min(1).max(10), total: z.number().int().min(1).max(10),
}).refine(p => p.steps.length === p.total && p.number === p.index + 1 && p.index < p.total);
const txHash = z.string().regex(/^(0x)?[a-fA-F0-9]{64}$/).nullable();
const orderSchema = z.object({
  id: uuid, orderNumber: z.string().max(50), chain: z.enum(["ethereum", "base"]),
  token: z.string().min(1).max(30), amount: z.union([z.string().max(80), z.number().finite()]).nullable(),
  depositTx: txHash, payoutTx: txHash, createdAt: z.string().max(80),
  error: z.string().max(2000).nullable(), note: z.string().max(2000).nullable(),
  complete: z.boolean(), progress: progressSchema,
});
const networkSchema = z.object({
  chain: z.enum(["ethereum", "base"]), name: z.string().min(1).max(60), chainId: z.number().int(),
  tokens: z.array(z.object({ symbol: z.string().min(1).max(30), contract: evmAddress, decimals: z.number().int().min(0).max(18) })).min(1).max(12),
}).refine(n => n.chainId === (n.chain === "ethereum" ? 1 : 8453));
const connectionSchema = envelope.extend({
  type: z.enum(["tsd-topup-connected", "tsd-topup-progress"]), receivingAddress,
  depositAddress: evmAddress, networks: z.array(networkSchema).min(1).max(2),
  minUsd: z.number().finite().positive(), maxUsd: z.number().finite().positive(),
  available: z.boolean(), orders: z.array(orderSchema).max(30),
}).refine(c => c.maxUsd >= c.minUsd && new Set(c.networks.map(n => n.chain)).size === c.networks.length);
export type TopupConnection = z.infer<typeof connectionSchema>;

export function validateTopupConnection(data: unknown, request: TopupRequest): TopupConnection {
  const c = connectionSchema.parse(data);
  if (c.requestId !== request.requestId || c.receivingAddress !== request.address) throw new Error("The bridge destination does not match this wallet. Please reconnect.");
  return c;
}

export function topupError(data: unknown): string {
  const parsed = envelope.extend({ type: z.literal("tsd-topup-error"), error: z.string().min(1).max(2000) }).safeParse(data);
  return parsed.success ? parsed.data.error : "The bridge connection requires review. Please reconnect.";
}

export function topupTransactionUrl(chain: "ethereum" | "base" | "txc", hash: string): string | null {
  if (chain === "txc") return /^[a-fA-F0-9]{64}$/.test(hash) ? `https://mempool.texitcoin.org/tx/${hash}` : null;
  return /^0x[a-fA-F0-9]{64}$/.test(hash) ? `https://${chain === "base" ? "basescan.org" : "etherscan.io"}/tx/${hash}` : null;
}