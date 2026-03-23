"use client";

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import { db } from "../../../../../src/lib/firebase";
import { useAuth } from "@/context/AuthContext";

type Props = {
  tournamentId: string;
};

type FirestoreTimestampLike = {
  toDate?: () => Date;
};

type TournamentDoc = {
  title?: string;
  location?: string;
  status?: string;
  species?: string;
  slug?: string;
};

type TeamStatus =
  | "building"
  | "pending_invites"
  | "pending_payments"
  | "confirmed"
  | "cancelled"
  | string;

type InviteStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "expired"
  | "cancelled"
  | string;

type MemberRegistrationStatus =
  | "invited"
  | "awaiting_payment"
  | "confirmed"
  | "payment_failed"
  | "cancelled"
  | "refunded"
  | "chargeback"
  | string;

type MemberPaymentStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled"
  | "refunded"
  | "error"
  | "charged_back"
  | string;

type TournamentTeam = {
  id: string;
  teamId: string;
  tournamentId: string;
  teamName: string;
  captainUserId: string | null;
  captainUsername: string | null;
  captainDisplayName: string | null;
  captainPhotoUrl: string | null;
  paymentMode: string;
  teamStatus: TeamStatus;
  totalSlots: number;
  acceptedMembersCount: number;
  paidMembersCount: number;
  amountPerParticipant: number | null;
  currency: string;
  createdAt: string | null;
};

type TournamentTeamMember = {
  id: string;
  teamId: string;
  tournamentId: string;
  userId: string;
  username: string | null;
  displayName: string | null;
  photoUrl: string | null;
  role: "captain" | "member" | string;
  inviteStatus: InviteStatus;
  registrationStatus: MemberRegistrationStatus;
  paymentStatus: MemberPaymentStatus;
  amount: number | null;
  currency: string;
  paymentId: string | null;
  invitedAt: string | null;
  respondedAt: string | null;
  paymentApprovedAt: string | null;
  createdAt: string | null;
};

type TeamWithMembers = TournamentTeam & {
  members: TournamentTeamMember[];
};

type TeamFilter =
  | "all"
  | "building"
  | "pending_invites"
  | "pending_payments"
  | "confirmed";

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

