/** Top up / cash out — client-safe pricing, assets and disclaimers. */

export const ORDER_MIN_USD = 25;
export const ORDER_MAX_USD = 1000;
export const ORDER_FEE_BPS = 100; // 1%

export const AMOUNT_CHIPS = [50, 100, 250, 1000];

export type OrderSide = "buy" | "sell";

export const HANDOFF_ASSETS = [
  { asset: "TSD", chain: "txc", label: "TSD on TEXITcoin" },
  { asset: "USDC", chain: "base", label: "USDC on Base" },
] as const;

export type HandoffAsset = (typeof HANDOFF_ASSETS)[number];

export function quoteOrder(side: OrderSide, usd: number) {
  const feeUsd = Math.round(usd * (ORDER_FEE_BPS / 10_000) * 100) / 100;
  const settlementUsd =
    side === "buy"
      ? Math.round((usd + feeUsd) * 100) / 100
      : Math.max(0, Math.round((usd - feeUsd) * 100) / 100);
  return { usd, feeUsd, settlementUsd, assetAmount: Math.round(usd * 100) / 100 };
}

export const DISCLAIMERS: Array<{ id: string; text: string }> = [
  {
    id: "partner_of_record",
    text: "My order is fulfilled by VectorPay, the licensed onramp/offramp partner and seller or buyer of record. CryptoPOP is software that starts the order and delivers to a self-custodied address.",
  },
  {
    id: "partner_kyc",
    text: "I complete identity verification and bank linking on VectorPay. My name, email, bank details and order may be used for sanctions and AML screening.",
  },
  {
    id: "pricing",
    text: "Pricing is set when funds clear, not on this screen. Amounts shown are estimates. The service fee is 1% of the order.",
  },
  {
    id: "settlement_window",
    text: "Bank settlement takes 1–3 business days. Crypto is delivered, or dollars sent, after funds clear.",
  },
  {
    id: "irreversible",
    text: "Blockchain transactions are final — no reversals, recalls or refunds, and no recovery of funds sent to a wrong address.",
  },
  {
    id: "self_custody",
    text: "I hold my own keys. CryptoPOP never holds my crypto and cannot restore my wallet without my recovery phrase.",
  },
  {
    id: "no_advice",
    text: "This is not investment advice. Crypto is volatile and is not FDIC or SIPC insured.",
  },
  { id: "terms", text: "I have read and accept the Terms of Service and Privacy Policy." },
];

export function newOrderId(): string {
  return `CP-${Date.now().toString(36).toUpperCase()}-${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`;
}

/* ---------- device-local order records ---------- */

export type LocalOrder = {
  reference: string;
  side: OrderSide;
  status: string;
  usd: number;
  feeUsd: number;
  settlementUsd: number;
  asset: string;
  chain: string;
  address: string | null;
  name: string;
  email: string;
  checkoutUrl: string | null;
  registered: boolean;
  createdAt: number;
};

const KEY = "cryptopop.orders.v1";

export function readOrders(): LocalOrder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as LocalOrder[]) : [];
  } catch {
    return [];
  }
}

export function saveOrder(order: LocalOrder) {
  if (typeof window === "undefined") return;
  const next = [order, ...readOrders().filter((o) => o.reference !== order.reference)].slice(0, 50);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage full or blocked */
  }
}

export function findOrder(reference: string): LocalOrder | null {
  return readOrders().find((o) => o.reference === reference) ?? null;
}
