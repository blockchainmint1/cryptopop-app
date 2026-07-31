import { redirect } from "@tanstack/react-router";

/**
 * The wallet experience now lives on its own subdomain/project.
 * Flip WALLET_APP_REDIRECT_ENABLED to false to keep everything on this
 * domain (e.g. if app.cryptopop.org is temporarily down).
 */
export const WALLET_APP_ORIGIN = "https://app.cryptopop.org";
export const WALLET_APP_REDIRECT_ENABLED = true;

/** Paths (and their children) that have moved to the wallet app. */
const MOVED_PREFIXES = ["/app", "/my-pop", "/my-pass", "/recover-wallet", "/scan", "/claim"];

export function isWalletAppPath(pathname: string): boolean {
  return MOVED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function walletAppUrl(path = "/app"): string {
  return `${WALLET_APP_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Throws an external redirect when the current location has moved to the
 * wallet app. Safe to call from any beforeLoad.
 */
export function maybeRedirectToWalletApp(location: { pathname: string; href: string }) {
  if (!WALLET_APP_REDIRECT_ENABLED) return;
  if (!isWalletAppPath(location.pathname)) return;
  throw redirect({ href: walletAppUrl(location.href) });
}
