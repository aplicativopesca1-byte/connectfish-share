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

// 🔒 NOVO: autenticação via cookie
async function getAuthenticatedUserId(request: NextRequest) {
  const raw = request.cookies.get("__session")?.value;
  if (!raw) return null;

  const sessionCookie = raw.includes("%") ? decodeURIComponent(raw) : raw;
  const decoded = await adminAuth().verifySessionCookie(sessionCookie, true);

  return decoded.uid || null;
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

  const members = membersSnap.docs.map((d) => d.data());

  const totalSlots = members.length;

  const acceptedMembersCount = members.filter(
    (m) => normalizeStatus(m.inviteStatus) === "accepted"
  ).length;

  const paidMembersCount = members.filter(
    (m) => normalizeStatus(m.paymentStatus) === "approved"
  ).length;

  const hasPendingInvites = members.some(
    (m) => normalizeStatus(m.inviteStatus) === "pending"
  );

  const hasDeclinedMembers = members.some(
    (m) => normalizeStatus(m.inviteStatus) === "declined"
  );

  let teamStatus = "building";

  if (hasPendingInvites) {
    teamStatus = "pending_invites";
  } else if (acceptedMembersCount > 0 && paidMembersCount < acceptedMembersCount) {
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

export async function POST(request: NextRequest) {
  try {
    // 🔒 pega user da sessão
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

    const invitedUserId = compactSpaces(inviteData.invitedUserId);
    const teamId = compactSpaces(inviteData.teamId);
    const tournamentId = compactSpaces(inviteData.tournamentId);
    const currentInviteStatus = normalizeStatus(inviteData.status);

    // 🔒 valida dono do convite
    if (invitedUserId !== userId) {
      return NextResponse.json(
        {
          success: false,
          message: "Este convite não pertence ao usuário autenticado.",
        },
        { status: 403 }
      );
    }

    if (!teamId || !tournamentId) {
      return NextResponse.json(
        {
          success: false,
          message: "Convite inválido.",
        },
        { status: 400 }
      );
    }

    if (currentInviteStatus !== "pending") {
      return NextResponse.json(
        {
          success: false,
          message: "Convite já respondido.",
        },
        { status: 409 }
      );
    }

    const teamMemberRef = db
      .collection("tournamentTeamMembers")
      .doc(`${teamId}_${userId}`);

    const teamMemberSnap = await teamMemberRef.get();

    if (!teamMemberSnap.exists) {
      return NextResponse.json(
        {
          success: false,
          message: "Participante não encontrado.",
        },
        { status: 404 }
      );
    }

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
        respondedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();
    await recalculateTeamStatus(teamId);

    return NextResponse.json({
      success: true,
      teamId,
      tournamentId,
      action,
    });
  } catch (error) {
    console.error("Erro ao responder convite:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Erro interno ao responder convite.",
      },
      { status: 500 }
    );
  }
}