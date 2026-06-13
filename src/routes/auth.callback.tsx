import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import callbackBg from "@/assets/auth-callback-bg.jpg";

export const Route = createFileRoute("/auth/callback")({
  head: () => ({ meta: [{ title: "Signing in…" }] }),
  component: CallbackPage,
});

function CallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    let done = false;
    const finish = (to: "/app" | "/login") => {
      if (done) return;
      done = true;
      navigate({ to, replace: true });
    };

    // If the URL contains auth tokens / a code, wait for SIGNED_IN before deciding.
    const url = typeof window !== "undefined" ? window.location.href : "";
    const hasAuthPayload =
      url.includes("access_token=") ||
      url.includes("refresh_token=") ||
      url.includes("code=") ||
      url.includes("type=recovery") ||
      url.includes("type=magiclink");

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "SIGNED_IN" || (event === "INITIAL_SESSION" && s)) {
        finish("/app");
      }
    });

    // Also poll getSession as a fallback (covers cases where the event already fired).
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (s) finish("/app");
    });

    // Only bail to /login if there was nothing to process and no session shows up.
    const timeoutMs = hasAuthPayload ? 8000 : 1500;
    const t = setTimeout(async () => {
      const { data: { session: s } } = await supabase.auth.getSession();
      finish(s ? "/app" : "/login");
    }, timeoutMs);

    return () => {
      subscription.unsubscribe();
      clearTimeout(t);
    };
  }, [navigate]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background">
      <img
        src={callbackBg}
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover hero-zoom"
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(8,5,20,0.7) 0%, rgba(8,5,20,0.85) 100%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[60vh] w-[60vh] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl hero-glow"
        style={{
          background:
            "radial-gradient(circle, rgba(255,140,50,0.45), transparent 65%)",
        }}
      />
      <div className="relative z-10 flex items-center gap-3 rounded-full border border-white/20 bg-white/5 px-6 py-3 text-white/90 backdrop-blur-xl">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="font-mono text-xs uppercase tracking-[0.22em]">Finishing sign in…</span>
      </div>
    </div>
  );
}
