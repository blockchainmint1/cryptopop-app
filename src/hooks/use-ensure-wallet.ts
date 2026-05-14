import { useEffect, useState } from "react";
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
  const [replacedRemote, setReplacedRemote] = useState(false);

  useEffect(() => {
    if (!user) {
      setAddress(null);
      setReady(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const mnemonic = getOrCreateMnemonic();
        const localAddr = deriveTxcAddress(mnemonic);

        const { data: profile } = await supabase
          .from("profiles")
          .select("wallet_address")
          .eq("id", user.id)
          .maybeSingle();

        const remote = profile?.wallet_address ?? null;

        if (remote === localAddr) {
          if (!cancelled) {
            setAddress(localAddr);
            setReady(true);
          }
          return;
        }

        // Either no remote yet, remote is invalid placeholder, or this is a
        // new device with a different local mnemonic. Overwrite remote.
        const remoteWasValid = !!remote && isValidTxcAddress(remote);
        const { error } = await supabase
          .from("profiles")
          .update({ wallet_address: localAddr })
          .eq("id", user.id);
        if (error) throw error;

        if (!cancelled) {
          setAddress(localAddr);
          setReady(true);
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
        console.error("[wallet] provisioning failed", e);
        if (!cancelled) setReady(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  return { address, ready, replacedRemote };
}
