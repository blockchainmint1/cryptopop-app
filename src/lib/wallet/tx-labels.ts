/**
 * Private, device-local transaction labels.
 *
 * When you scan a merchant QR the payload usually carries the vendor name
 * (label / merchant / name) and a memo. We keep that on the phone only —
 * never sent to the backend or the chain — so you can see "Bobby's Coffee"
 * in your history while the public explorer only ever sees an address.
 *
 * Two maps are stored:
 *  - byTxid   → label for a specific transaction
 *  - byAddress→ label remembered for a counterparty address, so repeat
 *               visits (and refunds coming back) are named automatically.
 */

export type TxLabel = {
  merchant: string | null;
  memo: string | null;
  address?: string | null;
  at: number;
};

type Store = {
  byTxid: Record<string, TxLabel>;
  byAddress: Record<string, TxLabel>;
};

const KEY = "cryptopop.txlabels.v1";
const EMPTY: Store = { byTxid: {}, byAddress: {} };

function read(): Store {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<Store>;
    return { byTxid: parsed.byTxid ?? {}, byAddress: parsed.byAddress ?? {} };
  } catch {
    return EMPTY;
  }
}

function write(store: Store) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* storage full / private mode — labels are best-effort */
  }
}

/** Remember the vendor behind a transaction (and its counterparty address). */
export function saveTxLabel(
  txid: string,
  info: { merchant?: string | null; memo?: string | null; address?: string | null },
) {
  const merchant = info.merchant?.trim() || null;
  const memo = info.memo?.trim() || null;
  if (!merchant && !memo) return;
  const store = read();
  const label: TxLabel = { merchant, memo, address: info.address ?? null, at: Date.now() };
  store.byTxid[txid] = label;
  if (info.address && merchant) store.byAddress[info.address] = label;
  write(store);
}

/** Remember a vendor for an address without a transaction yet. */
export function saveAddressLabel(address: string, merchant: string | null, memo?: string | null) {
  if (!address || !merchant?.trim()) return;
  const store = read();
  store.byAddress[address] = {
    merchant: merchant.trim(),
    memo: memo?.trim() || null,
    address,
    at: Date.now(),
  };
  write(store);
}

/** All known labels, keyed by txid — read once and pass to the history list. */
export function loadTxLabels(): Record<string, TxLabel> {
  return read().byTxid;
}

export function loadAddressLabels(): Record<string, TxLabel> {
  return read().byAddress;
}

export function clearTxLabels() {
  write({ byTxid: {}, byAddress: {} });
}
