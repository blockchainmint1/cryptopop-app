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

import lakehouseAsset from "@/assets/lakehouse.jpg.asset.json";

export const PUBLIC_EVENTS: PublicEvent[] = [
  {
    slug: "4th-at-bobbys",
    name: "4th of July at The Lakehouse",
    dateLabel: "Saturday, July 4, 2026",
    endsAt: "2026-07-05T03:00:00Z",
    location: "The Lakehouse",
    mapUrl: "https://www.google.com/maps",
    blurb:
      "Join us for the 4th at The Lakehouse — play the CryptoPOP scavenger hunt for fun & prizes, bring your favorite dish to share with the community, and let's have a blast!",
    heroUrl: lakehouseAsset.url,
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
