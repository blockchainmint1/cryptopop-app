import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  CloudDownload,
  Copy,
  Eye,
  Fingerprint,
  KeyRound,
  Loader2,
  Mail,
  MapPin,
  ScanLine,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { QrScanDialog } from "./qr-scan-dialog";
import { CloudRestorePanel } from "./cloud-restore-panel";
import { RESTORE_INTENT_KEY } from "@/lib/wallet/cloud-account";
import { useWallet } from "@/lib/wallet/wallet-context";
import { createMnemonic, isValidMnemonic, normalizeMnemonic, type VaultOrigin } from "@/lib/wallet/vault";
import { enableBiometric, isBiometricAvailable } from "@/lib/native/biometric";
import { useServerFn } from "@tanstack/react-start";
import { listMarkets, type MarketOption } from "@/lib/public-events.functions";
import { claimWelcomePop, WELCOME_POP } from "@/lib/welcome.functions";
import { loadRegion, regionForMarket, saveMarketSlug, saveRegion } from "@/lib/wallet/region";
import { deriveTxcAddress } from "@/lib/wallet";
import logo from "@/assets/cryptopop-logo.png";

type Step =
  | "choose"
  | "coin-rules"
  | "seed-show"
  | "seed-confirm"
  | "import"
  | "cloud"
  | "password"
  | "welcome";

const COIN_RULES = [
  "My Cold Storage Coin is my only backup. If I lose it, this wallet is gone forever.",
  "Anyone who scans my coin can spend my POP. I'll keep it somewhere safe.",
  "No one from CryptoPOP will ever ask me to scan my coin anywhere else.",
  "This wallet is non-custodial — nobody can recover it or reverse a transaction for me.",
];

