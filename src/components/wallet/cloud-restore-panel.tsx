/**
 * Restore an encrypted cloud backup: sign in with Google/Apple, pull the
 * ciphertext, then decrypt it locally with the wallet password.
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, CloudDownload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CloudSignInButtons } from "./cloud-sign-in-buttons";
import { useCloudAccount } from "@/lib/wallet/cloud-account";
import { useWallet } from "@/lib/wallet/wallet-context";
import { decryptJson, type EncryptedBlob } from "@/lib/wallet/crypto";
import type { VaultOrigin, VaultPayload } from "@/lib/wallet/vault";
import { getWalletCloudBackup } from "@/lib/wallet-cloud-backup.functions";

interface Backup {
  blob: EncryptedBlob;
  origin: VaultOrigin;
  updatedAt: string;
  deviceLabel: string | null;
}

export function CloudRestorePanel({ onBack }: { onBack: () => void }) {
  const { account, loading } = useCloudAccount();
  const { create } = useWallet();
  const [backup, setBackup] = useState<Backup | null>(null);
  const [checked, setChecked] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setFetching(true);
    try {
      const found = (await getWalletCloudBackup()) as Backup | null;
      setBackup(found);
    } catch (e) {
      toast.error((e as Error).message || "Couldn't reach your backup");
    } finally {
      setFetching(false);
      setChecked(true);
    }
  }, []);

  useEffect(() => {
    if (!loading && account && !checked) void load();
  }, [loading, account, checked, load]);

  async function restore() {
    if (!backup) return;
    setBusy(true);
    try {
      const payload = await decryptJson<VaultPayload>(backup.blob, password);
      await create(payload.mnemonic, password, backup.origin);
      toast.success("Wallet restored");
    } catch {
      toast.error("Wrong password for this backup");
    } finally {
      setBusy(false);
      setPassword("");
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl font-semibold uppercase">Restore from backup</h2>

      {!account && (
        <>
          <p className="text-sm text-muted-foreground">
            Sign in with the account you backed up to. Your phrase stays encrypted — you'll still
            need your wallet password to open it.
          </p>
          <CloudSignInButtons rememberRestore />
        </>
      )}

      {account && (
        <>
          <p className="text-xs text-muted-foreground">
            Signed in as <span className="text-foreground">{account.email}</span>
          </p>

          {fetching && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Looking for your backup…
            </p>
          )}

          {checked && !fetching && !backup && (
            <p className="rounded-2xl border border-white/12 bg-white/5 p-4 text-sm text-muted-foreground">
              No backup found on this account. Try a different sign-in, or set up your wallet with
              your Cold Storage Coin or recovery phrase.
            </p>
          )}

          {backup && (
            <div className="space-y-3">
              <div className="rounded-2xl border border-white/12 bg-white/5 p-4 text-sm">
                <p className="font-medium">Backup found</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Last saved {new Date(backup.updatedAt).toLocaleString()}
                  {backup.deviceLabel ? ` · ${backup.deviceLabel}` : ""}
                </p>
              </div>
              <Input
                type="password"
                placeholder="Wallet password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12"
                autoComplete="current-password"
              />
              <Button
                className="h-12 w-full rounded-full"
                disabled={!password || busy}
                onClick={restore}
              >
                {busy ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <CloudDownload className="mr-1.5 h-4 w-4" />
                )}
                Restore wallet
              </Button>
            </div>
          )}
        </>
      )}

      <Button variant="ghost" className="w-full" onClick={onBack}>
        <ArrowLeft className="mr-1 h-4 w-4" /> Back
      </Button>
    </div>
  );
}
