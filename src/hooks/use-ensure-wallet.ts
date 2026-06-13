import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useServerFn } from "@tanstack/react-start";
import { clearWallet } from "@/lib/wallet";
import { ensureWalletBackup } from "@/lib/wallet-backup.functions";

type State = {
  address: string | null;
  ready: boolean;
  settingUp: boolean;
  error: string | null;
  retry: () => void;
  replacedRemote: boolean;
};

/**
 * Ensures the signed-in user has their canonical email-derived wallet
 * provisioned. The server is the source of truth — the wallet address is
 * deterministically derived from WALLET_MASTER_SEED + email. We just call
 * the server fn and trust the returned address.
 *
 * Also clears any stale random-mnemonic from the pre-reconciliation flow
 * so it can't shadow the canonical wallet.
 */
export function useEnsureWallet(): State {
  const { user } = useAuth();
  const [address, setAddress] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [settingUp, setSettingUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    (async () => {
      setReady(false);
      setSettingUp(true);
      setError(null);
      try {
        // Drop any old random mnemonic from localStorage — it never matched
        // the email-derived address and only causes confusion.
        clearWallet();

        const res = await ensure();
        if (cancelled) return;
        setAddress(res.address);
        setReady(true);
        setSettingUp(false);
      } catch (e) {
        const raw = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
        console.error("[wallet] provisioning failed", e);
        if (!cancelled) {
          setAddress(null);
          setReady(true);
          setSettingUp(false);
          setError(raw);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, attempt, ensure]);

  return { address, ready, settingUp, error, retry, replacedRemote: false };
}
