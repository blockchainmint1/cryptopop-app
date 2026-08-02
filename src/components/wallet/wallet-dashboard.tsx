import { useCallback, useEffect, useMemo, useState } from "react";
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
import { ASSETS, type AssetId } from "@/lib/wallet/assets";
import { parseScan } from "@/lib/wallet/scan-parse";
import { loadTxLabels, type TxLabel } from "@/lib/wallet/tx-labels";
import { SendSheet, type SendPrefill, type SendSource } from "./send-sheet";
import { QrScanDialog } from "./qr-scan-dialog";
import { AddValueSheet } from "./add-value-sheet";
import logo from "@/assets/cryptopop-logo.png";
import coin from "@/assets/cryptopop-coin.png";

const CHAINS = ASSETS;

type ChainId = AssetId;
const HIDDEN_KEY = "cryptopop.wallet.hiddenChains";

function loadHidden(): ChainId[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HIDDEN_KEY);
    return raw ? (JSON.parse(raw) as ChainId[]) : [];
  } catch {
    return [];
  }
}

function saveHidden(v: ChainId[]) {
  try {
    window.localStorage.setItem(HIDDEN_KEY, JSON.stringify(v));
  } catch {
    /* ignore */
  }
}

export function WalletDashboard() {
  const { address, legacyAddress, origin, mnemonic, lock, forget } = useWallet();
  const navigate = useNavigate();
  const fetchSummary = useServerFn(getAddressChainSummary);
  const fetchActivity = useServerFn(getAddressActivity);
  const fetchRewards = useServerFn(getAddressRewards);

  const [pop, setPop] = useState<number | null>(null);
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
  const [expanded, setExpanded] = useState(false);
  const [showAllTx, setShowAllTx] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [sendPrefill, setSendPrefill] = useState<SendPrefill | null>(null);
  const [addValueOpen, setAddValueOpen] = useState(false);

  useEffect(() => setHidden(loadHidden()), []);
  useEffect(() => setTxLabels(loadTxLabels()), []);
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
      setTsd(sum((s) => s.tsd));
      setTxc(sum((s) => s.txc));
      setSources(
        addresses.map((a, i) => ({
          address: a,
          balances: {
            pop: summaries[i]?.pop ?? null,
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
        if (url.startsWith("/")) void navigate({ to: url });
      },
    });
  }, [address, savePushToken, navigate]);

  const balances: Record<ChainId, number | null> = useMemo(
    () => ({ pop, tsd, txc }),
    [pop, tsd, txc],
  );

  const visibleChains = CHAINS.filter((c) => !hidden.includes(c.id));
  const tsdVisible = !hidden.includes("tsd");
  const headline = tsdVisible ? (tsd ?? 0).toFixed(2) : (pop ?? 0).toLocaleString();
  const headlineLabel = tsdVisible ? "TSD · Texas Stable Dollar" : "POP";

  function toggleChain(id: ChainId) {
    const next = hidden.includes(id) ? hidden.filter((h) => h !== id) : [...hidden, id];
    setHidden(next);
    saveHidden(next);
  }

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
      case "payment":
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

      case "pass":
      case "link":
        void navigate({ to: intent.path });
        return;
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
        <img src={logo} alt="CryptoPOP" className="h-8 w-auto shrink-0" />
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
          <Button variant="ghost" size="icon" onClick={() => setShowSettings((v) => !v)} aria-label="Settings">
            <Settings2 className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setScanOpen(true)} aria-label="Scan a code">
            <Camera className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md space-y-4 px-4 pb-32 pt-4">
        {/* Total balance across chains */}
        <Card className="relative overflow-hidden border-white/12 bg-white/5 p-6 text-center backdrop-blur-xl">
          <img src={coin} alt="" aria-hidden className="mx-auto h-12 w-12" />
          <p className="mt-3 font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Total balance
          </p>
          <p className="font-display text-6xl font-bold leading-none">
            {loading && pop === null && tsd === null ? "—" : headline}
          </p>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            {headlineLabel} · {visibleChains.length}{" "}
            {visibleChains.length === 1 ? "asset" : "assets"}
          </p>

          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mx-auto mt-3 flex items-center gap-1 rounded-full px-3 py-1 text-xs text-muted-foreground transition hover:text-foreground"
          >
            {expanded ? "Hide detail" : "Show detail"}
            <ChevronDown className={`h-3.5 w-3.5 transition ${expanded ? "rotate-180" : ""}`} />
          </button>

          {expanded && (
            <div className="mt-3 space-y-2 text-left">
              {visibleChains.length === 0 && (
                <p className="text-center text-xs text-muted-foreground">
                  All assets hidden — turn them back on in settings.
                </p>
              )}
              {visibleChains.map((c) => {
                const v = balances[c.id];
                return (
                  <div
                    key={c.id}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2"
                  >
                    <div>
                      <p className="font-display text-sm font-semibold uppercase">{c.name}</p>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                        {c.network}
                      </p>
                    </div>
                    <p className="font-mono text-sm">
                      {v === null ? "—" : v.toFixed(c.decimals)}
                    </p>
                  </div>
                );
              })}
              <Button
                variant="ghost"
                size="sm"
                className="w-full rounded-full"
                onClick={refresh}
                disabled={loading}
              >
                <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          )}
        </Card>

        {/* Add value (ACH onramp) */}
        <Button
          variant="secondary"
          className="h-12 w-full rounded-full"
          onClick={() => setAddValueOpen(true)}
        >
          <Plus className="mr-1.5 h-4 w-4" /> Add value
        </Button>



        {/* Recent activity */}
        <Card className="space-y-3 border-white/12 bg-white/5 p-5 backdrop-blur-xl">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Recent activity
          </p>
          {shownTx.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {loading ? "Loading…" : "No transactions yet."}
            </p>
          ) : (
            <ul className="space-y-2">
              {shownTx.map((t) => (
                <li key={t.txid} className="flex items-center gap-3">
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
                        (t.direction === "in" ? "Received" : "Sent")}
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
                    {t.txc.toFixed(8)} TXC
                  </p>
                </li>
              ))}
            </ul>
          )}
          {txs.length > 5 && (
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

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Link
            to="/events"
            className="rounded-2xl border border-white/12 bg-white/5 p-4 text-center backdrop-blur-xl transition hover:bg-white/10"
          >
            <CalendarDays className="mx-auto h-6 w-6 text-primary" />
            <p className="mt-2 font-display text-sm font-semibold uppercase">Events</p>
          </Link>
          <Link
            to="/my-pass"
            className="rounded-2xl border border-white/12 bg-white/5 p-4 text-center backdrop-blur-xl transition hover:bg-white/10"
          >
            <Sparkles className="mx-auto h-6 w-6 text-primary" />
            <p className="mt-2 font-display text-sm font-semibold uppercase">My pass</p>
          </Link>
        </div>

        {/* Rewards */}
        <Card className="space-y-3 border-white/12 bg-white/5 p-5 backdrop-blur-xl">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Rewards earned
          </p>
          {rewards.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {loading
                ? "Loading…"
                : "No rewards yet — RSVP to an event or check in to start earning POP."}
            </p>
          ) : (
            <ul className="space-y-2">
              {rewards.slice(0, 10).map((r) => (
                <li
                  key={r.id}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2"
                >
                  <Gift className="h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm capitalize">{r.source.replace(/_/g, " ")}</p>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString()} · {r.status}
                    </p>
                  </div>
                  <p className="shrink-0 font-display text-base font-semibold">+{r.amount}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {origin !== "coin" && !backupDismissed && (
          <Card className="relative border-amber-400/40 bg-amber-400/10 p-4 text-sm">
            <button
              type="button"
              aria-label="Hide backup reminder"
              onClick={() => setBackupDismissed(true)}
              className="absolute right-2 top-2 rounded-full p-1.5 text-muted-foreground transition hover:bg-white/10 hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
            <p className="flex items-center gap-2 pr-8 font-semibold">
              <ShieldCheck className="h-4 w-4" /> Back up your phrase
            </p>
            <p className="mt-1 text-muted-foreground">
              Write down your 12 words, or scan a Cold Storage Coin next time for an instant offline
              backup.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-3 w-full"
              onClick={() => {
                markBackedUp();
                setBackupDismissed(true);
                toast.success("Marked as backed up");
              }}
            >
              <Check className="mr-1 h-4 w-4" /> I've backed it up
            </Button>
          </Card>
        )}

        {showSettings && (
          <WalletSettings
            onForget={forget}
            onLock={lock}
            hidden={hidden}
            onToggleChain={toggleChain}
          />
        )}

        <p className="pt-2 text-center text-xs text-muted-foreground">
          Non-custodial — your keys never leave this device.
        </p>
      </main>

      {/* Sticky send / receive */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-background/90 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-md gap-3">
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
      </div>

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
              Share this address to receive POP or TXC.{" "}
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

      <AddValueSheet
        open={addValueOpen}
        onOpenChange={setAddValueOpen}
        address={address}
        onFunded={() => void refresh()}
      />
    </div>

  );
}

function WalletSettings({
  onForget,
  onLock,
  hidden,
  onToggleChain,
}: {
  onForget: () => void;
  onLock: () => void;
  hidden: ChainId[];
  onToggleChain: (id: ChainId) => void;
}) {
  const [password, setPassword] = useState("");
  const [phrase, setPhrase] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [bio, setBio] = useState({ available: false, enabled: false });
  const [notifs, setNotifs] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);
  const [versionLabel, setVersionLabel] = useState<string | null>(null);
  const { user, signOut } = useAuth();
  const removeAccount = useServerFn(deleteMyAccount);
  const savePushToken = useServerFn(registerPushDevice);
  const togglePushRow = useServerFn(setPushEnabled);

  useEffect(() => setNotifs(pushPreference()), []);
  useEffect(() => {
    void appVersionLabel().then(setVersionLabel);
  }, []);

  async function onCheckUpdates() {
    setChecking(true);
    try {
      const { updateAvailable } = await checkForUpdate();
      setUpdateReady(updateAvailable);
      if (updateAvailable) toast.success("Update available");
      else toast.info("You're on the latest version");
    } catch {
      toast.error("Couldn't check for updates — check your connection");
    } finally {
      setChecking(false);
    }
  }

  async function toggleNotifications(on: boolean) {
    setNotifs(on);
    setPushPreference(on);
    if (!pushAvailable()) {
      toast.info("Notifications turn on inside the POP Wallet app.");
      return;
    }
    if (on) {
      const ok = await registerPush({
        onToken: async (token, platform) => {
          try {
            await savePushToken({ data: { token, platform, enabled: true } });
          } catch {
            /* ignore */
          }
        },
      });
      if (!ok) {
        setNotifs(false);
        setPushPreference(false);
        toast.error("Notifications are blocked in your phone settings.");
      } else {
        toast.success("Notifications on");
      }
    } else {
      const { PushNotifications } = await import("@capacitor/push-notifications");
      try {
        const list = await PushNotifications.removeAllDeliveredNotifications();
        void list;
      } catch {
        /* ignore */
      }
      void togglePushRow;
      toast.success("Notifications off");
    }
  }

  async function onDeleteAccount() {
    if (
      !window.confirm(
        "Delete your CryptoPOP account? This removes your cloud backup and sign-in. Your wallet stays on this device only if you have your recovery phrase.",
      )
    )
      return;
    setDeleting(true);
    try {
      await removeAccount({ data: {} } as never);
      await signOut();
      toast.success("Account deleted");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  useEffect(() => {
    getBiometricStatus()
      .then(setBio)
      .catch(() => undefined);
  }, []);

  async function reveal() {
    setBusy(true);
    const payload = await unlockVault(password);
    setBusy(false);
    if (!payload) return toast.error("Wrong password");
    setPhrase(payload.mnemonic);
    markBackedUp();
    setPassword("");
  }

  async function toggleBiometric() {
    if (bio.enabled) {
      await disableBiometric();
      setBio({ ...bio, enabled: false });
      toast.success("Biometric unlock turned off");
      return;
    }
    if (!password) return toast.error("Enter your password first");
    const payload = await unlockVault(password);
    if (!payload) return toast.error("Wrong password");
    try {
      await enableBiometric(password);
      setBio({ ...bio, enabled: true });
      setPassword("");
      toast.success("Biometric unlock enabled");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Card className="space-y-4 border-white/12 bg-white/5 p-5 backdrop-blur-xl">
      <p className="font-display text-lg font-semibold uppercase">Wallet settings</p>

      {/* Visible chains */}
      <div className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Visible assets
        </p>
        {CHAINS.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2"
          >
            <div>
              <p className="font-display text-sm font-semibold uppercase">{c.name}</p>
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {c.network}
              </p>
            </div>
            <Switch
              checked={!hidden.includes(c.id)}
              onCheckedChange={() => onToggleChain(c.id)}
              aria-label={`Show ${c.name}`}
            />
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <Input
          type="password"
          placeholder="Wallet password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-11"
          autoComplete="current-password"
        />
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="flex-1 rounded-full"
            disabled={!password || busy}
            onClick={reveal}
          >
            <Eye className="mr-1.5 h-4 w-4" /> Reveal phrase
          </Button>
          {bio.available && (
            <Button variant="secondary" className="flex-1 rounded-full" onClick={toggleBiometric}>
              <Fingerprint className="mr-1.5 h-4 w-4" /> {bio.enabled ? "Turn off" : "Enable"}
            </Button>
          )}
        </div>
      </div>

      {phrase && (
        <div className="space-y-2 rounded-2xl border border-white/12 bg-black/40 p-4">
          <p className="font-mono text-sm leading-relaxed">{phrase}</p>
          <Button variant="ghost" size="sm" onClick={() => setPhrase(null)}>
            <EyeOff className="mr-1.5 h-4 w-4" /> Hide
          </Button>
        </div>
      )}

      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="font-display text-sm font-semibold uppercase">Notifications</p>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Event reminders & POP awards
            </p>
          </div>
        </div>
        <Switch checked={notifs} onCheckedChange={toggleNotifications} aria-label="Notifications" />
      </div>

      <CloudBackupCard />

      <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-display text-sm font-semibold uppercase">App version</p>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {versionLabel ?? "Web app"}
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="rounded-full"
            disabled={checking}
            onClick={updateReady ? () => void applyUpdate() : onCheckUpdates}
          >
            <RefreshCw className={`mr-1.5 h-4 w-4 ${checking ? "animate-spin" : ""}`} />
            {checking ? "Checking…" : updateReady ? "Update now" : "Check for updates"}
          </Button>
        </div>
      </div>

      <Button variant="ghost" className="w-full justify-start" onClick={onLock}>
        <Lock className="mr-1.5 h-4 w-4" /> Lock wallet
      </Button>

      <Button
        variant="ghost"
        className="w-full justify-start text-destructive hover:text-destructive"
        onClick={() => {
          if (
            window.confirm(
              "Remove this wallet from this device? Only your coin or recovery phrase can restore it.",
            )
          ) {
            onForget();
            toast.success("Wallet removed from this device");
          }
        }}
      >
        <Trash2 className="mr-1.5 h-4 w-4" /> Remove wallet from this device
      </Button>

      {user && (
        <Button
          variant="ghost"
          className="w-full justify-start text-destructive hover:text-destructive"
          disabled={deleting}
          onClick={onDeleteAccount}
        >
          <Trash2 className="mr-1.5 h-4 w-4" />
          {deleting ? "Deleting account…" : "Delete my account"}
        </Button>
      )}

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <ScanLine className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Scanning a Cold Storage Coin during setup gives you an instant offline backup.
      </p>
    </Card>
  );
}
