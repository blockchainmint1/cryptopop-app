import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import logo from "@/assets/cryptopop-logo.png";

/**
 * Inline wallet unlock screen. Shown on the homepage when there is no session
 * so the app opens straight into the wallet instead of a marketing page.
 */
export function WalletSignIn() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSending(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setSending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
  };

  const onVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = code.replace(/\D/g, "");
    if (!email || token.length < 6) return;
    setVerifying(true);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token,
      type: "email",
    });
    setVerifying(false);
    if (error) toast.error(error.message);
    // Session change is picked up by useAuth; the wallet renders automatically.
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-1/4 -left-1/4 h-[80vh] w-[80vh] rounded-full blur-3xl opacity-50"
        style={{
          background:
            "radial-gradient(circle, rgba(255,122,40,0.45), rgba(255,61,190,0.22) 45%, transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-1/4 -right-1/4 h-[70vh] w-[70vh] rounded-full blur-3xl opacity-40"
        style={{
          background:
            "radial-gradient(circle, rgba(139,61,255,0.5), rgba(0,229,255,0.18) 50%, transparent 75%)",
        }}
      />

      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-md flex-col px-5 py-10">
        <div className="flex flex-1 flex-col justify-center">
          <div className="text-center">
            <img src={logo} alt="CryptoPOP" className="mx-auto h-14 w-auto" />
            <h1 className="mt-6 font-display text-4xl font-bold uppercase tracking-tight">
              CryptoPOP Wallet
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {sent
                ? `Enter the 6-digit code we sent to ${email}, or tap the magic link.`
                : "Enter your email to open your wallet. No passwords."}
            </p>
          </div>

          <div className="mt-8 rounded-3xl border border-white/12 bg-white/5 p-6 backdrop-blur-xl">
            {!sent ? (
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="wallet-email">Email</Label>
                  <Input
                    id="wallet-email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="you@domain.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12"
                  />
                </div>
                <button
                  type="submit"
                  disabled={sending}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full px-7 font-display text-base font-semibold text-white transition hover:opacity-95 disabled:opacity-60"
                  style={{
                    background: "linear-gradient(90deg, #ff7a28, #ff3dbe)",
                    boxShadow: "0 18px 50px -12px rgba(255,122,40,0.6)",
                  }}
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Mail className="h-4 w-4" /> Open my wallet
                    </>
                  )}
                </button>
              </form>
            ) : (
              <div className="space-y-4">
                <form onSubmit={onVerifyCode} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="wallet-code">Email code</Label>
                    <Input
                      id="wallet-code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      required
                      placeholder="123456"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      className="h-12 text-center font-mono text-lg tracking-[0.35em]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={verifying || code.replace(/\D/g, "").length < 6}
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full px-7 font-display text-base font-semibold text-white transition hover:opacity-95 disabled:opacity-60"
                    style={{
                      background: "linear-gradient(90deg, #ff7a28, #ff3dbe)",
                      boxShadow: "0 18px 50px -12px rgba(255,122,40,0.6)",
                    }}
                  >
                    {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify code"}
                  </button>
                </form>
                <button
                  onClick={() => {
                    setSent(false);
                    setCode("");
                  }}
                  className="h-12 w-full rounded-full border border-white/20 bg-white/5 font-display font-semibold transition hover:bg-white/10"
                >
                  Use a different email
                </button>
              </div>
            )}
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Your POP balance lives on the TEXITcoin chain.
          </p>
        </div>
      </main>
    </div>
  );
}
