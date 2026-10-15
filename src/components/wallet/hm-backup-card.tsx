/** Settings section: encrypted backup stored with Honest Money. */
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CloudUpload, Loader2, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loadVault, markBackedUp, unlockVault } from "@/lib/wallet/vault";
import { hmBackupDelete, hmBackupSave } from "@/lib/hm-backup.functions";
import {
  packBackup,
  passwordStrongEnough,
  startHmApproval,
  takeHmPass,
} from "@/lib/wallet/hm-backup";

const LAST_KEY = "cryptopop.hmbackup.last";

export function HmBackupCard() {
  const [last, setLast] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const handled = useRef(false);

  useEffect(() => {
    try {
      setLast(localStorage.getItem(LAST_KEY));
    } catch {
      /* ignore */
    }
    if (handled.current) return;
    handled.current = true;
    const got = takeHmPass();
    if (!got || got.action === "restore") return;
    void (async () => {
      setBusy(true);
      try {
        if (got.action === "save") {
          const stored = loadVault();
          if (!stored) throw new Error("No wallet on this device");
          const r = await hmBackupSave({
            data: { pass: got.pass, blob: packBackup(stored.blob, stored.meta.origin) },
          });
          localStorage.setItem(LAST_KEY, r.updatedAt);
          setLast(r.updatedAt);
          markBackedUp();
          toast.success("Backup saved with Honest Money");
        } else {
          await hmBackupDelete({ data: { pass: got.pass } });
          localStorage.removeItem(LAST_KEY);
          setLast(null);
          toast.success("Honest Money backup deleted");
        }
      } catch (e) {
        toast.error((e as Error).message || "Honest Money backup failed");
      } finally {
        setBusy(false);
      }
    })();
  }, []);

  async function begin() {
    if (!passwordStrongEnough(password)) {
      return toast.error(
        "Use a stronger wallet password first: 12+ characters mixing upper, lower, numbers or symbols. Change it under Settings → Password.",
      );
    }
    setBusy(true);
    const ok = await unlockVault(password);
    setPassword("");
    if (!ok) {
      setBusy(false);
      return toast.error("Wrong password");
    }
    startHmApproval("save", "/settings");
  }

  function remove() {
    if (!window.confirm("Delete your Honest Money backup? Your wallet stays on this device.")) return;
    startHmApproval("delete", "/settings");
  }

  return (
    <div className="space-y-3 rounded-2xl border border-white/12 bg-white/5 p-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <p className="font-display text-base font-semibold uppercase">Honest Money backup</p>
      </div>
      <p className="text-xs text-muted-foreground">
        Store your locked recovery phrase with your Honest Money account. You approve every save,
        restore or delete on honest.money. Requires a strong wallet password.
      </p>
      {last && (
        <p className="text-xs text-muted-foreground">
          Last saved {new Date(last).toLocaleString()}
        </p>
      )}
      <Input
        type="password"
        placeholder="Wallet password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="h-11"
        autoComplete="off"
      />
      <Button className="w-full rounded-full" disabled={!password || busy} onClick={begin}>
        {busy ? (
          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
        ) : (
          <CloudUpload className="mr-1.5 h-4 w-4" />
        )}
        {last ? "Update Honest Money backup" : "Back up to Honest Money"}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="text-destructive hover:text-destructive"
        onClick={remove}
        disabled={busy}
      >
        <Trash2 className="mr-1.5 h-4 w-4" /> Delete Honest Money backup
      </Button>
    </div>
  );
}
