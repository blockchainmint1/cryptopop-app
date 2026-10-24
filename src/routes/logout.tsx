import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/logout")({
  head: () => ({ meta: [
    { title: "Sign out — CryptoPOP Wallet" },
    { name: "description", content: "Sign out of your CryptoPOP account." },
    { property: "og:title", content: "Sign out — CryptoPOP Wallet" },
    { property: "og:description", content: "Sign out of your CryptoPOP account." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: LogoutPage,
});

function LogoutPage() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await supabase.auth.signOut();
      } catch {
        // ignore
      }
      if (cancelled) return;
      navigate({ to: "/", replace: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <p className="font-mono text-sm uppercase tracking-widest opacity-70">
        Signing you out…
      </p>
    </div>
  );
}
