"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";

type Props = {
  params: {
    slug: string;
  };
  searchParams?: {
    registrationId?: string;
  };
};

function AppSessionBridgeInline() {
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (typeof window === "undefined") return;

      const hash = window.location.hash?.replace(/^#/, "") || "";
      const params = new URLSearchParams(hash);
      const appToken = params.get("appToken");

      if (!appToken) return;

      setProcessing(true);

      try {
        const response = await fetch("/api/sessionLogin", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ idToken: appToken }),
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data?.ok) {
          throw new Error(data?.error || "Falha ao criar sessão web.");
        }

        const cleanUrl = window.location.pathname + window.location.search;

        if (!cancelled) {
          window.location.replace(cleanUrl);
        }
      } catch (error) {
        console.error("[PaymentFailureBridge] erro:", error);
        if (!cancelled) {
          setProcessing(false);
        }
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!processing) return null;

  return <div style={styles.bridgeBox}>Validando seu acesso vindo do app...</div>;
}

export default function TournamentPaymentFailurePage({
  params,
  searchParams,
}: Props) {
  const slug = params?.slug ?? "";

  const [registrationId, setRegistrationId] = useState(
    searchParams?.registrationId ?? ""
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const currentUrl = new URL(window.location.href);
    const registrationIdFromUrl =
      currentUrl.searchParams.get("registrationId") || "";

    if (registrationIdFromUrl) {
      setRegistrationId(registrationIdFromUrl);
    }
  }, []);

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <AppSessionBridgeInline />

        <section style={styles.card}>
          <div style={styles.iconWrapFailure}>
            <span style={styles.icon}>×</span>
          </div>

          <h1 style={styles.title}>Pagamento não concluído</h1>

          <p style={styles.text}>
            Não foi possível concluir o pagamento da inscrição neste momento.
          </p>

          <p style={styles.text}>
            Isso pode acontecer por cancelamento do checkout, recusa do meio de
            pagamento ou falha momentânea no processamento.
          </p>

          {registrationId ? (
            <div style={styles.infoBox}>
              <span style={styles.infoLabel}>Inscrição</span>
              <strong style={styles.infoValue}>{registrationId}</strong>
            </div>
          ) : null}

          <div style={styles.alertFailure}>
            <p style={styles.alertTitle}>Você pode tentar novamente</p>
            <p style={styles.alertText}>
              Volte para a página do torneio, revise os dados e inicie um novo
              pagamento quando quiser.
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
  bridgeBox: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    background: "#EFF6FF",
    border: "1px solid #BFDBFE",
    color: "#1E40AF",
    fontSize: 14,
    fontWeight: 700,
    textAlign: "center",
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
  iconWrapFailure: {
    width: 84,
    height: 84,
    borderRadius: 999,
    background: "#FEE2E2",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  icon: {
    fontSize: 40,
    fontWeight: 900,
    color: "#B91C1C",
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
  alertFailure: {
    marginTop: 20,
    width: "100%",
    background: "#FEF2F2",
    border: "1px solid #FECACA",
    borderRadius: 16,
    padding: 16,
    textAlign: "left",
  },
  alertTitle: {
    margin: 0,
    fontSize: 14,
    fontWeight: 900,
    color: "#991B1B",
  },
  alertText: {
    margin: "8px 0 0 0",
    fontSize: 14,
    lineHeight: 1.6,
    fontWeight: 700,
    color: "#B91C1C",
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