export function OnboardScreen() {
  const { create } = useWallet();
  const [step, setStep] = useState<Step>("choose");

  // Coming back from a Google/Apple redirect started on the restore panel.
  useEffect(() => {
    try {
      if (sessionStorage.getItem(RESTORE_INTENT_KEY)) {
        sessionStorage.removeItem(RESTORE_INTENT_KEY);
        setStep("cloud");
      }
    } catch {
      /* ignore */
    }
  }, []);
  const [origin, setOrigin] = useState<VaultOrigin>("coin");
  const [mnemonic, setMnemonic] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  const [acks, setAcks] = useState<boolean[]>(() => COIN_RULES.map(() => false));
  const [importText, setImportText] = useState("");
  const [pass1, setPass1] = useState("");
  const [pass2, setPass2] = useState("");
  const [useBio, setUseBio] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmIdx] = useState(() => Math.floor(Math.random() * 12));
  const [confirmWord, setConfirmWord] = useState("");
  const [markets, setMarkets] = useState<MarketOption[]>([]);
  const [marketSlug, setMarketSlug] = useState("");
  const [email, setEmail] = useState("");

  const fetchMarkets = useServerFn(listMarkets);
  const claimWelcome = useServerFn(claimWelcomePop);

  // Pull the market catalog once; preselect the one matching the detected region.
  useEffect(() => {
    let alive = true;
    void fetchMarkets()
      .then((rows) => {
        if (!alive || !rows?.length) return;
        setMarkets(rows);
        const detected = loadRegion();
        const match =
          rows.find((m) => regionForMarket(m.country, m.slug) === detected) ?? rows[0];
        setMarketSlug((cur) => cur || match.slug);
      })
      .catch(() => {
        /* offline — market step falls back to skip */
      });
    return () => {
      alive = false;
    };
  }, [fetchMarkets]);

  const words = useMemo(() => (mnemonic ? mnemonic.split(" ") : []), [mnemonic]);

  function goPassword(next: VaultOrigin) {
    setOrigin(next);
    void isBiometricAvailable().then((v) => {
      setBioAvailable(v);
      setUseBio(v);
    });
    setStep("password");
  }

  function handleScan(text: string) {
    setScanOpen(false);
    const m = normalizeMnemonic(text);
    const count = m.split(" ").filter(Boolean).length;
    if (count !== 12 && count !== 24) {
      toast.error("A Cold Storage Coin holds a 12- or 24-word phrase");
      return;
    }
    if (!isValidMnemonic(m)) {
      toast.error("That doesn't look like a valid recovery phrase");
      return;
    }
    setMnemonic(m);
    setOrigin("coin");
    toast.success("Coin recognized");
    setStep("coin-rules");
  }

  function startGenerate() {
    setMnemonic(createMnemonic(128));
    setOrigin("generated");
    setStep("seed-show");
  }

  function handleImport() {
    const m = normalizeMnemonic(importText);
    if (!isValidMnemonic(m)) {
      toast.error("That recovery phrase isn't valid");
      return;
    }
    setMnemonic(m);
    goPassword("imported");
  }

  async function handleCreate() {
    if (pass1.length < 8) return toast.error("Password must be at least 8 characters");
    if (pass1 !== pass2) return toast.error("Passwords do not match");
    setBusy(true);
    try {
      await create(mnemonic, pass1, origin);
      if (useBio && bioAvailable) {
        try {
          await enableBiometric(pass1);
        } catch {
          toast.message("Biometric unlock wasn't enabled — you can turn it on in settings.");
        }
      }
      // Remember the chosen market (and the points token that goes with it).
      const picked = markets.find((m) => m.slug === marketSlug);
      if (picked) {
        saveMarketSlug(picked.slug);
        saveRegion(regionForMarket(picked.country, picked.slug));
      }

      const cleanEmail = email.trim().toLowerCase();
      if (cleanEmail) {
        try {
          const address = deriveTxcAddress(mnemonic);
          const res = await claimWelcome({
            data: { address, email: cleanEmail, market: picked?.slug ?? null },
          });
          if (res.awarded) toast.success(`Welcome — ${res.amount} POP is on its way`);
          else if (res.reason === "duplicate") toast.message("That email already claimed its welcome POP");
        } catch {
          toast.message("Wallet created — we'll retry your welcome POP later.");
        }
      }

      setMnemonic("");
      setPass1("");
      setPass2("");
      setEmail("");
      toast.success("Your wallet is ready");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 py-10">
        <div className="text-center">
          <img src={logo} alt="CryptoPOP" className="mx-auto h-14 w-auto" />
          <h1 className="mt-6 font-display text-3xl font-bold uppercase tracking-tight">
            Set up your wallet
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Non-custodial. Your keys stay on this device — nobody at CryptoPOP can touch them.
          </p>
        </div>

        <div className="mt-8 space-y-4 rounded-3xl border border-white/12 bg-white/5 p-6 backdrop-blur-xl">
          {step === "choose" && (
            <div className="space-y-4">
              <button
                onClick={() => setScanOpen(true)}
                className="w-full rounded-2xl border border-primary/40 bg-primary/10 p-5 text-left transition hover:bg-primary/15"
              >
                <div className="flex items-center gap-2 font-display text-lg font-semibold uppercase">
                  <ScanLine className="h-5 w-5 text-primary" /> Scan a Cold Storage Coin
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Recommended. Your coin is an instant, offline backup — scan it and your wallet is
                  already safe.
                </p>
              </button>

              <button
                onClick={startGenerate}
                className="w-full rounded-2xl border border-white/12 bg-white/5 p-5 text-left transition hover:bg-white/10"
              >
                <div className="flex items-center gap-2 font-display text-lg font-semibold uppercase">
                  <Sparkles className="h-5 w-5" /> Create a new phrase
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Classic setup — we generate 12 words for you to write down yourself.
                </p>
              </button>

              <button
                onClick={() => setStep("import")}
                className="w-full rounded-2xl border border-white/12 bg-white/5 p-5 text-left transition hover:bg-white/10"
              >
                <div className="flex items-center gap-2 font-display text-lg font-semibold uppercase">
                  <KeyRound className="h-5 w-5" /> Import a phrase
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Already have a 12 or 24-word recovery phrase? Bring it here.
                </p>
              </button>

              <button
                onClick={() => setStep("cloud")}
                className="w-full rounded-2xl border border-white/12 bg-white/5 p-5 text-left transition hover:bg-white/10"
              >
                <div className="flex items-center gap-2 font-display text-lg font-semibold uppercase">
                  <CloudDownload className="h-5 w-5" /> Restore from backup
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Backed up to Google or Apple before? Sign in and unlock it with your wallet
                  password.
                </p>
              </button>
            </div>
          )}

          {step === "cloud" && <CloudRestorePanel onBack={() => setStep("choose")} />}


          {step === "coin-rules" && (
            <div className="space-y-3">
              <h2 className="font-display text-xl font-semibold uppercase">Coin rules</h2>
              {COIN_RULES.map((text, i) => (
                <label key={i} className="flex items-start gap-2.5 text-sm">
                  <input
                    type="checkbox"
                    checked={acks[i]}
                    onChange={(e) =>
                      setAcks((s) => s.map((v, idx) => (idx === i ? e.target.checked : v)))
                    }
                    className="mt-1 h-4 w-4 accent-[#ff3dbe]"
                  />
                  <span>{text}</span>
                </label>
              ))}
              <div className="flex gap-2 pt-1">
                <Button variant="ghost" className="flex-1" onClick={() => setStep("choose")}>
                  <ArrowLeft className="mr-1 h-4 w-4" /> Back
                </Button>
                <Button
                  className="flex-1 rounded-full"
                  disabled={!acks.every(Boolean)}
                  onClick={() => goPassword("coin")}
                >
                  I agree
                </Button>
              </div>
            </div>
          )}

          {step === "seed-show" && (
            <div className="space-y-4">
              <h2 className="font-display text-xl font-semibold uppercase">Write these down</h2>
              <p className="text-sm text-muted-foreground">
                These 12 words are the only way to restore this wallet. Write them on paper — never
                in a screenshot or notes app.
              </p>
              <ol className="grid grid-cols-2 gap-2">
                {words.map((w, i) => (
                  <li
                    key={i}
                    className="rounded-xl border border-white/12 bg-black/30 px-3 py-2 font-mono text-sm"
                  >
                    <span className="mr-2 text-xs text-muted-foreground">{i + 1}</span>
                    {w}
                  </li>
                ))}
              </ol>
              <Button
                variant="secondary"
                className="w-full rounded-full"
                onClick={async () => {
                  await navigator.clipboard.writeText(mnemonic);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? <Check className="mr-1.5 h-4 w-4" /> : <Copy className="mr-1.5 h-4 w-4" />}
                {copied ? "Copied" : "Copy phrase"}
              </Button>
              <div className="flex gap-2">
                <Button variant="ghost" className="flex-1" onClick={() => setStep("choose")}>
                  <ArrowLeft className="mr-1 h-4 w-4" /> Back
                </Button>
                <Button className="flex-1 rounded-full" onClick={() => setStep("seed-confirm")}>
                  I wrote it down
                </Button>
              </div>
            </div>
          )}

          {step === "seed-confirm" && (
            <div className="space-y-4">
              <h2 className="font-display text-xl font-semibold uppercase">Quick check</h2>
              <p className="text-sm text-muted-foreground">
                Type word #{confirmIdx + 1} from your phrase.
              </p>
              <Input
                value={confirmWord}
                onChange={(e) => setConfirmWord(e.target.value)}
                placeholder={`Word #${confirmIdx + 1}`}
                className="h-12"
                autoCapitalize="none"
              />
              <div className="flex gap-2">
                <Button variant="ghost" className="flex-1" onClick={() => setStep("seed-show")}>
                  <Eye className="mr-1 h-4 w-4" /> Show phrase
                </Button>
                <Button
                  className="flex-1 rounded-full"
                  disabled={confirmWord.trim().toLowerCase() !== words[confirmIdx]}
                  onClick={() => goPassword("generated")}
                >
                  Continue
                </Button>
              </div>
            </div>
          )}

          {step === "import" && (
            <div className="space-y-4">
              <h2 className="font-display text-xl font-semibold uppercase">Import phrase</h2>
              <Textarea
                rows={4}
                className="font-mono text-sm"
                placeholder="word word word …"
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
              />
              <div className="flex gap-2">
                <Button variant="ghost" className="flex-1" onClick={() => setStep("choose")}>
                  <ArrowLeft className="mr-1 h-4 w-4" /> Back
                </Button>
                <Button
                  className="flex-1 rounded-full"
                  disabled={!importText.trim()}
                  onClick={handleImport}
                >
                  Continue
                </Button>
              </div>
            </div>
          )}

          {step === "password" && (
            <div className="space-y-4">
              <h2 className="font-display text-xl font-semibold uppercase">Lock this device</h2>
              <p className="text-sm text-muted-foreground">
                This password encrypts your wallet on this phone. It can't recover your funds — only
                your {origin === "coin" ? "coin" : "recovery phrase"} can do that.
              </p>
              <Input
                type="password"
                placeholder="Password (min 8 characters)"
                value={pass1}
                onChange={(e) => setPass1(e.target.value)}
                className="h-12"
                autoComplete="new-password"
              />
              <Input
                type="password"
                placeholder="Confirm password"
                value={pass2}
                onChange={(e) => setPass2(e.target.value)}
                className="h-12"
                autoComplete="new-password"
              />
              {bioAvailable && (
                <label className="flex items-center gap-2.5 text-sm">
                  <input
                    type="checkbox"
                    checked={useBio}
                    onChange={(e) => setUseBio(e.target.checked)}
                    className="h-4 w-4 accent-[#ff3dbe]"
                  />
                  <Fingerprint className="h-4 w-4" /> Unlock with Face ID / fingerprint
                </label>
              )}
              <Button
                className="h-12 w-full rounded-full"
                onClick={() => {
                  if (pass1.length < 8) return toast.error("Password must be at least 8 characters");
                  if (pass1 !== pass2) return toast.error("Passwords do not match");
                  setStep("welcome");
                }}
              >
                <ShieldCheck className="mr-1.5 h-4 w-4" /> Continue
              </Button>
            </div>
          )}

          {step === "welcome" && (
            <div className="space-y-4">
              <h2 className="font-display text-xl font-semibold uppercase">Where do you POP?</h2>
              <p className="text-sm text-muted-foreground">
                Pick your market so you see the right events, merchants and points token.
              </p>
              <div className="space-y-2">
                <label className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-wide text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" /> POP market
                </label>
                <select
                  value={marketSlug}
                  onChange={(e) => setMarketSlug(e.target.value)}
                  className="h-12 w-full rounded-xl border border-white/12 bg-black/30 px-3 text-sm"
                >
                  {markets.length === 0 && <option value="">Loading markets…</option>}
                  {markets.map((m) => (
                    <option key={m.slug} value={m.slug} className="bg-background">
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-wide text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" /> Email (optional)
                </label>
                <Input
                  type="email"
                  inputMode="email"
                  autoCapitalize="none"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12"
                />
                <p className="text-xs text-muted-foreground">
                  Add it and we'll drop {WELCOME_POP} POP into this wallet to get you started, and
                  match you to events you RSVP for. Skip it and your wallet stays fully anonymous —
                  we never email your keys, and we can't recover them.
                </p>
              </div>

              <Button className="h-12 w-full rounded-full" onClick={handleCreate} disabled={busy}>
                {busy ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="mr-1.5 h-4 w-4" />
                )}
                {busy ? "Creating wallet…" : "Create wallet"}
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setStep("password")}>
                <ArrowLeft className="mr-1 h-4 w-4" /> Back
              </Button>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Don't have a coin yet?{" "}
          <a
            href="https://coldstoragecoins.com"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4"
          >
            Get a Cold Storage Coin
          </a>
        </p>
      </main>

      <QrScanDialog
        open={scanOpen}
        onOpenChange={setScanOpen}
        onResult={handleScan}
        title="Scan your Cold Storage Coin"
        description="Point your camera at the QR code on the back of the coin. The phrase never leaves this device."
      />
    </div>
  );
}
