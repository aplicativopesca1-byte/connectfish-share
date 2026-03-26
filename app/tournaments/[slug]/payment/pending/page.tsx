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

type PaymentStatus = "checking" | "pending" | "approved" | "failed";

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
        console.error("[PaymentPendingBridge] erro:", error);
        if (!cancelled) setProcessing(false);
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

export default function TournamentPaymentPendingPage({
  params,
  searchParams,
}: Props) {
  const slug = params?.slug ?? "";

  const [registrationId, setRegistrationId] = useState(
    searchParams?.registrationId ?? ""
  );

  const [status, setStatus] = useState<PaymentStatus>("checking");
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    const id =
      url.searchParams.get("registrationId") ||
      searchParams?.registrationId ||
      "";

    if (id) {
      setRegistrationId(id);
      void checkRegistrationStatus(id);
    } else {
      setStatus("pending");
      setChecking(false);
    }
  }, [searchParams?.registrationId]);

  async function checkRegistrationStatus(id: string) {
    try {
      setChecking(true);
      setStatus("checking");

      const response = await fetch(
        `/api/tournaments/registration-status?registrationId=${encodeURIComponent(id)}`,
        { cache: "no-store" }
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.message || "Erro ao validar pagamento");
      }

      const resolvedStatus = String(data?.resolvedStatus || "")
        .trim()
        .toLowerCase();

      const paymentStatus = String(data?.paymentStatus || "")
        .trim()
        .toLowerCase();

      // ✅ aprovado → redireciona
      if (resolvedStatus === "approved" || paymentStatus === "approved") {
        window.location.replace(
          `/tournaments/${slug}/payment/success?registrationId=${encodeURIComponent(id)}`
        );
        return;
      }

      // ❌ falhou
      if (resolvedStatus === "failed") {
        setStatus("failed");
        return;
      }

      // ⏳ padrão → pending
      setStatus("pending");
    } catch (error) {
      console.error("[PendingPage] erro:", error);
      setStatus("pending");
    } finally {
      setChecking(false);
    }
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <AppSessionBridgeInline />

        <section style={styles.card}>
          {checking || status === "checking" ? (
            <>
              <div style={styles.iconWrapChecking}>
                <span style={styles.iconChecking}>…</span>
              </div>

              <h1 style={styles.title}>Validando pagamento</h1>
              <p style={styles.text}>
                Estamos consultando o status mais recente da sua inscrição.
              </p>
            </>
          ) : status === "failed" ? (
            <>
              <div style={styles.iconWrapFailure}>
                <span style={styles.iconFailure}>×</span>
              </div>

              <h1 style={styles.title}>Pagamento não concluído</h1>
              <p style={styles.text}>
                O pagamento não foi confirmado. Você pode tentar novamente.
              </p>
            </>
          ) : (
            <>
              <div style={styles.iconWrapPending}>
                <span style={styles.icon}>!</span>
              </div>

              <h1 style={styles.title}>Pagamento pendente</h1>
              <p style={styles.text}>
                Seu pagamento está em processamento. Assim que confirmado, sua
                inscrição será automaticamente validada.
              </p>
            </>
          )}

          {registrationId && (
            <div style={styles.infoBox}>
              <span style={styles.infoLabel}>Inscrição</span>
              <strong style={styles.infoValue}>{registrationId}</strong>
            </div>
          )}

          <div style={styles.actions}>
            <Link href={`/tournaments/${slug}`} style={styles.primaryButton}>
              Voltar ao torneio
            </Link>

            {status === "pending" && registrationId ? (
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={() => void checkRegistrationStatus(registrationId)}
              >
                Atualizar status
              </button>
            ) : (
              <Link href="/" style={styles.secondaryButton}>
                Ir para a home
              </Link>
            )}
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
  iconWrapChecking: {
    width: 84,
    height: 84,
    borderRadius: 999,
    background: "#DBEAFE",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  iconChecking: {
    fontSize: 36,
    fontWeight: 900,
    color: "#1D4ED8",
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
    fontSize: 36,
    fontWeight: 900,
    color: "#92400E",
  },
  iconFailure: {
    fontSize: 40,
    fontWeight: 900,
    color: "#B91C1C",
  },
  title: {
    fontSize: 34,
    fontWeight: 1000,
    color: "#0B3C5D",
  },
  text: {
    marginTop: 12,
    color: "#475569",
  },
  infoBox: {
    marginTop: 20,
    background: "#F8FAFC",
    borderRadius: 16,
    padding: "14px 18px",
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: 800,
    color: "#64748B",
  },
  infoValue: {
    fontSize: 14,
    fontWeight: 900,
  },
  actions: {
    marginTop: 24,
    display: "flex",
    gap: 12,
  },
  primaryButton: {
    padding: "13px 18px",
    background: "#0B3C5D",
    color: "#fff",
    borderRadius: 12,
    textDecoration: "none",
  },
  secondaryButton: {
    padding: "13px 18px",
    background: "#E2E8F0",
    borderRadius: 12,
    border: "none",
    cursor: "pointer",
    textDecoration: "none",
    color: "#0F172A",
  },
};