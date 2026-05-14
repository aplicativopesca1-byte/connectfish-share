"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";

type Props = {
  params: { slug: string };
  searchParams?: { registrationId?: string };
};

type Status = "checking" | "approved" | "pending" | "failed";

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
        console.error("[PaymentSuccessBridge] erro:", error);
        if (!cancelled) setProcessing(false);
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!processing) return null;

  return (
    <div style={styles.bridgeBox}>
      Validando seu acesso vindo do app...
    </div>
  );
}

export default function TournamentPaymentSuccessPage({
  params,
  searchParams,
}: Props) {
  const slug = params?.slug ?? "";

  const [registrationId, setRegistrationId] = useState(
    searchParams?.registrationId ?? ""
  );
  const [status, setStatus] = useState<Status>("checking");

  const attemptsRef = useRef(0);
  const isCheckingRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    const id =
      url.searchParams.get("registrationId") ||
      searchParams?.registrationId ||
      "";

    if (!id) {
      setStatus("failed");
      return;
    }

    setRegistrationId(id);
    void checkStatus(id);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      isCheckingRef.current = false;
    };
  }, [searchParams?.registrationId]);

  async function checkStatus(id: string) {
    if (!id || isCheckingRef.current) return;

    isCheckingRef.current = true;

    try {
      const res = await fetch(
        `/api/tournaments/registration-status?registrationId=${encodeURIComponent(id)}`,
        { cache: "no-store" }
      );

      const data = await res.json().catch(() => ({}));

      const resolvedStatus = String(data?.resolvedStatus || "")
        .trim()
        .toLowerCase();

      const paymentStatus = String(data?.paymentStatus || "")
        .trim()
        .toLowerCase();

      const registrationStatus = String(data?.registrationStatus || "")
        .trim()
        .toLowerCase();

      const isApproved =
        resolvedStatus === "approved" ||
        paymentStatus === "approved" ||
        registrationStatus === "confirmed";

      if (isApproved) {
        setStatus("approved");
        return;
      }

      const isFailed =
        resolvedStatus === "failed" ||
        registrationStatus === "payment_failed" ||
        registrationStatus === "cancelled" ||
        paymentStatus === "rejected" ||
        paymentStatus === "cancelled" ||
        paymentStatus === "error";

      if (isFailed) {
        setStatus("failed");
        return;
      }

      setStatus("pending");

      if (attemptsRef.current < 30) {
        attemptsRef.current += 1;

        timeoutRef.current = setTimeout(() => {
          isCheckingRef.current = false;
          void checkStatus(id);
        }, 2000);

        return;
      }

      setStatus("pending");
    } catch (err) {
      console.error("[SuccessPage] erro:", err);

      setStatus((current) =>
        current === "approved" ? "approved" : "pending"
      );

      if (attemptsRef.current < 30) {
        attemptsRef.current += 1;

        timeoutRef.current = setTimeout(() => {
          isCheckingRef.current = false;
          void checkStatus(id);
        }, 2000);

        return;
      }
    } finally {
      isCheckingRef.current = false;
    }
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <AppSessionBridgeInline />

        <section style={styles.card}>
          {status === "checking" && (
            <>
              <h1 style={styles.title}>Validando pagamento...</h1>
              <p style={styles.text}>
                Estamos confirmando sua inscrição com o sistema.
              </p>
            </>
          )}

          {status === "pending" && (
            <>
              <h1 style={styles.title}>Pagamento em processamento</h1>
              <p style={styles.text}>
                Seu pagamento foi recebido e está sendo processado. A confirmação
                pode levar alguns segundos.
              </p>
            </>
          )}

          {status === "approved" && (
            <>
              <div style={styles.iconWrapSuccess}>
                <span style={styles.icon}>✓</span>
              </div>

              <h1 style={styles.title}>Inscrição confirmada</h1>

              <p style={styles.text}>
                Pagamento aprovado com sucesso. Sua equipe está confirmada no
                torneio.
              </p>
            </>
          )}

          {status === "failed" && (
            <>
              <h1 style={styles.title}>Erro na confirmação</h1>
              <p style={styles.text}>
                Não conseguimos confirmar o pagamento. Tente novamente.
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

            {status === "failed" && (
              <Link href={`/tournaments/${slug}`} style={styles.secondaryButton}>
                Tentar novamente
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
    borderRadius: 24,
    padding: 32,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
  },
  iconWrapSuccess: {
    width: 84,
    height: 84,
    borderRadius: 999,
    background: "#DCFCE7",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  icon: {
    fontSize: 36,
    fontWeight: 900,
    color: "#166534",
  },
  title: {
    fontSize: 32,
    fontWeight: 900,
    color: "#0B3C5D",
  },
  text: {
    marginTop: 12,
    color: "#475569",
    fontSize: 16,
    lineHeight: 1.6,
    maxWidth: 560,
  },
  infoBox: {
    marginTop: 20,
    display: "flex",
    flexDirection: "column",
    gap: 6,
    padding: 12,
    borderRadius: 12,
    background: "#F8FAFC",
    border: "1px solid #E2E8F0",
    minWidth: 220,
  },
  infoLabel: {
    fontSize: 12,
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: 900,
    color: "#0F172A",
    wordBreak: "break-word",
  },
  actions: {
    marginTop: 20,
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  primaryButton: {
    padding: "12px 16px",
    background: "#0B3C5D",
    color: "#fff",
    borderRadius: 8,
    textDecoration: "none",
    fontWeight: 700,
  },
  secondaryButton: {
    padding: "12px 16px",
    background: "#E2E8F0",
    color: "#0F172A",
    borderRadius: 8,
    textDecoration: "none",
    fontWeight: 700,
  },
};