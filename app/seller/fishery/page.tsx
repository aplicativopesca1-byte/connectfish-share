export const runtime = "nodejs";

import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSessionUid } from "../../../src/lib/serverSession";

export default async function SellerFisheryPage() {
  const uid = await getServerSessionUid();

  if (!uid) {
    redirect("/login?next=%2Fseller%2Ffishery");
  }

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <div>
          <div style={styles.eyebrow}>Meu pesqueiro</div>
          <h1 style={styles.title}>Painel do pesqueiro</h1>
          <p style={styles.subtitle}>
            Organize o cadastro, estruturas, sessões de pesca e futuras reservas.
          </p>
        </div>
      </section>

      <section style={styles.grid}>
        <DashboardCard
          title="Cadastro do pesqueiro"
          text="Edite dados, fotos, localização, regras e comodidades."
          href="/seller/fishery/profile"
          emoji="🏞️"
        />

        <DashboardCard
          title="Estruturas"
          text="Cadastre lagos, quiosques, plataformas, decks e ranchos."
          href="/seller/fishery/areas"
          emoji="🎣"
        />

        <DashboardCard
          title="Sessões de pesca"
          text="Crie horários, vagas, preços e sessões disponíveis no app."
          href="/seller/fishery/sessions"
          emoji="🎟️"
        />

        <DashboardCard
          title="Reservas"
          text="Em breve: acompanhe reservas, pagamentos, check-in e fila."
          href="/seller/fishery/reservations"
          emoji="📋"
          disabled
        />
      </section>
    </main>
  );
}

function DashboardCard({
  title,
  text,
  href,
  emoji,
  disabled = false,
}: {
  title: string;
  text: string;
  href: string;
  emoji: string;
  disabled?: boolean;
}) {
  const content = (
    <div style={{ ...styles.card, opacity: disabled ? 0.55 : 1 }}>
      <div style={styles.emoji}>{emoji}</div>
      <h2 style={styles.cardTitle}>{title}</h2>
      <p style={styles.cardText}>{text}</p>
      <div style={styles.cardButton}>{disabled ? "Em breve" : "Abrir"}</div>
    </div>
  );

  if (disabled) return content;

  return (
    <Link href={href} style={styles.link}>
      {content}
    </Link>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#F8FAFC",
    padding: 24,
    fontFamily: "system-ui, sans-serif",
  },
  hero: {
    background: "#FFFFFF",
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 22,
    padding: 22,
    marginBottom: 18,
    boxShadow: "0 14px 34px rgba(15,23,42,0.06)",
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: 1000,
    color: "#0B3C5D",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  title: {
    margin: "6px 0 0",
    fontSize: 30,
    fontWeight: 1000,
    color: "#0F172A",
  },
  subtitle: {
    margin: "8px 0 0",
    fontSize: 14,
    fontWeight: 700,
    color: "#64748B",
    lineHeight: 1.6,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 14,
  },
  link: {
    textDecoration: "none",
  },
  card: {
    background: "#FFFFFF",
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 20,
    padding: 20,
    minHeight: 210,
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 10px 28px rgba(15,23,42,0.05)",
  },
  emoji: {
    fontSize: 34,
    marginBottom: 12,
  },
  cardTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 1000,
    color: "#0F172A",
  },
  cardText: {
    margin: "8px 0 18px",
    fontSize: 13,
    fontWeight: 700,
    color: "#64748B",
    lineHeight: 1.6,
    flex: 1,
  },
  cardButton: {
    width: "fit-content",
    borderRadius: 12,
    background: "#0B3C5D",
    color: "#FFFFFF",
    padding: "10px 14px",
    fontSize: 12,
    fontWeight: 1000,
  },
};