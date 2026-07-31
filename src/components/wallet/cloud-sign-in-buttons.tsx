import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCloudAccount } from "@/lib/wallet/cloud-account";

/** Google + Apple sign-in buttons used by the cloud backup flows. */
export function CloudSignInButtons({
  rememberRestore = false,
  className,
}: {
  rememberRestore?: boolean;
  className?: string;
}) {
  const { signIn } = useCloudAccount();
  const [busy, setBusy] = useState<"google" | "apple" | null>(null);

  async function go(provider: "google" | "apple") {
    setBusy(provider);
    try {
      await signIn(provider, rememberRestore);
    } catch (e) {
      toast.error((e as Error).message || "Sign-in failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={className}>
      <div className="grid gap-2">
        <Button
          variant="secondary"
          className="h-12 w-full rounded-full"
          disabled={busy !== null}
          onClick={() => go("google")}
        >
          {busy === "google" ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <GoogleGlyph />
          )}
          Continue with Google
        </Button>
        <Button
          variant="secondary"
          className="h-12 w-full rounded-full"
          disabled={busy !== null}
          onClick={() => go("apple")}
        >
          {busy === "apple" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <AppleGlyph />}
          Continue with Apple
        </Button>
      </div>
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="mr-1.5 h-4 w-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.7-4.9H1.3v3.1A12 12 0 0 0 12 24z"
      />
      <path fill="#FBBC05" d="M5.3 14.4a7.2 7.2 0 0 1 0-4.6V6.7H1.3a12 12 0 0 0 0 10.8l4-3.1z" />
      <path
        fill="#EA4335"
        d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4C17.9 1.2 15.2 0 12 0A12 12 0 0 0 1.3 6.7l4 3.1C6.3 6.9 8.9 4.8 12 4.8z"
      />
    </svg>
  );
}

function AppleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="mr-1.5 h-4 w-4 fill-current" aria-hidden="true">
      <path d="M16.4 12.7c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.8-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.3-.9-1.7 0-3.3 1-4.2 2.5-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.5 1.3-.1 1.8-.8 3.3-.8s2 .8 3.3.8c1.4 0 2.3-1.2 3.1-2.5.6-.9.9-1.4 1.4-2.5-3.6-1.4-3.6-4.2-2.6-4.3zM14 4.6c.7-.9 1.2-2.1 1-3.3-1 0-2.3.7-3 1.6-.7.8-1.3 2-1.1 3.2 1.2.1 2.4-.6 3.1-1.5z" />
    </svg>
  );
}
