import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Globe,
  MapPin,
  Search,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { geocodeZip, listEventMarkets, listPublicEvents } from "@/lib/public-events.functions";
import { PUBLIC_EVENTS } from "@/lib/public-events";
import { SiteFooter } from "@/components/site-footer";

const eventsQuery = queryOptions({
  queryKey: ["public-events"],
  queryFn: () => listPublicEvents(),
});

const marketsQuery = queryOptions({
  queryKey: ["event-markets"],
  queryFn: () => listEventMarkets(),
});

const RADIUS_OPTIONS = [10, 25, 50, 100, 250] as const;

/** Great-circle distance in miles. */
function milesBetween(aLat: number, aLng: number, bLat: number, bLng: number) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 3958.8;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const Route = createFileRoute("/events/")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(eventsQuery),
      context.queryClient.ensureQueryData(marketsQuery),
    ]),
  head: () => ({
    meta: [
      { title: "Upcoming CryptoPOP Events — RSVP & Earn POP" },
      {
        name: "description",
        content:
          "See every upcoming CryptoPOP event. RSVP to earn POP, show up to earn more, and connect with your local community.",
      },
      { property: "og:title", content: "Upcoming CryptoPOP Events — RSVP & Earn POP" },
      {
        property: "og:description",
        content:
          "See every upcoming CryptoPOP event. RSVP to earn POP, show up to earn more, and connect with your local community.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: ({ error }) => (
    <div role="alert" className="mx-auto max-w-2xl px-6 py-24 text-center text-muted-foreground">
      Couldn't load events: {error.message}
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl px-6 py-24 text-center text-muted-foreground">
      No events found.
    </div>
  ),
  component: EventsPage,
});

const HERO_BY_SLUG = new Map(
  PUBLIC_EVENTS.filter((e) => e.heroUrl).map((e) => [e.slug, e.heroUrl as string]),
);

function formatWhen(startAt: string, endAt: string, timeZone: string) {
  try {
    const day = new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone,
    }).format(new Date(startAt));
    const time = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone,
    }).format(new Date(startAt));
    const endTime = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone,
      timeZoneName: "short",
    }).format(new Date(endAt));
    return `${day} · ${time}–${endTime}`;
  } catch {
    return new Date(startAt).toLocaleString();
  }
}

function EventsPage() {
  const { data: events } = useSuspenseQuery(eventsQuery);
  const upcoming = events.filter((e) => !e.past);
  const past = events.filter((e) => e.past).reverse();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-12 md:py-20">
          <Link
            to="/"
            className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to wallet
          </Link>
          <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.22em] text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Events
          </p>
          <h1 className="mt-4 font-display text-5xl font-bold tracking-tight md:text-6xl">
            Upcoming events
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
            Show up, scan your pass, earn POP. RSVP to reserve your spot — most events
            pay POP for registering and more for walking through the door.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        {upcoming.length === 0 ? (
          <div className="rounded-3xl border border-border bg-card p-12 text-center">
            <h2 className="font-display text-2xl font-semibold">Nothing on the calendar yet</h2>
            <p className="mt-3 text-muted-foreground">
              New events drop regularly. Check back soon — or bring POP to your city.
            </p>
          </div>
        ) : (
          <div className="grid gap-8 md:grid-cols-2">
            {upcoming.map((ev) => {
              const hero = ev.cover_url ?? HERO_BY_SLUG.get(ev.slug);
              return (
                <article
                  key={ev.slug}
                  className="flex flex-col overflow-hidden rounded-3xl border border-border bg-card"
                >
                  {hero ? (
                    <img
                      src={hero}
                      alt={`Cover image for ${ev.name}`}
                      loading="lazy"
                      className="h-52 w-full object-cover"
                    />
                  ) : (
                    <div className="h-52 w-full bg-gradient-to-br from-primary/30 via-primary/10 to-transparent" />
                  )}
                  <div className="flex flex-1 flex-col p-7">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
                        {ev.rsvpOpen ? "RSVPs open" : "RSVPs closed"}
                      </span>
                      {ev.spotsLeft != null && ev.rsvpOpen ? (
                        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                          <Users className="h-3.5 w-3.5" />
                          {ev.spotsLeft} spots left
                        </span>
                      ) : null}
                    </div>
                    <h2 className="mt-4 font-display text-2xl font-bold tracking-tight">
                      {ev.name}
                    </h2>
                    <p className="mt-2 flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">
                      <CalendarDays className="h-4 w-4 text-primary" />
                      {formatWhen(ev.start_at, ev.end_at, ev.time_zone)}
                    </p>
                    {ev.description ? (
                      <p className="mt-4 line-clamp-4 text-muted-foreground">{ev.description}</p>
                    ) : null}
                    <div className="mt-auto pt-7">
                      <Link
                        to="/events/$slug/rsvp"
                        params={{ slug: ev.slug }}
                        className="group inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-display font-semibold text-primary-foreground transition hover:opacity-90"
                      >
                        {ev.rsvpOpen ? "RSVP & get POP" : "View details"}
                        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {past.length > 0 ? (
          <div className="mt-20">
            <h2 className="font-display text-2xl font-semibold tracking-tight">Past events</h2>
            <ul className="mt-6 divide-y divide-border rounded-2xl border border-border bg-card">
              {past.map((ev) => (
                <li key={ev.slug} className="flex flex-wrap items-center justify-between gap-3 p-5">
                  <div>
                    <p className="font-display text-lg font-semibold">{ev.name}</p>
                    <p className="mt-1 flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      {formatWhen(ev.start_at, ev.end_at, ev.time_zone)}
                    </p>
                  </div>
                  <Link
                    to="/events/$slug/rsvp"
                    params={{ slug: ev.slug }}
                    className="font-mono text-xs uppercase tracking-widest text-primary hover:underline"
                  >
                    Recap →
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <SiteFooter />
    </div>
  );
}
