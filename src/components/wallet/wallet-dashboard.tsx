import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import {
  CalendarDays,
  Check,
  Copy,
  Eye,
  EyeOff,
  Fingerprint,
  Lock,
  QrCode,
  RefreshCw,
  ScanLine,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useWallet } from "@/lib/wallet/wallet-context";
import { unlockVault, isBackedUp, markBackedUp } from "@/lib/wallet/vault";
import {
  disableBiometric,
  enableBiometric,
  getBiometricStatus,
} from "@/lib/native/biometric";
import { getAddressChainSummary } from "@/lib/chain-public.functions";
import logo from "@/assets/cryptopop-logo.png";
import coin from "@/assets/cryptopop-coin.png";

export function WalletDashboard() {
  const { address, origin, lock, forget } = useWallet();
  const fetchSummary = useServerFn(getAddressChainSummary);

  const [pop, setPop] = useState<number | null>(null);
  const [txc, setTxc] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const refresh = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    try {
      const res = await fetchSummary({ data: { address } });
      setPop(res.pop);
      setTxc(res.txc);
    } catch (e) {
      console.error("[wallet] balance refresh failed", e);
    } finally {
      setLoading(false);
    }
  }, [address, fetchSummary]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function copyAddress() {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between px-5 pt-6">
        <img src={logo} alt="CryptoPOP" className="h-8 w-auto" />
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setShowSettings((v) => !v)} aria-label="Settings">
            <Settings2 className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={lock} aria-label="Lock wallet">
            <Lock className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md space-y-4 px-5 pb-16 pt-4">
        {/* Balance */}
        <Card className="relative overflow-hidden border-white/12 bg-white/5 p-6 text-center backdrop-blur-xl">
          <img src={coin} alt="" aria-hidden className="mx-auto h-14 w-14" />
          <p className="mt-3 font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
            POP balance
          </p>
          <p className="font-display text-6xl font-bold leading-none">
            {loading && pop === null ? "—" : (pop ?? 0).toLocaleString()}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {txc === null ? "TXC —" : `${txc.toFixed(8)} TXC for fees`}
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-3 rounded-full"
            onClick={refresh}
            disabled={loading}
          >
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </Card>

        {/* Address */}
        <Card className="space-y-3 border-white/12 bg-white/5 p-5 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              My address
            </p>
            <span className="rounded-full border border-white/15 px-2 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">
              {origin === "coin" ? "Coin-backed" : origin === "imported" ? "Imported" : "Seed phrase"}
            </span>
          </div>
          <p className="break-all font-mono text-sm">{address ?? "—"}</p>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1 rounded-full" onClick={copyAddress}>
              {copied ? <Check className="mr-1.5 h-4 w-4" /> : <Copy className="mr-1.5 h-4 w-4" />}
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button
              variant="secondary"
              className="flex-1 rounded-full"
              onClick={() => setShowQr((v) => !v)}
            >
              <QrCode className="mr-1.5 h-4 w-4" /> {showQr ? "Hide QR" : "Show QR"}
            </Button>
          </div>
          {showQr && address && (
            <div className="flex justify-center rounded-2xl bg-white p-4">
              <QRCodeSVG value={address} size={200} />
            </div>
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
            to="/earn"
            className="rounded-2xl border border-white/12 bg-white/5 p-4 text-center backdrop-blur-xl transition hover:bg-white/10"
          >
            <Sparkles className="mx-auto h-6 w-6 text-primary" />
            <p className="mt-2 font-display text-sm font-semibold uppercase">Earn POP</p>
          </Link>
        </div>

        {origin !== "coin" && !isBackedUp() && (
          <Card className="border-amber-400/40 bg-amber-400/10 p-4 text-sm">
            <p className="flex items-center gap-2 font-semibold">
              <ShieldCheck className="h-4 w-4" /> Back up your phrase
            </p>
            <p className="mt-1 text-muted-foreground">
              Write down your 12 words, or scan a Cold Storage Coin next time for an instant offline
              backup.
            </p>
          </Card>
        )}

        {showSettings && <WalletSettings onForget={forget} />}

        <p className="pt-2 text-center text-xs text-muted-foreground">
          Non-custodial — your keys never leave this device.
        </p>
      </main>
    </div>
  );
}

function WalletSettings({ onForget }: { onForget: () => void }) {
  const [password, setPassword] = useState("");
  const [phrase, setPhrase] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [bio, setBio] = useState({ available: false, enabled: false });

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

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <ScanLine className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Scanning a Cold Storage Coin during setup gives you an instant offline backup.
      </p>
    </Card>
  );
}
