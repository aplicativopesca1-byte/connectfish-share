import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "../../../../../../src/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RequestBody = {
  inviteId?: string;
  userId?: string;
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

async function recalculateTeamStatus(teamId: string) {
  const db = adminDb();

  const teamRef = db.collection("tournamentTeams").doc(teamId);
  const teamSnap = await teamRef.get();

  if (!teamSnap.exists) return;

  const membersSnap = await db
    .collection("tournamentTeamMembers")
    .where("teamId", "==", teamId)
    .get();

  const members = membersSnap.docs.map(
    (memberDoc) => memberDoc.data() as Record<string, unknown>
  );

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

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;

    const inviteId = compactSpaces(body.inviteId);
    const userId = compactSpaces(body.userId);
    const action = normalizeAction(body.action);

    if (!inviteId) {
      return NextResponse.json(
        { success: false, message: "inviteId é obrigatório." },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, message: "userId é obrigatório." },
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

    if (invitedUserId !== userId) {
      return NextResponse.json(
        {
          success: false,
          message: "Este convite não pertence ao usuário informado.",
        },
        { status: 403 }
      );
    }

    if (!teamId || !tournamentId) {
      return NextResponse.json(
        {
          success: false,
          message: "Convite inválido: dados da equipe ou torneio ausentes.",
        },
        { status: 400 }
      );
    }

    if (currentInviteStatus !== "pending") {
      return NextResponse.json(
        {
          success: false,
          message: "Este convite já foi respondido ou não está mais disponível.",
        },
        { status: 409 }
      );
    }

    const teamMemberDocId = `${teamId}_${userId}`;
    const teamMemberRef = db.collection("tournamentTeamMembers").doc(teamMemberDocId);
    const teamMemberSnap = await teamMemberRef.get();

    if (!teamMemberSnap.exists) {
      return NextResponse.json(
        {
          success: false,
          message: "Participante da equipe não encontrado.",
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
      message:
        action === "accept"
          ? "Convite aceito com sucesso."
          : "Convite recusado com sucesso.",
    });
  } catch (error) {
    console.error("Erro ao responder convite do torneio:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Erro interno ao responder convite.",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 }
    );
  }
}