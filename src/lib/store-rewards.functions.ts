import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { redeemMessage, type InvoiceRewardOptions, type RewardBalance } from "./store-rewards";

const addr = z.string().trim().min(26).max(48);
const idSchema = z.string().trim().min(1).max(80).regex(/^[A-Za-z0-9_-]+$/);

/** Store + community reward balances for a wallet. */
export const getRewardBalances = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ addresses: z.array(addr).min(1).max(4) }).parse(d))
  .handler(async ({ data }): Promise<{ balances: RewardBalance[] }> => {
    const { getBalances } = await import("./store-rewards.server");
    const all = (await Promise.all(data.addresses.map((a) => getBalances(a).catch(() => [])))).flat();
    const merged = new Map<string, RewardBalance>();
    for (const b of all) {
      const k = `${b.kind}:${b.key}`;
      const prev = merged.get(k);
      merged.set(k, prev ? { ...prev, amount: prev.amount + b.amount } : b);
    }
    return { balances: [...merged.values()].sort((a, b) => b.amount - a.amount) };
  });

/** Reward options for a NectarPay checkout (what the store offers, what you hold). */
export const getCheckoutRewards = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ storeId: idSchema, address: addr.nullable() }).parse(d))
  .handler(async ({ data }): Promise<{ options: InvoiceRewardOptions | null }> => {
    const { getInvoiceRewardOptions } = await import("./store-rewards.server");
    return { options: await getInvoiceRewardOptions(data.storeId, data.address).catch(() => null) };
  });

/** Pay a full NectarPay bill with rewards. Wallet signs to prove ownership. */
export const payWithRewards = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        invoiceId: idSchema,
        address: addr,
        kind: z.enum(["store", "community"]),
        signature: z.string().trim().min(40).max(200),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<{ spent: number }> => {
    const { NECTARPAY_ORIGIN, isPaidStatus } = await import("./nectarpay");
    const res = await fetch(`${NECTARPAY_ORIGIN}/api/public/v1/invoices/${data.invoiceId}/public`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error("Couldn't load this checkout.");
    const raw = (await res.json()) as Record<string, unknown>;
    if (isPaidStatus(String(raw.status ?? ""))) throw new Error("This bill is already paid.");
    const currency = String(raw.currency ?? raw.fiat_currency ?? "USD").toUpperCase();
    if (currency !== "USD") throw new Error("Rewards only work on USD bills.");
    const total = Number(raw.fiat_amount ?? raw.fiatAmount ?? 0);
    const m = (raw.merchant ?? raw.store ?? null) as Record<string, unknown> | null;
    const storeId = String(raw.store_id ?? raw.storeId ?? m?.id ?? "");
    if (!storeId || !(total > 0)) throw new Error("This store doesn't take rewards yet.");

    const { verifyTxcMessage } = await import("./wallet/txc-message");
    if (!verifyTxcMessage(data.address, redeemMessage(data.invoiceId, data.kind, total), data.signature)) {
      throw new Error("Signature check failed.");
    }

    const secret = process.env["NECTARPAY_REWARDS_SECRET"];
    const { redeemRewards } = await import("./store-rewards.server");
    return redeemRewards({
      storeId,
      address: data.address,
      kind: data.kind,
      total,
      invoiceId: data.invoiceId,
      notifyStore: async () => {
        if (!secret) throw new Error("rewards_not_configured");
        const { createHmac } = await import("crypto");
        const body = JSON.stringify({ invoiceId: data.invoiceId, amount: total, kind: data.kind, wallet: data.address });
        const sig = createHmac("sha256", secret).update(body).digest("hex");
        const r = await fetch(`${NECTARPAY_ORIGIN}/api/public/v1/invoices/${data.invoiceId}/public/rewards-paid`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-cryptopop-signature": sig },
          body,
        });
        if (!r.ok) throw new Error(`nectarpay ${r.status}`);
      },
    });
  });

// ---------- POP manager (admin) ----------

async function assertAdmin(supabase: { rpc: (...a: never[]) => unknown }, userId: string) {
  const { data } = (await (supabase as unknown as {
    rpc: (f: string, a: object) => Promise<{ data: boolean | null }>;
  }).rpc("has_role", { _user_id: userId, _role: "admin" }));
  if (!data) throw new Error("Forbidden");
}

export const listRewardPrograms = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const { data, error } = await context.supabase
      .from("reward_programs")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { programs: data ?? [] };
  });

export const updateRewardProgram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        community_status: z.enum(["none", "pending", "approved", "declined", "paused"]).optional(),
        community_credit_limit: z.number().min(0).max(100000).optional(),
        market_slug: z.string().trim().max(40).nullable().optional(),
        enabled: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const { id, ...patch } = data;
    const { error } = await context.supabase.from("reward_programs").update(patch).eq("id", id);
    if (error) throw error;
    return { ok: true };
  });
