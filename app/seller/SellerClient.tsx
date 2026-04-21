"use client";

import type { CSSProperties } from "react";
import { useMemo } from "react";
import { useRouter } from "next/navigation";

type SellerClientProps = {
  uid: string;
  email?: string | null;
};

type SellerStatus = "Ativo" | "Em configuração" | "Em breve";

function formatUid(uid: string) {
  if (!uid) return "";
  if (uid.length <= 10) return uid;
  return `${uid.slice(0, 6)}…${uid.slice(-4)}`;
}

function statusChipStyle(status: SellerStatus): CSSProperties {
  const base: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: "7px 12px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    border: "1px solid rgba(15,23,42,0.10)",
    whiteSpace: "nowrap",
    minHeight: 32,
  };

  if (status === "Ativo") {
    return {
      ...base,
      background: "rgba(94,252,161,0.14)",
      color: "#166534",
      border: "1px solid rgba(34,197,94,0.18)",
    };
  }

  if (status === "Em configuração") {
    return {
      ...base,
      background: "rgba(0,191,223,0.12)",
      color: "#0B3C5D",
      border: "1px solid rgba(11,60,93,0.10)",
    };
  }

  return {
    ...base,
    background: "rgba(100,116,139,0.10)",
    color: "#334155",
  };
}

function getModuleIcon(title: string) {
  switch (title) {
    case "Wallet do organizador":
      return "💳";
    case "Meu pesqueiro":
      return "📍";
    case "Marketplace":
      return "🛍️";
    case "Pedidos":
      return "📦";
    default:
      return "✨";
  }
}

