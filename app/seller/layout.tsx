"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";

import { useAuth } from "@/context/AuthContext";
import { auth } from "@/lib/firebase";

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const IS_DEV = process.env.NODE_ENV !== "production";

  // ✅ Em produção: protege /seller
  // ✅ Em dev: não bloqueia o render (para você conseguir desenvolver sem travar)
  useEffect(() => {
    if (!IS_DEV && !loading && !user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [IS_DEV, loading, user, router, pathname]);

  async function doLogout() {
    try {
      await signOut(auth);
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    } catch {
      // ignore
    }
  }

  const headerSub = loading
    ? "Verificando sessão…"
    : user
    ? `Logado: ${user.email || user.uid}`
    : IS_DEV
    ? "Dev mode: sessão não confirmada"
    : "Sessão expirada";

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.brand}>
          <div style={styles.logo}>CF</div>
          <div>
            <div style={styles.title}>ConnectFish Seller</div>
            <div style={styles.sub}>{headerSub}</div>
          </div>
        </div>

        <div style={styles.actions}>
          <Link href="/" style={styles.secondaryBtn}>
            Home
          </Link>

          <a href="connectfish://" style={styles.secondaryBtn}>
            Abrir no app
          </a>

          {user ? (
            <button type="button" style={styles.primaryBtn} onClick={doLogout}>
              Sair
            </button>
          ) : (
            <Link href={`/login?next=${encodeURIComponent(pathname)}`} style={styles.primaryBtn}>
              Login
            </Link>
          )}
        </div>
      </header>

      <main style={styles.main}>
        {/* ✅ PRODUÇÃO: bloqueia e redireciona quando necessário */}
        {!IS_DEV && loading ? (
          <div style={styles.card}>
            <div style={{ fontWeight: 900 }}>Carregando…</div>
            <div style={{ opacity: 0.75, marginTop: 6 }}>Estamos validando seu acesso.</div>
          </div>
        ) : !IS_DEV && !user ? (
          <div style={styles.card}>
            <div style={{ fontWeight: 900 }}>Redirecionando…</div>
            <div style={{ opacity: 0.75, marginTop: 6 }}>Você precisa estar logado para acessar.</div>
          </div>
        ) : (
          <>
            {/* ✅ DEV: se não tiver user, mostra um aviso mas não bloqueia o conteúdo */}
            {IS_DEV && !user && (
              <div style={{ ...styles.card, marginBottom: 14 }}>
                <div style={{ fontWeight: 900 }}>Modo desenvolvimento</div>
                <div style={{ opacity: 0.8, marginTop: 6 }}>
                  Sessão ainda não confirmada. Você pode continuar desenvolvendo.
                </div>
              </div>
            )}
            {children}
          </>
        )}
      </main>

      <footer style={styles.footer}>
        <span style={styles.footerTxt}>© ConnectFish</span>
      </footer>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(120deg, #0B3C5D 0%, #2E8B57 70%)",
    padding: 18,
    fontFamily: "system-ui",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  header: {
    width: "min(980px, 100%)",
    margin: "0 auto",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: "12px 12px",
    borderRadius: 16,
    background: "rgba(255,255,255,0.14)",
    border: "1px solid rgba(255,255,255,0.18)",
    color: "#fff",
  },
  brand: { display: "flex", alignItems: "center", gap: 12 },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 14,
    background: "rgba(15,23,42,0.9)",
    display: "grid",
    placeItems: "center",
    fontWeight: 900,
    letterSpacing: 1,
  },
  title: { fontWeight: 900, fontSize: 14, lineHeight: 1.1 },
  sub: { fontWeight: 700, fontSize: 12, opacity: 0.85, marginTop: 2 },

  actions: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" },
  secondaryBtn: {
    padding: "10px 12px",
    borderRadius: 12,
    background: "rgba(255,255,255,0.18)",
    border: "1px solid rgba(255,255,255,0.22)",
    color: "#fff",
    textDecoration: "none",
    fontWeight: 900,
    fontSize: 12,
  },
  primaryBtn: {
    padding: "10px 12px",
    borderRadius: 12,
    background: "rgba(15,23,42,0.95)",
    border: "1px solid rgba(255,255,255,0.18)",
    color: "#fff",
    textDecoration: "none",
    fontWeight: 900,
    fontSize: 12,
    cursor: "pointer",
  },

  main: { width: "min(980px, 100%)", margin: "0 auto" },
  card: {
    background: "rgba(255,255,255,0.96)",
    borderRadius: 18,
    padding: 18,
    border: "1px solid rgba(15,23,42,0.10)",
    boxShadow: "0 12px 30px rgba(0,0,0,0.18)",
  },
  footer: { width: "min(980px, 100%)", margin: "0 auto", opacity: 0.75, textAlign: "center" },
  footerTxt: { color: "#fff", fontSize: 12, fontWeight: 700 },
};
