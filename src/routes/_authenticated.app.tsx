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
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { getOrCreateMnemonic } from "@/lib/wallet";
import { useEnsureWallet } from "@/hooks/use-ensure-wallet";
import { getTxcBalance, getTxcTxs, type TxcTx } from "@/lib/wallet.functions";

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

function WalletHome() {
  const { user, signOut } = useAuth();
  const { address, settingUp, error: walletError, retry } = useEnsureWallet();
  const fetchTxc = useServerFn(getTxcBalance);
  const fetchTxcTxs = useServerFn(getTxcTxs);

  const [balance, setBalance] = useState<number>(0);
  const [eventsAttended, setEventsAttended] = useState<number>(0);
  const [copied, setCopied] = useState(false);
  const [showMnemonic, setShowMnemonic] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [claims, setClaims] = useState<RecentClaim[]>([]);
  const [awards, setAwards] = useState<PopAward[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [txc, setTxc] = useState<number | null>(null);
  const [txcTxs, setTxcTxs] = useState<TxcTx[]>([]);
  const [backedUp, setBackedUp] = useState(false);

  useEffect(() => {
    setBackedUp(localStorage.getItem(BACKED_UP_KEY) === "1");
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: bal } = await supabase
        .from("pop_balance_mirror")
        .select("balance, events_attended")
        .eq("user_id", user.id)
        .maybeSingle();
      if (bal) {
        setBalance(Number(bal.balance));
        setEventsAttended(bal.events_attended);
      }

      const [{ data: cl }, { data: aw }, { data: roleRow }] = await Promise.all([
        supabase
          .from("claims")
          .select("id, total, created_at, status, tx_hash, events(name)")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(20),
        user.email
          ? supabase
              .from("pop_awards")
              .select("id, amount, source, status, tx_hash, created_at")
              .eq("email", user.email.toLowerCase())
              .order("created_at", { ascending: false })
              .limit(20)
          : Promise.resolve({ data: [] as PopAward[] }),
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle(),
      ]);
      if (cl) setClaims(cl as unknown as RecentClaim[]);
      if (aw) setAwards(aw as unknown as PopAward[]);
      setIsAdmin(!!roleRow);
    })();
  }, [user]);

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

  const copy = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    toast.success("Address copied");
    setTimeout(() => setCopied(false), 1500);
  };

  const downloadPhrase = () => {
    const m = getOrCreateMnemonic();
    const body =
      `CryptoPOP Recovery Phrase\n` +
      `========================\n\n` +
      `${m}\n\n` +
      `Anyone with these 12 words controls your wallet. Store offline.`;
    const blob = new Blob([body], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cryptopop-recovery-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    localStorage.setItem(BACKED_UP_KEY, "1");
    setBackedUp(true);
    toast.success("Recovery phrase downloaded");
  };

  const dismissBackup = () => {
    localStorage.setItem(BACKED_UP_KEY, "1");
    setBackedUp(true);
  };

  // WalletID = 2nd through 7th characters of the address (6 chars)
  const shortAddr = address ? address.slice(1, 7) : "";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/50">
        <div className="mx-auto flex max-w-md items-center justify-between px-6 py-4">
          <span className="font-display text-lg font-semibold tracking-tight">CryptoPOP</span>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </Button>
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

        {/* Recent claims */}
        {claims.length > 0 && (
          <Card className="p-6">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Recent activity
            </h2>
            <ul className="mt-4 divide-y divide-border">
              {claims.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.events?.name ?? "Event"}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(c.created_at).toLocaleString()}
                      {c.status === "pending" && " · settling…"}
                      {c.status === "failed" && " · mint failed"}
                      {c.tx_hash && (
                        <>
                          {" · "}
                          <a
                            href={`https://mempool.texitcoin.org/tx/${c.tx_hash}`}
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
                  <span className="font-display text-sm font-bold text-primary">
                    +{Number(c.total)} POP
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}

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
                <h3 className="text-sm font-semibold">Save your recovery phrase</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Your seed is also encrypted and backed up to your account — you can
                  always recover from any device. Saving these 12 words offline is good practice.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setShowMnemonic((v) => !v)}>
                    {showMnemonic ? "Hide" : "Reveal"}
                  </Button>
                  <Button size="sm" onClick={downloadPhrase}>
                    <Download className="mr-1.5 h-4 w-4" /> Download .txt
                  </Button>
                  <Button size="sm" variant="ghost" asChild>
                    <Link to="/recover-wallet">Recover</Link>
                  </Button>
                </div>
                {showMnemonic && (
                  <div className="mt-3 grid grid-cols-3 gap-2 rounded-md bg-background/60 p-3 font-mono text-xs">
                    {getOrCreateMnemonic()
                      .split(" ")
                      .map((w, i) => (
                        <div key={i} className="flex items-baseline gap-1.5">
                          <span className="text-muted-foreground">{i + 1}.</span>
                          <span>{w}</span>
                        </div>
                      ))}
                  </div>
                )}
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
                <Link to="/admin/signups">Signups & check-in</Link>
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
