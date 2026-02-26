"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type AuthCtx = {
  uid: string | null;
  email?: string | null;
  loading: boolean;
};

const Ctx = createContext<AuthCtx>({
  uid: null,
  email: null,
  loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [uid, setUid] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    async function run() {
      try {
        const r = await fetch("/api/sessionCheck", {
          method: "GET",
          credentials: "include", // ✅ manda cookie de sessão
        });

        if (!alive) return;

        // ✅ 401 = simplesmente não logado (normal no boot)
        if (r.status === 401) {
          setUid(null);
          setEmail(null);
          setLoading(false);
          return;
        }

        if (!r.ok) {
          console.warn("[sessionCheck] unexpected status:", r.status);
          setUid(null);
          setEmail(null);
          setLoading(false);
          return;
        }

        const data = (await r.json().catch(() => ({}))) as {
          uid?: string;
          email?: string | null;
        };

        setUid(data.uid || null);
        setEmail(data.email ?? null);
      } catch (err) {
        console.warn("[sessionCheck] failed:", err);
        setUid(null);
        setEmail(null);
      } finally {
        if (alive) setLoading(false);
      }
    }

    run();

    return () => {
      alive = false;
    };
  }, []);

  const value = useMemo(() => ({ uid, email, loading }), [
    uid,
    email,
    loading,
  ]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}