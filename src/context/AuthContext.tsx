"use client";

import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";

type AuthCtx = {
  uid: string | null;
  email?: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  uid: null,
  email: null,
  loading: true,
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [uid, setUid] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/sessionCheck", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      if (r.ok) {
        const data = (await r.json()) as { uid?: string; email?: string | null };
        setUid(data.uid || null);
        setEmail(data.email ?? null);
      } else {
        setUid(null);
        setEmail(null);
      }
    } catch {
      setUid(null);
      setEmail(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!alive) return;
      await refresh();
    })();
    return () => {
      alive = false;
    };
  }, [refresh]);

  const value = useMemo(() => ({ uid, email, loading, refresh }), [uid, email, loading, refresh]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}