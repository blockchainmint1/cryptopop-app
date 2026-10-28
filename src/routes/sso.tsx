import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { exchangeHmeTicket } from "@/lib/hme.functions";

export const Route = createFileRoute("/sso")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    token: typeof s.token === "string" ? s.token : undefined,
    popup: s.popup != null ? String(s.popup) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Signing in with Honest Money — CryptoPOP" },
      { name: "description", content: "Finishing your Honest Money sign-in to the CryptoPOP wallet." },
      { property: "og:title", content: "Sign in with Honest Money — CryptoPOP" },
      { property: "og:description", content: "Finishing your Honest Money sign-in." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SsoPage,
});

function SsoPage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const exchange = useServerFn(exchangeHmeTicket);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Missing sign-in ticket.");
      return;
    }
    let done = false;
    (async () => {
      try {
        const res = await exchange({ data: { token } });
        const { error: e } = await supabase.auth.verifyOtp({ token_hash: res.tokenHash, type: "magiclink" });
        if (e) throw e;
        if (done) return;
        if (window.opener && window.opener !== window) {
          try { window.opener.postMessage({ type: "hme-sso-done" }, window.location.origin); } catch { /* ignore */ }
          window.close();
        }
        navigate({ to: "/", replace: true });
      } catch (e) {
        console.error(e);
        const msg = e instanceof Error ? e.message : "";
        setError(
          msg.startsWith("Sign in to your existing") || msg.startsWith("Existing account ownership")
            ? "This email already has a CryptoPOP account. Sign in to that account first, then connect Honest Money."
            : "That sign-in link didn't work or has expired. Please try again.",
        );
      }
    })();
    return () => { done = true; };
  }, [token, exchange, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 text-center text-foreground">
      {error ? (
        <div>
          <p className="text-sm text-muted-foreground">{error}</p>
          <a href="/login" className="mt-4 inline-block text-sm underline">Back to sign in</a>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="font-mono text-xs uppercase tracking-[0.22em]">Signing in with Honest Money…</span>
        </div>
      )}
    </div>
  );
}
