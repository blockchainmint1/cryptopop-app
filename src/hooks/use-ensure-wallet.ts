import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  getOrCreateMnemonic,
  deriveTxcAddress,
  isValidTxcAddress,
} from "@/lib/wallet";

const DEVICE_WARNED_KEY = "cryptopop:device-warned";

type State = {
  address: string | null;
  ready: boolean;
  settingUp: boolean;
  error: string | null;
  retry: () => void;
  /** True iff this device's locally-derived address replaced a different one
   *  already stored on the profile (i.e. signed in on a 2nd device). */
  replacedRemote: boolean;
};

/**
 * Ensures the authenticated user has a TXC wallet address persisted to
 * `profiles.wallet_address`. Auto-creates per-device (per product decision):
 * if the local mnemonic derives to a different address than the one stored
 * remotely, we overwrite the remote and warn the user once.
 *
 * Returns `ready: true` only after the address is confirmed in the DB, so
 * callers (e.g. /scan) can safely gate actions on this.
 */
export function useEnsureWallet(): State {
  const { user } = useAuth();
  const [address, setAddress] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [settingUp, setSettingUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replacedRemote, setReplacedRemote] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    if (!user) {
      setAddress(null);
      setReady(true);
      setSettingUp(false);
      setError(null);
      return;
    }

    let cancelled = false;
    let step: "mnemonic" | "derive" | "read-profile" | "upsert" = "mnemonic";
    (async () => {
      setReady(false);
      setSettingUp(true);
      setError(null);
      try {
        step = "mnemonic";
        const mnemonic = getOrCreateMnemonic();
        step = "derive";
        const localAddr = deriveTxcAddress(mnemonic);

        step = "read-profile";
        const { data: profile, error: readErr } = await supabase
          .from("profiles")
          .select("wallet_address")
          .eq("id", user.id)
          .maybeSingle();
        if (readErr) throw readErr;

        const remote = profile?.wallet_address ?? null;

        if (remote === localAddr) {
          if (!cancelled) {
            setAddress(localAddr);
            setReady(true);
            setSettingUp(false);
          }
          return;
        }

        const remoteWasValid = !!remote && isValidTxcAddress(remote);
        step = "upsert";
        const { error: upsertErr } = await supabase
          .from("profiles")
          .upsert(
            { id: user.id, wallet_address: localAddr, updated_at: new Date().toISOString() },
            { onConflict: "id" },
          );
        if (upsertErr) throw upsertErr;

        if (!cancelled) {
          setAddress(localAddr);
          setReady(true);
          setSettingUp(false);
          if (remoteWasValid && !sessionStorage.getItem(DEVICE_WARNED_KEY)) {
            setReplacedRemote(true);
            sessionStorage.setItem(DEVICE_WARNED_KEY, "1");
            toast.warning("New wallet for this device", {
              description:
                "POP minted earlier went to your other device's wallet. Future scans land here.",
              duration: 8000,
            });
          }
        }
      } catch (e) {
        const raw = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
        const msg = `[${step}] ${raw}`;
        console.error("[wallet] provisioning failed", { step, error: e });
        if (!cancelled) {
          setAddress(null);
          setReady(true);
          setSettingUp(false);
          setError(msg);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, attempt]);

  return { address, ready, settingUp, error, retry, replacedRemote };
}
