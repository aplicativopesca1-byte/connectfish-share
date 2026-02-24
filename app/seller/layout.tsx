"use client";

import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  const { uid, email, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !uid) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [loading, uid, router, pathname]);

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

        <Link href="/api/sessionLogout" style={{ fontSize: 12, fontWeight: 800 }}>
          Sair
        </Link>
      </div>

      {children}
    </div>
  );
}