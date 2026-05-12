import { NextResponse, type NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import { adminDb } from "../../../../../src/lib/firebaseAdmin";
import { adminAuth } from "../../../../../src/lib/firebaseAdminAuth";

import {
  createAsaasCustomer,
  createAsaasTournamentCharge,
} from "../../../../services/payments/asaasService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RequestBody = {
  reservationId?: string;
  billingType?: "PIX" | "BOLETO" | "CREDIT_CARD" | string | null;
  dueDate?: string | null;
};

function safeTrim(value: unknown) {
  return String(value ?? "").trim();
}

function compactSpaces(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function nullableString(value: unknown) {
  const text = safeTrim(value);
  return text || null;
}

function normalizeMoney(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Number(parsed.toFixed(2));
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeBillingType(value: unknown): "PIX" | "BOLETO" | "CREDIT_CARD" {
  const billingType = safeTrim(value).toUpperCase();

  if (billingType === "BOLETO") return "BOLETO";
  if (billingType === "CREDIT_CARD") return "CREDIT_CARD";
  return "PIX";
}

function normalizeDueDate(value: unknown) {
  const raw = safeTrim(value);

  if (!raw) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().slice(0, 10);
  }

  return raw;
}

function requireField(value: unknown, label: string) {
  const text = compactSpaces(value);
  if (!text) {
    throw new Error(`${label} é obrigatório.`);
  }
  return text;
}

function extractAsaasCustomerId(raw: Record<string, unknown>) {
  return safeTrim(raw.id);
}

function extractAsaasPaymentId(raw: Record<string, unknown>) {
  return safeTrim(raw.id);
}

function extractAsaasInvoiceUrl(raw: Record<string, unknown>) {
  return (
    safeTrim(raw.invoiceUrl) ||
    safeTrim(raw.bankSlipUrl) ||
    safeTrim(raw.transactionReceiptUrl) ||
    ""
  );
}

function extractAsaasPixQrCode(raw: Record<string, unknown>) {
  return safeTrim(raw.pixQrCode) || "";
}

function extractAsaasPixCopyPaste(raw: Record<string, unknown>) {
  return (
    safeTrim(raw.payload) ||
    safeTrim(raw.pixCopiaECola) ||
    safeTrim(raw.copyPasteKey) ||
    ""
  );
}

function buildExternalReference(params: {
  reservationId: string;
  sessionId: string;
  userId: string;
}) {
  return [
    "cf-res",
    params.reservationId.slice(0, 8),
    params.sessionId.slice(0, 8),
    params.userId.slice(0, 8),
    Date.now().toString(36),
  ].join("-");
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

async function getUserProfile(userId: string) {
  const db = adminDb();
  const snap = await db.collection("users").doc(userId).get();

  if (!snap.exists) return null;

  const data = snap.data() as Record<string, unknown>;
  const billing = isObject(data.billing) ? data.billing : {};

  return {
    userId: snap.id,
    displayName:
      compactSpaces(data.displayName) ||
      compactSpaces(data.name) ||
      compactSpaces(data.username) ||
      "Pescador",
    email: nullableString(data.email),
    cpfCnpj:
      nullableString(billing.documentNumber) ||
      nullableString(data.documentNumber) ||
      nullableString(data.cpfCnpj) ||
      nullableString(data.cpf) ||
      nullableString(data.document),
    mobilePhone:
      nullableString(data.mobilePhone) ||
      nullableString(data.whatsapp) ||
      nullableString(data.phone),
    phone: nullableString(data.phone),
  };
}

export async function POST(request: NextRequest) {
  let reservationId: string | null = null;
  let sessionId: string | null = null;
  let userId: string | null = null;
  let ownerId: string | null = null;
  let externalReference: string | null = null;

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

    const raw = await request.json().catch(() => null);

    if (!isObject(raw)) {
      return NextResponse.json(
        {
          success: false,
          message: "Payload inválido.",
        },
        { status: 400 }
      );
    }

    const body = raw as RequestBody;

    reservationId = requireField(body.reservationId, "reservationId");

    const billingType = normalizeBillingType(body.billingType);
    const dueDate = normalizeDueDate(body.dueDate);

    const db = adminDb();

    const reservationRef = db
      .collection("fishingReservations")
      .doc(reservationId);

    const reservationSnap = await reservationRef.get();

    if (!reservationSnap.exists) {
      return NextResponse.json(
        {
          success: false,
          message: "Reserva não encontrada.",
        },
        { status: 404 }
      );
    }

    const reservationRaw = reservationSnap.data() as Record<string, unknown>;

    userId = requireField(reservationRaw.userId, "reservation.userId");
    sessionId = requireField(reservationRaw.sessionId, "reservation.sessionId");
    ownerId = requireField(reservationRaw.ownerId, "reservation.ownerId");

    if (userId !== authenticatedUserId) {
      return NextResponse.json(
        {
          success: false,
          message: "Esta reserva não pertence ao usuário autenticado.",
        },
        { status: 403 }
      );
    }

    const paymentStatus = compactSpaces(reservationRaw.paymentStatus).toLowerCase();

    if (paymentStatus === "paid") {
      return NextResponse.json(
        {
          success: true,
          alreadyPaid: true,
          message: "Reserva já está paga.",
          reservationId,
          providerPaymentId: nullableString(reservationRaw.providerPaymentId),
          checkoutUrl:
            nullableString(reservationRaw.checkoutUrl) ||
            nullableString(reservationRaw.asaasInvoiceUrl),
        },
        { status: 200 }
      );
    }

    const existingCheckoutUrl =
      nullableString(reservationRaw.checkoutUrl) ||
      nullableString(reservationRaw.asaasInvoiceUrl);

    const existingProviderPaymentId = nullableString(
      reservationRaw.providerPaymentId
    );

    if (
      paymentStatus === "pending" &&
      existingCheckoutUrl &&
      existingProviderPaymentId
    ) {
      return NextResponse.json(
        {
          success: true,
          reused: true,
          message: "Checkout pendente reutilizado.",
          reservationId,
          providerPaymentId: existingProviderPaymentId,
          providerCustomerId: nullableString(reservationRaw.providerCustomerId),
          billingType: nullableString(reservationRaw.billingType) || billingType,
          dueDate: nullableString(reservationRaw.dueDate),
          externalReference: nullableString(reservationRaw.externalReference),
          checkoutUrl: existingCheckoutUrl,
          asaasInvoiceUrl: existingCheckoutUrl,
          charge: {
            id: existingProviderPaymentId,
            invoiceUrl: existingCheckoutUrl,
            pixQrCode: nullableString(reservationRaw.asaasPixQrCode),
            pixCopyPaste: nullableString(reservationRaw.asaasPixCopyPaste),
            raw: null,
          },
        },
        { status: 200 }
      );
    }

    const totalPrice = normalizeMoney(reservationRaw.totalPrice);

    if (totalPrice <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Valor da reserva deve ser maior que zero.",
        },
        { status: 400 }
      );
    }

    const userProfile = await getUserProfile(userId);

    const payerName = requireField(
      reservationRaw.userName || userProfile?.displayName,
      "payerName"
    );

    const payerEmail =
      nullableString(reservationRaw.userEmail) || userProfile?.email || null;

    const payerCpfCnpj = userProfile?.cpfCnpj || null;

    if (!payerCpfCnpj) {
      return NextResponse.json(
        {
          success: false,
          message: "Você precisa completar seu CPF antes de pagar a reserva.",
          code: "MISSING_CPF",
        },
        { status: 400 }
      );
    }

    const payerMobilePhone = userProfile?.mobilePhone || null;
    const payerPhone = userProfile?.phone || null;

    externalReference = buildExternalReference({
      reservationId,
      sessionId,
      userId,
    });

    const sessionTitle =
      nullableString(reservationRaw.sessionTitle) || "Sessão de pesca";

    const areaName = nullableString(reservationRaw.areaName);

    const description = areaName
      ? `Reserva ConnectFish • ${sessionTitle} • ${areaName}`
      : `Reserva ConnectFish • ${sessionTitle}`;

    const customer = await createAsaasCustomer({
      name: payerName,
      email: payerEmail,
      cpfCnpj: payerCpfCnpj,
      mobilePhone: payerMobilePhone,
      phone: payerPhone,
    });

    const providerCustomerId =
      extractAsaasCustomerId(customer as Record<string, unknown>) || null;

    const asaasCharge = await createAsaasTournamentCharge({
      customer: providerCustomerId,
      billingType,
      value: totalPrice,
      dueDate,
      description,
      externalReference,
      name: payerName,
      email: payerEmail,
      cpfCnpj: payerCpfCnpj,
      mobilePhone: payerMobilePhone,
      phone: payerPhone,
    });

    const providerPaymentId = extractAsaasPaymentId(
      asaasCharge as unknown as Record<string, unknown>
    );
    let pixQrCode: string | null = null;
let pixCopyPaste: string | null = null;

try {
  const pixResponse = await fetch(
    `https://sandbox.asaas.com/api/v3/payments/${providerPaymentId}/pixQrCode`,
    {
      method: "GET",
      headers: {
        accept: "application/json",
        access_token: process.env.ASAAS_API_KEY || "",
      },
    }
  );

  if (pixResponse.ok) {
    const pixData = await pixResponse.json();

    pixQrCode =
      safeTrim(pixData?.encodedImage) ||
      safeTrim(pixData?.pixQrCode) ||
      null;

    pixCopyPaste =
      safeTrim(pixData?.payload) ||
      safeTrim(pixData?.copyPasteKey) ||
      null;

    console.log("PIX DATA:", pixData);
  }
} catch (pixError) {
  console.error("Erro ao buscar PIX:", pixError);
}

    if (!providerPaymentId) {
      throw new Error("O Asaas não retornou um providerPaymentId válido.");
    }

    const invoiceUrl =
      extractAsaasInvoiceUrl(asaasCharge as unknown as Record<string, unknown>) ||
      null;

    await reservationRef.update({
      paymentProvider: "asaas",
      providerPaymentId,
      providerCustomerId,
      billingType,
      dueDate,
      externalReference,

      checkoutUrl: invoiceUrl,
      asaasInvoiceUrl: invoiceUrl,
      asaasPixQrCode: pixQrCode,
      asaasPixCopyPaste: pixCopyPaste,

      paymentStatus: "pending",
      paymentStatusDetail: "checkout_created",
      checkoutCreatedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await db.collection("financialAuditLogs").add({
      source: "asaas_fishing_reservation_checkout",
      eventType: "checkout_created",
      level: "info",
      ownerId,
      reservationId,
      sessionId,
      userId,
      providerPaymentId,
      providerCustomerId,
      externalReference,
      message: "Checkout de reserva criado com sucesso no Asaas.",
      payload: {
        billingType,
        dueDate,
        totalPrice,
        payerName,
        payerEmail,
        sessionTitle,
        areaName,
      },
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json(
      {
        success: true,
        message: "Checkout criado com sucesso.",
        reservationId,
        checkoutUrl: invoiceUrl,
        asaasInvoiceUrl: invoiceUrl,
        providerPaymentId,
        providerCustomerId,
        billingType,
        dueDate,
        externalReference,
        charge: {
          id: providerPaymentId,
          invoiceUrl,
          pixQrCode,
          pixCopyPaste,
          raw: asaasCharge,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Erro desconhecido ao criar checkout da reserva.";

    console.error("Erro ao criar checkout de reserva:", error);

    try {
      await adminDb().collection("financialAuditLogs").add({
        source: "asaas_fishing_reservation_checkout",
        eventType: "checkout_create_failed",
        level: "error",
        ownerId,
        reservationId,
        sessionId,
        userId,
        providerPaymentId: null,
        externalReference,
        message,
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (auditError) {
      console.error("Erro ao salvar audit log da reserva:", auditError);
    }

    const status =
      /não autenticado/i.test(message)
        ? 401
        : /não encontrada|não encontrado/i.test(message)
          ? 404
          : /obrigatório|inválido|maior que zero|cpf/i.test(message)
            ? 400
            : /não pertence/i.test(message)
              ? 403
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