import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Eye, EyeOff, Copy, Check, ShieldCheck, AlertTriangle, Download } from "lucide-react";
import { recoverWalletSeed } from "@/lib/wallet-backup.functions";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/recover-wallet")({
  head: () => ({
    meta: [
      { title: "Export Wallet Key — CryptoPOP" },
      { name: "description", content: "Export your CryptoPOP wallet private key." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RecoverWalletPage,
});

function RecoverWalletPage() {
  const recover = useServerFn(recoverWalletSeed);
  const [secret, setSecret] = useState<string | null>(null);
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
      if (!res.secret) {
        setError("No wallet on file. Sign in first and your wallet will be created automatically.");
      } else {
        setSecret(res.secret);
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
    if (!secret) return;
    await navigator.clipboard.writeText(secret);
    setCopied(true);
    toast.success("Private key copied");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!secret || !address) return;
    const body =
      `CryptoPOP Wallet — Private Key Export\n` +
      `=====================================\n\n` +
      `Address: ${address}\n` +
      `Private Key (WIF): ${secret}\n\n` +
      `Import this WIF into any TXC-compatible wallet to take self-custody\n` +
      `of your POP. Anyone with this key controls the wallet. Keep it offline.`;
    const blob = new Blob([body], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cryptopop-wallet-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Wallet key downloaded");
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
            Export Wallet Key
          </h1>
          <p className="text-muted-foreground">
            Your CryptoPOP wallet is custodial — managed for you against your email account.
            You can export the private key any time to take self-custody in any TXC-compatible
            wallet.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 space-y-6">
          <div className="flex items-start gap-3 text-sm text-muted-foreground">
            <ShieldCheck className="h-5 w-5 mt-0.5 text-[hsl(var(--neon-cyan))] shrink-0" />
            <div>
              <p className="text-foreground font-medium mb-1">Sandbox wallet</p>
              <p>
                POP tokens are non-monetary reward points. Your wallet stays linked to your email —
                sign in on any device and you'll see the same POP balance.
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
              {loading ? "Loading…" : "Reveal private key"}
            </Button>
          )}

          {error && (
            <div className="flex items-start gap-2 text-sm text-destructive rounded-lg border border-destructive/30 bg-destructive/10 p-3">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {revealed && secret && (
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
                  Private key (WIF)
                </div>
                <div className="font-mono text-sm break-all rounded-xl bg-background border border-border p-4">
                  {secret}
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
                <Button variant="outline" onClick={handleDownload} className="flex-1">
                  <Download className="h-4 w-4 mr-2" /> Download .txt
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setRevealed(false);
                    setSecret(null);
                  }}
                  className="flex-1"
                >
                  <EyeOff className="h-4 w-4 mr-2" /> Hide
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                Anyone with this key can spend your POP. Treat it like a password.
              </p>
            </div>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
