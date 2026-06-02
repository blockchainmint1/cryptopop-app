import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  deriveTxcAddress,
  getMnemonic,
  setMnemonic,
} from "@/lib/wallet";
import { ensureWalletBackup } from "@/lib/wallet-backup.functions";

const DEVICE_WARNED_KEY = "cryptopop:device-warned";

type State = {
  address: string | null;
  ready: boolean;
  settingUp: boolean;
  error: string | null;
  retry: () => void;
  replacedRemote: boolean;
};

/**
 * Ensures the signed-in user has a sandbox POP wallet whose seed is backed
 * up server-side (encrypted). The server is the source of truth: if a
 * backup exists, we restore the seed to this device; otherwise we either
 * upload this device's seed or have the server generate one.
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
  const ensure = useServerFn(ensureWalletBackup);

  useEffect(() => {
    if (!user) {
      setAddress(null);
      setReady(true);
      setSettingUp(false);
      setError(null);
      return;
    }

    let cancelled = false;
    let step: "local" | "backup" | "persist" = "local";
    (async () => {
      setReady(false);
      setSettingUp(true);
      setError(null);
      try {
        step = "local";
        const localMnemonic = getMnemonic();
        const localAddr = localMnemonic ? deriveTxcAddress(localMnemonic) : null;

        step = "backup";
        const res = await ensure({
          data: { clientMnemonic: localMnemonic ?? undefined },
        });

        step = "persist";
        // Server is authoritative — sync local storage to match the backup.
        const serverChanged = localMnemonic !== res.mnemonic;
        if (serverChanged) setMnemonic(res.mnemonic);

        if (cancelled) return;
        setAddress(res.address);
        setReady(true);
        setSettingUp(false);

        // Warn once when the on-device wallet was replaced by the cloud
        // backup (e.g. signed in on a fresh device).
        if (
          localAddr &&
          localAddr !== res.address &&
          !sessionStorage.getItem(DEVICE_WARNED_KEY)
        ) {
          setReplacedRemote(true);
          sessionStorage.setItem(DEVICE_WARNED_KEY, "1");
          toast.info("Wallet restored from backup", {
            description:
              "Your sandbox POP wallet was restored on this device from your encrypted backup.",
            duration: 8000,
          });
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
  }, [user, attempt, ensure]);

  return { address, ready, settingUp, error, retry, replacedRemote };
}
