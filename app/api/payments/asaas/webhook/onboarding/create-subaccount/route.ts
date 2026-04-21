import { NextResponse } from "next/server";

import {
  createAsaasSubaccount,
  getAsaasSubaccount,
} from "../../../../../../../app/services/payments/asaasService";
import {
  ensureOrganizerPaymentProfile,
  getOrganizerPaymentProfile,
  markOrganizerOnboardingSubmitted,
  syncOrganizerProviderAccount,
  upsertOrganizerPaymentProfile,
  type OrganizerPersonType,
} from "../../../../../../../app/services/organizerPaymentProfileService";
import { createFinancialAuditLog } from "../../../../../../../app/services/financialAuditService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RequestBody = {
  organizerUserId?: string;
  personType?: OrganizerPersonType | string | null;
  cpfCnpj?: string | null;
  fullName?: string | null;
  companyName?: string | null;
  email?: string | null;
  phone?: string | null;
  mobilePhone?: string | null;
  birthDate?: string | null;

  postalCode?: string | null;
  address?: string | null;
  addressNumber?: string | null;
  complement?: string | null;
  province?: string | null;
  city?: string | null;
  state?: string | null;

  bankAccountSummary?: string | null;
  pixKeySummary?: string | null;

  termsAccepted?: boolean;
};

function safeTrim(value: unknown) {
  return String(value ?? "").trim();
}

function nullableString(value: unknown) {
  const text = safeTrim(value);
  return text || null;
}

function normalizePersonType(value: unknown): OrganizerPersonType | null {
  const type = safeTrim(value).toUpperCase();
  if (type === "FISICA") return "FISICA";
  if (type === "JURIDICA") return "JURIDICA";
  return null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function requireField(value: unknown, label: string) {
  const text = safeTrim(value);
  if (!text) {
    throw new Error(`${label} é obrigatório.`);
  }
  return text;
}

function buildDisplayName(params: {
  personType: OrganizerPersonType;
  fullName?: string | null;
  companyName?: string | null;
}) {
  if (params.personType === "JURIDICA") {
    return safeTrim(params.companyName) || safeTrim(params.fullName);
  }

  return safeTrim(params.fullName) || safeTrim(params.companyName);
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
  let body: RequestBody | null = null;

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

    body = raw as RequestBody;

    const organizerUserId = requireField(body.organizerUserId, "organizerUserId");
    const personType = normalizePersonType(body.personType);

    if (!personType) {
      return NextResponse.json(
        {
          success: false,
          message: "personType deve ser FISICA ou JURIDICA.",
        },
        { status: 400 }
      );
    }

    if (body.termsAccepted !== true) {
      return NextResponse.json(
        {
          success: false,
          message: "É obrigatório aceitar os termos financeiros.",
        },
        { status: 400 }
      );
    }

    const cpfCnpj = requireField(body.cpfCnpj, "CPF/CNPJ");
    const email = requireField(body.email, "E-mail");
    const name = buildDisplayName({
      personType,
      fullName: body.fullName,
      companyName: body.companyName,
    });

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          message: "Nome do recebedor é obrigatório.",
        },
        { status: 400 }
      );
    }

    await ensureOrganizerPaymentProfile(organizerUserId);

    await upsertOrganizerPaymentProfile({
      organizerUserId,
      provider: "asaas",
      personType,
      cpfCnpj,
      fullName: nullableString(body.fullName),
      companyName: nullableString(body.companyName),
      email,
      phone: nullableString(body.phone),
      mobilePhone: nullableString(body.mobilePhone),
      birthDate: nullableString(body.birthDate),
      postalCode: nullableString(body.postalCode),
      address: nullableString(body.address),
      addressNumber: nullableString(body.addressNumber),
      complement: nullableString(body.complement),
      province: nullableString(body.province),
      city: nullableString(body.city),
      state: nullableString(body.state),
      bankAccountSummary: nullableString(body.bankAccountSummary),
      pixKeySummary: nullableString(body.pixKeySummary),
      termsAcceptedAt: Date.now(),
    });

    const existingProfile = await getOrganizerPaymentProfile(organizerUserId);

    if (existingProfile?.providerAccountId) {
      const asaasAccount = await getAsaasSubaccount(existingProfile.providerAccountId);

      const providerAccountId = extractAsaasAccountId(asaasAccount);
      const providerWalletId = extractAsaasWalletId(asaasAccount);

      await syncOrganizerProviderAccount({
        organizerUserId,
        providerAccountId: providerAccountId || existingProfile.providerAccountId,
        providerWalletId: providerWalletId || existingProfile.providerWalletId,
        chargesEnabled: extractAsaasChargesEnabled(asaasAccount),
        payoutsEnabled: extractAsaasPayoutsEnabled(asaasAccount),
        escrowEnabled: extractAsaasEscrowEnabled(asaasAccount),
        status: extractAsaasStatus(asaasAccount),
      });

      await createFinancialAuditLog({
        source: "asaas_onboarding",
        eventType: "subaccount_already_exists",
        level: "info",
        organizerUserId,
        providerAccountId: existingProfile.providerAccountId,
        message: "Subconta já existente reutilizada.",
        payload: {
          providerAccountId: existingProfile.providerAccountId,
        },
      });

      const nextProfile = await getOrganizerPaymentProfile(organizerUserId);

      return NextResponse.json(
        {
          success: true,
          reused: true,
          message: "Subconta já existia e foi reutilizada.",
          profile: nextProfile,
        },
        { status: 200 }
      );
    }

    const createdAccount = await createAsaasSubaccount({
      name,
      email,
      cpfCnpj,
      birthDate: nullableString(body.birthDate),
      companyType: personType,
      mobilePhone: nullableString(body.mobilePhone),
      phone: nullableString(body.phone),
      address: nullableString(body.address),
      addressNumber: nullableString(body.addressNumber),
      complement: nullableString(body.complement),
      province: nullableString(body.province),
      postalCode: nullableString(body.postalCode),
    });

    const providerAccountId = extractAsaasAccountId(createdAccount);

    if (!providerAccountId) {
      throw new Error("O Asaas não retornou um providerAccountId válido.");
    }

    await markOrganizerOnboardingSubmitted(organizerUserId);

    await syncOrganizerProviderAccount({
      organizerUserId,
      providerAccountId,
      providerWalletId: extractAsaasWalletId(createdAccount) || null,
      chargesEnabled: extractAsaasChargesEnabled(createdAccount),
      payoutsEnabled: extractAsaasPayoutsEnabled(createdAccount),
      escrowEnabled: extractAsaasEscrowEnabled(createdAccount),
      status: extractAsaasStatus(createdAccount),
    });

    await createFinancialAuditLog({
      source: "asaas_onboarding",
      eventType: "subaccount_created",
      level: "info",
      organizerUserId,
      providerAccountId,
      message: "Subconta criada com sucesso no Asaas.",
      payload: {
        providerAccountId,
        personType,
        email,
      },
    });

    const profile = await getOrganizerPaymentProfile(organizerUserId);

    return NextResponse.json(
      {
        success: true,
        message: "Subconta criada com sucesso.",
        providerAccountId,
        profile,
      },
      { status: 200 }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Erro desconhecido ao criar subconta no Asaas.";

    try {
      await createFinancialAuditLog({
        source: "asaas_onboarding",
        eventType: "subaccount_create_failed",
        level: "error",
        organizerUserId: nullableString(body?.organizerUserId),
        message,
        payload:
          body && typeof body === "object"
            ? (body as unknown as Record<string, unknown>)
            : null,
      });
    } catch (auditError) {
      console.error("Erro ao salvar audit log do onboarding:", auditError);
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