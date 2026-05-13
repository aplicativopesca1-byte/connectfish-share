"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../../../../src/lib/firebase";

type Reservation = {
  id: string;
  ownerId?: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  sessionId?: string;
  sessionTitle?: string;
  areaName?: string;
  peopleCount?: number;
  pricePerPerson?: number;
  totalPrice?: number;
  status?: string;
  paymentStatus?: string;
  paymentStatusDetail?: string;
  checkoutUrl?: string;
  asaasInvoiceUrl?: string;
  asaasPixCopyPaste?: string | null;
  asaasPixQrCode?: string | null;
  providerPaymentId?: string;
  providerCustomerId?: string;
  externalReference?: string;
  billingType?: string;
  dueDate?: string;
  createdAt?: any;
  updatedAt?: any;
  checkoutCreatedAt?: any;
  checkedInAt?: any;
  cancelledAt?: any;
};

type FishingSession = {
  id: string;
  title?: string;
  areaName?: string;
  startAt?: string;
  endAt?: string;
  capacity?: number;
  reservedSpots?: number;
  price?: number;
  rules?: string;
  status?: string;
};

type AuditLog = {
  id: string;
  eventType?: string;
  level?: string;
  message?: string;
  createdAt?: any;
  providerPaymentId?: string;
  externalReference?: string;
};

function normalize(value: unknown) {
  return String(value || "").toLowerCase().trim();
}

