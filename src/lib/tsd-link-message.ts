/**
 * Message the wallet signs on-device to prove it owns the TSD destination.
 * TSD requires: member id, destination, "TSD Bridge", "pop-wallet", their one-time nonce, issue time.
 */
export function tsdLinkMessage(memberId: string, address: string, nonce: string, issuedAt: string) {
  return `TSD Bridge: link account via pop-wallet\nMember: ${memberId}\nDestination: ${address}\nNonce: ${nonce}\nIssued: ${issuedAt}`;
}

/**
 * Honest Money delegated hand-off (v2, confirmed Oct 28, 2026). The member approves on
 * honest.money and the one-time, 5-minute ticket comes back in the URL fragment
 * (#hm_handoff=...) so it never reaches server logs. return_to must exactly match a
 * callback URL registered to pop-wallet, and each request carries a fresh random
 * `state` that is signed into the ticket; TSD matches it to the pending setup.
 */
export const TSD_TICKET_LOGIN_URL: ((returnTo: string, state: string) => string) | null = (returnTo, state) =>
  `https://honest.money/handoff?to=tsd&purpose=receiving_setup&state=${encodeURIComponent(state)}&return_to=${encodeURIComponent(returnTo)}`;
