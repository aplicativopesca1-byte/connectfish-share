import { NextResponse } from "next/server";
import {
  findOrganizerPaymentProfileByProviderAccountId,
  markOrganizerOnboardingApproved,
  markOrganizerOnboardingRejected,
  syncOrganizerProviderAccount,
  type OrganizerKycStatus,
} from "../../../../../app/services/organizerPaymentProfileService";

type AsaasAccountStatusValue =
  | "APPROVED"
  | "PENDING"
  | "REJECTED"
  | "AWAITING_APPROVAL"
  | string;

type AsaasAccountStatusWebhookPayload = {
  id?: string;
  event?: string;
  dateCreated?: string;
  account?: {
    id?: string | null;
    ownerId?: string | null;
  } | null;
  accountStatus?: {
    id?: string | null;
    commercialInfo?: AsaasAccountStatusValue;
    bankAccountInfo?: AsaasAccountStatusValue;
    documentation?: AsaasAccountStatusValue;
    general?: AsaasAccountStatusValue;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
};

function safeTrim(value: unknown) {
  return String(value ?? "").trim();
}

function jsonError(message: string, status = 400) {
  return NextResponse.json(
    {
      success: false,
      message,
    },
    { status }
  );
}

function getWebhookToken() {
  return safeTrim(process.env.ASAAS_WEBHOOK_TOKEN);
}

function normalizeGeneralStatus(value: unknown): OrganizerKycStatus {
  const raw = safeTrim(value).toUpperCase();

  if (raw === "APPROVED") return "approved";
  if (raw === "REJECTED") return "rejected";
  if (raw === "PENDING" || raw === "AWAITING_APPROVAL") return "pending";
  return "pending";
}

function inferStatusFromEvent(eventName: string): OrganizerKycStatus | null {
  const event = safeTrim(eventName).toUpperCase();

  if (!event.startsWith("ACCOUNT_STATUS_")) return null;

  if (event.endsWith("_APPROVED")) return "approved";
  if (event.endsWith("_REJECTED")) return "rejected";
  if (event.endsWith("_PENDING") || event.endsWith("_AWAITING_APPROVAL")) {
    return "pending";
  }

  return null;
}

function buildRejectionReason(payload: AsaasAccountStatusWebhookPayload) {
  const general = safeTrim(payload.accountStatus?.general).toUpperCase();
  const event = safeTrim(payload.event);

  if (!general && !event) return "Conta reprovada no Asaas.";
  return `Asaas informou reprovação da conta. Evento: ${event || "desconhecido"} | General: ${general || "desconhecido"}`;
}

export async function POST(request: Request) {
  try {
    const configuredToken = getWebhookToken();
    const receivedToken = safeTrim(
      request.headers.get("asaas-access-token")
    );

    if (configuredToken && receivedToken !== configuredToken) {
      return jsonError("Token do webhook inválido.", 401);
    }

    const payload =
      (await request.json().catch(() => null)) as AsaasAccountStatusWebhookPayload | null;

    if (!payload) {
      return jsonError("Payload inválido.");
    }

    const providerAccountId = safeTrim(payload.account?.id);
    if (!providerAccountId) {
      return jsonError("providerAccountId ausente no payload.");
    }

    const profile = await findOrganizerPaymentProfileByProviderAccountId(
      providerAccountId
    );

    if (!profile) {
      return NextResponse.json(
        {
          success: true,
          ignored: true,
          message: "Nenhum organizador encontrado para esta subconta.",
          providerAccountId,
        },
        { status: 200 }
      );
    }

    const statusFromGeneral = normalizeGeneralStatus(payload.accountStatus?.general);
    const statusFromEvent = inferStatusFromEvent(payload.event || "");
    const nextStatus = statusFromEvent || statusFromGeneral;

    if (nextStatus === "approved") {
      await markOrganizerOnboardingApproved({
        organizerUserId: profile.organizerUserId,
        providerAccountId,
        providerWalletId: profile.providerWalletId,
        chargesEnabled: true,
        payoutsEnabled: true,
        escrowEnabled: profile.escrowEnabled,
      });
    } else if (nextStatus === "rejected") {
      await markOrganizerOnboardingRejected({
        organizerUserId: profile.organizerUserId,
        reason: buildRejectionReason(payload),
      });

      await syncOrganizerProviderAccount({
        organizerUserId: profile.organizerUserId,
        providerAccountId,
        providerWalletId: profile.providerWalletId,
        chargesEnabled: false,
        payoutsEnabled: false,
        escrowEnabled: profile.escrowEnabled,
        status: "rejected",
      });
    } else {
      await syncOrganizerProviderAccount({
        organizerUserId: profile.organizerUserId,
        providerAccountId,
        providerWalletId: profile.providerWalletId,
        chargesEnabled: false,
        payoutsEnabled: false,
        escrowEnabled: profile.escrowEnabled,
        status: "pending",
      });
    }

    return NextResponse.json(
      {
        success: true,
        organizerUserId: profile.organizerUserId,
        providerAccountId,
        event: safeTrim(payload.event),
        generalStatus: safeTrim(payload.accountStatus?.general).toUpperCase() || null,
        appliedStatus: nextStatus,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Erro ao processar webhook de status da conta Asaas:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Erro interno ao processar webhook de status da conta.",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    {
      success: true,
      message: "Webhook de status da conta Asaas ativo.",
    },
    { status: 200 }
  );
}