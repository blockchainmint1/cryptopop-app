import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronRight,
  Copy,
  Loader2,
  ShoppingBag,
  Trophy,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import coin from "@/assets/cryptopop-coin.png";
import { getPopLeaderboard, type LeaderRow } from "@/lib/leaderboard.functions";
import { getAddressRewards, type WalletReward } from "@/lib/wallet-activity.functions";
import { useWallet } from "@/lib/wallet/wallet-context";
import { BottomNav, BottomNavSpacer } from "@/components/bottom-nav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UnlockScreen } from "@/components/wallet/unlock-screen";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "My POP — CryptoPOP Rewards" },
      {
        name: "description",
        content:
          "Your POP rank, points, full point history, and the three ways to earn more: events, shopping, and referrals.",
      },
      { property: "og:title", content: "My POP — CryptoPOP Rewards" },
      {
        property: "og:description",
        content: "Rank, points, point history, and ways to earn POP.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PopPage,
});

function fmt(n: number) {
  return n.toLocaleString();
}

/** Turn a ledger source key into something a person would read. */
function rewardLabel(source: string) {
  switch (source) {
    case "event_signup":
      return "Event signup";
    case "event_checkin":
    case "check_in":
      return "Event check-in";
    case "scan":
    case "claim":
      return "Event scan";
    case "referral":
      return "Referral bonus";
    case "quiz":
      return "Quiz reward";
    case "signup":
      return "Welcome bonus";
    case "merchant_reward":
      return "Store reward";
    case "community_reward":
      return "Community reward";
    default:
      return source.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

function sectionTitle(text: string) {
  return (
    <h2 className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
      {text}
    </h2>
  );
}

function PageHeader() {
  return (
    <header className="flex items-center gap-2 border-b border-border px-4 py-4">
      <Link
        to="/"
        aria-label="Back to wallet"
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
      </Link>
      <h1 className="font-display text-2xl font-bold tracking-tight">POP</h1>
    </header>
  );
}

function PopPage() {
  const { address, status } = useWallet();
  const fetchLeaders = useServerFn(getPopLeaderboard);
  const fetchRewards = useServerFn(getAddressRewards);

  const [leaders, setLeaders] = useState<LeaderRow[] | null>(null);
  const [rewards, setRewards] = useState<WalletReward[]>([]);
  const [rank, setRank] = useState<number | null>(null);
  const [points, setPoints] = useState<number | null>(null);
  const [loadingMine, setLoadingMine] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [copied, setCopied] = useState(false);

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
        setPoints(r.rank.awarded ?? 0);
      })
      .catch(() => undefined)
      .finally(() => alive && setLoadingMine(false));
    return () => {
      alive = false;
    };
  }, [address, fetchRewards]);

  // Read the site address only after the page is live in the browser, so the
  // server render never touches `window`.
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const inviteLink = address && origin ? `${origin}/?ref=${address}` : "";

  const copyInvite = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      toast.success("Invite link copied");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Copy failed — long-press the link to copy it");
    }
  };

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // A reload locks the vault on purpose — the keys never persist — so ask for
  // the password here instead of showing an empty board to someone who has a wallet.
  if (status === "locked") return <UnlockScreen />;

  if (status === "none") {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <PageHeader />
        <main className="mx-auto w-full max-w-md space-y-6 px-4 py-6">
          <Card className="border-white/12 bg-white/5 p-6 text-center">
            <p className="font-display text-2xl font-bold uppercase tracking-tight">
              Set up your wallet
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Your POP lives with your wallet. Create one and this page shows your rank,
              points and history.
            </p>
            <Button asChild size="lg" className="mt-5 w-full rounded-full">
              <Link to="/">Set up wallet</Link>
            </Button>
          </Card>
        </main>
        <BottomNavSpacer />
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PageHeader />

      <main className="mx-auto w-full max-w-md space-y-6 px-4 py-6">
        {/* 1. RANK — who you are on the board right now */}
        <Card className="border-white/12 bg-white/5 p-5 text-center">
          <Trophy className="mx-auto h-5 w-5 text-primary" />
          <p className="mt-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            Your rank
          </p>
          <p className="mt-1 font-display text-5xl font-bold leading-none">
            {rank ? `#${rank}` : "—"}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {rank
              ? leaders && leaders.length > 1
                ? `of ${fmt(leaders.length)} POP earners`
                : "you're on the board"
              : address
                ? "earn your first POP to get a rank"
                : "set up your wallet to get a rank"}
          </p>
        </Card>

        {/* 2. POINTS — the number that matters */}
        <Card className="border-white/12 bg-gradient-to-br from-primary/15 via-primary/5 to-background p-6 text-center">
          <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            Your points
          </p>
          <div className="mt-2 flex items-baseline justify-center gap-2">
            <span className="font-display text-6xl font-bold leading-none tabular-nums">
              {points === null ? "—" : fmt(points)}
            </span>
            <span className="font-display text-lg font-semibold text-muted-foreground">POP</span>
          </div>
          <img src={coin} alt="" aria-hidden className="mx-auto mt-3 h-8 w-8 opacity-80" />
          <p className="mt-2 text-xs text-muted-foreground">
            {loadingMine ? "checking your ledger…" : "POP earned, all time"}
          </p>
        </Card>

        {/* 3. POINT HISTORY — every credit, newest first */}
        <section>
          {sectionTitle("Point history")}
          <div className="mt-2 divide-y divide-border rounded-2xl border border-border bg-card">
            {!address ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                Set up your wallet to see your point history.
              </p>
            ) : loadingMine ? (
              <div className="flex justify-center p-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : rewards.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                No POP yet — check in at an event or pay with TSD to earn your first point.
              </p>
            ) : (
              rewards.map((r) => (
                <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{rewardLabel(r.source)}</p>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString()}
                      {r.status === "pending" && " · settling"}
                      {r.status === "failed" && " · failed"}
                      {r.tx_hash && (
                        <>
                          {" · "}
                          <a
                            href={`https://mempool.texitcoin.org/tx/${r.tx_hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            tx
                          </a>
                        </>
                      )}
                    </p>
                  </div>
                  <span
                    className={`font-display text-sm font-semibold tabular-nums ${
                      r.status === "failed" ? "text-muted-foreground line-through" : "text-primary"
                    }`}
                  >
                    +{fmt(Number(r.amount))}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        {/* 4. WAYS TO EARN — the three doors */}
        <section>
          {sectionTitle("Ways to earn")}
          <div className="mt-2 space-y-3">
            <Link to="/events" className="block">
              <Card className="flex items-center gap-4 border-white/12 bg-white/5 p-4 transition hover:bg-white/10">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <CalendarDays className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-base font-semibold uppercase tracking-wide">
                    Event
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Sign up, then check in at the door
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-display text-sm font-semibold text-primary">
                    10 + 25 POP
                  </span>
                  <ChevronRight className="ml-auto mt-1 h-4 w-4 text-muted-foreground" />
                </span>
              </Card>
            </Link>

            <Link to="/merchants" className="block">
              <Card className="flex items-center gap-4 border-white/12 bg-white/5 p-4 transition hover:bg-white/10">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <ShoppingBag className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-base font-semibold uppercase tracking-wide">
                    Shop
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Pay with TSD at a NectarPay store
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-display text-sm font-semibold text-primary">
                    1 POP / $1
                  </span>
                  <ChevronRight className="ml-auto mt-1 h-4 w-4 text-muted-foreground" />
                </span>
              </Card>
            </Link>

            <Card className="border-white/12 bg-white/5 p-4">
              <div className="flex items-center gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <Users className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-base font-semibold uppercase tracking-wide">
                    Refer
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Send a friend your invite link
                  </span>
                </span>
                <span className="shrink-0 rounded-full border border-white/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                  soon
                </span>
              </div>
              {address ? (
                <button
                  type="button"
                  onClick={copyInvite}
                  className="mt-3 flex w-full items-center justify-between gap-2 rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-left font-mono text-[11px] text-muted-foreground transition hover:text-foreground"
                >
                  <span className="truncate">{inviteLink}</span>
                  {copied ? (
                    <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 shrink-0" />
                  )}
                </button>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">
                  Your invite link appears once your wallet is set up.
                </p>
              )}
              <p className="mt-2 text-[11px] text-muted-foreground">
                Referral POP isn't live yet. Keep the link — we will tell you the day it starts
                crediting.
              </p>
            </Card>
          </div>
        </section>

        {/* Top of the board — the people you're chasing */}
        <section>
          {sectionTitle("Top POP")}
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
                    <span className="font-display text-sm font-semibold tabular-nums">
                      {fmt(l.total)}
                    </span>
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
      </main>
      <BottomNavSpacer />
      <BottomNav />
    </div>
  );
}
