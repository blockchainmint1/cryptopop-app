// The ONLY place the offline service worker is registered. Refuses (and
// cleans up) in dev, iframes, Lovable previews, and when ?sw=off is present.
const SW_PATH = "/sw.js";

function isRefusedContext(): boolean {
  if (!import.meta.env.PROD) return true;
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  const host = window.location.hostname.toLowerCase();
  const params = new URLSearchParams(window.location.search);
  if (params.get("sw") === "off") return true;
  const previewDomains = [".lovable.app", ".gpt-eng.com", ".gptengineer.run"];
  if (previewDomains.some((d) => host.endsWith(d))) {
    const label = host.split(".")[0];
    if (/^(?:id-preview|preview)(?:-[a-z0-9]+)?--.+$/.test(label)) return true;
    if (/^project--[a-z0-9-]+-dev$/.test(label)) return true;
  }
  if (host === "lovableproject.com" || host.endsWith(".lovableproject.com")) return true;
  if (host === "lovableproject-dev.com" || host.endsWith(".lovableproject-dev.com")) return true;
  if (host === "beta.lovable.dev" || host.endsWith(".beta.lovable.dev")) return true;
  return false;
}

async function unregisterAppWorkers() {
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    regs
      .filter((r) => (r.active || r.installing || r.waiting)?.scriptURL.endsWith(SW_PATH))
      .map((r) => r.unregister().catch(() => undefined)),
  );
}

export function registerOfflineSupport() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  if (isRefusedContext()) {
    void unregisterAppWorkers().catch(() => undefined);
    return;
  }
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker
    .register(SW_PATH, { scope: "/" })
    .then((reg) => {
      // Check for a newer version whenever the app comes back to the foreground.
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") void reg.update().catch(() => undefined);
      });
    })
    .catch(() => undefined);
  // A new version took over: offer a refresh (never force it — reload locks the vault).
  let notified = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || notified) return;
    notified = true;
    void import("sonner").then(({ toast }) =>
      toast("A new version of CryptoPOP is ready", {
        duration: Infinity,
        action: { label: "Refresh", onClick: () => window.location.reload() },
      }),
    );
  });
}
