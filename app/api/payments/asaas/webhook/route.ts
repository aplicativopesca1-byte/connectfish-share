import { NextResponse } from "next/server";

import {
  processAsaasWebhook,
  type AsaasWebhookPayload,
} from "../../../../../app/services/payments/asaasWebhookService";
import { createFinancialAuditLog } from "../../../../../app/services/financialAuditService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeTrim(value: unknown) {
  return String(value ?? "").trim();
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function buildBadRequest(message: string, details?: Record<string, unknown>) {
  return NextResponse.json(
    {
      success: false,
      message,
      ...(details ? { details } : {}),
    },
    { status: 400 }
  );
}

function buildUnauthorized(message: string) {
  return NextResponse.json(
    {
      success: false,
      message,
    },
    { status: 401 }
  );
}

export async function POST(request: Request) {
  let payload: AsaasWebhookPayload | null = null;

  try {
    const expectedToken = safeTrim(process.env.ASAAS_WEBHOOK_TOKEN);
    const receivedToken = safeTrim(request.headers.get("asaas-access-token"));

    if (!expectedToken) {
      throw new Error("ASAAS_WEBHOOK_TOKEN não configurado.");
    }

    if (!receivedToken) {
      return buildUnauthorized("Token do webhook ausente.");
    }

    if (receivedToken !== expectedToken) {
      return buildUnauthorized("Webhook não autorizado.");
    }

    const rawBody = await request.json().catch(() => null);

    if (!isObject(rawBody)) {
      return buildBadRequest("Payload inválido para webhook do Asaas.");
    }

    payload = rawBody as AsaasWebhookPayload;

    const event = safeTrim(payload.event);
    const paymentId = safeTrim(payload.payment?.id);

    if (!event) {
      return buildBadRequest("Campo 'event' ausente no webhook.");
    }

    if (!paymentId) {
      return buildBadRequest("Campo 'payment.id' ausente no webhook.");
    }

    const result = await processAsaasWebhook(payload);

    return NextResponse.json(
      {
        success: true,
        processed: result.ok,
        ignored: Boolean(result.ignored),
        duplicate: Boolean(result.duplicate),
        eventId: result.eventId,
        eventType: result.eventType,
        providerPaymentId: result.providerPaymentId,
        internalPaymentId: result.internalPaymentId,
        organizerUserId: result.organizerUserId,
        tournamentId: result.tournamentId,
        message: result.message,
      },
      { status: 200 }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Erro desconhecido ao processar webhook do Asaas.";

    try {
      await createFinancialAuditLog({
        source: "asaas_webhook",
        eventType: "webhook_route_error",
        level: "error",
        providerPaymentId: safeTrim(payload?.payment?.id) || null,
        externalReference:
          safeTrim(payload?.payment?.externalReference) || null,
        message,
        payload:
          payload && typeof payload === "object"
            ? (payload as unknown as Record<string, unknown>)
            : null,
      });
    } catch (auditError) {
      console.error("Erro ao salvar audit log do webhook:", auditError);
    }

    console.error("Erro no webhook do Asaas:", error);

    return NextResponse.json(
      {
        success: false,
        message,
      },
      { status: 500 }
    );
  }
}