export default function SellerClient({ uid, email }: SellerClientProps) {
  const router = useRouter();

  const stats = useMemo(
    () => [
      { label: "Carteira", value: "Ativa", hint: "central financeira" },
      { label: "Meu pesqueiro", value: "0", hint: "cadastros ativos" },
      { label: "Produtos", value: "0", hint: "itens publicados" },
      { label: "Plano", value: "Inativo", hint: "assinatura" },
    ],
    []
  );

  const modules = useMemo(
    () => [
      {
        title: "Wallet do organizador",
        status: "Ativo" as SellerStatus,
        description:
          "Acesse saldo disponível, valores pendentes, repasses, extrato e financeiro por torneio em um só lugar.",
        cta: "Abrir carteira",
        onClick: () => router.push("/seller/wallet"),
        featured: true,
      },
      {
        title: "Meu pesqueiro",
        status: "Em configuração" as SellerStatus,
        description:
          "Cadastre seu pesqueiro para aparecer no app, receber avaliações e ganhar divulgação.",
        cta: "Gerenciar pesqueiro",
        onClick: () => router.push("/seller/fishery"),
      },
      {
        title: "Marketplace",
        status: "Em breve" as SellerStatus,
        description:
          "Venda produtos, pacotes e outros itens para os usuários do ConnectFish.",
        cta: "Ver módulo",
        onClick: () => router.push("/seller/products"),
      },
      {
        title: "Pedidos",
        status: "Em breve" as SellerStatus,
        description:
          "Acompanhe pagamentos, entregas e movimentações da sua operação comercial.",
        cta: "Ver pedidos",
        onClick: () => router.push("/seller/orders"),
      },
    ],
    [router]
  );

  const quickActions = useMemo(
    () => [
      {
        title: "Carteira e repasses",
        sub: "Entre na wallet para acompanhar saldo, pedidos de repasse e extrato.",
        onClick: () => router.push("/seller/wallet"),
        primary: true,
      },
      {
        title: "Cadastrar pesqueiro",
        sub: "Crie ou edite as informações do seu estabelecimento.",
        onClick: () => router.push("/seller/fishery"),
      },
      {
        title: "Plano e assinatura",
        sub: "Gerencie cobrança e destaque do seu negócio.",
        onClick: () => router.push("/seller/billing"),
      },
      {
        title: "Configurações",
        sub: "Dados da conta comercial, preferências e integrações.",
        onClick: () => router.push("/seller/settings"),
      },
    ],
    [router]
  );

  return (
    <div style={styles.page}>
      <section style={styles.heroCard}>
        <div style={styles.heroContent}>
          <div style={styles.heroMain}>
            <div style={styles.eyebrow}>Área Comercial</div>

            <h1 style={styles.heroTitle}>Central do vendedor ConnectFish</h1>

            <p style={styles.heroSubtitle}>
              Gerencie sua operação comercial com o mesmo padrão visual do
              ecossistema ConnectFish: acesso rápido à wallet, ao pesqueiro,
              produtos, pedidos e evolução da sua conta.
            </p>

            <div style={styles.heroMeta}>
              <span style={styles.metaPill}>
                {email ? email : `UID ${formatUid(uid)}`}
              </span>
              <span style={styles.metaPill}>Painel comercial ativo</span>
              <span style={styles.metaPillHighlight}>Wallet em destaque</span>
            </div>

            <div style={styles.heroActions}>
              <button
                type="button"
                style={styles.primaryBtn}
                onClick={() => router.push("/seller/wallet")}
              >
                Abrir wallet
              </button>

              <button
                type="button"
                style={styles.secondaryBtnSoft}
                onClick={() => router.push("/seller/fishery")}
              >
                Meu pesqueiro
              </button>
            </div>
          </div>

          <div style={styles.heroSide}>
            <div style={styles.heroFocusCard}>
              <div style={styles.heroFocusOverline}>Acesso principal</div>
              <div style={styles.heroFocusTitle}>Carteira do organizador</div>
              <div style={styles.heroFocusText}>
                Centralize saldo, repasses, extrato e gestão financeira em um só
                lugar.
              </div>

              <div style={styles.heroFocusMetrics}>
                <div style={styles.metricBox}>
                  <div style={styles.metricLabel}>Status</div>
                  <div style={styles.metricValue}>Ativa</div>
                </div>

                <div style={styles.metricBox}>
                  <div style={styles.metricLabel}>Prioridade</div>
                  <div style={styles.metricValue}>Alta</div>
                </div>

                <div style={styles.metricBox}>
                  <div style={styles.metricLabel}>Fluxo</div>
                  <div style={styles.metricValue}>Financeiro</div>
                </div>
              </div>

              <button
                type="button"
                style={styles.primaryBtnLight}
                onClick={() => router.push("/seller/wallet")}
              >
                Ir para wallet
              </button>
            </div>
          </div>
        </div>
      </section>

      <section style={styles.sectionCard}>
        <div style={styles.sectionHeader}>
          <div style={styles.sectionBadge}>📊</div>
          <div style={{ flex: 1 }}>
            <div style={styles.sectionTitle}>Sua operação no ConnectFish</div>
            <div style={styles.sectionCaption}>
              Um resumo rápido da estrutura comercial disponível no painel.
            </div>
          </div>
        </div>

        <div style={styles.statsGrid}>
          {stats.map((item) => (
            <div key={item.label} style={styles.statCard}>
              <div style={styles.statLabel}>{item.label}</div>
              <div style={styles.statValue}>{item.value}</div>
              <div style={styles.statHint}>{item.hint}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={styles.mainGrid}>
        <div style={styles.sectionCard}>
          <div style={styles.sectionHeader}>
            <div style={styles.sectionBadge}>🧩</div>
            <div style={{ flex: 1 }}>
              <div style={styles.sectionTitle}>Módulos da área comercial</div>
              <div style={styles.sectionCaption}>
                A wallet entra como núcleo operacional, seguida pelos demais
                módulos do ecossistema.
              </div>
            </div>
          </div>

          <div style={styles.modulesGrid}>
            {modules.map((item) => (
              <div
                key={item.title}
                style={{
                  ...styles.moduleCard,
                  ...(item.featured ? styles.moduleCardFeatured : {}),
                }}
              >
                <div style={styles.moduleTop}>
                  <div style={styles.moduleTitleWrap}>
                    <div style={styles.moduleIcon}>
                      {getModuleIcon(item.title)}
                    </div>
                    <div style={styles.moduleTitle}>{item.title}</div>
                  </div>

                  <span style={statusChipStyle(item.status)}>{item.status}</span>
                </div>

                <div style={styles.moduleDescription}>{item.description}</div>

                <button
                  type="button"
                  style={item.featured ? styles.primaryModuleBtn : styles.secondaryBtn}
                  onClick={item.onClick}
                >
                  {item.cta}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div style={styles.sideColumn}>
          <div style={styles.sectionCard}>
            <div style={styles.sectionHeader}>
              <div style={styles.sectionBadge}>⚡</div>
              <div style={{ flex: 1 }}>
                <div style={styles.sectionTitle}>Ações rápidas</div>
                <div style={styles.sectionCaption}>
                  Atalhos para acelerar sua rotina comercial.
                </div>
              </div>
            </div>

            <div style={styles.actionsGrid}>
              {quickActions.map((action) => (
                <button
                  key={action.title}
                  type="button"
                  style={action.primary ? styles.actionCardPrimary : styles.actionCard}
                  onClick={action.onClick}
                >
                  <div
                    style={
                      action.primary ? styles.actionTitlePrimary : styles.actionTitle
                    }
                  >
                    {action.title}
                  </div>
                  <div
                    style={action.primary ? styles.actionSubPrimary : styles.actionSub}
                  >
                    {action.sub}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div style={styles.noteCard}>
            <div style={styles.noteTitle}>Nova lógica do painel</div>
            <div style={styles.noteSub}>
              Primeiro o vendedor entra no financeiro. Depois expande para
              pesqueiro, assinatura, produtos, pedidos e operação completa.
            </div>
          </div>
        </div>
      </section>

      <section style={styles.sectionCard}>
        <div style={styles.sectionHeader}>
          <div style={styles.sectionBadge}>✅</div>
          <div style={{ flex: 1 }}>
            <div style={styles.sectionTitle}>Checklist operacional</div>
            <div style={styles.sectionCaption}>
              Ordem recomendada para ativar toda a sua área comercial.
            </div>
          </div>
        </div>

        <div style={styles.checkGrid}>
          <div style={styles.checkItem}>
            <div style={styles.checkDot} />
            <div>
              <div style={styles.checkTitle}>Abrir a wallet</div>
              <div style={styles.checkSub}>
                Acompanhar saldo, repasses e extrato financeiro da operação.
              </div>
            </div>
          </div>

          <div style={styles.checkItem}>
            <div style={styles.checkDotMuted} />
            <div>
              <div style={styles.checkTitle}>Cadastrar o pesqueiro</div>
              <div style={styles.checkSub}>
                Nome, descrição, cidade, peixes, horário e contatos.
              </div>
            </div>
          </div>

          <div style={styles.checkItem}>
            <div style={styles.checkDotMuted} />
            <div>
              <div style={styles.checkTitle}>Ativar plano</div>
              <div style={styles.checkSub}>
                Etapa para manter destaque e evoluir a conta comercial.
              </div>
            </div>
          </div>

          <div style={styles.checkItem}>
            <div style={styles.checkDotMuted} />
            <div>
              <div style={styles.checkTitle}>Abrir marketplace</div>
              <div style={styles.checkSub}>
                Venda de produtos e outros serviços dentro da plataforma.
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    display: "grid",
    gap: 16,
    width: "100%",
  },

  heroCard: {
    borderRadius: 24,
    padding: "clamp(18px, 3vw, 28px)",
    background:
      "linear-gradient(135deg, rgba(11,60,93,0.08) 0%, rgba(0,191,223,0.08) 45%, rgba(94,252,161,0.10) 100%)",
    border: "1px solid rgba(15,23,42,0.08)",
    boxShadow: "0 12px 30px rgba(15,23,42,0.05)",
  },

  heroContent: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: 16,
    alignItems: "stretch",
  },

  heroMain: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    minWidth: 0,
  },

  eyebrow: {
    fontSize: 11,
    fontWeight: 1000,
    color: "#0B3C5D",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },

  heroTitle: {
    margin: "8px 0 0",
    fontSize: "clamp(26px, 4vw, 36px)",
    lineHeight: 1.08,
    fontWeight: 1000,
    color: "#0F172A",
    letterSpacing: -0.6,
  },

  heroSubtitle: {
    margin: "12px 0 0",
    fontSize: 14,
    lineHeight: 1.7,
    fontWeight: 700,
    color: "#475569",
    maxWidth: 760,
  },

  heroMeta: {
    marginTop: 16,
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },

  metaPill: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 34,
    padding: "8px 12px",
    borderRadius: 999,
    background: "#FFFFFF",
    border: "1px solid rgba(15,23,42,0.08)",
    color: "#334155",
    fontSize: 12,
    fontWeight: 900,
    boxShadow: "0 6px 16px rgba(15,23,42,0.04)",
  },

  metaPillHighlight: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 34,
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(11,60,93,0.10)",
    border: "1px solid rgba(11,60,93,0.12)",
    color: "#0B3C5D",
    fontSize: 12,
    fontWeight: 1000,
    boxShadow: "0 6px 16px rgba(15,23,42,0.04)",
  },

  heroActions: {
    marginTop: 18,
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },

  heroSide: {
    minWidth: 0,
    display: "flex",
  },

  heroFocusCard: {
    width: "100%",
    background: "linear-gradient(135deg, #0B3C5D 0%, #00BFDF 100%)",
    borderRadius: 22,
    padding: 18,
    color: "#FFFFFF",
    border: "1px solid rgba(255,255,255,0.12)",
    boxShadow: "0 16px 34px rgba(11,60,93,0.18)",
    display: "flex",
    flexDirection: "column",
    gap: 14,
    justifyContent: "space-between",
    minHeight: 240,
  },

  heroFocusOverline: {
    fontSize: 11,
    fontWeight: 1000,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: "rgba(255,255,255,0.74)",
  },

  heroFocusTitle: {
    fontSize: 22,
    lineHeight: 1.15,
    fontWeight: 1000,
    color: "#FFFFFF",
  },

  heroFocusText: {
    fontSize: 13,
    lineHeight: 1.6,
    fontWeight: 700,
    color: "rgba(255,255,255,0.86)",
  },

  heroFocusMetrics: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))",
    gap: 10,
  },

  metricBox: {
    borderRadius: 16,
    padding: "12px 12px",
    background: "rgba(255,255,255,0.10)",
    border: "1px solid rgba(255,255,255,0.12)",
    minWidth: 0,
  },

  metricLabel: {
    fontSize: 11,
    fontWeight: 800,
    color: "rgba(255,255,255,0.72)",
    marginBottom: 6,
  },

  metricValue: {
    fontSize: 14,
    fontWeight: 1000,
    color: "#FFFFFF",
  },

  sectionCard: {
    background: "#FFFFFF",
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 20,
    padding: "clamp(16px, 2.5vw, 20px)",
    boxShadow: "0 10px 24px rgba(15,23,42,0.05)",
  },

  sectionHeader: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 16,
  },

  sectionBadge: {
    width: 40,
    height: 40,
    borderRadius: 14,
    background: "rgba(0,191,223,0.12)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
    flexShrink: 0,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: 1000,
    color: "#0F172A",
  },

  sectionCaption: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 1.55,
    fontWeight: 700,
    color: "#64748B",
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
  },

  statCard: {
    background: "rgba(248,250,252,0.98)",
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 18,
    padding: 16,
    minWidth: 0,
  },

  statLabel: {
    fontSize: 12,
    fontWeight: 900,
    color: "#475569",
  },

  statValue: {
    marginTop: 8,
    fontSize: 24,
    fontWeight: 1000,
    color: "#0F172A",
  },

  statHint: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 1.5,
    fontWeight: 800,
    color: "#64748B",
  },

  mainGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: 12,
    alignItems: "start",
  },

  sideColumn: {
    display: "grid",
    gap: 12,
    minWidth: 0,
  },

  modulesGrid: {
    display: "grid",
    gap: 12,
  },

  moduleCard: {
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 18,
    padding: 16,
    background: "rgba(248,250,252,0.96)",
    minWidth: 0,
  },

  moduleCardFeatured: {
    background:
      "linear-gradient(135deg, rgba(11,60,93,0.06) 0%, rgba(94,252,161,0.10) 100%)",
    border: "1px solid rgba(11,60,93,0.12)",
    boxShadow: "0 10px 24px rgba(11,60,93,0.06)",
  },

  moduleTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
    flexWrap: "wrap",
  },

  moduleTitleWrap: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
    flex: 1,
  },

  moduleIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    background: "rgba(255,255,255,0.72)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 17,
    flexShrink: 0,
  },

  moduleTitle: {
    fontSize: 14,
    fontWeight: 1000,
    color: "#0F172A",
    minWidth: 0,
  },

  moduleDescription: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 1.6,
    fontWeight: 700,
    color: "#475569",
  },

  actionsGrid: {
    display: "grid",
    gap: 10,
  },

  actionCard: {
    textAlign: "left",
    padding: 14,
    borderRadius: 16,
    border: "1px solid rgba(15,23,42,0.08)",
    background: "#FFFFFF",
    cursor: "pointer",
  },

  actionCardPrimary: {
    textAlign: "left",
    padding: 14,
    borderRadius: 16,
    border: "1px solid rgba(11,60,93,0.12)",
    background:
      "linear-gradient(135deg, rgba(11,60,93,0.06) 0%, rgba(94,252,161,0.10) 100%)",
    cursor: "pointer",
    boxShadow: "0 10px 24px rgba(11,60,93,0.06)",
  },

  actionTitle: {
    fontSize: 13,
    fontWeight: 1000,
    color: "#0F172A",
  },

  actionTitlePrimary: {
    fontSize: 13,
    fontWeight: 1000,
    color: "#0B3C5D",
  },

  actionSub: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 1.55,
    fontWeight: 700,
    color: "#475569",
  },

  actionSubPrimary: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 1.55,
    fontWeight: 700,
    color: "#334155",
  },

  noteCard: {
    padding: 16,
    borderRadius: 18,
    background: "rgba(94,252,161,0.10)",
    border: "1px solid rgba(46,139,87,0.18)",
  },

  noteTitle: {
    fontSize: 12,
    fontWeight: 1000,
    color: "#14532D",
  },

  noteSub: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 1.6,
    fontWeight: 800,
    color: "#14532D",
  },

  checkGrid: {
    display: "grid",
    gap: 12,
  },

  checkItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    border: "1px solid rgba(15,23,42,0.08)",
    background: "rgba(248,250,252,0.96)",
  },

  checkDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    background: "#2E8B57",
    marginTop: 4,
    flexShrink: 0,
    boxShadow: "0 0 0 4px rgba(46,139,87,0.14)",
  },

  checkDotMuted: {
    width: 12,
    height: 12,
    borderRadius: 999,
    background: "#CBD5E1",
    marginTop: 4,
    flexShrink: 0,
  },

  checkTitle: {
    fontSize: 13,
    fontWeight: 1000,
    color: "#0F172A",
  },

  checkSub: {
    marginTop: 5,
    fontSize: 12,
    lineHeight: 1.55,
    fontWeight: 700,
    color: "#475569",
  },

  primaryBtn: {
    height: 46,
    padding: "0 18px",
    borderRadius: 14,
    border: "1px solid rgba(11,60,93,0.12)",
    background: "#0B3C5D",
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: 1000,
    cursor: "pointer",
  },

  primaryBtnLight: {
    height: 44,
    padding: "0 16px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "#FFFFFF",
    color: "#0F172A",
    fontSize: 13,
    fontWeight: 1000,
    cursor: "pointer",
  },

  secondaryBtnSoft: {
    height: 46,
    padding: "0 18px",
    borderRadius: 14,
    border: "1px solid rgba(15,23,42,0.10)",
    background: "#FFFFFF",
    color: "#0F172A",
    fontSize: 13,
    fontWeight: 1000,
    cursor: "pointer",
  },

  secondaryBtn: {
    marginTop: 12,
    height: 42,
    padding: "0 14px",
    borderRadius: 12,
    border: "1px solid rgba(15,23,42,0.10)",
    background: "#FFFFFF",
    color: "#0F172A",
    fontSize: 12,
    fontWeight: 1000,
    cursor: "pointer",
  },

  primaryModuleBtn: {
    marginTop: 12,
    height: 42,
    padding: "0 14px",
    borderRadius: 12,
    border: "1px solid rgba(11,60,93,0.12)",
    background: "#0B3C5D",
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: 1000,
    cursor: "pointer",
  },
};