/**
 * Loads the honest.money trusted-site registry once per app start and keeps
 * the last good copy on the device so labels work offline.
 */
import { useEffect } from "react";
import { setEcosystemSites } from "./hosts";
import { getEcosystemSites } from "./sites.functions";

const KEY = "cryptopop:ecosystem-sites";

export function useEcosystemSites(): void {
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) setEcosystemSites(JSON.parse(saved));
    } catch {
      /* ignore */
    }
    getEcosystemSites()
      .then(({ sites }) => {
        if (!sites.length) return;
        setEcosystemSites(sites);
        try {
          localStorage.setItem(KEY, JSON.stringify(sites));
        } catch {
          /* ignore */
        }
      })
      .catch(() => {});
  }, []);
}
