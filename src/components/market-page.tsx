import { Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { MapPin, ArrowRight, CalendarDays, Newspaper, Store } from "lucide-react";
import logo from "@/assets/cryptopop-logo.png";
import { SiteFooter } from "@/components/site-footer";
import { MerchantMap } from "@/components/merchant-map";
import { getMarketPage } from "@/lib/market-page.functions";

export function marketQuery(slug: string) {
  return queryOptions({
    queryKey: ["market-page", slug],
    queryFn: () => getMarketPage({ data: { slug } }),
  });
}

function fmtDate(iso: string, tz: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: tz,
    }).format(new Date(iso));
  } catch {
    return new Date(iso).toLocaleString("en-US");
  }
}

export function MarketPage({ slug }: { slug: string }) {
  const { data } = useSuspenseQuery(marketQuery(slug));

  if (!data) {
    return (
      <div className="min-h-screen bg-background p-10 text-foreground">
        Market not found. <Link to="/markets" className="text-primary underline">All markets</Link>
      </div>
    );
  }

  const location = data.region ? `${data.region} · ${data.country}` : data.country;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link to="/"><img src={logo} alt="CryptoPOP" className="h-8 w-auto" /></Link>
          <nav className="flex items-center gap-4 font-mono text-xs text-muted-foreground">
            <Link to="/markets" className="hover:text-foreground">Markets</Link>
            <Link to="/events" className="hover:text-foreground">Events</Link>
            <Link to="/earn" className="hover:text-foreground">Earn</Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
            POP Market · {location}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <h1 className="font-display text-5xl font-bold tracking-tight md:text-6xl">{data.city}</h1>
            {data.status === "live" ? (
              <span className="rounded-full bg-neon-lime/15 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-neon-lime">
                Live
              </span>
            ) : (
              <span className="rounded-full border border-border px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Coming soon
              </span>
            )}
          </div>
          {data.heroCopy && <p className="mt-4 text-lg text-muted-foreground">{data.heroCopy}</p>}
          {data.intro && <p className="mt-5 max-w-3xl text-base leading-relaxed text-muted-foreground">{data.intro}</p>}
        </div>
      </section>

      {/* Manager */}
      {data.manager.name && (
        <section className="border-b border-border bg-card/40">
          <div className="mx-auto flex max-w-5xl flex-col gap-5 px-6 py-12 sm:flex-row sm:items-start">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-card font-display text-2xl font-bold">
              {data.manager.photoUrl ? (
                <img src={data.manager.photoUrl} alt={data.manager.name} className="h-full w-full object-cover" />
              ) : (
                data.manager.name.split(" ").map((w) => w[0]).join("")
              )}
            </div>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                {data.manager.title ?? "Market manager"}
              </p>
              <h2 className="mt-1 font-display text-3xl font-bold tracking-tight">{data.manager.name}</h2>
              {data.manager.bio && <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{data.manager.bio}</p>}
            </div>
          </div>
        </section>
      )}

      {/* Events */}
      <section className="mx-auto max-w-5xl px-6 py-14">
        <h2 className="flex items-center gap-2 font-display text-3xl font-bold tracking-tight">
          <CalendarDays className="h-5 w-5 text-primary" /> Upcoming events
        </h2>
        {data.events.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Nothing on the calendar right now — <Link to="/events" className="text-primary underline">see all events</Link>.
          </p>
        ) : (
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            {data.events.map((e) => (
              <div key={e.slug} className="rounded-2xl border border-border bg-card p-6">
                <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                  {fmtDate(e.start_at, e.time_zone)}
                </p>
                <h3 className="mt-2 font-display text-2xl font-bold tracking-tight">{e.name}</h3>
                {e.description && <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{e.description}</p>}
                <div className="mt-4 flex items-center justify-between">
                  <Link
                    to="/events/$slug/rsvp"
                    params={{ slug: e.slug }}
                    className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 font-display text-sm font-semibold text-primary-foreground hover:opacity-90"
                  >
                    RSVP &amp; get POP <ArrowRight className="h-4 w-4" />
                  </Link>
                  {e.spotsLeft != null && (
                    <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                      {e.spotsLeft} spots left
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Merchant map */}
      <section className="border-t border-border bg-card/30">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <h2 className="flex items-center gap-2 font-display text-3xl font-bold tracking-tight">
            <Store className="h-5 w-5 text-primary" /> Merchant map
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Visit these local businesses, scan at the register, and stack POP.
          </p>
          <div className="mt-6">
            {data.merchants.length ? (
              <MerchantMap
                center={data.lat != null && data.lng != null ? { lat: data.lat, lng: data.lng } : null}
                merchants={data.merchants}
              />
            ) : (
              <div className="flex h-[220px] items-center justify-center rounded-2xl border border-dashed border-border font-mono text-xs text-muted-foreground">
                Merchants coming soon
              </div>
            )}
          </div>
          {data.merchants.length > 0 && (
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {data.merchants.map((m) => (
                <li key={m.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-display text-lg font-semibold">{m.name}</p>
                      <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                        {m.category ?? "Local business"}
                      </p>
                      {m.address && (
                        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" /> {m.address}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 rounded-full bg-primary/15 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-primary">
                      {m.pop_per_visit} POP
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* News */}
      <section className="mx-auto max-w-5xl px-6 py-14">
        <h2 className="flex items-center gap-2 font-display text-3xl font-bold tracking-tight">
          <Newspaper className="h-5 w-5 text-primary" /> Latest news
        </h2>
        {data.news.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No updates yet — check back soon.</p>
        ) : (
          <div className="mt-6 space-y-4">
            {data.news.map((n) => (
              <article key={n.id} className="rounded-2xl border border-border bg-card p-6">
                <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                  {new Date(n.published_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </p>
                <h3 className="mt-1 font-display text-2xl font-bold tracking-tight">{n.title}</h3>
                {n.body && <p className="mt-2 text-sm text-muted-foreground">{n.body}</p>}
                {n.link && (
                  <a href={n.link} className="mt-3 inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline">
                    Read more <ArrowRight className="h-3 w-3" />
                  </a>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <SiteFooter />
    </div>
  );
}
