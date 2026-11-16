import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { onPasswordRequest, type PasswordRequest } from "@/lib/wallet/password-prompt";

/**
 * Asks for the wallet password when Face ID / fingerprint is turned on but
 * can't be used right now (its saved copy is missing or out of date).
 */
export function PasswordApprovalDialog() {
  const [req, setReq] = useState<PasswordRequest | null>(null);
  const [pw, setPw] = useState("");

  useEffect(
    () =>
      onPasswordRequest((r) => {
        setPw("");
        setReq((prev) => {
          prev?.resolve(null);
          return r;
        });
      }),
    [],
  );

  function finish(value: string | null) {
    req?.resolve(value);
    setReq(null);
    setPw("");
  }

  return (
    <Dialog open={!!req} onOpenChange={(open) => !open && finish(null)}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle>Enter your wallet password</DialogTitle>
          <DialogDescription>
            {req?.reason ?? "Approve this"}. Face ID / fingerprint isn't available right now, so your password is needed instead.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (pw) finish(pw);
          }}
        >
          <Input
            type="password"
            autoFocus
            autoComplete="current-password"
            placeholder="Wallet password"
            aria-label="Wallet password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
          />
          <DialogFooter className="flex-row gap-2">
            <Button type="button" variant="secondary" className="flex-1 rounded-full" onClick={() => finish(null)}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1 rounded-full" disabled={!pw}>
              Approve
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