function money(value: unknown) {
  const n = Number(value || 0);
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDateTime(value: any) {
  if (!value) return "Não informado";

  try {
    const date =
      typeof value?.toDate === "function"
        ? value.toDate()
        : typeof value === "string"
          ? new Date(value)
          : new Date(value);

    return date.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "Não informado";
  }
}

function paymentLabel(status?: string) {
  const value = normalize(status);
  if (value === "paid") return "Pago";
  if (value === "pending") return "Pendente";
  if (value === "expired") return "Vencido";
  if (value === "refunded") return "Reembolsado";
  if (value === "chargeback") return "Chargeback";
  return status || "Sem status";
}

function reservationLabel(status?: string) {
  const value = normalize(status);
  if (value === "reserved") return "Reservada";
  if (value === "confirmed") return "Confirmada";
  if (value === "checked_in") return "Check-in realizado";
  if (value === "completed") return "Finalizada";
  if (value === "cancelled") return "Cancelada";
  if (value === "no_show") return "No-show";
  return status || "Sem status";
}

export default function ReservationDetailClient({
  uid,
  reservationId,
}: {
  uid: string;
  reservationId: string;
}) {
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [session, setSession] = useState<FishingSession | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const paymentStatus = normalize(reservation?.paymentStatus);
  const reservationStatus = normalize(reservation?.status);

  const canCheckIn =
    reservation &&
    paymentStatus === "paid" &&
    reservationStatus !== "checked_in" &&
    reservationStatus !== "completed" &&
    reservationStatus !== "cancelled";

  const canCancel =
    reservation &&
    reservationStatus !== "cancelled" &&
    reservationStatus !== "completed";

  const checkoutUrl = reservation?.checkoutUrl || reservation?.asaasInvoiceUrl || "";

  useEffect(() => {
    setLoading(true);
    setError(null);

    const ref = doc(db, "fishingReservations", reservationId);

    const unsubscribe = onSnapshot(
      ref,
      async (snap) => {
        if (!snap.exists()) {
          setReservation(null);
          setError("Reserva não encontrada.");
          setLoading(false);
          return;
        }

        const data = {
          id: snap.id,
          ...(snap.data() as any),
        } as Reservation;

        if (data.ownerId !== uid) {
          setReservation(null);
          setError("Você não tem permissão para acessar esta reserva.");
          setLoading(false);
          return;
        }

        setReservation(data);

        if (data.sessionId) {
          const sessionSnap = await getDoc(doc(db, "fishingSessions", data.sessionId));
          if (sessionSnap.exists()) {
            setSession({
              id: sessionSnap.id,
              ...(sessionSnap.data() as any),
            });
          }
        }

        setLoading(false);
      },
      (err) => {
        setError(err?.message || "Não foi possível carregar a reserva.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [reservationId, uid]);

  useEffect(() => {
    if (!reservationId) return;

    const logsQuery = query(
      collection(db, "financialAuditLogs"),
      where("reservationId", "==", reservationId)
    );

    const unsubscribe = onSnapshot(logsQuery, (snap) => {
      const rows = snap.docs.map((item) => ({
        id: item.id,
        ...(item.data() as any),
      }));

      rows.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || 0;
        const bTime = b.createdAt?.toMillis?.() || 0;
        return bTime - aTime;
      });

      setLogs(rows);
    });

    return () => unsubscribe();
  }, [reservationId]);

  async function handleCheckIn() {
    if (!reservation) return;

    try {
      setActionLoading(true);

      await updateDoc(doc(db, "fishingReservations", reservation.id), {
        status: "checked_in",
        checkedInAt: serverTimestamp(),
        checkedInBy: uid,
        updatedAt: serverTimestamp(),
      });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCancel() {
    if (!reservation) return;

    const ok = window.confirm("Deseja cancelar esta reserva?");
    if (!ok) return;

    try {
      setActionLoading(true);

      await updateDoc(doc(db, "fishingReservations", reservation.id), {
        status: "cancelled",
        cancelledAt: serverTimestamp(),
        cancelledBy: uid,
        updatedAt: serverTimestamp(),
      });
    } finally {
      setActionLoading(false);
    }
  }

  async function copyPix() {
    const text = reservation?.asaasPixCopyPaste || "";
    if (!text) return;

    await navigator.clipboard.writeText(text);
    window.alert("PIX copiado.");
  }

  if (loading) {
    return (
      <div style={styles.card}>
        <div style={styles.title}>Carregando reserva...</div>
        <div style={styles.sub}>Buscando informações operacionais.</div>
      </div>
    );
  }

  if (error || !reservation) {
    return (
      <div style={styles.page}>
        <Link href="/seller/reservations" style={styles.backLink}>
          ← Voltar para reservas
        </Link>

        <div style={styles.errorBox}>{error || "Reserva não encontrada."}</div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <Link href="/seller/reservations" style={styles.backLink}>
        ← Voltar para reservas
      </Link>

      <section style={styles.hero}>
        <div>
          <div style={styles.overline}>Detalhe da reserva</div>
          <h1 style={styles.heroTitle}>
            {reservation.userName || "Usuário"} · {session?.title || reservation.sessionTitle || "Sessão"}
          </h1>
          <p style={styles.heroSub}>
            Controle pagamento, presença, dados do cliente e histórico financeiro.
          </p>
        </div>

        <div style={styles.heroBadges}>
          <Badge type={paymentStatus}>{paymentLabel(reservation.paymentStatus)}</Badge>
          <Badge type={reservationStatus}>{reservationLabel(reservation.status)}</Badge>
        </div>
      </section>

      <section style={styles.grid}>
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Cliente</h2>

          <Info label="Nome" value={reservation.userName || "Usuário"} />
          <Info label="Email" value={reservation.userEmail || "Não informado"} />
          <Info label="User ID" value={reservation.userId || "Não informado"} />
        </div>

        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Reserva</h2>

          <Info label="Área" value={session?.areaName || reservation.areaName || "Não definida"} />
          <Info label="Sessão" value={session?.title || reservation.sessionTitle || "Não definida"} />
          <Info label="Início" value={formatDateTime(session?.startAt)} />
          <Info label="Fim" value={formatDateTime(session?.endAt)} />
          <Info label="Pessoas" value={String(reservation.peopleCount || 0)} />
        </div>

        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Pagamento</h2>

          <Info label="Valor total" value={money(reservation.totalPrice)} />
          <Info label="Valor por pessoa" value={money(reservation.pricePerPerson)} />
          <Info label="Método" value={reservation.billingType || "Não informado"} />
          <Info label="Vencimento" value={reservation.dueDate || "Não informado"} />
          <Info label="Provider Payment ID" value={reservation.providerPaymentId || "Não informado"} />

          <div style={styles.paymentActions}>
            {checkoutUrl ? (
              <a href={checkoutUrl} target="_blank" rel="noopener noreferrer" style={styles.primaryLink}>
                Abrir checkout
              </a>
            ) : null}

            {reservation.asaasPixCopyPaste ? (
              <button type="button" onClick={copyPix} style={styles.secondaryButton}>
                Copiar PIX
              </button>
            ) : null}
          </div>
        </div>

        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Ações operacionais</h2>

          <div style={styles.actionGrid}>
            <button
              type="button"
              disabled={!canCheckIn || actionLoading}
              onClick={handleCheckIn}
              style={{
                ...styles.actionPrimary,
                ...(!canCheckIn || actionLoading ? styles.disabled : {}),
              }}
            >
              Confirmar check-in
            </button>

            <button
              type="button"
              disabled={!canCancel || actionLoading}
              onClick={handleCancel}
              style={{
                ...styles.actionDanger,
                ...(!canCancel || actionLoading ? styles.disabled : {}),
              }}
            >
              Cancelar reserva
            </button>
          </div>

          <div style={styles.helpBox}>
            O check-in só fica liberado quando o pagamento estiver como pago.
          </div>
        </div>
      </section>

      <section style={styles.card}>
        <h2 style={styles.cardTitle}>Linha do tempo financeira</h2>

        {logs.length === 0 ? (
          <div style={styles.empty}>Nenhum log financeiro encontrado.</div>
        ) : (
          <div style={styles.timeline}>
            {logs.map((log) => (
              <div key={log.id} style={styles.timelineItem}>
                <div style={styles.timelineDot} />
                <div>
                  <div style={styles.timelineTitle}>
                    {log.eventType || "Evento"} · {log.level || "info"}
                  </div>
                  <div style={styles.timelineText}>{log.message || "Sem mensagem"}</div>
                  <div style={styles.timelineDate}>{formatDateTime(log.createdAt)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.infoRow}>
      <div style={styles.infoLabel}>{label}</div>
      <div style={styles.infoValue}>{value}</div>
    </div>
  );
}

function Badge({ type, children }: { type: string; children: React.ReactNode }) {
  const normalized = normalize(type);

  const style =
    normalized === "paid" || normalized === "confirmed" || normalized === "checked_in"
      ? styles.badgeGreen
      : normalized === "pending" || normalized === "reserved"
        ? styles.badgeYellow
        : normalized === "cancelled" || normalized === "expired"
          ? styles.badgeRed
          : styles.badgeGray;

  return <span style={{ ...styles.badge, ...style }}>{children}</span>;
}

const styles: Record<string, CSSProperties> = {
  page: {
    display: "grid",
    gap: 16,
  },

  backLink: {
    width: "fit-content",
    textDecoration: "none",
    color: "#0B3C5D",
    fontSize: 13,
    fontWeight: 1000,
  },

  hero: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
    borderRadius: 24,
    padding: "clamp(20px, 4vw, 30px)",
    background: "linear-gradient(135deg, #071325 0%, #0B3C5D 55%, #00BFDF 130%)",
    color: "#FFFFFF",
    boxShadow: "0 18px 45px rgba(15,23,42,0.18)",
  },

  overline: {
    fontSize: 11,
    fontWeight: 1000,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: "rgba(234,240,255,0.70)",
  },

  heroTitle: {
    margin: "8px 0 0",
    fontSize: "clamp(24px, 5vw, 38px)",
    lineHeight: 1.05,
    fontWeight: 1000,
    color: "#FFFFFF",
  },

  heroSub: {
    margin: "10px 0 0",
    maxWidth: 760,
    fontSize: 14,
    lineHeight: 1.7,
    fontWeight: 700,
    color: "rgba(234,240,255,0.78)",
  },

  heroBadges: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    flexWrap: "wrap",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))",
    gap: 14,
  },

  card: {
    borderRadius: 22,
    padding: 18,
    background: "#FFFFFF",
    border: "1px solid rgba(15,23,42,0.08)",
    boxShadow: "0 10px 24px rgba(15,23,42,0.05)",
  },

  title: {
    fontSize: 18,
    fontWeight: 1000,
    color: "#0F172A",
  },

  sub: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: 800,
    color: "#64748B",
  },

  cardTitle: {
    margin: "0 0 14px",
    fontSize: 16,
    fontWeight: 1000,
    color: "#0F172A",
  },

  infoRow: {
    display: "grid",
    gap: 4,
    padding: "10px 0",
    borderBottom: "1px solid rgba(15,23,42,0.06)",
  },

  infoLabel: {
    fontSize: 11,
    fontWeight: 1000,
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },

  infoValue: {
    fontSize: 13,
    fontWeight: 900,
    color: "#0F172A",
    wordBreak: "break-word",
  },

  paymentActions: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },

  primaryLink: {
    height: 38,
    display: "inline-flex",
    alignItems: "center",
    padding: "0 12px",
    borderRadius: 12,
    background: "#0B3C5D",
    color: "#FFFFFF",
    textDecoration: "none",
    fontSize: 12,
    fontWeight: 1000,
  },

  secondaryButton: {
    height: 38,
    padding: "0 12px",
    borderRadius: 12,
    border: "1px solid rgba(15,23,42,0.10)",
    background: "#FFFFFF",
    color: "#0F172A",
    fontSize: 12,
    fontWeight: 1000,
    cursor: "pointer",
  },

  actionGrid: {
    display: "grid",
    gap: 10,
  },

  actionPrimary: {
    height: 42,
    borderRadius: 13,
    border: "1px solid rgba(46,139,87,0.20)",
    background: "#2E8B57",
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: 1000,
    cursor: "pointer",
  },

  actionDanger: {
    height: 42,
    borderRadius: 13,
    border: "1px solid rgba(239,68,68,0.18)",
    background: "rgba(239,68,68,0.08)",
    color: "#B91C1C",
    fontSize: 13,
    fontWeight: 1000,
    cursor: "pointer",
  },

  disabled: {
    opacity: 0.55,
    cursor: "not-allowed",
  },

  helpBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    background: "rgba(0,191,223,0.08)",
    border: "1px solid rgba(0,191,223,0.14)",
    color: "#075985",
    fontSize: 12,
    lineHeight: 1.5,
    fontWeight: 800,
  },

  badge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "8px 11px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 1000,
    whiteSpace: "nowrap",
  },

  badgeGreen: {
    background: "rgba(46,139,87,0.14)",
    color: "#14532D",
    border: "1px solid rgba(46,139,87,0.22)",
  },

  badgeYellow: {
    background: "rgba(245,158,11,0.14)",
    color: "#92400E",
    border: "1px solid rgba(245,158,11,0.22)",
  },

  badgeRed: {
    background: "rgba(239,68,68,0.12)",
    color: "#B91C1C",
    border: "1px solid rgba(239,68,68,0.20)",
  },

  badgeGray: {
    background: "rgba(100,116,139,0.12)",
    color: "#334155",
    border: "1px solid rgba(100,116,139,0.18)",
  },

  timeline: {
    display: "grid",
    gap: 12,
  },

  timelineItem: {
    display: "grid",
    gridTemplateColumns: "14px 1fr",
    gap: 10,
  },

  timelineDot: {
    width: 10,
    height: 10,
    marginTop: 5,
    borderRadius: 999,
    background: "#0B3C5D",
    boxShadow: "0 0 0 4px rgba(11,60,93,0.10)",
  },

  timelineTitle: {
    fontSize: 13,
    fontWeight: 1000,
    color: "#0F172A",
  },

  timelineText: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: 800,
    color: "#475569",
  },

  timelineDate: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: 800,
    color: "#94A3B8",
  },

  empty: {
    padding: 14,
    borderRadius: 14,
    background: "#F8FAFC",
    color: "#64748B",
    fontSize: 13,
    fontWeight: 800,
  },

  errorBox: {
    padding: 16,
    borderRadius: 16,
    background: "rgba(239,68,68,0.08)",
    border: "1px solid rgba(239,68,68,0.18)",
    color: "#B91C1C",
    fontSize: 13,
    fontWeight: 900,
  },
};