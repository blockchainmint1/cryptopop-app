/**
 * Public (unauthenticated) activity + rewards reads for a non-custodial wallet
 * address. Everything here is either already public on the TXC explorer or is
 * keyed to the address the caller already controls.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const MEMPOOL_BASE = "https://mempool.texitcoin.org/api";

const Input = z.object({
  address: z.string().min(20).max(64).regex(/^[A-Za-z0-9]+$/),
});

export type WalletTx = {
  txid: string;
  time: number | null;
  confirmed: boolean;
  direction: "in" | "out";
  txc: number;
  /** Omni token moved in this tx, sized to THIS address's share. */
  /** The other party (sender for incoming, recipient for outgoing), best guess. */
  counterparty?: string | null;
  token?: { symbol: string; propertyId: number; amount: number } | null;
};

export type WalletReward = {
  id: string;
  amount: number;
  source: string;
  /** Store name captured at award time, e.g. "Purchase @ honest.money". */
  label: string | null;
  source_id: string | null;
  status: string;
  tx_hash: string | null;
  created_at: string;
};

export type WalletRank = {
  rank: number | null;
  total: number | null;
  awarded: number | null;
};

type MempoolTx = {
  txid: string;
  status?: { confirmed?: boolean; block_time?: number };
  vin?: { prevout?: { scriptpubkey_address?: string; value?: number } }[];
  vout?: { scriptpubkey_address?: string; scriptpubkey?: string; value?: number }[];
};

const SYMBOLS: Record<number, string> = { 39: "TSD", 37: "POP", 40: "phPOP" };
const divisibleCache = new Map<number, boolean>([[37, false]]);

async function isDivisible(id: number): Promise<boolean> {
  const hit = divisibleCache.get(id);
  if (hit !== undefined) return hit;
  try {
    const url = process.env.TXC_RPC_URL ?? process.env.TXC_RPC_ADDRESS;
    const user = process.env.TXC_RPC_USER;
    const pass = process.env.TXC_RPC_PASS;
    if (!url || !user || !pass) return true;
    const res = await fetch(url.startsWith("http") ? url : `https://${url}`, {
      method: "POST",
      headers: { "content-type": "text/plain", authorization: "Basic " + btoa(`${user}:${pass}`) },
      body: JSON.stringify({ jsonrpc: "1.0", id: "cp", method: "omni_getproperty", params: [id] }),
    });
    const j = (await res.json()) as { result?: { divisible?: boolean } };
    const d = j.result?.divisible !== false;
    divisibleCache.set(id, d);
    return d;
  } catch {
    return true;
  }
}

type OmniDecoded = {
  propertyId: number;
  amount: bigint;
  sender: string | null;
  references: string[];
  /** Send-To-Many (type 7): exact amount per recipient. */
  allocations?: { address: string; amount: bigint }[];
};

/**
 * Decode an Omni Class C payload from the OP_RETURN output. Handles Simple
 * Send (0), Send-To-Many (7, each recipient's own amount) and the TSD
 * distributor's type 55 (Simple Send layout + one trailing control byte).
 */
function decodeOmni(tx: MempoolTx): OmniDecoded | null {
  let payload: string | null = null;
  for (const v of tx.vout ?? []) {
    const sc = (v.scriptpubkey ?? "").toLowerCase();
    if (!sc.startsWith("6a")) continue;
    const at = sc.indexOf("6f6d6e69");
    if (at >= 0) { payload = sc.slice(at + 8); break; }
  }
  if (!payload || payload.length < 16) return null;
  const type = parseInt(payload.slice(4, 8), 16);
  const sender = tx.vin?.[0]?.prevout?.scriptpubkey_address ?? null;
  try {
    if (type === 7) {
      const propertyId = parseInt(payload.slice(8, 16), 16);
      const count = parseInt(payload.slice(16, 18), 16);
      if (!(propertyId > 0) || !count) return null;
      const allocations: { address: string; amount: bigint }[] = [];
      let total = 0n;
      for (let i = 0; i < count; i++) {
        const chunk = payload.slice(18 + i * 18, 36 + i * 18);
        if (chunk.length < 18) return null;
        const address = tx.vout?.[parseInt(chunk.slice(0, 2), 16)]?.scriptpubkey_address;
        const amt = BigInt("0x" + chunk.slice(2));
        if (!address) continue;
        allocations.push({ address, amount: amt });
        total += amt;
      }
      return { propertyId, amount: total, sender, references: allocations.map((a) => a.address), allocations };
    }
    let propertyId: number;
    let amount: bigint;
    if (type === 0 && payload.length >= 32) {
      propertyId = parseInt(payload.slice(8, 16), 16);
      amount = BigInt("0x" + payload.slice(16, 32));
    } else if (type === 55 && payload.length >= 32) {
      propertyId = parseInt(payload.slice(8, 16), 16);
      amount = BigInt("0x" + payload.slice(16, 32));
    } else return null;
    if (!(propertyId > 0)) return null;
    const references = (tx.vout ?? [])
      .map((v) => v.scriptpubkey_address)
      .filter((a): a is string => !!a && a !== sender);
    return { propertyId, amount, sender, references };
  } catch {
    return null;
  }
}

