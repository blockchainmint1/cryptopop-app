import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { MapPin, ArrowRight, Sparkles } from "lucide-react";
import logo from "@/assets/cryptopop-logo.png";
import { SiteFooter } from "@/components/site-footer";
import { getMarkets } from "@/lib/markets.functions";

const marketsQuery = queryOptions({
  queryKey: ["markets"],
  queryFn: () => getMarkets(),
});

export const Route = createFileRoute("/markets")({
  head: () => ({
    meta: [
      { title: "POP Markets — CryptoPOP" },
      { name: "description", content: "Six launch markets for CryptoPOP. Dallas, LA, Denver, Nashville, Salt Lake, Singapore." },
      { property: "og:title", content: "POP Markets — CryptoPOP" },
      { property: "og:description", content: "Small business support, gamified — now in six cities." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(marketsQuery),
  component: MarketsPage,
  errorComponent: () => <div className="p-10">Couldn't load markets.</div>,
  notFoundComponent: () => <div className="p-10">Not found.</div>,
});

function MarketsPage() {
  const { data } = useSuspenseQuery(marketsQuery);
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link to="/"><img src={logo} alt="CryptoPOP" className="h-8 w-auto" /></Link>
          <nav className="flex items-center gap-4 font-mono text-xs text-muted-foreground">
            <Link to="/how-it-works" className="hover:text-foreground">How it works</Link>
            <Link to="/earn" className="hover:text-foreground">Earn</Link>
          </nav>
        </div>
      </header>

      <section className="border-b border-border">
        <div className="mx-auto max-w-4xl px-6 py-16 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
            Connect · Experience · Support · Learn
          </p>
          <h1 className="mt-3 font-display text-5xl font-bold tracking-tight md:text-6xl">
            Six markets.<br />One movement.
          </h1>
          <p className="mt-5 text-lg text-muted-foreground">
            Small business support, gamified. CryptoPOP launches in six curated cities — and grows by invitation.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {data.markets.map((m) => (
            <div key={m.slug} className="rounded-2xl border border-border bg-card p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                    {m.region ? `${m.region} · ${m.country}` : m.country}
                  </p>
                  <h2 className="mt-1 font-display text-3xl font-bold tracking-tight">{m.city}</h2>
                </div>
                {m.status === "live" ? (
                  <span className="rounded-full bg-neon-lime/15 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-neon-lime">
                    Live
                  </span>
                ) : (
                  <span className="rounded-full border border-border px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Coming soon
                  </span>
                )}
              </div>
              {m.hero_copy && <p className="mt-3 text-sm text-muted-foreground">{m.hero_copy}</p>}
              <div className="mt-5 flex items-center gap-2 font-mono text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" /> {m.city}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center">
          <Sparkles className="mx-auto h-6 w-6 text-primary" />
          <h3 className="mt-3 font-display text-2xl font-bold">Want POP in your city?</h3>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
            We add new markets carefully — community first. Tell us about yours and we'll be in touch.
          </p>
          <Link
            to="/markets/request"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-display font-semibold text-primary-foreground hover:opacity-90"
          >
            Request a market <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
