"use client";

import type { CSSProperties } from "react";
import { useMemo } from "react";
import { useRouter } from "next/navigation";

type SellerClientProps = {
  uid: string;
  email?: string | null;
};

type CardItem = {
  title: string;
  description: string;
  emoji: string;
  href: string;
  cta: string;
  featured?: boolean;
  status: string;
};

function formatUid(uid: string) {
  if (!uid) return "";
  if (uid.length <= 10) return uid;
  return `${uid.slice(0, 6)}…${uid.slice(-4)}`;
}

export default function SellerClient({ uid, email }: SellerClientProps) {
  const router = useRouter();

  const cards = useMemo<CardItem[]>(
    () => [
      {
        title: "Carteira",
        description:
          "Acompanhe saldo, repasses, extrato e financeiro dos torneios.",
        emoji: "💳",
        href: "/seller/wallet",
        cta: "Abrir wallet",
        featured: true,
        status: "Ativa",
      },
      {
        title: "Conta do organizador",
        description:
          "Atualize seu cadastro financeiro e acompanhe o status da aprovação.",
        emoji: "🪪",
        href: "/seller/account",
        cta: "Ver cadastro",
        status: "Importante",
      },
      {
        title: "Meu pesqueiro",
        description:
          "Cadastre e gerencie as informações do seu estabelecimento.",
        emoji: "🎣",
        href: "/seller/fishery",
        cta: "Gerenciar",
        status: "Configurar",
      },
      {
        title: "Torneios",
        description:
          "Crie torneios, acompanhe equipes, ranking e validações.",
        emoji: "🏆",
        href: "/seller/tournaments",
        cta: "Abrir torneios",
        status: "Disponível",
      },
    ],
    []
  );

  return (
    <div style={styles.page}>
      <section style={styles.hero}>
        <div style={styles.heroContent}>
          <div style={styles.overline}>Área Comercial ConnectFish</div>

          <h1 style={styles.title}>Painel do organizador</h1>

          <p style={styles.subtitle}>
            Controle sua operação, financeiro, torneios e cadastro de organizador
            em uma central simples, segura e com a identidade do ConnectFish.
          </p>

          <div style={styles.accountRow}>
            <span style={styles.accountPill}>
              {email ? email : `UID ${formatUid(uid)}`}
            </span>
            <span style={styles.statusPill}>Painel ativo</span>
          </div>

          <div style={styles.actions}>
            <button
              type="button"
              style={styles.primaryButton}
              onClick={() => router.push("/seller/wallet")}
            >
              Abrir wallet
            </button>

            <button
              type="button"
              style={styles.secondaryButton}
              onClick={() => router.push("/seller/account")}
            >
              Atualizar cadastro
            </button>
          </div>
        </div>

        <div style={styles.heroSide}>
          <div style={styles.heroMetricCard}>
            <span style={styles.heroMetricLabel}>Próximo passo</span>
            <strong style={styles.heroMetricValue}>Cadastro financeiro</strong>
            <p style={styles.heroMetricText}>
              Mantenha seus dados atualizados para liberar torneios pagos e
              repasses com segurança.
            </p>
          </div>
        </div>
      </section>

      <section style={styles.cardsGrid}>
        {cards.map((item) => (
          <article
            key={item.title}
            style={{
              ...styles.card,
              ...(item.featured ? styles.cardFeatured : {}),
            }}
          >
            <div style={styles.cardTop}>
              <div style={styles.iconBox}>{item.emoji}</div>
              <span
                style={{
                  ...styles.cardStatus,
                  ...(item.featured ? styles.cardStatusFeatured : {}),
                }}
              >
                {item.status}
              </span>
            </div>

            <h2 style={styles.cardTitle}>{item.title}</h2>
            <p style={styles.cardDescription}>{item.description}</p>

            <button
              type="button"
              style={item.featured ? styles.cardPrimaryButton : styles.cardButton}
              onClick={() => router.push(item.href)}
            >
              {item.cta}
            </button>
          </article>
        ))}
      </section>

      <section style={styles.infoGrid}>
        <div style={styles.infoCard}>
          <div style={styles.infoIcon}>✅</div>
          <div>
            <h2 style={styles.infoTitle}>Comece pelo cadastro</h2>
            <p style={styles.infoText}>
              O cadastro de organizador mostra se sua conta está aprovada, em
              análise ou precisando de atualização.
            </p>
          </div>
        </div>

        <div style={styles.infoCard}>
          <div style={styles.infoIcon}>💳</div>
          <div>
            <h2 style={styles.infoTitle}>Depois acompanhe a wallet</h2>
            <p style={styles.infoText}>
              Na wallet você acompanha saldo, valores pendentes, repasses e
              movimentações financeiras.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    width: "100%",
    display: "grid",
    gap: 16,
    overflowX: "hidden",
  },

  hero: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.5fr) minmax(260px, 0.7fr)",
    gap: 16,
    alignItems: "stretch",
    borderRadius: 26,
    padding: "clamp(20px, 4vw, 32px)",
    background:
      "linear-gradient(135deg, #071325 0%, #0B3C5D 48%, #00BFDF 135%)",
    color: "#FFFFFF",
    border: "1px solid rgba(255,255,255,0.10)",
    boxShadow: "0 22px 55px rgba(0,0,0,0.22)",
    overflow: "hidden",
  },

  heroContent: {
    minWidth: 0,
  },

  overline: {
    fontSize: 11,
    fontWeight: 1000,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: "rgba(234,240,255,0.68)",
  },

  title: {
    margin: "10px 0 0",
    maxWidth: 760,
    fontSize: "clamp(30px, 5vw, 44px)",
    lineHeight: 1.04,
    fontWeight: 1000,
    letterSpacing: -1,
    color: "#FFFFFF",
  },

  subtitle: {
    margin: "14px 0 0",
    maxWidth: 760,
    fontSize: "clamp(14px, 2.5vw, 16px)",
    lineHeight: 1.7,
    fontWeight: 700,
    color: "rgba(234,240,255,0.80)",
  },

  accountRow: {
    marginTop: 18,
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },

  accountPill: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: 34,
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.10)",
    border: "1px solid rgba(255,255,255,0.14)",
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: 900,
    wordBreak: "break-word",
  },

  statusPill: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: 34,
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(94,252,161,0.16)",
    border: "1px solid rgba(94,252,161,0.28)",
    color: "#DDFBEA",
    fontSize: 12,
    fontWeight: 1000,
  },

  actions: {
    marginTop: 22,
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
  },

  primaryButton: {
    height: 46,
    padding: "0 18px",
    borderRadius: 14,
    border: "1px solid rgba(94,252,161,0.35)",
    background: "#5EFCA1",
    color: "#082F49",
    fontSize: 13,
    fontWeight: 1000,
    cursor: "pointer",
  },

  secondaryButton: {
    height: 46,
    padding: "0 18px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.10)",
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: 1000,
    cursor: "pointer",
  },

  heroSide: {
    minWidth: 0,
    display: "flex",
  },

  heroMetricCard: {
    width: "100%",
    borderRadius: 22,
    padding: 18,
    background: "rgba(8,15,28,0.44)",
    border: "1px solid rgba(255,255,255,0.12)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },

  heroMetricLabel: {
    fontSize: 12,
    fontWeight: 900,
    color: "rgba(234,240,255,0.62)",
  },

  heroMetricValue: {
    marginTop: 8,
    fontSize: 20,
    lineHeight: 1.2,
    color: "#FFFFFF",
  },

  heroMetricText: {
    margin: "10px 0 0",
    fontSize: 13,
    lineHeight: 1.6,
    fontWeight: 700,
    color: "rgba(234,240,255,0.74)",
  },

  cardsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))",
    gap: 14,
  },

  card: {
    minWidth: 0,
    borderRadius: 22,
    padding: 18,
    background: "rgba(15,23,42,0.88)",
    border: "1px solid rgba(255,255,255,0.08)",
    boxShadow: "0 18px 45px rgba(0,0,0,0.16)",
  },

  cardFeatured: {
    background:
      "linear-gradient(135deg, rgba(11,60,93,0.92) 0%, rgba(8,15,28,0.92) 100%)",
    border: "1px solid rgba(0,191,223,0.35)",
    boxShadow: "0 18px 45px rgba(0,191,223,0.08)",
  },

  cardTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 16,
  },

  iconBox: {
    width: 46,
    height: 46,
    borderRadius: 16,
    display: "grid",
    placeItems: "center",
    background: "rgba(0,191,223,0.12)",
    border: "1px solid rgba(0,191,223,0.18)",
    fontSize: 22,
  },

  cardStatus: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "7px 10px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.08)",
    color: "rgba(234,240,255,0.72)",
    fontSize: 11,
    fontWeight: 1000,
    whiteSpace: "nowrap",
  },

  cardStatusFeatured: {
    background: "rgba(94,252,161,0.16)",
    color: "#DDFBEA",
  },

  cardTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 1000,
    color: "#FFFFFF",
  },

  cardDescription: {
    margin: "8px 0 0",
    minHeight: 48,
    fontSize: 13,
    lineHeight: 1.6,
    fontWeight: 700,
    color: "rgba(234,240,255,0.68)",
  },

  cardButton: {
    marginTop: 16,
    width: "100%",
    height: 42,
    borderRadius: 13,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.08)",
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: 1000,
    cursor: "pointer",
  },

  cardPrimaryButton: {
    marginTop: 16,
    width: "100%",
    height: 42,
    borderRadius: 13,
    border: "1px solid rgba(0,191,223,0.24)",
    background: "#00BFDF",
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: 1000,
    cursor: "pointer",
  },

  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))",
    gap: 14,
  },

  infoCard: {
    display: "flex",
    alignItems: "flex-start",
    gap: 14,
    borderRadius: 22,
    padding: 18,
    background: "rgba(15,23,42,0.82)",
    border: "1px solid rgba(255,255,255,0.08)",
    boxShadow: "0 18px 45px rgba(0,0,0,0.12)",
  },

  infoIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    display: "grid",
    placeItems: "center",
    background: "rgba(94,252,161,0.14)",
    border: "1px solid rgba(94,252,161,0.22)",
    fontSize: 20,
    flexShrink: 0,
  },

  infoTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 1000,
    color: "#FFFFFF",
  },

  infoText: {
    margin: "5px 0 0",
    fontSize: 13,
    lineHeight: 1.6,
    fontWeight: 700,
    color: "rgba(234,240,255,0.68)",
  },
};