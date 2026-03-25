"use client";

import AppSessionBridge from "../../seller/tournaments/components/AppSessionBridge";
import { useAuth } from "@/context/AuthContext";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { db } from "../../../src/lib/firebase";

type PageProps = {
  params: {
    inviteId: string;
  };
};

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

type TournamentPublic = {
  id: string;
  slug: string | null;
  title: string;
  subtitle: string | null;
  location: string;
  description: string | null;
  coverImageUrl: string | null;
  species: string;
  minSizeCm: number;
  validFishCount: number;
  rules: string[];
  status: string;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  boundaryEnabled: boolean;
  entryFee: number | null;
  currency: string;
};

type InviteDoc = {
  id: string;
  inviteId: string;
  tournamentId: string;
  tournamentSlug: string | null;
  tournamentTitle: string | null;
  teamId: string;
  teamName: string | null;
  teamMemberDocId: string | null;
  invitedUserId: string;
  invitedUsername: string | null;
  invitedDisplayName: string | null;
  invitedByUserId: string | null;
  invitedByUsername: string | null;
  status: InviteStatus;
  amount: number | null;
  currency: string;
  paymentMode: string;
  createdAt: string | null;
  updatedAt: string | null;
  respondedAt: string | null;
};

type TeamDoc = {
  id: string;
  teamId: string;
  tournamentId: string;
  teamName: string;
  captainUserId: string | null;
  captainUsername: string | null;
  captainDisplayName: string | null;
  captainPhotoUrl: string | null;
  paymentMode: string;
  teamStatus: string;
  totalSlots: number;
  acceptedMembersCount: number;
  paidMembersCount: number;
  amountPerParticipant: number | null;
  currency: string;
};

type TeamMemberDoc = {
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

type CreateMemberPreferenceResponse = {
  success: boolean;
  checkoutUrl?: string;
  preferenceId?: string;
  externalReference?: string;
  message?: string;
};

type InviteRespondResponse = {
  success: boolean;
  teamId?: string;
  tournamentId?: string;
  action?: string;
  registrationStatus?: string;
  message?: string;
};

function compactSpaces(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function assertRequired(value: unknown, field: string) {
  const normalized = compactSpaces(value);
  if (!normalized) {
    throw new Error(`Campo obrigatório inválido: ${field}`);
  }
  return normalized;
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
  if (typeof value !== "number" || Number.isNaN(value)) return "A definir";

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  }).format(value);
}

function normalizeRules(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => compactSpaces(item)).filter(Boolean);
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

function getTournamentStatusLabel(status: string) {
  const normalized = compactSpaces(status).toLowerCase();

  if (normalized === "live") return "Ao vivo";
  if (normalized === "finished") return "Finalizado";
  if (normalized === "draft") return "Rascunho";
  return "Agendado";
}

