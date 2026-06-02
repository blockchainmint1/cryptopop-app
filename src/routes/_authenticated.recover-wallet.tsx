import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Eye, EyeOff, Copy, Check, ShieldCheck, AlertTriangle } from "lucide-react";
import { recoverWalletSeed } from "@/lib/wallet-backup.functions";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/recover-wallet")({
  head: () => ({
    meta: [
      { title: "Recover Wallet — CryptoPOP" },
      { name: "description", content: "Recover your CryptoPOP sandbox wallet seed phrase." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RecoverWalletPage,
});

function RecoverWalletPage() {
  const recover = useServerFn(recoverWalletSeed);
  const [mnemonic, setMnemonic] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReveal = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await recover();
      if (!res.mnemonic) {
        setError("No backup found yet. Sign in on any device and your wallet will be created automatically.");
      } else {
        setMnemonic(res.mnemonic);
        setAddress(res.address);
        setRevealed(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!mnemonic) return;
    await navigator.clipboard.writeText(mnemonic);
    setCopied(true);
    toast.success("Seed phrase copied");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="px-6 pt-6">
        <Link
          to="/app"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </header>

      <main className="flex-1 max-w-xl w-full mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="font-display text-5xl uppercase tracking-wide mb-3">
            Recover Wallet
          </h1>
          <p className="text-muted-foreground">
            Your sandbox POP wallet seed is encrypted and backed up to your CryptoPOP account.
            Reveal it any time to restore on a new device.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 space-y-6">
          <div className="flex items-start gap-3 text-sm text-muted-foreground">
            <ShieldCheck className="h-5 w-5 mt-0.5 text-[hsl(var(--neon-cyan))] shrink-0" />
            <div>
              <p className="text-foreground font-medium mb-1">Sandbox wallet</p>
              <p>
                POP tokens are non-monetary reward points. This wallet is for the CryptoPOP
                community — feel free to experiment. You can recover here any time.
              </p>
            </div>
          </div>

          {!revealed && (
            <Button
              onClick={handleReveal}
              disabled={loading}
              className="w-full"
              size="lg"
            >
              <Eye className="h-4 w-4 mr-2" />
              {loading ? "Loading…" : "Reveal seed phrase"}
            </Button>
          )}

          {error && (
            <div className="flex items-start gap-2 text-sm text-destructive rounded-lg border border-destructive/30 bg-destructive/10 p-3">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {revealed && mnemonic && (
            <div className="space-y-4">
              {address && (
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1 font-mono">
                    Wallet address
                  </div>
                  <div className="font-mono text-sm break-all">{address}</div>
                </div>
              )}

              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2 font-mono">
                  Seed phrase (12 words)
                </div>
                <div className="grid grid-cols-3 gap-2 p-4 rounded-xl bg-background border border-border">
                  {mnemonic.split(" ").map((word, i) => (
                    <div
                      key={i}
                      className="font-mono text-sm flex items-baseline gap-1.5"
                    >
                      <span className="text-muted-foreground text-xs w-4">
                        {i + 1}.
                      </span>
                      <span>{word}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={handleCopy} className="flex-1">
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 mr-2" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" /> Copy
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setRevealed(false);
                    setMnemonic(null);
                  }}
                  className="flex-1"
                >
                  <EyeOff className="h-4 w-4 mr-2" /> Hide
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                Anyone with this phrase can access your sandbox POP. Treat it like a password.
              </p>
            </div>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
