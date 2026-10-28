/**
 * Message the wallet signs on-device to prove it owns the TSD destination.
 * TSD requires: member id, destination, "TSD Bridge", "pop-wallet", their one-time nonce, issue time.
 */
export function tsdLinkMessage(memberId: string, address: string, nonce: string, issuedAt: string) {
  return `TSD Bridge: link account via pop-wallet\nMember: ${memberId}\nDestination: ${address}\nNonce: ${nonce}\nIssued: ${issuedAt}`;
}

/**
 * Honest Money delegated hand-off (confirmed Oct 28, 2026). The member approves on
 * honest.money and the one-time, 5-minute ticket comes back in the URL fragment
 * (#hm_handoff=...) so it never reaches server logs. return_to must be an https
 * page on a host registered to pop-wallet.
 */
export const TSD_TICKET_LOGIN_URL: ((returnTo: string) => string) | null = (returnTo) =>
  `https://honest.money/handoff?to=tsd&purpose=receiving_setup&return_to=${encodeURIComponent(returnTo)}`;
