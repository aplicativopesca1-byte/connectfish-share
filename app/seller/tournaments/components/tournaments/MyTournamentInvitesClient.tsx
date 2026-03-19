"use client";

import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  orderBy,
  query,
  where,
  type QueryConstraint,
} from "firebase/firestore";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { db } from "../../../../../src/lib/firebase";
import { useAuth } from "@/context/AuthContext";

type FirestoreTimestampLike = {
  toDate?: () => Date;
};

type InviteStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "expired"
  | "cancelled"
  | string;

type RegistrationStatus =
  | "invited"
  | "awaiting_payment"
  | "confirmed"
  | "payment_failed"
  | "cancelled"
  | "refunded"
  | "chargeback"
  | string;

type PaymentStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled"
  | "refunded"
  | "error"
  | "charged_back"
  | string;

type TeamStatus =
  | "building"
  | "pending_invites"
  | "pending_payments"
  | "confirmed"
  | "cancelled"
  | string;

type InviteDoc = {
  id: string;
  inviteId: string;
  tournamentId: string;
  teamId: string;
  invitedUserId: string;
  invitedUsername: string | null;
  invitedDisplayName: string | null;
  invitedByUserId: string | null;
  invitedByUsername: string | null;
  status: InviteStatus;
  createdAt: string | null;
  updatedAt: string | null;
  respondedAt: string | null;
};

type TeamMemberDoc = {
  id: string;
  teamId: string;
  tournamentId: string;
  userId: string;
  username: string | null;
  displayName: string | null;
  role: "captain" | "member" | string;
  inviteStatus: InviteStatus;
  registrationStatus: RegistrationStatus;
  paymentStatus: PaymentStatus;
  amount: number | null;
  currency: string;
  paymentId: string | null;
  paymentApprovedAt: string | null;
  createdAt: string | null;
};

type TeamDoc = {
  id: string;
  teamId: string;
  tournamentId: string;
  teamName: string;
  captainUserId: string | null;
  captainUsername: string | null;
  captainDisplayName: string | null;
  teamStatus: TeamStatus;
  amountPerParticipant: number | null;
  currency: string;
  paymentMode: string;
};

type TournamentDoc = {
  id: string;
  title: string;
  slug: string | null;
  location: string;
  status: string;
  species: string;
};

type InviteActionResponse = {
  success: boolean;
  teamId?: string;
  tournamentId?: string;
  action?: string;
  message?: string;
};

type CreateMemberPreferenceResponse = {
  success: boolean;
  checkoutUrl?: string;
  preferenceId?: string;
  externalReference?: string;
  message?: string;
};

type CombinedItem = {
  invite: InviteDoc | null;
  membership: TeamMemberDoc;
  team: TeamDoc | null;
  tournament: TournamentDoc | null;
};

type TabKey = "pending_invites" | "my_teams" | "payment_pending" | "all";

function compactSpaces(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function toIsoStringSafe(value: unknown): string | null {
  if (!value) return null;

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as FirestoreTimestampLike).toDate === "function"
  ) {
    const date = (value as FirestoreTimestampLike).toDate?.();
    if (!date || Number.isNaN(date.getTime())) return null;
    return date.toISOString();
  }

  if (typeof value === "string") {
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

function formatMoney(value: number | null, currency = "BRL") {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  }).format(value);
}

function normalizeInviteStatus(value: unknown): InviteStatus {
  const raw = compactSpaces(value).toLowerCase();
  if (
    raw === "pending" ||
    raw === "accepted" ||
    raw === "declined" ||
    raw === "expired" ||
    raw === "cancelled"
  ) {
    return raw;
  }
  return "pending";
}

function normalizeRegistrationStatus(value: unknown): RegistrationStatus {
  const raw = compactSpaces(value).toLowerCase();
  if (
    raw === "invited" ||
    raw === "awaiting_payment" ||
    raw === "confirmed" ||
    raw === "payment_failed" ||
    raw === "cancelled" ||
    raw === "refunded" ||
    raw === "chargeback"
  ) {
    return raw;
  }
  return "invited";
}

