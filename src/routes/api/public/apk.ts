/**
 * APK download endpoint with correct Android headers.
 *
 *   GET /api/public/apk
 *
 * Why proxy instead of redirect: IPFS gateways and CDNs serve an APK as
 * `application/zip`, so Chrome saves it as ".zip" and it can't be tapped to
 * install. We stream the same bytes, copy upstream's Content-Length verbatim
 * and override the type/filename to the Android package MIME type.
 *
 * The source is looked up live from `app_releases`, so pinning a new build to
 * IPFS (or swapping the CDN link) needs no code change.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { IPFS_GATEWAY } from "@/lib/app-release";

/** Used when the release feed is unreachable. */
const FALLBACK_URL =
  "https://txc.mypinata.cloud/ipfs/bafybeid5fs6vhm733vmkdikqtl2h6rrgj2ghp3rlorvvxmhnuafwqz5x6a?filename=popwallet-1.0.6-release.apk&download=true";
const FALLBACK_FILENAME = "popwallet-1.0.6-release.apk";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Expose-Headers": "Content-Length, Content-Disposition, Accept-Ranges",
  "Access-Control-Max-Age": "86400",
} as const;

/** Dedicated Pinata gateway when configured, else the shared public one. */
function gatewayBase(): string {
  const gw = process.env["PINATA_GW"]?.trim();
  if (!gw) return IPFS_GATEWAY;
  const host = gw.replace(/\/+$/, "");
  const withScheme = host.startsWith("http") ? host : `https://${host}`;
  return withScheme.endsWith("/ipfs") ? `${withScheme}/` : `${withScheme}/ipfs/`;
}

async function resolveSource(): Promise<{ url: string; filename: string }> {
  try {
    const supabase = createClient(
      process.env["SUPABASE_URL"]!,
      process.env["SUPABASE_PUBLISHABLE_KEY"]!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data } = await supabase
      .from("app_releases")
      .select("version, ipfs_cid, download_url")
      .eq("platform", "android")
      .order("released_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      const filename = `popwallet-${data.version}-release.apk`;
      if (data.ipfs_cid) {
        return {
          url: `${gatewayBase()}${data.ipfs_cid}?filename=${filename}&download=true`,
          filename,
        };
      }
      // Guard against pointing this endpoint at itself.
      if (data.download_url && !data.download_url.includes("/api/public/apk")) {
        return { url: data.download_url, filename };
      }
    }
  } catch {
    /* fall through */
  }
  return { url: FALLBACK_URL, filename: FALLBACK_FILENAME };
}

function downloadHeaders(filename: string, length: string | null): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/vnd.android.package-archive",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "public, max-age=300",
    "Accept-Ranges": "none",
    ...corsHeaders,
  };
  if (length) h["Content-Length"] = length;
  return h;
}

export const Route = createFileRoute("/api/public/apk")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),

      HEAD: async () => {
        const { url, filename } = await resolveSource();
        let length: string | null = null;
        try {
          const res = await fetch(url, { method: "HEAD" });
          length = res.headers.get("content-length");
        } catch {
          /* unknown length is fine */
        }
        return new Response(null, { status: 200, headers: downloadHeaders(filename, length) });
      },

      GET: async () => {
        const { url, filename } = await resolveSource();
        const upstream = await fetch(url, { headers: { "Accept-Encoding": "identity" } });
        if (!upstream.ok || !upstream.body) {
          return new Response("Download unavailable", { status: 502, headers: corsHeaders });
        }
        return new Response(upstream.body, {
          status: 200,
          headers: downloadHeaders(filename, upstream.headers.get("content-length")),
        });
      },
    },
  },
});
