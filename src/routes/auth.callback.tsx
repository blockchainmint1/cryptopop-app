import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getMyAdminStatus } from "@/lib/admin-role.functions";
import callbackBg from "@/assets/auth-callback-bg.jpg";

export const Route = createFileRoute("/auth/callback")({
  head: () => ({ meta: [{ title: "Signing in…" }] }),
  component: CallbackPage,
});

function CallbackPage() {
  const navigate = useNavigate();
  const getAdminStatus = useServerFn(getMyAdminStatus);

  useEffect(() => {
    let done = false;
    const finish = async (to: "/app" | "/login" | "/admin") => {
      if (done) return;
      done = true;
      navigate({ to, replace: true });
    };

    const routeForSession = async (): Promise<"/app" | "/admin"> => {
      try {
        const { isAdmin } = await getAdminStatus();
        console.info("Callback admin redirect decision", { isAdmin });
        return isAdmin ? "/admin" : "/app";
      } catch (error) {
        console.error("Callback admin redirect check failed", error);
        return "/app";
      }
    };

    const finishForSession = async () => finish(await routeForSession());

    const url = typeof window !== "undefined" ? window.location.href : "";
    const hasAuthPayload =
      url.includes("access_token=") ||
      url.includes("refresh_token=") ||
      url.includes("code=") ||
      url.includes("type=recovery") ||
      url.includes("type=magiclink");

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "SIGNED_IN" || (event === "INITIAL_SESSION" && s)) {
        setTimeout(() => {
          void finishForSession();
        }, 0);
      }
    });

    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (s) finish(await routeForSession());
    });

    const timeoutMs = hasAuthPayload ? 8000 : 1500;
    const t = setTimeout(async () => {
      const { data: { session: s } } = await supabase.auth.getSession();
      if (s) finish(await routeForSession());
      else finish("/login");
    }, timeoutMs);

    return () => {
      subscription.unsubscribe();
      clearTimeout(t);
    };
  }, [navigate, getAdminStatus]);

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
