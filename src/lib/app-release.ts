/**
 * Single source of truth for the published POP Wallet release.
 *
 * APP_VERSION / APK_URL are baked into *this* build; the live "what's newest?"
 * answer comes from the `app_releases` table, so a freshly pinned APK reaches
 * already-installed apps without shipping new code.
 */
import { supabase } from "@/integrations/supabase/client";

export const APP_VERSION = "1.0.5";

/** Public IPFS gateway used for pinned builds. */
export const IPFS_GATEWAY = "https://txc.mypinata.cloud/ipfs/";

/**
 * Download through our own endpoint, never the raw CDN/gateway asset: those
 * serve a generic binary type and Chrome saves the APK as ".zip", which breaks
 * tap-to-install. /api/public/apk streams it with the Android MIME type.
 */
export const APK_URL = "https://app.cryptopop.org/api/public/apk";

export type ReleasePlatform = "android" | "ios" | "web";

declare const __BUILD_ID__: string;

/** Build stamp of the JS bundle this tab/webview is running. */
export const LOCAL_BUILD_ID: string =
  typeof __BUILD_ID__ !== "undefined" ? __BUILD_ID__ : "dev";

/** The version actually installed natively (falls back to the web bundle's). */
export async function installedVersion(): Promise<string> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor.isNativePlatform()) {
      const { App } = await import("@capacitor/app");
      const info = await App.getInfo();
      if (info?.version) return info.version;
    }
  } catch {
    /* not native */
  }
  return APP_VERSION;
}

export type AppRelease = {
  platform: string;
  version: string;
  ipfs_cid: string | null;
  download_url: string | null;
  notes: string | null;
  mandatory: boolean;
  released_at: string;
};

/** Fixed, key-free places to ask "what's the newest build?". */
export const RELEASE_FEED_HOSTS = [
  "https://app.cryptopop.org",
  "https://cryptopop-app.lovable.app",
] as const;

const RELEASE_FEED_PATH = "/api/public/latest-release";

async function fetchFeed(base: string, platform: ReleasePlatform): Promise<AppRelease | null> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const res = await fetch(`${base}${RELEASE_FEED_PATH}?platform=${platform}&_=${Date.now()}`, {
      cache: "no-store",
      signal: ctl.signal,
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { release?: AppRelease | null };
    return json?.release ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Newest published release for a platform, or null if no source answers. */
export async function fetchLatestRelease(platform: ReleasePlatform): Promise<AppRelease | null> {
  const bases: string[] = [];
  if (typeof window !== "undefined" && window.location.origin.startsWith("http")) {
    bases.push(window.location.origin);
  }
  for (const h of RELEASE_FEED_HOSTS) if (!bases.includes(h)) bases.push(h);

  for (const base of bases) {
    const rel = await fetchFeed(base, platform);
    if (rel) return rel;
  }

  // Last resort: direct Data API read with this build's key.
  try {
    const { data, error } = await supabase
      .from("app_releases")
      .select("platform, version, ipfs_cid, download_url, notes, mandatory, released_at")
      .eq("platform", platform)
      .order("released_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return data as AppRelease;
  } catch {
    return null;
  }
}

/** Numeric-aware version compare: 1 if a > b, -1 if a < b, 0 if equal. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(/[.\-+]/);
  const pb = b.split(/[.\-+]/);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = Number(pa[i] ?? 0);
    const nb = Number(pb[i] ?? 0);
    if (Number.isNaN(na) || Number.isNaN(nb)) {
      const sa = pa[i] ?? "";
      const sb = pb[i] ?? "";
      if (sa !== sb) return sa > sb ? 1 : -1;
      continue;
    }
    if (na !== nb) return na > nb ? 1 : -1;
  }
  return 0;
}

/**
 * Where to send the user. Always our own APK endpoint so the phone gets the
 * right MIME type; the endpoint resolves the pinned IPFS copy server-side.
 */
export function releaseDownloadUrl(_r: AppRelease | null): string {
  if (typeof window !== "undefined" && window.location.origin.startsWith("http")) {
    return `${window.location.origin}/api/public/apk`;
  }
  return APK_URL;
}

/** Direct IPFS link for a release, when it has been pinned. */
export function ipfsUrl(r: AppRelease | null): string | null {
  return r?.ipfs_cid ? `${IPFS_GATEWAY}${r.ipfs_cid}` : null;
}

/** Build stamp the server is shipping right now, or null if unreachable. */
export async function fetchServerBuildId(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    const res = await fetch(`${window.location.origin}/api/public/build-id?_=${Date.now()}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { buildId?: string };
    return json?.buildId ?? null;
  } catch {
    return null;
  }
}

const RELOADED_FOR_KEY = "cryptopop.reloadedForBuild";

function reloadedFor(): string | null {
  try {
    return window.localStorage.getItem(RELOADED_FOR_KEY);
  } catch {
    return null;
  }
}

/** Web/webview freshness: is this bundle older than what the server serves? */
export async function checkForWebUpdate(): Promise<"current" | "update" | "unknown"> {
  const serverBuild = await fetchServerBuildId();
  if (!serverBuild) return "unknown";
  if (LOCAL_BUILD_ID === "dev") return "current";
  if (serverBuild === LOCAL_BUILD_ID) return "current";
  // Client and server bundles are stamped in separate passes, so a mismatch can
  // survive a reload. Once we've reloaded for this stamp, accept we're current.
  if (reloadedFor() === serverBuild) return "current";
  return "update";
}

/** Drop caches (incl. service worker) and hard-reload into the new build. */
export async function applyWebUpdate(): Promise<void> {
  try {
    const serverBuild = await fetchServerBuildId();
    if (serverBuild) window.localStorage.setItem(RELOADED_FOR_KEY, serverBuild);
  } catch {
    /* best effort */
  }
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister().catch(() => undefined)));
    }
  } catch {
    /* best effort */
  }
  const url = new URL(window.location.href);
  url.searchParams.set("_r", Date.now().toString());
  window.location.replace(url.toString());
}
