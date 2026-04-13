"use client";

import React, { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

type NavItem = {
  href: string;
  label: string;
  emoji: string;
  soon?: boolean;
};

function isActive(pathname: string, href: string) {
  if (href === "/seller") return pathname === "/seller";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  const { uid, email, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (!loading && !uid) {
      router.replace(`/login?next=${encodeURIComponent(pathname || "/seller")}`);
    }
  }, [loading, uid, router, pathname]);

  const isAdmin = useMemo(() => {
    if (!uid) return false;

    const raw = process.env.NEXT_PUBLIC_ADMIN_UIDS || "";
    const adminUids = raw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    return adminUids.includes(uid);
  }, [uid]);

  const navMain = useMemo<NavItem[]>(
    () => [
      { href: "/seller", label: "Visão geral", emoji: "📊" },
      { href: "/seller/fishery", label: "Meu pesqueiro", emoji: "🎣" },
      { href: "/seller/tournaments", label: "Torneios", emoji: "🏆" },
      { href: "/seller/products", label: "Produtos", emoji: "🛒", soon: true },
      { href: "/seller/orders", label: "Pedidos", emoji: "📦", soon: true },
    ],
    []
  );

  const navAccount = useMemo<NavItem[]>(
    () => [
      { href: "/seller/billing", label: "Plano", emoji: "💳", soon: true },
      { href: "/seller/settings", label: "Configurações", emoji: "⚙️", soon: true },
    ],
    []
  );

  const navLegal = useMemo<NavItem[]>(
    () => [
      { href: "/terms", label: "Termos de Uso", emoji: "📘" },
      { href: "/privacy", label: "Privacidade", emoji: "🔐" },
    ],
    []
  );

  const navAdmin = useMemo<NavItem[]>(
    () => [{ href: "/admin/pesqueiros", label: "Aprovar pesqueiros", emoji: "✅" }],
    []
  );

  const isTournamentArea = useMemo(() => {
    return pathname?.startsWith("/seller/tournaments");
  }, [pathname]);

  const currentTournamentId = useMemo(() => {
    if (!pathname) return null;

    const match = pathname.match(/^\/seller\/tournaments\/([^/]+)/);
    const possibleId = match?.[1];

    if (!possibleId || possibleId === "new") return null;
    return possibleId;
  }, [pathname]);

  const topbarTitle = useMemo(() => {
    if (pathname === "/seller") return "Portal Comercial";
    if (pathname?.startsWith("/seller/fishery")) return "Gestão do Pesqueiro";
    if (pathname?.startsWith("/seller/tournaments")) return "Central de Torneios";
    return "Portal Comercial";
  }, [pathname]);

  const topbarSub = useMemo(() => {
    if (pathname === "/seller") {
      return "Gerencie seu pesqueiro, torneios e operações dentro do ConnectFish.";
    }

    if (pathname?.startsWith("/seller/fishery")) {
      return "Controle informações do pesqueiro, operação, cadastro e presença no app.";
    }

    if (pathname?.startsWith("/seller/tournaments")) {
      return "Crie torneios, defina perímetro, valide capturas, acompanhe ranking e equipes.";
    }

    return "Gerencie sua operação dentro do ConnectFish.";
  }, [pathname]);

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
      <div style={styles.loadingWrap}>
        <div style={styles.loadingCard}>
          <div style={styles.loadingTitle}>Verificando sessão…</div>
          <div style={styles.loadingSub}>Estamos preparando sua área comercial.</div>
        </div>
      </div>
    );
  }

  if (!uid) {
    return (
      <div style={styles.loadingWrap}>
        <div style={styles.loadingCard}>
          <div style={styles.loadingTitle}>Redirecionando…</div>
          <div style={styles.loadingSub}>Levando você para o login.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <aside style={styles.sidebar}>
        <div>
          <div style={styles.brand}>
            <div style={styles.logo}>CF</div>
            <div>
              <div style={styles.brandTitle}>ConnectFish</div>
              <div style={styles.brandSub}>Área Comercial</div>
            </div>
          </div>

          <div style={styles.profileBox}>
            <div style={styles.profileLabel}>Conta conectada</div>
            <div style={styles.profileValue}>{email || "Usuário logado"}</div>
            <div style={styles.profileUid}>UID: {uid}</div>
          </div>

          <nav style={styles.nav}>
            <div style={styles.navGroupTitle}>Principal</div>
            <div style={styles.navList}>
              {navMain.map((item) => {
                const active = isActive(pathname, item.href);

                return item.soon ? (
                  <div
                    key={item.href}
                    style={{
                      ...styles.navItem,
                      ...(active ? styles.navItemActive : {}),
                      ...styles.navItemSoon,
                    }}
                    aria-disabled="true"
                  >
                    <span style={styles.navEmoji}>{item.emoji}</span>
                    <span style={styles.navText}>{item.label}</span>
                    <span style={styles.soonBadge}>Em breve</span>
                  </div>
                ) : (
                  <Link
                    key={item.href}
                    href={item.href}
                    style={{
                      ...styles.navItem,
                      ...(active ? styles.navItemActive : {}),
                    }}
                  >
                    <span style={styles.navEmoji}>{item.emoji}</span>
                    <span style={styles.navText}>{item.label}</span>
                  </Link>
                );
              })}
            </div>

            <div style={{ ...styles.navGroupTitle, marginTop: 20 }}>Conta</div>
            <div style={styles.navList}>
              {navAccount.map((item) => {
                const active = isActive(pathname, item.href);

                return item.soon ? (
                  <div
                    key={item.href}
                    style={{
                      ...styles.navItem,
                      ...(active ? styles.navItemActive : {}),
                      ...styles.navItemSoon,
                    }}
                    aria-disabled="true"
                  >
                    <span style={styles.navEmoji}>{item.emoji}</span>
                    <span style={styles.navText}>{item.label}</span>
                    <span style={styles.soonBadge}>Em breve</span>
                  </div>
                ) : (
                  <Link
                    key={item.href}
                    href={item.href}
                    style={{
                      ...styles.navItem,
                      ...(active ? styles.navItemActive : {}),
                    }}
                  >
                    <span style={styles.navEmoji}>{item.emoji}</span>
                    <span style={styles.navText}>{item.label}</span>
                  </Link>
                );
              })}
            </div>

            <div style={{ ...styles.navGroupTitle, marginTop: 20 }}>Documentos legais</div>
            <div style={styles.navList}>
              {navLegal.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  style={styles.navItem}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span style={styles.navEmoji}>{item.emoji}</span>
                  <span style={styles.navText}>{item.label}</span>
                </Link>
              ))}
            </div>

            {isAdmin ? (
              <>
                <div style={{ ...styles.navGroupTitle, marginTop: 20 }}>Admin</div>
                <div style={styles.navList}>
                  {navAdmin.map((item) => {
                    const active = isActive(pathname, item.href);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        style={{
                          ...styles.navItem,
                          ...(active ? styles.navItemActive : {}),
                        }}
                      >
                        <span style={styles.navEmoji}>{item.emoji}</span>
                        <span style={styles.navText}>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </>
            ) : null}
          </nav>
        </div>

        <div style={styles.sidebarFooter}>
          <Link href="/" style={styles.ghostBtn}>
            Ir para home
          </Link>

          <button
            type="button"
            onClick={doLogout}
            disabled={loggingOut}
            style={{
              ...styles.primaryBtn,
              ...(loggingOut ? styles.btnDisabled : {}),
            }}
          >
            {loggingOut ? "Saindo…" : "Sair"}
          </button>
        </div>
      </aside>

      <section style={styles.main}>
        <header style={styles.topbar}>
          <div>
            <div style={styles.topbarTitle}>{topbarTitle}</div>
            <div style={styles.topbarSub}>{topbarSub}</div>
          </div>

          <div style={styles.topbarRight}>
            <div style={styles.statusPill}>
              <span style={styles.statusDot} />
              Sessão ativa
            </div>
          </div>
        </header>

        {isTournamentArea ? (
          <div style={styles.quickActionsWrap}>
            <div style={styles.quickActionsCard}>
              <div style={styles.quickActionsHeader}>
                <div>
                  <div style={styles.quickActionsTitle}>Atalhos de torneio</div>
                  <div style={styles.quickActionsSub}>
                    Acesso rápido para criação, operação e acompanhamento.
                  </div>
                </div>
              </div>

              <div style={styles.quickActionsGrid}>
                <Link href="/seller/tournaments" style={styles.quickActionLink}>
                  <span style={styles.quickActionEmoji}>🏆</span>
                  <span style={styles.quickActionText}>Lista de torneios</span>
                </Link>

                <Link href="/seller/tournaments/new" style={styles.quickActionLink}>
                  <span style={styles.quickActionEmoji}>➕</span>
                  <span style={styles.quickActionText}>Criar torneio</span>
                </Link>

                {currentTournamentId ? (
                  <Link
                    href={`/seller/tournaments/${currentTournamentId}/map`}
                    style={styles.quickActionLink}
                  >
                    <span style={styles.quickActionEmoji}>🗺️</span>
                    <span style={styles.quickActionText}>Mapa e perímetro</span>
                  </Link>
                ) : (
                  <div style={{ ...styles.quickActionLink, ...styles.quickActionDisabled }}>
                    <span style={styles.quickActionEmoji}>🗺️</span>
                    <span style={styles.quickActionText}>Mapa e perímetro</span>
                  </div>
                )}

                {currentTournamentId ? (
                  <Link
                    href={`/seller/tournaments/${currentTournamentId}/captures`}
                    style={styles.quickActionLink}
                  >
                    <span style={styles.quickActionEmoji}>📸</span>
                    <span style={styles.quickActionText}>Validação de capturas</span>
                  </Link>
                ) : (
                  <div style={{ ...styles.quickActionLink, ...styles.quickActionDisabled }}>
                    <span style={styles.quickActionEmoji}>📸</span>
                    <span style={styles.quickActionText}>Validação de capturas</span>
                  </div>
                )}

                {currentTournamentId ? (
                  <Link
                    href={`/seller/tournaments/${currentTournamentId}/ranking`}
                    style={styles.quickActionLink}
                  >
                    <span style={styles.quickActionEmoji}>🥇</span>
                    <span style={styles.quickActionText}>Ranking oficial</span>
                  </Link>
                ) : (
                  <div style={{ ...styles.quickActionLink, ...styles.quickActionDisabled }}>
                    <span style={styles.quickActionEmoji}>🥇</span>
                    <span style={styles.quickActionText}>Ranking oficial</span>
                  </div>
                )}

                {currentTournamentId ? (
                  <Link
                    href={`/seller/tournaments/${currentTournamentId}/teams`}
                    style={styles.quickActionLink}
                  >
                    <span style={styles.quickActionEmoji}>👥</span>
                    <span style={styles.quickActionText}>Equipes e inscrições</span>
                  </Link>
                ) : (
                  <div style={{ ...styles.quickActionLink, ...styles.quickActionDisabled }}>
                    <span style={styles.quickActionEmoji}>👥</span>
                    <span style={styles.quickActionText}>Equipes e inscrições</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}

        <main style={styles.content}>{children}</main>
      </section>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "grid",
    gridTemplateColumns: "280px minmax(0, 1fr)",
    background: "#F8FAFC",
    color: "#0F172A",
    fontFamily: "system-ui, sans-serif",
  },

  loadingWrap: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: 24,
    background: "linear-gradient(120deg, #0B3C5D 0%, #2E8B57 70%)",
    fontFamily: "system-ui, sans-serif",
  },
  loadingCard: {
    width: "min(460px, 100%)",
    background: "rgba(255,255,255,0.96)",
    border: "1px solid rgba(15,23,42,0.10)",
    borderRadius: 20,
    padding: 22,
    boxShadow: "0 20px 50px rgba(0,0,0,0.12)",
  },
  loadingTitle: {
    fontSize: 18,
    fontWeight: 1000,
    color: "#0F172A",
  },
  loadingSub: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: 700,
    color: "#475569",
  },

  sidebar: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    gap: 18,
    padding: 18,
    background: "linear-gradient(180deg, #0B3C5D 0%, #0F172A 100%)",
    borderRight: "1px solid rgba(255,255,255,0.08)",
    position: "sticky",
    top: 0,
    minHeight: "100vh",
  },

  brand: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  logo: {
    width: 46,
    height: 46,
    borderRadius: 14,
    display: "grid",
    placeItems: "center",
    background: "#FFFFFF",
    color: "#0F172A",
    fontWeight: 1000,
    letterSpacing: 1,
    userSelect: "none",
    boxShadow: "0 10px 25px rgba(0,0,0,0.18)",
  },
  brandTitle: {
    fontSize: 15,
    fontWeight: 1000,
    color: "#FFFFFF",
  },
  brandSub: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: 800,
    color: "rgba(255,255,255,0.72)",
  },

  profileBox: {
    marginTop: 18,
    padding: 14,
    borderRadius: 16,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.12)",
  },
  profileLabel: {
    fontSize: 11,
    fontWeight: 1000,
    color: "rgba(255,255,255,0.66)",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  profileValue: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: 900,
    color: "#FFFFFF",
    wordBreak: "break-word",
  },
  profileUid: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: 800,
    color: "rgba(255,255,255,0.62)",
    wordBreak: "break-all",
  },

  nav: {
    marginTop: 20,
  },
  navGroupTitle: {
    fontSize: 11,
    fontWeight: 1000,
    color: "rgba(255,255,255,0.62)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  navList: {
    display: "grid",
    gap: 8,
  },
  navItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    textDecoration: "none",
    padding: "12px 12px",
    borderRadius: 14,
    color: "#E2E8F0",
    border: "1px solid transparent",
    background: "transparent",
    fontSize: 13,
    fontWeight: 900,
    transition: "all 0.15s ease",
  },
  navItemActive: {
    background: "rgba(255,255,255,0.12)",
    color: "#FFFFFF",
    border: "1px solid rgba(255,255,255,0.16)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
  },
  navItemSoon: {
    opacity: 0.72,
    cursor: "default",
  },
  navEmoji: {
    width: 20,
    textAlign: "center",
    flexShrink: 0,
  },
  navText: {
    flex: 1,
  },
  soonBadge: {
    fontSize: 10,
    fontWeight: 1000,
    color: "#fff",
    background: "rgba(46,139,87,0.34)",
    border: "1px solid rgba(255,255,255,0.14)",
    borderRadius: 999,
    padding: "4px 8px",
    whiteSpace: "nowrap",
  },

  sidebarFooter: {
    display: "grid",
    gap: 10,
    marginTop: 16,
  },
  ghostBtn: {
    textDecoration: "none",
    textAlign: "center",
    padding: "11px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.08)",
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: 900,
  },
  primaryBtn: {
    padding: "11px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "#2E8B57",
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: 1000,
    cursor: "pointer",
  },
  btnDisabled: {
    opacity: 0.7,
    cursor: "not-allowed",
  },

  main: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
  },
  topbar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    padding: "18px 20px",
    borderBottom: "1px solid rgba(15,23,42,0.08)",
    background: "rgba(255,255,255,0.88)",
    backdropFilter: "blur(10px)",
    position: "sticky",
    top: 0,
    zIndex: 10,
  },
  topbarTitle: {
    fontSize: 18,
    fontWeight: 1000,
    color: "#0F172A",
  },
  topbarSub: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: 700,
    color: "#475569",
  },
  topbarRight: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  statusPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(46,139,87,0.10)",
    border: "1px solid rgba(46,139,87,0.18)",
    color: "#14532D",
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
    background: "#2E8B57",
    boxShadow: "0 0 0 4px rgba(46,139,87,0.16)",
  },

  quickActionsWrap: {
    padding: "16px 20px 0 20px",
  },
  quickActionsCard: {
    background: "#FFFFFF",
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 20,
    padding: 18,
    boxShadow: "0 10px 24px rgba(15,23,42,0.04)",
  },
  quickActionsHeader: {
    marginBottom: 14,
  },
  quickActionsTitle: {
    fontSize: 16,
    fontWeight: 1000,
    color: "#0F172A",
  },
  quickActionsSub: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: 700,
    color: "#64748B",
  },
  quickActionsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 10,
  },
  quickActionLink: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "12px 14px",
    borderRadius: 14,
    background: "#F8FAFC",
    border: "1px solid rgba(15,23,42,0.08)",
    textDecoration: "none",
    color: "#0F172A",
    fontSize: 13,
    fontWeight: 900,
  },
  quickActionDisabled: {
    opacity: 0.55,
    cursor: "default",
    pointerEvents: "none",
  },
  quickActionEmoji: {
    width: 20,
    textAlign: "center",
    flexShrink: 0,
  },
  quickActionText: {
    flex: 1,
  },

  content: {
    padding: 20,
  },
};