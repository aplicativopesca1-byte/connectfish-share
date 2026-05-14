"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  increment,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../../../src/lib/firebase";

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
  providerPaymentId?: string;
  createdAt?: any;
  updatedAt?: any;
  spotId?: string;
spotName?: string;
spotType?: string;
};

type FishingSession = {
  id: string;
  title?: string;
  areaName?: string;
  startAt?: string;
  endAt?: string;
  capacity?: number;
  reservedSpots?: number;
  status?: string;
};

type SpotOccupancy = {
  id: string;
  ownerId?: string;
  sessionId?: string;
  areaName?: string;
  spotId?: string;
  spotName?: string;
  spotType?: string;
  capacity?: number;
  reservedPeople?: number;
  availablePeople?: number;
};

type FilterKey =
  | "today"
  | "all"
  | "paid"
  | "pending"
  | "cancelled"
  | "checkin_pending";

function money(value: unknown) {
  const n = Number(value || 0);
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function normalize(value: unknown) {
  return String(value || "").toLowerCase().trim();
}

function dateKeyFromSession(session?: FishingSession | null) {
  const raw = session?.startAt;
  if (!raw) return "";
  return raw.slice(0, 10);
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function formatDateTime(raw?: string) {
  if (!raw) return "Data não definida";

  try {
    const date = new Date(raw);
    return date.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return raw;
  }
}

function canPerformCheckIn(
  reservation: Reservation,
  session?: FishingSession | null
) {
  const paymentStatus = normalize(reservation.paymentStatus);
  const status = normalize(reservation.status);

  if (paymentStatus !== "paid") {
    return {
      allowed: false,
      reason: "Pagamento pendente.",
    };
  }

  if (
    status === "checked_in" ||
    status === "completed"
  ) {
    return {
      allowed: false,
      reason: "Check-in já realizado.",
    };
  }

  if (
    status === "cancelled" ||
    status === "no_show"
  ) {
    return {
      allowed: false,
      reason: "Reserva inválida.",
    };
  }

  if (!session?.startAt) {
    return {
      allowed: true,
      reason: null,
    };
  }

  const start = new Date(session.startAt).getTime();

  if (!Number.isFinite(start)) {
    return {
      allowed: true,
      reason: null,
    };
  }

  const now = Date.now();

  const checkInOpen = start - 1000 * 60 * 60;
  const checkInClose = start + 1000 * 60 * 120;

  if (now < checkInOpen) {
    return {
      allowed: false,
      reason: "Check-in ainda não liberado.",
    };
  }

  if (now > checkInClose) {
    return {
      allowed: false,
      reason: "Janela de check-in encerrada.",
    };
  }

  return {
    allowed: true,
    reason: null,
  };
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
  if (value === "checked_in") return "Check-in";
  if (value === "completed") return "Finalizada";
  if (value === "cancelled") return "Cancelada";
  if (value === "no_show") return "No-show";

  return status || "Sem status";
}

export default function ReservationsClient({ uid }: { uid: string }) {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [sessions, setSessions] = useState<Record<string, FishingSession>>({});
  const [filter, setFilter] = useState<FilterKey>("today");
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [occupancy, setOccupancy] = useState<SpotOccupancy[]>([]);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const reservationsQuery = query(
      collection(db, "fishingReservations"),
      where("ownerId", "==", uid)
    );

    const unsubscribeReservations = onSnapshot(
      reservationsQuery,
      (snap) => {
        const rows = snap.docs.map((item) => ({
          id: item.id,
          ...(item.data() as any),
        }));

        rows.sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() || 0;
          const bTime = b.createdAt?.toMillis?.() || 0;
          return bTime - aTime;
        });

        setReservations(rows);
        setLoading(false);
      },
      (err) => {
        setError(err?.message || "Não foi possível carregar as reservas.");
        setLoading(false);
      }
    );

    const sessionsQuery = query(
      collection(db, "fishingSessions"),
      where("ownerId", "==", uid)
    );

    const occupancyQuery = query(
  collection(db, "fishingSessionSpotOccupancy"),
  where("ownerId", "==", uid)
);

const unsubscribeOccupancy = onSnapshot(occupancyQuery, (snap) => {
  const rows = snap.docs.map((item) => ({
    id: item.id,
    ...(item.data() as any),
  }));

  setOccupancy(rows);
});

    const unsubscribeSessions = onSnapshot(sessionsQuery, (snap) => {
      const map: Record<string, FishingSession> = {};

      snap.docs.forEach((item) => {
        map[item.id] = {
          id: item.id,
          ...(item.data() as any),
        };
      });

      setSessions(map);
    });

    return () => {
      unsubscribeReservations();
      unsubscribeSessions();
      unsubscribeOccupancy();
    };
  }, [uid]);

  const filteredReservations = useMemo(() => {
    const today = todayKey();

    return reservations.filter((reservation) => {
      const session = reservation.sessionId ? sessions[reservation.sessionId] : null;
      const sessionDate = dateKeyFromSession(session);
      const paymentStatus = normalize(reservation.paymentStatus);
      const status = normalize(reservation.status);

      if (filter === "all") return true;
      if (filter === "today") return sessionDate === today;
      if (filter === "paid") return paymentStatus === "paid";
      if (filter === "pending") return paymentStatus === "pending";
      if (filter === "cancelled") return status === "cancelled";
      if (filter === "checkin_pending") {
        return paymentStatus === "paid" && status !== "checked_in" && status !== "completed";
      }

      return true;
    });
  }, [reservations, sessions, filter]);

  const metrics = useMemo(() => {
    const today = todayKey();

    let todayReservations = 0;
    let todayRevenue = 0;
    let pendingPayments = 0;
    let paidReservations = 0;
    let checkinPending = 0;
    let todayPeople = 0;
    let todayCapacity = 0;

    const todaySessionIds = new Set<string>();

    reservations.forEach((reservation) => {
      const session = reservation.sessionId ? sessions[reservation.sessionId] : null;
      const isToday = dateKeyFromSession(session) === today;
      const paymentStatus = normalize(reservation.paymentStatus);
      const status = normalize(reservation.status);

      if (paymentStatus === "pending") pendingPayments += 1;
      if (paymentStatus === "paid") paidReservations += 1;

      if (isToday) {
        todayReservations += 1;
        todayPeople += Number(reservation.peopleCount || 0);

        if (paymentStatus === "paid") {
          todayRevenue += Number(reservation.totalPrice || 0);
        }

        if (paymentStatus === "paid" && status !== "checked_in" && status !== "completed") {
          checkinPending += 1;
        }

        if (session?.id) todaySessionIds.add(session.id);
      }
    });

    todaySessionIds.forEach((sessionId) => {
      todayCapacity += Number(sessions[sessionId]?.capacity || 0);
    });

    const occupancy =
      todayCapacity > 0 ? Math.round((todayPeople / todayCapacity) * 100) : 0;

    return {
      todayReservations,
      todayRevenue,
      pendingPayments,
      paidReservations,
      checkinPending,
      occupancy,
    };
  }, [reservations, sessions]);

  const todayOccupancy = useMemo(() => {
  const today = todayKey();

  return occupancy
    .filter((item) => {
      const session = item.sessionId ? sessions[item.sessionId] : null;
      return dateKeyFromSession(session) === today;
    })
    .sort((a, b) => {
      const aReserved = Number(a.reservedPeople || 0);
      const bReserved = Number(b.reservedPeople || 0);
      return bReserved - aReserved;
    });
}, [occupancy, sessions]);

  async function handleCheckIn(reservationId: string) {
    try {
      setActionLoadingId(reservationId);

      await updateDoc(doc(db, "fishingReservations", reservationId), {
        status: "checked_in",
        checkedInAt: serverTimestamp(),
        checkedInBy: uid,
        updatedAt: serverTimestamp(),
      });
    } finally {
      setActionLoadingId(null);
    }
  }