function normalizePaymentStatus(value: unknown): PaymentStatus {
  const raw = compactSpaces(value).toLowerCase();
  if (
    raw === "pending" ||
    raw === "approved" ||
    raw === "rejected" ||
    raw === "cancelled" ||
    raw === "refunded" ||
    raw === "error" ||
    raw === "charged_back"
  ) {
    return raw;
  }
  return "pending";
}

function normalizeTeamStatus(value: unknown): TeamStatus {
  const raw = compactSpaces(value).toLowerCase();
  if (
    raw === "building" ||
    raw === "pending_invites" ||
    raw === "pending_payments" ||
    raw === "confirmed" ||
    raw === "cancelled"
  ) {
    return raw;
  }
  return "building";
}

function mapInviteDoc(id: string, raw: Record<string, unknown>): InviteDoc {
  return {
    id,
    inviteId: compactSpaces(raw.inviteId) || id,
    tournamentId: compactSpaces(raw.tournamentId),
    teamId: compactSpaces(raw.teamId),
    invitedUserId: compactSpaces(raw.invitedUserId),
    invitedUsername: compactSpaces(raw.invitedUsername) || null,
    invitedDisplayName: compactSpaces(raw.invitedDisplayName) || null,
    invitedByUserId: compactSpaces(raw.invitedByUserId) || null,
    invitedByUsername: compactSpaces(raw.invitedByUsername) || null,
    status: normalizeInviteStatus(raw.status),
    createdAt: toIsoStringSafe(raw.createdAt),
    updatedAt: toIsoStringSafe(raw.updatedAt),
    respondedAt: toIsoStringSafe(raw.respondedAt),
  };
}

function mapTeamMemberDoc(
  id: string,
  raw: Record<string, unknown>
): TeamMemberDoc {
  return {
    id,
    teamId: compactSpaces(raw.teamId),
    tournamentId: compactSpaces(raw.tournamentId),
    userId: compactSpaces(raw.userId),
    username: compactSpaces(raw.username) || null,
    displayName: compactSpaces(raw.displayName) || null,
    role: compactSpaces(raw.role) || "member",
    inviteStatus: normalizeInviteStatus(raw.inviteStatus),
    registrationStatus: normalizeRegistrationStatus(raw.registrationStatus),
    paymentStatus: normalizePaymentStatus(raw.paymentStatus),
    amount: typeof raw.amount === "number" ? raw.amount : null,
    currency: compactSpaces(raw.currency).toUpperCase() || "BRL",
    paymentId: compactSpaces(raw.paymentId) || null,
    paymentApprovedAt: toIsoStringSafe(raw.paymentApprovedAt),
    createdAt: toIsoStringSafe(raw.createdAt),
  };
}

function mapTeamDoc(id: string, raw: Record<string, unknown>): TeamDoc {
  return {
    id,
    teamId: compactSpaces(raw.teamId) || id,
    tournamentId: compactSpaces(raw.tournamentId),
    teamName: compactSpaces(raw.teamName) || "Equipe sem nome",
    captainUserId: compactSpaces(raw.captainUserId) || null,
    captainUsername: compactSpaces(raw.captainUsername) || null,
    captainDisplayName: compactSpaces(raw.captainDisplayName) || null,
    teamStatus: normalizeTeamStatus(raw.teamStatus),
    amountPerParticipant:
      typeof raw.amountPerParticipant === "number"
        ? raw.amountPerParticipant
        : null,
    currency: compactSpaces(raw.currency).toUpperCase() || "BRL",
    paymentMode: compactSpaces(raw.paymentMode) || "individual",
  };
}

function mapTournamentDoc(id: string, raw: Record<string, unknown>): TournamentDoc {
  return {
    id,
    title: compactSpaces(raw.title) || "Torneio",
    slug: compactSpaces(raw.slug) || null,
    location: compactSpaces(raw.location) || "Local não definido",
    status: compactSpaces(raw.status) || "scheduled",
    species: compactSpaces(raw.species) || "Espécie não definida",
  };
}