function normalizeMemberRegistrationStatus(
  value: unknown
): MemberRegistrationStatus {
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

function normalizeMemberPaymentStatus(value: unknown): MemberPaymentStatus {
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

function mapTeamDoc(id: string, raw: Record<string, unknown>): TournamentTeam {
  return {
    id,
    teamId: compactSpaces(raw.teamId) || id,
    tournamentId: compactSpaces(raw.tournamentId),
    teamName: compactSpaces(raw.teamName) || "Equipe sem nome",
    captainUserId: compactSpaces(raw.captainUserId) || null,
    captainUsername: compactSpaces(raw.captainUsername) || null,
    captainDisplayName: compactSpaces(raw.captainDisplayName) || null,
    captainPhotoUrl: compactSpaces(raw.captainPhotoUrl) || null,
    paymentMode: compactSpaces(raw.paymentMode) || "individual",
    teamStatus: normalizeTeamStatus(raw.teamStatus),
    totalSlots: Number(raw.totalSlots ?? 0) || 0,
    acceptedMembersCount: Number(raw.acceptedMembersCount ?? 0) || 0,
    paidMembersCount: Number(raw.paidMembersCount ?? 0) || 0,
    amountPerParticipant:
      typeof raw.amountPerParticipant === "number"
        ? raw.amountPerParticipant
        : null,
    currency: compactSpaces(raw.currency).toUpperCase() || "BRL",
    createdAt: toIsoStringSafe(raw.createdAt),
  };
}

function mapMemberDoc(
  id: string,
  raw: Record<string, unknown>
): TournamentTeamMember {
  return {
    id,
    teamId: compactSpaces(raw.teamId),
    tournamentId: compactSpaces(raw.tournamentId),
    userId: compactSpaces(raw.userId),
    username: compactSpaces(raw.username) || null,
    displayName: compactSpaces(raw.displayName) || null,
    photoUrl: compactSpaces(raw.photoUrl) || null,
    role: compactSpaces(raw.role) || "member",
    inviteStatus: normalizeInviteStatus(raw.inviteStatus),
    registrationStatus: normalizeMemberRegistrationStatus(raw.registrationStatus),
    paymentStatus: normalizeMemberPaymentStatus(raw.paymentStatus),
    amount: typeof raw.amount === "number" ? raw.amount : null,
    currency: compactSpaces(raw.currency).toUpperCase() || "BRL",
    paymentId: compactSpaces(raw.paymentId) || null,
    invitedAt: toIsoStringSafe(raw.invitedAt),
    respondedAt: toIsoStringSafe(raw.respondedAt),
    paymentApprovedAt: toIsoStringSafe(raw.paymentApprovedAt),
    createdAt: toIsoStringSafe(raw.createdAt),
  };
}

function getTournamentStatusLabel(status: string) {
  const normalized = compactSpaces(status).toLowerCase();

  if (normalized === "live") return "Ao vivo";
  if (normalized === "finished") return "Finalizado";
  if (normalized === "draft") return "Rascunho";
  return "Agendado";
}

function getTournamentStatusBadge(status: string): CSSProperties {
  const normalized = compactSpaces(status).toLowerCase();

  if (normalized === "live") {
    return {
      ...styles.statusBadge,
      background: "#DCFCE7",
      color: "#166534",
    };
  }

  if (normalized === "finished") {
    return {
      ...styles.statusBadge,
      background: "#E5E7EB",
      color: "#374151",
    };
  }

  if (normalized === "draft") {
    return {
      ...styles.statusBadge,
      background: "#DBEAFE",
      color: "#1D4ED8",
    };
  }

  return {
    ...styles.statusBadge,
    background: "#FEF3C7",
    color: "#92400E",
  };
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

function getTeamStatusBadgeStyle(status: TeamStatus): CSSProperties {
  if (status === "confirmed") {
    return {
      ...styles.statusBadge,
      background: "#DCFCE7",
      color: "#166534",
    };
  }

  if (status === "pending_invites") {
    return {
      ...styles.statusBadge,
      background: "#DBEAFE",
      color: "#1D4ED8",
    };
  }

  if (status === "pending_payments") {
    return {
      ...styles.statusBadge,
      background: "#FEF3C7",
      color: "#92400E",
    };
  }

  if (status === "cancelled") {
    return {
      ...styles.statusBadge,
      background: "#FEE2E2",
      color: "#B91C1C",
    };
  }

  return {
    ...styles.statusBadge,
    background: "#E5E7EB",
    color: "#374151",
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

function getInviteBadgeStyle(status: InviteStatus): CSSProperties {
  if (status === "accepted") {
    return {
      ...styles.statusBadge,
      background: "#DCFCE7",
      color: "#166534",
    };
  }

  if (status === "declined" || status === "cancelled") {
    return {
      ...styles.statusBadge,
      background: "#FEE2E2",
      color: "#B91C1C",
    };
  }

  if (status === "expired") {
    return {
      ...styles.statusBadge,
      background: "#E5E7EB",
      color: "#374151",
    };
  }

  return {
    ...styles.statusBadge,
    background: "#DBEAFE",
    color: "#1D4ED8",
  };
}

function getMemberRegistrationLabel(status: MemberRegistrationStatus) {
  switch (status) {
    case "confirmed":
      return "Confirmado";
    case "awaiting_payment":
      return "Aguardando pagamento";
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

function getMemberPaymentLabel(status: MemberPaymentStatus) {
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

function getMemberPaymentBadgeStyle(status: MemberPaymentStatus): CSSProperties {
  if (status === "approved") {
    return {
      ...styles.statusBadge,
      background: "#DCFCE7",
      color: "#166534",
    };
  }

  if (status === "rejected" || status === "cancelled" || status === "error") {
    return {
      ...styles.statusBadge,
      background: "#FEE2E2",
      color: "#B91C1C",
    };
  }

  if (status === "refunded" || status === "charged_back") {
    return {
      ...styles.statusBadge,
      background: "#E5E7EB",
      color: "#374151",
    };
  }

  return {
    ...styles.statusBadge,
    background: "#DBEAFE",
    color: "#1D4ED8",
  };
}

export default function TournamentTeamsClient({ tournamentId }: Props) {
  const router = useRouter();
  const { uid, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);

  const [tournamentTitle, setTournamentTitle] = useState("Torneio");
  const [tournamentLocation, setTournamentLocation] = useState(
    "Local não definido"
  );
  const [tournamentStatus, setTournamentStatus] = useState("scheduled");
  const [tournamentSpecies, setTournamentSpecies] = useState(
    "Espécie não definida"
  );

  const [teams, setTeams] = useState<TeamWithMembers[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [filter, setFilter] = useState<TeamFilter>("all");

  const [error, setError] = useState<string | null>(null);

  const selectedTeam = useMemo(
    () => teams.find((team) => team.id === selectedTeamId) || null,
    [teams, selectedTeamId]
  );

  const filteredTeams = useMemo(() => {
    if (filter === "all") return teams;
    return teams.filter((team) => team.teamStatus === filter);
  }, [teams, filter]);

  const stats = useMemo(() => {
    return {
      total: teams.length,
      building: teams.filter((team) => team.teamStatus === "building").length,
      pendingInvites: teams.filter((team) => team.teamStatus === "pending_invites").length,
      pendingPayments: teams.filter((team) => team.teamStatus === "pending_payments").length,
      confirmed: teams.filter((team) => team.teamStatus === "confirmed").length,
      totalAcceptedMembers: teams.reduce(
        (acc, team) => acc + team.acceptedMembersCount,
        0
      ),
      totalPaidMembers: teams.reduce(
        (acc, team) => acc + team.paidMembersCount,
        0
      ),
    };
  }, [teams]);

  useEffect(() => {
    if (authLoading) return;

    if (!uid) {
      router.push("/login");
      return;
    }

    void loadPage();
  }, [authLoading, uid, tournamentId]);

  async function loadPage() {
    setLoading(true);
    setError(null);

    try {
      if (!compactSpaces(tournamentId)) {
        setError("ID do torneio inválido.");
        return;
      }

      await Promise.all([loadTournament(), loadTeamsAndMembers()]);
    } catch (err) {
      console.error("Erro ao carregar equipes:", err);
      setError("Não foi possível carregar as equipes do torneio.");
    } finally {
      setLoading(false);
    }
  }

  async function loadTournament() {
    const ref = doc(db, "tournaments", tournamentId);
    const snap = await getDoc(ref);

    if (!snap.exists()) return;

    const data = snap.data() as TournamentDoc;
    setTournamentTitle(data.title || "Torneio");
    setTournamentLocation(data.location || "Local não definido");
    setTournamentStatus(data.status || "scheduled");
    setTournamentSpecies(data.species || "Espécie não definida");
  }

  async function loadTeamsAndMembers() {
    const teamsRef = collection(db, "tournamentTeams");
    const teamsQuery = query(
      teamsRef,
      where("tournamentId", "==", tournamentId),
      orderBy("createdAt", "desc")
    );

    const teamsSnap = await getDocs(teamsQuery);

    const mappedTeams = teamsSnap.docs.map((item) =>
      mapTeamDoc(item.id, item.data() as Record<string, unknown>)
    );

    const membersSnap = await getDocs(
      query(
        collection(db, "tournamentTeamMembers"),
        where("tournamentId", "==", tournamentId)
      )
    );

    const members = membersSnap.docs.map((item) =>
      mapMemberDoc(item.id, item.data() as Record<string, unknown>)
    );

    const membersByTeamId = new Map<string, TournamentTeamMember[]>();

    for (const member of members) {
      const list = membersByTeamId.get(member.teamId) || [];
      list.push(member);
      membersByTeamId.set(member.teamId, list);
    }

    const items: TeamWithMembers[] = mappedTeams.map((team) => ({
      ...team,
      members: (membersByTeamId.get(team.teamId) || []).sort((a, b) => {
        if (a.role === "captain" && b.role !== "captain") return -1;
        if (a.role !== "captain" && b.role === "captain") return 1;
        return (a.displayName || a.username || "").localeCompare(
          b.displayName || b.username || "",
          "pt-BR"
        );
      }),
    }));

    setTeams(items);

    setSelectedTeamId((prev) => {
      if (prev && items.some((item) => item.id === prev)) return prev;
      return items[0]?.id || null;
    });
  }

  if (authLoading || loading) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <div style={styles.card}>
            <h1 style={styles.title}>Equipes e inscrições</h1>
            <p style={styles.muted}>Carregando painel...</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <div style={styles.headerRow}>
          <div>
            <h1 style={styles.title}>Equipes e inscrições</h1>
            <p style={styles.subtitle}>
              Painel operacional para acompanhar equipes, convites, pagamentos
              individuais e status geral do torneio.
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push(`/seller/tournaments/${tournamentId}`)}
            style={styles.secondaryButton}
          >
            Voltar ao torneio
          </button>
        </div>

        <div style={styles.heroCard}>
          <div style={styles.heroTop}>
            <div>
              <h2 style={styles.heroTitle}>{tournamentTitle}</h2>
              <p style={styles.heroLocation}>{tournamentLocation}</p>
            </div>

            <div style={styles.badgesWrap}>
              <span style={styles.badgeBlue}>🏆 {tournamentId}</span>
              <span style={styles.badgeGreen}>Equipes</span>
              <span style={getTournamentStatusBadge(tournamentStatus)}>
                {getTournamentStatusLabel(tournamentStatus)}
              </span>
            </div>
          </div>

          <div style={styles.statsGrid}>
            <StatCard label="Espécie" value={tournamentSpecies} />
            <StatCard label="Total equipes" value={String(stats.total)} />
            <StatCard label="Em montagem" value={String(stats.building)} />
            <StatCard
              label="Convites pendentes"
              value={String(stats.pendingInvites)}
            />
            <StatCard
              label="Pagamentos pendentes"
              value={String(stats.pendingPayments)}
            />
            <StatCard label="Confirmadas" value={String(stats.confirmed)} />
            <StatCard
              label="Membros aceitos"
              value={String(stats.totalAcceptedMembers)}
            />
            <StatCard
              label="Membros pagos"
              value={String(stats.totalPaidMembers)}
            />
          </div>
        </div>

        <div style={styles.filtersRow}>
          <FilterButton
            active={filter === "all"}
            label="Todas"
            onClick={() => setFilter("all")}
          />
          <FilterButton
            active={filter === "building"}
            label="Em montagem"
            onClick={() => setFilter("building")}
          />
          <FilterButton
            active={filter === "pending_invites"}
            label="Aguardando convites"
            onClick={() => setFilter("pending_invites")}
          />
          <FilterButton
            active={filter === "pending_payments"}
            label="Aguardando pagamentos"
            onClick={() => setFilter("pending_payments")}
          />
          <FilterButton
            active={filter === "confirmed"}
            label="Confirmadas"
            onClick={() => setFilter("confirmed")}
          />
        </div>

        {error ? (
          <section style={styles.card}>
            <p style={styles.errorText}>{error}</p>
          </section>
        ) : null}

        <div style={styles.grid}>
          <section style={styles.card}>
            <div style={styles.sectionHeader}>
              <h3 style={styles.sectionTitle}>Lista de equipes</h3>
              <p style={styles.sectionSubtitle}>
                Selecione uma equipe para acompanhar os membros, convites e
                pagamentos individuais.
              </p>
            </div>

            {filteredTeams.length === 0 ? (
              <div style={styles.emptyWrap}>
                <div style={styles.emptyEmoji}>👥</div>
                <p style={styles.muted}>
                  Nenhuma equipe encontrada neste filtro.
                </p>
              </div>
            ) : (
              <div style={styles.teamList}>
                {filteredTeams.map((team) => {
                  const isActive = team.id === selectedTeamId;

                  return (
                    <button
                      key={team.id}
                      type="button"
                      onClick={() => setSelectedTeamId(team.id)}
                      style={{
                        ...styles.teamRowButton,
                        ...(isActive ? styles.teamRowButtonActive : {}),
                      }}
                    >
                      <div style={styles.teamRowTop}>
                        <strong style={styles.teamName}>{team.teamName}</strong>

                        <div style={styles.teamBadges}>
                          <span style={getTeamStatusBadgeStyle(team.teamStatus)}>
                            {getTeamStatusLabel(team.teamStatus)}
                          </span>
                        </div>
                      </div>

                      <div style={styles.teamMetaGrid}>
                        <MiniInfo
                          label="Capitão"
                          value={
                            team.captainUsername
                              ? `@${team.captainUsername}`
                              : team.captainDisplayName || "—"
                          }
                        />
                        <MiniInfo
                          label="Aceitos"
                          value={`${team.acceptedMembersCount}/${team.totalSlots || team.members.length}`}
                        />
                        <MiniInfo
                          label="Pagos"
                          value={`${team.paidMembersCount}/${team.acceptedMembersCount || 0}`}
                        />
                        <MiniInfo
                          label="Valor"
                          value={formatMoney(
                            team.amountPerParticipant,
                            team.currency
                          )}
                        />
                        <MiniInfo
                          label="Pagamento"
                          value={
                            team.paymentMode === "individual"
                              ? "Individual"
                              : team.paymentMode
                          }
                        />
                        <MiniInfo
                          label="Criada em"
                          value={formatDateTime(team.createdAt)}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section style={styles.card}>
            <div style={styles.sectionHeader}>
              <h3 style={styles.sectionTitle}>Detalhe da equipe</h3>
              <p style={styles.sectionSubtitle}>
                Visão completa do capitão, integrantes, convites e pagamentos.
              </p>
            </div>

            {!selectedTeam ? (
              <p style={styles.muted}>Selecione uma equipe para visualizar.</p>
            ) : (
              <div style={styles.detailWrap}>
                <div style={styles.infoGrid}>
                  <InfoCard label="Equipe" value={selectedTeam.teamName} />
                  <InfoCard
                    label="Capitão"
                    value={
                      selectedTeam.captainUsername
                        ? `@${selectedTeam.captainUsername}`
                        : selectedTeam.captainDisplayName || "Não informado"
                    }
                  />
                  <InfoCard
                    label="Status da equipe"
                    value={getTeamStatusLabel(selectedTeam.teamStatus)}
                  />
                  <InfoCard
                    label="Valor por participante"
                    value={formatMoney(
                      selectedTeam.amountPerParticipant,
                      selectedTeam.currency
                    )}
                  />
                </div>

                <div style={styles.membersBox}>
                  <p style={styles.membersTitle}>Integrantes da equipe</p>

                  {selectedTeam.members.length === 0 ? (
                    <p style={styles.muted}>Nenhum integrante encontrado.</p>
                  ) : (
                    <div style={styles.membersTable}>
                      <div style={styles.membersTableHeader}>
                        <span style={styles.membersHeaderCell}>
                          Participante
                        </span>
                        <span style={styles.membersHeaderCell}>Função</span>
                        <span style={styles.membersHeaderCell}>Convite</span>
                        <span style={styles.membersHeaderCell}>Inscrição</span>
                        <span style={styles.membersHeaderCell}>Pagamento</span>
                        <span style={styles.membersHeaderCell}>Valor</span>
                      </div>

                      {selectedTeam.members.map((member) => (
                        <div key={member.id} style={styles.membersTableRow}>
                          <div style={styles.memberIdentity}>
                            <span style={styles.memberName}>
                              {member.displayName ||
                                (member.username
                                  ? `@${member.username}`
                                  : "Usuário")}
                            </span>
                            <span style={styles.memberSubtext}>
                              {member.username
                                ? `@${member.username}`
                                : member.userId}
                            </span>
                          </div>

                          <span style={styles.memberRoleBadge}>
                            {member.role === "captain" ? "Capitão" : "Membro"}
                          </span>

                          <span style={getInviteBadgeStyle(member.inviteStatus)}>
                            {getInviteLabel(member.inviteStatus)}
                          </span>

                          <span style={styles.memberStatusText}>
                            {getMemberRegistrationLabel(
                              member.registrationStatus
                            )}
                          </span>

                          <span
                            style={getMemberPaymentBadgeStyle(
                              member.paymentStatus
                            )}
                          >
                            {getMemberPaymentLabel(member.paymentStatus)}
                          </span>

                          <span style={styles.memberValueText}>
                            {formatMoney(member.amount, member.currency)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={styles.timelineGrid}>
                  <MiniInfo
                    label="Total de integrantes"
                    value={String(selectedTeam.members.length)}
                  />
                  <MiniInfo
                    label="Aceitos"
                    value={`${selectedTeam.acceptedMembersCount}`}
                  />
                  <MiniInfo
                    label="Pagos"
                    value={`${selectedTeam.paidMembersCount}`}
                  />
                  <MiniInfo
                    label="Criada em"
                    value={formatDateTime(selectedTeam.createdAt)}
                  />
                </div>
              </div>
            )}
          </section>
        </div>
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
    maxWidth: 1440,
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
    maxWidth: 820,
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
  heroTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    flexWrap: "wrap",
  },
  heroTitle: {
    margin: 0,
    fontSize: 22,
    fontWeight: 900,
    color: "#0F172A",
  },
  heroLocation: {
    margin: "8px 0 0 0",
    color: "#64748B",
    fontSize: 15,
    fontWeight: 700,
  },
  badgesWrap: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  badgeBlue: {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 12px",
    borderRadius: 999,
    background: "#EAF2F7",
    color: "#0B3C5D",
    fontSize: 13,
    fontWeight: 800,
  },
  badgeGreen: {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 12px",
    borderRadius: 999,
    background: "#DCFCE7",
    color: "#166534",
    fontSize: 13,
    fontWeight: 800,
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
  statsGrid: {
    marginTop: 16,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
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
  grid: {
    display: "grid",
    gridTemplateColumns: "430px minmax(0, 1fr)",
    gap: 16,
  },
  card: {
    background: "#FFFFFF",
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 20,
    padding: 20,
    minWidth: 0,
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 900,
    color: "#0F172A",
  },
  sectionSubtitle: {
    margin: "8px 0 0 0",
    color: "#64748B",
    fontSize: 14,
    fontWeight: 600,
    lineHeight: 1.6,
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
  teamList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  teamRowButton: {
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 16,
    background: "#FFFFFF",
    padding: 14,
    textAlign: "left",
    cursor: "pointer",
  },
  teamRowButtonActive: {
    border: "1px solid #0B3C5D",
    background: "#FDFEFF",
    boxShadow: "0 0 0 3px rgba(11,60,93,0.06)",
  },
  teamRowTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  teamName: {
    color: "#0F172A",
    fontSize: 15,
    fontWeight: 900,
  },
  teamBadges: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  teamMetaGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 8,
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
  detailWrap: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
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
  membersBox: {
    background: "#F8FAFC",
    borderRadius: 16,
    padding: 16,
  },
  membersTitle: {
    margin: 0,
    color: "#0F172A",
    fontSize: 14,
    fontWeight: 900,
    marginBottom: 12,
  },
  membersTable: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  membersTableHeader: {
    display: "grid",
    gridTemplateColumns:
      "minmax(180px, 1.4fr) 100px 110px 170px 120px 120px",
    gap: 10,
    padding: "0 0 8px 0",
    borderBottom: "1px solid rgba(15,23,42,0.08)",
  },
  membersHeaderCell: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: 800,
  },
  membersTableRow: {
    display: "grid",
    gridTemplateColumns:
      "minmax(180px, 1.4fr) 100px 110px 170px 120px 120px",
    gap: 10,
    alignItems: "center",
    background: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    border: "1px solid rgba(15,23,42,0.06)",
  },
  memberIdentity: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    minWidth: 0,
  },
  memberName: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: 900,
    lineHeight: 1.4,
  },
  memberSubtext: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: 700,
    lineHeight: 1.4,
  },
  memberRoleBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    padding: "6px 10px",
    background: "#EAF2F7",
    color: "#0B3C5D",
    fontSize: 12,
    fontWeight: 800,
    whiteSpace: "nowrap",
  },
  memberStatusText: {
    color: "#0F172A",
    fontSize: 13,
    fontWeight: 800,
    lineHeight: 1.4,
  },
  memberValueText: {
    color: "#0F172A",
    fontSize: 13,
    fontWeight: 800,
    lineHeight: 1.4,
  },
  timelineGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
  },
  secondaryButton: {
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 12,
    padding: "12px 16px",
    background: "#FFFFFF",
    color: "#0F172A",
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
    textDecoration: "none",
  },
  errorText: {
    margin: 0,
    color: "#B91C1C",
    fontWeight: 700,
    fontSize: 14,
  },
};