/** Settings section: save the encrypted vault to a Google/Apple account. */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CloudUpload, Loader2, LogOut, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CloudSignInButtons } from "./cloud-sign-in-buttons";
import { useCloudAccount } from "@/lib/wallet/cloud-account";
import { loadVault, markBackedUp, unlockVault } from "@/lib/wallet/vault";
import {
  deleteWalletCloudBackup,
  getWalletCloudBackup,
  saveWalletCloudBackup,
} from "@/lib/wallet-cloud-backup.functions";

export function CloudBackupCard() {
  const { account, loading, signOut } = useCloudAccount();
  const [existing, setExisting] = useState<{ updatedAt: string } | null>(null);
  const [checked, setChecked] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const found = (await getWalletCloudBackup()) as { updatedAt: string } | null;
      setExisting(found ? { updatedAt: found.updatedAt } : null);
    } catch {
      setExisting(null);
    } finally {
      setChecked(true);
    }
  }, []);

  useEffect(() => {
    if (!loading && account && !checked) void refresh();
    if (!loading && !account) setChecked(false);
  }, [loading, account, checked, refresh]);

  async function backUp() {
    const stored = loadVault();
    if (!stored) return toast.error("No wallet on this device");
    setBusy(true);
    try {
      const payload = await unlockVault(password);
      if (!payload) {
        toast.error("Wrong password");
        return;
      }
      await saveWalletCloudBackup({
        data: {
          blob: stored.blob,
          origin: stored.meta.origin,
          deviceLabel: navigator.userAgent.includes("Android") ? "Android" : "Web",
        },
      });
      markBackedUp();
      setPassword("");
      await refresh();
      toast.success("Encrypted backup saved");
    } catch (e) {
      toast.error((e as Error).message || "Backup failed");
    } finally {
      setBusy(false);
    }
  }

  async function removeBackup() {
    if (!window.confirm("Delete your cloud backup? Your wallet stays on this device.")) return;
    setBusy(true);
    try {
      await deleteWalletCloudBackup();
      setExisting(null);
      toast.success("Cloud backup deleted");
    } catch (e) {
      toast.error((e as Error).message || "Couldn't delete backup");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-white/12 bg-white/5 p-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <p className="font-display text-base font-semibold uppercase">Cloud backup</p>
      </div>
      <p className="text-xs text-muted-foreground">
        We store your recovery phrase encrypted with your wallet password. We can never read it —
        and if you forget the password, the backup can't be opened by anyone.
      </p>

      {!account && <CloudSignInButtons />}

      {account && (
        <>
          <p className="text-xs text-muted-foreground">
            {existing ? (
              <>
                Backed up {new Date(existing.updatedAt).toLocaleString()} ·{" "}
                <span className="text-foreground">{account.email}</span>
              </>
            ) : (
              <>
                No backup yet for <span className="text-foreground">{account.email}</span>
              </>
            )}
          </p>
          <Input
            type="password"
            placeholder="Wallet password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11"
            autoComplete="current-password"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              className="flex-1 rounded-full"
              disabled={!password || busy}
              onClick={backUp}
            >
              {busy ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <CloudUpload className="mr-1.5 h-4 w-4" />
              )}
              {existing ? "Update backup" : "Back up now"}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => void signOut()} aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
          {existing && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={removeBackup}
              disabled={busy}
            >
              <Trash2 className="mr-1.5 h-4 w-4" /> Delete cloud backup
            </Button>
          )}
        </>
      )}
    </div>
  );
}
