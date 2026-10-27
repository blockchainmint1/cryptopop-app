/** Google Maps directions link to a map pin, by travel mode. */
export function directionsUrl(destination: { lat: number; lng: number }, mode: "driving" | "walking") {
  const params = new URLSearchParams({
    api: "1",
    destination: `${destination.lat},${destination.lng}`,
    travelmode: mode,
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
