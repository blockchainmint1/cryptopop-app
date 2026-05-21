import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Mail, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import loginBg from "@/assets/login-bg.jpg";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — CryptoPOP" }] }),
  component: LoginPage,
});

function LoginPage() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && session) navigate({ to: "/app" });
  }, [loading, session, navigate]);

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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-md px-6 py-8">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>

        <div className="mt-12">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <h1 className="mt-6 font-display text-4xl font-bold tracking-tight">
            {sent ? "Check your inbox" : "Sign in to CryptoPOP"}
          </h1>
          <p className="mt-3 text-muted-foreground">
            {sent
              ? `We sent a magic link to ${email}. Tap it on this device to finish signing in.`
              : "Enter your email and we'll send you a magic link. No passwords."}
          </p>
        </div>

        {!sent ? (
          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12"
              />
            </div>
            <Button type="submit" disabled={sending} className="h-12 w-full text-base">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send magic link"}
            </Button>
            <p className="text-xs text-muted-foreground">
              By continuing you agree to receive a one-time sign-in email.
            </p>
          </form>
        ) : (
          <div className="mt-8 space-y-3">
            <Button variant="outline" className="h-12 w-full" onClick={() => { setSent(false); setEmail(""); }}>
              Use a different email
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
