/**
 * ACH onramp (buy TSD) — server-only helpers.
 *
 * Bank linking is done with Plaid Link; settlement + TSD delivery is handled
 * by VectorPay LLC, our licensed money-services partner. We never store bank
 * credentials — only the Plaid item/account ids and a masked account number.
 */

const PLAID_HOSTS: Record<string, string> = {
  sandbox: "https://sandbox.plaid.com",
  development: "https://development.plaid.com",
  production: "https://production.plaid.com",
};

export type PlaidConfig = {
  clientId: string;
  secret: string;
  host: string;
  env: string;
};

export function readPlaidConfig(): PlaidConfig | null {
  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  if (!clientId || !secret) return null;
  const env = (process.env.PLAID_ENV || "sandbox").toLowerCase();
  return { clientId, secret, host: PLAID_HOSTS[env] ?? PLAID_HOSTS.sandbox, env };
}

async function plaid<T>(cfg: PlaidConfig, path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${cfg.host}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: cfg.clientId, secret: cfg.secret, ...body }),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`[onramp] plaid ${path} failed [${res.status}]: ${text}`);
    throw new Error(`Bank service error [${res.status}]: ${text.slice(0, 300)}`);
  }
  return JSON.parse(text) as T;
}

export async function createPlaidLinkToken(cfg: PlaidConfig, walletAddress: string) {
  const out = await plaid<{ link_token: string; expiration: string }>(cfg, "/link/token/create", {
    user: { client_user_id: walletAddress.slice(0, 128) },
    client_name: "CryptoPOP Wallet",
    products: ["auth"],
    country_codes: ["US"],
    language: "en",
  });
  return { linkToken: out.link_token, expiration: out.expiration, env: cfg.env };
}

export async function exchangeAndDescribe(
  cfg: PlaidConfig,
  publicToken: string,
  accountId: string | null,
) {
  const ex = await plaid<{ access_token: string; item_id: string }>(cfg, "/item/public_token/exchange", {
    public_token: publicToken,
  });

  let bankName: string | null = null;
  let mask: string | null = null;
  try {
    const auth = await plaid<{
      accounts: Array<{ account_id: string; name: string; mask: string | null }>;
      item: { institution_id: string | null };
    }>(cfg, "/accounts/get", { access_token: ex.access_token });
    const acct =
      auth.accounts.find((a) => a.account_id === accountId) ?? auth.accounts[0] ?? null;
    bankName = acct?.name ?? null;
    mask = acct?.mask ?? null;
  } catch (e) {
    console.error("[onramp] accounts/get failed", e);
  }

  // The access token is handed to VectorPay for the ACH debit; we do not keep it.
  return { itemId: ex.item_id, accessToken: ex.access_token, bankName, mask };
}

/**
 * Hand the funding instruction to VectorPay. If the partner API isn't wired up
 * yet the order is recorded as `pending_review` for manual settlement.
 */
export async function submitToVectorPay(payload: {
  reference: string;
  amountUsd: number;
  walletAddress: string;
  accessToken: string;
  accountId: string | null;
}): Promise<{ status: string; failureReason: string | null }> {
  const url = process.env.VECTORPAY_API_URL;
  const key = process.env.VECTORPAY_API_KEY;
  if (!url || !key) {
    return { status: "pending_review", failureReason: null };
  }
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/ach/debits`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        reference: payload.reference,
        amount_usd: payload.amountUsd,
        currency: "USD",
        destination: { chain: "texitcoin", asset: "TSD", address: payload.walletAddress },
        source: { processor: "plaid", access_token: payload.accessToken, account_id: payload.accountId },
      }),
    });
    const body = await res.text();
    if (!res.ok) {
      console.error(`[onramp] vectorpay failed [${res.status}]: ${body}`);
      return { status: "failed", failureReason: `VectorPay [${res.status}]: ${body.slice(0, 200)}` };
    }
    return { status: "submitted", failureReason: null };
  } catch (e) {
    console.error("[onramp] vectorpay error", e);
    return { status: "failed", failureReason: e instanceof Error ? e.message : "Unknown error" };
  }
}
