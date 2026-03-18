import Link from "next/link";
import type { CSSProperties } from "react";

type Props = {
  params: {
    slug: string;
  };
  searchParams?: {
    registrationId?: string;
  };
};

export default function TournamentPaymentPendingPage({
  params,
  searchParams,
}: Props) {
  const slug = params?.slug ?? "";
  const registrationId = searchParams?.registrationId;

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <section style={styles.card}>
          <div style={styles.iconWrapPending}>
            <span style={styles.icon}>!</span>
          </div>

          <h1 style={styles.title}>Pagamento pendente</h1>

          <p style={styles.text}>
            Seu pagamento foi iniciado, mas ainda está como pendente no sistema
            do Mercado Pago.
          </p>

          <p style={styles.text}>
            Isso pode acontecer em pagamentos por boleto, Pix em processamento
            ou cartão ainda em análise.
          </p>

          {registrationId ? (
            <div style={styles.infoBox}>
              <span style={styles.infoLabel}>Inscrição</span>
              <strong style={styles.infoValue}>{registrationId}</strong>
            </div>
          ) : null}

          <div style={styles.alertPending}>
            <p style={styles.alertTitle}>O que acontece agora</p>
            <p style={styles.alertText}>
              Sua inscrição permanece aguardando pagamento. Assim que o Mercado
              Pago confirmar a operação, o webhook atualizará o status
              automaticamente.
            </p>
          </div>

          <div style={styles.actions}>
            <Link href={`/tournaments/${slug}`} style={styles.primaryButton}>
              Voltar ao torneio
            </Link>

            <Link href="/" style={styles.secondaryButton}>
              Ir para a home
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#F8FAFC",
    padding: 24,
    display: "flex",
    alignItems: "center",
  },
  container: {
    width: "100%",
    maxWidth: 760,
    margin: "0 auto",
  },
  card: {
    background: "#FFFFFF",
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 24,
    padding: 32,
    boxShadow: "0 10px 30px rgba(15,23,42,0.05)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
  },
  iconWrapPending: {
    width: 84,
    height: 84,
    borderRadius: 999,
    background: "#FEF3C7",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  icon: {
    fontSize: 36,
    fontWeight: 900,
    color: "#92400E",
    lineHeight: 1,
  },
  title: {
    margin: 0,
    fontSize: 34,
    fontWeight: 1000,
    color: "#0B3C5D",
  },
  text: {
    margin: "14px 0 0 0",
    fontSize: 15,
    lineHeight: 1.7,
    color: "#475569",
    fontWeight: 600,
    maxWidth: 560,
  },
  infoBox: {
    marginTop: 20,
    background: "#F8FAFC",
    borderRadius: 16,
    padding: "14px 18px",
    minWidth: 280,
    display: "flex",
    flexDirection: "column",
    gap: 6,
    border: "1px solid rgba(15,23,42,0.06)",
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: 800,
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: 900,
    color: "#0F172A",
    wordBreak: "break-all",
  },
  alertPending: {
    marginTop: 20,
    width: "100%",
    background: "#FFFBEB",
    border: "1px solid #FDE68A",
    borderRadius: 16,
    padding: 16,
    textAlign: "left",
  },
  alertTitle: {
    margin: 0,
    fontSize: 14,
    fontWeight: 900,
    color: "#92400E",
  },
  alertText: {
    margin: "8px 0 0 0",
    fontSize: 14,
    lineHeight: 1.6,
    fontWeight: 700,
    color: "#B45309",
  },
  actions: {
    marginTop: 24,
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  primaryButton: {
    textDecoration: "none",
    borderRadius: 12,
    padding: "13px 18px",
    background: "#0B3C5D",
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: 900,
  },
  secondaryButton: {
    textDecoration: "none",
    borderRadius: 12,
    padding: "13px 18px",
    background: "#E2E8F0",
    color: "#0F172A",
    fontSize: 14,
    fontWeight: 900,
  },
};