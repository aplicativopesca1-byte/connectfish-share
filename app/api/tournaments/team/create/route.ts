import { NextResponse, type NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "../../../../../src/lib/firebaseAdmin";
import { adminAuth } from "../../../../../src/lib/firebaseAdminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RequestBody = {
  tournamentId?: string;
  teamName?: string;
  memberUserIds?: string[];
  source?: string | null;
};

type UserRecord = {
  userId: string;
  username: string;
  email: string | null;
  photoUrl: string | null;
  displayName: string | null;
};

const MAX_ADDITIONAL_MEMBERS = 3;

function compactSpaces(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeIdList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => compactSpaces(item)).filter(Boolean);
}

function normalizeTeamName(value: unknown) {
  return compactSpaces(value);
}

function uniqueStrings(values: string[]) {
  return [...new Set(values)];
}

function buildTeamMemberDocId(teamId: string, userId: string) {
  return `${teamId}_${userId}`;
}

async function getAuthenticatedUserId(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization") || "";

    if (authHeader.toLowerCase().startsWith("bearer ")) {
      const token = authHeader.slice(7).trim();

      if (token) {
        const decoded = await adminAuth().verifyIdToken(token, true);
        return decoded.uid || null;
      }
    }
  } catch (error) {
    console.error("Erro Bearer token:", error);
  }

  try {
    const raw = request.cookies.get("__session")?.value;
    if (!raw) return null;

    const sessionCookie = raw.includes("%") ? decodeURIComponent(raw) : raw;
    const decoded = await adminAuth().verifySessionCookie(sessionCookie, true);

    return decoded.uid || null;
  } catch (error) {
    console.error("Erro session cookie:", error);
    return null;
  }
}

async function getUserById(userId: string): Promise<UserRecord | null> {
  const db = adminDb();
  const snap = await db.collection("users").doc(userId).get();

  if (!snap.exists) return null;

  const data = snap.data() as Record<string, unknown>;

  return {
    userId: snap.id,
    username: compactSpaces(data.username).toLowerCase(),
    email: data.email ? String(data.email) : null,
    photoUrl: data.photoUrl ? String(data.photoUrl) : null,
    displayName:
      compactSpaces(data.displayName) ||
      compactSpaces(data.name) ||
      compactSpaces(data.username) ||
      null,
  };
}

async function getUsersByIds(userIds: string[]) {
  const users = await Promise.all(userIds.map((userId) => getUserById(userId)));
  return users.filter(Boolean) as UserRecord[];
}

async function userAlreadyInTournament(params: {
  tournamentId: string;
  userId: string;
}) {
  const db = adminDb();

  const memberSnap = await db
    .collection("tournamentTeamMembers")
    .where("tournamentId", "==", params.tournamentId)
    .where("userId", "==", params.userId)
    .where("inviteStatus", "in", ["pending", "accepted"])
    .limit(1)
    .get();

  return !memberSnap.empty;
}

async function userAlreadyCaptainInTournament(params: {
  tournamentId: string;
  userId: string;
}) {
  const db = adminDb();

  const snap = await db
    .collection("tournamentTeams")
    .where("tournamentId", "==", params.tournamentId)
    .where("captainUserId", "==", params.userId)
    .limit(1)
    .get();

  return !snap.empty;
}

async function teamNameAlreadyExists(params: {
  tournamentId: string;
  teamName: string;
}) {
  const db = adminDb();

  const snap = await db
    .collection("tournamentTeams")
    .where("tournamentId", "==", params.tournamentId)
    .where("teamName", "==", params.teamName)
    .limit(1)
    .get();

  return !snap.empty;
}

function getTournamentEntryFee(raw: Record<string, unknown>) {
  if (typeof raw.entryFee === "number") return Number(raw.entryFee.toFixed(2));
  if (typeof raw.entryFeeAmount === "number") {
    return Number(raw.entryFeeAmount.toFixed(2));
  }
  if (typeof raw.price === "number") return Number(raw.price.toFixed(2));
  return 0;
}

function getTournamentCurrency(raw: Record<string, unknown>) {
  return compactSpaces(raw.currency).toUpperCase() || "BRL";
}

function getTournamentStatus(raw: Record<string, unknown>) {
  return compactSpaces(raw.status).toLowerCase() || "scheduled";
}

function getTournamentVisibility(raw: Record<string, unknown>) {
  return compactSpaces(raw.visibility).toLowerCase() || "draft";
}

