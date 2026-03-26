"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";

type Props = {
  params: {
    slug: string;
  };
  searchParams?: {
    registrationId?: string;
    teamId?: string;
    userId?: string;
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
  const [teamId, setTeamId] = useState(searchParams?.teamId ?? "");
  const [userId, setUserId] = useState(searchParams?.userId ?? "");

  const [status, setStatus] = useState<PaymentStatus>("checking");
  const [checking, setChecking] = useState(true);

  const attemptsRef = useRef(0);
  const isCheckingRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);

    const regId =
      url.searchParams.get("registrationId") ||
      searchParams?.registrationId ||
      "";

    const tId = url.searchParams.get("teamId") || searchParams?.teamId || "";

    const uId = url.searchParams.get("userId") || searchParams?.userId || "";

    setRegistrationId(regId);
    setTeamId(tId);
    setUserId(uId);

    if (regId) {
      void checkCaptain(regId);
    } else if (tId && uId) {
      void checkMember(tId, uId);
    } else {
      setStatus("failed");
      setChecking(false);
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      isCheckingRef.current = false;
    };
  }, [searchParams?.registrationId, searchParams?.teamId, searchParams?.userId]);

  async function scheduleRetry(kind: "captain" | "member", a: string, b?: string) {
    if (attemptsRef.current >= 30) {
      setChecking(false);
      setStatus("pending");
      return;
    }

    attemptsRef.current += 1;

    timeoutRef.current = setTimeout(() => {
      isCheckingRef.current = false;

      if (kind === "captain") {
        void checkCaptain(a);
      } else if (b) {
        void checkMember(a, b);
      }
    }, 2000);
  }

  async function checkCaptain(id: string) {
    if (!id || isCheckingRef.current) return;

    isCheckingRef.current = true;
    setChecking(true);

    try {
      const response = await fetch(
        `/api/tournaments/registration-status?registrationId=${encodeURIComponent(id)}`,
        { cache: "no-store" }
      );

      const data = await response.json().catch(() => ({}));
      const result = handleStatus(data, id);

      if (result === "retry") {
        await scheduleRetry("captain", id);
        return;
      }
    } catch (error) {
      console.error("[PendingPage][Captain] erro:", error);
      setStatus("pending");
      await scheduleRetry("captain", id);
      return;
    } finally {
      setChecking(false);
      isCheckingRef.current = false;
    }
  }

  async function checkMember(currentTeamId: string, currentUserId: string) {
    if (!currentTeamId || !currentUserId || isCheckingRef.current) return;

    isCheckingRef.current = true;
    setChecking(true);

    try {
      const response = await fetch(
        `/api/tournaments/registration-status?teamId=${encodeURIComponent(currentTeamId)}&userId=${encodeURIComponent(currentUserId)}`,
        { cache: "no-store" }
      );

      const data = await response.json().catch(() => ({}));
      const result = handleStatus(data, undefined, currentTeamId, currentUserId);

      if (result === "retry") {
        await scheduleRetry("member", currentTeamId, currentUserId);
        return;
      }
    } catch (error) {
      console.error("[PendingPage][Member] erro:", error);
      setStatus("pending");
      await scheduleRetry("member", currentTeamId, currentUserId);
      return;
    } finally {
      setChecking(false);
      isCheckingRef.current = false;
    }
  }

  function handleStatus(
    data: any,
    currentRegistrationId?: string,
    currentTeamId?: string,
    currentUserId?: string
  ): "approved" | "failed" | "retry" {
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

      if (currentRegistrationId) {
        window.location.replace(
          `/tournaments/${slug}/payment/success?registrationId=${encodeURIComponent(
            currentRegistrationId
          )}`
        );
      } else if (currentTeamId && currentUserId) {
        window.location.replace(
          `/tournaments/${slug}/payment/success?teamId=${encodeURIComponent(
            currentTeamId
          )}&userId=${encodeURIComponent(currentUserId)}`
        );
      }

      return "approved";
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
      return "failed";
    }

    setStatus("pending");
    return "retry";
  }

  function handleManualRefresh() {
    attemptsRef.current = 0;

    if (registrationId) {
      void checkCaptain(registrationId);
      return;
    }

    if (teamId && userId) {
      void checkMember(teamId, userId);
    }
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <AppSessionBridgeInline />

        <section style={styles.card}>
          {checking || status === "checking" ? (
            <>
              <h1 style={styles.title}>Validando pagamento</h1>
              <p style={styles.text}>
                Estamos consultando o status mais recente da sua inscrição.
              </p>
            </>
          ) : status === "failed" ? (
            <>
              <h1 style={styles.title}>Pagamento não concluído</h1>
              <p style={styles.text}>
                O pagamento não foi confirmado pelo sistema.
              </p>
            </>
          ) : (
            <>
              <h1 style={styles.title}>Pagamento pendente</h1>
              <p style={styles.text}>
                Seu pagamento foi recebido e ainda está sendo processado. Isso pode
                levar alguns segundos.
              </p>
            </>
          )}

          <div style={styles.actions}>
            <Link href={`/tournaments/${slug}`} style={styles.primaryButton}>
              Voltar ao torneio
            </Link>

            {status === "pending" &&
              (registrationId || (teamId && userId)) && (
                <button
                  type="button"
                  style={styles.secondaryButton}
                  onClick={handleManualRefresh}
                >
                  Atualizar status
                </button>
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
    textAlign: "center",
    color: "#1E40AF",
    fontSize: 14,
    fontWeight: 700,
  },
  card: {
    background: "#FFFFFF",
    borderRadius: 24,
    padding: 32,
    textAlign: "center",
    boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
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
    marginLeft: "auto",
    marginRight: "auto",
  },
  actions: {
    marginTop: 20,
    display: "flex",
    gap: 10,
    justifyContent: "center",
    flexWrap: "wrap",
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
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
    color: "#0F172A",
    fontWeight: 700,
  },
};