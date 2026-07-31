import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Mail, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import logo from "@/assets/cryptopop-logo.png";
import loginBg from "@/assets/login-cinematic-bg.jpg";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? safeRedirect(search.redirect) : undefined,
  }),
  head: () => ({ meta: [{ title: "Sign in — CryptoPOP" }] }),
  component: LoginPage,
});

function safeRedirect(value: string | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return undefined;
  if (value === "/login" || value.startsWith("/auth/callback") || value === "/logout") {
    return undefined;
  }
  return value;
}

function LoginPage() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [sent, setSent] = useState(false);
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();

  const routeAfterSignIn = async () => redirect ?? "/";

  useEffect(() => {
    if (loading || !session) return;

    let cancelled = false;
    routeAfterSignIn()
      .then((to) => {
        if (cancelled) return;
        console.info("Admin redirect decision", { to, email: session.user.email });
        navigate({ to: to as never, replace: true });
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("Admin redirect check failed", error);
        navigate({ to: "/", replace: true });
      });

    return () => {
      cancelled = true;
    };
  }, [loading, session, navigate, redirect]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSending(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ""}`,
      },
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
    if (error) {
      toast.error(error.message);
      return;
    }
    navigate({ to: (await routeAfterSignIn()) as never, replace: true });
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      {/* Cinematic background */}
      <img
        src={loginBg}
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover hero-zoom"
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(8,5,20,0.45) 0%, rgba(8,5,20,0.7) 55%, rgba(8,5,20,0.92) 100%)",
        }}
      />
      {/* Aurora glows */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-1/4 -left-1/4 h-[100vh] w-[100vh] rounded-full blur-3xl opacity-60 hero-aurora-a"
        style={{
          background:
            "radial-gradient(circle, rgba(255,122,40,0.5), rgba(255,61,190,0.25) 45%, transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-1/4 -right-1/4 h-[90vh] w-[90vh] rounded-full blur-3xl opacity-50 hero-aurora-b"
        style={{
          background:
            "radial-gradient(circle, rgba(255,220,90,0.45), rgba(255,61,190,0.18) 50%, transparent 75%)",
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col px-6 py-8">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="CryptoPOP" className="h-8 w-auto" />
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/5 px-3 py-1.5 font-mono text-xs text-white/80 backdrop-blur-md hover:bg-white/10 hover:text-white transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Link>
        </div>

        <div className="flex flex-1 items-center">
          <div
            className="hero-fade-up relative w-full overflow-hidden rounded-3xl border border-white/15 bg-white/5 p-8 backdrop-blur-xl"
            style={{
              boxShadow:
                "0 30px 80px -20px rgba(255,61,190,0.35), 0 0 0 1px rgba(255,255,255,0.06) inset",
            }}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -top-20 -right-20 h-56 w-56 rounded-full blur-3xl opacity-70"
              style={{
                background:
                  "radial-gradient(circle, rgba(255,122,40,0.5), rgba(255,61,190,0.25) 50%, transparent 75%)",
              }}
            />
            <div className="relative">
              <div
                className="inline-flex h-12 w-12 items-center justify-center rounded-2xl text-white"
                style={{
                  background: "linear-gradient(135deg, #ff7a28, #ff3dbe)",
                  boxShadow: "0 10px 30px -10px rgba(255,122,40,0.7)",
                }}
              >
                <Mail className="h-6 w-6" />
              </div>
              <h1 className="mt-6 font-display text-4xl font-bold uppercase tracking-tight text-white">
                {sent ? "Check your inbox" : "Sign in to CryptoPOP"}
              </h1>
              <p className="mt-3 text-white/75">
                {sent
                  ? `We sent a magic link to ${email}. Tap it on this device to finish signing in.`
                  : "Enter your email and we'll send you a magic link. No passwords."}
              </p>

              {!sent ? (
                <form onSubmit={onSubmit} className="mt-8 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-white/80">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      required
                      placeholder="you@domain.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-12 border-white/20 bg-white/10 text-white placeholder:text-white/40 backdrop-blur-md focus-visible:ring-[#ff3dbe]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={sending}
                    className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-full px-7 font-display text-base font-semibold text-white transition hover:opacity-95 disabled:opacity-60"
                    style={{
                      background: "linear-gradient(90deg, #ff7a28, #ff3dbe)",
                      boxShadow:
                        "0 18px 50px -12px rgba(255,122,40,0.7), 0 0 0 1px rgba(255,255,255,0.08) inset",
                    }}
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send magic link"}
                  </button>
                  <p className="text-xs text-white/60">
                    By continuing you agree to receive a one-time sign-in email.
                  </p>
                </form>
              ) : (
                <div className="mt-8 space-y-4">
                  <form onSubmit={onVerifyCode} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="code" className="text-white/80">Email code</Label>
                      <Input
                        id="code"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        required
                        placeholder="123456"
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        className="h-12 border-white/20 bg-white/10 text-center font-mono text-lg tracking-[0.35em] text-white placeholder:text-white/35 backdrop-blur-md focus-visible:ring-[#ff3dbe]"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={verifying || code.replace(/\D/g, "").length < 6}
                      className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-full px-7 font-display text-base font-semibold text-white transition hover:opacity-95 disabled:opacity-60"
                      style={{
                        background: "linear-gradient(90deg, #ff7a28, #ff3dbe)",
                        boxShadow:
                          "0 18px 50px -12px rgba(255,122,40,0.7), 0 0 0 1px rgba(255,255,255,0.08) inset",
                      }}
                    >
                      {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify code"}
                    </button>
                  </form>
                  <button
                    onClick={() => { setSent(false); setEmail(""); setCode(""); }}
                    className="h-12 w-full rounded-full border border-white/25 bg-white/5 font-display font-semibold text-white backdrop-blur-md hover:bg-white/10 transition"
                  >
                    Use a different email
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
