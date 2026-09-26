// Server-only rewards "bank": store rewards + community mutual credit.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { roundCents, type InvoiceRewardOptions, type RewardBalance, type RewardKind } from "./store-rewards";

type Program = {
  id: string;
  nectar_store_id: string;
  store_name: string;
  logo_url: string | null;
  market_slug: string | null;
  rate_bps: number;
  issue_type: string;
  enabled: boolean;
  community_status: string;
  community_credit_limit: number;
  community_balance: number;
};

async function programByStore(storeId: string): Promise<Program | null> {
  const { data } = await supabaseAdmin
    .from("reward_programs")
    .select("*")
    .eq("nectar_store_id", storeId)
    .maybeSingle();
  return (data as Program | null) ?? null;
}

async function ledgerFor(address: string) {
  const { data, error } = await supabaseAdmin
    .from("reward_ledger")
    .select("program_id, kind, market_slug, amount")
    .eq("wallet_address", address);
  if (error) throw error;
  return data ?? [];
}

export async function getBalances(address: string): Promise<RewardBalance[]> {
  const rows = await ledgerFor(address);
  const store = new Map<string, number>();
  const community = new Map<string, number>();
  for (const r of rows) {
    const amt = Number(r.amount);
    if (r.kind === "store") store.set(r.program_id, (store.get(r.program_id) ?? 0) + amt);
    else if (r.market_slug) community.set(r.market_slug, (community.get(r.market_slug) ?? 0) + amt);
  }
  const ids = [...store.keys()];
  const { data: progs } = ids.length
    ? await supabaseAdmin.from("reward_programs").select("id, store_name, logo_url").in("id", ids)
    : { data: [] };
  const out: RewardBalance[] = [];
  for (const [market, amount] of community) {
    if (amount > 0.004) {
      out.push({ kind: "community", key: market, label: `${market} community`, logoUrl: null, amount: roundCents(amount) });
    }
  }
  for (const [id, amount] of store) {
    const p = progs?.find((x) => x.id === id);
    if (amount > 0.004) {
      out.push({ kind: "store", key: id, label: p?.store_name ?? "Store", logoUrl: p?.logo_url ?? null, amount: roundCents(amount) });
    }
  }
  return out;
}

export async function getInvoiceRewardOptions(storeId: string, address: string | null): Promise<InvoiceRewardOptions | null> {
  const p = await programByStore(storeId);
  if (!p || !p.enabled) return null;
  const acceptsCommunity = p.community_status === "approved" && !!p.market_slug;
  let storeBalance = 0;
  let communityBalance = 0;
  if (address) {
    for (const r of await ledgerFor(address)) {
      if (r.kind === "store" && r.program_id === p.id) storeBalance += Number(r.amount);
      if (acceptsCommunity && r.kind === "community" && r.market_slug === p.market_slug) communityBalance += Number(r.amount);
    }
  }
  return {
    programId: p.id,
    storeName: p.store_name,
    ratePct: p.rate_bps / 100,
    issueType: p.issue_type === "community" && acceptsCommunity ? "community" : "store",
    storeBalance: roundCents(storeBalance),
    communityBalance: roundCents(communityBalance),
    acceptsCommunity,
  };
}

/** Issue rewards after a verified TSD payment. Idempotent per invoice. */
export async function issueRewards(opts: {
  storeId: string;
  address: string;
  usd: number;
  invoiceId: string;
  txid: string;
}): Promise<{ amount: number; kind: RewardKind; storeName: string } | null> {
  const p = await programByStore(opts.storeId);
  if (!p || !p.enabled || p.rate_bps <= 0) return null;
  const amount = roundCents((opts.usd * p.rate_bps) / 10000);
  if (amount < 0.01) return null;

  let kind: RewardKind = "store";
  if (p.issue_type === "community" && p.community_status === "approved" && p.market_slug) {
    const after = Number(p.community_balance) - amount;
    if (after >= -Number(p.community_credit_limit)) kind = "community";
  }

  const { error } = await supabaseAdmin.from("reward_ledger").insert({
    program_id: p.id,
    kind,
    market_slug: kind === "community" ? p.market_slug : null,
    wallet_address: opts.address,
    amount,
    reason: "earn",
    invoice_id: opts.invoiceId,
    txid: opts.txid,
  });
  if (error) {
    if (error.code === "23505") return null; // already issued
    throw error;
  }
  if (kind === "community") {
    await supabaseAdmin
      .from("reward_programs")
      .update({ community_balance: Number(p.community_balance) - amount })
      .eq("id", p.id);
  }
  return { amount, kind, storeName: p.store_name };
}

/** Spend rewards on a full invoice. Throws with a customer-friendly message. */
export async function redeemRewards(opts: {
  storeId: string;
  address: string;
  kind: RewardKind;
  total: number;
  invoiceId: string;
  notifyStore: () => Promise<void>;
}) {
  const p = await programByStore(opts.storeId);
  if (!p || !p.enabled) throw new Error("This store doesn't take rewards yet.");
  const opt = await getInvoiceRewardOptions(opts.storeId, opts.address);
  if (!opt) throw new Error("This store doesn't take rewards yet.");
  const total = roundCents(opts.total);
  if (opts.kind === "community" && !opt.acceptsCommunity) throw new Error("This store doesn't take community rewards.");
  const have = opts.kind === "store" ? opt.storeBalance : opt.communityBalance;
  if (have + 1e-6 < total) {
    throw new Error(`Rewards must cover the whole bill — you have $${have.toFixed(2)}, need $${total.toFixed(2)}.`);
  }

  const { data: row, error } = await supabaseAdmin
    .from("reward_ledger")
    .insert({
      program_id: p.id,
      kind: opts.kind,
      market_slug: opts.kind === "community" ? p.market_slug : null,
      wallet_address: opts.address,
      amount: -total,
      reason: "redeem",
      invoice_id: opts.invoiceId,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("This bill was already paid with rewards.");
    throw error;
  }

  try {
    await opts.notifyStore();
  } catch (e) {
    await supabaseAdmin.from("reward_ledger").delete().eq("id", row.id);
    throw new Error("The store couldn't accept rewards right now — nothing was spent.");
  }

  if (opts.kind === "community") {
    // Accepting community rewards earns the store credit to pay forward.
    await supabaseAdmin
      .from("reward_programs")
      .update({ community_balance: Number(p.community_balance) + total })
      .eq("id", p.id);
  }
  return { spent: total };
}
