/**
 * Honest Money cloud backup proxy. The browser never sees the HME site key;
 * each call also needs a one-time member-approved pass from honest.money.
 * Payload is already encrypted on-device (PBKDF2 600k → AES-GCM).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const HM_URL = "https://honest.money/api/public/backup";
const pass = z.string().min(10).max(4000);

function friendly(status: number): string {
  if (status === 401) return "Honest Money approval expired — please try again";
  if (status === 403) return "Honest Money didn't allow this action";
  if (status === 409) return "That approval was already used — please try again";
  if (status === 429) return "Daily limit reached — try again tomorrow";
  return "Honest Money backup is unavailable right now";
}

async function call(method: string, passToken: string, query = "", body?: unknown) {
  const key = process.env["HME_ECOSYSTEM"];
  if (!key) throw new Error("Honest Money backup isn't configured");
  const res = await fetch(HM_URL + query, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "X-HME-Site": "pop-wallet",
      "X-HM-Backup-Pass": passToken,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    console.error("[hm-backup]", method, res.status);
    throw new Error(friendly(res.status));
  }
  return (await res.json()) as Record<string, unknown>;
}

export const hmBackupSave = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ pass, blob: z.string().min(16).max(60_000) }).parse(d),
  )
  .handler(async ({ data }) => {
    const r = await call("POST", data.pass, "", { blob: data.blob });
    return { updatedAt: (r?.updated_at as string) ?? new Date().toISOString() };
  });

export const hmBackupRestore = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ pass }).parse(d))
  .handler(async ({ data }) => {
    const r = await call("GET", data.pass);
    if (!r) return null;
    return { blob: String(r.blob), updatedAt: String(r.updated_at ?? "") };
  });

export const hmBackupDelete = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ pass }).parse(d))
  .handler(async ({ data }) => {
    await call("DELETE", data.pass);
    return { ok: true as const };
  });

export const hmBackupStatus = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ pass }).parse(d))
  .handler(async ({ data }) => {
    const r = await call("GET", data.pass, "?status=1");
    return { exists: Boolean(r?.exists), updatedAt: (r?.updated_at as string) ?? null };
  });
