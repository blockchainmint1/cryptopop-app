/**
 * Device-local ledger of coins ("txid:vout") this wallet just spent, so the
 * next send never re-picks one still settling in the mempool. 60-minute TTL.
 */
const KEY = "cryptopop.txc.spent-outpoints.v1";
const TTL = 60 * 60 * 1000;

function load(): Record<string, number> {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, number>;
    const now = Date.now();
    return Object.fromEntries(Object.entries(raw).filter(([, t]) => now - t < TTL));
  } catch {
    return {};
  }
}

export function reservedOutpoints(): string[] {
  return Object.keys(load());
}

export function reserveOutpoints(list: string[]) {
  const m = load();
  const now = Date.now();
  for (const o of list) m[o] = now;
  try {
    localStorage.setItem(KEY, JSON.stringify(m));
  } catch {
    /* ignore */
  }
}
