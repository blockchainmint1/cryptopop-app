import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Bell,
  Eye,
  EyeOff,
  Fingerprint,
  Loader2,
  Lock,
  LogOut,
  MapPin,
  ScanLine,
  UserRound,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { unlockVault, markBackedUp, setVaultApproval, loadSession, type VaultPayload } from "@/lib/wallet/vault";
import {
  cancelPasskeyEnroll,
  PENDING_SETUP_MS,
  disablePasskeyUnlock,
  finishPasskeyEnroll,
  startPasskeyEnroll,
} from "@/lib/wallet/passkey-unlock";
import { deriveTxcAddress } from "@/lib/wallet";
import {
  disableBiometric,
  enableBiometric,
  getBiometricStatus,
} from "@/lib/native/biometric";
// import { CloudBackupCard } from "./cloud-backup-card"; // hidden: Google Cloud backup option
import { HmBackupCard } from "./hm-backup-card";
import { UpdateCheckCard } from "./update-check-card";
import { EcosystemLinksCard } from "./ecosystem-links-card";
import { useAuth } from "@/hooks/use-auth";
import { openHmeLogin } from "@/lib/hme";
import { nearbyEnabled, setNearbyEnabled } from "@/lib/nearby-alerts";
import { InstallAppPrompt } from "@/components/install-app-prompt";
import { deleteMyAccount } from "@/lib/account.functions";
import { registerPushDevice, setPushEnabled } from "@/lib/push.functions";
import { pushAvailable, pushPreference, registerPush, setPushPreference } from "@/lib/native/push";
import { regionAssets, type AssetId, type RegionId } from "@/lib/wallet/assets";
import {
  hasStoredRegion,
  loadRegion,
  saveRegion,
  loadMarketSlug,
  saveMarketSlug,
  regionForMarket,
} from "@/lib/wallet/region";
import { listMarkets, type MarketOption } from "@/lib/public-events.functions";

