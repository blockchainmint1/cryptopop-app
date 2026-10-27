import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  Camera,
  Check,
  ChevronDown,
  Copy,
  Eye,
  EyeOff,
  Fingerprint,
  Gift,
  Lock,
  RefreshCw,
  Plus,
  ScanLine,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Bell,
  Trophy,
  X,
  Store,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useWallet } from "@/lib/wallet/wallet-context";
import { unlockVault, isBackedUp, markBackedUp } from "@/lib/wallet/vault";
import {
  disableBiometric,
  enableBiometric,
  getBiometricStatus,
} from "@/lib/native/biometric";
import { getAddressChainSummary } from "@/lib/chain-public.functions";
import {
  getAddressActivity,
  getAddressRewards,
  type WalletReward,
  type WalletTx,
} from "@/lib/wallet-activity.functions";
import { checkForUpdate, applyUpdate, appVersionLabel } from "@/lib/native/updates";
import { CloudBackupCard } from "./cloud-backup-card";
import { useAuth } from "@/hooks/use-auth";
import { deleteMyAccount } from "@/lib/account.functions";
import { registerPushDevice, setPushEnabled } from "@/lib/push.functions";
import { pushAvailable, pushPreference, registerPush, setPushPreference } from "@/lib/native/push";
import { type AssetId } from "@/lib/wallet/assets";
import { loadHiddenChains } from "@/lib/wallet/hidden-chains";
import { loadMarketSlug, marketCode } from "@/lib/wallet/region";

import { parseScan } from "@/lib/wallet/scan-parse";
import { isEcosystemSite, loginSiteName } from "@/lib/ecosystem/hosts";
import { loadTxLabels, type TxLabel } from "@/lib/wallet/tx-labels";
import { loadContacts, type Contact } from "@/lib/wallet/address-book";
import { SendSheet, type SendPrefill, type SendSource } from "./send-sheet";
import { NectarPaySheet } from "./nectarpay-sheet";
import { WalletLoginSheet, type WalletLoginRequest } from "./wallet-login-sheet";
import { QrScanDialog } from "./qr-scan-dialog";
import { TopUpSheet } from "./topup-sheet";
import { InstallAppPrompt } from "@/components/install-app-prompt";
import { StoreRewardsCard } from "./store-rewards-card";
import { TapToPayCard } from "./tap-to-pay-card";
import coin from "@/assets/cryptopop-coin.png";
import { BottomNav } from "@/components/bottom-nav";




type ChainId = AssetId;
/** Show the "running low" reminder under this many TSD. */
const LOW_TSD = 10;

