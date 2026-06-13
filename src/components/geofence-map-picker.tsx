/// <reference types="google.maps" />
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    google?: typeof google;
    __cryptopopMapsInit?: () => void;
  }
}

let mapsPromise: Promise<typeof google> | null = null;

function loadGoogleMaps(): Promise<typeof google> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if (window.google?.maps) return Promise.resolve(window.google);
  if (mapsPromise) return mapsPromise;

  const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
  const channel = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;
  if (!key) return Promise.reject(new Error("Maps API key missing"));

  mapsPromise = new Promise((resolve, reject) => {
    window.__cryptopopMapsInit = () => {
      if (window.google?.maps) resolve(window.google);
      else reject(new Error("Maps failed to init"));
    };
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=__cryptopopMapsInit${channel ? `&channel=${channel}` : ""}`;
    s.async = true;
    s.defer = true;
    s.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(s);
  });
  return mapsPromise;
}

interface Props {
  lat: number | null;
  lng: number | null;
  radiusM: number;
  onChange: (lat: number, lng: number) => void;
}

export function GeofenceMapPicker({ lat, lng, radiusM, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const circleRef = useRef<google.maps.Circle | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Init map once
  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then((g) => {
        if (cancelled || !containerRef.current) return;
        const center = {
          lat: lat ?? 1.3521,
          lng: lng ?? 103.8198,
        };
        const map = new g.maps.Map(containerRef.current, {
          center,
          zoom: lat !== null ? 16 : 12,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
        });
        mapRef.current = map;

        const marker = new g.maps.Marker({
          map,
          position: center,
          draggable: true,
          visible: lat !== null && lng !== null,
        });
        markerRef.current = marker;

        const circle = new g.maps.Circle({
          map,
          center,
          radius: radiusM,
          strokeColor: "#FF3DBE",
          strokeOpacity: 0.9,
          strokeWeight: 2,
          fillColor: "#FF3DBE",
          fillOpacity: 0.15,
          visible: lat !== null && lng !== null,
        });
        circleRef.current = circle;

        map.addListener("click", (e: google.maps.MapMouseEvent) => {
          if (!e.latLng) return;
          const p = { lat: e.latLng.lat(), lng: e.latLng.lng() };
          marker.setPosition(p);
          marker.setVisible(true);
          circle.setCenter(p);
          circle.setVisible(true);
          onChangeRef.current(p.lat, p.lng);
        });

        marker.addListener("dragend", () => {
          const pos = marker.getPosition();
          if (!pos) return;
          circle.setCenter(pos);
          onChangeRef.current(pos.lat(), pos.lng());
        });
      })
      .catch((err) => {
        console.error("Maps load failed", err);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external lat/lng changes (e.g. "Use my location")
  useEffect(() => {
    if (!mapRef.current || !markerRef.current || !circleRef.current) return;
    if (lat === null || lng === null) {
      markerRef.current.setVisible(false);
      circleRef.current.setVisible(false);
      return;
    }
    const p = { lat, lng };
    markerRef.current.setPosition(p);
    markerRef.current.setVisible(true);
    circleRef.current.setCenter(p);
    circleRef.current.setVisible(true);
    mapRef.current.panTo(p);
  }, [lat, lng]);

  // Sync radius
  useEffect(() => {
    if (circleRef.current) circleRef.current.setRadius(radiusM);
  }, [radiusM]);

  return (
    <div className="space-y-1">
      <div
        ref={containerRef}
        className="h-64 w-full rounded-md border border-border bg-muted"
      />
      <p className="font-mono text-[10px] text-muted-foreground">
        Click the map to drop a pin, or drag the marker to fine-tune.
      </p>
    </div>
  );
}
