/**
 * Per-wallet "branch book" for trading links.
 *
 * honest.money reserves one or more Trading branches (hardened accounts, e.g.
 * SEEDS = 1106') for each trading site. This book remembers, per wallet, which
 * site each branch was first given to and whether it has been retired:
 * - A branch belongs to the first site it was shared with, forever.
 * - A retired branch is never handed to another site, but the same site may
 *   link it again ("Give access" only, with a note that it reuses the revoked pocket).
 */
import { isDelegableAccount } from "./branch-rules";

export interface BranchUse {
  host: string;
  retired: boolean;
}
export type BranchBook = Record<string, BranchUse>;

const keyFor = (walletAddr: string) => `cryptopop:trading-branches:${walletAddr}`;

export type BranchChoice =
  | { ok: true; account: number; reusesRevoked: boolean }
  | { ok: false; reason: string };

export function chooseDelegateBranch(args: {
  host: string;
  siteName: string;
  requested: number;
  reserved: readonly number[];
  book: BranchBook;
}): BranchChoice {
  const host = args.host.toLowerCase();
  const reserved = args.reserved.filter(isDelegableAccount);
  if (reserved.length === 0) {
    return { ok: false, reason: `honest.money hasn't reserved a trading branch for ${args.siteName} yet.` };
  }
  if (!reserved.includes(args.requested)) {
    return {
      ok: false,
      reason: `${args.siteName} asked for trading branch ${args.requested}, but honest.money reserved ${reserved.join(", ")} for it.`,
    };
  }
  const usable = (a: number) => {
    const u = args.book[String(a)];
    return !u || u.host === host;
  };
  for (const a of [args.requested, ...reserved.filter((b) => b !== args.requested)]) {
    if (usable(a)) return { ok: true, account: a, reusesRevoked: args.book[String(a)]?.retired === true };
  }
  return {
    ok: false,
    reason: `Every trading branch honest.money reserved for ${args.siteName} (${reserved.join(", ")}) has already been used on this wallet. Ask honest.money to reserve a new one.`,
  };
}

function readRaw(walletAddr: string): BranchBook {
  if (typeof window === "undefined") return {};
  try {
    const v = JSON.parse(window.localStorage.getItem(keyFor(walletAddr)) ?? "{}") as unknown;
    if (!v || typeof v !== "object" || Array.isArray(v)) return {};
    const out: BranchBook = {};
    for (const [k, u] of Object.entries(v as Record<string, unknown>)) {
      const e = u as Partial<BranchUse> | null;
      if (!/^\d+$/.test(k) || !e || typeof e !== "object") continue;
      out[k] = { host: typeof e.host === "string" ? e.host : "", retired: e.retired === true };
    }
    return out;
  } catch {
    return {};
  }
}

function writeBook(walletAddr: string, book: BranchBook): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(keyFor(walletAddr), JSON.stringify(book));
  } catch {
    /* ignore storage quota errors */
  }
}

export function loadBranchBook(walletAddr: string, links: readonly { host: string; account: number }[]): BranchBook {
  const raw = readRaw(walletAddr);
  const next: BranchBook = { ...raw };
  let changed = false;
  for (const l of links) {
    const k = String(l.account);
    if (!next[k]) {
      next[k] = { host: l.host.toLowerCase(), retired: false };
      changed = true;
    }
  }
  if (changed) writeBook(walletAddr, next);
  return next;
}

export function claimBranch(walletAddr: string, book: BranchBook, host: string, account: number): void {
  const k = String(account);
  const cur = book[k];
  if (cur && cur.host !== host.toLowerCase()) {
    throw new Error("That trading branch is no longer available on this wallet.");
  }
  writeBook(walletAddr, { ...readRaw(walletAddr), ...book, [k]: { host: host.toLowerCase(), retired: false } });
}

export function retireBranch(walletAddr: string, account: number, host: string): void {
  const book = readRaw(walletAddr);
  const k = String(account);
  book[k] = { host: book[k]?.host || host.toLowerCase(), retired: true };
  writeBook(walletAddr, book);
}