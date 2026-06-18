// Curated, public-facing CryptoPOP events shown on the wallet "Find events" tab
// and the /events/$slug/rsvp page. Add new events here.

export type PublicEvent = {
  slug: string;
  name: string;
  /** Display date string */
  dateLabel: string;
  /** Machine date used for sorting + "is upcoming" filtering (ISO, end of event) */
  endsAt: string;
  location: string;
  mapUrl: string;
  blurb: string;
  /** Imported hero image module URL (optional) */
  heroUrl?: string;
};

import bbqHero from "@/assets/usa-250-bbq.png";

export const PUBLIC_EVENTS: PublicEvent[] = [];
// Note: July 4 Marina BBQ removed — event cancelled.
// Hero asset retained for future use:
void bbqHero;


export function findPublicEvent(slug: string): PublicEvent | undefined {
  return PUBLIC_EVENTS.find((e) => e.slug === slug);
}

export function upcomingPublicEvents(now: Date = new Date()): PublicEvent[] {
  return PUBLIC_EVENTS
    .filter((e) => new Date(e.endsAt).getTime() >= now.getTime())
    .sort((a, b) => +new Date(a.endsAt) - +new Date(b.endsAt));
}
