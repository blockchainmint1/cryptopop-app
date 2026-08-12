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
  const { data: markets } = useSuspenseQuery(marketsQuery);

  const [market, setMarket] = useState<string>("all");
  const [showOnline, setShowOnline] = useState(true);
  const [zipInput, setZipInput] = useState("");
  const [radius, setRadius] = useState<number>(50);
  const [origin, setOrigin] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const [locating, setLocating] = useState(false);

  const marketOptions = useMemo(() => {
    const used = new Set(events.map((e) => e.market_slug).filter(Boolean) as string[]);
    return markets.filter((m) => used.has(m.slug));
  }, [events, markets]);

  async function applyZip(e: React.FormEvent) {
    e.preventDefault();
    setLocating(true);
    try {
      const hit = await geocodeZip({ data: { zip: zipInput } });
      setOrigin(hit);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLocating(false);
    }
  }

  function clearFilters() {
    setMarket("all");
    setShowOnline(true);
    setZipInput("");
    setOrigin(null);
  }

  const filtered = useMemo(() => {
    return events.filter((ev) => {
      if (ev.online) return showOnline;
      if (market !== "all" && ev.market_slug !== market) return false;
      if (origin && ev.lat != null && ev.lng != null) {
        return milesBetween(origin.lat, origin.lng, ev.lat, ev.lng) <= radius;
      }
      if (origin) return false;
      return true;
    });
  }, [events, market, showOnline, origin, radius]);

  const upcoming = filtered.filter((e) => !e.past);
  const past = filtered.filter((e) => e.past).reverse();
  const filtersActive = market !== "all" || !showOnline || origin != null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center gap-2 border-b border-border px-4 py-4">
        <Link
          to="/"
          aria-label="Back to wallet"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="font-display text-2xl font-bold tracking-tight">Events</h1>
      </header>

      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
          <p className="max-w-2xl text-sm text-muted-foreground">
            Show up, scan your pass, earn POP. RSVP to reserve your spot — most events pay POP for
            registering and more for walking through the door.
          </p>
        </div>
      </section>


      {/* Filters */}
      <section className="border-b border-border bg-card/40">
        <div className="mx-auto max-w-6xl space-y-3 px-4 py-4 sm:px-6">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <Select value={market} onValueChange={setMarket}>
              <SelectTrigger className="h-11 w-full" aria-label="Filter by market">
                <SelectValue placeholder="All markets" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All markets</SelectItem>
                {marketOptions.map((m) => (
                  <SelectItem key={m.slug} value={m.slug}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2 sm:justify-start">
              <div className="flex min-w-0 items-center gap-2">
                <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                  Show online events
                </span>
              </div>
              <Switch
                checked={showOnline}
                onCheckedChange={setShowOnline}
                aria-label="Show online events"
              />
            </div>
          </div>

          <form onSubmit={applyZip} className="space-y-2">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
              <Input
                value={zipInput}
                onChange={(e) => setZipInput(e.target.value.replace(/\D/g, "").slice(0, 5))}
                inputMode="numeric"
                placeholder="ZIP code"
                aria-label="ZIP code"
                className="h-11"
              />
              <Select value={String(radius)} onValueChange={(v) => setRadius(Number(v))}>
                <SelectTrigger className="h-11 w-full sm:w-36" aria-label="Search radius">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RADIUS_OPTIONS.map((r) => (
                    <SelectItem key={r} value={String(r)}>
                      Within {r} mi
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="submit"
                className="col-span-2 h-11 rounded-xl sm:col-span-1"
                disabled={locating || zipInput.length !== 5}
              >
                <Search className="mr-1.5 h-4 w-4" />
                {locating ? "Finding…" : "Near me"}
              </Button>
            </div>
          </form>

          {(origin || filtersActive) && (
            <div className="flex flex-wrap items-center gap-2">
              {origin ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-primary">
                  <MapPin className="h-3 w-3" />
                  {radius} mi of {origin.label}
                </span>
              ) : null}
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" /> Clear filters
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <p className="mb-4 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          {upcoming.length} upcoming {upcoming.length === 1 ? "event" : "events"}
        </p>
        {upcoming.length === 0 ? (
          <div className="rounded-3xl border border-border bg-card p-8 text-center sm:p-12">
            <h2 className="font-display text-xl font-semibold sm:text-2xl">
              {filtersActive ? "No events match those filters" : "Nothing on the calendar yet"}
            </h2>
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">
              {filtersActive
                ? "Try a wider radius, another market, or turn online events back on."
                : "New events drop regularly. Check back soon — or bring POP to your city."}
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:gap-8 md:grid-cols-2">
            {upcoming.map((ev) => {
              const hero = ev.cover_url;
              const distance =
                origin && ev.lat != null && ev.lng != null
                  ? Math.round(milesBetween(origin.lat, origin.lng, ev.lat, ev.lng))
                  : null;
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
                      className="h-40 w-full object-cover sm:h-52"
                    />
                  ) : (
                    <div className="h-24 w-full bg-gradient-to-br from-primary/30 via-primary/10 to-transparent sm:h-52" />
                  )}
                  <div className="flex flex-1 flex-col p-5 sm:p-7">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
                        {ev.rsvpOpen ? "RSVPs open" : "RSVPs closed"}
                      </span>
                      {ev.online ? (
                        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                          <Globe className="h-3.5 w-3.5" />
                          Online
                        </span>
                      ) : null}
                      {distance != null ? (
                        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5" />
                          {distance} mi away
                        </span>
                      ) : null}
                      {ev.spotsLeft != null && ev.rsvpOpen ? (
                        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                          <Users className="h-3.5 w-3.5" />
                          {ev.spotsLeft} spots left
                        </span>
                      ) : null}
                    </div>
                    <h2 className="mt-3 font-display text-xl font-bold tracking-tight sm:text-2xl">
                      {ev.name}
                    </h2>
                    <p className="mt-2 flex items-start gap-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground sm:text-xs">
                      <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      {formatWhen(ev.start_at, ev.end_at, ev.time_zone)}
                    </p>
                    {ev.description ? (
                      <p className="mt-3 line-clamp-3 text-sm text-muted-foreground sm:line-clamp-4 sm:text-base">
                        {ev.description}
                      </p>
                    ) : null}
                    <div className="mt-auto pt-5 sm:pt-7">
                      <Link
                        to="/events/$slug"
                        params={{ slug: ev.slug }}
                        className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 font-display font-semibold text-primary-foreground transition hover:opacity-90 sm:w-auto"
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
          <div className="mt-12 sm:mt-20">
            <h2 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">
              Past events
            </h2>
            <ul className="mt-4 divide-y divide-border rounded-2xl border border-border bg-card">
              {past.map((ev) => (
                <li
                  key={ev.slug}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4 sm:p-5"
                >
                  <div className="min-w-0">
                    <p className="truncate font-display text-base font-semibold sm:text-lg">
                      {ev.name}
                    </p>
                    <p className="mt-1 flex items-start gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground sm:text-[11px]">
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {formatWhen(ev.start_at, ev.end_at, ev.time_zone)}
                    </p>
                  </div>
                  <Link
                    to="/events/$slug"
                    params={{ slug: ev.slug }}
                    className="shrink-0 font-mono text-xs uppercase tracking-widest text-primary hover:underline"
                  >
                    Details →
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