function isTournamentAcceptingRegistrations(params: {
  status: string;
  visibility: string;
}) {
  const { status, visibility } = params;
  return visibility === "published" && (status === "scheduled" || status === "live");
}

export async function POST(request: NextRequest) {
  try {
    const authenticatedUserId = await getAuthenticatedUserId(request);

    if (!authenticatedUserId) {
      return NextResponse.json(
        {
          success: false,
          message: "Usuário não autenticado.",
        },
        { status: 401 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as RequestBody;

    const tournamentId = compactSpaces(body.tournamentId);
    const captainUserId = authenticatedUserId;
    const teamName = normalizeTeamName(body.teamName);
    const source = compactSpaces(body.source || "public_tournament_web");
    const rawMemberUserIds = normalizeIdList(body.memberUserIds);

    if (!tournamentId) {
      return NextResponse.json(
        { success: false, message: "tournamentId é obrigatório." },
        { status: 400 }
      );
    }

    if (!teamName || teamName.length < 3) {
      return NextResponse.json(
        {
          success: false,
          message: "Informe um nome de equipe válido com pelo menos 3 caracteres.",
        },
        { status: 400 }
      );
    }

    const memberUserIds = uniqueStrings(
      rawMemberUserIds.filter((userId) => userId !== captainUserId)
    );

    if (memberUserIds.length > MAX_ADDITIONAL_MEMBERS) {
      return NextResponse.json(
        {
          success: false,
          message: `Número máximo de membros excedido. Limite: ${MAX_ADDITIONAL_MEMBERS}.`,
        },
        { status: 400 }
      );
    }

    const db = adminDb();

    const tournamentRef = db.collection("tournaments").doc(tournamentId);
    const tournamentSnap = await tournamentRef.get();

    if (!tournamentSnap.exists) {
      return NextResponse.json(
        { success: false, message: "Torneio não encontrado." },
        { status: 404 }
      );
    }

    const tournamentRaw = tournamentSnap.data() as Record<string, unknown>;
    const tournamentStatus = getTournamentStatus(tournamentRaw);
    const tournamentVisibility = getTournamentVisibility(tournamentRaw);

    if (
      !isTournamentAcceptingRegistrations({
        status: tournamentStatus,
        visibility: tournamentVisibility,
      })
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Este torneio não está aceitando inscrições no momento.",
        },
        { status: 400 }
      );
    }

    const captain = await getUserById(captainUserId);

    if (!captain) {
      return NextResponse.json(
        { success: false, message: "Capitão não encontrado." },
        { status: 404 }
      );
    }

    if (!captain.username) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Seu perfil ainda não possui username válido. Complete seu cadastro antes de criar a equipe.",
        },
        { status: 400 }
      );
    }

    const invitedMembers = await getUsersByIds(memberUserIds);

    if (invitedMembers.length !== memberUserIds.length) {
      return NextResponse.json(
        {
          success: false,
          message: "Um ou mais membros convidados não foram encontrados.",
        },
        { status: 404 }
      );
    }

    if (invitedMembers.some((member) => !member.username)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Um ou mais membros convidados não possuem username válido.",
        },
        { status: 400 }
      );
    }

    const duplicatedIds = uniqueStrings([captainUserId, ...memberUserIds]);
    if (duplicatedIds.length !== 1 + memberUserIds.length) {
      return NextResponse.json(
        {
          success: false,
          message: "Há participantes duplicados na equipe.",
        },
        { status: 400 }
      );
    }

    const existingSameTeamName = await teamNameAlreadyExists({
      tournamentId,
      teamName,
    });

    if (existingSameTeamName) {
      return NextResponse.json(
        {
          success: false,
          message: "Já existe uma equipe com este nome neste torneio.",
        },
        { status: 409 }
      );
    }

    const alreadyCaptain = await userAlreadyCaptainInTournament({
      tournamentId,
      userId: captainUserId,
    });

    if (alreadyCaptain) {
      return NextResponse.json(
        {
          success: false,
          message: "Você já criou uma equipe neste torneio.",
        },
        { status: 409 }
      );
    }

    const usersToCheck = [captainUserId, ...memberUserIds];
    const checks = await Promise.all(
      usersToCheck.map((userId) =>
        userAlreadyInTournament({ tournamentId, userId })
      )
    );

    if (checks.some(Boolean)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Um dos participantes já pertence a uma equipe deste torneio.",
        },
        { status: 409 }
      );
    }

    const amountPerParticipant = getTournamentEntryFee(tournamentRaw);
    const currency = getTournamentCurrency(tournamentRaw);
    const tournamentSlug = compactSpaces(tournamentRaw.slug) || null;
    const tournamentTitle = compactSpaces(tournamentRaw.title) || "Torneio";

    const teamRef = db.collection("tournamentTeams").doc();
    const teamId = teamRef.id;

    const totalSlots = 1 + memberUserIds.length;
    const acceptedMembersCount = 1;
    const paidMembersCount = 0;
    const teamStatus =
      memberUserIds.length > 0 ? "pending_invites" : "pending_payments";

    const batch = db.batch();

    batch.set(teamRef, {
      teamId,
      tournamentId,
      tournamentSlug,
      tournamentTitle,

      teamName,

      captainUserId: captain.userId,
      captainUsername: captain.username,
      captainDisplayName: captain.displayName,
      captainPhotoUrl: captain.photoUrl,

      paymentMode: "individual",
      teamStatus,

      maxMembers: MAX_ADDITIONAL_MEMBERS,
      totalSlots,
      acceptedMembersCount,
      paidMembersCount,

      amountPerParticipant,
      currency,

      source,

      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const captainMemberDocId = buildTeamMemberDocId(teamId, captain.userId);
    const captainMemberRef = db
      .collection("tournamentTeamMembers")
      .doc(captainMemberDocId);

    batch.set(captainMemberRef, {
      teamId,
      tournamentId,
      tournamentSlug,
      teamName,

      userId: captain.userId,
      username: captain.username,
      displayName: captain.displayName,
      photoUrl: captain.photoUrl,

      role: "captain",

      inviteStatus: "accepted",
      registrationStatus: "awaiting_payment",
      paymentStatus: "pending",

      amount: amountPerParticipant,
      currency,

      invitedByUserId: captain.userId,
      invitedAt: FieldValue.serverTimestamp(),
      respondedAt: FieldValue.serverTimestamp(),
      paymentStartedAt: null,
      paymentApprovedAt: null,

      paymentProvider: "mercado_pago",
      paymentId: null,
      preferenceId: null,
      externalReference: null,

      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    for (const member of invitedMembers) {
      const teamMemberDocId = buildTeamMemberDocId(teamId, member.userId);

      const teamMemberRef = db
        .collection("tournamentTeamMembers")
        .doc(teamMemberDocId);

      const inviteRef = db.collection("tournamentInvites").doc();

      batch.set(teamMemberRef, {
        teamId,
        tournamentId,
        tournamentSlug,
        teamName,

        userId: member.userId,
        username: member.username,
        displayName: member.displayName,
        photoUrl: member.photoUrl,

        role: "member",

        inviteStatus: "pending",
        registrationStatus: "invited",
        paymentStatus: "pending",

        amount: amountPerParticipant,
        currency,

        invitedByUserId: captain.userId,
        invitedAt: FieldValue.serverTimestamp(),
        respondedAt: null,
        paymentStartedAt: null,
        paymentApprovedAt: null,

        paymentProvider: "mercado_pago",
        paymentId: null,
        preferenceId: null,
        externalReference: null,

        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      batch.set(inviteRef, {
        inviteId: inviteRef.id,
        tournamentId,
        tournamentSlug,
        tournamentTitle,
        teamId,
        teamName,
        teamMemberDocId,

        invitedUserId: member.userId,
        invitedUsername: member.username,
        invitedDisplayName: member.displayName,

        invitedByUserId: captain.userId,
        invitedByUsername: captain.username,

        status: "pending",

        amount: amountPerParticipant,
        currency,
        paymentMode: "individual",

        source,

        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        respondedAt: null,
      });
    }

    await batch.commit();

    return NextResponse.json({
      success: true,
      teamId,
      message: "Equipe criada com sucesso.",
    });
  } catch (error) {
    console.error("Erro ao criar equipe do torneio:", error);

    const message =
      error instanceof Error &&
      /session cookie/i.test(error.message || "")
        ? "Usuário não autenticado."
        : "Erro interno ao criar equipe.";

    const status =
      error instanceof Error &&
      /session cookie|cookie/i.test(error.message || "")
        ? 401
        : 500;

    return NextResponse.json(
      {
        success: false,
        message,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status }
    );
  }
}