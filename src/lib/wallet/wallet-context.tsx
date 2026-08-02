/**
 * Holds the currently-unlocked non-custodial wallet. The mnemonic is kept in
 * memory (mirrored into a short-lived sessionStorage entry) and the TXC
 * address is derived locally. Auto-locks after inactivity and on backgrounding.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { deriveLegacyTxcAddress, deriveTxcAddress } from "@/lib/wallet";
import {
  AUTO_LOCK_MS,
  clearSession,
  createVault,
  deleteVault,
  hasVault,
  loadSession,
  touchSession,
  unlockVault,
  vaultMeta,
  type VaultOrigin,
  type VaultPayload,
} from "./vault";

export type WalletStatus = "loading" | "none" | "locked" | "unlocked";

interface WalletContextValue {
  status: WalletStatus;
  /** Plaintext mnemonic — only present while unlocked. */
  mnemonic: string | null;
  /** Canonical receive address (m/44'/696969'/0'/0/0). */
  address: string | null;
  /** Pre-SLIP-44 address (m/44'/0'/0'/0/0) — still holds funds for older seeds. */
  legacyAddress: string | null;

  origin: VaultOrigin | null;
  unlock: (password: string) => Promise<boolean>;
  create: (mnemonic: string, password: string, origin: VaultOrigin) => Promise<void>;
  lock: () => void;
  forget: () => void;
  refresh: () => void;
}

const Ctx = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<WalletStatus>("loading");
  const [payload, setPayload] = useState<VaultPayload | null>(null);
  const autoLockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(() => {
    if (typeof window === "undefined") return;
    const cached = loadSession();
    if (cached) {
      setPayload(cached);
      setStatus("unlocked");
      return;
    }
    setPayload(null);
    setStatus(hasVault() ? "locked" : "none");
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const unlock = useCallback(async (password: string) => {
    const p = await unlockVault(password);
    if (!p) return false;
    setPayload(p);
    setStatus("unlocked");
    return true;
  }, []);

  const create = useCallback(
    async (mnemonic: string, password: string, origin: VaultOrigin) => {
      const p = await createVault(mnemonic, password, origin);
      setPayload(p);
      setStatus("unlocked");
    },
    [],
  );

  const lock = useCallback(() => {
    clearSession();
    setPayload(null);
    setStatus(hasVault() ? "locked" : "none");
  }, []);

  const forget = useCallback(() => {
    deleteVault();
    setPayload(null);
    setStatus("none");
  }, []);

  // Sliding auto-lock on activity + lock shortly after backgrounding.
  useEffect(() => {
    if (status !== "unlocked") return;

    const scheduleLock = () => {
      if (autoLockTimer.current) clearTimeout(autoLockTimer.current);
      autoLockTimer.current = setTimeout(() => lock(), AUTO_LOCK_MS);
    };
    const onActivity = () => {
      touchSession();
      scheduleLock();
    };

    const BACKGROUND_GRACE_MS = 15_000;
    let bgTimer: ReturnType<typeof setTimeout> | null = null;
    const armBackgroundLock = () => {
      if (bgTimer) clearTimeout(bgTimer);
      bgTimer = setTimeout(() => lock(), BACKGROUND_GRACE_MS);
    };
    const cancelBackgroundLock = () => {
      if (bgTimer) {
        clearTimeout(bgTimer);
        bgTimer = null;
      }
    };
    const onVisibility = () => {
      if (document.hidden) armBackgroundLock();
      else {
        cancelBackgroundLock();
        onActivity();
      }
    };

    scheduleLock();
    const events = ["pointerdown", "keydown", "touchstart"] as const;
    for (const ev of events) window.addEventListener(ev, onActivity, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);

    let removeAppListener: (() => void) | null = null;
    void (async () => {
      try {
        const { isNative } = await import("@/lib/native/platform");
        if (!isNative()) return;
        const { App } = await import("@capacitor/app");
        const sub = await App.addListener("appStateChange", ({ isActive }) => {
          if (isActive) {
            cancelBackgroundLock();
            onActivity();
          } else {
            armBackgroundLock();
          }
        });
        removeAppListener = () => void sub.remove().catch(() => {});
      } catch {
        /* plugin not present on web */
      }
    })();

    return () => {
      for (const ev of events) window.removeEventListener(ev, onActivity);
      document.removeEventListener("visibilitychange", onVisibility);
      if (autoLockTimer.current) clearTimeout(autoLockTimer.current);
      cancelBackgroundLock();
      removeAppListener?.();
    };
  }, [status, lock]);

  const address = useMemo(() => {
    if (!payload) return null;
    try {
      return deriveTxcAddress(payload.mnemonic);
    } catch {
      return null;
    }
  }, [payload]);

  const legacyAddress = useMemo(() => {
    if (!payload) return null;
    try {
      const legacy = deriveLegacyTxcAddress(payload.mnemonic);
      return legacy === address ? null : legacy;
    } catch {
      return null;
    }
  }, [payload, address]);

  const value = useMemo<WalletContextValue>(
    () => ({
      status,
      mnemonic: payload?.mnemonic ?? null,
      address,
      legacyAddress,
      origin: payload?.origin ?? vaultMeta()?.origin ?? null,
      unlock,
      create,
      lock,
      forget,
      refresh,
    }),
    [status, payload, address, legacyAddress, unlock, create, lock, forget, refresh],
  );


  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWallet(): WalletContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWallet must be used within WalletProvider");
  return v;
}
