/** Restore a wallet from the Honest Money backup (approval → fetch → decrypt locally). */
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, CloudDownload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWallet } from "@/lib/wallet/wallet-context";
import { decryptJson, type EncryptedBlob } from "@/lib/wallet/crypto";
import type { VaultOrigin, VaultPayload } from "@/lib/wallet/vault";
import { hmBackupRestore } from "@/lib/hm-backup.functions";
import { startHmApproval, takeHmPass, unpackBackup } from "@/lib/wallet/hm-backup";

export function HmRestorePanel({ onBack }: { onBack: () => void }) {
  const { create } = useWallet();
  const [backup, setBackup] = useState<{ blob: EncryptedBlob; origin: VaultOrigin } | null>(null);
  const [missing, setMissing] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;
    const got = takeHmPass();
    if (!got || got.action !== "restore") return;
    setFetching(true);
    hmBackupRestore({ data: { pass: got.pass } })
      .then((r) => (r ? setBackup(unpackBackup(r.blob)) : setMissing(true)))
      .catch((e) => toast.error((e as Error).message || "Couldn't reach Honest Money"))
      .finally(() => setFetching(false));
  }, []);

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
      <h2 className="font-display text-xl font-semibold uppercase">Restore from Honest Money</h2>
      {!backup && !fetching && (
        <>
          <p className="text-sm text-muted-foreground">
            {missing
              ? "No backup found on that Honest Money account."
              : "You'll approve the restore on honest.money, then come right back here."}
          </p>
          <Button className="h-12 w-full rounded-full" onClick={() => startHmApproval("restore", "/")}>
            Continue to Honest Money
          </Button>
        </>
      )}
      {fetching && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Getting your backup…
        </p>
      )}
      {backup && (
        <div className="space-y-3">
          <p className="text-sm">Backup found. Enter your wallet password to unlock it.</p>
          <Input
            type="password"
            placeholder="Wallet password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-12"
            autoComplete="off"
          />
          <Button className="h-12 w-full rounded-full" disabled={!password || busy} onClick={restore}>
            {busy ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <CloudDownload className="mr-1.5 h-4 w-4" />
            )}
            Restore wallet
          </Button>
        </div>
      )}
      <Button variant="ghost" className="w-full" onClick={onBack}>
        <ArrowLeft className="mr-1 h-4 w-4" /> Back
      </Button>
    </div>
  );
}
