import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

/** Receives a one-time Honest Money ticket addressed to TSD Bridge and hands it to the opening wallet tab. */
export const Route = createFileRoute("/sso-tsd")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({ token: typeof s.token === "string" ? s.token : undefined }),
  head: () => ({
    meta: [
      { title: "Approving TSD Bridge — CryptoPOP" },
      { name: "description", content: "Finishing your Honest Money approval for TSD Bridge setup." },
      { property: "og:title", content: "Approving TSD Bridge — CryptoPOP" },
      { property: "og:description", content: "Finishing your Honest Money approval for TSD Bridge." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SsoTsd,
});

function SsoTsd() {
  const { token } = Route.useSearch();
  const [msg, setMsg] = useState("Finishing your approval…");
  useEffect(() => {
    if (!token || !window.opener || window.opener === window) { setMsg("This approval window can be closed."); return; }
    try { window.opener.postMessage({ type: "tsd-ticket", token }, window.location.origin); } catch { /* ignore */ }
    window.close();
  }, [token]);
  return <main className="grid min-h-screen place-items-center p-6 text-center text-muted-foreground">{msg}</main>;
}