function getTournamentStatusBadgeStyle(status: string): CSSProperties {
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

function getPaymentBadgeStyle(status: MemberPaymentStatus): CSSProperties {
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

function canStartPayment(params: {
  inviteStatus: InviteStatus;
  registrationStatus: MemberRegistrationStatus;
  paymentStatus: MemberPaymentStatus;
}) {
  if (params.inviteStatus !== "accepted") return false;
  if (params.paymentStatus === "approved") return false;

  return (
    params.registrationStatus === "awaiting_payment" ||
    params.registrationStatus === "payment_failed"
  );
}

export default function TeamInvitePage({ params }: PageProps) {
  const { uid, loading: authLoading } = useAuth();

  const inviteId = compactSpaces(params.inviteId);

  const [loading, setLoading] = useState(true);
  const [respondingAction, setRespondingAction] = useState<"accept" | "decline" | null>(null);
  const [paying, setPaying] = useState(false);

  const [tournament, setTournament] = useState<TournamentPublic | null>(null);
  const [invite, setInvite] = useState<InviteDoc | null>(null);
  const [team, setTeam] = useState<TeamDoc | null>(null);
  const [members, setMembers] = useState<TeamMemberDoc[]>([]);
  const [currentMember, setCurrentMember] = useState<TeamMemberDoc | null>(null);

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const highlightedRules = useMemo(() => {
    if (!tournament) return [];
    return tournament.rules.slice(0, 4);
  }, [tournament]);

  const captainMember = useMemo(() => {
    return members.find((member) => member.role === "captain") || null;
  }, [members]);

  const paymentAllowed = useMemo(() => {
    if (!currentMember) return false;

    return canStartPayment({
      inviteStatus: currentMember.inviteStatus,
      registrationStatus: currentMember.registrationStatus,
      paymentStatus: currentMember.paymentStatus,
    });
  }, [currentMember]);

  useEffect(() => {
    if (!inviteId) {
      setLoading(false);
      setError("Convite inválido.");
      return;
    }

    if (authLoading) return;
    if (!uid) return;

    void loadPage();
  }, [inviteId, uid, authLoading]);

  async function loadPage() {
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (!inviteId) {
        setError("Convite inválido.");
        return;
      }

      if (!uid) {
        return;
      }

      const inviteRef = doc(db, "tournamentInvites", inviteId);
      const inviteSnap = await getDoc(inviteRef);

      if (!inviteSnap.exists()) {
        setError("Convite não encontrado.");
        return;
      }

      const inviteRaw = inviteSnap.data() as Record<string, unknown>;

      const mappedInvite: InviteDoc = {
        id: inviteSnap.id,
        inviteId: compactSpaces(inviteRaw.inviteId) || inviteSnap.id,
        tournamentId: assertRequired(inviteRaw.tournamentId, "invite.tournamentId"),
        tournamentSlug: compactSpaces(inviteRaw.tournamentSlug) || null,
        tournamentTitle: compactSpaces(inviteRaw.tournamentTitle) || null,
        teamId: assertRequired(inviteRaw.teamId, "invite.teamId"),
        teamName: compactSpaces(inviteRaw.teamName) || null,
        teamMemberDocId: compactSpaces(inviteRaw.teamMemberDocId) || null,
        invitedUserId: assertRequired(inviteRaw.invitedUserId, "invite.invitedUserId"),
        invitedUsername: compactSpaces(inviteRaw.invitedUsername) || null,
        invitedDisplayName: compactSpaces(inviteRaw.invitedDisplayName) || null,
        invitedByUserId: compactSpaces(inviteRaw.invitedByUserId) || null,
        invitedByUsername: compactSpaces(inviteRaw.invitedByUsername) || null,
        status: normalizeInviteStatus(inviteRaw.status),
        amount: typeof inviteRaw.amount === "number" ? inviteRaw.amount : null,
        currency: compactSpaces(inviteRaw.currency).toUpperCase() || "BRL",
        paymentMode: compactSpaces(inviteRaw.paymentMode) || "individual",
        createdAt: toIsoStringSafe(inviteRaw.createdAt),
        updatedAt: toIsoStringSafe(inviteRaw.updatedAt),
        respondedAt: toIsoStringSafe(inviteRaw.respondedAt),
      };

      setInvite(mappedInvite);

      if (mappedInvite.invitedUserId !== uid) {
        setError("Este convite não pertence ao usuário logado.");
        return;
      }

      const [tournamentSnap, teamSnap, membersSnap] = await Promise.all([
        getDoc(doc(db, "tournaments", mappedInvite.tournamentId)),
        getDoc(doc(db, "tournamentTeams", mappedInvite.teamId)),
        getDocs(
          query(
            collection(db, "tournamentTeamMembers"),
            where("teamId", "==", mappedInvite.teamId)
          )
        ),
      ]);

      if (!tournamentSnap.exists()) {
        setError("Torneio não encontrado.");
        return;
      }

      if (!teamSnap.exists()) {
        setError("Equipe não encontrada.");
        return;
      }

      const tournamentRaw = tournamentSnap.data() as Record<string, unknown>;
      const entryFee =
        typeof tournamentRaw.entryFee === "number"
          ? tournamentRaw.entryFee
          : typeof tournamentRaw.entryFeeAmount === "number"
            ? tournamentRaw.entryFeeAmount
            : typeof tournamentRaw.price === "number"
              ? tournamentRaw.price
              : null;

      const mappedTournament: TournamentPublic = {
        id: tournamentSnap.id,
        slug: compactSpaces(tournamentRaw.slug) || null,
        title: compactSpaces(tournamentRaw.title || mappedInvite.tournamentTitle || "Torneio"),
        subtitle: compactSpaces(tournamentRaw.subtitle) || null,
        location: compactSpaces(tournamentRaw.location || "Local não definido"),
        description: tournamentRaw.description ? String(tournamentRaw.description) : null,
        coverImageUrl: tournamentRaw.coverImageUrl
          ? String(tournamentRaw.coverImageUrl)
          : null,
        species: compactSpaces(tournamentRaw.species || "Espécie não definida"),
        minSizeCm: Number(tournamentRaw.minSizeCm ?? 0) || 0,
        validFishCount: Number(tournamentRaw.validFishCount ?? 3) || 3,
        rules: normalizeRules(tournamentRaw.rules),
        status: compactSpaces(tournamentRaw.status || "scheduled"),
        scheduledStartAt: toIsoStringSafe(tournamentRaw.scheduledStartAt),
        scheduledEndAt: toIsoStringSafe(tournamentRaw.scheduledEndAt),
        boundaryEnabled: tournamentRaw.boundaryEnabled !== false,
        entryFee,
        currency: compactSpaces(tournamentRaw.currency).toUpperCase() || "BRL",
      };

      setTournament(mappedTournament);

      const teamRaw = teamSnap.data() as Record<string, unknown>;
      const mappedTeam: TeamDoc = {
        id: teamSnap.id,
        teamId: compactSpaces(teamRaw.teamId) || teamSnap.id,
        tournamentId: assertRequired(teamRaw.tournamentId, "team.tournamentId"),
        teamName: compactSpaces(teamRaw.teamName) || mappedInvite.teamName || "Equipe sem nome",
        captainUserId: compactSpaces(teamRaw.captainUserId) || null,
        captainUsername: compactSpaces(teamRaw.captainUsername) || null,
        captainDisplayName: compactSpaces(teamRaw.captainDisplayName) || null,
        captainPhotoUrl: compactSpaces(teamRaw.captainPhotoUrl) || null,
        paymentMode: compactSpaces(teamRaw.paymentMode) || "individual",
        teamStatus: compactSpaces(teamRaw.teamStatus) || "building",
        totalSlots: Number(teamRaw.totalSlots ?? 0) || 0,
        acceptedMembersCount: Number(teamRaw.acceptedMembersCount ?? 0) || 0,
        paidMembersCount: Number(teamRaw.paidMembersCount ?? 0) || 0,
        amountPerParticipant:
          typeof teamRaw.amountPerParticipant === "number"
            ? teamRaw.amountPerParticipant
            : null,
        currency: compactSpaces(teamRaw.currency).toUpperCase() || "BRL",
      };

      setTeam(mappedTeam);

      const mappedMembers = membersSnap.docs
        .map((item) => {
          const raw = item.data() as Record<string, unknown>;

          const userIdValue = compactSpaces(raw.userId);
          const teamIdValue = compactSpaces(raw.teamId);
          const tournamentIdValue = compactSpaces(raw.tournamentId);

          if (!userIdValue || !teamIdValue || !tournamentIdValue) {
            return null;
          }

          return {
            id: item.id,
            teamId: teamIdValue,
            tournamentId: tournamentIdValue,
            userId: userIdValue,
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
          } as TeamMemberDoc;
        })
        .filter(Boolean)
        .sort((a, b) => {
          if (a!.role === "captain" && b!.role !== "captain") return -1;
          if (a!.role !== "captain" && b!.role === "captain") return 1;

          return (a!.displayName || a!.username || "").localeCompare(
            b!.displayName || b!.username || "",
            "pt-BR"
          );
        }) as TeamMemberDoc[];

      setMembers(mappedMembers);

      let current: TeamMemberDoc | null = null;

      if (mappedInvite.teamMemberDocId) {
        current =
          mappedMembers.find((member) => member.id === mappedInvite.teamMemberDocId) ||
          null;
      }

      if (!current) {
        current =
          mappedMembers.find((member) => member.userId === uid) || null;
      }

      setCurrentMember(current);

      if (!current) {
        setError("Participante não encontrado nesta equipe.");
      }
    } catch (err) {
      console.error("Erro ao carregar convite:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível carregar os dados do convite."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleRespondInvite(action: "accept" | "decline") {
    if (!invite || !uid) return;

    setRespondingAction(action);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/tournaments/team/invite/respond", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inviteId: invite.inviteId,
          action,
        }),
      });

      const data = (await response.json()) as InviteRespondResponse;

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Não foi possível responder ao convite.");
      }

      setMessage(
        action === "accept"
          ? "Convite aceito com sucesso. Agora você já pode pagar sua inscrição."
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
      setRespondingAction(null);
    }
  }

  async function handleStartPayment() {
    if (!tournament || !team || !currentMember || !uid) return;

    setPaying(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/mercadopago/create-member-preference", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tournamentId: tournament.id,
          teamId: team.teamId,
          source: "team_invite_checkout_page",
        }),
      });

      const data = (await response.json()) as CreateMemberPreferenceResponse;

      if (!response.ok || !data.success || !data.checkoutUrl) {
        throw new Error(data.message || "Não foi possível iniciar o pagamento.");
      }

      setMessage("Redirecionando para o pagamento...");
      window.location.assign(data.checkoutUrl);
    } catch (err) {
      console.error("Erro ao iniciar pagamento individual:", err);
      setMessage(null);
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível iniciar o pagamento."
      );
    } finally {
      setPaying(false);
    }
  }

  if (authLoading || loading) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <AppSessionBridge />
          <section style={styles.card}>
            <h1 style={styles.title}>Carregando convite...</h1>
            <p style={styles.muted}>Aguarde enquanto buscamos os dados da sua equipe.</p>
          </section>
        </div>
      </main>
    );
  }

  if (!uid) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <AppSessionBridge />
          <section style={styles.card}>
            <h1 style={styles.title}>Faça login para continuar</h1>
            <p style={styles.errorText}>
              Entre com a conta convidada para visualizar e responder este convite.
            </p>
          </section>
        </div>
      </main>
    );
  }

  if (error && (!invite || !team || !tournament)) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <AppSessionBridge />
          <section style={styles.card}>
            <h1 style={styles.title}>Convite indisponível</h1>
            <p style={styles.errorText}>{error}</p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <AppSessionBridge />

        <section style={styles.heroCard}>
          {tournament?.coverImageUrl ? (
            <div
              style={{
                ...styles.cover,
                backgroundImage: `url(${tournament.coverImageUrl})`,
              }}
            />
          ) : null}

          <div style={styles.heroContent}>
            <div style={styles.heroTop}>
              <div>
                <span style={styles.eyebrow}>Convite da equipe</span>
                <h1 style={styles.title}>{tournament?.title || "Torneio"}</h1>
                {tournament?.subtitle ? (
                  <p style={styles.subtitle}>{tournament.subtitle}</p>
                ) : null}
                <p style={styles.location}>{tournament?.location || "Local não definido"}</p>
              </div>

              <div style={styles.heroBadgeColumn}>
                <span style={getTournamentStatusBadgeStyle(tournament?.status || "scheduled")}>
                  {getTournamentStatusLabel(tournament?.status || "scheduled")}
                </span>
                <span style={getInviteBadgeStyle(currentMember?.inviteStatus || invite?.status || "pending")}>
                  Convite: {getInviteLabel(currentMember?.inviteStatus || invite?.status || "pending")}
                </span>
                <span style={getPaymentBadgeStyle(currentMember?.paymentStatus || "pending")}>
                  Pagamento: {getMemberPaymentLabel(currentMember?.paymentStatus || "pending")}
                </span>
              </div>
            </div>

            <div style={styles.infoGrid}>
              <InfoCard label="Equipe" value={team?.teamName || "Equipe"} />
              <InfoCard
                label="Capitão"
                value={
                  captainMember?.username
                    ? `@${captainMember.username}`
                    : captainMember?.displayName || team?.captainDisplayName || "Não informado"
                }
              />
              <InfoCard
                label="Sua inscrição"
                value={formatMoney(
                  currentMember?.amount ?? invite?.amount ?? team?.amountPerParticipant ?? null,
                  currentMember?.currency || invite?.currency || team?.currency || "BRL"
                )}
              />
              <InfoCard
                label="Seu status"
                value={getMemberRegistrationLabel(currentMember?.registrationStatus || "invited")}
              />
              <InfoCard
                label="Início"
                value={formatDateTime(tournament?.scheduledStartAt || null)}
              />
              <InfoCard
                label="Fim"
                value={formatDateTime(tournament?.scheduledEndAt || null)}
              />
            </div>
          </div>
        </section>

        <section style={styles.twoColumnGrid}>
          <div style={styles.leftColumn}>
            <section style={styles.card}>
              <h2 style={styles.sectionTitle}>Sua equipe</h2>
              <p style={styles.sectionText}>
                Esta vaga já foi preparada pelo capitão. Você não precisa preencher
                novamente os dados da equipe.
              </p>

              <div style={styles.summaryCard}>
                <SummaryRow label="Equipe" value={team?.teamName || invite?.teamName || "Equipe"} />
                <SummaryRow
                  label="Capitão"
                  value={
                    captainMember?.username
                      ? `@${captainMember.username}`
                      : captainMember?.displayName || team?.captainDisplayName || "Não informado"
                  }
                />
                <SummaryRow
                  label="Membros da equipe"
                  value={String(members.length)}
                />
                <SummaryRow
                  label="Pagamento"
                  value={team?.paymentMode === "individual" ? "Individual" : team?.paymentMode || invite?.paymentMode || "Individual"}
                />
              </div>
            </section>

            <section style={styles.card}>
              <h2 style={styles.sectionTitle}>Integrantes</h2>

              {members.length === 0 ? (
                <p style={styles.sectionText}>Nenhum integrante encontrado.</p>
              ) : (
                <div style={styles.memberList}>
                  {members.map((member) => {
                    const isCurrentUser = member.userId === uid;

                    return (
                      <div
                        key={member.id}
                        style={{
                          ...styles.memberRow,
                          ...(isCurrentUser ? styles.memberRowHighlight : {}),
                        }}
                      >
                        <div style={styles.memberIdentity}>
                          <strong style={styles.memberName}>
                            {member.displayName ||
                              (member.username ? `@${member.username}` : "Usuário")}
                          </strong>
                          <span style={styles.memberSubtext}>
                            {member.username ? `@${member.username}` : member.userId}
                          </span>
                        </div>

                        <div style={styles.memberBadges}>
                          <span style={styles.memberRoleBadge}>
                            {member.role === "captain" ? "Capitão" : "Membro"}
                          </span>
                          <span style={getInviteBadgeStyle(member.inviteStatus)}>
                            {getInviteLabel(member.inviteStatus)}
                          </span>
                          <span style={getPaymentBadgeStyle(member.paymentStatus)}>
                            {getMemberPaymentLabel(member.paymentStatus)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section style={styles.card}>
              <h2 style={styles.sectionTitle}>Sobre o torneio</h2>
              <p style={styles.sectionText}>
                {tournament?.description || "Descrição ainda não informada."}
              </p>
            </section>

            {highlightedRules.length > 0 ? (
              <section style={styles.card}>
                <h2 style={styles.sectionTitle}>Resumo rápido das regras</h2>

                <div style={styles.rulesList}>
                  {highlightedRules.map((rule, index) => (
                    <div key={`${rule}-${index}`} style={styles.ruleRow}>
                      <span style={styles.ruleDot}>•</span>
                      <span style={styles.ruleText}>{rule}</span>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </div>

          <aside style={styles.rightColumn}>
            <section style={styles.checkoutCard}>
              <div style={styles.checkoutTop}>
                <div>
                  <span style={styles.checkoutEyebrow}>Confirmação da vaga</span>
                  <h2 style={styles.checkoutTitle}>Sua inscrição individual</h2>
                  <p style={styles.sectionText}>
                    Aqui você confirma sua entrada na equipe e, depois, realiza seu
                    pagamento individual.
                  </p>
                </div>

                <div style={styles.priceCard}>
                  <span style={styles.priceLabel}>Sua vaga</span>
                  <strong style={styles.priceValue}>
                    {formatMoney(
                      currentMember?.amount ?? invite?.amount ?? team?.amountPerParticipant ?? null,
                      currentMember?.currency || invite?.currency || team?.currency || "BRL"
                    )}
                  </strong>
                </div>
              </div>

              <div style={styles.checkoutSection}>
                <p style={styles.checkoutSectionTitle}>Resumo da sua participação</p>

                <div style={styles.summaryCard}>
                  <SummaryRow label="Torneio" value={tournament?.title || "Torneio"} />
                  <SummaryRow label="Equipe" value={team?.teamName || invite?.teamName || "Equipe"} />
                  <SummaryRow
                    label="Convite"
                    value={getInviteLabel(currentMember?.inviteStatus || invite?.status || "pending")}
                  />
                  <SummaryRow
                    label="Inscrição"
                    value={getMemberRegistrationLabel(currentMember?.registrationStatus || "invited")}
                  />
                  <SummaryRow
                    label="Pagamento"
                    value={getMemberPaymentLabel(currentMember?.paymentStatus || "pending")}
                  />
                </div>
              </div>

              {currentMember?.inviteStatus === "pending" && (
                <div style={styles.checkoutSection}>
                  <p style={styles.checkoutSectionTitle}>Responder convite</p>

                  <div style={styles.processingBox}>
                    <p style={styles.sectionText}>
                      Você foi convidado para participar da equipe{" "}
                      <strong>{team?.teamName || invite?.teamName || "Equipe"}</strong>. Aceite para liberar
                      o pagamento da sua vaga ou recuse caso não queira participar.
                    </p>

                    <div style={styles.actionRow}>
                      <button
                        type="button"
                        onClick={() => handleRespondInvite("accept")}
                        disabled={!!respondingAction || paying}
                        style={{
                          ...styles.primaryButton,
                          ...(respondingAction || paying ? styles.disabledButton : {}),
                        }}
                      >
                        {respondingAction === "accept" ? "Aceitando..." : "Aceitar convite"}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRespondInvite("decline")}
                        disabled={!!respondingAction || paying}
                        style={{
                          ...styles.dangerButton,
                          ...(respondingAction || paying ? styles.disabledButton : {}),
                        }}
                      >
                        {respondingAction === "decline" ? "Recusando..." : "Recusar"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {currentMember?.inviteStatus === "accepted" &&
                currentMember?.paymentStatus !== "approved" && (
                  <div style={styles.checkoutSection}>
                    <p style={styles.checkoutSectionTitle}>Pagamento individual</p>

                    <div style={styles.processingBox}>
                      <p style={styles.sectionText}>
                        Seu convite já foi aceito. Agora falta apenas concluir o
                        pagamento para confirmar sua vaga nesta equipe.
                      </p>
                    </div>
                  </div>
                )}

              {currentMember?.paymentStatus === "approved" && (
                <div style={styles.successBox}>
                  <p style={styles.successTitle}>Pagamento já aprovado</p>
                  <p style={styles.successBoxText}>
                    Sua inscrição individual já foi confirmada. Agora você faz parte
                    oficialmente da equipe neste torneio.
                  </p>
                </div>
              )}

              {(currentMember?.inviteStatus === "declined" ||
                currentMember?.inviteStatus === "cancelled" ||
                currentMember?.inviteStatus === "expired") && (
                <div style={styles.warningBox}>
                  <p style={styles.warningTitle}>Convite indisponível</p>
                  <p style={styles.warningText}>
                    Este convite não está mais ativo para pagamento.
                  </p>
                </div>
              )}

              <div style={styles.checkoutSection}>
                <p style={styles.checkoutSectionTitle}>Como funciona agora</p>

                <div style={styles.processingBox}>
                  <div style={styles.paymentInfoList}>
                    <div style={styles.paymentInfoRow}>
                      <span style={styles.paymentInfoDot}>1</span>
                      <span style={styles.paymentInfoText}>
                        O capitão já montou a equipe e enviou seu convite.
                      </span>
                    </div>
                    <div style={styles.paymentInfoRow}>
                      <span style={styles.paymentInfoDot}>2</span>
                      <span style={styles.paymentInfoText}>
                        Você aceita ou recusa sua participação.
                      </span>
                    </div>
                    <div style={styles.paymentInfoRow}>
                      <span style={styles.paymentInfoDot}>3</span>
                      <span style={styles.paymentInfoText}>
                        Se aceitar, o pagamento individual da sua vaga é liberado.
                      </span>
                    </div>
                    <div style={styles.paymentInfoRow}>
                      <span style={styles.paymentInfoDot}>4</span>
                      <span style={styles.paymentInfoText}>
                        Após a aprovação, sua inscrição fica confirmada.
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div style={styles.actionsColumn}>
                <button
                  type="button"
                  onClick={handleStartPayment}
                  disabled={!paymentAllowed || paying || !!respondingAction}
                  style={{
                    ...styles.primaryButton,
                    ...((!paymentAllowed || paying || !!respondingAction)
                      ? styles.disabledButton
                      : {}),
                  }}
                >
                  {paying ? "Iniciando pagamento..." : "Pagar minha inscrição"}
                </button>

                <p style={styles.securityText}>
                  Esta página é exclusiva para o participante convidado. Aqui você
                  confirma sua vaga e realiza seu pagamento individual.
                </p>
              </div>

              {message ? <p style={styles.successText}>{message}</p> : null}
              {error ? <p style={styles.errorText}>{error}</p> : null}
            </section>
          </aside>
        </section>
      </div>
    </main>
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

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={styles.summaryRow}>
      <span style={styles.summaryLabel}>{label}</span>
      <span style={styles.summaryValue}>{value}</span>
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
    maxWidth: 1220,
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: 18,
  },
  heroCard: {
    background: "#FFFFFF",
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 26,
    overflow: "hidden",
    boxShadow: "0 14px 30px rgba(15,23,42,0.05)",
  },
  cover: {
    width: "100%",
    height: 260,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundColor: "#E2E8F0",
  },
  heroContent: {
    padding: 24,
  },
  heroTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    flexWrap: "wrap",
  },
  eyebrow: {
    display: "inline-block",
    fontSize: 12,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: "#1D4ED8",
    marginBottom: 8,
  },
  title: {
    margin: 0,
    fontSize: 34,
    fontWeight: 1000,
    color: "#0B3C5D",
    lineHeight: 1.1,
  },
  subtitle: {
    margin: "8px 0 0 0",
    fontSize: 16,
    fontWeight: 700,
    color: "#475569",
  },
  location: {
    margin: "10px 0 0 0",
    fontSize: 14,
    fontWeight: 700,
    color: "#64748B",
  },
  heroBadgeColumn: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    alignItems: "flex-end",
  },
  statusBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "8px 12px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  twoColumnGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(340px, 430px)",
    gap: 18,
    alignItems: "start",
  },
  leftColumn: {
    display: "flex",
    flexDirection: "column",
    gap: 18,
  },
  rightColumn: {
    position: "relative",
  },
  card: {
    background: "#FFFFFF",
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 22,
    padding: 22,
    boxShadow: "0 10px 24px rgba(15,23,42,0.04)",
  },
  checkoutCard: {
    background: "#FFFFFF",
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 24,
    padding: 22,
    boxShadow: "0 18px 34px rgba(15,23,42,0.06)",
    position: "sticky",
    top: 24,
    display: "flex",
    flexDirection: "column",
    gap: 18,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 22,
    fontWeight: 900,
    color: "#0F172A",
  },
  sectionText: {
    margin: "10px 0 0 0",
    fontSize: 14,
    lineHeight: 1.7,
    fontWeight: 600,
    color: "#64748B",
  },
  muted: {
    margin: "8px 0 0 0",
    fontSize: 14,
    lineHeight: 1.6,
    fontWeight: 600,
    color: "#64748B",
  },
  infoGrid: {
    marginTop: 18,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
  },
  infoCard: {
    background: "#F8FAFC",
    borderRadius: 14,
    padding: 14,
    border: "1px solid rgba(15,23,42,0.05)",
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
  summaryCard: {
    background: "#F8FAFC",
    borderRadius: 16,
    padding: 16,
    border: "1px solid rgba(15,23,42,0.06)",
    display: "flex",
    flexDirection: "column",
    gap: 10,
    marginTop: 14,
  },
  summaryRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  summaryLabel: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: 800,
  },
  summaryValue: {
    color: "#0F172A",
    fontSize: 13,
    fontWeight: 900,
    textAlign: "right",
  },
  memberList: {
    marginTop: 14,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  memberRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    padding: 14,
    borderRadius: 14,
    background: "#F8FAFC",
    border: "1px solid rgba(15,23,42,0.06)",
    flexWrap: "wrap",
  },
  memberRowHighlight: {
    border: "1px solid #1D4ED8",
    background: "#EFF6FF",
  },
  memberIdentity: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  memberName: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: 900,
  },
  memberSubtext: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: 700,
  },
  memberBadges: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
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
  rulesList: {
    marginTop: 14,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  ruleRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
  },
  ruleDot: {
    color: "#0B3C5D",
    fontWeight: 900,
  },
  ruleText: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: 700,
    lineHeight: 1.6,
  },
  checkoutTop: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
  },
  checkoutEyebrow: {
    display: "inline-block",
    fontSize: 12,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: "#1D4ED8",
    marginBottom: 8,
  },
  checkoutTitle: {
    margin: 0,
    fontSize: 24,
    fontWeight: 1000,
    color: "#0F172A",
  },
  priceCard: {
    minWidth: 220,
    background: "linear-gradient(135deg, #0B3C5D 0%, #145374 100%)",
    color: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 6,
    boxShadow: "0 16px 30px rgba(11,60,93,0.18)",
  },
  priceLabel: {
    fontSize: 12,
    fontWeight: 800,
    opacity: 0.85,
  },
  priceValue: {
    fontSize: 28,
    fontWeight: 1000,
    lineHeight: 1.1,
  },
  checkoutSection: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  checkoutSectionTitle: {
    margin: 0,
    color: "#0F172A",
    fontSize: 14,
    fontWeight: 900,
  },
  warningBox: {
    borderRadius: 16,
    padding: 16,
    background: "#FEF2F2",
    border: "1px solid #FECACA",
  },
  warningTitle: {
    margin: 0,
    color: "#991B1B",
    fontSize: 14,
    fontWeight: 900,
  },
  warningText: {
    margin: "8px 0 0 0",
    color: "#B91C1C",
    fontSize: 14,
    fontWeight: 700,
    lineHeight: 1.6,
  },
  successBox: {
    borderRadius: 16,
    padding: 16,
    background: "#ECFDF5",
    border: "1px solid #A7F3D0",
  },
  successTitle: {
    margin: 0,
    color: "#166534",
    fontSize: 14,
    fontWeight: 900,
  },
  successBoxText: {
    margin: "8px 0 0 0",
    color: "#166534",
    fontSize: 14,
    fontWeight: 700,
    lineHeight: 1.6,
  },
  processingBox: {
    background: "#F8FAFC",
    borderRadius: 16,
    padding: 16,
    border: "1px solid rgba(15,23,42,0.06)",
  },
  paymentInfoList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  paymentInfoRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
  },
  paymentInfoDot: {
    width: 24,
    height: 24,
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#DBEAFE",
    color: "#1D4ED8",
    fontWeight: 900,
    fontSize: 12,
    flexShrink: 0,
  },
  paymentInfoText: {
    color: "#475569",
    fontSize: 14,
    fontWeight: 700,
    lineHeight: 1.6,
  },
  actionRow: {
    display: "flex",
    gap: 10,
    marginTop: 14,
    flexWrap: "wrap",
  },
  actionsColumn: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  primaryButton: {
    border: "none",
    borderRadius: 14,
    padding: "15px 18px",
    background: "#0B3C5D",
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: 1000,
    cursor: "pointer",
    width: "100%",
    boxShadow: "0 14px 28px rgba(11,60,93,0.18)",
  },
  dangerButton: {
    border: "none",
    borderRadius: 14,
    padding: "15px 18px",
    background: "#B91C1C",
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: 1000,
    cursor: "pointer",
    flex: 1,
  },
  disabledButton: {
    opacity: 0.6,
    cursor: "not-allowed",
    boxShadow: "none",
  },
  securityText: {
    margin: 0,
    color: "#64748B",
    fontSize: 12,
    lineHeight: 1.6,
    fontWeight: 700,
    textAlign: "center",
  },
  successText: {
    margin: 0,
    color: "#166534",
    fontWeight: 800,
    fontSize: 14,
    lineHeight: 1.6,
  },
  errorText: {
    margin: 0,
    color: "#B91C1C",
    fontWeight: 800,
    fontSize: 14,
    lineHeight: 1.6,
  },
};