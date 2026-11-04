/**
 * The shared key CryptoPOP uses to sign every call to (and verify every call
 * from) NectarPay. NECTARPAY_PARTNER_KEY is the current partner key; the old
 * NFC_PAY_SECRET is only a fallback while it is still configured.
 */
export function nectarPayPartnerKey(): string | undefined {
  return process.env.NECTARPAY_PARTNER_KEY || process.env.NFC_PAY_SECRET || undefined;
}
