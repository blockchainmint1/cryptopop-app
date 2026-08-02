/**
 * "Check for updates" support.
 *
 * The native shell loads the live web app, so an update simply means a newer
 * web build is deployed. We detect that by fetching the current HTML shell with
 * a cache-buster and comparing the hashed client entry scripts with the ones in
 * the running document. Different hashes => a new build is live.
 */

function scriptFingerprint(html: string): string {
  const matches = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/g)].map((m) => m[1]);
  return matches.filter((s) => s.includes("/_build/") || /-[A-Za-z0-9_]{6,}\.js/.test(s)).sort().join("|");
}

function currentFingerprint(): string {
  const srcs = [...document.querySelectorAll("script[src]")].map(
    (el) => (el as HTMLScriptElement).getAttribute("src") ?? "",
  );
  return srcs
    .filter((s) => s.includes("/_build/") || /-[A-Za-z0-9_]{6,}\.js/.test(s))
    .sort()
    .join("|");
}

export async function checkForUpdate(): Promise<{ updateAvailable: boolean }> {
  const res = await fetch(`/?_cacheBust=${Date.now()}`, {
    cache: "no-store",
    headers: { "cache-control": "no-cache" },
  });
  if (!res.ok) throw new Error("Couldn't reach the server");
  const html = await res.text();
  const remote = scriptFingerprint(html);
  const local = currentFingerprint();
  if (!remote || !local) return { updateAvailable: false };
  return { updateAvailable: remote !== local };
}

/** Drops caches and hard-reloads so the newest build is fetched. */
export async function applyUpdate(): Promise<void> {
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.allSettled(keys.map((k) => caches.delete(k)));
    }
  } catch {
    /* ignore */
  }
  const url = new URL(window.location.href);
  url.searchParams.set("_u", String(Date.now()));
  window.location.replace(url.toString());
}

/** App version string for display (native build info when available). */
export async function appVersionLabel(): Promise<string | null> {
  try {
    const { isNative } = await import("./platform");
    if (!isNative()) return null;
    const { App } = await import("@capacitor/app");
    const info = await App.getInfo();
    return `v${info.version} (${info.build})`;
  } catch {
    return null;
  }
}