/** Recent native-chain transactions for an address (public explorer data). */
export const getAddressActivity = createServerFn({ method: "POST" })
  .inputValidator((input) => Input.parse(input))
  .handler(async ({ data }): Promise<{ txs: WalletTx[] }> => {
    try {
      const res = await fetch(`${MEMPOOL_BASE}/address/${data.address}/txs`);
      if (!res.ok) return { txs: [] };
      const json = (await res.json()) as MempoolTx[];
      const addr = data.address;
      const list = (json ?? []).slice(0, 25);
      const decoded = list.map(decodeOmni);
      const ids = [...new Set(decoded.filter(Boolean).map((o) => o!.propertyId))];
      const div = new Map(await Promise.all(ids.map(async (id) => [id, await isDivisible(id)] as const)));
      const txs: WalletTx[] = list.map((tx, i) => {
        const inSum = (tx.vin ?? [])
          .filter((v) => v.prevout?.scriptpubkey_address === addr)
          .reduce((a, v) => a + (v.prevout?.value ?? 0), 0);
        const outSum = (tx.vout ?? [])
          .filter((v) => v.scriptpubkey_address === addr)
          .reduce((a, v) => a + (v.value ?? 0), 0);
        const net = outSum - inSum;
        const o = decoded[i];
        let token: WalletTx["token"] = null;
        let dir: "in" | "out" = net >= 0 ? "in" : "out";
        if (o && (o.sender === addr || o.references.includes(addr))) {
          const incoming = o.sender !== addr;
          dir = incoming ? "in" : "out";
          // Incoming multi-send: only OUR share, never the batch total.
          const units = incoming && o.allocations
            ? o.allocations.reduce((sum, a) => (a.address === addr ? sum + a.amount : sum), 0n)
            : o.amount;
          const scale = div.get(o.propertyId) === false ? 1 : 1e8;
          token = {
            propertyId: o.propertyId,
            symbol: SYMBOLS[o.propertyId] ?? `#${o.propertyId}`,
            amount: Number(units) / scale,
          };
        }
        const counterparty =
          dir === "in"
            ? (o && o.sender !== addr ? o.sender : null) ??
              (tx.vin ?? []).map((v) => v.prevout?.scriptpubkey_address).find((a) => a && a !== addr) ??
              null
            : (o ? o.references.find((a) => a !== addr) : null) ??
              (tx.vout ?? []).map((v) => v.scriptpubkey_address).find((a) => a && a !== addr) ??
              null;
        return {
          token,
          counterparty,
          txid: tx.txid,
          time: tx.status?.block_time ?? null,
          confirmed: Boolean(tx.status?.confirmed),
          direction: dir,
          txc: Math.abs(net) / 1e8,
        };
      });
      return { txs };
    } catch (e) {
      console.error("[getAddressActivity]", e);
      return { txs: [] };
    }
  });

/** Reward history + POP leaderboard rank for an address. */
export const getAddressRewards = createServerFn({ method: "POST" })
  .inputValidator((input) => Input.parse(input))
  .handler(
    async ({ data }): Promise<{ rewards: WalletReward[]; rank: WalletRank }> => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const [rewardsRes, rankRes] = await Promise.all([
        supabaseAdmin
          .from("pop_awards")
          .select("id, amount, source, source_id, label, status, tx_hash, created_at")
          .ilike("wallet_address", data.address)
          .order("created_at", { ascending: false })
          .limit(50),
        supabaseAdmin.rpc("pop_address_rank", { _address: data.address }),
      ]);

      if (rewardsRes.error) console.error("[getAddressRewards] rewards", rewardsRes.error);
      if (rankRes.error) console.error("[getAddressRewards] rank", rankRes.error);

      const row = (rankRes.data as unknown as
        | { rank: number; total: number; balance: number }[]
        | null)?.[0];

      return {
        rewards: (rewardsRes.data ?? []) as WalletReward[],
        rank: {
          rank: row ? Number(row.rank) : null,
          total: row ? Number(row.total) : null,
          awarded: row ? Number(row.balance) : null,
        },
      };
    },
  );