export function WalletSettings({
  onForget,
  onLock,
  hidden,
  onToggleChain,
  ecosystemLink,
}: {
  onForget: () => void;
  onLock: () => void;
  hidden: AssetId[];
  onToggleChain: (id: AssetId) => void;
  ecosystemLink?: string;
}) {
  const [region, setRegion] = useState<RegionId>("tx");
  const [autoRegion, setAutoRegion] = useState(false);
  const [markets, setMarkets] = useState<MarketOption[]>([]);
  const [marketSlug, setMarketSlug] = useState("");
  const fetchMarkets = useServerFn(listMarkets);
  useEffect(() => {
    setRegion(loadRegion());
    setAutoRegion(!hasStoredRegion());
    setMarketSlug(loadMarketSlug() ?? "");
  }, []);
  useEffect(() => {
    void fetchMarkets()
      .then((rows) => setMarkets(rows))
      .catch(() => undefined);
  }, [fetchMarkets]);
  const [password, setPassword] = useState("");
  const [phrase, setPhrase] = useState<string | null>(null);
  const [confirmingReveal, setConfirmingReveal] = useState(false);
  const [hideIn, setHideIn] = useState(0);
  const [busy, setBusy] = useState(false);
  const [bio, setBio] = useState<{ available: boolean; enabled: boolean; kind: "native" | "passkey" }>({
    available: false,
    enabled: false,
    kind: "native",
  });
  // Web passkey setup: password checked → tap to create → (sometimes) one more tap.
  const [bioStep, setBioStep] = useState<"idle" | "ready" | "finish">("idle");
  const [bioPayload, setBioPayload] = useState<VaultPayload | null>(null);
  // Password held only between "password checked" and the setup tap; cleared after.
  const bioPassword = useRef<string | null>(null);
  const [bioBusy, setBioBusy] = useState(false);
  const [notifs, setNotifs] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { user, signOut } = useAuth();
  const removeAccount = useServerFn(deleteMyAccount);
  const savePushToken = useServerFn(registerPushDevice);
  const togglePushRow = useServerFn(setPushEnabled);

  useEffect(() => setNotifs(pushAvailable() && pushPreference()), []);
  const [nearby, setNearby] = useState(false);
  useEffect(() => setNearby(nearbyEnabled()), []);

  function toggleNearby(on: boolean) {
    if (!on) {
      setNearby(false);
      setNearbyEnabled(false);
      return;
    }
    if (!navigator.geolocation) return toast.error("Location isn't available on this device.");
    navigator.geolocation.getCurrentPosition(
      () => {
        setNearby(true);
        setNearbyEnabled(true);
        toast.success("We'll let you know when you're near a store that takes TSD.");
      },
      () => toast.error("Location is blocked in your phone settings."),
      { timeout: 15000 },
    );
  }


  async function toggleNotifications(on: boolean) {
    if (!pushAvailable()) {
      setNotifs(false);
      setPushPreference(false);
      toast.info("Notifications aren't available in this version yet.");
      return;
    }
    setNotifs(on);
    setPushPreference(on);
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
      try {
        const { PushNotifications } = await import("@capacitor/push-notifications");
        await PushNotifications.removeAllDeliveredNotifications();
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

  // Face ID copy gone but the vault still says "approval required" (e.g. after
  // a password change): payments ask for the password until it's set up again.
  const [needsReenroll, setNeedsReenroll] = useState(false);

  useEffect(() => {
    getBiometricStatus()
      .then((s) => {
        setBio(s);
        setNeedsReenroll(s.kind === "passkey" && !s.enabled && loadSession()?.approval === "passkey");
      })
      .catch(() => undefined);
  }, []);

  // Don't keep the typed password around if setup is left half-finished.
  useEffect(() => {
    if (bioStep === "idle") return;
    const t = setTimeout(() => {
      resetBioSetup();
      toast.message("Face ID setup timed out. Start again when you're ready.");
    }, PENDING_SETUP_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bioStep]);

  async function stopAskingForPassword() {
    if (!password) return toast.error("Enter your password first");
    try {
      await setVaultApproval(password, null);
    } catch (e) {
      return toast.error((e as Error).message);
    }
    setNeedsReenroll(false);
    setPassword("");
    toast.success("Payments won't ask for your password anymore");
  }

  async function reveal() {
    setBusy(true);
    const payload = await unlockVault(password);
    setBusy(false);
    if (!payload) return toast.error("Wrong password");
    setConfirmingReveal(false);
    setPhrase(payload.mnemonic);
    setHideIn(60);
    markBackedUp();
    setPassword("");
  }

  // Auto-hide the phrase after 60 seconds, and count down for the user.
  useEffect(() => {
    if (!phrase) {
      setHideIn(0);
      return;
    }
    if (hideIn <= 0) {
      setPhrase(null);
      return;
    }
    const t = setTimeout(() => setHideIn((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [phrase, hideIn]);

  function resetBioSetup() {
    cancelPasskeyEnroll();
    bioPassword.current = null;
    setBioStep("idle");
    setBioPayload(null);
  }

  async function runPasskeyStep() {
    setBioBusy(true);
    try {
      let result: "done" | "needs-tap";
      if (bioStep === "finish") {
        await finishPasskeyEnroll();
        result = "done";
      } else {
        if (!bioPayload || !bioPassword.current) return resetBioSetup();
        let label = "POP Wallet";
        try {
          const a = deriveTxcAddress(bioPayload.mnemonic);
          label = `POP Wallet ${a.slice(0, 4)}…${a.slice(-4)}`;
        } catch {
          /* keep default */
        }
        result = await startPasskeyEnroll(bioPayload, bioPassword.current, label);
      }
      if (result === "needs-tap") {
        setBioStep("finish");
        return;
      }
      bioPassword.current = null;
      setBioStep("idle");
      setBioPayload(null);
      setBio((b) => ({ ...b, enabled: true }));
      setNeedsReenroll(false);
      toast.success("Face ID / fingerprint is on for unlocking and payments");
    } catch (e) {
      const name = (e as { name?: string })?.name;
      toast.error(
        name === "NotAllowedError" || name === "AbortError"
          ? "Setup was cancelled."
          : e instanceof Error
            ? e.message
            : "Setup didn't finish.",
      );
      resetBioSetup();
    } finally {
      setBioBusy(false);
    }
  }

  async function toggleBiometric() {
    // Turning it off needs the password too, so a grabbed unlocked phone
    // can't simply switch off the payment check.
    if (!password) return toast.error("Enter your password first");
    const payload = await unlockVault(password);
    if (!payload) return toast.error("Wrong password");
    if (bio.enabled) {
      if (bio.kind === "passkey") {
        // Clear the "approval required" flag in the password vault, then the copy.
        try {
          await setVaultApproval(password, null);
        } catch (e) {
          return toast.error((e as Error).message);
        }
        disablePasskeyUnlock();
      } else await disableBiometric();
      setBio({ ...bio, enabled: false });
      setPassword("");
      toast.success("Face ID / fingerprint turned off");
      return;
    }
    if (bio.kind === "passkey") {
      bioPassword.current = password;
      setBioPayload(payload);
      setBioStep("ready");
      setPassword("");
      return;
    }
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
      {/* Account */}
      <div className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Account</p>
        {user ? (
          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
            <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{user.email ?? "Signed in"}</p>
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {user.app_metadata?.hme_member_id
                  ? "Honest Money account"
                  : `Signed in with ${String(user.app_metadata?.provider ?? "email")}`}
              </p>
            </div>
            <Button variant="ghost" size="icon" aria-label="Sign out" onClick={() => void signOut()}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button variant="secondary" className="h-11 w-full rounded-full" onClick={openHmeLogin}>
            Sign in with Honest Money
          </Button>
        )}
      </div>

      <InstallAppPrompt dismissible={false} />

      {/* POP market */}
      <div className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          POP market
        </p>
        <Select
          value={marketSlug}
          onValueChange={(slug) => {
            const picked = markets.find((m) => m.slug === slug);
            const next = regionForMarket(picked?.country, slug);
            setMarketSlug(slug);
            saveMarketSlug(slug);
            setRegion(next);
            saveRegion(next);
            setAutoRegion(false);
          }}
        >
          <SelectTrigger className="h-11 rounded-xl border-white/10 bg-black/20 font-display text-sm uppercase">
            <SelectValue placeholder={markets.length ? "Select market" : "Loading markets…"} />
          </SelectTrigger>
          <SelectContent>
            {markets.map((m) => (
              <SelectItem key={m.slug} value={m.slug} className="font-display text-sm uppercase">
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
          autoComplete="off"
        />
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="flex-1 rounded-full"
            disabled={!password || busy}
            onClick={() => setConfirmingReveal(true)}
          >
            <Eye className="mr-1.5 h-4 w-4" /> Reveal phrase
          </Button>
        </div>
        {bio.available && (
          <div className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-semibold">
                  <Fingerprint className="h-4 w-4 shrink-0" /> Face ID / fingerprint
                </p>
                <p className="text-xs text-muted-foreground">
                  {bio.enabled
                    ? "On — used to unlock and to approve payments."
                    : needsReenroll
                      ? "Needs setting up again. Until then, payments ask for your password."
                      : "Unlock and approve payments without typing your password."}
                </p>
              </div>
              {bioStep === "idle" && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="shrink-0 rounded-full"
                  disabled={!password || busy}
                  onClick={toggleBiometric}
                >
                  {bio.enabled ? "Turn off" : "Turn on"}
                </Button>
              )}
            </div>
            {bioStep === "idle" && !password && (
              <p className="text-[11px] text-muted-foreground">
                Type your wallet password above to turn this {bio.enabled ? "off" : "on"}.
              </p>
            )}
            {bioStep === "idle" && needsReenroll && (
              <Button
                variant="ghost"
                size="sm"
                className="h-auto rounded-full px-2 py-1 text-xs text-muted-foreground"
                disabled={!password || busy}
                onClick={stopAskingForPassword}
              >
                Stop asking for my password on payments
              </Button>
            )}
            {bioStep !== "idle" && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  {bioStep === "ready"
                    ? "Password OK. Tap below and your phone will ask for your face or fingerprint."
                    : "Almost done — tap once more to confirm with your face or fingerprint."}
                </p>
                <div className="flex gap-2">
                  <Button className="flex-1 rounded-full" disabled={bioBusy} onClick={runPasskeyStep}>
                    {bioBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Fingerprint className="mr-1.5 h-4 w-4" />}
                    {bioStep === "ready" ? "Set up Face ID / fingerprint" : "Finish setup"}
                  </Button>
                  <Button variant="ghost" className="rounded-full" disabled={bioBusy} onClick={resetBioSetup}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <Dialog open={confirmingReveal} onOpenChange={setConfirmingReveal}>
        <DialogContent className="max-w-sm border-white/12 bg-card">
          <DialogHeader>
            <DialogTitle className="font-display text-lg uppercase">Are you sure?</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Anyone watching your screen — a person, a camera, a video call — can use these words
              to take all your money. Only view your phrase when you're alone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Button className="rounded-full" disabled={busy} onClick={() => void reveal()}>
              {busy ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Eye className="mr-1.5 h-4 w-4" />
              )}
              I'm alone — show my phrase
            </Button>
            <Button
              variant="ghost"
              className="rounded-full"
              onClick={() => setConfirmingReveal(false)}
            >
              Not now
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {phrase && (
        <div className="space-y-2 rounded-2xl border border-white/12 bg-black/40 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="font-mono text-[10px] uppercase tracking-widest text-destructive">
              Anyone watching can steal everything — hides in {hideIn}s
            </p>
            <Button variant="ghost" size="sm" onClick={() => setPhrase(null)}>
              <EyeOff className="mr-1.5 h-4 w-4" /> Hide
            </Button>
          </div>
          <p className="font-mono text-sm leading-relaxed">{phrase}</p>
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

      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="font-display text-sm font-semibold uppercase">Nearby alerts</p>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              When you're near a TSD store · stays on your phone
            </p>
          </div>
        </div>
        <Switch checked={nearby} onCheckedChange={toggleNearby} aria-label="Nearby alerts" />
      </div>

      {/* Cloud backup (Google/Apple) hidden at Bobby's request — component kept for later. */}
      <HmBackupCard />

      <EcosystemLinksCard initialPayload={ecosystemLink} />

      <UpdateCheckCard />

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
          <Link to="/help" className="font-semibold text-foreground/80 transition hover:text-foreground">Help & how-to</Link>
          <Link to="/events" className="transition hover:text-foreground">Events</Link>
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
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          © {new Date().getFullYear()} CryptoPOP — small business support, gamified.
        </p>
      </div>
    </Card>
  );
}
