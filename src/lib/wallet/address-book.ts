/**
 * Private, device-local address book. Never leaves the phone.
 */
export type Contact = { address: string; name: string; note?: string | null; at: number };

const KEY = "cryptopop.addressbook.v1";

function read(): Record<string, Contact> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as Record<string, Contact>;
  } catch {
    return {};
  }
}

function write(v: Record<string, Contact>) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    /* best effort */
  }
}

export function loadContacts(): Contact[] {
  return Object.values(read()).sort((a, b) => a.name.localeCompare(b.name));
}

export function getContact(address: string): Contact | null {
  return read()[address] ?? null;
}

export function saveContact(address: string, name: string, note?: string | null) {
  const n = name.trim();
  if (!address || !n) return;
  const all = read();
  all[address] = { address, name: n, note: note?.trim() || null, at: Date.now() };
  write(all);
}

export function removeContact(address: string) {
  const all = read();
  delete all[address];
  write(all);
}
