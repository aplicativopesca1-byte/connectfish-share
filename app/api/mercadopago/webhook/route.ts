import { NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "../../../../src/lib/firebaseAdmin";

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
  registrationId: string | null;
};

type RegistrationData = {
  tournamentId?: string;
  registrationStatus?: string;
  paymentStatus?: string;
  amount?: number;
  currency?: string;
  teamName?: string;
  captainName?: string;
  captainEmail?: string;
  captainPhone?: string | null;
  members?: unknown[];
  source?: string;
};

function compactSpaces(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function parseExternalReference(value: unknown): ParsedReference {
  const raw = String(value ?? "").trim();

  if (!raw) {
    return {
      tournamentId: null,
      registrationId: null,
    };
  }

  const tournamentMatch = raw.match(/tournament:([^:]+)/i);
  const registrationMatch = raw.match(/registration:([^:]+)/i);

  return {
    tournamentId: tournamentMatch?.[1] ?? null,
    registrationId: registrationMatch?.[1] ?? null,
  };
}

function normalizeStatus(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeMoney(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Number(parsed.toFixed(2));
}

function areAmountsEquivalent(a: unknown, b: unknown) {
  return normalizeMoney(a) === normalizeMoney(b);
}

function normalizeCurrency(value: unknown) {
  return compactSpaces(value).toUpperCase() || "BRL";
}

function isFinalApprovedStatus(value: unknown) {
  return normalizeStatus(value) === "approved";
}

function isRefundOrChargeback(value: unknown) {
  const status = normalizeStatus(value);
  return status === "refunded" || status === "charged_back";
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

async function findRegistrationByExternalReference(externalReference: string) {
  const db = adminDb();

  const snapshot = await db
    .collection("tournamentRegistrations")
    .where("externalReference", "==", externalReference)
    .limit(1)
    .get();

  if (snapshot.empty) return null;

  return snapshot.docs[0];
}

async function ensureTeamFromApprovedRegistration(params: {
  registrationId: string;
  tournamentId: string;
  paymentId: string | number;
}) {
  const { registrationId, tournamentId, paymentId } = params;
  const db = adminDb();

  const registrationRef = db.collection("tournamentRegistrations").doc(registrationId);
  const registrationSnap = await registrationRef.get();

  if (!registrationSnap.exists) return;

  const registration = registrationSnap.data() as RegistrationData;
  const teamRef = db.collection("tournamentTeams").doc(registrationId);

  await teamRef.set(
    {
      tournamentId,
      registrationId,

      teamName: compactSpaces(registration.teamName),
      captainId: null,
      captainName: compactSpaces(registration.captainName),
      captainEmail: compactSpaces(registration.captainEmail).toLowerCase(),
      captainPhone: registration.captainPhone
        ? String(registration.captainPhone)
        : null,

      members: Array.isArray(registration.members) ? registration.members : [],

      registrationStatus: "confirmed",
      paymentStatus: "approved",
      paymentProvider: "mercado_pago",
      paymentId: String(paymentId),

      source: compactSpaces(registration.source || "public_registration_web"),
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

async function logWebhookEvent(params: {
  paymentId: string;
  type: string;
  action: string;
  externalReference: string | null;
  registrationId: string | null;
  payload: unknown;
  result: string;
}) {
  const db = adminDb();

  await db.collection("paymentWebhookEvents").add({
    provider: "mercado_pago",
    paymentId: params.paymentId,
    type: params.type,
    action: params.action,
    externalReference: params.externalReference,
    registrationId: params.registrationId,
    payload: params.payload ?? null,
    result: params.result,
    receivedAt: FieldValue.serverTimestamp(),
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
    console.error("Falha ao consultar pagamento no Mercado Pago:", {
      status: paymentResponse.status,
      body: paymentData,
      paymentId: params.paymentId,
    });

    throw new Error("Não foi possível consultar o pagamento.");
  }

  const externalReference = compactSpaces(paymentData.external_reference) || null;
  const parsedReference = parseExternalReference(externalReference);

  let registrationId = parsedReference.registrationId;
  const tournamentIdFromReference = parsedReference.tournamentId;
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

  let registrationDocRef = registrationId
    ? db.collection("tournamentRegistrations").doc(registrationId)
    : null;

  let registrationSnap =
    registrationDocRef !== null ? await registrationDocRef.get() : null;

  if ((!registrationSnap || !registrationSnap.exists) && externalReference) {
    const foundByExternalReference = await findRegistrationByExternalReference(
      externalReference
    );

    if (foundByExternalReference) {
      registrationId = foundByExternalReference.id;
      registrationDocRef = db
        .collection("tournamentRegistrations")
        .doc(registrationId);
      registrationSnap = await registrationDocRef.get();
    }
  }

  if (
    !registrationDocRef ||
    !registrationSnap ||
    !registrationSnap.exists ||
    !registrationId
  ) {
    console.error("Registro de inscrição não encontrado para o pagamento:", {
      paymentId: params.paymentId,
      externalReference,
      parsedReference,
    });

    await logWebhookEvent({
      paymentId: params.paymentId,
      type: params.eventType || "unknown",
      action: params.eventAction || "unknown",
      externalReference,
      registrationId: null,
      payload: params.rawPayload ?? null,
      result: "registration_not_found",
    });

    return;
  }

  const registrationData = registrationSnap.data() as RegistrationData;

  const currentPaymentStatus = normalizeStatus(registrationData.paymentStatus);
  const currentRegistrationStatus = normalizeStatus(
    registrationData.registrationStatus
  );

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
      registrationId,
      payload: params.rawPayload ?? null,
      result: `ignored_downgrade_${paymentStatus}`,
    });

    return;
  }

  const expectedAmount = normalizeMoney(registrationData.amount);
  const expectedCurrency = normalizeCurrency(registrationData.currency);
  const amountMatches = areAmountsEquivalent(expectedAmount, amountPaid);
  const currencyMatches = expectedCurrency === paymentCurrency;

  const safeTournamentId =
    tournamentIdFromReference || compactSpaces(registrationData.tournamentId);

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
    await registrationDocRef.update({
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
      registrationId,
      payload: params.rawPayload ?? null,
      result: !amountMatches ? "amount_mismatch" : "currency_mismatch",
    });

    return;
  }

  if (paymentStatus === "approved") {
    await registrationDocRef.update({
      ...baseUpdate,
      registrationStatus: "confirmed",
      paymentReviewRequired: false,
      paymentReviewReason: null,
      paymentFailedAt: null,
    });

    if (safeTournamentId) {
      await ensureTeamFromApprovedRegistration({
        registrationId,
        tournamentId: safeTournamentId,
        paymentId: paymentData.id!,
      });
    }

    await logWebhookEvent({
      paymentId: params.paymentId,
      type: params.eventType || "unknown",
      action: params.eventAction || "unknown",
      externalReference,
      registrationId,
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
      await registrationDocRef.update({
        ...baseUpdate,
        registrationStatus: "awaiting_payment",
      });
    }

    await logWebhookEvent({
      paymentId: params.paymentId,
      type: params.eventType || "unknown",
      action: params.eventAction || "unknown",
      externalReference,
      registrationId,
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
    await registrationDocRef.update({
      ...baseUpdate,
      registrationStatus: getRegistrationStatusFromPaymentStatus(paymentStatus),
      paymentFailedAt:
        paymentStatus === "rejected" ||
        paymentStatus === "cancelled" ||
        paymentStatus === "error"
          ? FieldValue.serverTimestamp()
          : null,
    });

    await logWebhookEvent({
      paymentId: params.paymentId,
      type: params.eventType || "unknown",
      action: params.eventAction || "unknown",
      externalReference,
      registrationId,
      payload: params.rawPayload ?? null,
      result: `${paymentStatus}_processed`,
    });

    return;
  }

  await registrationDocRef.update({
    ...baseUpdate,
    registrationStatus: currentRegistrationStatus || "awaiting_payment",
  });

  await logWebhookEvent({
    paymentId: params.paymentId,
    type: params.eventType || "unknown",
    action: params.eventAction || "unknown",
    externalReference,
    registrationId,
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
    console.error("Erro no webhook GET Mercado Pago:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Erro ao processar webhook.",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as
      | Record<string, unknown>
      | null;

    const action = String(body?.action ?? "").trim().toLowerCase();
    const type = String(body?.type ?? "").trim().toLowerCase();

    const paymentId =
      body?.data &&
      typeof body.data === "object" &&
      body.data !== null &&
      "id" in body.data
        ? String((body.data as { id?: string | number }).id ?? "").trim()
        : "";

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
    console.error("Erro no webhook POST Mercado Pago:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Erro ao processar webhook.",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 }
    );
  }
}