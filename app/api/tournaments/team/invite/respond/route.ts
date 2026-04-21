import { NextResponse, type NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "../../../../../../src/lib/firebaseAdmin";
import { adminAuth } from "../../../../../../src/lib/firebaseAdminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RequestBody = {
  inviteId?: string;
  action?: "accept" | "decline" | string;
};

function compactSpaces(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeAction(value: unknown) {
  return compactSpaces(value).toLowerCase();
}

function normalizeStatus(value: unknown) {
  return compactSpaces(value).toLowerCase();
}

function assertRequired(value: unknown, field: string) {
  const normalized = compactSpaces(value);

  if (!normalized) {
    throw new Error(`Campo obrigatório inválido: ${field}`);
  }

  return normalized;
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

async function recalculateTeamStatus(teamId: string) {
  const db = adminDb();

  const teamRef = db.collection("tournamentTeams").doc(teamId);
  const teamSnap = await teamRef.get();

  if (!teamSnap.exists) return;

  const membersSnap = await db
    .collection("tournamentTeamMembers")
    .where("teamId", "==", teamId)
    .get();

  const members = membersSnap.docs.map((docSnap) => docSnap.data());

  const totalSlots = members.length;

  const acceptedMembersCount = members.filter(
    (member) => normalizeStatus(member.inviteStatus) === "accepted"
  ).length;

  const paidMembersCount = members.filter(
    (member) => normalizeStatus(member.paymentStatus) === "approved"
  ).length;

  const hasPendingInvites = members.some(
    (member) => normalizeStatus(member.inviteStatus) === "pending"
  );

  const hasDeclinedMembers = members.some(
    (member) => normalizeStatus(member.inviteStatus) === "declined"
  );

  let teamStatus = "building";

  if (hasPendingInvites) {
    teamStatus = "pending_invites";
  } else if (
    acceptedMembersCount > 0 &&
    paidMembersCount < acceptedMembersCount
  ) {
    teamStatus = "pending_payments";
  }

  if (
    acceptedMembersCount > 0 &&
    acceptedMembersCount === totalSlots &&
    paidMembersCount === acceptedMembersCount
  ) {
    teamStatus = "confirmed";
  }

  if (hasDeclinedMembers && acceptedMembersCount === 0) {
    teamStatus = "building";
  }

  await teamRef.update({
    totalSlots,
    acceptedMembersCount,
    paidMembersCount,
    teamStatus,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

async function findTeamMemberDoc(params: {
  teamId: string;
  userId: string;
  teamMemberDocId?: string | null;
}) {
  const db = adminDb();

  const explicitDocId = compactSpaces(params.teamMemberDocId);
  if (explicitDocId) {
    const explicitSnap = await db
      .collection("tournamentTeamMembers")
      .doc(explicitDocId)
      .get();

    if (explicitSnap.exists) {
      const raw = explicitSnap.data() as Record<string, unknown>;
      const explicitTeamId = compactSpaces(raw.teamId);
      const explicitUserId = compactSpaces(raw.userId);

      if (explicitTeamId === params.teamId && explicitUserId === params.userId) {
        return explicitSnap;
      }
    }
  }

  const memberQuery = await db
    .collection("tournamentTeamMembers")
    .where("teamId", "==", params.teamId)
    .where("userId", "==", params.userId)
    .limit(1)
    .get();

  if (!memberQuery.empty) {
    return memberQuery.docs[0];
  }

  const fallbackDocId = `${params.teamId}_${params.userId}`;
  const fallbackSnap = await db
    .collection("tournamentTeamMembers")
    .doc(fallbackDocId)
    .get();

  if (fallbackSnap.exists) {
    return fallbackSnap;
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request);

    if (!userId) {
      return NextResponse.json(
        { success: false, message: "Usuário não autenticado." },
        { status: 401 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as RequestBody;

    const inviteId = compactSpaces(body.inviteId);
    const action = normalizeAction(body.action);

    if (!inviteId) {
      return NextResponse.json(
        { success: false, message: "inviteId é obrigatório." },
        { status: 400 }
      );
    }

    if (action !== "accept" && action !== "decline") {
      return NextResponse.json(
        { success: false, message: "A ação deve ser accept ou decline." },
        { status: 400 }
      );
    }

    const db = adminDb();

    const inviteRef = db.collection("tournamentInvites").doc(inviteId);
    const inviteSnap = await inviteRef.get();

    if (!inviteSnap.exists) {
      return NextResponse.json(
        { success: false, message: "Convite não encontrado." },
        { status: 404 }
      );
    }

    const inviteData = inviteSnap.data() as Record<string, unknown>;

    const invitedUserId = assertRequired(
      inviteData.invitedUserId,
      "invite.invitedUserId"
    );
    const teamId = assertRequired(inviteData.teamId, "invite.teamId");
    const tournamentId = assertRequired(
      inviteData.tournamentId,
      "invite.tournamentId"
    );
    const teamMemberDocId = compactSpaces(inviteData.teamMemberDocId) || null;
    const currentInviteStatus = normalizeStatus(inviteData.status);

    if (invitedUserId !== userId) {
      return NextResponse.json(
        {
          success: false,
          message: "Este convite não pertence ao usuário autenticado.",
        },
        { status: 403 }
      );
    }

    if (currentInviteStatus !== "pending") {
      return NextResponse.json(
        { success: false, message: "Convite já respondido." },
        { status: 409 }
      );
    }

    const teamSnap = await db.collection("tournamentTeams").doc(teamId).get();

    if (!teamSnap.exists) {
      return NextResponse.json(
        { success: false, message: "Equipe não encontrada." },
        { status: 404 }
      );
    }

    const teamData = teamSnap.data() as Record<string, unknown>;
    const teamTournamentId = compactSpaces(teamData.tournamentId);

    if (teamTournamentId !== tournamentId) {
      return NextResponse.json(
        {
          success: false,
          message: "Convite inconsistente com a equipe informada.",
        },
        { status: 409 }
      );
    }

    const teamMemberSnap = await findTeamMemberDoc({
      teamId,
      userId,
      teamMemberDocId,
    });

    if (!teamMemberSnap) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Participante não encontrado no time. Verifique a criação dos membros da equipe.",
        },
        { status: 404 }
      );
    }

    const teamMemberData = teamMemberSnap.data() as Record<string, unknown>;
    const memberTeamId = compactSpaces(teamMemberData.teamId);
    const memberUserId = compactSpaces(teamMemberData.userId);

    if (memberTeamId !== teamId || memberUserId !== userId) {
      return NextResponse.json(
        {
          success: false,
          message: "Participante inconsistente com o convite recebido.",
        },
        { status: 409 }
      );
    }

    const teamMemberRef = teamMemberSnap.ref;
    const batch = db.batch();

    if (action === "accept") {
      batch.update(inviteRef, {
        status: "accepted",
        respondedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      batch.update(teamMemberRef, {
        inviteStatus: "accepted",
        registrationStatus: "awaiting_payment",
        paymentStatus: "pending",
        paymentStatusDetail: null,
        paymentProvider: "asaas",
        providerPaymentId: null,
        providerCustomerId: null,
        preferenceId: null,
        externalReference: null,
        checkoutUrl: null,
        asaasInvoiceUrl: null,
        asaasPixQrCode: null,
        asaasPixCopyPaste: null,
        respondedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      batch.update(inviteRef, {
        status: "declined",
        respondedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      batch.update(teamMemberRef, {
        inviteStatus: "declined",
        registrationStatus: "cancelled",
        paymentStatus: "cancelled",
        paymentStatusDetail: "invite_declined",
        paymentProvider: "asaas",
        providerPaymentId: null,
        providerCustomerId: null,
        preferenceId: null,
        externalReference: null,
        checkoutUrl: null,
        asaasInvoiceUrl: null,
        asaasPixQrCode: null,
        asaasPixCopyPaste: null,
        respondedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();
    await recalculateTeamStatus(teamId);

    return NextResponse.json({
      success: true,
      inviteId,
      teamId,
      tournamentId,
      action,
      registrationStatus:
        action === "accept" ? "awaiting_payment" : "cancelled",
    });
  } catch (error) {
    console.error("Erro ao responder convite:", error);

    const message =
      error instanceof Error && /Campo obrigatório inválido/i.test(error.message)
        ? error.message
        : "Erro interno ao responder convite.";

    const status =
      error instanceof Error && /Campo obrigatório inválido/i.test(error.message)
        ? 400
        : 500;

    return NextResponse.json(
      {
        success: false,
        message,
      },
      { status }
    );
  }
}