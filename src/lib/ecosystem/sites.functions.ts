import { createServerFn } from "@tanstack/react-start";

/** Public list of honest.money ecosystem sites; empty on any failure. */
export const getEcosystemSites = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { loadEcosystemSites } = await import("./sites.server");
    return { sites: await loadEcosystemSites(), verified: true };
  } catch (e) {
    console.warn("ecosystem registry unavailable", e);
    return { sites: [] as { host: string; label: string; delegate: boolean; delegate_modes: ("approve" | "access")[]; delegate_branches: number[] }[], verified: false };
  }
});
