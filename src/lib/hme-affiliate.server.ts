import { hmeAffiliateLinks } from "./hme-affiliate";

export async function fetchHmeAffiliate(member: unknown) {
  if (typeof member !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(member))
    return { status: "not_linked" as const, links: null };
  const key = process.env["HME_ECOSYSTEM"];
  if (!key) return { status: "unavailable" as const, links: null };
  try {
    const url = new URL("https://honest.money/api/public/minetxc/miner-profile");
    url.searchParams.set("miner_id", member);
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${key}`, "X-HME-Site": "pop-wallet", Accept: "application/json" },
      redirect: "manual",
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return { status: "unavailable" as const, links: null };
    const profile = await res.json() as { minerId?: unknown; affiliateId?: unknown };
    // Return only this verified member's public affiliate code, never their full profile.
    const links = profile.minerId === member ? hmeAffiliateLinks(profile.affiliateId) : null;
    return links ? { status: "ready" as const, links } : { status: "unavailable" as const, links: null };
  } catch {
    return { status: "unavailable" as const, links: null };
  }
}