async function handleCancel(reservationId: string) {
  const ok = window.confirm(
    "Deseja cancelar esta reserva? Isso vai liberar a vaga e o local escolhido."
  );
  if (!ok) return;

  try {
    setActionLoadingId(reservationId);

    await runTransaction(db, async (transaction) => {
      const reservationRef = doc(db, "fishingReservations", reservationId);
      const reservationSnap = await transaction.get(reservationRef);

      if (!reservationSnap.exists()) {
        throw new Error("Reserva não encontrada.");
      }

      const reservationData = reservationSnap.data() as Reservation;

      if (reservationData.ownerId !== uid) {
        throw new Error("Você não tem permissão para cancelar esta reserva.");
      }

      const status = normalize(reservationData.status);

      if (status === "cancelled") {
        throw new Error("Essa reserva já foi cancelada.");
      }

      if (status === "completed") {
        throw new Error("Não é possível cancelar uma reserva finalizada.");
      }

      const peopleCount = Math.max(0, Number(reservationData.peopleCount || 0));

      if (reservationData.sessionId) {
        const sessionRef = doc(
          db,
          "fishingSessions",
          String(reservationData.sessionId)
        );

        transaction.update(sessionRef, {
          reservedSpots: increment(-peopleCount),
          updatedAt: serverTimestamp(),
        });
      }

if (reservationData.sessionId && reservationData.spotId) {
  const occupancyRef = doc(
    db,
    "fishingSessionSpotOccupancy",
    `${reservationData.sessionId}_${reservationData.spotId}`
  );

  const occupancySnap = await transaction.get(occupancyRef);

  if (occupancySnap.exists()) {
    const occupancyData = occupancySnap.data();

    const currentReserved = Math.max(
      0,
      Number(occupancyData?.reservedPeople || 0)
    );

    const currentCapacity = Math.max(
      0,
      Number(occupancyData?.capacity || 0)
    );

    const nextReserved = Math.max(
      0,
      currentReserved - peopleCount
    );

    const nextAvailable = Math.max(
      0,
      currentCapacity - nextReserved
    );

    if (nextReserved <= 0) {
      transaction.delete(occupancyRef);
    } else {
      transaction.update(occupancyRef, {
        reservedPeople: nextReserved,
        availablePeople: nextAvailable,
        updatedAt: serverTimestamp(),
      });
    }
  }
}

      transaction.update(reservationRef, {
        status: "cancelled",
        cancelledAt: serverTimestamp(),
        cancelledBy: uid,
        releasedSpotAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
  } catch (e: any) {
    window.alert(e?.message || "Não foi possível cancelar a reserva.");
  } finally {
    setActionLoadingId(null);
  }
}

  return (
    <div style={styles.page}>
      <section style={styles.hero}>
        <div>
          <div style={styles.overline}>Reservas do pesqueiro</div>
          <h1 style={styles.title}>Central operacional</h1>
          <p style={styles.subtitle}>
            Acompanhe reservas, pagamentos, ocupação e check-ins do dia.
          </p>
        </div>
      </section>

      <section style={styles.metricsGrid}>
        <Metric title="Reservas hoje" value={String(metrics.todayReservations)} emoji="📅" />
        <Metric title="Receita paga hoje" value={money(metrics.todayRevenue)} emoji="💰" />
        <Metric title="Ocupação hoje" value={`${metrics.occupancy}%`} emoji="🎣" />
        <Metric title="Pagamentos pendentes" value={String(metrics.pendingPayments)} emoji="⏳" />
        <Metric title="Check-ins pendentes" value={String(metrics.checkinPending)} emoji="✅" />
      </section>

      <section style={styles.occupancyPanel}>
  <div style={styles.panelHeader}>
    <div>
      <h2 style={styles.panelTitle}>Ocupação por local hoje</h2>
      <p style={styles.panelSub}>
        Veja quais decks, quiosques ou pontos estão mais ocupados.
      </p>
    </div>
  </div>

  {todayOccupancy.length === 0 ? (
    <div style={styles.empty}>
      Nenhum local ocupado hoje.
    </div>
  ) : (
    <div style={styles.occupancyGrid}>
      {todayOccupancy.map((item) => {
        const capacity = Number(item.capacity || 0);
        const reserved = Number(item.reservedPeople || 0);
        const available = Math.max(0, capacity - reserved);
        const percent = capacity > 0 ? Math.min(100, Math.round((reserved / capacity) * 100)) : 0;

        return (
          <article key={item.id} style={styles.occupancyCard}>
            <div style={styles.occupancyTop}>
              <div>
                <div style={styles.occupancyName}>
                  {item.spotName || "Local"}
                </div>
                <div style={styles.occupancyMeta}>
                  {item.areaName || "Área"} · {item.spotType || "local"}
                </div>
              </div>

              <div style={styles.occupancyPercent}>
                {percent}%
              </div>
            </div>

            <div style={styles.occupancyBar}>
              <div
                style={{
                  ...styles.occupancyFill,
                  width: `${percent}%`,
                }}
              />
            </div>

            <div style={styles.occupancyFooter}>
              <span>{reserved}/{capacity} ocupadas</span>
              <span>{available} livres</span>
            </div>
          </article>
        );
      })}
    </div>
  )}
</section>

      <section style={styles.panel}>
        <div style={styles.panelHeader}>
          <div>
            <h2 style={styles.panelTitle}>Lista de reservas</h2>
            <p style={styles.panelSub}>
              {filteredReservations.length} reserva(s) encontrada(s)
            </p>
          </div>

          <div style={styles.filters}>
            <FilterButton active={filter === "today"} onClick={() => setFilter("today")}>
              Hoje
            </FilterButton>
            <FilterButton active={filter === "all"} onClick={() => setFilter("all")}>
              Todas
            </FilterButton>
            <FilterButton active={filter === "paid"} onClick={() => setFilter("paid")}>
              Pagas
            </FilterButton>
            <FilterButton active={filter === "pending"} onClick={() => setFilter("pending")}>
              Pendentes
            </FilterButton>
            <FilterButton
              active={filter === "checkin_pending"}
              onClick={() => setFilter("checkin_pending")}
            >
              Check-in
            </FilterButton>
            <FilterButton
              active={filter === "cancelled"}
              onClick={() => setFilter("cancelled")}
            >
              Canceladas
            </FilterButton>
          </div>
        </div>

        {loading ? (
          <div style={styles.empty}>Carregando reservas...</div>
        ) : error ? (
          <div style={styles.error}>{error}</div>
        ) : filteredReservations.length === 0 ? (
          <div style={styles.empty}>Nenhuma reserva encontrada para este filtro.</div>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Cliente</th>
                  <th style={styles.th}>Sessão</th>
                  <th style={styles.th}>Área</th>
                  <th style={styles.th}>Local</th>
                  <th style={styles.th}>Pessoas</th>
                  <th style={styles.th}>Valor</th>
                  <th style={styles.th}>Pagamento</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Ações</th>
                </tr>
              </thead>

              <tbody>
                {filteredReservations.map((reservation) => {
                  const session = reservation.sessionId
                    ? sessions[reservation.sessionId]
                    : null;

                  const paymentStatus = normalize(reservation.paymentStatus);
                  const status = normalize(reservation.status);
                  const checkInState = canPerformCheckIn(
  reservation,
  session
);

const canCheckIn = checkInState.allowed;

                  return (
                    <tr key={reservation.id} style={styles.tr}>
                      <td style={styles.td}>
                        <strong style={styles.customerName}>
                          {reservation.userName || "Usuário"}
                        </strong>
                        <div style={styles.customerEmail}>
                          {reservation.userEmail || "Sem email"}
                        </div>
                      </td>

                      <td style={styles.td}>
                        <strong>{session?.title || reservation.sessionTitle || "Sessão"}</strong>
                        <div style={styles.muted}>{formatDateTime(session?.startAt)}</div>
                      </td>

                      <td style={styles.td}>
                        {session?.areaName || reservation.areaName || "Área não definida"}
                      </td>

                      <td style={styles.td}>
  <div style={styles.spotName}>
    {reservation.spotName || "Não selecionado"}
  </div>

  {reservation.spotType ? (
    <div style={styles.spotType}>
      {reservation.spotType}
    </div>
  ) : null}
</td>

                      <td style={styles.td}>{reservation.peopleCount || 0}</td>

                      <td style={styles.td}>{money(reservation.totalPrice)}</td>

                      <td style={styles.td}>
                        <Badge type={paymentStatus}>{paymentLabel(reservation.paymentStatus)}</Badge>
                      </td>

                     <td style={styles.td}>
  <Badge type={status}>
    {reservationLabel(reservation.status)}
  </Badge>

  {!canCheckIn && checkInState.reason ? (
    <div style={styles.checkinReason}>
      {checkInState.reason}
    </div>
  ) : null}
</td>

                      <td style={styles.td}>
<div style={styles.actions}>
  <a
    href={`/seller/reservations/${reservation.id}`}
    style={styles.actionLink}
  >
    Detalhes
  </a>

<button
  type="button"
  disabled={!canCheckIn}
  onClick={() => handleCheckIn(reservation.id)}
  style={{
    ...styles.actionPrimary,
    ...(!canCheckIn ? styles.actionBtnDisabled : {}),
  }}
>
  {canCheckIn ? "Fazer check-in" : "Check-in bloqueado"}
</button>

  {reservation.checkoutUrl || reservation.asaasInvoiceUrl ? (
    <a
      href={reservation.checkoutUrl || reservation.asaasInvoiceUrl}
      target="_blank"
      rel="noopener noreferrer"
      style={styles.actionLink}
    >
      Pagamento
    </a>
  ) : null}

  {status !== "cancelled" ? (
    <button
      type="button"
      style={styles.actionDanger}
      disabled={actionLoadingId === reservation.id}
      onClick={() => handleCancel(reservation.id)}
    >
      Cancelar
    </button>
  ) : null}
</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({
  title,
  value,
  emoji,
}: {
  title: string;
  value: string;
  emoji: string;
}) {
  return (
    <article style={styles.metricCard}>
      <div style={styles.metricEmoji}>{emoji}</div>
      <div>
        <div style={styles.metricTitle}>{title}</div>
        <div style={styles.metricValue}>{value}</div>
      </div>
    </article>
  );
}

function FilterButton({
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
        ...styles.filterButton,
        ...(active ? styles.filterButtonActive : {}),
      }}
    >
      {children}
    </button>
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

  hero: {
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

  title: {
    margin: "8px 0 0",
    fontSize: "clamp(28px, 5vw, 42px)",
    lineHeight: 1.05,
    fontWeight: 1000,
    color: "#FFFFFF",
  },

  subtitle: {
    margin: "10px 0 0",
    maxWidth: 720,
    fontSize: 14,
    lineHeight: 1.7,
    fontWeight: 700,
    color: "rgba(234,240,255,0.78)",
  },

  metricsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(190px, 100%), 1fr))",
    gap: 12,
  },

  metricCard: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 20,
    background: "#FFFFFF",
    border: "1px solid rgba(15,23,42,0.08)",
    boxShadow: "0 10px 24px rgba(15,23,42,0.05)",
  },

  metricEmoji: {
    width: 44,
    height: 44,
    borderRadius: 16,
    display: "grid",
    placeItems: "center",
    background: "rgba(0,191,223,0.10)",
    border: "1px solid rgba(0,191,223,0.16)",
    fontSize: 21,
  },

  metricTitle: {
    fontSize: 12,
    fontWeight: 900,
    color: "#64748B",
  },

  metricValue: {
    marginTop: 4,
    fontSize: 20,
    fontWeight: 1000,
    color: "#0F172A",
  },

  panel: {
    borderRadius: 22,
    background: "#FFFFFF",
    border: "1px solid rgba(15,23,42,0.08)",
    boxShadow: "0 10px 24px rgba(15,23,42,0.05)",
    overflow: "hidden",
  },

  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    padding: 16,
    borderBottom: "1px solid rgba(15,23,42,0.08)",
  },

  panelTitle: {
    margin: 0,
    fontSize: 17,
    fontWeight: 1000,
    color: "#0F172A",
  },

  panelSub: {
    margin: "4px 0 0",
    fontSize: 12,
    fontWeight: 800,
    color: "#64748B",
  },

  filters: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },

  filterButton: {
    height: 36,
    padding: "0 12px",
    borderRadius: 999,
    border: "1px solid rgba(15,23,42,0.10)",
    background: "#F8FAFC",
    color: "#334155",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  },

  filterButtonActive: {
    background: "#0B3C5D",
    color: "#FFFFFF",
  },

  tableWrap: {
    width: "100%",
    overflowX: "auto",
  },

  table: {
    width: "100%",
    minWidth: 980,
    borderCollapse: "collapse",
  },

  th: {
    textAlign: "left",
    padding: "12px 14px",
    background: "#F8FAFC",
    borderBottom: "1px solid rgba(15,23,42,0.08)",
    fontSize: 11,
    fontWeight: 1000,
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },

  tr: {
    borderBottom: "1px solid rgba(15,23,42,0.06)",
  },

  td: {
    padding: "14px",
    verticalAlign: "middle",
    fontSize: 13,
    fontWeight: 800,
    color: "#0F172A",
  },

  customerName: {
    color: "#0F172A",
  },

  customerEmail: {
    marginTop: 4,
    fontSize: 12,
    color: "#64748B",
    fontWeight: 700,
  },

  muted: {
    marginTop: 4,
    fontSize: 12,
    color: "#64748B",
    fontWeight: 700,
  },

  badge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "7px 10px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 1000,
    whiteSpace: "nowrap",
  },

  badgeGreen: {
    background: "rgba(46,139,87,0.12)",
    color: "#14532D",
    border: "1px solid rgba(46,139,87,0.20)",
  },

  badgeYellow: {
    background: "rgba(245,158,11,0.12)",
    color: "#92400E",
    border: "1px solid rgba(245,158,11,0.20)",
  },

  badgeRed: {
    background: "rgba(239,68,68,0.10)",
    color: "#B91C1C",
    border: "1px solid rgba(239,68,68,0.18)",
  },

  badgeGray: {
    background: "rgba(100,116,139,0.10)",
    color: "#334155",
    border: "1px solid rgba(100,116,139,0.16)",
  },

  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },

  actionPrimary: {
    height: 34,
    padding: "0 10px",
    borderRadius: 10,
    border: "1px solid rgba(46,139,87,0.20)",
    background: "#2E8B57",
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: 1000,
    cursor: "pointer",
  },

  actionLink: {
    height: 34,
    display: "inline-flex",
    alignItems: "center",
    padding: "0 10px",
    borderRadius: 10,
    border: "1px solid rgba(15,23,42,0.10)",
    background: "#FFFFFF",
    color: "#0F172A",
    textDecoration: "none",
    fontSize: 11,
    fontWeight: 1000,
  },

  actionDanger: {
    height: 34,
    padding: "0 10px",
    borderRadius: 10,
    border: "1px solid rgba(239,68,68,0.18)",
    background: "rgba(239,68,68,0.08)",
    color: "#B91C1C",
    fontSize: 11,
    fontWeight: 1000,
    cursor: "pointer",
  },

  empty: {
    padding: 18,
    fontSize: 13,
    fontWeight: 800,
    color: "#64748B",
  },

  error: {
    margin: 16,
    padding: 14,
    borderRadius: 14,
    background: "rgba(239,68,68,0.08)",
    border: "1px solid rgba(239,68,68,0.18)",
    color: "#B91C1C",
    fontSize: 13,
    fontWeight: 900,
  },

  checkinReason: {
  marginTop: 6,
  fontSize: 11,
  fontWeight: 800,
  color: "#64748B",
  },
  actionBtnDisabled: {
  opacity: 0.6,
  cursor: "not-allowed",
  background: "#CBD5E1",
},
spotName: {
  fontSize: 13,
  fontWeight: 1000,
  color: "#0F172A",
},

spotType: {
  marginTop: 4,
  fontSize: 11,
  fontWeight: 800,
  color: "#64748B",
  textTransform: "capitalize",
},
occupancyPanel: {
  borderRadius: 22,
  background: "#FFFFFF",
  border: "1px solid rgba(15,23,42,0.08)",
  boxShadow: "0 10px 24px rgba(15,23,42,0.05)",
  overflow: "hidden",
},

occupancyGrid: {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))",
  gap: 12,
  padding: 16,
},

occupancyCard: {
  borderRadius: 18,
  padding: 14,
  background: "#F8FAFC",
  border: "1px solid rgba(15,23,42,0.08)",
},

occupancyTop: {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
},

occupancyName: {
  fontSize: 14,
  fontWeight: 1000,
  color: "#0F172A",
},

occupancyMeta: {
  marginTop: 4,
  fontSize: 12,
  fontWeight: 800,
  color: "#64748B",
},

occupancyPercent: {
  fontSize: 18,
  fontWeight: 1000,
  color: "#0B3C5D",
},

occupancyBar: {
  marginTop: 12,
  height: 9,
  borderRadius: 999,
  background: "rgba(15,23,42,0.08)",
  overflow: "hidden",
},

occupancyFill: {
  height: "100%",
  borderRadius: 999,
  background: "#0B3C5D",
},

occupancyFooter: {
  marginTop: 10,
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  fontSize: 12,
  fontWeight: 900,
  color: "#475569",
},
};