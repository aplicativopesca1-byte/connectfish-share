import { NextResponse } from "next/server";

import { getAsaasSubaccount } from "../../../../../../app/services/payments/asaasService";
import {
  getOrganizerPaymentProfile,
  syncOrganizerProviderAccount,
} from "../../../../../../app/services/organizerPaymentProfileService";
import { createFinancialAuditLog } from "../../../../../../app/services/financialAuditService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RequestBody = {
  organizerUserId?: string;
};

function safeTrim(value: unknown) {
  return String(value ?? "").trim();
}

function nullableString(value: unknown) {
  const text = safeTrim(value);
  return text || null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function extractAsaasAccountId(raw: Record<string, unknown>) {
  return safeTrim(raw.id);
}

function extractAsaasWalletId(raw: Record<string, unknown>) {
  return (
    safeTrim(raw.walletId) ||
    safeTrim(raw.wallet) ||
    safeTrim(raw.apiKey) ||
    ""
  );
}

function extractAsaasChargesEnabled(raw: Record<string, unknown>) {
  if (typeof raw.canReceivePayments === "boolean") {
    return raw.canReceivePayments;
  }

  if (typeof raw.chargesEnabled === "boolean") {
    return raw.chargesEnabled;
  }

  return true;
}

function extractAsaasPayoutsEnabled(raw: Record<string, unknown>) {
  if (typeof raw.transfersEnabled === "boolean") {
    return raw.transfersEnabled;
  }

  if (typeof raw.payoutsEnabled === "boolean") {
    return raw.payoutsEnabled;
  }

  return true;
}

function extractAsaasEscrowEnabled(raw: Record<string, unknown>) {
  if (typeof raw.escrowEnabled === "boolean") {
    return raw.escrowEnabled;
  }

  return false;
}

function extractAsaasStatus(raw: Record<string, unknown>) {
  const status = safeTrim(raw.status).toLowerCase();

  if (status === "approved" || status === "active") return "approved";
  if (status === "rejected") return "rejected";
  if (status === "pending") return "pending";

  return "pending";
}

export async function POST(request: Request) {
  let organizerUserId: string | null = null;

  try {
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
    organizerUserId = nullableString(body.organizerUserId);

    if (!organizerUserId) {
      return NextResponse.json(
        {
          success: false,
          message: "organizerUserId é obrigatório.",
        },
        { status: 400 }
      );
    }

    const profile = await getOrganizerPaymentProfile(organizerUserId);

    if (!profile) {
      return NextResponse.json(
        {
          success: false,
          message: "Perfil financeiro do organizador não encontrado.",
        },
        { status: 404 }
      );
    }

    if (!profile.providerAccountId) {
      return NextResponse.json(
        {
          success: false,
          message: "Este organizador ainda não possui subconta criada no Asaas.",
        },
        { status: 409 }
      );
    }

    const asaasAccount = await getAsaasSubaccount(profile.providerAccountId);

    const providerAccountId =
      extractAsaasAccountId(asaasAccount) || profile.providerAccountId;

    const providerWalletId =
      extractAsaasWalletId(asaasAccount) || profile.providerWalletId || null;

    const status = extractAsaasStatus(asaasAccount);
    const chargesEnabled = extractAsaasChargesEnabled(asaasAccount);
    const payoutsEnabled = extractAsaasPayoutsEnabled(asaasAccount);
    const escrowEnabled = extractAsaasEscrowEnabled(asaasAccount);

    await syncOrganizerProviderAccount({
      organizerUserId,
      providerAccountId,
      providerWalletId,
      chargesEnabled,
      payoutsEnabled,
      escrowEnabled,
      status,
    });

    const updatedProfile = await getOrganizerPaymentProfile(organizerUserId);

    await createFinancialAuditLog({
      source: "asaas_onboarding",
      eventType: "subaccount_status_refreshed",
      level: "info",
      organizerUserId,
      providerAccountId,
      message: "Status da subconta atualizado com sucesso.",
      payload: {
        providerAccountId,
        providerWalletId,
        status,
        chargesEnabled,
        payoutsEnabled,
        escrowEnabled,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Status financeiro atualizado com sucesso.",
        profile: updatedProfile,
      },
      { status: 200 }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Erro desconhecido ao atualizar status da subconta.";

    try {
      await createFinancialAuditLog({
        source: "asaas_onboarding",
        eventType: "subaccount_status_refresh_failed",
        level: "error",
        organizerUserId,
        message,
        payload: organizerUserId ? { organizerUserId } : null,
      });
    } catch (auditError) {
      console.error("Erro ao salvar audit log do refresh-status:", auditError);
    }

    return NextResponse.json(
      {
        success: false,
        message,
      },
      { status: 500 }
    );
  }
}