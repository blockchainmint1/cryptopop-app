/// <reference types="google.maps" />
import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps, MAPS_AUTH_FAILED_EVENT } from "@/lib/google-maps";

export type MapDiscoveryItem = {
  id: string;
  type: "event" | "merchant";
  title: string;
  subtitle?: string;
  lat: number;
  lng: number;
};

type Props = {
  items: MapDiscoveryItem[];
  userLocation: { lat: number; lng: number } | null;
  onSelect: (item: MapDiscoveryItem) => void;
};

/** Dark basemap so the map matches the app's ink-black UI (Google needs literal colors). */
const DARK_MAP_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#0e0e18" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#9a9dac" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#08080f" }] },
  { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1b1b27" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#2b2434" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#6d7080" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#070711" }] },
];

/** Events (pink "E") and stores (cyan "S") on one map; nearby pins cluster when zoomed out. */
export function DiscoveryMap({ items, userLocation, onSelect }: Props) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const userRef = useRef<google.maps.Marker | null>(null);
  const fitRef = useRef<string | null>(null);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const fail = () => setFailed(true);
    window.addEventListener(MAPS_AUTH_FAILED_EVENT, fail);
    return () => window.removeEventListener(MAPS_AUTH_FAILED_EVENT, fail);
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then((g) => {
        if (cancelled || !boxRef.current || mapRef.current) return;
        mapRef.current = new g.maps.Map(boxRef.current, {
          center: { lat: 33.2, lng: -96.6 },
          zoom: 10,
          clickableIcons: false,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          styles: DARK_MAP_STYLES,
          gestureHandling: "cooperative",
          backgroundColor: "#0e0e18",
        });
        setReady(true);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const g = window.google;
    if (!ready || !map || !g) return;
    const css = getComputedStyle(document.documentElement);
    const color = { event: css.getPropertyValue("--neon-pink").trim(), merchant: css.getPropertyValue("--neon-cyan").trim() };
    const ink = css.getPropertyValue("--ink").trim();

    const render = () => {
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
      const zoom = map.getZoom() ?? 10;
      const grid = zoom <= 9 ? 0.18 : zoom === 10 ? 0.085 : zoom === 11 ? 0.04 : zoom === 12 ? 0.018 : 0;
      const groups = new Map<string, MapDiscoveryItem[]>();
      for (const it of items) {
        const k = grid ? `${Math.round(it.lat / grid)},${Math.round(it.lng / grid)}` : `${it.lat.toFixed(5)},${it.lng.toFixed(5)}`;
        groups.set(k, [...(groups.get(k) ?? []), it]);
      }
      for (const group of groups.values()) {
        if (group.length > 1 && grid) {
          const pos = {
            lat: group.reduce((s, i) => s + i.lat, 0) / group.length,
            lng: group.reduce((s, i) => s + i.lng, 0) / group.length,
          };
          const hasEvent = group.some((i) => i.type === "event");
          const m = new g.maps.Marker({
            map,
            position: pos,
            title: `${group.length} places`,
            zIndex: 40,
            label: { text: String(group.length), color: ink, fontWeight: "700", fontSize: "11px" },
            icon: { path: g.maps.SymbolPath.CIRCLE, scale: 12, fillColor: hasEvent ? color.event : color.merchant, fillOpacity: 0.92, strokeColor: ink, strokeWeight: 3 },
          });
          m.addListener("click", () => {
            map.panTo(pos);
            map.setZoom(Math.min(15, zoom + 2));
          });
          markersRef.current.push(m);
          continue;
        }
        group.forEach((it, i) => {
          const a = (i / group.length) * Math.PI * 2;
          const pos = group.length > 1 ? { lat: it.lat + 0.00025 * Math.cos(a), lng: it.lng + 0.00025 * Math.sin(a) } : { lat: it.lat, lng: it.lng };
          const m = new g.maps.Marker({
            map,
            position: pos,
            title: it.title,
            zIndex: it.type === "event" ? 30 : 10,
            label: { text: it.type === "event" ? "E" : "S", color: ink, fontWeight: "700", fontSize: "10px" },
            icon: { path: g.maps.SymbolPath.CIRCLE, scale: 10, fillColor: color[it.type], fillOpacity: 0.96, strokeColor: ink, strokeWeight: 2.5 },
          });
          m.addListener("click", () => selectRef.current(it));
          markersRef.current.push(m);
        });
      }
    };
    render();
    const zl = map.addListener("zoom_changed", render);

    // Frame the user's area if known, otherwise every pin.
    const key = userLocation ? `u${userLocation.lat.toFixed(3)},${userLocation.lng.toFixed(3)}` : `n${items.length}`;
    if (fitRef.current !== key) {
      fitRef.current = key;
      const pts = userLocation
        ? items.filter((i) => Math.hypot((i.lat - userLocation.lat) * 69, (i.lng - userLocation.lng) * 55) <= 35)
        : items;
      if (userLocation && pts.length === 0) {
        map.setCenter(userLocation);
        map.setZoom(11);
      } else if (pts.length) {
        const b = new g.maps.LatLngBounds();
        pts.forEach((p) => b.extend(p));
        if (userLocation) b.extend(userLocation);
        map.fitBounds(b, 48);
        g.maps.event.addListenerOnce(map, "idle", () => {
          if ((map.getZoom() ?? 12) > 14) map.setZoom(14);
        });
      }
    }

    userRef.current?.setMap(null);
    userRef.current = userLocation
      ? new g.maps.Marker({
          map,
          position: userLocation,
          title: "You are here",
          zIndex: 1000,
          icon: { path: g.maps.SymbolPath.CIRCLE, scale: 7, fillColor: css.getPropertyValue("--neon-lime").trim(), fillOpacity: 1, strokeColor: ink, strokeWeight: 3 },
        })
      : null;

    return () => {
      zl.remove();
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
    };
  }, [items, userLocation, ready]);

  if (failed) {
    return (
      <div className="flex h-72 items-center justify-center rounded-3xl border border-border bg-card px-6 text-center text-sm text-muted-foreground">
        The map couldn't load right now. The list below still works.
      </div>
    );
  }
  return <div ref={boxRef} className="h-72 w-full overflow-hidden rounded-3xl border border-border bg-card sm:h-96" aria-label="Map of events and stores" />;
}
