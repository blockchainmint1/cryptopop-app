import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "./use-auth";
import { getMyAdminStatus } from "@/lib/admin-role.functions";

export function useIsAdmin() {
  const { user, loading: authLoading } = useAuth();
  const getAdminStatus = useServerFn(getMyAdminStatus);
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
    getAdminStatus()
      .then(({ isAdmin: admin }) => {
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
  }, [user, authLoading, getAdminStatus]);

  return { isAdmin, loading };
}
