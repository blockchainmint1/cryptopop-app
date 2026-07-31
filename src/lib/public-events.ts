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

import nectarpayHero from "@/assets/nectarpay-training.jpg";

export const PUBLIC_EVENTS: PublicEvent[] = [
  {
    slug: "nectarpay-training-mckinney",
    name: "NectarPay Training with Tim Blake",
    dateLabel: "Wednesday, August 5, 2026 · 9am–5pm Central",
    endsAt: "2026-08-05T22:00:00Z",
    location: "Springhill Suites — McKinney, Texas",
    mapUrl:
      "https://www.google.com/maps/search/?api=1&query=SpringHill+Suites+McKinney+TX",
    blurb:
      "A full day of NectarPay training with Tim Blake. Only 40 spots available — earn 10 POP for registering and 25 POP when you show up.",
    heroUrl: nectarpayHero,
  },
];




export function findPublicEvent(slug: string): PublicEvent | undefined {
  return PUBLIC_EVENTS.find((e) => e.slug === slug);
}

export function upcomingPublicEvents(now: Date = new Date()): PublicEvent[] {
  return PUBLIC_EVENTS
    .filter((e) => new Date(e.endsAt).getTime() >= now.getTime())
    .sort((a, b) => +new Date(a.endsAt) - +new Date(b.endsAt));
}
