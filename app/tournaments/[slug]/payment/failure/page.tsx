"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";

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

type PageStatus = "checking" | "failed" | "pending" | "approved";

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
        console.error("[Bridge] erro:", error);
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

export default function TournamentPaymentPage({
  params,
  searchParams,
}: Props) {
  const slug = params?.slug ?? "";

  const [registrationId, setRegistrationId] = useState(
    searchParams?.registrationId ?? ""
  );
  const [teamId, setTeamId] = useState(searchParams?.teamId ?? "");
  const [userId, setUserId] = useState(searchParams?.userId ?? "");

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<PageStatus>("checking");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);

    const regId =
      url.searchParams.get("registrationId") ||
      searchParams?.registrationId ||
      "";

    const tId =
      url.searchParams.get("teamId") || searchParams?.teamId || "";

    const uId =
      url.searchParams.get("userId") || searchParams?.userId || "";

    setRegistrationId(regId);
    setTeamId(tId);
    setUserId(uId);

    // 🔥 fluxo capitão
    if (regId) {
      void checkCaptain(regId);
      return;
    }

    // 🔥 fluxo membro
    if (tId && uId) {
      void checkMember(tId, uId);
      return;
    }

    setStatus("failed");
    setLoading(false);
  }, []);

  async function checkCaptain(id: string) {
    try {
      const res = await fetch(
        `/api/tournaments/registration-status?registrationId=${encodeURIComponent(id)}`,
        { cache: "no-store" }
      );

      const data = await res.json();

      handleStatus(data, id);
    } catch (err) {
      console.error(err);
      setStatus("failed");
    } finally {
      setLoading(false);
    }
  }

  async function checkMember(teamId: string, userId: string) {
    try {
      const res = await fetch(
        `/api/tournaments/registration-status?teamId=${teamId}&userId=${userId}`,
        { cache: "no-store" }
      );

      const data = await res.json();

      handleStatus(data, undefined, teamId, userId);
    } catch (err) {
      console.error(err);
      setStatus("failed");
    } finally {
      setLoading(false);
    }
  }

  function handleStatus(
    data: any,
    registrationId?: string,
    teamId?: string,
    userId?: string
  ) {
    const resolvedStatus = String(data?.resolvedStatus || "").toLowerCase();
    const paymentStatus = String(data?.paymentStatus || "").toLowerCase();

    // aprovado → success
    if (resolvedStatus === "approved" || paymentStatus === "approved") {
      if (registrationId) {
        window.location.replace(
          `/tournaments/${slug}/payment/success?registrationId=${registrationId}`
        );
      } else if (teamId && userId) {
        window.location.replace(
          `/tournaments/${slug}/payment/success?teamId=${teamId}&userId=${userId}`
        );
      }
      return;
    }

    // pending
    if (resolvedStatus === "pending" || paymentStatus === "pending") {
      setStatus("pending");
      return;
    }

    // failed
    setStatus("failed");
  }

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <AppSessionBridgeInline />
          <p style={styles.text}>Validando pagamento...</p>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <AppSessionBridgeInline />

        <section style={styles.card}>
          {status === "pending" ? (
            <>
              <h1 style={styles.title}>Pagamento em processamento</h1>
              <p style={styles.text}>
                Seu pagamento ainda está sendo confirmado.
              </p>
            </>
          ) : (
            <>
              <h1 style={styles.title}>Pagamento não concluído</h1>
              <p style={styles.text}>
                Não foi possível concluir o pagamento.
              </p>
            </>
          )}

          <div style={styles.actions}>
            <Link href={`/tournaments/${slug}`} style={styles.primaryButton}>
              Voltar ao torneio
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
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#F8FAFC",
  },
  container: {
    width: "100%",
    maxWidth: 600,
  },
  card: {
    background: "#fff",
    padding: 30,
    borderRadius: 20,
    textAlign: "center",
  },
  title: {
    fontSize: 26,
    fontWeight: 800,
    color: "#0B3C5D",
  },
  text: {
    marginTop: 12,
    color: "#475569",
  },
  actions: {
    marginTop: 20,
  },
  primaryButton: {
    padding: "12px 16px",
    background: "#0B3C5D",
    color: "#fff",
    borderRadius: 8,
    textDecoration: "none",
  },
  bridgeBox: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    background: "#EFF6FF",
    textAlign: "center",
  },
};