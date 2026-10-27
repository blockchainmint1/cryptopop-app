import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Globe, SlidersHorizontal, List, Map as MapIcon, MapPin, Store } from "lucide-react";
import { BottomNav, BottomNavSpacer } from "@/components/bottom-nav";
import { SiteFooter } from "@/components/site-footer";
import { listNectarMerchants } from "@/lib/nectarpay.functions";
import { geocodeZip } from "@/lib/public-events.functions";
import type { NectarMerchant } from "@/lib/nectarpay";
import { loadGoogleMaps } from "@/lib/google-maps";

export const Route = createFileRoute("/merchants")({
  head: () => ({
    meta: [
      { title: "Spend TSD — NectarPay stores | POP Wallet" },
      {
        name: "description",
        content: "Find stores that take Texas Stable Dollar through NectarPay and earn POP on every purchase.",
      },
      { property: "og:title", content: "Spend TSD — NectarPay stores" },
      {
        property: "og:description",
        content: "Pay with TSD at NectarPay stores near you and earn POP.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MerchantsPage,
});

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = (d: number) => (d * Math.PI) / 180;
  const dLat = r(b.lat - a.lat);
  const dLng = r(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

function MerchantsPage() {
  const fetchMerchants = useServerFn(listNectarMerchants);
  const { data, isLoading } = useQuery({
    queryKey: ["nectar-merchants"],
    queryFn: () => fetchMerchants(),
    staleTime: 5 * 60_000,
  });
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const [view, setView] = useState<"list" | "map">("list");
  const [showOnline, setShowOnline] = useState(true);
  const [category, setCategory] = useState("all");
  const [radiusMi, setRadiusMi] = useState(0); // 0 = any distance
  const [zip, setZip] = useState("");
  const [zipPoint, setZipPoint] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const [zipErr, setZipErr] = useState<string | null>(null);
  const [zipBusy, setZipBusy] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const lookupZip = useServerFn(geocodeZip);

  async function applyZip() {
    setZipErr(null);
    if (!zip.trim()) {
      setZipPoint(null);
      return;
    }
    setZipBusy(true);
    try {
      setZipPoint(await lookupZip({ data: { zip: zip.trim() } }));
      if (!radiusMi) setRadiusMi(25);
    } catch (e) {
      setZipErr(e instanceof Error ? e.message : "Couldn't find that ZIP code");
    } finally {
      setZipBusy(false);
    }
  }

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (p) => setMe({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => undefined,
      { timeout: 8000 },
    );
  }, []);

  const origin = zipPoint ?? me;
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const m of data?.merchants ?? []) set.add(m.category || "Other");
    return [...set].sort();
  }, [data]);
  const allCount = data?.merchants.length ?? 0;
  const merchants = useMemo(() => {
    let list = (data?.merchants ?? []).map((m) => ({
      ...m,
      km: origin ? distanceKm(origin, m) : null,
    }));
    if (!showOnline) list = list.filter((m) => !m.online);
    if (category !== "all") list = list.filter((m) => (m.category || "Other") === category);
    if (radiusMi > 0 && origin)
      list = list.filter((m) => m.online || (m.km ?? 0) * 0.621 <= radiusMi);
    if (origin) list.sort((a, b) => (a.km ?? 0) - (b.km ?? 0));
    return list;
  }, [data, origin, showOnline, category, radiusMi]);
  const activeFilters =
    (showOnline ? 0 : 1) + (category !== "all" ? 1 : 0) + (radiusMi > 0 ? 1 : 0) + (zipPoint ? 1 : 0);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center gap-2 border-b border-border px-4 py-4">
        <Link
          to="/"
          aria-label="Back to wallet"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="flex-1 font-display text-2xl font-bold tracking-tight">SPEND TSD</h1>
        <div className="flex rounded-full border border-white/15 bg-white/5 p-0.5">
          {(["list", "map"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-label={v === "list" ? "List view" : "Map view"}
              onClick={() => setView(v)}
              className={`rounded-full p-2 ${view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              {v === "list" ? <List className="h-4 w-4" /> : <MapIcon className="h-4 w-4" />}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-xl space-y-3 px-4 py-5">
        <p className="text-sm text-muted-foreground">
          Pay with Texas Stable Dollar at NectarPay stores — scan their checkout code with the camera
          on your wallet home and earn POP on every purchase.
        </p>

        <div className="rounded-2xl border border-border bg-card">
          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            className="flex w-full items-center gap-2 px-4 py-3 text-left"
            aria-expanded={filtersOpen}
          >
            <SlidersHorizontal className="h-4 w-4 text-primary" />
            <span className="flex-1 font-mono text-xs uppercase tracking-wider">
              Filters{activeFilters ? ` · ${activeFilters} on` : ""}
            </span>
            <span className="text-xs text-muted-foreground">
              {merchants.length} of {allCount} stores
            </span>
          </button>
          {filtersOpen && (
            <div className="space-y-4 border-t border-border px-4 py-4">
              <label className="flex items-center justify-between gap-3 text-sm">
                <span>Show online stores</span>
                <input
                  type="checkbox"
                  checked={showOnline}
                  onChange={(e) => setShowOnline(e.target.checked)}
                  className="h-5 w-5 accent-[hsl(var(--primary))]"
                />
              </label>
              <div className="space-y-1">
                <label htmlFor="cat" className="font-mono text-[11px] uppercase text-muted-foreground">
                  Category
                </label>
                <select
                  id="cat"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="all">All categories</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label htmlFor="zip" className="font-mono text-[11px] uppercase text-muted-foreground">
                  ZIP code {me && !zipPoint ? "(using your location)" : ""}
                </label>
                <div className="flex gap-2">
                  <input
                    id="zip"
                    inputMode="numeric"
                    maxLength={5}
                    placeholder="e.g. 75069"
                    value={zip}
                    onChange={(e) => setZip(e.target.value.replace(/\D/g, ""))}
                    onKeyDown={(e) => e.key === "Enter" && applyZip()}
                    className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={applyZip}
                    disabled={zipBusy}
                    className="rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    {zipBusy ? "…" : "Set"}
                  </button>
                  {zipPoint && (
                    <button
                      type="button"
                      onClick={() => {
                        setZip("");
                        setZipPoint(null);
                      }}
                      className="rounded-xl border border-border px-3 text-sm text-muted-foreground"
                    >
                      Clear
                    </button>
                  )}
                </div>
                {zipPoint && <p className="text-xs text-muted-foreground">Near {zipPoint.label}</p>}
                {zipErr && <p className="text-xs text-destructive">{zipErr}</p>}
              </div>
              <div className="space-y-1">
                <div className="flex justify-between font-mono text-[11px] uppercase text-muted-foreground">
                  <span>Distance</span>
                  <span className="text-foreground">{radiusMi ? `Within ${radiusMi} mi` : "Any distance"}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={radiusMi}
                  disabled={!origin}
                  onChange={(e) => setRadiusMi(Number(e.target.value))}
                  className="w-full accent-[hsl(var(--primary))] disabled:opacity-40"
                  aria-label="Distance limit in miles"
                />
                {!origin && (
                  <p className="text-xs text-muted-foreground">Enter a ZIP code or allow location to limit by distance.</p>
                )}
              </div>
            </div>
          )}
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading stores…</p>
        ) : data?.available && allCount > 0 && merchants.length === 0 ? (
          <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            No stores match these filters. Try a wider distance or another category.
          </p>
        ) : !data?.available || merchants.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-center">
            <Store className="mx-auto h-8 w-8 text-primary" />
            <p className="mt-2 font-display text-lg font-semibold uppercase">Stores coming soon</p>
            <p className="mt-1 text-sm text-muted-foreground">
              The NectarPay store directory is on its way. You can already pay any NectarPay checkout by
              scanning it.
            </p>
          </div>
        ) : view === "map" ? (
          <MerchantMap merchants={merchants} center={me} />
        ) : (
          merchants.map((m) => (
            <div key={m.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
              {m.logoUrl ? (
                <img src={m.logoUrl} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15">
                  <Store className="h-5 w-5 text-primary" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-base font-semibold uppercase">{m.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {[m.online ? "Online" : null, m.category, m.city].filter(Boolean).join(" · ")}
                  {m.km != null && !m.online && ` · ${(m.km * 0.621).toFixed(1)} mi`}
                </p>
              </div>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${m.lat},${m.lng}`}
                target="_blank"
                rel="noreferrer"
                aria-label={`Directions to ${m.name}`}
                className="rounded-full border border-white/15 p-2 text-muted-foreground hover:text-foreground"
              >
                <MapPin className="h-4 w-4" />
              </a>
              {m.website && (
                <a
                  href={m.website}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${m.name} website`}
                  className="rounded-full border border-white/15 p-2 text-muted-foreground hover:text-foreground"
                >
                  <Globe className="h-4 w-4" />
                </a>
              )}
            </div>
          ))
        )}
      </main>
      <SiteFooter />
      <BottomNavSpacer />
      <BottomNav />
    </div>
  );
}

function MerchantMap({
  merchants,
  center,
}: {
  merchants: NectarMerchant[];
  center: { lat: number; lng: number } | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then((g) => {
        if (cancelled || !ref.current) return;
        const map = new g.maps.Map(ref.current, {
          center: center ?? { lat: merchants[0].lat, lng: merchants[0].lng },
          zoom: center ? 11 : 4,
          disableDefaultUI: true,
          zoomControl: true,
        });
        merchants.forEach((m) => {
          new g.maps.Marker({ position: { lat: m.lat, lng: m.lng }, map, title: m.name });
        });
      })
      .catch(() => setErr(true));
    return () => {
      cancelled = true;
    };
  }, [merchants, center]);

  if (err) return <p className="text-sm text-muted-foreground">The map couldn't load — try the list.</p>;
  return <div ref={ref} className="h-[60vh] w-full overflow-hidden rounded-2xl border border-border" />;
}
