"use client";

import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { db } from "../../../../../src/lib/firebase";

type Props = {
  tournamentId: string;
};

type RegistrationItem = {
  id: string;
  tournamentId: string;
  tournamentTitle: string | null;
  teamName: string;
  captainName: string;
  captainEmail: string;
  captainPhone: string | null;
  membersCount: number;
  registrationStatus: string;
  paymentStatus: string;
  paymentStatusDetail: string | null;
  paymentProvider: string | null;
  amount: number;
  amountPaid: number | null;
  currency: string;
  externalReference: string | null;
  paymentId: string | null;
  createdAtLabel: string;
  approvedAtLabel: string | null;
};

function toDateSafe(value: unknown): Date | null {
  if (!value) return null;

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate?: () => Date }).toDate === "function"
  ) {
    const date = (value as { toDate?: () => Date }).toDate?.();
    if (!date || Number.isNaN(date.getTime())) return null;
    return date;
  }

  if (typeof value === "string") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }

  return null;
}

function formatDateTime(value: unknown) {
  const date = toDateSafe(value);
  if (!date) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function formatMoney(value: number | null | undefined, currency = "BRL") {
  const amount = Number(value ?? 0);

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function normalizeStatus(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function getPaymentBadge(status: string): CSSProperties {
  const normalized = normalizeStatus(status);

  if (normalized === "approved") {
    return {
      ...styles.badge,
      background: "#DCFCE7",
      color: "#166534",
    };
  }

  if (normalized === "pending" || normalized === "in_process") {
    return {
      ...styles.badge,
      background: "#FEF3C7",
      color: "#92400E",
    };
  }

  if (
    normalized === "rejected" ||
    normalized === "cancelled" ||
    normalized === "refunded" ||
    normalized === "charged_back" ||
    normalized === "error"
  ) {
    return {
      ...styles.badge,
      background: "#FEE2E2",
      color: "#B91C1C",
    };
  }

  return {
    ...styles.badge,
    background: "#E2E8F0",
    color: "#334155",
  };
}

function getPaymentLabel(status: string) {
  const normalized = normalizeStatus(status);

  if (normalized === "approved") return "Aprovado";
  if (normalized === "pending") return "Pendente";
  if (normalized === "in_process") return "Em análise";
  if (normalized === "rejected") return "Recusado";
  if (normalized === "cancelled") return "Cancelado";
  if (normalized === "refunded") return "Reembolsado";
  if (normalized === "charged_back") return "Chargeback";
  if (normalized === "error") return "Erro";
  return "Sem status";
}

function getRegistrationBadge(status: string): CSSProperties {
  const normalized = normalizeStatus(status);

  if (normalized === "confirmed") {
    return {
      ...styles.badge,
      background: "#DCFCE7",
      color: "#166534",
    };
  }

  if (normalized === "awaiting_payment") {
    return {
      ...styles.badge,
      background: "#FEF3C7",
      color: "#92400E",
    };
  }

  if (normalized === "payment_failed") {
    return {
      ...styles.badge,
      background: "#FEE2E2",
      color: "#B91C1C",
    };
  }

  if (normalized === "payment_error") {
    return {
      ...styles.badge,
      background: "#FEE2E2",
      color: "#991B1B",
    };
  }

  return {
    ...styles.badge,
    background: "#E2E8F0",
    color: "#334155",
  };
}

function getRegistrationLabel(status: string) {
  const normalized = normalizeStatus(status);

  if (normalized === "confirmed") return "Confirmada";
  if (normalized === "awaiting_payment") return "Aguardando pagamento";
  if (normalized === "payment_failed") return "Falha no pagamento";
  if (normalized === "payment_error") return "Erro no checkout";
  return "Em aberto";
}

export default function TournamentRegistrationsPageClient({
  tournamentId,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<RegistrationItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    void loadRegistrations();
  }, [tournamentId]);

  async function loadRegistrations() {
    setLoading(true);
    setError(null);

    try {
      const registrationsRef = collection(db, "tournamentRegistrations");
      const registrationsQuery = query(
        registrationsRef,
        where("tournamentId", "==", tournamentId),
        orderBy("createdAt", "desc")
      );

      const snapshot = await getDocs(registrationsQuery);

      const nextItems: RegistrationItem[] = snapshot.docs.map((docSnap) => {
        const raw = docSnap.data() as Record<string, unknown>;

        return {
          id: docSnap.id,
          tournamentId: String(raw.tournamentId ?? ""),
          tournamentTitle: raw.tournamentTitle
            ? String(raw.tournamentTitle)
            : null,
          teamName: String(raw.teamName ?? "Equipe sem nome"),
          captainName: String(raw.captainName ?? "—"),
          captainEmail: String(raw.captainEmail ?? "—"),
          captainPhone: raw.captainPhone ? String(raw.captainPhone) : null,
          membersCount: Array.isArray(raw.members) ? raw.members.length : 0,
          registrationStatus: String(raw.registrationStatus ?? "awaiting_payment"),
          paymentStatus: String(raw.paymentStatus ?? "pending"),
          paymentStatusDetail: raw.paymentStatusDetail
            ? String(raw.paymentStatusDetail)
            : null,
          paymentProvider: raw.paymentProvider
            ? String(raw.paymentProvider)
            : null,
          amount: Number(raw.amount ?? 0) || 0,
          amountPaid:
            raw.amountPaid !== undefined && raw.amountPaid !== null
              ? Number(raw.amount) || Number(raw.amountPaid) || 0
              : null,
          currency: String(raw.currency ?? raw.paymentCurrency ?? "BRL"),
          externalReference: raw.externalReference
            ? String(raw.externalReference)
            : null,
          paymentId: raw.paymentId ? String(raw.paymentId) : null,
          createdAtLabel: formatDateTime(raw.createdAt),
          approvedAtLabel: raw.approvedAt ? formatDateTime(raw.approvedAt) : null,
        };
      });

      setItems(nextItems);
    } catch (err) {
      console.error("Erro ao carregar inscrições:", err);
      setError("Não foi possível carregar as inscrições.");
    } finally {
      setLoading(false);
    }
  }

  const filteredItems = useMemo(() => {
    if (statusFilter === "all") return items;
    if (statusFilter === "confirmed") {
      return items.filter(
        (item) => normalizeStatus(item.registrationStatus) === "confirmed"
      );
    }
    if (statusFilter === "awaiting_payment") {
      return items.filter(
        (item) => normalizeStatus(item.registrationStatus) === "awaiting_payment"
      );
    }
    if (statusFilter === "payment_failed") {
      return items.filter((item) => {
        const reg = normalizeStatus(item.registrationStatus);
        return reg === "payment_failed" || reg === "payment_error";
      });
    }
    return items;
  }, [items, statusFilter]);

  const summary = useMemo(() => {
    const total = items.length;
    const confirmed = items.filter(
      (item) => normalizeStatus(item.registrationStatus) === "confirmed"
    ).length;
    const awaitingPayment = items.filter(
      (item) => normalizeStatus(item.registrationStatus) === "awaiting_payment"
    ).length;
    const failed = items.filter((item) => {
      const status = normalizeStatus(item.registrationStatus);
      return status === "payment_failed" || status === "payment_error";
    }).length;

    const approvedPayments = items.filter(
      (item) => normalizeStatus(item.paymentStatus) === "approved"
    ).length;

    return {
      total,
      confirmed,
      awaitingPayment,
      failed,
      approvedPayments,
    };
  }, [items]);

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <section style={styles.card}>
            <h1 style={styles.title}>Carregando inscrições...</h1>
            <p style={styles.muted}>Aguarde enquanto buscamos os dados.</p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <section style={styles.headerCard}>
          <div>
            <p style={styles.eyebrow}>Seller / Torneios</p>
            <h1 style={styles.title}>Gestão de inscrições</h1>
            <p style={styles.muted}>
              Acompanhe pagamentos, aprovações e equipes confirmadas deste
              torneio.
            </p>
          </div>

          <div style={styles.headerActions}>
            <Link
              href={`/seller/tournaments/${tournamentId}/teams`}
              style={styles.secondaryLink}
            >
              Ver equipes
            </Link>
          </div>
        </section>

        <section style={styles.summaryGrid}>
          <SummaryCard label="Total de inscrições" value={String(summary.total)} />
          <SummaryCard
            label="Aguardando pagamento"
            value={String(summary.awaitingPayment)}
          />
          <SummaryCard
            label="Pagamentos aprovados"
            value={String(summary.approvedPayments)}
          />
          <SummaryCard
            label="Equipes confirmadas"
            value={String(summary.confirmed)}
          />
          <SummaryCard
            label="Falhas / erros"
            value={String(summary.failed)}
          />
        </section>

        <section style={styles.card}>
          <div style={styles.toolbar}>
            <div>
              <h2 style={styles.sectionTitle}>Lista de inscrições</h2>
              <p style={styles.sectionText}>
                Visualização rápida para o administrador do torneio.
              </p>
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={styles.select}
            >
              <option value="all">Todas</option>
              <option value="awaiting_payment">Aguardando pagamento</option>
              <option value="confirmed">Confirmadas</option>
              <option value="payment_failed">Falhas / erros</option>
            </select>
          </div>

          {error ? <p style={styles.errorText}>{error}</p> : null}

          {filteredItems.length === 0 ? (
            <div style={styles.emptyBox}>
              <p style={styles.emptyTitle}>Nenhuma inscrição encontrada</p>
              <p style={styles.emptyText}>
                Assim que os participantes iniciarem pagamentos, eles aparecerão
                aqui.
              </p>
            </div>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Equipe</th>
                    <th style={styles.th}>Capitão</th>
                    <th style={styles.th}>Inscrição</th>
                    <th style={styles.th}>Pagamento</th>
                    <th style={styles.th}>Valor</th>
                    <th style={styles.th}>Criada em</th>
                    <th style={styles.th}>Aprovada em</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => (
                    <tr key={item.id}>
                      <td style={styles.td}>
                        <div style={styles.primaryCell}>
                          <strong style={styles.cellTitle}>{item.teamName}</strong>
                          <span style={styles.cellMeta}>
                            {item.membersCount} membro(s)
                          </span>
                          <span style={styles.cellMetaSoft}>ID: {item.id}</span>
                        </div>
                      </td>

                      <td style={styles.td}>
                        <div style={styles.primaryCell}>
                          <strong style={styles.cellTitle}>
                            {item.captainName}
                          </strong>
                          <span style={styles.cellMeta}>{item.captainEmail}</span>
                          {item.captainPhone ? (
                            <span style={styles.cellMeta}>{item.captainPhone}</span>
                          ) : null}
                        </div>
                      </td>

                      <td style={styles.td}>
                        <div style={styles.statusStack}>
                          <span style={getRegistrationBadge(item.registrationStatus)}>
                            {getRegistrationLabel(item.registrationStatus)}
                          </span>
                        </div>
                      </td>

                      <td style={styles.td}>
                        <div style={styles.statusStack}>
                          <span style={getPaymentBadge(item.paymentStatus)}>
                            {getPaymentLabel(item.paymentStatus)}
                          </span>
                          {item.paymentStatusDetail ? (
                            <span style={styles.cellMetaSoft}>
                              {item.paymentStatusDetail}
                            </span>
                          ) : null}
                          {item.paymentProvider ? (
                            <span style={styles.cellMetaSoft}>
                              via {item.paymentProvider}
                            </span>
                          ) : null}
                        </div>
                      </td>

                      <td style={styles.td}>
                        <div style={styles.primaryCell}>
                          <strong style={styles.cellTitle}>
                            {formatMoney(item.amount, item.currency)}
                          </strong>
                          {item.amountPaid !== null ? (
                            <span style={styles.cellMetaSoft}>
                              Pago: {formatMoney(item.amountPaid, item.currency)}
                            </span>
                          ) : null}
                        </div>
                      </td>

                      <td style={styles.td}>{item.createdAtLabel}</td>
                      <td style={styles.td}>{item.approvedAtLabel || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.summaryCard}>
      <span style={styles.summaryLabel}>{label}</span>
      <strong style={styles.summaryValue}>{value}</strong>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#F8FAFC",
    padding: 24,
  },
  container: {
    maxWidth: 1280,
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  headerCard: {
    background: "#FFFFFF",
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 24,
    padding: 22,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    flexWrap: "wrap",
  },
  card: {
    background: "#FFFFFF",
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 22,
    padding: 22,
    boxShadow: "0 10px 24px rgba(15,23,42,0.04)",
  },
  eyebrow: {
    margin: 0,
    fontSize: 12,
    fontWeight: 900,
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  title: {
    margin: "8px 0 0 0",
    fontSize: 32,
    fontWeight: 1000,
    color: "#0B3C5D",
  },
  muted: {
    margin: "10px 0 0 0",
    fontSize: 14,
    lineHeight: 1.7,
    fontWeight: 600,
    color: "#64748B",
  },
  headerActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  secondaryLink: {
    textDecoration: "none",
    borderRadius: 12,
    padding: "12px 16px",
    background: "#E2E8F0",
    color: "#0F172A",
    fontWeight: 900,
    fontSize: 14,
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
  },
  summaryCard: {
    background: "#FFFFFF",
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 18,
    padding: 18,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  summaryLabel: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: 800,
  },
  summaryValue: {
    fontSize: 28,
    color: "#0F172A",
    fontWeight: 1000,
    lineHeight: 1,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 22,
    fontWeight: 900,
    color: "#0F172A",
  },
  sectionText: {
    margin: "8px 0 0 0",
    fontSize: 14,
    color: "#64748B",
    fontWeight: 600,
  },
  toolbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    flexWrap: "wrap",
    marginBottom: 16,
  },
  select: {
    border: "1px solid rgba(15,23,42,0.12)",
    borderRadius: 12,
    padding: "11px 14px",
    background: "#FFFFFF",
    color: "#0F172A",
    fontSize: 14,
    fontWeight: 700,
    minWidth: 220,
  },
  emptyBox: {
    borderRadius: 16,
    padding: 24,
    background: "#F8FAFC",
    border: "1px dashed rgba(15,23,42,0.12)",
  },
  emptyTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 900,
    color: "#0F172A",
  },
  emptyText: {
    margin: "8px 0 0 0",
    fontSize: 14,
    color: "#64748B",
    fontWeight: 600,
    lineHeight: 1.6,
  },
  tableWrap: {
    width: "100%",
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: 980,
  },
  th: {
    textAlign: "left",
    padding: "12px 10px",
    fontSize: 12,
    color: "#64748B",
    fontWeight: 900,
    borderBottom: "1px solid rgba(15,23,42,0.08)",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  td: {
    padding: "14px 10px",
    borderBottom: "1px solid rgba(15,23,42,0.06)",
    verticalAlign: "top",
    fontSize: 14,
    color: "#0F172A",
    fontWeight: 700,
  },
  primaryCell: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  cellTitle: {
    fontSize: 14,
    color: "#0F172A",
    fontWeight: 900,
  },
  cellMeta: {
    fontSize: 13,
    color: "#475569",
    fontWeight: 700,
  },
  cellMetaSoft: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: 700,
    wordBreak: "break-all",
  },
  statusStack: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    alignItems: "flex-start",
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "7px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  errorText: {
    margin: "0 0 12px 0",
    color: "#B91C1C",
    fontWeight: 800,
  },
};