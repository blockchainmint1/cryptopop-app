import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { QRCodeSVG } from "qrcode.react";
import {
  Copy,
  Check,
  LogOut,
  AlertTriangle,
  ScanLine,
  Shield,
  ChevronDown,
  ChevronUp,
  Download,
  X,
  RefreshCw,
  CalendarDays,
  MapPin,
  QrCode,
  Sparkles,
  Coins,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
// (mnemonic UX removed — wallet is custodial, email-derived)
import { useEnsureWallet } from "@/hooks/use-ensure-wallet";
import { getTxcBalance, getTxcTxs, type TxcTx } from "@/lib/wallet.functions";
import { getPopChainBalance } from "@/lib/pop-chain.functions";
import { getMyEventMemberships, type MyEventMembership } from "@/lib/my-events.functions";
import { getMyPopSummary } from "@/lib/pop-summary.functions";
import { getMyAdminStatus } from "@/lib/admin-role.functions";
import { PUBLIC_EVENTS, upcomingPublicEvents } from "@/lib/public-events";

type RecentClaim = {
  id: string;
  total: number;
  created_at: string;
  status: "pending" | "minted" | "failed";
  tx_hash: string | null;
  events: { name: string } | null;
};

type PopAward = {
  id: string;
  amount: number;
  source: string;
  status: "pending" | "sent" | "failed";
  tx_hash: string | null;
  created_at: string;
};

type PopTx = {
  id: string;
  label: string;
  amount: number;
  created_at: string;
  status: string;
  tx_hash: string | null;
  pending: boolean;
  failed: boolean;
};

const BACKED_UP_KEY = "cryptopop:backed-up";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({ meta: [{ title: "Wallet — CryptoPOP" }] }),
  component: WalletHome,
});

