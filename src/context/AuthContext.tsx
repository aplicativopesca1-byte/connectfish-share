"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type AuthCtx = {
  uid: string | null;
  email: string | null;
  loading: boolean;      // só true no boot inicial
  refreshing: boolean;   // true enquanto roda refresh manual/auto
  refresh: () => Promise<boolean>; // retorna se está logado
};

const Ctx = createContext<AuthCtx>({
  uid: null,
  email: null,
  loading: true,
  refreshing: false,
  refresh: async () => false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [uid, setUid] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const r = await fetch("/api/sessionCheck", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });

      if (r.ok) {
        const data = (await r.json()) as { uid?: string; email?: string | null };
        const nextUid = data.uid || null;
        setUid(nextUid);
        setEmail(data.email ?? null);
        return Boolean(nextUid);
      }

      setUid(null);
      setEmail(null);
      return false;
    } catch (e) {
      console.error("[Auth] sessionCheck failed:", e);
      setUid(null);
      setEmail(null);
      return false;
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  // Boot inicial
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Revalida quando volta pro foco (resolve MUITOS casos de cookie/session)
  useEffect(() => {
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") refresh();
    });
    return () => {
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  const value = useMemo(
    () => ({ uid, email, loading, refreshing, refresh }),
    [uid, email, loading, refreshing, refresh]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}