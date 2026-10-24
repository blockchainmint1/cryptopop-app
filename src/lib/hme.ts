/** Browser helpers for Sign in with Honest Money + referral tracking. */
export function hmeLoginUrl(origin: string) {
  return `https://honest.money/sso-login?popup=1&return_to=${encodeURIComponent(`${origin}/sso`)}`;
}

/** Opens the honest.money login popup; falls back to a full-page redirect. */
export function openHmeLogin() {
  const url = hmeLoginUrl(window.location.origin);
  const w = window.open(url, "hme-sso", "width=460,height=680");
  if (!w) window.location.href = url;
}

/** The ?ref affiliate code saved by honest.money/hm.js (30-day cookie). */
export function hmeRef(): string | null {
  try {
    const incoming = new URL(window.location.href).searchParams.get("ref");
    if (incoming && /^[A-Za-z0-9_-]{1,64}$/.test(incoming)) {
      document.cookie = `hm_ref=${encodeURIComponent(incoming)}; Max-Age=2592000; Path=/; Secure; SameSite=Lax`;
      return incoming;
    }
    const m = document.cookie.match(/(?:^|;\s*)hm_ref=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}
