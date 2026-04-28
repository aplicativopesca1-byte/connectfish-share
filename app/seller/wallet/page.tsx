"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

type OrganizerWalletTransactionType =
  | "payment_created"
  | "payment_received"
  | "release_to_available"
  | "refund"
  | "chargeback"
  | "payout_sent"
  | "manual_adjustment";

type OrganizerWalletTransactionStatus =
  | "pending"
  | "available"
  | "paid_out"
  | "reversed";

type OrganizerWalletDoc = {
  organizerUserId: string;
  availableAmount: number;
  pendingAmount: number;
  paidOutAmount: number;
  grossAmount: number;
  feeAmount: number;
  netAmount: number;
  refundedAmount: number;
  chargebackAmount: number;
  updatedAt: number | null;
  currency: "BRL";
};

type OrganizerWalletTransaction = {
  id: string;
  organizerUserId: string;
  tournamentId: string | null;
  paymentId: string | null;
  type: OrganizerWalletTransactionType;
  status: OrganizerWalletTransactionStatus;
  grossAmount: number;
  feeAmount: number;
  netAmount: number;
  currency: "BRL";
  externalReference: string | null;
  providerPaymentId: string | null;
  createdAt: number | null;
  releasedAt: number | null;
  paidOutAt: number | null;
  reversedAt: number | null;
  updatedAt: number | null;
};

type WalletTournamentRow = {
  tournamentId: string;
  title: string;
  subtitle: string | null;
  location: string | null;
  status: string | null;
  currency: "BRL";
  grossAmount: number;
  feeAmount: number;
  netAmount: number;
  availableAmount: number;
  pendingAmount: number;
  paidOutAmount: number;
  refundedAmount: number;
  chargebackAmount: number;
  participantsPaidCount: number;
  adminUrl: string | null;
};

type OrganizerPayoutRequest = {
  id: string;
  organizerUserId: string;
  walletId: string | null;
  currency: "BRL";
  requestedAmount: number;
  availableAmountSnapshot: number;
  pendingAmountSnapshot: number;
  paidOutAmountSnapshot: number;
  status: "pending" | "processing" | "paid" | "rejected" | "cancelled";
  payoutMethod: string | null;
  payoutKey: string | null;
  notes: string | null;
  adminNotes: string | null;
  externalReference: string | null;
  processedAmount: number;
  createdAt: number | null;
  updatedAt: number | null;
  processedAt: number | null;
};

type WalletSummary = {
  availableAmount: number;
  pendingAmount: number;
  paidOutAmount: number;
  grossAmount: number;
  feeAmount: number;
  netAmount: number;
  refundedAmount: number;
  chargebackAmount: number;
};

type WalletStats = {
  tournamentsCount: number;
  paymentsCount: number;
  releasesCount: number;
  payoutsCount: number;
};

type OrganizerFinancialStatus = {
  commercialInfo: string | null;
  bankAccountInfo: string | null;
  documentation: string | null;
  general: string | null;
};

type OrganizerPaymentProfile = {
  id: string;
  organizerUserId: string;
  providerAccountId: string | null;
  providerWalletId: string | null;
  providerApiKey: string | null;
  status: "not_started" | "draft" | "pending" | "approved" | "rejected";
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  escrowEnabled: boolean;
  onboardingUrl: string | null;
  asaasStatus: OrganizerFinancialStatus | null;
  rejectionReason: string | null;
};

type TransactionTypeFilter =
  | "all"
  | "payment_received"
  | "refund"
  | "chargeback"
  | "release_to_available"
  | "payout_sent"
  | "manual_adjustment";

type TransactionStatusFilter =
  | "all"
  | "pending"
  | "available"
  | "paid_out"
  | "reversed";

type DashboardResponse = {
  wallet: OrganizerWalletDoc | null;
  transactions: OrganizerWalletTransaction[];
  tournamentRows: WalletTournamentRow[];
  currency: "BRL";
  walletSummary: WalletSummary;
  stats: WalletStats;
};

type PayoutStatusResponse = {
  walletSummary: WalletSummary;
  latestPayoutRequest: OrganizerPayoutRequest | null;
  payoutOpen: boolean;
};

type OnboardingLinkResponse = {
  onboardingUrl: string | null;
  profile: OrganizerPaymentProfile | null;
};

const INITIAL_VISIBLE_TRANSACTIONS = 12;

function safeTrim(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeCurrency(value: unknown) {
  return safeTrim(value).toUpperCase() || "BRL";
}

function normalizeMoney(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Number(parsed.toFixed(2));
}

function normalizeStatus(value: unknown) {
  return safeTrim(value).toUpperCase();
}

function toIsoStringSafe(value: unknown): string | null {
  if (!value) return null;

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate?: () => Date }).toDate === "function"
  ) {
    const date = (value as { toDate?: () => Date }).toDate?.();
    if (!date || Number.isNaN(date.getTime())) return null;
    return date.toISOString();
  }

  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }

  return null;
}

function formatDateTime(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function formatMoney(value: unknown, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: normalizeCurrency(currency),
  }).format(normalizeMoney(value));
}

function getTournamentStatusMeta(status: unknown) {
  const normalized = safeTrim(status).toLowerCase();

  if (normalized === "live") {
    return { label: "Ao vivo", bg: "#DCFCE7", color: "#166534" };
  }

  if (normalized === "finished") {
    return { label: "Finalizado", bg: "#E5E7EB", color: "#374151" };
  }

  if (normalized === "scheduled") {
    return { label: "Agendado", bg: "#FEF3C7", color: "#92400E" };
  }

  return { label: "Rascunho", bg: "#DBEAFE", color: "#1D4ED8" };
}

function getTransactionTypeLabel(type: string) {
  if (type === "payment_received") return "Pagamento recebido";
  if (type === "refund") return "Reembolso";
  if (type === "chargeback") return "Chargeback";
  if (type === "release_to_available") return "Liberação de saldo";
  if (type === "payout_sent") return "Repasse enviado";
  if (type === "manual_adjustment") return "Ajuste manual";
  if (type === "payment_created") return "Pagamento criado";
  return "Movimentação";
}

function getTransactionStatusMeta(status: string) {
  if (status === "available") {
    return { label: "Disponível", bg: "#DCFCE7", color: "#166534" };
  }

  if (status === "paid_out") {
    return { label: "Pago", bg: "#E0F2FE", color: "#075985" };
  }

  if (status === "reversed") {
    return { label: "Revertido", bg: "#FEE2E2", color: "#B91C1C" };
  }

  return { label: "Pendente", bg: "#FEF3C7", color: "#92400E" };
}

function getPayoutStatusMeta(
  status: OrganizerPayoutRequest["status"] | "pending"
) {
  if (status === "paid") {
    return { label: "Pago", bg: "#DCFCE7", color: "#166534" };
  }

  if (status === "processing") {
    return { label: "Em processamento", bg: "#DBEAFE", color: "#1D4ED8" };
  }

  if (status === "rejected") {
    return { label: "Recusado", bg: "#FEE2E2", color: "#B91C1C" };
  }

  if (status === "cancelled") {
    return { label: "Cancelado", bg: "#E5E7EB", color: "#374151" };
  }

  return { label: "Pendente", bg: "#FEF3C7", color: "#92400E" };
}