function getInviteLabel(status: InviteStatus) {
  switch (status) {
    case "accepted":
      return "Aceito";
    case "declined":
      return "Recusado";
    case "expired":
      return "Expirado";
    case "cancelled":
      return "Cancelado";
    case "pending":
    default:
      return "Pendente";
  }
}

function getRegistrationLabel(status: RegistrationStatus) {
  switch (status) {
    case "awaiting_payment":
      return "Aguardando pagamento";
    case "confirmed":
      return "Confirmado";
    case "payment_failed":
      return "Pagamento falhou";
    case "cancelled":
      return "Cancelado";
    case "refunded":
      return "Reembolsado";
    case "chargeback":
      return "Chargeback";
    case "invited":
    default:
      return "Convidado";
  }
}

function getPaymentLabel(status: PaymentStatus) {
  switch (status) {
    case "approved":
      return "Aprovado";
    case "rejected":
      return "Recusado";
    case "cancelled":
      return "Cancelado";
    case "refunded":
      return "Reembolsado";
    case "error":
      return "Erro";
    case "charged_back":
      return "Chargeback";
    case "pending":
    default:
      return "Pendente";
  }
}

function getTeamStatusLabel(status: TeamStatus) {
  switch (status) {
    case "confirmed":
      return "Confirmada";
    case "pending_invites":
      return "Aguardando convites";
    case "pending_payments":
      return "Aguardando pagamentos";
    case "cancelled":
      return "Cancelada";
    case "building":
    default:
      return "Em montagem";
  }
}

function getStatusBadgeStyle(
  type: "invite" | "payment" | "team",
  value: string
): CSSProperties {
  const normalized = compactSpaces(value).toLowerCase();

  if (type === "invite") {
    if (normalized === "accepted") {
      return { ...styles.statusBadge, background: "#DCFCE7", color: "#166534" };
    }
    if (
      normalized === "declined" ||
      normalized === "cancelled" ||
      normalized === "expired"
    ) {
      return { ...styles.statusBadge, background: "#FEE2E2", color: "#B91C1C" };
    }
    return { ...styles.statusBadge, background: "#DBEAFE", color: "#1D4ED8" };
  }

  if (type === "payment") {
    if (normalized === "approved") {
      return { ...styles.statusBadge, background: "#DCFCE7", color: "#166534" };
    }
    if (
      normalized === "rejected" ||
      normalized === "cancelled" ||
      normalized === "error"
    ) {
      return { ...styles.statusBadge, background: "#FEE2E2", color: "#B91C1C" };
    }
    if (normalized === "refunded" || normalized === "charged_back") {
      return { ...styles.statusBadge, background: "#E5E7EB", color: "#374151" };
    }
    return { ...styles.statusBadge, background: "#DBEAFE", color: "#1D4ED8" };
  }

  if (normalized === "confirmed") {
    return { ...styles.statusBadge, background: "#DCFCE7", color: "#166534" };
  }
  if (normalized === "pending_invites") {
    return { ...styles.statusBadge, background: "#DBEAFE", color: "#1D4ED8" };
  }
  if (normalized === "pending_payments") {
    return { ...styles.statusBadge, background: "#FEF3C7", color: "#92400E" };
  }
  if (normalized === "cancelled") {
    return { ...styles.statusBadge, background: "#FEE2E2", color: "#B91C1C" };
  }
  return { ...styles.statusBadge, background: "#E5E7EB", color: "#374151" };
}

