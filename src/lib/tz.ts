// Time-zone helpers for events. Treats `datetime-local` input strings as
// wall-clock time in the given IANA tz and converts to/from UTC ISO strings.

export const COMMON_TIMEZONES: { value: string; label: string }[] = [
  { value: "America/Los_Angeles", label: "Pacific — Los Angeles" },
  { value: "America/Denver", label: "Mountain — Denver" },
  { value: "America/Phoenix", label: "Mountain (no DST) — Phoenix" },
  { value: "America/Chicago", label: "Central — Chicago" },
  { value: "America/New_York", label: "Eastern — New York" },
  { value: "America/Anchorage", label: "Alaska — Anchorage" },
  { value: "Pacific/Honolulu", label: "Hawaii — Honolulu" },
  { value: "America/Toronto", label: "Eastern — Toronto" },
  { value: "America/Mexico_City", label: "Central — Mexico City" },
  { value: "America/Sao_Paulo", label: "Brazil — São Paulo" },
  { value: "Europe/London", label: "UK — London" },
  { value: "Europe/Paris", label: "Central Europe — Paris" },
  { value: "Europe/Berlin", label: "Central Europe — Berlin" },
  { value: "Europe/Athens", label: "Eastern Europe — Athens" },
  { value: "Africa/Johannesburg", label: "South Africa — Johannesburg" },
  { value: "Asia/Dubai", label: "Gulf — Dubai" },
  { value: "Asia/Kolkata", label: "India — Kolkata" },
  { value: "Asia/Bangkok", label: "Indochina — Bangkok" },
  { value: "Asia/Singapore", label: "Singapore" },
  { value: "Asia/Hong_Kong", label: "Hong Kong" },
  { value: "Asia/Tokyo", label: "Japan — Tokyo" },
  { value: "Australia/Sydney", label: "Australia — Sydney" },
  { value: "Pacific/Auckland", label: "New Zealand — Auckland" },
  { value: "UTC", label: "UTC" },
];

export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles";
  } catch {
    return "America/Los_Angeles";
  }
}

// "YYYY-MM-DDTHH:mm" interpreted in `tz` -> UTC ISO
export function zonedWallTimeToUtcIso(local: string, tz: string): string {
  const [date, time] = local.split("T");
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = (time ?? "00:00").split(":").map(Number);
  const asUtc = Date.UTC(y, mo - 1, d, h, mi);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(asUtc));
  const m: Record<string, string> = {};
  for (const p of parts) m[p.type] = p.value;
  const hh = m.hour === "24" ? 0 : Number(m.hour);
  const zonedAsUtc = Date.UTC(
    Number(m.year),
    Number(m.month) - 1,
    Number(m.day),
    hh,
    Number(m.minute),
    Number(m.second),
  );
  const offset = zonedAsUtc - asUtc;
  return new Date(asUtc - offset).toISOString();
}

// UTC ISO -> "YYYY-MM-DDTHH:mm" wall-clock in `tz` (for <input type="datetime-local">)
export function utcIsoToZonedWallTime(iso: string, tz: string): string {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(d);
  const m: Record<string, string> = {};
  for (const p of parts) m[p.type] = p.value;
  const hh = m.hour === "24" ? "00" : m.hour;
  return `${m.year}-${m.month}-${m.day}T${hh}:${m.minute}`;
}

export function tzAbbreviation(tz: string, at: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "short",
    }).formatToParts(at);
    return parts.find((p) => p.type === "timeZoneName")?.value ?? tz;
  } catch {
    return tz;
  }
}

// Friendly long name for a tz, e.g. "America/Chicago" -> "Central".
// Falls back to the short abbreviation (e.g. "CST") for tzs we don't have a
// friendly label for.
const FRIENDLY_TZ_NAMES: Record<string, string> = {
  "America/Los_Angeles": "Pacific",
  "America/Vancouver": "Pacific",
  "America/Tijuana": "Pacific",
  "America/Denver": "Mountain",
  "America/Phoenix": "Mountain",
  "America/Edmonton": "Mountain",
  "America/Chicago": "Central",
  "America/Mexico_City": "Central",
  "America/Winnipeg": "Central",
  "America/New_York": "Eastern",
  "America/Toronto": "Eastern",
  "America/Anchorage": "Alaska",
  "Pacific/Honolulu": "Hawaii",
  "Europe/London": "UK",
  "Europe/Paris": "Central European",
  "Europe/Berlin": "Central European",
  "Europe/Madrid": "Central European",
  "Europe/Rome": "Central European",
  "Asia/Tokyo": "Japan",
  "Asia/Singapore": "Singapore",
  "Asia/Dubai": "Gulf",
  "Australia/Sydney": "Sydney",
  UTC: "UTC",
};

export function tzFriendlyName(tz: string, at: Date = new Date()): string {
  return FRIENDLY_TZ_NAMES[tz] ?? tzAbbreviation(tz, at);
}
