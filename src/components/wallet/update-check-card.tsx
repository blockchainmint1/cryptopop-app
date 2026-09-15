/**
 * Updates card.
 *
 * One source of truth: the published release feed (`/api/public/latest-release`,
 * backed by `app_releases`). Compares it with the version actually installed on
 * this device and offers a single Install button when a newer build exists.
 */
import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  APK_URL,
  APP_VERSION,
  applyWebUpdate,
  checkForWebUpdate,
  compareVersions,
  fetchLatestRelease,
  installedVersion,
  releaseDownloadUrl,
  type AppRelease,
} from "@/lib/app-release";
import { isNative, nativePlatform } from "@/lib/native/platform";

/**
 * Hand the APK link to the phone's real browser.
 *
 * An in-app Custom Tab download often sticks at "99%" and never becomes
 * tappable; AppLauncher fires a real ACTION_VIEW so Chrome owns the download
 * and offers Install.
 */
async function openDownload(url: string) {
  if (isNative()) {
    try {
      const { AppLauncher } = await import("@capacitor/app-launcher");
      const { completed } = await AppLauncher.openUrl({ url });
      if (completed) return;
    } catch {
      /* fall through */
    }
    try {
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url, windowName: "_system" });
      return;
    } catch {
      /* fall through */
    }
  }
  window.open(url, "_system", "noopener,noreferrer") ||
    window.open(url, "_blank", "noopener,noreferrer");
}

type Status = "idle" | "checking" | "current" | "update" | "unknown";

export function UpdateCheckCard() {
  const [status, setStatus] = useState<Status>("idle");
  const [latest, setLatest] = useState<AppRelease | null>(null);
  const [webStale, setWebStale] = useState(false);
  const [installed, setInstalled] = useState(APP_VERSION);
  const [copied, setCopied] = useState(false);
  const native = isNative();
  const platform = nativePlatform();
  const releasePlatform = native ? (platform === "ios" ? "ios" : "android") : "web";

  const check = useCallback(
    async (opts?: { quiet?: boolean }) => {
      if (!opts?.quiet) setStatus("checking");
      setWebStale(false);

      const current = await installedVersion();
      setInstalled(current);

      const [rel, web] = await Promise.all([
        fetchLatestRelease(releasePlatform),
        checkForWebUpdate(),
      ]);
      setLatest(rel);
      setWebStale(web === "update");

      if (rel && compareVersions(rel.version, current) > 0) return setStatus("update");
      if (web === "update") return setStatus("update");
      if (!rel && web === "unknown") return setStatus("unknown");
      setStatus("current");
    },
    [releasePlatform],
  );

  useEffect(() => {
    void check({ quiet: true });
  }, [check]);

  const downloadUrl = releaseDownloadUrl(latest) || APK_URL;
  const newerRelease = !!latest && compareVersions(latest.version, installed) > 0;

  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-black/20 px-3 py-3">
      <div>
        <p className="font-display text-sm font-semibold uppercase">App version</p>
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Installed {installed} · {native ? platform : "web"}
          {latest ? ` · latest ${latest.version}` : ""}
        </p>
      </div>

      {status === "update" && newerRelease && latest && (
        <div className="space-y-2 rounded-lg border border-primary/40 bg-primary/5 p-3">
          <p className="text-sm">
            <span className="font-medium">Version {latest.version}</span> is available
            {latest.mandatory ? " — required update." : "."}
          </p>
          {latest.notes && <p className="text-sm text-muted-foreground">{latest.notes}</p>}

          {releasePlatform === "ios" ? (
            <p className="text-sm text-muted-foreground">
              iOS updates arrive through the App Store.
            </p>
          ) : (
            <>
              <Button className="w-full rounded-full" onClick={() => void openDownload(downloadUrl)}>
                <Download className="mr-2 h-4 w-4" /> Install {latest.version}
              </Button>
              <p className="text-xs text-muted-foreground">
                This opens your browser to download the file. When it finishes, tap the download
                and confirm &ldquo;Update&rdquo;. Your wallet and settings stay on this device.
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(downloadUrl);
                    setCopied(true);
                    toast.success("Download link copied");
                    setTimeout(() => setCopied(false), 2000);
                  } catch {
                    toast.error("Couldn't copy the link");
                  }
                }}
              >
                {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                Copy download link
              </Button>
            </>
          )}
        </div>
      )}

      {status === "current" && (
        <p className="text-sm text-muted-foreground">
          You&apos;re on the latest version{latest ? ` (${latest.version})` : ""}.
        </p>
      )}

      {status === "unknown" && (
        <p className="text-sm text-muted-foreground">
          Couldn&apos;t reach the update server. Check your connection and try again.
        </p>
      )}

      {!(status === "update" && newerRelease) && !webStale && (
        <Button
          variant="secondary"
          className="w-full rounded-full"
          onClick={() => void check()}
          disabled={status === "checking"}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${status === "checking" ? "animate-spin" : ""}`} />
          {status === "checking" ? "Checking…" : "Check for updates"}
        </Button>
      )}

      {webStale && !(status === "update" && newerRelease) && (
        <>
          <p className="text-sm">Newer app code is live. Reload to get it.</p>
          <Button className="w-full rounded-full" onClick={() => void applyWebUpdate()}>
            Update app code
          </Button>
          <p className="text-xs text-muted-foreground">
            Your wallet stays on this device — this only refreshes the app code. You&apos;ll be
            asked to unlock again.
          </p>
        </>
      )}

      {native && platform === "android" && !newerRelease && status !== "checking" && (
        <Button
          variant="ghost"
          className="w-full"
          onClick={async () => {
            setStatus("checking");
            const rel = await fetchLatestRelease(releasePlatform);
            if (rel) setLatest(rel);
            setStatus("idle");
            await openDownload(rel ? releaseDownloadUrl(rel) : downloadUrl);
          }}
        >
          <Download className="mr-2 h-4 w-4" /> Reinstall latest APK
        </Button>
      )}
    </div>
  );
}