function getFinancialStatusMeta(profile: OrganizerPaymentProfile | null) {
  const status = safeTrim(profile?.status).toLowerCase();
  const documentation = normalizeStatus(profile?.asaasStatus?.documentation);
  const general = normalizeStatus(profile?.asaasStatus?.general);

  if (!profile || status === "not_started" || status === "draft") {
    return {
      title: "Cadastro financeiro pendente",
      description:
        "Complete seu cadastro financeiro para receber pagamentos dos torneios e solicitar repasses.",
      badge: "Cadastro necessário",
      tone: "warning" as const,
      canOpenDocuments: false,
      showCard: true,
    };
  }

  if (status === "approved" || general === "APPROVED") {
    return {
      title: "Conta financeira aprovada",
      description:
        "Sua conta está liberada para operar. Você já pode acompanhar saldos, retenções e solicitações de repasse.",
      badge: "Aprovada",
      tone: "success" as const,
      canOpenDocuments: false,
      showCard: true,
    };
  }

  if (status === "rejected") {
    return {
      title: "Conta financeira precisa de atenção",
      description:
        profile.rejectionReason ||
        "O parceiro de pagamentos retornou uma pendência. Revise os dados ou envie novamente os documentos solicitados.",
      badge: "Atenção necessária",
      tone: "danger" as const,
      canOpenDocuments: true,
      showCard: true,
    };
  }

  if (!documentation || documentation !== "APPROVED") {
    return {
      title: "Envie seus documentos",
      description:
        "Para liberar pagamentos e repasses, envie os documentos solicitados pelo parceiro financeiro. O envio acontece em uma página segura.",
      badge:
        documentation === "AWAITING_APPROVAL"
          ? "Aguardando análise"
          : documentation === "PENDING"
            ? "Documentos pendentes"
            : "Documentos necessários",
      tone: "danger" as const,
      canOpenDocuments: true,
      showCard: true,
    };
  }

  return {
    title: "Conta financeira em análise",
    description:
      "Seus dados foram enviados e estão em análise pelo parceiro financeiro. Assim que a aprovação for concluída, os repasses serão liberados.",
    badge: "Em análise",
    tone: "warning" as const,
    canOpenDocuments: false,
    showCard: true,
  };
}

async function getAuthToken() {
  const currentUser = auth.currentUser;

  if (!currentUser) {
    throw new Error("Usuário não autenticado.");
  }

  return currentUser.getIdToken(true);
}

async function apiGet<T>(url: string): Promise<T> {
  const token = await getAuthToken();

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  const payload = await response.json();

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message || "Falha na requisição.");
  }

  return (payload.data ?? payload.profile ?? payload) as T;
}

async function apiPost<T>(url: string, body?: Record<string, unknown>): Promise<T> {
  const token = await getAuthToken();

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body ?? {}),
  });

  const payload = await response.json();

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message || "Falha na requisição.");
  }

  return (payload.data ?? payload) as T;
}