export default function MyTournamentInvitesClient() {
  const { uid, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);

  const [invites, setInvites] = useState<InviteDoc[]>([]);
  const [memberships, setMemberships] = useState<TeamMemberDoc[]>([]);
  const [teamsById, setTeamsById] = useState<Record<string, TeamDoc>>({});
  const [tournamentsById, setTournamentsById] = useState<Record<string, TournamentDoc>>(
    {}
  );

  const [tab, setTab] = useState<TabKey>("pending_invites");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadPage();
  }, [uid]);

  const items = useMemo<CombinedItem[]>(() => {
    return memberships
      .map((membership) => {
        const invite =
          invites.find((item) => item.teamId === membership.teamId) || null;
        const team = teamsById[membership.teamId] || null;
        const tournament = tournamentsById[membership.tournamentId] || null;

        return {
          invite,
          membership,
          team,
          tournament,
        };
      })
      .sort((a, b) => {
        const dateA = new Date(
          a.invite?.createdAt || a.membership.createdAt || 0
        ).getTime();
        const dateB = new Date(
          b.invite?.createdAt || b.membership.createdAt || 0
        ).getTime();
        return dateB - dateA;
      });
  }, [invites, memberships, teamsById, tournamentsById]);

  const filteredItems = useMemo(() => {
    if (tab === "all") return items;

    if (tab === "pending_invites") {
      return items.filter((item) => item.invite?.status === "pending");
    }

    if (tab === "payment_pending") {
      return items.filter(
        (item) =>
          item.membership.inviteStatus === "accepted" &&
          item.membership.paymentStatus !== "approved"
      );
    }

    return items.filter((item) =>
      item.membership.inviteStatus === "accepted" || item.membership.role === "captain"
    );
  }, [items, tab]);

  const stats = useMemo(() => {
    return {
      pendingInvites: items.filter((item) => item.invite?.status === "pending").length,
      acceptedTeams: items.filter(
        (item) => item.membership.inviteStatus === "accepted"
      ).length,
      paymentPending: items.filter(
        (item) =>
          item.membership.inviteStatus === "accepted" &&
          item.membership.paymentStatus !== "approved"
      ).length,
      paid: items.filter((item) => item.membership.paymentStatus === "approved").length,
    };
  }, [items]);

  function clearFeedback() {
    if (message) setMessage(null);
    if (error) setError(null);
  }

  async function loadPage() {
    if (!uid) {
      setInvites([]);
      setMemberships([]);
      setTeamsById({});
      setTournamentsById({});
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const inviteConstraints: QueryConstraint[] = [
        where("invitedUserId", "==", uid),
        orderBy("createdAt", "desc"),
      ];

      const memberConstraints: QueryConstraint[] = [
        where("userId", "==", uid),
        orderBy("createdAt", "desc"),
      ];

      const [invitesSnap, membershipsSnap] = await Promise.all([
        getDocs(query(collection(db, "tournamentInvites"), ...inviteConstraints)),
        getDocs(query(collection(db, "tournamentTeamMembers"), ...memberConstraints)),
      ]);

      const inviteItems = invitesSnap.docs.map((docSnap) =>
        mapInviteDoc(docSnap.id, docSnap.data() as Record<string, unknown>)
      );

      const membershipItems = membershipsSnap.docs.map((docSnap) =>
        mapTeamMemberDoc(docSnap.id, docSnap.data() as Record<string, unknown>)
      );

      setInvites(inviteItems);
      setMemberships(membershipItems);

      const teamIds = Array.from(
        new Set(membershipItems.map((item) => item.teamId).filter(Boolean))
      );
      const tournamentIds = Array.from(
        new Set(membershipItems.map((item) => item.tournamentId).filter(Boolean))
      );

      const teamsMap: Record<string, TeamDoc> = {};
      for (const teamId of teamIds) {
        const snap = await getDoc(doc(db, "tournamentTeams", teamId));
        if (snap.exists()) {
          teamsMap[teamId] = mapTeamDoc(
            snap.id,
            snap.data() as Record<string, unknown>
          );
        }
      }

      const tournamentsMap: Record<string, TournamentDoc> = {};
      for (const tournamentId of tournamentIds) {
        const snap = await getDoc(doc(db, "tournaments", tournamentId));
        if (snap.exists()) {
          tournamentsMap[tournamentId] = mapTournamentDoc(
            snap.id,
            snap.data() as Record<string, unknown>
          );
        }
      }

      setTeamsById(teamsMap);
      setTournamentsById(tournamentsMap);
    } catch (err) {
      console.error("Erro ao carregar convites e inscrições:", err);
      setError("Não foi possível carregar seus convites e inscrições.");
    } finally {
      setLoading(false);
    }
  }

  async function handleInviteAction(
    inviteId: string,
    action: "accept" | "decline"
  ) {
    if (!uid) return;

    clearFeedback();
    setActionLoadingId(inviteId);

    try {
      const response = await fetch("/api/tournaments/team/invite/respond", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inviteId,
          userId: uid,
          action,
        }),
      });

      const data = (await response.json()) as InviteActionResponse;

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Não foi possível responder ao convite.");
      }

      setMessage(
        action === "accept"
          ? "Convite aceito com sucesso."
          : "Convite recusado com sucesso."
      );

      await loadPage();
    } catch (err) {
      console.error("Erro ao responder convite:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível responder ao convite."
      );
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handlePay(item: CombinedItem) {
    if (!uid || !item.team || !item.tournament) return;

    clearFeedback();
    setPayingId(item.membership.id);

    try {
      const response = await fetch("/api/mercadopago/create-member-preference", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tournamentId: item.tournament.id,
          teamId: item.team.id,
          userId: uid,
          source: "web_my_tournament_invites",
        }),
      });

      const data = (await response.json()) as CreateMemberPreferenceResponse;

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Não foi possível iniciar seu pagamento."
        );
      }

      if (!data.checkoutUrl) {
        throw new Error("O checkout não retornou uma URL válida.");
      }

      window.location.assign(data.checkoutUrl);
    } catch (err) {
      console.error("Erro ao iniciar pagamento individual:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível iniciar seu pagamento."
      );
    } finally {
      setPayingId(null);
    }
  }

  if (loading || authLoading) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <section style={styles.card}>
            <h1 style={styles.title}>Meus convites e inscrições</h1>
            <p style={styles.muted}>Carregando suas informações...</p>
          </section>
        </div>
      </main>
    );
  }

  if (!uid) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <section style={styles.card}>
            <h1 style={styles.title}>Meus convites e inscrições</h1>
            <p style={styles.muted}>
              Faça login para visualizar convites de equipe e pagar sua inscrição
              individual.
            </p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <div style={styles.headerRow}>
          <div>
            <h1 style={styles.title}>Meus convites e inscrições</h1>
            <p style={styles.subtitle}>
              Acompanhe convites de equipe, aceite sua participação e realize seu
              pagamento individual nos torneios.
            </p>
          </div>
        </div>

        <section style={styles.heroCard}>
          <div style={styles.statsGrid}>
            <StatCard label="Convites pendentes" value={String(stats.pendingInvites)} />
            <StatCard label="Equipes aceitas" value={String(stats.acceptedTeams)} />
            <StatCard label="Pagamentos pendentes" value={String(stats.paymentPending)} />
            <StatCard label="Inscrições pagas" value={String(stats.paid)} />
          </div>
        </section>

        <div style={styles.filtersRow}>
          <FilterButton
            active={tab === "pending_invites"}
            label="Convites pendentes"
            onClick={() => setTab("pending_invites")}
          />
          <FilterButton
            active={tab === "my_teams"}
            label="Minhas equipes"
            onClick={() => setTab("my_teams")}
          />
          <FilterButton
            active={tab === "payment_pending"}
            label="Pagamento pendente"
            onClick={() => setTab("payment_pending")}
          />
          <FilterButton
            active={tab === "all"}
            label="Todas"
            onClick={() => setTab("all")}
          />
        </div>

        {message ? (
          <section style={styles.feedbackSuccess}>{message}</section>
        ) : null}

        {error ? <section style={styles.feedbackError}>{error}</section> : null}

        {filteredItems.length === 0 ? (
          <section style={styles.card}>
            <div style={styles.emptyWrap}>
              <div style={styles.emptyEmoji}>🎣</div>
              <p style={styles.muted}>Nenhum item encontrado neste filtro.</p>
            </div>
          </section>
        ) : (
          <div style={styles.cardsGrid}>
            {filteredItems.map((item) => {
              const invite = item.invite;
              const membership = item.membership;
              const team = item.team;
              const tournament = item.tournament;

              const canAccept = invite?.status === "pending";
              const canPay =
                membership.inviteStatus === "accepted" &&
                membership.paymentStatus !== "approved" &&
                !!team &&
                !!tournament;

              return (
                <section key={membership.id} style={styles.card}>
                  <div style={styles.cardHeader}>
                    <div>
                      <h2 style={styles.cardTitle}>
                        {team?.teamName || "Equipe"}
                      </h2>
                      <p style={styles.cardSubtitle}>
                        {tournament?.title || "Torneio"}
                      </p>
                    </div>

                    <span style={getStatusBadgeStyle("team", team?.teamStatus || "building")}>
                      {getTeamStatusLabel(team?.teamStatus || "building")}
                    </span>
                  </div>

                  <div style={styles.infoGrid}>
                    <InfoCard
                      label="Capitão"
                      value={
                        team?.captainUsername
                          ? `@${team.captainUsername}`
                          : team?.captainDisplayName || "Não informado"
                      }
                    />
                    <InfoCard
                      label="Local"
                      value={tournament?.location || "Local não definido"}
                    />
                    <InfoCard
                      label="Espécie"
                      value={tournament?.species || "Espécie não definida"}
                    />
                    <InfoCard
                      label="Sua função"
                      value={membership.role === "captain" ? "Capitão" : "Membro"}
                    />
                    <InfoCard
                      label="Seu convite"
                      value={getInviteLabel(membership.inviteStatus)}
                    />
                    <InfoCard
                      label="Sua inscrição"
                      value={getRegistrationLabel(membership.registrationStatus)}
                    />
                    <InfoCard
                      label="Seu pagamento"
                      value={getPaymentLabel(membership.paymentStatus)}
                    />
                    <InfoCard
                      label="Valor"
                      value={formatMoney(membership.amount, membership.currency)}
                    />
                  </div>

                  <div style={styles.badgesRow}>
                    <span style={getStatusBadgeStyle("invite", membership.inviteStatus)}>
                      Convite: {getInviteLabel(membership.inviteStatus)}
                    </span>

                    <span style={getStatusBadgeStyle("payment", membership.paymentStatus)}>
                      Pagamento: {getPaymentLabel(membership.paymentStatus)}
                    </span>
                  </div>

                  <div style={styles.timelineBox}>
                    <MiniInfo
                      label="Convidado em"
                      value={formatDateTime(invite?.createdAt || membership.createdAt)}
                    />
                    <MiniInfo
                      label="Respondido em"
                      value={formatDateTime(invite?.respondedAt || membership.paymentApprovedAt)}
                    />
                    <MiniInfo
                      label="Pagamento aprovado"
                      value={formatDateTime(membership.paymentApprovedAt)}
                    />
                  </div>

                  <div style={styles.actionsRow}>
                    {canAccept ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleInviteAction(invite.id, "accept")}
                          disabled={actionLoadingId === invite.id || !!payingId}
                          style={styles.primaryButton}
                        >
                          {actionLoadingId === invite.id
                            ? "Processando..."
                            : "Aceitar convite"}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleInviteAction(invite.id, "decline")}
                          disabled={actionLoadingId === invite.id || !!payingId}
                          style={styles.dangerButton}
                        >
                          Recusar
                        </button>
                      </>
                    ) : null}

                    {canPay ? (
                      <button
                        type="button"
                        onClick={() => handlePay(item)}
                        disabled={payingId === membership.id || !!actionLoadingId}
                        style={styles.primaryButton}
                      >
                        {payingId === membership.id
                          ? "Abrindo pagamento..."
                          : "Pagar minha inscrição"}
                      </button>
                    ) : null}
                  </div>

                  {membership.inviteStatus === "accepted" &&
                  membership.paymentStatus === "approved" ? (
                    <p style={styles.successText}>
                      Sua participação está confirmada e seu pagamento foi aprovado.
                    </p>
                  ) : null}

                  {membership.inviteStatus === "declined" ? (
                    <p style={styles.errorText}>
                      Você recusou este convite e não faz mais parte desta equipe.
                    </p>
                  ) : null}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </main>
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

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.infoCard}>
      <p style={styles.infoLabel}>{label}</p>
      <p style={styles.infoValue}>{value}</p>
    </div>
  );
}

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.miniInfoCard}>
      <p style={styles.miniInfoLabel}>{label}</p>
      <p style={styles.miniInfoValue}>{value}</p>
    </div>
  );
}

function FilterButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
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
      {label}
    </button>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#F8FAFC",
    padding: 24,
  },
  container: {
    maxWidth: 1240,
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    flexWrap: "wrap",
  },
  title: {
    margin: 0,
    fontSize: 30,
    fontWeight: 900,
    color: "#0B3C5D",
  },
  subtitle: {
    margin: "8px 0 0 0",
    color: "#64748B",
    fontSize: 15,
    fontWeight: 600,
    lineHeight: 1.6,
    maxWidth: 760,
  },
  muted: {
    margin: 0,
    color: "#64748B",
    fontSize: 14,
    fontWeight: 600,
    lineHeight: 1.6,
  },
  heroCard: {
    background: "#FFFFFF",
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 20,
    padding: 20,
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
  },
  statCard: {
    background: "#F8FAFC",
    borderRadius: 14,
    padding: 14,
  },
  statLabel: {
    margin: 0,
    color: "#64748B",
    fontSize: 12,
    fontWeight: 800,
  },
  statValue: {
    margin: "6px 0 0 0",
    color: "#0F172A",
    fontSize: 18,
    fontWeight: 900,
    lineHeight: 1.4,
  },
  filtersRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  filterButton: {
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 999,
    padding: "10px 14px",
    background: "#FFFFFF",
    color: "#0F172A",
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
  },
  filterButtonActive: {
    background: "#0B3C5D",
    color: "#FFFFFF",
    border: "1px solid #0B3C5D",
  },
  feedbackSuccess: {
    background: "#DCFCE7",
    color: "#166534",
    borderRadius: 14,
    padding: 14,
    fontWeight: 800,
  },
  feedbackError: {
    background: "#FEE2E2",
    color: "#B91C1C",
    borderRadius: 14,
    padding: 14,
    fontWeight: 800,
  },
  cardsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
    gap: 16,
  },
  card: {
    background: "#FFFFFF",
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 20,
    padding: 20,
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
  },
  cardTitle: {
    margin: 0,
    color: "#0F172A",
    fontSize: 20,
    fontWeight: 900,
  },
  cardSubtitle: {
    margin: "6px 0 0 0",
    color: "#64748B",
    fontSize: 14,
    fontWeight: 700,
    lineHeight: 1.5,
  },
  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  },
  infoCard: {
    background: "#F8FAFC",
    borderRadius: 14,
    padding: 14,
  },
  infoLabel: {
    margin: 0,
    color: "#64748B",
    fontSize: 12,
    fontWeight: 800,
  },
  infoValue: {
    margin: "6px 0 0 0",
    color: "#0F172A",
    fontSize: 14,
    fontWeight: 900,
    lineHeight: 1.5,
  },
  badgesRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  statusBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 800,
    whiteSpace: "nowrap",
  },
  timelineBox: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 12,
  },
  miniInfoCard: {
    background: "#F8FAFC",
    borderRadius: 12,
    padding: 10,
  },
  miniInfoLabel: {
    margin: 0,
    color: "#64748B",
    fontSize: 11,
    fontWeight: 800,
  },
  miniInfoValue: {
    margin: "4px 0 0 0",
    color: "#0F172A",
    fontSize: 13,
    fontWeight: 800,
    lineHeight: 1.4,
  },
  actionsRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  primaryButton: {
    border: "none",
    borderRadius: 12,
    padding: "12px 16px",
    background: "#0B3C5D",
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
  },
  dangerButton: {
    border: "none",
    borderRadius: 12,
    padding: "12px 16px",
    background: "#B91C1C",
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
  },
  emptyWrap: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    alignItems: "center",
    justifyContent: "center",
    padding: "24px 12px",
    textAlign: "center",
  },
  emptyEmoji: {
    fontSize: 32,
  },
  successText: {
    margin: 0,
    color: "#166534",
    fontWeight: 700,
    lineHeight: 1.6,
  },
  errorText: {
    margin: 0,
    color: "#B91C1C",
    fontWeight: 700,
    lineHeight: 1.6,
  },
};