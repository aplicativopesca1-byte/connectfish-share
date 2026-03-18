"use client";

import type { CSSProperties } from "react";
import { useMemo } from "react";
import { useRouter } from "next/navigation";

type SellerClientProps = {
  uid: string;
  email?: string | null;
};

type SellerStatus = "Não iniciado" | "Em configuração" | "Em breve";

function formatUid(uid: string) {
  if (!uid) return "";
  if (uid.length <= 10) return uid;
  return `${uid.slice(0, 6)}…${uid.slice(-4)}`;
}

function statusChipStyle(status: SellerStatus): CSSProperties {
  const base: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    border: "1px solid rgba(15,23,42,0.10)",
    whiteSpace: "nowrap",
  };

  if (status === "Em configuração") {
    return {
      ...base,
      background: "rgba(11,60,93,0.10)",
      color: "#0B3C5D",
    };
  }

  if (status === "Em breve") {
    return {
      ...base,
      background: "rgba(100,116,139,0.10)",
      color: "#334155",
    };
  }

  return {
    ...base,
    background: "rgba(245,158,11,0.12)",
    color: "#92400E",
  };
}

export default function SellerClient({ uid, email }: SellerClientProps) {
  const router = useRouter();

  const stats = useMemo(
    () => [
      { label: "Meu pesqueiro", value: "0", hint: "cadastros ativos" },
      { label: "Produtos", value: "0", hint: "itens publicados" },
      { label: "Pedidos", value: "0", hint: "movimentações" },
      { label: "Plano", value: "Inativo", hint: "assinatura" },
    ],
    []
  );

  const modules = useMemo(
    () => [
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
        title: "Cadastrar pesqueiro",
        sub: "Crie ou edite as informações do seu estabelecimento.",
        onClick: () => router.push("/seller/fishery"),
      },
      {
        title: "Plano e assinatura",
        sub: "No futuro você vai gerenciar cobrança e destaque do seu negócio aqui.",
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
      <section style={styles.hero}>
        <div>
          <div style={styles.eyebrow}>Área Comercial</div>
          <div style={styles.h1}>Bem-vindo ao seu painel</div>
          <div style={styles.heroSub}>
            Aqui você vai gerenciar seu pesqueiro, acompanhar sua operação e,
            no futuro, vender no marketplace do ConnectFish.
          </div>

          <div style={styles.heroMeta}>
            <span style={styles.metaPill}>
              {email ? email : `UID ${formatUid(uid)}`}
            </span>
            <span style={styles.metaPill}>Conta comercial em preparação</span>
          </div>
        </div>

        <div style={styles.heroCard}>
          <div style={styles.heroCardLabel}>Próximo passo recomendado</div>
          <div style={styles.heroCardTitle}>Cadastrar seu pesqueiro</div>
          <div style={styles.heroCardSub}>
            Esse é o primeiro módulo real da sua área comercial e será a base
            para divulgação no app.
          </div>

          <button
            type="button"
            style={styles.primaryBtn}
            onClick={() => router.push("/seller/fishery")}
          >
            Ir para meu pesqueiro
          </button>
        </div>
      </section>

      <section style={styles.grid4}>
        {stats.map((item) => (
          <div key={item.label} style={styles.statCard}>
            <div style={styles.statLabel}>{item.label}</div>
            <div style={styles.statValue}>{item.value}</div>
            <div style={styles.statHint}>{item.hint}</div>
          </div>
        ))}
      </section>

      <section style={styles.grid2}>
        <div style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <div style={styles.panelTitle}>Módulos da área comercial</div>
              <div style={styles.panelSub}>
                Estrutura inicial preparada para crescer com o ConnectFish.
              </div>
            </div>
          </div>

          <div style={styles.moduleList}>
            {modules.map((item) => (
              <div key={item.title} style={styles.moduleCard}>
                <div style={styles.moduleTop}>
                  <div style={styles.moduleTitle}>{item.title}</div>
                  <span style={statusChipStyle(item.status)}>{item.status}</span>
                </div>

                <div style={styles.moduleDescription}>{item.description}</div>

                <button
                  type="button"
                  style={styles.secondaryBtn}
                  onClick={item.onClick}
                >
                  {item.cta}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div style={styles.sideColumn}>
          <div style={styles.panel}>
            <div style={styles.panelHeader}>
              <div>
                <div style={styles.panelTitle}>Ações rápidas</div>
                <div style={styles.panelSub}>
                  Atalhos para acelerar sua configuração.
                </div>
              </div>
            </div>

            <div style={styles.actions}>
              {quickActions.map((action) => (
                <button
                  key={action.title}
                  type="button"
                  style={styles.actionCard}
                  onClick={action.onClick}
                >
                  <div style={styles.actionTitle}>{action.title}</div>
                  <div style={styles.actionSub}>{action.sub}</div>
                </button>
              ))}
            </div>
          </div>

          <div style={styles.noteBox}>
            <div style={styles.noteTitle}>Como vamos evoluir isso</div>
            <div style={styles.noteSub}>
              Primeiro estruturamos o pesqueiro. Depois entram assinatura,
              avaliações, produtos, pedidos e integração total com o app.
            </div>
          </div>
        </div>
      </section>

      <section style={styles.panel}>
        <div style={styles.panelHeader}>
          <div>
            <div style={styles.panelTitle}>Checklist inicial</div>
            <div style={styles.panelSub}>
              Ordem recomendada para ativar sua operação.
            </div>
          </div>
        </div>

        <div style={styles.checkList}>
          <div style={styles.checkItem}>
            <div style={styles.checkDot} />
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
              <div style={styles.checkTitle}>Adicionar localização</div>
              <div style={styles.checkSub}>
                Garantir que ele possa aparecer corretamente no Explore.
              </div>
            </div>
          </div>

          <div style={styles.checkItem}>
            <div style={styles.checkDotMuted} />
            <div>
              <div style={styles.checkTitle}>Ativar plano</div>
              <div style={styles.checkSub}>
                Etapa futura para manter o estabelecimento divulgado.
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
  },

  hero: {
    display: "grid",
    gridTemplateColumns: "1.3fr 0.7fr",
    gap: 14,
    alignItems: "stretch",
  },

  eyebrow: {
    fontSize: 11,
    fontWeight: 1000,
    color: "#0B3C5D",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  h1: {
    marginTop: 6,
    fontSize: 28,
    fontWeight: 1000,
    letterSpacing: -0.3,
    color: "#0F172A",
  },

  heroSub: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 1.55,
    fontWeight: 700,
    color: "#475569",
    maxWidth: 760,
  },

  heroMeta: {
    marginTop: 14,
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },

  metaPill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 12px",
    borderRadius: 999,
    background: "#FFFFFF",
    border: "1px solid rgba(15,23,42,0.08)",
    color: "#334155",
    fontSize: 12,
    fontWeight: 900,
    boxShadow: "0 6px 16px rgba(15,23,42,0.04)",
  },

  heroCard: {
    background: "linear-gradient(135deg, #0B3C5D 0%, #2E8B57 100%)",
    borderRadius: 20,
    padding: 18,
    color: "#FFFFFF",
    border: "1px solid rgba(255,255,255,0.10)",
    boxShadow: "0 14px 30px rgba(11,60,93,0.18)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    gap: 12,
    minHeight: 190,
  },

  heroCardLabel: {
    fontSize: 11,
    fontWeight: 1000,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "rgba(255,255,255,0.72)",
  },

  heroCardTitle: {
    fontSize: 20,
    fontWeight: 1000,
    lineHeight: 1.2,
  },

  heroCardSub: {
    fontSize: 13,
    lineHeight: 1.5,
    fontWeight: 700,
    color: "rgba(255,255,255,0.84)",
  },

  grid4: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 12,
  },

  statCard: {
    background: "#FFFFFF",
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 18,
    padding: 16,
    boxShadow: "0 10px 24px rgba(15,23,42,0.05)",
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
    fontWeight: 800,
    color: "#64748B",
  },

  grid2: {
    display: "grid",
    gridTemplateColumns: "1.15fr 0.85fr",
    gap: 12,
    alignItems: "start",
  },

  sideColumn: {
    display: "grid",
    gap: 12,
  },

  panel: {
    background: "#FFFFFF",
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 18,
    padding: 16,
    boxShadow: "0 10px 24px rgba(15,23,42,0.05)",
  },

  panelHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },

  panelTitle: {
    fontSize: 15,
    fontWeight: 1000,
    color: "#0F172A",
  },

  panelSub: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: 700,
    color: "#64748B",
  },

  moduleList: {
    display: "grid",
    gap: 12,
  },

  moduleCard: {
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 16,
    padding: 14,
    background: "rgba(248,250,252,0.95)",
  },

  moduleTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  moduleTitle: {
    fontSize: 14,
    fontWeight: 1000,
    color: "#0F172A",
  },

  moduleDescription: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 1.55,
    fontWeight: 700,
    color: "#475569",
  },

  actions: {
    display: "grid",
    gap: 10,
  },

  actionCard: {
    textAlign: "left",
    padding: 14,
    borderRadius: 14,
    border: "1px solid rgba(15,23,42,0.08)",
    background: "#FFFFFF",
    cursor: "pointer",
  },

  actionTitle: {
    fontSize: 13,
    fontWeight: 1000,
    color: "#0F172A",
  },

  actionSub: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 1.5,
    fontWeight: 700,
    color: "#475569",
  },

  noteBox: {
    padding: 14,
    borderRadius: 16,
    background: "rgba(46,139,87,0.10)",
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
    lineHeight: 1.5,
    fontWeight: 800,
    color: "#14532D",
  },

  checkList: {
    display: "grid",
    gap: 12,
  },

  checkItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    padding: 12,
    borderRadius: 14,
    border: "1px solid rgba(15,23,42,0.08)",
    background: "rgba(248,250,252,0.95)",
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
    lineHeight: 1.5,
    fontWeight: 700,
    color: "#475569",
  },

  primaryBtn: {
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

  secondaryBtn: {
    marginTop: 12,
    height: 40,
    padding: "0 14px",
    borderRadius: 12,
    border: "1px solid rgba(15,23,42,0.10)",
    background: "#FFFFFF",
    color: "#0F172A",
    fontSize: 12,
    fontWeight: 1000,
    cursor: "pointer",
  },
};