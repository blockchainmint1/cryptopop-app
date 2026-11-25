/** Public links only; never substitute a wallet address for an HME code. */
export function hmeAffiliateLinks(code: unknown) {
  if (typeof code !== "string" || !/^[a-z0-9_-]{1,40}$/i.test(code)) return null;
  const clean = code.toLowerCase();
  const defaultLink = `https://honest.money/r/${clean}`;
  return {
    code: clean,
    defaultLink,
    walletLink: `${defaultLink}?to=${encodeURIComponent("https://wallet.cryptopop.org/")}`,
  };
}