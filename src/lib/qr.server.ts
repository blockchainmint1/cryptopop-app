import crypto from "node:crypto";

export function signEventId(eventId: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(eventId).digest("hex");
}

export function verifyEventSig(eventId: string, sig: string, secret: string): boolean {
  const expected = signEventId(eventId, secret);
  if (expected.length !== sig.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(sig, "hex"));
  } catch {
    return false;
  }
}

export function buildQrPayload(eventId: string, sig: string): string {
  return `cryptopop://claim?e=${eventId}&s=${sig}`;
}

export function parseQrPayload(qr: string): { eventId: string; sig: string } | null {
  try {
    const trimmed = qr.trim();
    // Accept either the cryptopop:// scheme or a bare query string
    const idx = trimmed.indexOf("?");
    const qs = idx >= 0 ? trimmed.slice(idx + 1) : trimmed;
    const params = new URLSearchParams(qs);
    const eventId = params.get("e");
    const sig = params.get("s");
    if (!eventId || !sig) return null;
    return { eventId, sig };
  } catch {
    return null;
  }
}

// Haversine distance in meters
export function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
