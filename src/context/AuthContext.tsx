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
  loading: boolean; // true só no boot inicial até 1ª checagem
  refreshing: boolean; // true enquanto roda refresh manual/auto
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

  // evita update depois de unmount
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);

    try {
      const r = await fetch("/api/sessionCheck", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });

      // ✅ Sessão inválida de verdade → derruba
      if (r.status === 401 || r.status === 403) {
        if (mountedRef.current) {
          setUid(null);
          setEmail(null);
        }
        return false;
      }

      // ❗ Qualquer outro erro (500/502/etc) = NÃO derruba a sessão
      if (!r.ok) {
        return Boolean(uid);
      }

      const data = (await r.json()) as {
        uid?: string;
        email?: string | null;
        ok?: boolean;
        reason?: string;
      };

      const nextUid = data.uid || null;

      // ✅ Sessão válida
      if (nextUid) {
        if (mountedRef.current) {
          setUid(nextUid);
          setEmail(data.email ?? null);
        }
        return true;
      }

      // Se veio 200 mas sem uid, trata como inválido (caso raro)
      if (mountedRef.current) {
        setUid(null);
        setEmail(null);
      }
      return false;
    } catch (e) {
      // ✅ Erro de rede/transitório: NÃO derruba
      console.error("[Auth] sessionCheck failed:", e);
      return Boolean(uid);
    } finally {
      if (mountedRef.current) {
        setRefreshing(false);
        setLoading(false);
      }
    }
  }, [uid]);

  // Boot inicial
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Revalida quando volta pro foco (sem “logout fantasma”)
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