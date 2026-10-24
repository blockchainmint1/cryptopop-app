/**
 * Host policy for wallet link + website sign-in flows.
 *
 * Any public HTTPS host may request a wallet link or sign-in — a link only
 * shares watch-only keys and a sign-in signature authorizes no payment, so the
 * protection is (a) the wallet showing which domain is asking and (b) the
 * strict validation in src/lib/ecosystem/link.ts. Hosts are classified into
 * tiers only so the UI can decide how loud the confirmation should be:
 *
 *   first-party — our own honest.money / cryptopop.org properties
 *   partner     — known partner sites, shown with a friendly name
 *   unknown     — anything else: allowed, with an explicit warning
 *
 * Both the client validator and the server proxy read from this single source.
 * This module must stay dependency-free: it is imported by client bundles.
 */

export type LoginHostTier = "first-party" | "partner" | "unknown";

export interface LoginHostInfo {
  tier: LoginHostTier;
  /** Friendly name where we know one, otherwise the bare hostname. */
  name: string;
}

/** Named partner sites (friendly labels, no extra confirmation step). */
const PARTNER_NAMES: Record<string, string> = {
  "app.nectar-pay.com": "NectarPay",
  "pay.honest.money": "NectarPay",
  "streamtxc.com": "streamTXC",
  "www.streamtxc.com": "streamTXC",
  "bonfire.honest.money": "Bonfire",
  "hme-bonfire.lovable.app": "Bonfire",
  "tsd.honest.money": "TSD Swap",
  "app.tsdswap.com": "TSD Swap",
};

export const TRUSTED_LOGIN_HOSTS: ReadonlySet<string> = new Set(Object.keys(PARTNER_NAMES));

const FIRST_PARTY_APEXES = ["honest.money", "cryptopop.org", "app.cryptopop.org", "wallet.cryptopop.org"];

function isFirstParty(hostname: string): boolean {
  return FIRST_PARTY_APEXES.some(
    (apex) => hostname === apex,
  );
}

/**
 * Is this hostname a routable public DNS name? Rejects IP literals, localhost,
 * single-label names, .local / .internal / .onion, and anything with a label
 * that can't appear in public DNS. Used by both the client and the proxy so an
 * attacker can't aim the link proxy at an internal service (SSRF).
 */
export function isPublicHostname(raw: string): boolean {
  const host = raw.trim().toLowerCase();
  if (!host || host.length > 253) return false;
  if (host.startsWith("[") || host.endsWith("]")) return false; // IPv6 literal
  if (/^[0-9.]+$/.test(host)) return false; // IPv4 literal (incl. private ranges)
  if (/^[0-9a-f:]+$/.test(host) && host.includes(":")) return false;
  const labels = host.split(".");
  if (labels.length < 2) return false; // needs a real TLD
  if (labels.some((l) => !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(l) || l.length > 63)) return false;
  const tld = labels[labels.length - 1];
  if (!/^[a-z]{2,}$/.test(tld)) return false;
  if (["local", "localhost", "internal", "intranet", "onion", "test", "invalid", "example"].includes(tld)) {
    return false;
  }
  if (host === "localhost" || host.endsWith(".localhost")) return false;
  return true;
}

/**
 * Live ecosystem registry, published by the Honest.Money Ecosystem site
 * (Admin → SSO sites) and loaded at startup by src/lib/ecosystem/sites.ts.
 * Adds friendly names for new partner sites without a wallet release; the
 * built-in list above stays as the offline fallback.
 */
let ecosystemNames: Record<string, string> = {};

export function setEcosystemSites(sites: { host: string; label: string }[]): void {
  const next: Record<string, string> = {};
  for (const s of sites) {
    const host = s.host.trim().toLowerCase();
    if (!isPublicHostname(host)) continue;
    next[host] = (s.label || host).slice(0, 40);
  }
  ecosystemNames = next;
}

export function isEcosystemSite(hostname: string): boolean {
  const host = hostname.trim().toLowerCase();
  return !!ecosystemNames[host] || !!PARTNER_NAMES[host] || isFirstParty(host);
}

/** Tier + display name for a sign-in / link host. */
export function classifyLoginHost(hostname: string): LoginHostInfo {
  const host = hostname.trim().toLowerCase();
  const partner = ecosystemNames[host] ?? PARTNER_NAMES[host];
  if (partner) return { tier: isFirstParty(host) ? "first-party" : "partner", name: partner };
  if (isFirstParty(host)) return { tier: "first-party", name: host };
  return { tier: "unknown", name: host };
}

/** Human-friendly site name for a sign-in host, used in the confirm UI. */
export function loginSiteName(hostname: string): string {
  return classifyLoginHost(hostname).name;
}