export default function SellerWalletPage() {
  const { uid, loading: authLoading } = useAuth() as {
    uid?: string | null;
    loading?: boolean;
  };

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [wallet, setWallet] = useState<OrganizerWalletDoc | null>(null);
  const [transactions, setTransactions] = useState<OrganizerWalletTransaction[]>([]);
  const [tournamentRows, setTournamentRows] = useState<WalletTournamentRow[]>([]);
  const [currency, setCurrency] = useState("BRL");
  const [walletSummary, setWalletSummary] = useState<WalletSummary>({
    availableAmount: 0,
    pendingAmount: 0,
    paidOutAmount: 0,
    grossAmount: 0,
    feeAmount: 0,
    netAmount: 0,
    refundedAmount: 0,
    chargebackAmount: 0,
  });
  const [stats, setStats] = useState<WalletStats>({
    tournamentsCount: 0,
    paymentsCount: 0,
    releasesCount: 0,
    payoutsCount: 0,
  });

  const [financialProfile, setFinancialProfile] =
    useState<OrganizerPaymentProfile | null>(null);
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);
  const [onboardingMessage, setOnboardingMessage] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<TransactionTypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<TransactionStatusFilter>("all");
  const [tournamentFilter, setTournamentFilter] = useState("all");
  const [visibleTransactions, setVisibleTransactions] = useState(
    INITIAL_VISIBLE_TRANSACTIONS
  );

  const [payoutRequest, setPayoutRequest] = useState<OrganizerPayoutRequest | null>(null);
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [payoutMessage, setPayoutMessage] = useState<string | null>(null);
  const [payoutError, setPayoutError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;

    if (!uid) {
      setLoading(false);
      setError("Usuário não identificado.");
      return;
    }

    void loadWallet();
  }, [uid, authLoading]);

  async function loadWallet() {
    try {
      setLoading(true);
      setError(null);
      setOnboardingError(null);
      setOnboardingMessage(null);

      const [dashboard, payoutStatus, profile] = await Promise.all([
        apiGet<DashboardResponse>("/api/finance/organizer/wallet/dashboard"),
        apiGet<PayoutStatusResponse>(
          "/api/finance/organizer/wallet/payout-status"
        ),
        apiGet<OrganizerPaymentProfile | null>(
          `/api/finance/organizer/profile?organizerUserId=${encodeURIComponent(
            uid || ""
          )}`
        ),
      ]);

      setWallet(dashboard.wallet);
      setTransactions(dashboard.transactions);
      setTournamentRows(dashboard.tournamentRows);
      setCurrency(dashboard.currency);
      setWalletSummary(dashboard.walletSummary);
      setStats(dashboard.stats);

      setPayoutRequest(payoutStatus.latestPayoutRequest);
      setPayoutOpen(Boolean(payoutStatus.payoutOpen));
      setFinancialProfile(profile);
    } catch (err) {
      console.error("Erro ao carregar wallet do organizador:", err);
      setError("Não foi possível carregar a carteira do organizador.");
    } finally {
      setLoading(false);
    }
  }

  async function handleOpenOnboarding() {
    if (!uid) return;

    try {
      setOnboardingLoading(true);
      setOnboardingError(null);
      setOnboardingMessage(null);

      const result = await apiPost<OnboardingLinkResponse>(
        "/api/finance/organizer/asaas/onboarding-link",
        {
          organizerUserId: uid,
        }
      );

      if (result.profile) {
        setFinancialProfile(result.profile);
      }

      if (!result.onboardingUrl) {
        setOnboardingError(
          "Não foi possível abrir o envio de documentos agora. Tente novamente em alguns instantes."
        );
        return;
      }

      window.open(result.onboardingUrl, "_blank", "noopener,noreferrer");
      setOnboardingMessage(
        "Abrimos a página segura para envio dos documentos. Depois do envio, a análise pode levar algum tempo."
      );
    } catch (err) {
      console.error("Erro ao abrir onboarding financeiro:", err);
      setOnboardingError(
        err instanceof Error
          ? err.message
          : "Não foi possível abrir o envio de documentos."
      );
    } finally {
      setOnboardingLoading(false);
    }
  }

  async function handleRequestPayout() {
    try {
      setPayoutLoading(true);
      setPayoutMessage(null);
      setPayoutError(null);

      const created = await apiPost<OrganizerPayoutRequest>(
        "/api/finance/organizer/wallet/request-payout"
      );

      setPayoutRequest(created);
      setPayoutOpen(true);
      setPayoutMessage("Pedido de repasse criado com sucesso.");

      await loadWallet();
    } catch (err) {
      console.error("Erro ao solicitar repasse:", err);
      setPayoutError(
        err instanceof Error
          ? err.message
          : "Não foi possível solicitar o repasse."
      );
    } finally {
      setPayoutLoading(false);
    }
  }

  const financialMeta = useMemo(
    () => getFinancialStatusMeta(financialProfile),
    [financialProfile]
  );

  const financialApproved =
    financialProfile?.status === "approved" ||
    normalizeStatus(financialProfile?.asaasStatus?.general) === "APPROVED";

  const tournamentOptions = useMemo(() => {
    return tournamentRows.map((item) => ({
      value: item.tournamentId,
      label: item.title,
    }));
  }, [tournamentRows]);

  const filteredTransactions = useMemo(() => {
    const q = safeTrim(searchTerm).toLowerCase();

    return transactions.filter((transaction) => {
      const normalizedType = safeTrim(transaction.type).toLowerCase();
      const normalizedStatus = safeTrim(transaction.status).toLowerCase();
      const normalizedTournamentId = safeTrim(transaction.tournamentId);
      const matchesType = typeFilter === "all" || normalizedType === typeFilter;
      const matchesStatus =
        statusFilter === "all" || normalizedStatus === statusFilter;
      const matchesTournament =
        tournamentFilter === "all" || normalizedTournamentId === tournamentFilter;

      const haystack = [
        safeTrim(transaction.tournamentId),
        safeTrim(transaction.paymentId),
        safeTrim(transaction.externalReference),
        safeTrim(transaction.providerPaymentId),
        getTransactionTypeLabel(normalizedType),
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = !q || haystack.includes(q);

      return matchesType && matchesStatus && matchesTournament && matchesSearch;
    });
  }, [transactions, typeFilter, statusFilter, tournamentFilter, searchTerm]);

  const visibleTransactionItems = useMemo(() => {
    return filteredTransactions.slice(0, visibleTransactions);
  }, [filteredTransactions, visibleTransactions]);

  const hasMoreTransactions = visibleTransactionItems.length < filteredTransactions.length;

  const payoutStatusLabel = !financialApproved
    ? "Conta financeira pendente"
    : walletSummary.availableAmount > 0
      ? "Saldo pronto para solicitar repasse"
      : walletSummary.pendingAmount > 0
        ? "Aguardando liberação de saldo"
        : "Sem saldo liberado no momento";

  const payoutStatusTone = !financialApproved
    ? styles.payoutBadgeWarning
    : walletSummary.availableAmount > 0
      ? styles.payoutBadgeSuccess
      : walletSummary.pendingAmount > 0
        ? styles.payoutBadgeWarning
        : styles.payoutBadgeNeutral;

  const lastMovementDate = useMemo(() => {
    const first = transactions[0];
    if (!first) return "—";

    const value =
      toIsoStringSafe(first.createdAt) ||
      toIsoStringSafe(first.releasedAt) ||
      toIsoStringSafe(first.paidOutAt) ||
      toIsoStringSafe(first.reversedAt);

    return formatDateTime(value);
  }, [transactions]);

  const payoutMeta = useMemo(() => {
    return getPayoutStatusMeta(payoutRequest?.status || "pending");
  }, [payoutRequest]);

  const payoutCreatedAt = useMemo(() => {
    return formatDateTime(toIsoStringSafe(payoutRequest?.createdAt));
  }, [payoutRequest]);

  function resetFilters() {
    setSearchTerm("");
    setTypeFilter("all");
    setStatusFilter("all");
    setTournamentFilter("all");
    setVisibleTransactions(INITIAL_VISIBLE_TRANSACTIONS);
  }

  useEffect(() => {
    setVisibleTransactions(INITIAL_VISIBLE_TRANSACTIONS);
  }, [searchTerm, typeFilter, statusFilter, tournamentFilter]);

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <section style={styles.heroCard}>
            <h1 style={styles.title}>💼 Carteira do organizador</h1>
            <p style={styles.subtitle}>Carregando saldo e movimentações...</p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <section style={styles.heroCard}>
          <div style={styles.heroTop}>
            <div>
              <h1 style={styles.title}>💼 Carteira do organizador</h1>
              <p style={styles.subtitle}>
                Acompanhe o saldo disponível, valores pendentes, repasses e o
                desempenho financeiro dos seus torneios.
              </p>
            </div>

            <div style={styles.heroActions}>
              <Link href="/seller/tournaments" style={styles.secondaryAction}>
                Ver torneios
              </Link>
            </div>
          </div>

          <div style={styles.summaryGrid}>
            <SummaryCard
              label="Disponível"
              value={formatMoney(walletSummary.availableAmount, currency)}
              tone="emerald"
            />
            <SummaryCard
              label="Pendente"
              value={formatMoney(walletSummary.pendingAmount, currency)}
              tone="amber"
            />
            <SummaryCard
              label="Líquido"
              value={formatMoney(walletSummary.netAmount, currency)}
              tone="green"
            />
            <SummaryCard
              label="Já repassado"
              value={formatMoney(walletSummary.paidOutAmount, currency)}
              tone="blue"
            />
            <SummaryCard
              label="Arrecadado bruto"
              value={formatMoney(walletSummary.grossAmount, currency)}
              tone="slate"
            />
            <SummaryCard
              label="Taxa ConnectFish"
              value={formatMoney(walletSummary.feeAmount, currency)}
              tone="slate"
            />
          </div>

          <div style={styles.statsGrid}>
            <StatCard
              label="Torneios com financeiro"
              value={String(stats.tournamentsCount)}
            />
            <StatCard
              label="Pagamentos aprovados"
              value={String(stats.paymentsCount)}
            />
            <StatCard label="Liberações" value={String(stats.releasesCount)} />
            <StatCard label="Repasses" value={String(stats.payoutsCount)} />
          </div>
        </section>

        {financialMeta.showCard ? (
          <section
            style={{
              ...styles.financialStatusCard,
              ...(financialMeta.tone === "success"
                ? styles.financialStatusSuccess
                : financialMeta.tone === "danger"
                  ? styles.financialStatusDanger
                  : styles.financialStatusWarning),
            }}
          >
            <div style={styles.financialStatusMain}>
              <div style={styles.financialStatusHeader}>
                <h2 style={styles.financialStatusTitle}>
                  {financialMeta.title}
                </h2>
                <span
                  style={{
                    ...styles.financialStatusBadge,
                    ...(financialMeta.tone === "success"
                      ? styles.financialStatusBadgeSuccess
                      : financialMeta.tone === "danger"
                        ? styles.financialStatusBadgeDanger
                        : styles.financialStatusBadgeWarning),
                  }}
                >
                  {financialMeta.badge}
                </span>
              </div>

              <p style={styles.financialStatusText}>
                {financialMeta.description}
              </p>

              <div style={styles.financialStatusGrid}>
                <FinancialStatusMini
                  label="Dados comerciais"
                  value={financialProfile?.asaasStatus?.commercialInfo || "—"}
                />
                <FinancialStatusMini
                  label="Dados bancários"
                  value={financialProfile?.asaasStatus?.bankAccountInfo || "—"}
                />
                <FinancialStatusMini
                  label="Documentos"
                  value={financialProfile?.asaasStatus?.documentation || "—"}
                />
                <FinancialStatusMini
                  label="Status geral"
                  value={financialProfile?.asaasStatus?.general || financialProfile?.status || "—"}
                />
              </div>

              {onboardingMessage ? (
                <div style={styles.successNoticeDark}>{onboardingMessage}</div>
              ) : null}

              {onboardingError ? (
                <div style={styles.errorNoticeDark}>{onboardingError}</div>
              ) : null}
            </div>

            <div style={styles.financialStatusActions}>
              {financialMeta.canOpenDocuments ? (
                <button
                  type="button"
                  style={{
                    ...styles.primaryButton,
                    ...(onboardingLoading ? styles.buttonDisabled : {}),
                  }}
                  onClick={handleOpenOnboarding}
                  disabled={onboardingLoading}
                >
                  {onboardingLoading
                    ? "Abrindo..."
                    : "Enviar documentos"}
                </button>
              ) : null}

              <button
                type="button"
                style={styles.secondaryButton}
                onClick={loadWallet}
              >
                Atualizar status
              </button>
            </div>
          </section>
        ) : null}

        {error ? (
          <section style={styles.errorCard}>
            <h2 style={styles.errorTitle}>Erro na carteira</h2>
            <p style={styles.errorText}>{error}</p>
          </section>
        ) : null}

        {!error && !wallet && tournamentRows.length === 0 ? (
          <section style={styles.emptyCard}>
            <div style={styles.emptyEmoji}>💼</div>
            <h2 style={styles.emptyTitle}>Sua carteira ainda não tem movimentações</h2>
            <p style={styles.emptyText}>
              Assim que os pagamentos dos torneios forem aprovados, seu saldo
              começa a aparecer aqui com total transparência.
            </p>

            <Link href="/seller/tournaments" style={styles.primaryAction}>
              Abrir meus torneios
            </Link>
          </section>
        ) : null}

        {(wallet || tournamentRows.length > 0) && (
          <>
            <section style={styles.payoutCard}>
              <div style={styles.payoutTop}>
                <div style={styles.payoutMain}>
                  <div style={styles.payoutHeaderRow}>
                    <h2 style={styles.sectionTitleLight}>Central de repasses</h2>
                    <span style={{ ...styles.payoutBadge, ...payoutStatusTone }}>
                      {payoutStatusLabel}
                    </span>
                  </div>

                  <p style={styles.sectionSubLight}>
                    Use esta área para acompanhar o saldo que já pode ser repassado
                    e o histórico financeiro mais recente da sua operação.
                  </p>

                  {!financialApproved ? (
                    <div style={styles.payoutRequestBox}>
                      <strong style={styles.payoutRequestTitle}>
                        Repasse bloqueado temporariamente
                      </strong>
                      <p style={styles.payoutRequestText}>
                        Para solicitar repasses, sua conta financeira precisa estar aprovada.
                      </p>
                    </div>
                  ) : null}

                  {payoutRequest ? (
                    <div style={styles.payoutRequestBox}>
                      <div style={styles.payoutRequestTop}>
                        <strong style={styles.payoutRequestTitle}>
                          Último pedido de repasse
                        </strong>
                        <span
                          style={{
                            ...styles.transactionBadge,
                            background: payoutMeta.bg,
                            color: payoutMeta.color,
                          }}
                        >
                          {payoutMeta.label}
                        </span>
                      </div>

                      <p style={styles.payoutRequestText}>
                        Valor:{" "}
                        {formatMoney(
                          payoutRequest.requestedAmount,
                          payoutRequest.currency
                        )}
                      </p>
                      <p style={styles.payoutRequestText}>
                        Criado em: {payoutCreatedAt}
                      </p>
                    </div>
                  ) : null}

                  {payoutMessage ? (
                    <div style={styles.successNotice}>{payoutMessage}</div>
                  ) : null}

                  {payoutError ? (
                    <div style={styles.errorNotice}>{payoutError}</div>
                  ) : null}
                </div>

                <div style={styles.payoutActions}>
                  <button
                    type="button"
                    style={{
                      ...styles.primaryButton,
                      ...(payoutLoading ||
                      payoutOpen ||
                      walletSummary.availableAmount <= 0 ||
                      !financialApproved
                        ? styles.buttonDisabled
                        : {}),
                    }}
                    onClick={handleRequestPayout}
                    disabled={
                      payoutLoading ||
                      payoutOpen ||
                      walletSummary.availableAmount <= 0 ||
                      !financialApproved
                    }
                  >
                    {payoutLoading
                      ? "Solicitando..."
                      : payoutOpen
                        ? "Repasse em andamento"
                        : !financialApproved
                          ? "Conta pendente"
                          : "Solicitar repasse"}
                  </button>

                  <button type="button" style={styles.secondaryButton}>
                    Ver histórico completo
                  </button>
                </div>
              </div>

              <div style={styles.payoutGrid}>
                <PayoutMetric
                  label="Disponível para repasse"
                  value={formatMoney(walletSummary.availableAmount, currency)}
                  accent="emerald"
                />
                <PayoutMetric
                  label="Em retenção"
                  value={formatMoney(walletSummary.pendingAmount, currency)}
                  accent="amber"
                />
                <PayoutMetric
                  label="Última movimentação"
                  value={lastMovementDate}
                />
                <PayoutMetric
                  label="Status operacional"
                  value={
                    !financialApproved
                      ? "Conta financeira pendente"
                      : payoutOpen
                        ? "Pedido em andamento"
                        : walletSummary.availableAmount > 0
                          ? "Pronto para saque"
                          : walletSummary.pendingAmount > 0
                            ? "Aguardando janela"
                            : "Sem valores liberados"
                  }
                />
              </div>
            </section>

            <div style={styles.mainGrid}>
              <section style={styles.card}>
                <div style={styles.sectionHeader}>
                  <h2 style={styles.sectionTitle}>Resumo financeiro</h2>
                  <p style={styles.sectionSub}>
                    Visão consolidada da sua operação financeira.
                  </p>
                </div>

                <div style={styles.metricsGrid}>
                  <MetricCard
                    label="Saldo disponível para repasse"
                    value={formatMoney(walletSummary.availableAmount, currency)}
                    accent="emerald"
                  />
                  <MetricCard
                    label="Saldo em retenção"
                    value={formatMoney(walletSummary.pendingAmount, currency)}
                    accent="amber"
                  />
                  <MetricCard
                    label="Reembolsos"
                    value={formatMoney(walletSummary.refundedAmount, currency)}
                  />
                  <MetricCard
                    label="Chargeback"
                    value={formatMoney(walletSummary.chargebackAmount, currency)}
                  />
                </div>

                <div style={styles.infoPills}>
                  <div style={styles.infoPill}>
                    💳 Liquidação ligada aos pagamentos aprovados dos torneios
                  </div>
                  <div style={styles.infoPill}>
                    🧾 Taxa da plataforma já refletida no saldo líquido
                  </div>
                  <div style={styles.infoPill}>
                    🔐 Valores pendentes aguardam regra de liberação
                  </div>
                </div>
              </section>

              <section style={styles.card}>
                <div style={styles.sectionHeader}>
                  <h2 style={styles.sectionTitle}>Extrato filtrável</h2>
                  <p style={styles.sectionSub}>
                    Filtre suas movimentações por tipo, status, torneio ou busca.
                  </p>
                </div>

                <div style={styles.filtersCard}>
                  <div style={styles.filtersGrid}>
                    <div style={styles.field}>
                      <label style={styles.fieldLabel}>Buscar</label>
                      <input
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Torneio, payment ID, referência..."
                        style={styles.input}
                      />
                    </div>

                    <div style={styles.field}>
                      <label style={styles.fieldLabel}>Tipo</label>
                      <select
                        value={typeFilter}
                        onChange={(e) =>
                          setTypeFilter(e.target.value as TransactionTypeFilter)
                        }
                        style={styles.select}
                      >
                        <option value="all">Todos</option>
                        <option value="payment_received">Pagamento recebido</option>
                        <option value="refund">Reembolso</option>
                        <option value="chargeback">Chargeback</option>
                        <option value="release_to_available">Liberação</option>
                        <option value="payout_sent">Repasse enviado</option>
                        <option value="manual_adjustment">Ajuste manual</option>
                      </select>
                    </div>

                    <div style={styles.field}>
                      <label style={styles.fieldLabel}>Status</label>
                      <select
                        value={statusFilter}
                        onChange={(e) =>
                          setStatusFilter(e.target.value as TransactionStatusFilter)
                        }
                        style={styles.select}
                      >
                        <option value="all">Todos</option>
                        <option value="pending">Pendente</option>
                        <option value="available">Disponível</option>
                        <option value="paid_out">Pago</option>
                        <option value="reversed">Revertido</option>
                      </select>
                    </div>

                    <div style={styles.field}>
                      <label style={styles.fieldLabel}>Torneio</label>
                      <select
                        value={tournamentFilter}
                        onChange={(e) => setTournamentFilter(e.target.value)}
                        style={styles.select}
                      >
                        <option value="all">Todos</option>
                        {tournamentOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div style={styles.filterFooter}>
                    <p style={styles.filterResultText}>
                      {filteredTransactions.length} movimentação(ões) encontrada(s)
                    </p>

                    <button
                      type="button"
                      style={styles.clearButton}
                      onClick={resetFilters}
                    >
                      Limpar filtros
                    </button>
                  </div>
                </div>

                {visibleTransactionItems.length === 0 ? (
                  <p style={styles.muted}>
                    Nenhuma movimentação encontrada com os filtros atuais.
                  </p>
                ) : (
                  <>
                    <div style={styles.transactionList}>
                      {visibleTransactionItems.map((transaction) => {
                        const statusMeta = getTransactionStatusMeta(
                          safeTrim(transaction.status).toLowerCase()
                        );

                        const txDate =
                          toIsoStringSafe(transaction.createdAt) ||
                          toIsoStringSafe(transaction.releasedAt) ||
                          toIsoStringSafe(transaction.paidOutAt) ||
                          toIsoStringSafe(transaction.reversedAt);

                        return (
                          <div key={transaction.id} style={styles.transactionRow}>
                            <div style={styles.transactionMain}>
                              <div style={styles.transactionTop}>
                                <strong style={styles.transactionTitle}>
                                  {getTransactionTypeLabel(
                                    safeTrim(transaction.type).toLowerCase()
                                  )}
                                </strong>

                                <span
                                  style={{
                                    ...styles.transactionBadge,
                                    background: statusMeta.bg,
                                    color: statusMeta.color,
                                  }}
                                >
                                  {statusMeta.label}
                                </span>
                              </div>

                              <p style={styles.transactionMeta}>
                                Torneio: {safeTrim(transaction.tournamentId) || "—"} •{" "}
                                {formatDateTime(txDate)}
                              </p>

                              <p style={styles.transactionMeta}>
                                Payment ID: {safeTrim(transaction.paymentId) || "—"}
                              </p>

                              {safeTrim(transaction.externalReference) ? (
                                <p style={styles.transactionMeta}>
                                  Referência: {safeTrim(transaction.externalReference)}
                                </p>
                              ) : null}
                            </div>

                            <div style={styles.transactionAmounts}>
                              <span style={styles.transactionAmountLabel}>Líquido</span>
                              <strong style={styles.transactionAmountValue}>
                                {formatMoney(
                                  transaction.netAmount,
                                  transaction.currency || currency
                                )}
                              </strong>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {hasMoreTransactions ? (
                      <div style={styles.loadMoreWrap}>
                        <button
                          type="button"
                          style={styles.secondaryButton}
                          onClick={() =>
                            setVisibleTransactions((current) => current + 12)
                          }
                        >
                          Ver mais movimentações
                        </button>
                      </div>
                    ) : null}
                  </>
                )}
              </section>
            </div>
          </>
        )}

        {tournamentRows.length > 0 ? (
          <section style={styles.card}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>Financeiro por torneio</h2>
              <p style={styles.sectionSub}>
                Compare arrecadação, saldo e pagamentos entre seus torneios.
              </p>
            </div>

            <div style={styles.tournamentList}>
              {tournamentRows.map((tournament) => {
                const statusMeta = getTournamentStatusMeta(tournament.status);

                return (
                  <article key={tournament.tournamentId} style={styles.tournamentRow}>
                    <div style={styles.tournamentMain}>
                      <div style={styles.tournamentTop}>
                        <div>
                          <h3 style={styles.tournamentTitle}>{tournament.title}</h3>
                          {tournament.subtitle ? (
                            <p style={styles.tournamentSubtitle}>{tournament.subtitle}</p>
                          ) : null}
                          <p style={styles.tournamentMeta}>📍 {tournament.location}</p>
                        </div>

                        <span
                          style={{
                            ...styles.statusBadge,
                            background: statusMeta.bg,
                            color: statusMeta.color,
                          }}
                        >
                          {statusMeta.label}
                        </span>
                      </div>

                      <div style={styles.tournamentMetricsGrid}>
                        <MiniMetric
                          label="Arrecadado"
                          value={formatMoney(tournament.grossAmount, tournament.currency)}
                        />
                        <MiniMetric
                          label="Líquido"
                          value={formatMoney(tournament.netAmount, tournament.currency)}
                        />
                        <MiniMetric
                          label="Disponível"
                          value={formatMoney(
                            tournament.availableAmount,
                            tournament.currency
                          )}
                          accent="emerald"
                        />
                        <MiniMetric
                          label="Pendente"
                          value={formatMoney(
                            tournament.pendingAmount,
                            tournament.currency
                          )}
                          accent="amber"
                        />
                        <MiniMetric
                          label="Repassado"
                          value={formatMoney(
                            tournament.paidOutAmount,
                            tournament.currency
                          )}
                        />
                        <MiniMetric
                          label="Pagos"
                          value={String(tournament.participantsPaidCount)}
                        />
                      </div>
                    </div>

                    <div style={styles.tournamentActions}>
                      <Link
                        href={
                          tournament.adminUrl ||
                          `/seller/tournaments/${tournament.tournamentId}`
                        }
                        style={styles.primaryAction}
                      >
                        Abrir painel
                      </Link>

                      <Link
                        href={`/seller/tournaments/${tournament.tournamentId}/registrations`}
                        style={styles.secondaryAction}
                      >
                        Inscrições
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function FinancialStatusMini({ label, value }: { label: string; value: string }) {
  const normalized = normalizeStatus(value);
  const isApproved = normalized === "APPROVED";
  const isRejected = normalized === "REJECTED";

  return (
    <div style={styles.financialMiniCard}>
      <p style={styles.financialMiniLabel}>{label}</p>
      <p
        style={{
          ...styles.financialMiniValue,
          color: isApproved ? "#BBF7D0" : isRejected ? "#FECACA" : "#FDE68A",
        }}
      >
        {value || "—"}
      </p>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "emerald" | "amber" | "green" | "blue" | "slate";
}) {
  const toneStyle =
    tone === "emerald"
      ? styles.summaryToneEmerald
      : tone === "amber"
        ? styles.summaryToneAmber
        : tone === "green"
          ? styles.summaryToneGreen
          : tone === "blue"
            ? styles.summaryToneBlue
            : styles.summaryToneSlate;

  return (
    <div style={{ ...styles.summaryCard, ...toneStyle }}>
      <p style={styles.summaryLabel}>{label}</p>
      <p style={styles.summaryValue}>{value}</p>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.statCard}>
      <p style={styles.statLabel}>{label}</p>
      <p style={styles.statValue}>{value}</p>
    </div>
  );
}

function MetricCard({
  label,
  value,
  accent = "default",
}: {
  label: string;
  value: string;
  accent?: "default" | "emerald" | "amber";
}) {
  const accentStyle =
    accent === "emerald"
      ? styles.metricValueEmerald
      : accent === "amber"
        ? styles.metricValueAmber
        : styles.metricValueDefault;

  return (
    <div style={styles.metricCard}>
      <p style={styles.metricLabel}>{label}</p>
      <p style={{ ...styles.metricValue, ...accentStyle }}>{value}</p>
    </div>
  );
}

function MiniMetric({
  label,
  value,
  accent = "default",
}: {
  label: string;
  value: string;
  accent?: "default" | "emerald" | "amber";
}) {
  const accentStyle =
    accent === "emerald"
      ? styles.miniMetricValueEmerald
      : accent === "amber"
        ? styles.miniMetricValueAmber
        : styles.miniMetricValueDefault;

  return (
    <div style={styles.miniMetricCard}>
      <p style={styles.miniMetricLabel}>{label}</p>
      <p style={{ ...styles.miniMetricValue, ...accentStyle }}>{value}</p>
    </div>
  );
}

function PayoutMetric({
  label,
  value,
  accent = "default",
}: {
  label: string;
  value: string;
  accent?: "default" | "emerald" | "amber";
}) {
  const accentStyle =
    accent === "emerald"
      ? styles.payoutMetricValueEmerald
      : accent === "amber"
        ? styles.payoutMetricValueAmber
        : styles.payoutMetricValueDefault;

  return (
    <div style={styles.payoutMetricCard}>
      <p style={styles.payoutMetricLabel}>{label}</p>
      <p style={{ ...styles.payoutMetricValue, ...accentStyle }}>{value}</p>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    width: "100%",
    maxWidth: "100%",
    background:
      "radial-gradient(circle at top left, rgba(0,191,223,0.12), transparent 34%), linear-gradient(180deg, #F8FAFC 0%, #EEF7FA 100%)",
    padding: "clamp(12px, 3vw, 24px)",
    overflowX: "hidden",
  },

  container: {
    width: "100%",
    maxWidth: 1320,
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: 16,
    overflowX: "hidden",
  },

  heroCard: {
    position: "relative",
    overflow: "hidden",
    background:
      "linear-gradient(135deg, #0B3C5D 0%, #075E73 48%, #00BFDF 100%)",
    border: "1px solid rgba(255,255,255,0.20)",
    borderRadius: 28,
    padding: "clamp(18px, 4vw, 30px)",
    boxShadow: "0 22px 55px rgba(11,60,93,0.22)",
  },

  heroTop: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
    position: "relative",
    zIndex: 1,
  },

  heroActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
  },

  title: {
    margin: 0,
    fontSize: "clamp(24px, 5vw, 38px)",
    lineHeight: 1.05,
    fontWeight: 1000,
    color: "#FFFFFF",
    letterSpacing: -0.7,
    maxWidth: 760,
  },

  subtitle: {
    margin: "12px 0 0 0",
    maxWidth: 780,
    fontSize: "clamp(13px, 2.8vw, 15px)",
    lineHeight: 1.75,
    fontWeight: 750,
    color: "rgba(255,255,255,0.82)",
  },

  summaryGrid: {
    marginTop: 22,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(170px, 100%), 1fr))",
    gap: 12,
    position: "relative",
    zIndex: 1,
  },

  summaryCard: {
    borderRadius: 20,
    padding: "16px 14px",
    border: "1px solid rgba(255,255,255,0.18)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10)",
    minWidth: 0,
  },

  summaryToneEmerald: {
    background: "rgba(94,252,161,0.16)",
    borderColor: "rgba(94,252,161,0.34)",
  },

  summaryToneAmber: {
    background: "rgba(251,191,36,0.16)",
    borderColor: "rgba(253,230,138,0.34)",
  },

  summaryToneGreen: {
    background: "rgba(46,139,87,0.22)",
    borderColor: "rgba(94,252,161,0.26)",
  },

  summaryToneBlue: {
    background: "rgba(0,191,223,0.18)",
    borderColor: "rgba(125,211,252,0.30)",
  },

  summaryToneSlate: {
    background: "rgba(255,255,255,0.10)",
    borderColor: "rgba(255,255,255,0.18)",
  },

  summaryLabel: {
    margin: 0,
    fontSize: 12,
    fontWeight: 900,
    color: "rgba(255,255,255,0.76)",
  },

  summaryValue: {
    margin: "8px 0 0 0",
    fontSize: "clamp(18px, 4vw, 25px)",
    lineHeight: 1.1,
    fontWeight: 1000,
    color: "#FFFFFF",
    wordBreak: "break-word",
  },

  statsGrid: {
    marginTop: 14,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(145px, 100%), 1fr))",
    gap: 12,
    position: "relative",
    zIndex: 1,
  },

  statCard: {
    background: "rgba(255,255,255,0.92)",
    border: "1px solid rgba(15,23,42,0.07)",
    borderRadius: 18,
    padding: 14,
    boxShadow: "0 10px 25px rgba(15,23,42,0.05)",
    minWidth: 0,
  },

  statLabel: {
    margin: 0,
    fontSize: 12,
    fontWeight: 850,
    color: "#64748B",
  },

  statValue: {
    margin: "7px 0 0 0",
    fontSize: 22,
    fontWeight: 1000,
    color: "#0B3C5D",
  },

  financialStatusCard: {
    borderRadius: 28,
    padding: "clamp(18px, 4vw, 24px)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 18,
    flexWrap: "wrap",
    boxShadow: "0 18px 40px rgba(15,23,42,0.10)",
    border: "1px solid rgba(255,255,255,0.24)",
    overflow: "hidden",
  },

  financialStatusSuccess: {
    background:
      "linear-gradient(135deg, rgba(6,95,70,1) 0%, rgba(4,120,87,1) 52%, rgba(16,185,129,0.92) 100%)",
  },

  financialStatusWarning: {
    background:
      "linear-gradient(135deg, rgba(120,53,15,1) 0%, rgba(180,83,9,1) 52%, rgba(245,158,11,0.92) 100%)",
  },

  financialStatusDanger: {
    background:
      "linear-gradient(135deg, rgba(127,29,29,1) 0%, rgba(185,28,28,1) 52%, rgba(239,68,68,0.92) 100%)",
  },

  financialStatusMain: {
    flex: "1 1 560px",
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },

  financialStatusHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },

  financialStatusTitle: {
    margin: 0,
    fontSize: "clamp(20px, 4vw, 27px)",
    lineHeight: 1.1,
    fontWeight: 1000,
    color: "#FFFFFF",
  },

  financialStatusBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    padding: "7px 11px",
    fontSize: 11,
    fontWeight: 1000,
    border: "1px solid rgba(255,255,255,0.28)",
  },

  financialStatusBadgeSuccess: {
    background: "rgba(220,252,231,0.18)",
    color: "#DCFCE7",
  },

  financialStatusBadgeWarning: {
    background: "rgba(254,243,199,0.18)",
    color: "#FEF3C7",
  },

  financialStatusBadgeDanger: {
    background: "rgba(254,226,226,0.18)",
    color: "#FEE2E2",
  },

  financialStatusText: {
    margin: 0,
    maxWidth: 820,
    fontSize: 13,
    lineHeight: 1.7,
    fontWeight: 750,
    color: "rgba(255,255,255,0.86)",
  },

  financialStatusActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
  },

  financialStatusGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(150px, 100%), 1fr))",
    gap: 10,
  },

  financialMiniCard: {
    background: "rgba(255,255,255,0.10)",
    border: "1px solid rgba(255,255,255,0.16)",
    borderRadius: 16,
    padding: 12,
    minWidth: 0,
  },

  financialMiniLabel: {
    margin: 0,
    color: "rgba(255,255,255,0.72)",
    fontSize: 11,
    fontWeight: 850,
  },

  financialMiniValue: {
    margin: "6px 0 0 0",
    fontSize: 13,
    fontWeight: 1000,
    wordBreak: "break-word",
  },

  payoutCard: {
    background:
      "linear-gradient(135deg, rgba(15,23,42,1) 0%, rgba(11,60,93,1) 54%, rgba(0,191,223,0.92) 100%)",
    borderRadius: 28,
    padding: "clamp(18px, 4vw, 26px)",
    color: "#FFFFFF",
    boxShadow: "0 18px 45px rgba(11,60,93,0.18)",
    border: "1px solid rgba(255,255,255,0.16)",
    overflow: "hidden",
  },

  payoutTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 18,
    flexWrap: "wrap",
  },

  payoutMain: {
    display: "flex",
    flexDirection: "column",
    gap: 9,
    flex: 1,
    minWidth: 0,
  },

  payoutHeaderRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },

  payoutActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
    minWidth: 0,
  },

  payoutBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    padding: "7px 11px",
    fontSize: 11,
    fontWeight: 1000,
    whiteSpace: "normal",
    textAlign: "center",
  },

  payoutBadgeSuccess: {
    background: "rgba(94,252,161,0.20)",
    color: "#D8FFE9",
    border: "1px solid rgba(94,252,161,0.30)",
  },

  payoutBadgeWarning: {
    background: "rgba(253,230,138,0.18)",
    color: "#FEF3C7",
    border: "1px solid rgba(253,230,138,0.28)",
  },

  payoutBadgeNeutral: {
    background: "rgba(226,232,240,0.18)",
    color: "#F8FAFC",
    border: "1px solid rgba(226,232,240,0.20)",
  },

  payoutGrid: {
    marginTop: 18,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(190px, 100%), 1fr))",
    gap: 12,
  },

  payoutMetricCard: {
    background: "rgba(255,255,255,0.10)",
    border: "1px solid rgba(255,255,255,0.14)",
    borderRadius: 20,
    padding: 15,
    backdropFilter: "blur(8px)",
    minWidth: 0,
  },

  payoutMetricLabel: {
    margin: 0,
    fontSize: 12,
    fontWeight: 850,
    color: "rgba(255,255,255,0.76)",
  },

  payoutMetricValue: {
    margin: "9px 0 0 0",
    fontSize: "clamp(17px, 4vw, 22px)",
    lineHeight: 1.18,
    fontWeight: 1000,
    wordBreak: "break-word",
  },

  payoutMetricValueDefault: { color: "#FFFFFF" },
  payoutMetricValueEmerald: { color: "#BBF7D0" },
  payoutMetricValueAmber: { color: "#FDE68A" },

  payoutRequestBox: {
    marginTop: 10,
    background: "rgba(255,255,255,0.10)",
    border: "1px solid rgba(255,255,255,0.14)",
    borderRadius: 18,
    padding: 14,
  },

  payoutRequestTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    marginBottom: 8,
  },

  payoutRequestTitle: {
    fontSize: 14,
    fontWeight: 1000,
    color: "#FFFFFF",
  },

  payoutRequestText: {
    margin: "4px 0 0 0",
    fontSize: 13,
    lineHeight: 1.6,
    fontWeight: 750,
    color: "rgba(255,255,255,0.86)",
  },

  sectionTitleLight: {
    margin: 0,
    fontSize: "clamp(20px, 4vw, 26px)",
    lineHeight: 1.12,
    fontWeight: 1000,
    color: "#FFFFFF",
  },

  sectionSubLight: {
    margin: 0,
    color: "rgba(255,255,255,0.82)",
    fontSize: 13,
    lineHeight: 1.65,
    fontWeight: 750,
    maxWidth: 760,
  },

  mainGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(330px, 100%), 1fr))",
    gap: 16,
    minWidth: 0,
  },

  card: {
    background: "rgba(255,255,255,0.96)",
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 24,
    padding: "clamp(16px, 3vw, 20px)",
    boxShadow: "0 14px 32px rgba(15,23,42,0.06)",
    display: "flex",
    flexDirection: "column",
    gap: 16,
    minWidth: 0,
    overflow: "hidden",
  },

  sectionHeader: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    marginBottom: 4,
  },

  sectionTitle: {
    margin: 0,
    fontSize: "clamp(18px, 4vw, 22px)",
    lineHeight: 1.18,
    fontWeight: 1000,
    color: "#0F172A",
  },

  sectionSub: {
    margin: 0,
    color: "#64748B",
    fontSize: 13,
    lineHeight: 1.6,
    fontWeight: 750,
  },

  metricsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(165px, 100%), 1fr))",
    gap: 12,
  },

  metricCard: {
    background: "linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)",
    border: "1px solid rgba(15,23,42,0.07)",
    borderRadius: 18,
    padding: 14,
    minWidth: 0,
  },

  metricLabel: {
    margin: 0,
    fontSize: 12,
    fontWeight: 850,
    color: "#64748B",
  },

  metricValue: {
    margin: "8px 0 0 0",
    fontSize: "clamp(17px, 4vw, 21px)",
    lineHeight: 1.18,
    fontWeight: 1000,
    wordBreak: "break-word",
  },

  metricValueDefault: { color: "#0F172A" },
  metricValueEmerald: { color: "#047857" },
  metricValueAmber: { color: "#B45309" },

  infoPills: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },

  infoPill: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "10px 12px",
    background: "rgba(0,191,223,0.08)",
    border: "1px solid rgba(0,191,223,0.16)",
    color: "#0B3C5D",
    fontSize: 12,
    lineHeight: 1.35,
    fontWeight: 900,
    maxWidth: "100%",
  },

  filtersCard: {
    background: "#F8FAFC",
    border: "1px solid rgba(15,23,42,0.07)",
    borderRadius: 20,
    padding: 14,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    minWidth: 0,
  },

  filtersGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(170px, 100%), 1fr))",
    gap: 12,
  },

  field: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    minWidth: 0,
  },

  fieldLabel: {
    fontSize: 12,
    fontWeight: 850,
    color: "#475569",
  },

  input: {
    width: "100%",
    maxWidth: "100%",
    borderRadius: 14,
    border: "1px solid rgba(15,23,42,0.12)",
    background: "#FFFFFF",
    padding: "12px 14px",
    fontSize: 14,
    color: "#0F172A",
    outline: "none",
  },

  select: {
    width: "100%",
    maxWidth: "100%",
    borderRadius: 14,
    border: "1px solid rgba(15,23,42,0.12)",
    background: "#FFFFFF",
    padding: "12px 14px",
    fontSize: 14,
    color: "#0F172A",
    outline: "none",
  },

  filterFooter: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },

  filterResultText: {
    margin: 0,
    fontSize: 13,
    fontWeight: 850,
    color: "#64748B",
  },

  clearButton: {
    border: "1px solid rgba(15,23,42,0.1)",
    background: "#FFFFFF",
    color: "#0F172A",
    borderRadius: 14,
    padding: "10px 12px",
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
  },

  transactionList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    minWidth: 0,
  },

  transactionRow: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderRadius: 18,
    background: "linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)",
    border: "1px solid rgba(15,23,42,0.07)",
    minWidth: 0,
  },

  transactionMain: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    minWidth: 0,
    flex: "1 1 230px",
  },

  transactionTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
  },

  transactionTitle: {
    fontSize: 14,
    fontWeight: 1000,
    color: "#0F172A",
  },

  transactionBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 1000,
    whiteSpace: "nowrap",
  },

  transactionMeta: {
    margin: 0,
    fontSize: 12,
    lineHeight: 1.6,
    fontWeight: 750,
    color: "#64748B",
    wordBreak: "break-word",
    overflowWrap: "anywhere",
  },

  transactionAmounts: {
    minWidth: 0,
    flex: "0 1 140px",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 4,
  },

  transactionAmountLabel: {
    fontSize: 12,
    fontWeight: 850,
    color: "#64748B",
  },

  transactionAmountValue: {
    fontSize: 15,
    fontWeight: 1000,
    color: "#0B3C5D",
    wordBreak: "break-word",
  },

  loadMoreWrap: {
    display: "flex",
    justifyContent: "center",
    paddingTop: 4,
  },

  tournamentList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    minWidth: 0,
  },

  tournamentRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    padding: "clamp(14px, 3vw, 18px)",
    borderRadius: 20,
    background: "linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)",
    border: "1px solid rgba(15,23,42,0.07)",
    flexWrap: "wrap",
    minWidth: 0,
  },

  tournamentMain: {
    flex: "1 1 320px",
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },

  tournamentTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap",
  },

  tournamentTitle: {
    margin: 0,
    fontSize: 17,
    lineHeight: 1.25,
    fontWeight: 1000,
    color: "#0F172A",
    overflowWrap: "anywhere",
  },

  tournamentSubtitle: {
    margin: "4px 0 0 0",
    fontSize: 12,
    fontWeight: 750,
    color: "#64748B",
  },

  tournamentMeta: {
    margin: "6px 0 0 0",
    fontSize: 13,
    fontWeight: 850,
    color: "#475569",
    overflowWrap: "anywhere",
  },

  tournamentMetricsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(132px, 100%), 1fr))",
    gap: 10,
  },

  miniMetricCard: {
    background: "#FFFFFF",
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 16,
    padding: 12,
    minWidth: 0,
  },

  miniMetricLabel: {
    margin: 0,
    fontSize: 12,
    fontWeight: 850,
    color: "#64748B",
  },

  miniMetricValue: {
    margin: "8px 0 0 0",
    fontSize: 15,
    lineHeight: 1.2,
    fontWeight: 1000,
    wordBreak: "break-word",
  },

  miniMetricValueDefault: { color: "#0F172A" },
  miniMetricValueEmerald: { color: "#047857" },
  miniMetricValueAmber: { color: "#B45309" },

  tournamentActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
    minWidth: 0,
  },

  statusBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "7px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 1000,
    whiteSpace: "nowrap",
  },

  emptyCard: {
    background: "#FFFFFF",
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 26,
    padding: "clamp(22px, 5vw, 34px)",
    textAlign: "center",
    boxShadow: "0 14px 32px rgba(15,23,42,0.06)",
  },

  emptyEmoji: {
    fontSize: 42,
  },

  emptyTitle: {
    margin: "14px 0 0 0",
    fontSize: "clamp(20px, 5vw, 24px)",
    fontWeight: 1000,
    color: "#0F172A",
  },

  emptyText: {
    margin: "10px auto 18px auto",
    maxWidth: 620,
    fontSize: 14,
    lineHeight: 1.7,
    fontWeight: 750,
    color: "#64748B",
  },

  primaryAction: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    textDecoration: "none",
    padding: "12px 16px",
    borderRadius: 15,
    background: "linear-gradient(135deg, #0B3C5D 0%, #00BFDF 100%)",
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: 950,
    whiteSpace: "nowrap",
    boxShadow: "0 12px 24px rgba(11,60,93,0.16)",
  },

  secondaryAction: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    textDecoration: "none",
    padding: "12px 16px",
    borderRadius: 15,
    background: "rgba(255,255,255,0.92)",
    color: "#0B3C5D",
    border: "1px solid rgba(255,255,255,0.42)",
    fontSize: 14,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },

  primaryButton: {
    border: "none",
    borderRadius: 15,
    padding: "12px 16px",
    background: "#FFFFFF",
    color: "#0B3C5D",
    fontSize: 14,
    fontWeight: 950,
    cursor: "pointer",
    whiteSpace: "nowrap",
    boxShadow: "0 12px 28px rgba(15,23,42,0.14)",
  },

  secondaryButton: {
    border: "1px solid rgba(15,23,42,0.10)",
    borderRadius: 15,
    padding: "12px 16px",
    background: "#FFFFFF",
    color: "#0F172A",
    fontSize: 14,
    fontWeight: 950,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  buttonDisabled: {
    opacity: 0.6,
    cursor: "not-allowed",
  },

  successNotice: {
    marginTop: 10,
    borderRadius: 14,
    padding: "10px 12px",
    background: "rgba(34,197,94,0.18)",
    border: "1px solid rgba(187,247,208,0.45)",
    color: "#DCFCE7",
    fontSize: 13,
    fontWeight: 850,
  },

  errorNotice: {
    marginTop: 10,
    borderRadius: 14,
    padding: "10px 12px",
    background: "rgba(239,68,68,0.18)",
    border: "1px solid rgba(254,202,202,0.45)",
    color: "#FEE2E2",
    fontSize: 13,
    fontWeight: 850,
  },

  successNoticeDark: {
    borderRadius: 14,
    padding: "10px 12px",
    background: "rgba(34,197,94,0.18)",
    border: "1px solid rgba(187,247,208,0.35)",
    color: "#DCFCE7",
    fontSize: 13,
    fontWeight: 850,
  },

  errorNoticeDark: {
    borderRadius: 14,
    padding: "10px 12px",
    background: "rgba(127,29,29,0.28)",
    border: "1px solid rgba(254,202,202,0.35)",
    color: "#FEE2E2",
    fontSize: 13,
    fontWeight: 850,
  },

  errorCard: {
    background: "#FFFFFF",
    border: "1px solid rgba(239,68,68,0.18)",
    borderRadius: 24,
    padding: 22,
    boxShadow: "0 12px 26px rgba(15,23,42,0.04)",
  },

  errorTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 1000,
    color: "#991B1B",
  },

  errorText: {
    margin: "8px 0 0 0",
    fontSize: 14,
    lineHeight: 1.6,
    fontWeight: 750,
    color: "#7F1D1D",
  },

  muted: {
    margin: 0,
    color: "#64748B",
    fontSize: 14,
    fontWeight: 750,
    lineHeight: 1.6,
  },
};