import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Bell,
  Eye,
  EyeOff,
  Fingerprint,
  Lock,
  RefreshCw,
  ScanLine,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { unlockVault, markBackedUp } from "@/lib/wallet/vault";
import {
  disableBiometric,
  enableBiometric,
  getBiometricStatus,
} from "@/lib/native/biometric";
import { checkForUpdate, applyUpdate, appVersionLabel } from "@/lib/native/updates";
import { CloudBackupCard } from "./cloud-backup-card";
import { useAuth } from "@/hooks/use-auth";
import { deleteMyAccount } from "@/lib/account.functions";
import { registerPushDevice, setPushEnabled } from "@/lib/push.functions";
import { pushAvailable, pushPreference, registerPush, setPushPreference } from "@/lib/native/push";
import { REGIONS, regionAssets, type AssetId, type RegionId } from "@/lib/wallet/assets";
import { hasStoredRegion, loadRegion, saveRegion } from "@/lib/wallet/region";

export function WalletSettings({
  onForget,
  onLock,
  hidden,
  onToggleChain,
}: {
  onForget: () => void;
  onLock: () => void;
  hidden: AssetId[];
  onToggleChain: (id: AssetId) => void;
}) {
  const [region, setRegion] = useState<RegionId>("tx");
  const [autoRegion, setAutoRegion] = useState(false);
  useEffect(() => {
    setRegion(loadRegion());
    setAutoRegion(!hasStoredRegion());
  }, []);
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
      {/* POP market */}
      <div className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          POP market
        </p>
        <div className="grid grid-cols-2 gap-2">
          {REGIONS.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => {
                setRegion(r.id);
                saveRegion(r.id);
                setAutoRegion(false);
              }}
              className={`rounded-xl border px-3 py-2 font-display text-sm uppercase transition ${
                region === r.id
                  ? "border-primary bg-primary/15 text-foreground"
                  : "border-white/10 bg-black/20 text-muted-foreground hover:text-foreground"
              }`}
            >
              {r.name}
            </button>
          ))}
        </div>
        {autoRegion && (
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Auto-detected from your location — tap to change
          </p>
        )}
      </div>

      {/* Visible chains */}
      <div className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Visible assets
        </p>
        {regionAssets(region).map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2"
          >
            <div>
              <p className="font-display text-sm font-semibold uppercase">{c.label}</p>
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {c.chain}
              </p>
            </div>
            <Switch
              checked={!hidden.includes(c.id)}
              onCheckedChange={() => onToggleChain(c.id)}
              aria-label={`Show ${c.label}`}
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

      <div className="space-y-2 border-t border-white/10 pt-3">
        <nav className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          <Link to="/privacy" className="transition hover:text-foreground">Privacy policy</Link>
          <Link to="/terms" className="transition hover:text-foreground">Terms</Link>
          <Link to="/manifesto" className="transition hover:text-foreground">Manifesto</Link>
        </nav>
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Part of the{" "}
          <a
            href="https://honest.money"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            honest.money
          </a>{" "}
          ecosystem
        </p>
      </div>
    </Card>
  );
}