export function WalletDashboard() {
  const { address, legacyAddress, origin, mnemonic } = useWallet();
  const navigate = useNavigate();
  const fetchSummary = useServerFn(getAddressChainSummary);
  const fetchActivity = useServerFn(getAddressActivity);
  const fetchRewards = useServerFn(getAddressRewards);

  const [pop, setPop] = useState<number | null>(null);
  const [phpop, setPhpop] = useState<number | null>(null);
  const [tsd, setTsd] = useState<number | null>(null);
  const [txc, setTxc] = useState<number | null>(null);
  const [sources, setSources] = useState<SendSource[]>([]);
  const [txs, setTxs] = useState<WalletTx[]>([]);
  const [rewards, setRewards] = useState<WalletReward[]>([]);
  const [txLabels, setTxLabels] = useState<Record<string, TxLabel>>({});
  const [backupDismissed, setBackupDismissed] = useState(true);

  const [rank, setRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const [hidden, setHidden] = useState<ChainId[]>([]);
  const [marketSlug, setMarketSlug] = useState<string | null>(null);


  const [showAllTx, setShowAllTx] = useState(false);
  const [txOpen, setTxOpen] = useState(true);
  const [lowDismissed, setLowDismissed] = useState(true);
  useEffect(() => {
    try {
      const at = Number(localStorage.getItem("cp-low-tsd-dismissed") ?? 0);
      setLowDismissed(Date.now() - at < 24 * 3600_000);
      setTxOpen(localStorage.getItem("cp-tx-open") !== "0");
    } catch {
      setLowDismissed(false);
    }
  }, []);
  const [scanOpen, setScanOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [sendPrefill, setSendPrefill] = useState<SendPrefill | null>(null);
  const [nectarReq, setNectarReq] = useState<{ invoiceId: string; nonce: string | null } | null>(null);
  const [loginReq, setLoginReq] = useState<WalletLoginRequest | null>(null);
  const [addValueOpen, setAddValueOpen] = useState(false);

  useEffect(() => setHidden(loadHiddenChains()), []);
  useEffect(() => setMarketSlug(loadMarketSlug()), []);
  useEffect(() => setTxLabels(loadTxLabels()), []);
  const [contacts, setContacts] = useState<Record<string, Contact>>({});
  useEffect(() => setContacts(Object.fromEntries(loadContacts().map((c) => [c.address, c]))), []);

  useEffect(() => setBackupDismissed(isBackedUp()), []);

  const refresh = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    // Older seeds hold funds on the pre-SLIP-44 path, so read both addresses
    // and show one combined balance.
    const addresses = legacyAddress ? [address, legacyAddress] : [address];
    try {
      const [summaries, activities, rewardsRes] = await Promise.all([
        Promise.all(addresses.map((a) => fetchSummary({ data: { address: a } }))),
        Promise.all(addresses.map((a) => fetchActivity({ data: { address: a } }))),
        fetchRewards({ data: { address } }),
      ]);
      const sum = (pick: (s: (typeof summaries)[number]) => number | null) =>
        summaries.reduce<number | null>(
          (acc, s) => (pick(s) == null ? acc : (acc ?? 0) + (pick(s) as number)),
          null,
        );
      setPop(sum((s) => s.pop));
      setPhpop(sum((s) => s.phpop));
      setTsd(sum((s) => s.tsd));
      setTxc(sum((s) => s.txc));
      setSources(
        addresses.map((a, i) => ({
          address: a,
          balances: {
            pop: summaries[i]?.pop ?? null,
            phpop: summaries[i]?.phpop ?? null,
            tsd: summaries[i]?.tsd ?? null,
            txc: summaries[i]?.txc ?? null,
          },
        })),
      );
      setTxs(activities.flatMap((a) => a.txs).sort((a, b) => (b.time ?? 0) - (a.time ?? 0)));
      setTxLabels(loadTxLabels());
      setRewards(rewardsRes.rewards);
      setRank(rewardsRes.rank.rank);
    } catch (e) {
      console.error("[wallet] refresh failed", e);
    } finally {
      setLoading(false);
    }
  }, [address, legacyAddress, fetchSummary, fetchActivity, fetchRewards]);


  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Native push: register this device once the wallet address is known.
  const savePushToken = useServerFn(registerPushDevice);
  useEffect(() => {
    if (!address || !pushAvailable() || !pushPreference()) return;
    void registerPush({
      onToken: async (token, platform) => {
        try {
          await savePushToken({ data: { token, platform, walletAddress: address, enabled: true } });
        } catch (e) {
          console.error("push token save failed", e);
        }
      },
      onTap: (url) => {
        if (url.startsWith("/") && !url.startsWith("//") && !url.includes("\\")) void navigate({ to: url });
      },
    });
  }, [address, savePushToken, navigate]);

  const tsdVisible = !hidden.includes("tsd");


  async function copyAddress() {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function onScan(text: string) {
    setScanOpen(false);
    const intent = parseScan(text);

    switch (intent.kind) {
      case "nectarpay":
        setNectarReq({ invoiceId: intent.invoiceId, nonce: intent.nonce });
        return;
      case "wallet_login":
        setLoginReq(intent);
        return;
      case "payment":
        if (intent.asset === "pop" || intent.asset === "phpop") {
          toast.info("POP is a scoreboard token — it can't be sent or spent.");
          return;
        }
        setSendPrefill({
          to: intent.to,
          amount: intent.amount,
          asset: intent.asset,
          merchant: intent.merchant,
          memo: intent.memo,
        });
        setSendOpen(true);
        toast.success(
          intent.merchant ? `Paying ${intent.merchant}` : "Payment request loaded",
        );
        return;
      case "address":
        setSendPrefill({ to: intent.address, asset: "tsd" });
        setSendOpen(true);
        return;
      case "award":
        toast.success("POP code — claiming");
        void navigate({ to: intent.path });
        return;
      case "checkin":
        toast.success("Event check-in — verifying your location");
        void navigate({ to: "/scan", search: { qr: intent.raw } as never });
        return;

      case "ecosystem_link":
        toast.success("Wallet link code — opening Ecosystem links");
        void navigate({ to: "/settings", search: { link: intent.raw } as never });
        return;

      case "pass":
      case "link": {
        // A link code QR from an ecosystem site isn't a page to visit —
        // open the Ecosystem links card with it pre-filled.
        let host: string | null = null;
        try {
          host = new URL(intent.raw).hostname;
        } catch {
          /* not a URL */
        }
        if (host && isEcosystemSite(host)) {
          toast.success(`Link code from ${loginSiteName(host)} — opening Ecosystem links`);
          void navigate({ to: "/settings", search: { link: intent.raw } as never });
          return;
        }
        void navigate({ to: intent.path });
        return;
      }
      case "words":
        toast.info("That's a recovery phrase — use Settings → restore to import it");
        return;
      default:
        void navigator.clipboard.writeText(intent.raw).catch(() => undefined);
        toast.message("Scanned code copied", { description: intent.raw.slice(0, 80) });
    }
  }

  const shownTx = showAllTx ? txs : txs.slice(0, 5);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center gap-2 px-4 pt-6">
        <Link
          to="/settings"
          search={{}}
          aria-label="POP market"
          className="flex h-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 px-3 font-display text-sm font-bold uppercase tracking-wider text-foreground transition hover:bg-white/10"
        >
          {marketCode(marketSlug)}
        </Link>
        <div className="flex flex-1 justify-center">
          <Link
            to="/leaderboard"
            aria-label="View the POP leaderboard"
            className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-muted-foreground transition hover:text-foreground"
          >
            <Trophy className="h-3.5 w-3.5 text-primary" />
            {rank ? `POP Rank #${rank}` : "Unranked"}
          </Link>
        </div>
        <div className="flex shrink-0 items-center">
          <Button variant="ghost" size="icon" asChild aria-label="Settings">
            <Link to="/settings" search={{}}>
              <Settings2 className="h-5 w-5" />
            </Link>
          </Button>

          <Button variant="ghost" size="icon" onClick={() => setScanOpen(true)} aria-label="Scan a code">
            <Camera className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md space-y-4 px-4 pb-32 pt-4">
        {/* Total balance across chains */}
        <Card className="relative overflow-hidden border-white/12 bg-white/5 p-6 text-center backdrop-blur-xl">
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            aria-label="Refresh balance"
            className="absolute right-3 top-3 rounded-full p-2 text-muted-foreground transition hover:text-foreground"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <img src={coin} alt="" aria-hidden className="mx-auto h-12 w-12" />
          <p className="mt-3 font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Total balance
          </p>
          <p className="font-display text-6xl font-bold leading-none">
            {loading && tsd === null ? "—" : (tsd ?? 0).toFixed(2)}
          </p>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            Texas Stable Dollar
          </p>
        </Card>

        {/* Send / receive */}
        <div className="flex gap-3">
          <Button
            className="h-12 flex-1 rounded-full"
            onClick={() => {
              setSendPrefill(null);
              setSendOpen(true);
            }}
          >
            <ArrowUpRight className="mr-1.5 h-4 w-4" /> Send
          </Button>
          <Button
            variant="secondary"
            className="h-12 flex-1 rounded-full"
            onClick={() => setReceiveOpen(true)}
          >
            <ArrowDownLeft className="mr-1.5 h-4 w-4" /> Receive
          </Button>
        </div>

        {/* Top up (VectorPay handoff) */}
        <Button
          variant="secondary"
          className="h-12 w-full rounded-full"
          onClick={() => setAddValueOpen(true)}
        >
          <Plus className="mr-1.5 h-4 w-4" /> Top up
        </Button>



        {/* Running low on TSD */}
        {tsdVisible && tsd !== null && tsd < LOW_TSD && !lowDismissed && (
          <Card className="relative border-amber-400/40 bg-amber-400/10 p-4 text-sm">
            <button
              type="button"
              aria-label="Hide low balance reminder"
              onClick={() => {
                try {
                  localStorage.setItem("cp-low-tsd-dismissed", String(Date.now()));
                } catch {
                  /* ignore */
                }
                setLowDismissed(true);
              }}
              className="absolute right-2 top-2 rounded-full p-1.5 text-muted-foreground transition hover:bg-white/10 hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
            <p className="pr-8 font-semibold">You're running low on TSD</p>
            <p className="mt-1 text-muted-foreground">
              Top-ups can take a few minutes, so top up early and you're ready to pay.
            </p>
            <Button size="sm" className="mt-3 rounded-full" onClick={() => setAddValueOpen(true)}>
              <Plus className="mr-1 h-4 w-4" /> Top up
            </Button>
          </Card>
        )}

        <InstallAppPrompt />

        {/* Recent activity */}
        <Card className="space-y-3 border-white/12 bg-white/5 p-5 backdrop-blur-xl">
          <button
            type="button"
            className="flex w-full items-center justify-between font-mono text-xs uppercase tracking-widest text-muted-foreground"
            aria-expanded={txOpen}
            onClick={() => {
              const next = !txOpen;
              setTxOpen(next);
              try {
                localStorage.setItem("cp-tx-open", next ? "1" : "0");
              } catch {
                /* ignore */
              }
            }}
          >
            <span>
              Recent activity{txs.length > 0 ? ` · ${txs.length}` : ""}
            </span>
            <ChevronDown className={`h-4 w-4 transition ${txOpen ? "rotate-180" : ""}`} />
          </button>
          {!txOpen ? null : shownTx.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {loading ? "Loading…" : "No transactions yet."}
            </p>
          ) : (
            <ul className="space-y-2">
              {shownTx.map((t) => (
                <li key={t.txid}>
                <Link
                  to="/tx/$txid"
                  params={{ txid: t.txid }}
                  className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-1 transition-colors hover:bg-white/5"
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/12 ${
                      t.direction === "in" ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {t.direction === "in" ? (
                      <ArrowDownLeft className="h-4 w-4" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">
                      {txLabels[t.txid]?.merchant ??
                        (t.counterparty ? contacts[t.counterparty]?.name : undefined) ??
                        (t.direction === "in"
                          ? t.token
                            ? `Received ${t.token.symbol}`
                            : "Received"
                          : t.token
                            ? `Sent ${t.token.symbol}`
                            : "Sent")}
                      {!t.confirmed && (
                        <span className="ml-1 text-xs text-muted-foreground">· pending</span>
                      )}
                    </p>
                    {txLabels[t.txid]?.memo && (
                      <p className="truncate text-xs text-muted-foreground">
                        {txLabels[t.txid]!.memo}
                      </p>
                    )}
                    <p className="truncate font-mono text-[10px] text-muted-foreground">
                      {t.time ? new Date(t.time * 1000).toLocaleDateString() : "—"} ·{" "}
                      {t.txid.slice(0, 10)}…
                    </p>
                  </div>

                  <p className="shrink-0 font-mono text-xs">
                    {t.direction === "in" ? "+" : "−"}
                    {t.token
                      ? `${t.token.amount.toLocaleString(undefined, { maximumFractionDigits: 8 })} ${t.token.symbol}`
                      : `${t.txc.toFixed(8)} TXC`}
                  </p>
                </Link>
                </li>
              ))}
            </ul>
          )}
          {txOpen && txs.length > 5 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full rounded-full"
              onClick={() => setShowAllTx((v) => !v)}
            >
              {showAllTx ? "Show less" : `Show more (${txs.length - 5})`}
            </Button>
          )}
        </Card>

        <TapToPayCard />

        {address && (
          <StoreRewardsCard
            addresses={legacyAddress ? [address, legacyAddress] : [address]}
            refreshKey={txs.length + (tsd ?? 0)}
          />
        )}

        <p className="pt-2 text-center text-xs text-muted-foreground">
          Non-custodial — your keys never leave this device.
        </p>
      </main>

      <BottomNav />

      <QrScanDialog
        open={scanOpen}
        onOpenChange={setScanOpen}
        onResult={onScan}
        title="Scan"
        description="Scan a CryptoPOP code, event pass or address."
      />

      <Sheet open={receiveOpen} onOpenChange={setReceiveOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader className="text-left">
            <SheetTitle className="font-display uppercase">Receive</SheetTitle>
            <SheetDescription>
              Share this address to receive TSD, TXC or POP.{" "}
              {origin === "coin" ? "Coin-backed" : origin === "imported" ? "Imported" : "Seed phrase"}{" "}
              wallet.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 pb-6">
            {address && (
              <div className="flex justify-center rounded-2xl bg-white p-4">
                <QRCodeSVG value={address} size={200} />
              </div>
            )}
            <p className="break-all text-center font-mono text-sm">{address ?? "—"}</p>
            <Button className="w-full rounded-full" onClick={copyAddress}>
              {copied ? <Check className="mr-1.5 h-4 w-4" /> : <Copy className="mr-1.5 h-4 w-4" />}
              {copied ? "Copied" : "Copy address"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <SendSheet
        open={sendOpen}
        onOpenChange={(v) => {
          setSendOpen(v);
          if (!v) setSendPrefill(null);
        }}
        address={address}
        sources={sources}
        mnemonic={mnemonic}
        popBalance={pop}
        tsdBalance={tsd}
        txcBalance={txc}
        prefill={sendPrefill}
        onSent={() => void refresh()}
      />

      <NectarPaySheet
        request={nectarReq}
        onClose={() => setNectarReq(null)}
        address={address}
        sources={sources}
        mnemonic={mnemonic}
        tsdBalance={tsd}
        onPaid={() => void refresh()}
      />
      <WalletLoginSheet
        request={loginReq}
        onClose={() => setLoginReq(null)}
        address={address}
        mnemonic={mnemonic}
      />

      <TopUpSheet open={addValueOpen} onOpenChange={setAddValueOpen} address={address} side="buy" />
    </div>

  );
}
