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
  loading: boolean;
};

const Ctx = createContext<AuthCtx>({
  uid: null,
  loading: true,
});

async function checkSession(signal?: AbortSignal) {
  const r = await fetch("/api/sessionCheck", {
    method: "GET",
    cache: "no-store",
    signal,
  });

  if (!r.ok) return { ok: false, uid: null };

  const data = await r.json();
  return { ok: true, uid: data.uid ?? null };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ac = new AbortController();
    let alive = true;

    (async () => {
      try {
        const res = await checkSession(ac.signal);

        if (!alive) return;

        setUid(res.ok ? res.uid : null);
      } catch {
        if (!alive) return;
        setUid(null);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
      ac.abort();
    };
  }, []);

  const value = useMemo(() => ({ uid, loading }), [uid, loading]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}