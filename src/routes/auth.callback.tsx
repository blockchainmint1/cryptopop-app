import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import callbackBg from "@/assets/auth-callback-bg.jpg";

export const Route = createFileRoute("/auth/callback")({
  head: () => ({ meta: [{ title: "Signing in…" }] }),
  component: CallbackPage,
});

function CallbackPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    navigate({ to: session ? "/app" : "/login", replace: true });
  }, [loading, session, navigate]);

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
