/** Street-address → coordinates via Google Geocoding (server key, never sent to the browser). */
export async function geocodeAddress(
  address: string,
): Promise<{ lat: number; lng: number; formatted: string } | null> {
  const key = process.env["GOOGLE_MAPS_SERVER_KEY"];
  const q = address.trim();
  if (!key || q.length < 6) return null;
  const url =
    "https://maps.googleapis.com/maps/api/geocode/json?" +
    new URLSearchParams({ address: q, key }).toString();
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`[geocode] ${res.status}: ${await res.text()}`);
      return null;
    }
    const json = (await res.json()) as {
      status: string;
      error_message?: string;
      results?: { formatted_address: string; geometry: { location: { lat: number; lng: number } } }[];
    };
    const hit = json.results?.[0];
    if (!hit) {
      console.warn(`[geocode] ${json.status} ${json.error_message ?? ""}`);
      return null;
    }
    return { lat: hit.geometry.location.lat, lng: hit.geometry.location.lng, formatted: hit.formatted_address };
  } catch (e) {
    console.error("[geocode] failed", e);
    return null;
  }
}
