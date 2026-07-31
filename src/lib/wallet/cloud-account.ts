/** Small helper hook for the Google/Apple account used for cloud backups. */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const RESTORE_INTENT_KEY = "cryptopop.wallet.restore-intent";

export interface CloudAccount {
  email: string | null;
  provider: string | null;
}

export function useCloudAccount() {
  const [account, setAccount] = useState<CloudAccount | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      const u = data.session?.user;
      setAccount(u ? { email: u.email ?? null, provider: u.app_metadata?.provider ?? null } : null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const u = session?.user;
      setAccount(u ? { email: u.email ?? null, provider: u.app_metadata?.provider ?? null } : null);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (provider: "google" | "apple", rememberRestore = false) => {
    if (rememberRestore) {
      try {
        sessionStorage.setItem(RESTORE_INTENT_KEY, "1");
      } catch {
        /* ignore */
      }
    }
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin,
    });
    if (result.error) throw result.error;
    return result;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setAccount(null);
  }, []);

  return { account, loading, signIn, signOut };
}
