import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CalendarDays, MapPin } from "lucide-react";
import logo from "@/assets/cryptopop-logo.png";
import lakehouseAsset from "@/assets/lakehouse.jpg.asset.json";
import { SiteFooter } from "@/components/site-footer";
import { getPublicEventBySlug } from "@/lib/public-event.functions";
import { tzFriendlyName } from "@/lib/tz";

type EventInfo = {
  slug: string;
  name: string;
  date: string;
  blurb: string;
};

const EVENT_FALLBACK: Record<string, EventInfo> = {
  "4th-at-bobbys": {
    slug: "4th-at-bobbys",
    name: "4th of July at The Lakehouse",
    date: "Saturday, July 4, 2026 · 3pm–dark",
    blurb:
      "Join us for the 4th at The Lakehouse — play the CryptoPOP scavenger hunt for fun & prizes, bring your favorite dish to share with the community, and let's have a blast!",
  },
};

// Always render in the event's configured tz so server (UTC) and client render
// the same string. Example output: "Sat Jun 28 · 3pm–6pm Central".
function formatEventDate(startIso: string, endIso: string, tz: string) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const dayLabel = start.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: tz,
  });
  const timeFmt = (d: Date) =>
    d
      .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz })
      .replace(":00 ", " ")
      .toLowerCase()
      .replace(/\s(am|pm)/, "$1");
  return `${dayLabel} · ${timeFmt(start)}–${timeFmt(end)} ${tzFriendlyName(tz, start)}`;
}

export const Route = createFileRoute("/events/$slug/rsvp")({
  loader: async ({ params }) => {
    const row = await getPublicEventBySlug({ data: { slug: params.slug } });
    return { dbEvent: row };
  },
  head: ({ params, loaderData }) => {
    const fallback = EVENT_FALLBACK[params.slug];
    const name = loaderData?.dbEvent?.name ?? fallback?.name;
    const title = name ? `${name} — RSVPs closed` : "Event — CryptoPOP";
    const desc = name
      ? `RSVPs for ${name} are now closed. Another CryptoPOP event is coming soon.`
      : "RSVPs are closed. Another CryptoPOP event is coming soon.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
      ],
    };
  },
  component: SignupPage,
});

function SignupPage() {
  const { slug } = Route.useParams();
  const { dbEvent } = Route.useLoaderData();
  const fallback = EVENT_FALLBACK[slug];
  const ev: EventInfo | undefined = dbEvent
    ? {
        slug: dbEvent.slug,
        name: dbEvent.name,
        date: formatEventDate(dbEvent.start_at, dbEvent.end_at, dbEvent.time_zone),
        blurb: dbEvent.description ?? fallback?.blurb ?? "",
      }
    : fallback;

  if (!ev) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <h1 className="font-display text-3xl font-bold">Event not found</h1>
          <p className="mt-3 text-muted-foreground">
            We couldn't find that event.
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex items-center gap-2 rounded-full border border-foreground/20 px-5 py-2.5 font-display"
          >
            <ArrowLeft className="h-4 w-4" /> Back home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="CryptoPOP" className="h-8 w-auto" />
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Home
          </Link>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-10 px-6 py-12 lg:grid-cols-[1fr_1.1fr]">
        <aside>
          <div className="mb-6 overflow-hidden rounded-3xl border border-border">
            <img
              src={lakehouseAsset.url}
              alt="The Lakehouse — aerial view of the venue"
              width={1536}
              height={1024}
              className="h-48 w-full object-cover md:h-64"
            />
          </div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            CryptoPOP event
          </p>
          <h1 className="mt-3 font-display text-4xl font-bold tracking-tight md:text-5xl">
            {ev.name}
          </h1>
          <div className="mt-6 space-y-3 text-sm">
            <p className="flex items-center gap-2 text-muted-foreground">
              <CalendarDays className="h-4 w-4 text-primary" />
              {ev.date}
            </p>
            <p className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4 text-primary" />
              Location shared with confirmed guests
            </p>
          </div>
          <p className="mt-6 text-muted-foreground">{ev.blurb}</p>
          <p className="mt-6 rounded-2xl border border-border bg-card p-4 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            JUST FOR FUN EVENT. POP ARE A PARTICIPATION RECORD.
          </p>
        </aside>

        <section className="rounded-3xl border border-border bg-card p-8 shadow-[0_30px_80px_-30px] shadow-foreground/20 md:p-10">
          <div className="text-center">
            <p className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              RSVPs closed
            </p>
            <h2 className="mt-4 font-display text-3xl font-bold">
              Thanks — we're all set!
            </h2>
            <p className="mt-3 text-muted-foreground">
              RSVPs for this event are now closed. We'll be announcing the next
              CryptoPOP gathering soon — check back shortly, or explore what's
              happening in your POP market.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                to="/markets"
                className="rounded-full bg-primary px-6 py-3 font-display font-semibold text-primary-foreground transition hover:opacity-90"
              >
                Explore POP Markets
              </Link>
              <Link
                to="/how-it-works"
                className="rounded-full border border-border px-6 py-3 font-display font-semibold text-foreground transition hover:bg-muted"
              >
                How it works
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
