// NFC tap-to-pay card pockets (sandbox phase).
// Each card gets its own pocket on CryptoPOP's dedicated branch
// m/44'/696969'/1110'/0/N — separate from the main wallet (0') and from
// HME Wallet's card branch (1107'), so the same recovery phrase never
// produces colliding card keys across wallets.
// Only labels/ids/settings are stored here; keys are re-derived on demand.
import { deriveTxcAddressAtPath } from "@/lib/wallet";

export const NFC_ACCOUNT = 1110;
export const nfcPocketPath = (n: number) => `m/44'/696969'/${NFC_ACCOUNT}'/0/${n}`;

export type NfcCard = {
  index: number;
  uid: string; // normalized reader id
  label: string;
  enabled: boolean;
  lost: boolean;
  createdAt: number;
};

const KEY = "cp-nfc-cards";

/** Same rule as HME: keep ASCII letters/digits only, uppercase. */
export function normalizeUid(raw: string): string {
  return raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

export function loadCards(): NfcCard[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as NfcCard[];
  } catch {
    return [];
  }
}

export function saveCards(cards: NfcCard[]) {
  localStorage.setItem(KEY, JSON.stringify(cards));
}

/** Next unused pocket number — never reuse one, even for lost cards. */
export function nextIndex(cards: NfcCard[]): number {
  return cards.reduce((m, c) => Math.max(m, c.index + 1), 0);
}

export function pocketAddress(mnemonic: string, index: number): string {
  return deriveTxcAddressAtPath(mnemonic, nfcPocketPath(index));
}

export const webNfcSupported = () => typeof window !== "undefined" && "NDEFReader" in window;
