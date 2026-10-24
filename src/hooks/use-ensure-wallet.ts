import { useWallet } from "@/lib/wallet/wallet-context";
/** Compatibility for older screens: only the device wallet is available. */
export function useEnsureWallet(): { address: string | null; ready: boolean; settingUp: boolean; error: string | null; retry: () => void; replacedRemote: boolean } {
  const wallet = useWallet();
  return { address: wallet.address, ready: true, settingUp: false, error: null, retry: () => {}, replacedRemote: false };
}
