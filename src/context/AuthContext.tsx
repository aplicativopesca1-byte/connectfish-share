"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type AuthCtx = {
  uid: string | null;
  email: string | null;
  loading: boolean;
  refreshing: boolean;
  refresh: () => Promise<boolean>;
};

const Ctx = createContext<AuthCtx>({
  uid: null,
  email: null,
  loading: true,
  refreshing: false,
  refresh: async () => false,
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [uid, setUid] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const doFetch = useCallback(async () => {
    return fetch("/api/sessionCheck", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
    });
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);

    try {
      // 1ª tentativa
      let r = await doFetch();

      // Se deu 401 por no_cookie logo após login, tenta de novo rapidinho
      if (r.status === 401) {
        const data1 = await r.json().catch(() => ({} as any));
        if (data1?.reason === "no_cookie") {
          await sleep(150);
          r = await doFetch();
        } else {
          // invalid_cookie ou outro 401: derruba
          if (mountedRef.current) {
            setUid(null);
            setEmail(null);
          }
          return false;
        }
      }

      if (r.status === 401 || r.status === 403) {
        if (mountedRef.current) {
          setUid(null);
          setEmail(null);
        }
        return false;
      }

      if (!r.ok) {
        // erro 500/502 etc: não derruba
        return Boolean(uid);
      }

      const data = (await r.json()) as { uid?: string; email?: string | null };
      const nextUid = data.uid || null;

      if (nextUid) {
        if (mountedRef.current) {
          setUid(nextUid);
          setEmail(data.email ?? null);
        }
        return true;
      }

      if (mountedRef.current) {
        setUid(null);
        setEmail(null);
      }
      return false;
    } catch (e) {
      console.error("[Auth] sessionCheck failed:", e);
      // erro de rede: não derruba
      return Boolean(uid);
    } finally {
      if (mountedRef.current) {
        setRefreshing(false);
        setLoading(false);
      }
    }
  }, [doFetch, uid]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const onFocus = () => refresh();
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
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