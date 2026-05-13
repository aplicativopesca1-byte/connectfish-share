"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

type SourceFilter = "all" | "reservation" | "tournament" | "payout" | "refund";

type TransactionType =
  | "payment_created"
  | "payment_received"
  | "release_to_available"
  | "refund"
  | "chargeback"
  | "payout_sent"
  | "manual_adjustment";

type TransactionStatus = "pending" | "available" | "paid_out" | "reversed";

type SourceType = "tournament" | "reservation" | "payout" | "refund" | "manual";

type WalletTransaction = {
  id: string;
  organizerUserId: string;
  ownerId?: string;
  sourceType?: SourceType;
  sourceId?: string | null;
  tournamentId: string | null;
  reservationId?: string | null;
  pesqueiroId?: string | null;
  paymentId: string | null;
  title?: string | null;
  subtitle?: string | null;
  type: TransactionType;
  status: TransactionStatus;
  grossAmount: number;
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

type WalletSummary = {
  availableAmount: number;
  pendingAmount: number;
  paidOutAmount: number;
  grossAmount: number;
  netAmount: number;
  refundedAmount: number;
  chargebackAmount: number;
  reservationsAmount?: number;
  tournamentsAmount?: number;
  totalTransactions?: number;
};

type WalletStats = {
  tournamentsCount: number;
  reservationsCount?: number;
  paymentsCount: number;
  releasesCount: number;
  payoutsCount: number;
  refundsCount?: number;
};

type WalletTournamentRow = {
  tournamentId: string;
  title: string;
  subtitle: string | null;
  location: string | null;
  status: string | null;
  currency: "BRL";
  grossAmount: number;
  netAmount: number;
  availableAmount: number;
  pendingAmount: number;
  paidOutAmount: number;
  refundedAmount: number;
  chargebackAmount: number;
  participantsPaidCount: number;
  adminUrl: string | null;
};

type PayoutRequest = {
  id: string;
  status: "pending" | "processing" | "paid" | "rejected" | "cancelled";
  requestedAmount: number;
  currency: "BRL";
  createdAt: number | null;
};

type DashboardResponse = {
  wallet: any;
  transactions: WalletTransaction[];
  tournamentRows: WalletTournamentRow[];
  currency: "BRL";
  walletSummary: WalletSummary;
  stats: WalletStats;
};

type PayoutStatusResponse = {
  walletSummary: WalletSummary;
  latestPayoutRequest: PayoutRequest | null;
  payoutOpen: boolean;
};

const INITIAL_VISIBLE = 14;

function safeTrim(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeMoney(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Number(parsed.toFixed(2));
}

function formatMoney(value: unknown, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  }).format(normalizeMoney(value));
}

