/// <reference types="google.maps" />
import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "@/lib/google-maps";
import type { MarketMerchant } from "@/lib/market-page.functions";

interface Props {
  center: { lat: number; lng: number } | null;
  merchants: MarketMerchant[];
}

export function MerchantMap({ center, merchants }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then((g) => {
        if (cancelled || !containerRef.current) return;
        const pins = merchants.filter((m) => m.lat != null && m.lng != null);
        const map = new g.maps.Map(containerRef.current, {
          center: center ?? { lat: pins[0]?.lat ?? 32.7767, lng: pins[0]?.lng ?? -96.797 },
          zoom: 10,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
        const info = new g.maps.InfoWindow();
        const bounds = new g.maps.LatLngBounds();
        pins.forEach((m) => {
          const pos = { lat: m.lat as number, lng: m.lng as number };
          bounds.extend(pos);
          const marker = new g.maps.Marker({ map, position: pos, title: m.name });
          marker.addListener("click", () => {
            info.setContent(
              `<div style="font-family:system-ui;font-size:13px;color:#111"><strong>${m.name}</strong><br/>${
                m.category ?? ""
              }${m.address ? `<br/>${m.address}` : ""}<br/><em>${m.pop_per_visit} POP per visit</em></div>`,
            );
            info.open({ map, anchor: marker });
          });
        });
        if (pins.length > 1) map.fitBounds(bounds, 60);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Map unavailable"));
    return () => {
      cancelled = true;
    };
  }, [center, merchants]);

  if (error) {
    return (
      <div className="flex h-[360px] items-center justify-center rounded-2xl border border-border bg-card font-mono text-xs text-muted-foreground">
        Map unavailable — {error}
      </div>
    );
  }

  return <div ref={containerRef} className="h-[360px] w-full rounded-2xl border border-border" />;
}
