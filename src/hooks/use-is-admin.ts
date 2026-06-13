import { useEffect, useState } from "react";
import { useAuth } from "./use-auth";
import { checkIsAdmin } from "@/lib/admin-role";

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
    checkIsAdmin(user.id)
      .then((admin) => {
        if (cancelled) return;
        setIsAdmin(admin);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("Admin role check failed", error);
        setIsAdmin(false);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  return { isAdmin, loading };
}
