/// <reference types="google.maps" />
import { useEffect, useRef } from "react";
import { loadGoogleMaps } from "@/lib/google-maps";


interface Props {
  lat: number | null;
  lng: number | null;
  radiusM: number;
  onChange: (lat: number, lng: number) => void;
}

export function GeofenceMapPicker({ lat, lng, radiusM, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const autocompleteSlotRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const circleRef = useRef<google.maps.Circle | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Init map once
  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then(async (g) => {
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

        // Mount Places (New) autocomplete
        try {
          const places = (await g.maps.importLibrary("places")) as google.maps.PlacesLibrary;
          const PAE = (places as unknown as {
            PlaceAutocompleteElement: new () => HTMLElement;
          }).PlaceAutocompleteElement;
          if (PAE && autocompleteSlotRef.current) {
            const el = new PAE();
            // Style the embedded element to match form inputs
            el.setAttribute(
              "style",
              "width:100%; --gmpx-color-surface:transparent;",
            );
            autocompleteSlotRef.current.innerHTML = "";
            autocompleteSlotRef.current.appendChild(el);
            el.addEventListener("gmp-select", async (evt: Event) => {
              const detail = (evt as unknown as {
                placePrediction?: {
                  toPlace: () => {
                    fetchFields: (opts: { fields: string[] }) => Promise<unknown>;
                    location?: { lat: () => number; lng: () => number };
                  };
                };
              }).placePrediction;
              if (!detail) return;
              const place = detail.toPlace();
              await place.fetchFields({ fields: ["location", "formattedAddress"] });
              const loc = place.location;
              if (!loc) return;
              const p = { lat: loc.lat(), lng: loc.lng() };
              marker.setPosition(p);
              marker.setVisible(true);
              circle.setCenter(p);
              circle.setVisible(true);
              map.panTo(p);
              map.setZoom(16);
              onChangeRef.current(p.lat, p.lng);
            });
          }
        } catch (err) {
          console.warn("Places autocomplete unavailable", err);
        }
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
    <div className="space-y-2">
      <div ref={autocompleteSlotRef} className="w-full" />
      <div
        ref={containerRef}
        className="h-64 w-full rounded-md border border-border bg-muted"
      />
      <p className="font-mono text-[10px] text-muted-foreground">
        Search an address above, click the map to drop a pin, or drag the marker to fine-tune.
      </p>
    </div>
  );
}
