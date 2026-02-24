"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type AuthCtx = {
  uid: string | null;
  email?: string | null;
  loading: boolean;
};

const Ctx = createContext<AuthCtx>({ uid: null, email: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [uid, setUid] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    async function run() {
      try {
        const r = await fetch("/api/sessionCheck", { method: "GET" });
        if (!alive) return;

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
        if (alive) setLoading(false);
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, []);

  const value = useMemo(() => ({ uid, email, loading }), [uid, email, loading]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}