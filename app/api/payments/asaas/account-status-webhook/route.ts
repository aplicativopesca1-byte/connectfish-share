import { NextResponse } from "next/server";
import {
  findOrganizerPaymentProfileByProviderAccountId,
  markOrganizerOnboardingApproved,
  markOrganizerOnboardingRejected,
  syncAsaasAccountStatus,
  syncOrganizerProviderAccount,
  type OrganizerKycStatus,
} from "../../../../../app/services/organizerPaymentProfileService";

type AsaasAccountStatusValue =
  | "APPROVED"
  | "PENDING"
  | "REJECTED"
  | "AWAITING_APPROVAL"
  | "EXPIRED"
  | "EXPIRING_SOON"
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
  return NextResponse.json({ success: false, message }, { status });
}

function getWebhookToken() {
  return safeTrim(process.env.ASAAS_WEBHOOK_TOKEN);
}

function normalizeStatusValue(value: unknown) {
  return safeTrim(value).toUpperCase();
}

function normalizeGeneralStatus(value: unknown): OrganizerKycStatus {
  const raw = normalizeStatusValue(value);

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

  if (
    event.endsWith("_PENDING") ||
    event.endsWith("_AWAITING_APPROVAL") ||
    event.endsWith("_EXPIRING_SOON") ||
    event.endsWith("_EXPIRED")
  ) {
    return "pending";
  }

  return null;
}

function allCriticalApproved(payload: AsaasAccountStatusWebhookPayload) {
  const commercialInfo = normalizeStatusValue(
    payload.accountStatus?.commercialInfo
  );
  const bankAccountInfo = normalizeStatusValue(
    payload.accountStatus?.bankAccountInfo
  );
  const documentation = normalizeStatusValue(
    payload.accountStatus?.documentation
  );
  const general = normalizeStatusValue(payload.accountStatus?.general);

  return (
    commercialInfo === "APPROVED" &&
    bankAccountInfo === "APPROVED" &&
    documentation === "APPROVED" &&
    general === "APPROVED"
  );
}

function hasCriticalRejected(payload: AsaasAccountStatusWebhookPayload) {
  const values = [
    payload.accountStatus?.commercialInfo,
    payload.accountStatus?.bankAccountInfo,
    payload.accountStatus?.documentation,
    payload.accountStatus?.general,
  ].map(normalizeStatusValue);

  return values.includes("REJECTED");
}

function buildRejectionReason(payload: AsaasAccountStatusWebhookPayload) {
  const event = safeTrim(payload.event) || "desconhecido";
  const commercialInfo =
    normalizeStatusValue(payload.accountStatus?.commercialInfo) ||
    "desconhecido";
  const bankAccountInfo =
    normalizeStatusValue(payload.accountStatus?.bankAccountInfo) ||
    "desconhecido";
  const documentation =
    normalizeStatusValue(payload.accountStatus?.documentation) ||
    "desconhecido";
  const general =
    normalizeStatusValue(payload.accountStatus?.general) || "desconhecido";

  return `Asaas informou reprovação ou pendência crítica. Evento: ${event} | commercialInfo: ${commercialInfo} | bankAccountInfo: ${bankAccountInfo} | documentation: ${documentation} | general: ${general}`;
}

export async function POST(request: Request) {
  try {
    const configuredToken = getWebhookToken();
    const receivedToken = safeTrim(request.headers.get("asaas-access-token"));

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

    const profile =
      await findOrganizerPaymentProfileByProviderAccountId(providerAccountId);

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

    await syncAsaasAccountStatus({
      organizerUserId: profile.organizerUserId,
      commercialInfo: payload.accountStatus?.commercialInfo || null,
      bankAccountInfo: payload.accountStatus?.bankAccountInfo || null,
      documentation: payload.accountStatus?.documentation || null,
      general: payload.accountStatus?.general || null,
    });

    const statusFromEvent = inferStatusFromEvent(payload.event || "");
    const statusFromGeneral = normalizeGeneralStatus(
      payload.accountStatus?.general
    );

    let nextStatus: OrganizerKycStatus =
      statusFromEvent || statusFromGeneral || "pending";

    if (allCriticalApproved(payload)) {
      nextStatus = "approved";
    }

    if (hasCriticalRejected(payload)) {
      nextStatus = "rejected";
    }

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
        appliedStatus: nextStatus,
        asaasStatus: {
          commercialInfo:
            normalizeStatusValue(payload.accountStatus?.commercialInfo) || null,
          bankAccountInfo:
            normalizeStatusValue(payload.accountStatus?.bankAccountInfo) ||
            null,
          documentation:
            normalizeStatusValue(payload.accountStatus?.documentation) || null,
          general: normalizeStatusValue(payload.accountStatus?.general) || null,
        },
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