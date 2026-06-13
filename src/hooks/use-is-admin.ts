import { useEffect, useState } from "react";
import { useAuth } from "./use-auth";
import { supabase } from "@/integrations/supabase/client";

export function useIsAdmin() {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) {
      setLoading(true);
      return;
    }
    if (!user) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setIsAdmin(!!data);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  return { isAdmin, loading };
}
