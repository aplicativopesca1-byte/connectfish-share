// app/api/mercadopago/webhook/route.ts

import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
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

  const registration = registrationSnap.data() as Record<string, unknown>;

  const existingTeamsSnap = await db
    .collection("tournamentTeams")
    .where("registrationId", "==", registrationId)
    .limit(1)
    .get();

  if (!existingTeamsSnap.empty) {
    const existingTeamDoc = existingTeamsSnap.docs[0];

    await db.collection("tournamentTeams").doc(existingTeamDoc.id).update({
      registrationStatus: "confirmed",
      paymentStatus: "approved",
      paymentProvider: "mercado_pago",
      paymentId: String(paymentId),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return;
  }

  await db.collection("tournamentTeams").add({
    tournamentId,
    registrationId,

    teamName: String(registration.teamName ?? ""),
    captainId: null,
    captainName: String(registration.captainName ?? ""),
    captainEmail: String(registration.captainEmail ?? ""),
    captainPhone: registration.captainPhone
      ? String(registration.captainPhone)
      : null,

    members: Array.isArray(registration.members) ? registration.members : [],

    registrationStatus: "confirmed",
    paymentStatus: "approved",
    paymentProvider: "mercado_pago",
    paymentId: String(paymentId),

    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    source: String(registration.source ?? "public_registration_web"),
  });
}

async function processPaymentWebhook(paymentId: string) {
  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;

  if (!accessToken) {
    throw new Error("MERCADO_PAGO_ACCESS_TOKEN não configurado.");
  }

  const db = adminDb();

  const paymentResponse = await fetch(
    `https://api.mercadopago.com/v1/payments/${paymentId}`,
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
      paymentId,
    });
    throw new Error("Não foi possível consultar o pagamento.");
  }

  const externalReference = String(paymentData.external_reference ?? "").trim();
  const parsedReference = parseExternalReference(externalReference);

  let registrationId = parsedReference.registrationId;
  const tournamentId = parsedReference.tournamentId;
  const paymentStatus = normalizeStatus(paymentData.status);
  const statusDetail = String(paymentData.status_detail ?? "").trim() || null;
  const amount = normalizeMoney(paymentData.transaction_amount);
  const currency = String(paymentData.currency_id ?? "BRL").toUpperCase();
  const payerEmail = String(paymentData.payer?.email ?? "").trim() || null;
  const merchantOrderId = paymentData.order?.id
    ? String(paymentData.order.id)
    : null;
  const approvedAt = paymentData.date_approved
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
      paymentId,
      externalReference,
      parsedReference,
    });

    return;
  }

  const registrationData = registrationSnap.data() as Record<string, unknown>;
  const safeTournamentId =
    tournamentId || String(registrationData.tournamentId ?? "").trim();

  const baseUpdate = {
    paymentId: String(paymentData.id),
    merchantOrderId,
    externalReference: externalReference || null,
    paymentStatus,
    paymentStatusDetail: statusDetail,
    amountPaid: amount,
    paymentCurrency: currency,
    payerEmail,
    approvedAt: approvedAt ?? null,
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (paymentStatus === "approved") {
    await registrationDocRef.update({
      ...baseUpdate,
      registrationStatus: "confirmed",
    });

    if (safeTournamentId) {
      await ensureTeamFromApprovedRegistration({
        registrationId,
        tournamentId: safeTournamentId,
        paymentId: paymentData.id,
      });
    }

    return;
  }

  if (paymentStatus === "pending" || paymentStatus === "in_process") {
    await registrationDocRef.update({
      ...baseUpdate,
      registrationStatus: "awaiting_payment",
    });
    return;
  }

  if (
    paymentStatus === "rejected" ||
    paymentStatus === "cancelled" ||
    paymentStatus === "refunded" ||
    paymentStatus === "charged_back"
  ) {
    await registrationDocRef.update({
      ...baseUpdate,
      registrationStatus: "payment_failed",
    });
    return;
  }

  await registrationDocRef.update({
    ...baseUpdate,
    registrationStatus: "awaiting_payment",
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

    await processPaymentWebhook(String(paymentId));

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

    await processPaymentWebhook(paymentId);

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