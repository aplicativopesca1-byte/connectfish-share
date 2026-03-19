import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "../../../../src/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MercadoPagoPaymentResponse = {
  id?: number | string;
  status?: string;
  status_detail?: string;
  external_reference?: string | null;
  transaction_amount?: number;
  currency_id?: string;
  date_approved?: string | null;
  payer?: {
    email?: string | null;
  };
  metadata?: Record<string, unknown>;
  order?: {
    id?: number | string | null;
  };
};

type ParsedReference = {
  tournamentId: string | null;
  teamId: string | null;
  userId: string | null;
};

type WebhookBody = {
  action?: string;
  type?: string;
  data?: {
    id?: string | number;
  } | null;
};

function compactSpaces(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeStatus(value: unknown) {
  return compactSpaces(value).toLowerCase();
}

function normalizeCurrency(value: unknown) {
  return compactSpaces(value).toUpperCase() || "BRL";
}

function normalizeMoney(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Number(parsed.toFixed(2));
}

function areAmountsEquivalent(a: unknown, b: unknown) {
  return normalizeMoney(a) === normalizeMoney(b);
}

function parseExternalReference(value: unknown): ParsedReference {
  const raw = compactSpaces(value);

  if (!raw) {
    return {
      tournamentId: null,
      teamId: null,
      userId: null,
    };
  }

  const tournamentMatch = raw.match(/tournament:([^:]+)/i);
  const teamMatch = raw.match(/team:([^:]+)/i);
  const userMatch = raw.match(/user:([^:]+)/i);

  return {
    tournamentId: tournamentMatch?.[1] ?? null,
    teamId: teamMatch?.[1] ?? null,
    userId: userMatch?.[1] ?? null,
  };
}

function getMemberDocId(teamId: string, userId: string) {
  return `${teamId}_${userId}`;
}

function getRegistrationStatusFromPaymentStatus(paymentStatus: string) {
  if (paymentStatus === "approved") return "confirmed";
  if (paymentStatus === "refunded") return "refunded";
  if (paymentStatus === "charged_back") return "chargeback";
  if (
    paymentStatus === "rejected" ||
    paymentStatus === "cancelled" ||
    paymentStatus === "error"
  ) {
    return "payment_failed";
  }
  return "awaiting_payment";
}

function isFinalApprovedStatus(value: unknown) {
  return normalizeStatus(value) === "approved";
}

function isRefundOrChargeback(value: unknown) {
  const status = normalizeStatus(value);
  return status === "refunded" || status === "charged_back";
}

async function logWebhookEvent(params: {
  paymentId: string;
  type: string;
  action: string;
  externalReference: string | null;
  teamId: string | null;
  userId: string | null;
  payload: unknown;
  result: string;
}) {
  const db = adminDb();

  await db.collection("tournamentPaymentEvents").add({
    provider: "mercado_pago",
    paymentId: params.paymentId,
    type: params.type,
    action: params.action,
    externalReference: params.externalReference,
    teamId: params.teamId,
    userId: params.userId,
    payload: params.payload ?? null,
    result: params.result,
    createdAt: FieldValue.serverTimestamp(),
  });
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

  const acceptedMembers = members.filter(
    (member) => normalizeStatus(member.inviteStatus) === "accepted"
  );

  const acceptedMembersCount = acceptedMembers.length;

  const paidMembersCount = acceptedMembers.filter(
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

async function processPaymentWebhook(params: {
  paymentId: string;
  eventType?: string;
  eventAction?: string;
  rawPayload?: unknown;
}) {
  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;

  if (!accessToken) {
    throw new Error("MERCADO_PAGO_ACCESS_TOKEN não configurado.");
  }

  const db = adminDb();

  const paymentResponse = await fetch(
    `https://api.mercadopago.com/v1/payments/${params.paymentId}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    }
  );

  const paymentData =
    (await paymentResponse.json().catch(() => null)) as
      | MercadoPagoPaymentResponse
      | null;

  if (!paymentResponse.ok || !paymentData?.id) {
    console.error("Falha ao consultar pagamento individual no Mercado Pago:", {
      status: paymentResponse.status,
      body: paymentData,
      paymentId: params.paymentId,
    });

    throw new Error("Não foi possível consultar o pagamento individual.");
  }

  const externalReference = compactSpaces(paymentData.external_reference) || null;
  const parsedReference = parseExternalReference(externalReference);

  const tournamentId = parsedReference.tournamentId;
  const teamId = parsedReference.teamId;
  const userId = parsedReference.userId;

  if (!teamId || !userId || !tournamentId) {
    await logWebhookEvent({
      paymentId: params.paymentId,
      type: params.eventType || "unknown",
      action: params.eventAction || "unknown",
      externalReference,
      teamId: teamId ?? null,
      userId: userId ?? null,
      payload: params.rawPayload ?? null,
      result: "invalid_external_reference",
    });

    return;
  }

  const memberRef = db
    .collection("tournamentTeamMembers")
    .doc(getMemberDocId(teamId, userId));

  const memberSnap = await memberRef.get();

  if (!memberSnap.exists) {
    await logWebhookEvent({
      paymentId: params.paymentId,
      type: params.eventType || "unknown",
      action: params.eventAction || "unknown",
      externalReference,
      teamId,
      userId,
      payload: params.rawPayload ?? null,
      result: "member_not_found",
    });

    return;
  }

  const memberData = memberSnap.data() as Record<string, unknown>;

  const currentPaymentStatus = normalizeStatus(memberData.paymentStatus);
  const currentRegistrationStatus = normalizeStatus(memberData.registrationStatus);

  const paymentStatus = normalizeStatus(paymentData.status);
  const statusDetail = compactSpaces(paymentData.status_detail) || null;
  const amountPaid = normalizeMoney(paymentData.transaction_amount);
  const paymentCurrency = normalizeCurrency(paymentData.currency_id);
  const payerEmail = compactSpaces(paymentData.payer?.email).toLowerCase() || null;
  const merchantOrderId = paymentData.order?.id
    ? String(paymentData.order.id)
    : null;
  const paymentApprovedAt = paymentData.date_approved
    ? String(paymentData.date_approved)
    : null;

  if (
    isFinalApprovedStatus(currentPaymentStatus) &&
    paymentStatus !== "approved" &&
    !isRefundOrChargeback(paymentStatus)
  ) {
    await logWebhookEvent({
      paymentId: params.paymentId,
      type: params.eventType || "unknown",
      action: params.eventAction || "unknown",
      externalReference,
      teamId,
      userId,
      payload: params.rawPayload ?? null,
      result: `ignored_downgrade_${paymentStatus}`,
    });

    return;
  }

  const expectedAmount = normalizeMoney(memberData.amount);
  const expectedCurrency = normalizeCurrency(memberData.currency);
  const amountMatches = areAmountsEquivalent(expectedAmount, amountPaid);
  const currencyMatches = expectedCurrency === paymentCurrency;

  const baseUpdate: Record<string, unknown> = {
    paymentId: String(paymentData.id),
    merchantOrderId,
    externalReference,
    paymentStatus,
    paymentStatusDetail: statusDetail,
    amountPaid,
    paymentCurrency,
    payerEmail,
    paymentApprovedAt: paymentApprovedAt ?? null,
    lastWebhookAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (!amountMatches || !currencyMatches) {
    await memberRef.update({
      ...baseUpdate,
      paymentReviewRequired: true,
      paymentReviewReason: !amountMatches
        ? "amount_mismatch"
        : "currency_mismatch",
    });

    await logWebhookEvent({
      paymentId: params.paymentId,
      type: params.eventType || "unknown",
      action: params.eventAction || "unknown",
      externalReference,
      teamId,
      userId,
      payload: params.rawPayload ?? null,
      result: !amountMatches ? "amount_mismatch" : "currency_mismatch",
    });

    return;
  }

  if (paymentStatus === "approved") {
    await memberRef.update({
      ...baseUpdate,
      registrationStatus: "confirmed",
      paymentReviewRequired: false,
      paymentReviewReason: null,
      paymentFailedAt: null,
    });

    await recalculateTeamStatus(teamId);

    await logWebhookEvent({
      paymentId: params.paymentId,
      type: params.eventType || "unknown",
      action: params.eventAction || "unknown",
      externalReference,
      teamId,
      userId,
      payload: params.rawPayload ?? null,
      result: "approved_processed",
    });

    return;
  }

  if (paymentStatus === "pending" || paymentStatus === "in_process") {
    if (
      currentRegistrationStatus !== "confirmed" &&
      currentRegistrationStatus !== "refunded" &&
      currentRegistrationStatus !== "chargeback"
    ) {
      await memberRef.update({
        ...baseUpdate,
        registrationStatus: "awaiting_payment",
      });
    }

    await recalculateTeamStatus(teamId);

    await logWebhookEvent({
      paymentId: params.paymentId,
      type: params.eventType || "unknown",
      action: params.eventAction || "unknown",
      externalReference,
      teamId,
      userId,
      payload: params.rawPayload ?? null,
      result: "pending_processed",
    });

    return;
  }

  if (
    paymentStatus === "rejected" ||
    paymentStatus === "cancelled" ||
    paymentStatus === "refunded" ||
    paymentStatus === "charged_back" ||
    paymentStatus === "error"
  ) {
    await memberRef.update({
      ...baseUpdate,
      registrationStatus: getRegistrationStatusFromPaymentStatus(paymentStatus),
      paymentFailedAt:
        paymentStatus === "rejected" ||
        paymentStatus === "cancelled" ||
        paymentStatus === "error"
          ? FieldValue.serverTimestamp()
          : null,
    });

    await recalculateTeamStatus(teamId);

    await logWebhookEvent({
      paymentId: params.paymentId,
      type: params.eventType || "unknown",
      action: params.eventAction || "unknown",
      externalReference,
      teamId,
      userId,
      payload: params.rawPayload ?? null,
      result: `${paymentStatus}_processed`,
    });

    return;
  }

  await memberRef.update({
    ...baseUpdate,
    registrationStatus: currentRegistrationStatus || "awaiting_payment",
  });

  await recalculateTeamStatus(teamId);

  await logWebhookEvent({
    paymentId: params.paymentId,
    type: params.eventType || "unknown",
    action: params.eventAction || "unknown",
    externalReference,
    teamId,
    userId,
    payload: params.rawPayload ?? null,
    result: `unmapped_status_${paymentStatus}`,
  });
}

function extractPaymentIdFromUrl(request: Request) {
  const url = new URL(request.url);

  const topic = url.searchParams.get("topic");
  const type = url.searchParams.get("type");
  const dataId = url.searchParams.get("data.id");
  const paymentId = url.searchParams.get("id");

  const isPaymentTopic = topic === "payment" || type === "payment";

  if (!isPaymentTopic) {
    return null;
  }

  return dataId || paymentId || null;
}

export async function GET(request: Request) {
  try {
    const paymentId = extractPaymentIdFromUrl(request);

    if (!paymentId) {
      return NextResponse.json(
        { ok: true, message: "Webhook recebido sem payment id." },
        { status: 200 }
      );
    }

    await processPaymentWebhook({
      paymentId: String(paymentId),
      eventType: "payment",
      eventAction: "payment.get",
      rawPayload: null,
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("Erro no member webhook GET Mercado Pago:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Erro ao processar webhook individual.",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as WebhookBody | null;

    const action = compactSpaces(body?.action).toLowerCase();
    const type = compactSpaces(body?.type).toLowerCase();
    const paymentId = compactSpaces(body?.data?.id);

    const isPaymentEvent =
      type === "payment" ||
      action === "payment.created" ||
      action === "payment.updated";

    if (!isPaymentEvent || !paymentId) {
      return NextResponse.json(
        { ok: true, message: "Evento ignorado." },
        { status: 200 }
      );
    }

    await processPaymentWebhook({
      paymentId,
      eventType: type,
      eventAction: action,
      rawPayload: body,
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("Erro no member webhook POST Mercado Pago:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Erro ao processar webhook individual.",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 }
    );
  }
}