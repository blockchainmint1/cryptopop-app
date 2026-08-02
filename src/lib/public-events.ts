// Events are owned by the main CryptoPOP website. This wallet no longer stores
// any events locally — it reads them from the main site's public API and links
// RSVPs back there.

export const MAIN_SITE_ORIGIN = "https://cryptopop.org";

/** Public events feed on the main site (see listPublicEvents). */
export const MAIN_SITE_EVENTS_API = `${MAIN_SITE_ORIGIN}/api/public/events`;

/** Where a wallet user goes to RSVP for an event. */
export function mainSiteRsvpUrl(slug: string) {
  return `${MAIN_SITE_ORIGIN}/events/${encodeURIComponent(slug)}/rsvp`;
}

/** Main site events index. */
export function mainSiteEventsUrl() {
  return `${MAIN_SITE_ORIGIN}/events`;
}
