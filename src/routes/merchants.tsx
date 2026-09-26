import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Globe, List, Map as MapIcon, MapPin, Store } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { listNectarMerchants } from "@/lib/nectarpay.functions";
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

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (p) => setMe({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => undefined,
      { timeout: 8000 },
    );
  }, []);

  const merchants = useMemo(() => {
    const list = (data?.merchants ?? []).map((m) => ({
      ...m,
      km: me ? distanceKm(me, m) : null,
    }));
    if (me) list.sort((a, b) => (a.km ?? 0) - (b.km ?? 0));
    return list;
  }, [data, me]);

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

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading stores…</p>
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
                  {[m.category, m.city].filter(Boolean).join(" · ")}
                  {m.km != null && ` · ${(m.km * 0.621).toFixed(1)} mi`}
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
