import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2, Trophy } from "lucide-react";
import { getPopLeaderboard, type LeaderRow } from "@/lib/leaderboard.functions";
import { getAddressRewards, type WalletReward } from "@/lib/wallet-activity.functions";
import { useWallet } from "@/lib/wallet/wallet-context";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "Top POPs — CryptoPOP Leaderboard" },
      {
        name: "description",
        content:
          "See the top POP earners and review every POP reward credited to your wallet.",
      },
      { property: "og:title", content: "Top POPs — CryptoPOP Leaderboard" },
      {
        property: "og:description",
        content: "The POP scoreboard: top earners and your own POP reward history.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LeaderboardPage,
});

function fmt(n: number) {
  return n.toLocaleString();
}

function LeaderboardPage() {
  const { address } = useWallet();
  const fetchLeaders = useServerFn(getPopLeaderboard);
  const fetchRewards = useServerFn(getAddressRewards);

  const [leaders, setLeaders] = useState<LeaderRow[] | null>(null);
  const [rewards, setRewards] = useState<WalletReward[]>([]);
  const [rank, setRank] = useState<number | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [loadingMine, setLoadingMine] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let alive = true;
    void fetchLeaders()
      .then((r) => alive && setLeaders(r.leaders))
      .catch(() => alive && setLeaders([]));
    return () => {
      alive = false;
    };
  }, [fetchLeaders]);

  useEffect(() => {
    if (!address) return;
    let alive = true;
    setLoadingMine(true);
    void fetchRewards({ data: { address } })
      .then((r) => {
        if (!alive) return;
        setRewards(r.rewards);
        setRank(r.rank.rank);
        setTotal(r.rank.awarded);
      })
      .catch(() => undefined)
      .finally(() => alive && setLoadingMine(false));
    return () => {
      alive = false;
    };
  }, [address, fetchRewards]);

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
        <h1 className="font-display text-2xl font-bold tracking-tight">Top POPs</h1>
      </header>

      <main className="mx-auto w-full max-w-md space-y-6 px-4 py-6">
        <Card className="border-white/12 bg-white/5 p-5 text-center">
          <Trophy className="mx-auto h-6 w-6 text-primary" />
          <p className="mt-2 font-display text-4xl font-bold leading-none">
            {rank ? `#${rank}` : "Unranked"}
          </p>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            {total != null ? `${fmt(total)} POP earned` : "Your POP rank"}
          </p>
        </Card>

        <section>
          <h2 className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            Leaderboard
          </h2>
          <div className="mt-2 divide-y divide-border rounded-2xl border border-border bg-card">
            {leaders === null ? (
              <div className="flex justify-center p-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : leaders.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                No POP awarded yet. Be the first.
              </p>
            ) : (
              (showAll ? leaders : leaders.slice(0, 3)).map((l, i) => {
                const me = address && l.address.toLowerCase() === address.toLowerCase();
                return (
                  <div
                    key={l.address}
                    className={`flex items-center gap-3 px-4 py-3 ${me ? "bg-primary/10" : ""}`}
                  >
                    <span className="w-6 font-mono text-xs text-muted-foreground">{i + 1}</span>
                    <span className="flex-1 truncate font-mono text-xs">
                      {me ? "You" : l.display}
                    </span>
                    <span className="font-display text-sm font-semibold">{fmt(l.total)}</span>
                  </div>
                );
              })
            )}
          </div>
          {leaders && leaders.length > 3 ? (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="mt-2 w-full rounded-xl border border-white/12 bg-white/5 py-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground transition hover:text-foreground"
            >
              {showAll ? "Show less" : `See more (${leaders.length - 3})`}
            </button>
          ) : null}
        </section>

        <section>
          <h2 className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            My POP transactions
          </h2>
          <div className="mt-2 divide-y divide-border rounded-2xl border border-border bg-card">
            {!address ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                Set up your wallet to see your POP history.
              </p>
            ) : loadingMine ? (
              <div className="flex justify-center p-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : rewards.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                No POP rewards yet — scan a code at an event to start earning.
              </p>
            ) : (
              rewards.map((r) => (
                <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{r.source || "POP reward"}</p>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString()} · {r.status}
                    </p>
                  </div>
                  <span className="font-display text-sm font-semibold text-primary">
                    +{fmt(Number(r.amount))}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
