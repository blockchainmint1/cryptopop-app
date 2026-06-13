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

export const PUBLIC_EVENTS: PublicEvent[] = [
  {
    slug: "july4-marina-bbq",
    name: "Red, White & Barbecue — USA 250ᵗʰ",
    dateLabel: "Saturday, 4 July 2026 · 11am – 4pm",
    endsAt: "2026-07-04T16:00:00+08:00",
    location: "ONE°15 Marina, Sentosa Cove",
    mapUrl:
      "https://www.google.com/maps/place/ONE%C2%B015+Marina+Sentosa+Cove,+Singapore/@1.2462,103.8378,17z",
    blurb:
      "Celebrate the 250ᵗʰ USA anniversary with a family-friendly CryptoPOP party at ONE°15 Marina, Sentosa Cove — live music, face painting, the best BBQ in Singapore, complimentary superyacht marina tours, and commemorative POP rewards for everyone who checks in.",
    heroUrl: bbqHero,
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
