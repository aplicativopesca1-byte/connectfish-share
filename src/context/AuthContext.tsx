"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

type AuthCtx = {
  user: User | null;
  loading: boolean;
};

const Ctx = createContext<AuthCtx>({ user: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // ✅ começa com o que o Firebase já sabe (evita “timing bug”)
  const [user, setUser] = useState<User | null>(auth.currentUser ?? null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("[Auth] booting listener... currentUser:", auth.currentUser?.uid || null);

    let finished = false;

    // ✅ fallback forte: se o listener não disparar, não trava e tenta currentUser
    const t = setTimeout(() => {
      if (!finished) {
        console.warn("[Auth] fallback -> forcing state from currentUser");
        setUser(auth.currentUser ?? null);
        setLoading(false);
      }
    }, 1500);

    const unsub = onAuthStateChanged(
      auth,
      (u) => {
        finished = true;
        clearTimeout(t);
        console.log("[Auth] state changed:", u ? `uid=${u.uid}` : "no user");
        setUser(u);
        setLoading(false);
      },
      (err) => {
        finished = true;
        clearTimeout(t);
        console.error("[Auth] listener error:", err);
        // ainda assim, tenta currentUser antes de desistir
        setUser(auth.currentUser ?? null);
        setLoading(false);
      }
    );

    return () => {
      clearTimeout(t);
      unsub();
    };
  }, []);

  const value = useMemo(() => ({ user, loading }), [user, loading]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}
