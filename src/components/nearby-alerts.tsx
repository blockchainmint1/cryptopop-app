import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { MapPin, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { listNectarMerchants } from "@/lib/nectarpay.functions";
import type { NectarMerchant } from "@/lib/nectarpay";
import { claimAlertSlot, distanceM, NEARBY_RADIUS_M, nearbyEnabled } from "@/lib/nearby-alerts";

/**
 * In-app "You're near" banner for NectarPay stores that take TSD. Runs only
 * while the app is open and location is already allowed; location stays on the phone.
 */
export function NearbyAlerts() {
  const navigate = useNavigate();
  const [enabled, setEnabled] = useState(false);
  const [alert, setAlert] = useState<NectarMerchant | null>(null);
  const last = useRef<{ lat: number; lng: number; t: number } | null>(null);
  const fetchMerchants = useServerFn(listNectarMerchants);

  useEffect(() => {
    const sync = () => setEnabled(nearbyEnabled());
    sync();
    window.addEventListener("cp-nearby-changed", sync);
    return () => window.removeEventListener("cp-nearby-changed", sync);
  }, []);

  const { data } = useQuery({
    queryKey: ["nectar-merchants"],
    queryFn: () => fetchMerchants(),
    enabled,
    staleTime: 10 * 60_000,
  });
  const stores = data?.merchants ?? [];

  useEffect(() => {
    if (!enabled || !stores.length || !navigator.geolocation) return;
    let watchId: number | null = null;
    let cancelled = false;
    const start = () => {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude: lat, longitude: lng } = pos.coords;
          const now = Date.now();
          const prev = last.current;
          if (prev && now - prev.t < 60_000 && distanceM(prev.lat, prev.lng, lat, lng) < 50) return;
          last.current = { lat, lng, t: now };
          const near = stores
            .map((s) => ({ s, d: distanceM(lat, lng, s.lat, s.lng) }))
            .filter((x) => x.d <= NEARBY_RADIUS_M)
            .sort((a, b) => a.d - b.d)[0];
          if (near && claimAlertSlot(near.s.id)) setAlert(near.s);
        },
        () => {},
        { enableHighAccuracy: false, maximumAge: 60_000, timeout: 30_000 },
      );
    };
    // Never pop a permission prompt from here; only run if already allowed.
    const perms = navigator.permissions;
    if (perms?.query) {
      perms
        .query({ name: "geolocation" as PermissionName })
        .then((r) => {
          if (!cancelled && r.state === "granted") start();
        })
        .catch(() => start());
    } else {
      start();
    }
    return () => {
      cancelled = true;
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
    };
  }, [enabled, stores]);

  if (!alert) return null;

  return (
    <div className="fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.75rem)] z-50 flex justify-center px-3">
      <Card className="w-full max-w-md border-primary/40 bg-background/95 p-4 shadow-lg backdrop-blur-xl">
        <div className="flex items-start gap-3">
          <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg uppercase leading-tight">You're near {alert.name}</p>
            <p className="text-sm text-muted-foreground">
              They take TSD through NectarPay — pay with your wallet and earn POP.
            </p>
            <Button
              size="sm"
              className="mt-3 rounded-full"
              onClick={() => {
                setAlert(null);
                void navigate({ to: "/merchants" });
              }}
            >
              See on the map
            </Button>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close"
            className="h-6 w-6 shrink-0 text-muted-foreground"
            onClick={() => setAlert(null)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
}