function formatDateTime(value: unknown) {
  if (!value) return "—";
  const date = new Date(value as any);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function getTxDate(tx: WalletTransaction) {
  return tx.createdAt || tx.releasedAt || tx.paidOutAt || tx.reversedAt || tx.updatedAt;
}

function getSourceLabel(sourceType?: string) {
  if (sourceType === "reservation") return "Reserva";
  if (sourceType === "tournament") return "Torneio";
  if (sourceType === "payout") return "Repasse";
  if (sourceType === "refund") return "Estorno";
  return "Movimentação";
}

function getTypeLabel(type: string) {
  if (type === "payment_received") return "Pagamento recebido";
  if (type === "payment_created") return "Pagamento criado";
  if (type === "release_to_available") return "Saldo liberado";
  if (type === "refund") return "Reembolso";
  if (type === "chargeback") return "Chargeback";
  if (type === "payout_sent") return "Repasse enviado";
  return "Ajuste manual";
}

function getStatusMeta(status: string) {
  if (status === "available") return { label: "Disponível", style: styles.badgeGreen };
  if (status === "paid_out") return { label: "Repassado", style: styles.badgeBlue };
  if (status === "reversed") return { label: "Revertido", style: styles.badgeRed };
  return { label: "Pendente", style: styles.badgeYellow };
}

function getSourceMeta(sourceType?: string) {
  if (sourceType === "reservation") return { label: "Reserva", style: styles.sourceGreen };
  if (sourceType === "tournament") return { label: "Torneio", style: styles.sourceBlue };
  if (sourceType === "payout") return { label: "Repasse", style: styles.sourceDark };
  if (sourceType === "refund") return { label: "Estorno", style: styles.sourceRed };
  return { label: "Manual", style: styles.sourceGray };
}

async function getAuthToken() {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Usuário não autenticado.");
  return currentUser.getIdToken(true);
}

async function apiGet<T>(url: string): Promise<T> {
  const token = await getAuthToken();

  const response = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const payload = await response.json();

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message || "Falha na requisição.");
  }

  return (payload.data ?? payload) as T;
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

  const [wallet, setWallet] = useState<any>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [tournamentRows, setTournamentRows] = useState<WalletTournamentRow[]>([]);
  const [currency, setCurrency] = useState<"BRL">("BRL");
  const [summary, setSummary] = useState<WalletSummary>({
    availableAmount: 0,
    pendingAmount: 0,
    paidOutAmount: 0,
    grossAmount: 0,
    netAmount: 0,
    refundedAmount: 0,
    chargebackAmount: 0,
    reservationsAmount: 0,
    tournamentsAmount: 0,
    totalTransactions: 0,
  });
  const [stats, setStats] = useState<WalletStats>({
    tournamentsCount: 0,
    reservationsCount: 0,
    paymentsCount: 0,
    releasesCount: 0,
    payoutsCount: 0,
    refundsCount: 0,
  });

  const [payoutRequest, setPayoutRequest] = useState<PayoutRequest | null>(null);
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [payoutMessage, setPayoutMessage] = useState<string | null>(null);
  const [payoutError, setPayoutError] = useState<string | null>(null);

  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | TransactionStatus>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | TransactionType>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [visible, setVisible] = useState(INITIAL_VISIBLE);

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
      setPayoutMessage(null);
      setPayoutError(null);

      const [dashboard, payoutStatus] = await Promise.all([
        apiGet<DashboardResponse>("/api/finance/organizer/wallet/dashboard"),
        apiGet<PayoutStatusResponse>("/api/finance/organizer/wallet/payout-status"),
      ]);

      setWallet(dashboard.wallet);
      setTransactions(Array.isArray(dashboard.transactions) ? dashboard.transactions : []);
      setTournamentRows(Array.isArray(dashboard.tournamentRows) ? dashboard.tournamentRows : []);
      setCurrency(dashboard.currency || "BRL");
      setSummary(dashboard.walletSummary);
      setStats(dashboard.stats);
      setPayoutRequest(payoutStatus.latestPayoutRequest);
      setPayoutOpen(Boolean(payoutStatus.payoutOpen));
    } catch (err) {
      console.error("Erro ao carregar wallet:", err);
      setError(err instanceof Error ? err.message : "Não foi possível carregar a carteira.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRequestPayout() {
    try {
      setPayoutLoading(true);
      setPayoutMessage(null);
      setPayoutError(null);

      const created = await apiPost<PayoutRequest>(
        "/api/finance/organizer/wallet/request-payout"
      );

      setPayoutRequest(created);
      setPayoutOpen(true);
      setPayoutMessage("Pedido de repasse criado com sucesso.");
      await loadWallet();
    } catch (err) {
      setPayoutError(
        err instanceof Error ? err.message : "Não foi possível solicitar o repasse."
      );
    } finally {
      setPayoutLoading(false);
    }
  }

  const filteredTransactions = useMemo(() => {
    const q = safeTrim(searchTerm).toLowerCase();

    return transactions.filter((tx) => {
      const sourceType = safeTrim(tx.sourceType || "tournament") as SourceType;
      const status = safeTrim(tx.status).toLowerCase();
      const type = safeTrim(tx.type).toLowerCase();

      const matchesSource =
        sourceFilter === "all" ||
        sourceType === sourceFilter ||
        (sourceFilter === "payout" && tx.type === "payout_sent") ||
        (sourceFilter === "refund" && (tx.type === "refund" || tx.type === "chargeback"));

      const matchesStatus = statusFilter === "all" || status === statusFilter;
      const matchesType = typeFilter === "all" || type === typeFilter;

      const haystack = [
        tx.title,
        tx.subtitle,
        tx.tournamentId,
        tx.reservationId,
        tx.paymentId,
        tx.providerPaymentId,
        tx.externalReference,
        getSourceLabel(sourceType),
        getTypeLabel(type),
      ]
        .map(safeTrim)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !q || haystack.includes(q);

      return matchesSource && matchesStatus && matchesType && matchesSearch;
    });
  }, [transactions, sourceFilter, statusFilter, typeFilter, searchTerm]);

  const visibleTransactions = useMemo(
    () => filteredTransactions.slice(0, visible),
    [filteredTransactions, visible]
  );

  const hasMore = visibleTransactions.length < filteredTransactions.length;

  const lastMovementDate = useMemo(() => {
    const first = transactions[0];
    return first ? formatDateTime(getTxDate(first)) : "—";
  }, [transactions]);

  function resetFilters() {
    setSourceFilter("all");
    setStatusFilter("all");
    setTypeFilter("all");
    setSearchTerm("");
    setVisible(INITIAL_VISIBLE);
  }

  useEffect(() => {
    setVisible(INITIAL_VISIBLE);
  }, [sourceFilter, statusFilter, typeFilter, searchTerm]);

  if (loading) {
    return (
      <main style={styles.page}>
        <section style={styles.heroCard}>
          <h1 style={styles.title}>💼 Carteira ConnectFish</h1>
          <p style={styles.subtitle}>Carregando saldo e movimentações...</p>
        </section>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <section style={styles.heroCard}>
          <div style={styles.heroTop}>
            <div>
              <h1 style={styles.title}>💼 Carteira ConnectFish</h1>
              <p style={styles.subtitle}>
                Acompanhe reservas, torneios, repasses e movimentações financeiras da sua operação em um só lugar.
              </p>
            </div>

            <div style={styles.heroActions}>
              <Link href="/seller/reservations" style={styles.secondaryAction}>
                Ver reservas
              </Link>
              <Link href="/seller/tournaments" style={styles.secondaryAction}>
                Ver torneios
              </Link>
            </div>
          </div>

          <div style={styles.summaryGrid}>
            <SummaryCard label="Disponível" value={formatMoney(summary.availableAmount, currency)} tone="emerald" />
            <SummaryCard label="Pendente" value={formatMoney(summary.pendingAmount, currency)} tone="amber" />
            <SummaryCard label="Líquido" value={formatMoney(summary.netAmount, currency)} tone="green" />
            <SummaryCard label="Já repassado" value={formatMoney(summary.paidOutAmount, currency)} tone="blue" />
            <SummaryCard label="Reservas" value={formatMoney(summary.reservationsAmount || 0, currency)} tone="slate" />
            <SummaryCard label="Torneios" value={formatMoney(summary.tournamentsAmount || 0, currency)} tone="slate" />
          </div>

          <div style={styles.statsGrid}>
            <StatCard label="Reservas" value={String(stats.reservationsCount || 0)} />
            <StatCard label="Torneios" value={String(stats.tournamentsCount || 0)} />
            <StatCard label="Pagamentos" value={String(stats.paymentsCount || 0)} />
            <StatCard label="Repasses" value={String(stats.payoutsCount || 0)} />
            <StatCard label="Estornos" value={String(stats.refundsCount || 0)} />
          </div>
        </section>

        {error ? (
          <section style={styles.errorCard}>
            <h2 style={styles.errorTitle}>Erro na carteira</h2>
            <p style={styles.errorText}>{error}</p>
          </section>
        ) : null}

        <section style={styles.payoutCard}>
          <div style={styles.payoutTop}>
            <div>
              <h2 style={styles.sectionTitleLight}>Central de repasses</h2>
              <p style={styles.sectionSubLight}>
                Controle valores disponíveis, pendentes e solicitações de repasse.
              </p>
            </div>

            <button
              type="button"
              style={{
                ...styles.primaryButton,
                ...(payoutLoading || payoutOpen || summary.availableAmount <= 0
                  ? styles.buttonDisabled
                  : {}),
              }}
              onClick={handleRequestPayout}
              disabled={payoutLoading || payoutOpen || summary.availableAmount <= 0}
            >
              {payoutLoading
                ? "Solicitando..."
                : payoutOpen
                  ? "Repasse em andamento"
                  : "Solicitar repasse"}
            </button>
          </div>

          <div style={styles.payoutGrid}>
            <PayoutMetric label="Disponível para repasse" value={formatMoney(summary.availableAmount, currency)} accent="emerald" />
            <PayoutMetric label="Em retenção" value={formatMoney(summary.pendingAmount, currency)} accent="amber" />
            <PayoutMetric label="Última movimentação" value={lastMovementDate} />
            <PayoutMetric
              label="Status"
              value={
                payoutOpen
                  ? "Pedido em andamento"
                  : summary.availableAmount > 0
                    ? "Pronto para solicitar"
                    : summary.pendingAmount > 0
                      ? "Aguardando liberação"
                      : "Sem saldo liberado"
              }
            />
          </div>

          {payoutRequest ? (
            <div style={styles.payoutRequestBox}>
              Último pedido: {formatMoney(payoutRequest.requestedAmount, payoutRequest.currency)} ·{" "}
              {formatDateTime(payoutRequest.createdAt)} · {payoutRequest.status}
            </div>
          ) : null}

          {payoutMessage ? <div style={styles.successNotice}>{payoutMessage}</div> : null}
          {payoutError ? <div style={styles.errorNotice}>{payoutError}</div> : null}
        </section>

        <section style={styles.card}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>Extrato financeiro</h2>
            <p style={styles.sectionSub}>
              Use os filtros para ver tudo junto ou separar somente reservas, torneios, repasses e estornos.
            </p>
          </div>

          <div style={styles.sourceTabs}>
            <SourceTab active={sourceFilter === "all"} onClick={() => setSourceFilter("all")}>Tudo</SourceTab>
            <SourceTab active={sourceFilter === "reservation"} onClick={() => setSourceFilter("reservation")}>Reservas</SourceTab>
            <SourceTab active={sourceFilter === "tournament"} onClick={() => setSourceFilter("tournament")}>Torneios</SourceTab>
            <SourceTab active={sourceFilter === "payout"} onClick={() => setSourceFilter("payout")}>Repasses</SourceTab>
            <SourceTab active={sourceFilter === "refund"} onClick={() => setSourceFilter("refund")}>Estornos</SourceTab>
          </div>

          <div style={styles.filtersCard}>
            <div style={styles.filtersGrid}>
              <div style={styles.field}>
                <label style={styles.fieldLabel}>Buscar</label>
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Cliente, reserva, torneio, payment ID..."
                  style={styles.input}
                />
              </div>

              <div style={styles.field}>
                <label style={styles.fieldLabel}>Tipo</label>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as any)}
                  style={styles.select}
                >
                  <option value="all">Todos</option>
                  <option value="payment_created">Pagamento criado</option>
                  <option value="payment_received">Pagamento recebido</option>
                  <option value="release_to_available">Saldo liberado</option>
                  <option value="payout_sent">Repasse enviado</option>
                  <option value="refund">Reembolso</option>
                  <option value="chargeback">Chargeback</option>
                  <option value="manual_adjustment">Ajuste manual</option>
                </select>
              </div>

              <div style={styles.field}>
                <label style={styles.fieldLabel}>Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  style={styles.select}
                >
                  <option value="all">Todos</option>
                  <option value="pending">Pendente</option>
                  <option value="available">Disponível</option>
                  <option value="paid_out">Repassado</option>
                  <option value="reversed">Revertido</option>
                </select>
              </div>
            </div>

            <div style={styles.filterFooter}>
              <p style={styles.filterResultText}>
                {filteredTransactions.length} movimentação(ões) encontrada(s)
              </p>

              <button type="button" style={styles.clearButton} onClick={resetFilters}>
                Limpar filtros
              </button>
            </div>
          </div>

          {visibleTransactions.length === 0 ? (
            <div style={styles.emptyBox}>Nenhuma movimentação encontrada.</div>
          ) : (
            <div style={styles.transactionList}>
              {visibleTransactions.map((tx) => {
                const statusMeta = getStatusMeta(tx.status);
                const sourceMeta = getSourceMeta(tx.sourceType || "tournament");

                return (
                  <div key={tx.id} style={styles.transactionRow}>
                    <div style={styles.transactionMain}>
                      <div style={styles.transactionTop}>
                        <strong style={styles.transactionTitle}>
                          {tx.title || getTypeLabel(tx.type)}
                        </strong>

                        <div style={styles.badgeRow}>
                          <span style={{ ...styles.sourceBadge, ...sourceMeta.style }}>
                            {sourceMeta.label}
                          </span>
                          <span style={{ ...styles.transactionBadge, ...statusMeta.style }}>
                            {statusMeta.label}
                          </span>
                        </div>
                      </div>

                      <p style={styles.transactionMeta}>
                        {tx.subtitle || getTypeLabel(tx.type)} · {formatDateTime(getTxDate(tx))}
                      </p>

                      <p style={styles.transactionMeta}>
                        ID: {tx.reservationId || tx.tournamentId || tx.paymentId || tx.providerPaymentId || "—"}
                      </p>

                      {tx.externalReference ? (
                        <p style={styles.transactionMeta}>Referência: {tx.externalReference}</p>
                      ) : null}
                    </div>

                    <div style={styles.transactionAmounts}>
                      <span style={styles.transactionAmountLabel}>Valor</span>
                      <strong style={styles.transactionAmountValue}>
                        {formatMoney(tx.netAmount || tx.grossAmount, tx.currency || currency)}
                      </strong>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {hasMore ? (
            <div style={styles.loadMoreWrap}>
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={() => setVisible((current) => current + INITIAL_VISIBLE)}
              >
                Ver mais movimentações
              </button>
            </div>
          ) : null}
        </section>

        {tournamentRows.length > 0 ? (
          <section style={styles.card}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>Financeiro por torneio</h2>
              <p style={styles.sectionSub}>
                Visão separada dos torneios dentro da carteira geral.
              </p>
            </div>

            <div style={styles.tournamentList}>
              {tournamentRows.map((tournament) => (
                <article key={tournament.tournamentId} style={styles.tournamentRow}>
                  <div style={styles.tournamentMain}>
                    <h3 style={styles.tournamentTitle}>{tournament.title}</h3>
                    <p style={styles.tournamentMeta}>{tournament.location || "Local não definido"}</p>

                    <div style={styles.tournamentMetricsGrid}>
                      <MiniMetric label="Arrecadado" value={formatMoney(tournament.grossAmount, tournament.currency)} />
                      <MiniMetric label="Líquido" value={formatMoney(tournament.netAmount, tournament.currency)} />
                      <MiniMetric label="Disponível" value={formatMoney(tournament.availableAmount, tournament.currency)} accent="emerald" />
                      <MiniMetric label="Pendente" value={formatMoney(tournament.pendingAmount, tournament.currency)} accent="amber" />
                      <MiniMetric label="Pagos" value={String(tournament.participantsPaidCount)} />
                    </div>
                  </div>

                  <Link
                    href={tournament.adminUrl || `/seller/tournaments/${tournament.tournamentId}`}
                    style={styles.primaryAction}
                  >
                    Abrir torneio
                  </Link>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function SourceTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...styles.sourceTab,
        ...(active ? styles.sourceTabActive : {}),
      }}
    >
      {children}
    </button>
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

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    width: "100%",
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
  },
  heroCard: {
    background: "linear-gradient(135deg, #0B3C5D 0%, #075E73 48%, #00BFDF 100%)",
    borderRadius: 28,
    padding: "clamp(18px, 4vw, 30px)",
    boxShadow: "0 22px 55px rgba(11,60,93,0.22)",
    overflow: "hidden",
  },
  heroTop: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
  },
  heroActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  title: {
    margin: 0,
    fontSize: "clamp(24px, 5vw, 38px)",
    lineHeight: 1.05,
    fontWeight: 1000,
    color: "#FFFFFF",
  },
  subtitle: {
    margin: "12px 0 0",
    maxWidth: 820,
    fontSize: 14,
    lineHeight: 1.75,
    fontWeight: 750,
    color: "rgba(255,255,255,0.84)",
  },
  summaryGrid: {
    marginTop: 22,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(170px, 100%), 1fr))",
    gap: 12,
  },
  summaryCard: {
    borderRadius: 20,
    padding: "16px 14px",
    border: "1px solid rgba(255,255,255,0.18)",
  },
  summaryToneEmerald: { background: "rgba(94,252,161,0.16)" },
  summaryToneAmber: { background: "rgba(251,191,36,0.16)" },
  summaryToneGreen: { background: "rgba(46,139,87,0.22)" },
  summaryToneBlue: { background: "rgba(0,191,223,0.18)" },
  summaryToneSlate: { background: "rgba(255,255,255,0.10)" },
  summaryLabel: {
    margin: 0,
    fontSize: 12,
    fontWeight: 900,
    color: "rgba(255,255,255,0.76)",
  },
  summaryValue: {
    margin: "8px 0 0",
    fontSize: "clamp(18px, 4vw, 25px)",
    fontWeight: 1000,
    color: "#FFFFFF",
    wordBreak: "break-word",
  },
  statsGrid: {
    marginTop: 14,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(145px, 100%), 1fr))",
    gap: 12,
  },
  statCard: {
    background: "rgba(255,255,255,0.92)",
    borderRadius: 18,
    padding: 14,
  },
  statLabel: {
    margin: 0,
    fontSize: 12,
    fontWeight: 850,
    color: "#64748B",
  },
  statValue: {
    margin: "7px 0 0",
    fontSize: 22,
    fontWeight: 1000,
    color: "#0B3C5D",
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
    overflow: "hidden",
  },
  sectionHeader: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 22,
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
  payoutCard: {
    background: "linear-gradient(135deg, rgba(15,23,42,1) 0%, rgba(11,60,93,1) 54%, rgba(0,191,223,0.92) 100%)",
    borderRadius: 28,
    padding: "clamp(18px, 4vw, 26px)",
    color: "#FFFFFF",
  },
  payoutTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 18,
    flexWrap: "wrap",
  },
  sectionTitleLight: {
    margin: 0,
    fontSize: 24,
    fontWeight: 1000,
    color: "#FFFFFF",
  },
  sectionSubLight: {
    margin: "8px 0 0",
    color: "rgba(255,255,255,0.82)",
    fontSize: 13,
    lineHeight: 1.65,
    fontWeight: 750,
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
  },
  payoutMetricLabel: {
    margin: 0,
    fontSize: 12,
    fontWeight: 850,
    color: "rgba(255,255,255,0.76)",
  },
  payoutMetricValue: {
    margin: "9px 0 0",
    fontSize: 20,
    fontWeight: 1000,
    wordBreak: "break-word",
  },
  payoutMetricValueDefault: { color: "#FFFFFF" },
  payoutMetricValueEmerald: { color: "#BBF7D0" },
  payoutMetricValueAmber: { color: "#FDE68A" },
  payoutRequestBox: {
    marginTop: 14,
    background: "rgba(255,255,255,0.10)",
    border: "1px solid rgba(255,255,255,0.14)",
    borderRadius: 18,
    padding: 14,
    fontSize: 13,
    fontWeight: 800,
  },
  sourceTabs: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },
  sourceTab: {
    height: 38,
    padding: "0 14px",
    borderRadius: 999,
    border: "1px solid rgba(15,23,42,0.10)",
    background: "#F8FAFC",
    color: "#334155",
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
  },
  sourceTabActive: {
    background: "#0B3C5D",
    color: "#FFFFFF",
  },
  filtersCard: {
    background: "#F8FAFC",
    border: "1px solid rgba(15,23,42,0.07)",
    borderRadius: 20,
    padding: 14,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  filtersGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(190px, 100%), 1fr))",
    gap: 12,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: 850,
    color: "#475569",
  },
  input: {
    width: "100%",
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
  },
  transactionMain: {
    flex: "1 1 240px",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  transactionTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
  },
  transactionTitle: {
    fontSize: 14,
    fontWeight: 1000,
    color: "#0F172A",
  },
  badgeRow: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
  },
  transactionBadge: {
    display: "inline-flex",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 1000,
  },
  sourceBadge: {
    display: "inline-flex",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 1000,
  },
  badgeGreen: {
    background: "#DCFCE7",
    color: "#166534",
  },
  badgeBlue: {
    background: "#E0F2FE",
    color: "#075985",
  },
  badgeYellow: {
    background: "#FEF3C7",
    color: "#92400E",
  },
  badgeRed: {
    background: "#FEE2E2",
    color: "#B91C1C",
  },
  sourceGreen: {
    background: "rgba(46,139,87,0.12)",
    color: "#14532D",
  },
  sourceBlue: {
    background: "rgba(0,191,223,0.12)",
    color: "#075985",
  },
  sourceDark: {
    background: "rgba(15,23,42,0.10)",
    color: "#0F172A",
  },
  sourceRed: {
    background: "rgba(239,68,68,0.10)",
    color: "#B91C1C",
  },
  sourceGray: {
    background: "rgba(100,116,139,0.12)",
    color: "#334155",
  },
  transactionMeta: {
    margin: 0,
    fontSize: 12,
    lineHeight: 1.6,
    fontWeight: 750,
    color: "#64748B",
    wordBreak: "break-word",
  },
  transactionAmounts: {
    minWidth: 140,
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
  },
  loadMoreWrap: {
    display: "flex",
    justifyContent: "center",
  },
  tournamentList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  tournamentRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    padding: 16,
    borderRadius: 20,
    background: "linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)",
    border: "1px solid rgba(15,23,42,0.07)",
    flexWrap: "wrap",
  },
  tournamentMain: {
    flex: "1 1 320px",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  tournamentTitle: {
    margin: 0,
    fontSize: 17,
    fontWeight: 1000,
    color: "#0F172A",
  },
  tournamentMeta: {
    margin: 0,
    fontSize: 13,
    fontWeight: 850,
    color: "#475569",
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
  },
  miniMetricLabel: {
    margin: 0,
    fontSize: 12,
    fontWeight: 850,
    color: "#64748B",
  },
  miniMetricValue: {
    margin: "8px 0 0",
    fontSize: 15,
    fontWeight: 1000,
  },
  miniMetricValueDefault: { color: "#0F172A" },
  miniMetricValueEmerald: { color: "#047857" },
  miniMetricValueAmber: { color: "#B45309" },
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
  errorCard: {
    background: "#FFFFFF",
    border: "1px solid rgba(239,68,68,0.18)",
    borderRadius: 22,
    padding: 18,
  },
  errorTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 1000,
    color: "#B91C1C",
  },
  errorText: {
    margin: "8px 0 0",
    fontSize: 13,
    fontWeight: 800,
    color: "#7F1D1D",
  },
  emptyBox: {
    padding: 16,
    borderRadius: 16,
    background: "#F8FAFC",
    border: "1px dashed rgba(15,23,42,0.14)",
    color: "#64748B",
    fontSize: 13,
    fontWeight: 850,
  },
};