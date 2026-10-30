import { isValidTxcAddress } from "./wallet";

export function paymentInputsBelongTo(tx: { txid?: string; vin?: { prevout?: { scriptpubkey_address?: string } }[] }, txid: string, address: string): boolean {
  return isValidTxcAddress(address) && tx.txid?.toLowerCase() === txid.toLowerCase() &&
    !!tx.vin?.length && tx.vin.every((input) => input.prevout?.scriptpubkey_address === address);
}

/** Fail closed: a signature alone does not prove this wallet paid the invoice. */
export async function assertPaymentOwner(txid: string, address: string): Promise<void> {
  if (!/^[0-9a-f]{64}$/i.test(txid) || !isValidTxcAddress(address)) throw new Error("Invalid payment proof");
  // Cloudflare Workers reject redirect:"error"; "manual" leaves any redirect as a non-ok reply, which fails closed below.
  const res = await fetch(`https://mempool.texitcoin.org/api/tx/${txid}`, { signal: AbortSignal.timeout(8000), redirect: "manual" });
  if (!res.ok) throw new Error("Payment proof is not available yet — try claiming again shortly");
  const tx = await res.json() as Parameters<typeof paymentInputsBelongTo>[0];
  if (!paymentInputsBelongTo(tx, txid, address)) throw new Error("Only the wallet that paid this invoice can claim its rewards");
}