import { useState } from "react";
import { Scanner } from "@yudiel/react-qr-scanner";
import { ScanLine, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/** Camera QR scanner with a paste fallback. Returns the raw decoded text. */
export function QrScanDialog({
  open,
  onOpenChange,
  onResult,
  title = "Scan QR code",
  description,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onResult: (text: string) => void;
  title?: string;
  description?: string;
}) {
  const [manual, setManual] = useState("");
  const [error, setError] = useState<string | null>(null);

  function finish(text: string) {
    setManual("");
    setError(null);
    onResult(text);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="h-5 w-5" /> {title}
          </DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-black">
            {open && (
              <Scanner
                onScan={(codes) => {
                  const value = codes[0]?.rawValue;
                  if (value) finish(value);
                }}
                onError={(e) => setError(e instanceof Error ? e.message : "Camera unavailable")}
                constraints={{ facingMode: "environment" }}
                styles={{ container: { width: "100%", height: "100%" } }}
                components={{ finder: false }}
                sound={false}
              />
            )}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-2/3 w-2/3 rounded-2xl border-2 border-primary/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
            </div>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">Type the words instead</summary>
            <Textarea
              rows={3}
              className="mt-2 font-mono text-[11px]"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="word word word …"
            />
            <Button
              size="sm"
              className="mt-2 w-full"
              disabled={!manual.trim()}
              onClick={() => finish(manual)}
            >
              Use these words
            </Button>
          </details>

          <Button variant="ghost" className="w-full" onClick={() => onOpenChange(false)}>
            <X className="mr-1.5 h-4 w-4" /> Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
