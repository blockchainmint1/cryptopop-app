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
    const w = window as unknown as { honestMoney?: { ref?: () => string | null } };
    const r = w.honestMoney?.ref?.();
    if (r) return r;
    const m = document.cookie.match(/(?:^|;\s*)hm_ref=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}