function prettySource(source: string): string {
  switch (source) {
    case "signup":
    case "event_signup":
      return "Event signup bonus";
    case "scan":
    case "claim":
      return "Event scan";
    case "referral":
      return "Referral bonus";
    case "quiz":
      return "Quiz reward";
    default:
      return source.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

function WalletHome() {
  const { user, signOut } = useAuth();
  const { address, settingUp, error: walletError, retry } = useEnsureWallet();
  const fetchTxc = useServerFn(getTxcBalance);
  const fetchTxcTxs = useServerFn(getTxcTxs);
  const fetchPopChain = useServerFn(getPopChainBalance);
  const fetchMyEvents = useServerFn(getMyEventMemberships);
  const fetchPopSummary = useServerFn(getMyPopSummary);
  const getAdminStatus = useServerFn(getMyAdminStatus);

  const [balance, setBalance] = useState<number>(0);
  const [eventsAttended, setEventsAttended] = useState<number>(0);
  const [copied, setCopied] = useState(false);
  // (mnemonic UX removed)
  const [showQr, setShowQr] = useState(false);
  const [claims, setClaims] = useState<RecentClaim[]>([]);
  const [awards, setAwards] = useState<PopAward[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [txc, setTxc] = useState<number | null>(null);
  const [txcTxs, setTxcTxs] = useState<TxcTx[]>([]);
  const [myEvents, setMyEvents] = useState<MyEventMembership[]>([]);
  const [eventsTab, setEventsTab] = useState<"mine" | "find">("mine");
  const [backedUp, setBackedUp] = useState(false);

  useEffect(() => {
    setBackedUp(localStorage.getItem(BACKED_UP_KEY) === "1");
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const [summary, { data: cl }, adminStatus] = await Promise.all([
        fetchPopSummary({}).catch((e) => {
          console.error("[app] pop summary failed", e);
          return { balance: 0, eventsAttended: 0, awards: [] as PopAward[] };
        }),
        supabase
          .from("claims")
          .select("id, total, created_at, status, tx_hash, events(name)")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(20),
        getAdminStatus().catch(() => ({ isAdmin: false })),
      ]);
      if (cancelled) return;
      setBalance(Number(summary.balance));
      setEventsAttended(summary.eventsAttended);
      setAwards(summary.awards as PopAward[]);
      if (cl) setClaims(cl as unknown as RecentClaim[]);
      setIsAdmin(adminStatus.isAdmin);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, getAdminStatus, fetchPopSummary]);

  // Fetch TXC chain transactions once we have an address
  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    fetchTxcTxs({ data: { address } })
      .then((r) => {
        if (!cancelled) setTxcTxs(r.txs);
      })
      .catch(() => {
        if (!cancelled) setTxcTxs([]);
      });
    return () => {
      cancelled = true;
    };
  }, [address, fetchTxcTxs]);

  // Fetch event memberships (which public events the user has signed up to)
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetchMyEvents({})
      .then((r) => {
        if (!cancelled) setMyEvents(r.memberships);
      })
      .catch(() => {
        if (!cancelled) setMyEvents([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user, fetchMyEvents]);

  // Fetch TXC chain balance once we have an address
  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    fetchTxc({ data: { address } })
      .then((r) => {
        if (!cancelled) setTxc(r.txc);
      })
      .catch(() => {
        if (!cancelled) setTxc(null);
      });
    return () => {
      cancelled = true;
    };
  }, [address, fetchTxc]);

  // On-chain POP balance from Omni token. Only override the awards-derived
  // balance if the chain reports MORE than we've credited locally — a
  // freshly-broadcast award sits at 0 on-chain until it confirms, and we
  // don't want that to wipe the credited balance the user already earned.
  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    fetchPopChain({ data: { address } })
      .then((r) => {
        if (cancelled || r.balance === null) return;
        setBalance((prev) => (r.balance! > prev ? r.balance! : prev));
      })
      .catch(() => {
        /* keep awards-derived value */
      });
    return () => {
      cancelled = true;
    };
  }, [address, fetchPopChain]);

  const copy = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    toast.success("Address copied");
    setTimeout(() => setCopied(false), 1500);
  };

  const dismissBackup = () => {
    localStorage.setItem(BACKED_UP_KEY, "1");
    setBackedUp(true);
  };

  // WalletID = 2nd through 7th characters of the address (6 chars)
  const shortAddr = address ? address.slice(1, 7) : "";

  // Merge POP claims + awards into one transaction list, newest first.
  const popTxs: PopTx[] = [
    ...claims.map<PopTx>((c) => ({
      id: `claim-${c.id}`,
      label: c.events?.name ?? "Event reward",
      amount: Number(c.total),
      created_at: c.created_at,
      status: c.status,
      tx_hash: c.tx_hash,
      pending: c.status === "pending",
      failed: c.status === "failed",
    })),
    ...awards.map<PopTx>((a) => ({
      id: `award-${a.id}`,
      label: prettySource(a.source),
      amount: Number(a.amount),
      created_at: a.created_at,
      status: a.status,
      tx_hash: a.tx_hash,
      pending: a.status === "pending",
      failed: a.status === "failed",
    })),
  ].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));

  // Upcoming-events tabs: derive from PUBLIC_EVENTS + the user's memberships.
  const upcoming = upcomingPublicEvents();
  const mySlugs = new Set(myEvents.map((m) => m.slug));
  const mineEvents = upcoming.filter((e) => mySlugs.has(e.slug));
  const findEvents = upcoming.filter((e) => !mySlugs.has(e.slug));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/50">
        <div className="mx-auto flex max-w-md items-center justify-between px-6 py-4">
          <span className="font-display text-lg font-semibold tracking-tight">CryptoPOP</span>
          <div className="flex items-center gap-1">
            <Button asChild variant="ghost" size="sm">
              <Link to="/mission">Mission</Link>
            </Button>
            {isAdmin && (
              <Button asChild variant="ghost" size="sm" className="text-primary">
                <Link to="/admin">
                  <Shield className="h-4 w-4 mr-1" />
                  Admin
                </Link>
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-4 px-6 py-8">
        {/* POP balance — hero */}
        <Card className="overflow-hidden border-0 bg-gradient-to-br from-primary/15 via-primary/5 to-background p-8 text-center shadow-lg">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">POP Balance</p>
          <div className="mt-3 flex items-baseline justify-center gap-2">
            <span className="font-display text-6xl font-bold tabular-nums">
              {balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </span>
            <span className="text-lg font-medium text-muted-foreground">POP</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {eventsAttended} {eventsAttended === 1 ? "event" : "events"} attended
          </p>
          {address ? (
            <Button asChild size="lg" className="mt-6 w-full">
              <Link to="/scan">
                <ScanLine className="h-5 w-5 mr-2" />
                Scan to Earn
              </Link>
            </Button>
          ) : (
            <Button size="lg" className="mt-6 w-full" disabled={settingUp} onClick={retry}>
              {settingUp ? (
                <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-5 w-5 mr-2" />
              )}
              {settingUp ? "Setting up wallet…" : "Retry wallet setup"}
            </Button>
          )}
          {walletError && (
            <p className="mt-3 break-words text-xs text-destructive">
              {walletError.slice(0, 200)}
            </p>
          )}
        </Card>

        {/* Recent activity moved below the TXC wallet card */}

        {/* Upcoming events — My events / Find events */}
        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 pt-4 pb-0">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Upcoming events
            </h2>
          </div>
          <div role="tablist" className="flex border-b border-border px-2">
            {([
              ["mine", `My events${mineEvents.length ? ` · ${mineEvents.length}` : ""}`],
              ["find", `Find events${findEvents.length ? ` · ${findEvents.length}` : ""}`],
            ] as const).map(([key, label]) => {
              const active = eventsTab === key;
              return (
                <button
                  key={key}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setEventsTab(key)}
                  className={`relative flex-1 px-3 py-3 text-xs font-semibold uppercase tracking-wider transition ${
                    active
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                  {active && (
                    <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-primary" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="p-4">
            {eventsTab === "mine" ? (
              mineEvents.length === 0 ? (
                <div className="py-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    You haven't signed up for any upcoming events yet.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3"
                    onClick={() => setEventsTab("find")}
                  >
                    Find events
                  </Button>
                </div>
              ) : (
                <ul className="space-y-3">
                  {mineEvents.map((ev) => {
                    const membership = myEvents.find((m) => m.slug === ev.slug);
                    const checkedIn = !!membership?.checked_in_at;
                    return (
                      <li key={ev.slug}>
                        <EventCard
                          ev={ev}
                          ctaLabel={checkedIn ? "Checked in" : "View details"}
                          ctaDisabled={checkedIn}
                          badge={checkedIn ? "Checked in" : "Going"}
                        />
                      </li>
                    );
                  })}
                </ul>
              )
            ) : findEvents.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No new events right now. Check back soon.
              </p>
            ) : (
              <ul className="space-y-3">
                {findEvents.map((ev) => (
                  <li key={ev.slug}>
                    <EventCard ev={ev} ctaLabel="Sign up" />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        {/* Backup nudge — soft, dismissible */}
        {address && !backedUp && (
          <Card className="relative border-amber-500/30 bg-amber-500/5 p-5">
            <button
              onClick={dismissBackup}
              className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold">Take self-custody (optional)</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Your wallet is managed for you against your email — sign in anywhere
                  and your POP is there. To control the keys yourself, export the
                  private key and import it into any TXC-compatible wallet.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" asChild>
                    <Link to="/recover-wallet">
                      <Download className="mr-1.5 h-4 w-4" /> Export key
                    </Link>
                  </Button>
                  <Button size="sm" variant="ghost" onClick={dismissBackup}>
                    Dismiss
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* TXC wallet — compact, collapsed */}
        <Card className="overflow-hidden p-0">
          <button
            onClick={() => setShowQr((v) => !v)}
            className="flex w-full items-center justify-between gap-3 p-4 text-left transition hover:bg-muted/40"
          >
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                TXC Wallet
              </p>
              <p className="mt-0.5 truncate font-mono text-xs">
                {address ? shortAddr : "Setting up…"}
              </p>
            </div>
            <div className="text-right">
              <p className="font-display text-sm font-semibold tabular-nums">
                {txc === null ? "—" : txc.toFixed(4)}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">TXC</p>
            </div>
            {showQr ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          {showQr && address && (
            <div className="border-t border-border p-4">
              <div className="flex justify-center rounded-lg bg-white p-4">
                <QRCodeSVG value={address} size={160} level="M" />
              </div>
              <button
                onClick={copy}
                className="mt-3 flex w-full items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-left font-mono text-[11px] transition hover:bg-muted"
              >
                <span className="truncate">{address}</span>
                {copied ? (
                  <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                ) : (
                  <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )}
              </button>
            </div>
          )}
        </Card>

        {/* Transactions */}
        <Card className="p-6">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            POP Transactions
          </h2>
          {popTxs.length === 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">
              No POP transactions yet. Attend an event to earn your first POP.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {popTxs.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{t.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(t.created_at).toLocaleString()}
                      {t.pending && " · settling…"}
                      {t.failed && " · mint failed"}
                      {t.tx_hash && (
                        <>
                          {" · "}
                          <a
                            href={`https://mempool.texitcoin.org/tx/${t.tx_hash}`}
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
                    className={`font-display text-sm font-bold tabular-nums ${
                      t.failed ? "text-muted-foreground line-through" : "text-primary"
                    }`}
                  >
                    +{t.amount} POP
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            TXC Transactions
          </h2>
          {!address ? (
            <p className="mt-3 text-xs text-muted-foreground">Wallet still setting up…</p>
          ) : txcTxs.length === 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">
              No on-chain TXC transactions yet.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {txcTxs.map((t) => {
                const incoming = t.delta_sats >= 0;
                const txc = Math.abs(t.delta_sats) / 1e8;
                return (
                  <li key={t.txid} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {incoming ? "Received" : "Sent"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t.block_time
                          ? new Date(t.block_time * 1000).toLocaleString()
                          : "Unconfirmed"}
                        {" · "}
                        <a
                          href={`https://mempool.texitcoin.org/tx/${t.txid}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {t.txid.slice(0, 8)}…
                        </a>
                        {!t.confirmed && " · pending"}
                      </p>
                    </div>
                    <span
                      className={`font-display text-sm font-bold tabular-nums ${
                        incoming ? "text-primary" : "text-muted-foreground"
                      }`}
                    >
                      {incoming ? "+" : "−"}
                      {txc.toFixed(4)} TXC
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>


        {isAdmin && (
          <Card className="border-primary/30 bg-primary/5 p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <p className="text-sm font-semibold">Admin tools</p>
                <p className="text-xs text-muted-foreground">Manage signups & event QR</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm">
                <Link to="/admin">Signups & check-in</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link
                  to="/admin/events/$id"
                  params={{ id: "aaaaaaaa-0000-0000-0000-000000000001" }}
                >
                  Event QR poster
                </Link>
              </Button>
            </div>
          </Card>
        )}

        <p className="pt-2 text-center text-xs text-muted-foreground">
          Signed in as {user?.email}
        </p>
      </main>
    </div>
  );
}

function EventCard({
  ev,
  ctaLabel,
  ctaDisabled,
  badge,
}: {
  ev: (typeof PUBLIC_EVENTS)[number];
  ctaLabel: string;
  ctaDisabled?: boolean;
  badge?: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card/40">
      {ev.heroUrl && (
        <div className="relative aspect-[16/7] w-full overflow-hidden">
          <img src={ev.heroUrl} alt="" className="h-full w-full object-cover" />
          {badge && (
            <span className="absolute right-2 top-2 rounded-full bg-primary px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground shadow">
              {badge}
            </span>
          )}
        </div>
      )}
      <div className="space-y-2 p-4">
        <p className="font-display text-sm font-semibold leading-snug">{ev.name}</p>
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <CalendarDays className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{ev.dateLabel}</span>
        </p>
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{ev.location}</span>
        </p>
        {ctaDisabled ? (
          <Button size="sm" variant="outline" disabled className="mt-2 w-full">
            {ctaLabel}
          </Button>
        ) : (
          <Button asChild size="sm" className="mt-2 w-full">
            <Link to="/events/$slug/rsvp" params={{ slug: ev.slug }}>
              {ctaLabel}
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}

