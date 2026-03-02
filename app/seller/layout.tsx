// 📂 app/seller/layout.tsx
"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  const { uid, email, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (!loading && !uid) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [loading, uid, router, pathname]);

  async function doLogout() {
    try {
      setLoggingOut(true);
      await fetch("/api/sessionLogout", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });
    } finally {
      setLoggingOut(false);
      router.replace("/login?next=%2Fseller");
      router.refresh();
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 24, fontFamily: "system-ui" }}>
        <b>Verificando sessão…</b>
      </div>
    );
  }

  if (!uid) {
    return (
      <div style={{ padding: 24, fontFamily: "system-ui" }}>
        <b>Redirecionando…</b>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <b>Seller</b>
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            {email ? `Logado: ${email}` : `UID: ${uid}`}
          </div>
        </div>

        <button
          type="button"
          onClick={doLogout}
          disabled={loggingOut}
          style={{
            fontSize: 12,
            fontWeight: 800,
            border: "1px solid rgba(15,23,42,0.14)",
            background: "#0F172A",
            color: "#fff",
            borderRadius: 10,
            padding: "8px 12px",
            cursor: loggingOut ? "not-allowed" : "pointer",
            opacity: loggingOut ? 0.7 : 1,
          }}
        >
          {loggingOut ? "Saindo…" : "Sair"}
        </button>
      </div>

      {children}
    </div>
  );
}