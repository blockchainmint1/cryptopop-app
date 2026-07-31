import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Coins, Store, Trophy, Activity, MapPin } from "lucide-react";
import logo from "@/assets/cryptopop-logo.png";
import { SiteFooter } from "@/components/site-footer";
import { getEarnActions, getMerchants, getLeaderboard, getHeatmap, getRecentActivity } from "@/lib/earn.functions";
import { getMarkets } from "@/lib/markets.functions";

const actionsQuery = queryOptions({ queryKey: ["earn-actions"], queryFn: () => getEarnActions() });
const merchantsQuery = queryOptions({ queryKey: ["merchants"], queryFn: () => getMerchants() });
const marketsQuery = queryOptions({ queryKey: ["markets"], queryFn: () => getMarkets() });
const activityQuery = queryOptions({ queryKey: ["recent-activity"], queryFn: () => getRecentActivity() });

export const Route = createFileRoute("/earn")({
  head: () => ({
    meta: [
      { title: "Earn POP — CryptoPOP" },
      { name: "description", content: "Ways to earn POP: attend, share, support local, refer. Leaderboard, merchant directory, POPup heatmap." },
      { property: "og:title", content: "Earn POP" },
      { property: "og:description", content: "Catalog of ways to earn POP, top earners, and a live heatmap of POPups." },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(actionsQuery),
      context.queryClient.ensureQueryData(merchantsQuery),
      context.queryClient.ensureQueryData(marketsQuery),
      context.queryClient.ensureQueryData(activityQuery),
    ]),
  component: EarnPage,
  errorComponent: () => <div className="p-10">Couldn't load earn page.</div>,
  notFoundComponent: () => <div className="p-10">Not found.</div>,
});

type Win = "day" | "week" | "month" | "quarter" | "all";
const WINDOWS: { id: Win; label: string }[] = [
  { id: "day", label: "Today" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "quarter", label: "Quarter" },
  { id: "all", label: "All-time" },
];

function CategoryGroup({ category, items }: { category: string; items: { action_key: string; label: string; description: string | null; pop_amount: number }[] }) {
  return (
    <div>
      <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{category}</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {items.map((a) => (
          <div key={a.action_key} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-display text-lg font-semibold">{a.label}</p>
              <span className="flex items-center gap-1 font-mono text-sm text-primary">
                <Coins className="h-3.5 w-3.5" /> +{a.pop_amount}
              </span>
            </div>
            {a.description && <p className="mt-1 text-sm text-muted-foreground">{a.description}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function categorize(key: string): string {
  if (key.startsWith("event_") || key.includes("signup") || key.includes("checkin") || key.includes("rsvp")) return "Attend";
  if (key.includes("share") || key.includes("social") || key.includes("post")) return "Share";
  if (key.includes("merchant") || key.includes("visit") || key.includes("popup")) return "Support local";
  if (key.includes("quiz") || key.includes("learn") || key.includes("read")) return "Learn";
  if (key.includes("refer") || key.includes("invite") || key.includes("friend")) return "Refer";
  return "More ways";
}

function EarnPage() {
  const { data: actions } = useSuspenseQuery(actionsQuery);
  const { data: merchants } = useSuspenseQuery(merchantsQuery);
  const { data: markets } = useSuspenseQuery(marketsQuery);
  const { data: activity } = useSuspenseQuery(activityQuery);
  const [win, setWin] = useState<Win>("week");

  const lbQuery = useQuery({
    queryKey: ["leaderboard", win],
    queryFn: () => getLeaderboard({ data: { window: win } }),
  });
  const hmQuery = useQuery({
    queryKey: ["heatmap", win],
    queryFn: () => getHeatmap({ data: { window: win } }),
  });

  const groups = new Map<string, typeof actions.actions>();
  for (const a of actions.actions) {
    const c = categorize(a.action_key);
    if (!groups.has(c)) groups.set(c, []);
    groups.get(c)!.push(a);
  }

  const merchantsByMarket = new Map<string, typeof merchants.merchants>();
  for (const m of merchants.merchants) {
    if (!merchantsByMarket.has(m.market_slug)) merchantsByMarket.set(m.market_slug, []);
    merchantsByMarket.get(m.market_slug)!.push(m);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link to="/"><img src={logo} alt="CryptoPOP" className="h-8 w-auto" /></Link>
          <nav className="flex items-center gap-4 font-mono text-xs text-muted-foreground">
            <Link to="/how-it-works" className="hover:text-foreground">How it works</Link>
          </nav>
        </div>
      </header>

      <section className="border-b border-border">
        <div className="mx-auto max-w-4xl px-6 py-16">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
            Earn POP
          </p>
          <h1 className="mt-3 font-display text-5xl font-bold tracking-tight md:text-6xl">
            Every interaction counts.
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
            Show up, share, support local, refer a friend. Here's the full menu of ways to stack POP.
          </p>
        </div>
      </section>

      {/* Ways to earn */}
      <section className="mx-auto max-w-6xl px-6 py-14">
        <div className="flex items-center gap-3">
          <Coins className="h-5 w-5 text-primary" />
          <h2 className="font-display text-3xl font-bold tracking-tight">Ways to earn</h2>
        </div>
        {actions.actions.length === 0 ? (
          <p className="mt-6 text-muted-foreground">Reward rules will appear here as your market adds them.</p>
        ) : (
          <div className="mt-8 space-y-10">
            {[...groups.entries()].map(([category, items]) => (
              <CategoryGroup key={category} category={category} items={items} />
            ))}
          </div>
        )}
      </section>

      {/* Merchants */}
      <section className="border-t border-border bg-card">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="flex items-center gap-3">
            <Store className="h-5 w-5 text-primary" />
            <h2 className="font-display text-3xl font-bold tracking-tight">Where to earn</h2>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Participating businesses by market. POP for every visit.</p>

          {merchants.merchants.length === 0 ? (
            <div className="mt-8 rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
              We're onboarding merchants now.
            </div>
          ) : (
            <div className="mt-8 space-y-8">
              {markets.markets.map((mkt) => {
                const list = merchantsByMarket.get(mkt.slug) ?? [];
                if (list.length === 0) return null;
                return (
                  <div key={mkt.slug}>
                    <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{mkt.city}</h3>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {list.map((m) => (
                        <div key={m.id} className="rounded-xl border border-border bg-background p-4">
                          <div className="flex items-baseline justify-between">
                            <p className="font-display text-lg font-semibold">{m.name}</p>
                            <span className="font-mono text-sm text-primary">+{m.pop_per_visit}</span>
                          </div>
                          {m.category && <p className="text-xs text-muted-foreground">{m.category}</p>}
                          {m.address && (
                            <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3" /> {m.address}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Leaderboard + Heatmap */}
      <section className="mx-auto max-w-6xl px-6 py-14">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Trophy className="h-5 w-5 text-primary" />
            <h2 className="font-display text-3xl font-bold tracking-tight">Top POP</h2>
          </div>
          <div className="flex flex-wrap gap-1 rounded-full border border-border p-1 font-mono text-[11px] uppercase tracking-widest">
            {WINDOWS.map((w) => (
              <button
                key={w.id}
                onClick={() => setWin(w.id)}
                className={`rounded-full px-3 py-1 transition ${win === w.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-2xl border border-border bg-card p-6">
            {lbQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading leaderboard…</p>
            ) : (lbQuery.data?.leaders ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No POP awarded in this window yet.</p>
            ) : (
              <ol className="space-y-2">
                {lbQuery.data!.leaders.map((l, i) => (
                  <li key={l.display} className="flex items-center justify-between rounded-lg px-3 py-2 odd:bg-background">
                    <span className="flex items-center gap-3">
                      <span className="font-display text-xl font-bold text-muted-foreground w-6">{i + 1}</span>
                      <span className="font-mono text-sm">{l.display}</span>
                    </span>
                    <span className="font-mono text-sm text-primary">{l.total} POP</span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            <h3 className="font-display text-lg font-semibold">POPup heatmap</h3>
            <p className="mt-1 text-xs text-muted-foreground">Where people are showing up — {WINDOWS.find((w) => w.id === win)?.label.toLowerCase()}.</p>
            <div className="mt-4 rounded-xl border border-border bg-background p-4">
              {hmQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : (hmQuery.data?.points ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No POPups in this window yet. Be the first.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {markets.markets.map((mkt) => {
                    const count = (hmQuery.data?.points ?? []).filter(
                      (p) => mkt.lat != null && mkt.lng != null && Math.abs(p.lat - (mkt.lat as number)) < 1 && Math.abs(p.lng - (mkt.lng as number)) < 1.5,
                    ).length;
                    const intensity = Math.min(1, count / 20);
                    return (
                      <div
                        key={mkt.slug}
                        className="rounded-lg p-3 text-center"
                        style={{ background: `rgba(255, 61, 190, ${0.08 + intensity * 0.6})` }}
                      >
                        <p className="font-mono text-[10px] uppercase tracking-widest text-foreground/80">{mkt.city}</p>
                        <p className="mt-1 font-display text-xl font-bold">{count}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Recent activity */}
      <section className="border-t border-border bg-card">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="flex items-center gap-3">
            <Activity className="h-5 w-5 text-primary" />
            <h2 className="font-display text-3xl font-bold tracking-tight">Recent POPs</h2>
          </div>
          {activity.activity.length === 0 ? (
            <p className="mt-6 text-muted-foreground">No activity yet.</p>
          ) : (
            <ul className="mt-6 divide-y divide-border rounded-2xl border border-border bg-background">
              {activity.activity.map((a, i) => (
                <li key={i} className="flex items-center justify-between px-4 py-3 font-mono text-sm">
                  <span>{a.display}</span>
                  <span className="text-muted-foreground">{a.source}</span>
                  <span className="text-primary">+{a.amount}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
