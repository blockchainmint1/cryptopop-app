/**
 * Message the wallet signs on-device to prove it owns the TSD destination.
 * TSD requires: member id, destination, "TSD Bridge", "pop-wallet", their one-time nonce, issue time.
 */
export function tsdLinkMessage(memberId: string, address: string, nonce: string, issuedAt: string) {
  return `TSD Bridge: link account via pop-wallet\nMember: ${memberId}\nDestination: ${address}\nNonce: ${nonce}\nIssued: ${issuedAt}`;
}

/**
 * NOT YET CONFIRMED by Honest Money: how CryptoPOP gets a sign-in ticket
 * addressed to TSD Bridge. Until they confirm, this stays null and the
 * instant setup button explains it's waiting.
 */
export const TSD_TICKET_LOGIN_URL: ((returnTo: string) => string) | null = null;
