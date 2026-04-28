import { NextResponse } from "next/server";
import {
  ensureOrganizerPaymentProfile,
  getOrganizerPaymentProfile,
  markOrganizerOnboardingSubmitted,
  setOrganizerOnboardingUrl,
  syncOrganizerProviderAccount,
  upsertOrganizerPaymentProfile,
  type OrganizerKycStatus,
  type OrganizerPersonType,
} from "../../../../../app/services/organizerPaymentProfileService";

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

  incomeValue?: number | string | null;

  pixKeyType?: string | null;
  pixKey?: string | null;

  bankCode?: string | null;
  bankName?: string | null;
  agency?: string | null;
  account?: string | null;
  accountDigit?: string | null;
  accountType?: string | null;

  termsAccepted?: boolean;
};

type AsaasCreateAccountPayload = {
  name: string;
  email: string;
  loginEmail?: string;
  cpfCnpj: string;
  birthDate?: string;
  companyType: "MEI" | "LIMITED" | "INDIVIDUAL";
  incomeValue: number;
  phone?: string;
  mobilePhone?: string;
  address: string;
  addressNumber: string;
  complement?: string;
  province: string;
  postalCode: string;
};

type AsaasCreateAccountResponse = {
  id?: string;
  walletId?: string;
  apiKey?: string;
};

type AsaasDocumentItem = {
  id?: string;
  type?: string;
  status?: string;
  title?: string;
  description?: string;
  onboardingUrl?: string | null;
  [key: string]: unknown;
};

type AsaasDocumentsResponse =
  | AsaasDocumentItem[]
  | {
      onboardingUrl?: string | null;
      data?: AsaasDocumentItem[];
      documents?: AsaasDocumentItem[];
      commercialInfo?: string | null;
      bankAccountInfo?: string | null;
      documentation?: string | null;
      general?: string | null;
      [key: string]: unknown;
    };

function safeTrim(value: unknown) {
  return String(value ?? "").trim();
}

function nullableString(value: unknown) {
  const text = safeTrim(value);
  return text || null;
}

function onlyDigits(value: unknown) {
  return String(value ?? "").replace(/\D+/g, "");
}

function toPositiveNumber(value: unknown) {
  const normalized = Number(String(value ?? "").replace(",", "."));
  if (!Number.isFinite(normalized) || normalized <= 0) return null;
  return normalized;
}

function buildBankAccountSummary(params: {
  bankName: string;
  bankCode: string;
  agency: string;
  account: string;
  accountDigit: string;
  accountType: string;
}) {
  const parts = [
    params.bankName ? `Banco: ${params.bankName}` : "",
    params.bankCode ? `Código: ${params.bankCode}` : "",
    params.agency ? `Agência: ${params.agency}` : "",
    params.account
      ? `Conta: ${params.account}${params.accountDigit ? `-${params.accountDigit}` : ""}`
      : "",
    params.accountType
      ? `Tipo: ${
          params.accountType === "CHECKING_ACCOUNT"
            ? "Corrente"
            : params.accountType === "SAVINGS_ACCOUNT"
              ? "Poupança"
              : params.accountType
        }`
      : "",
  ].filter(Boolean);

  return parts.join(" | ") || null;
}

function buildPixKeySummary(params: { pixKeyType: string; pixKey: string }) {
  if (!params.pixKey) return null;
  if (!params.pixKeyType) return params.pixKey;
  return `${params.pixKeyType}: ${params.pixKey}`;
}

function normalizePersonType(value: unknown): OrganizerPersonType | null {
  const raw = safeTrim(value).toUpperCase();
  if (raw === "FISICA") return "FISICA";
  if (raw === "JURIDICA") return "JURIDICA";
  return null;
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ success: false, message }, { status });
}

function getAsaasBaseUrl() {
  const explicit = safeTrim(process.env.ASAAS_BASE_URL);
  if (explicit) return explicit.replace(/\/+$/, "");

  const sandbox = safeTrim(process.env.ASAAS_ENV).toLowerCase() === "sandbox";

  return sandbox
    ? "https://api-sandbox.asaas.com/v3"
    : "https://api.asaas.com/v3";
}

function getAsaasApiKey() {
  return (
    safeTrim(process.env.ASAAS_API_KEY) ||
    safeTrim(process.env.ASAAS_ROOT_API_KEY)
  );
}

function resolveCompanyType(
  personType: OrganizerPersonType
): "MEI" | "LIMITED" | "INDIVIDUAL" {
  if (personType === "FISICA") return "INDIVIDUAL";
  return "LIMITED";
}

function validateRequiredFields(input: {
  personType: OrganizerPersonType | null;
  cpfCnpj: string;
  fullName: string;
  companyName: string;
  email: string;
  phone: string;
  mobilePhone: string;
  birthDate: string;
  postalCode: string;
  address: string;
  addressNumber: string;
  province: string;
  city: string;
  state: string;
  incomeValue: number | null;
  termsAccepted: boolean;
}) {
  const missing: string[] = [];

  if (!input.personType) missing.push("personType");
  if (!input.cpfCnpj) missing.push("cpfCnpj");
  if (!input.email) missing.push("email");
  if (!input.birthDate) missing.push("birthDate");
  if (!input.postalCode) missing.push("postalCode");
  if (!input.address) missing.push("address");
  if (!input.addressNumber) missing.push("addressNumber");
  if (!input.province) missing.push("province");
  if (!input.city) missing.push("city");
  if (!input.state) missing.push("state");
  if (!input.incomeValue) missing.push("incomeValue");
  if (!input.termsAccepted) missing.push("termsAccepted");

  if (input.personType === "FISICA" && !input.fullName) {
    missing.push("fullName");
  }

  if (input.personType === "JURIDICA" && !input.companyName) {
    missing.push("companyName");
  }

  if (!input.phone && !input.mobilePhone) {
    missing.push("phone/mobilePhone");
  }

  if (!input.mobilePhone) {
    missing.push("mobilePhone");
  }

  return missing;
}

function buildDisplayName(params: {
  personType: OrganizerPersonType;
  fullName: string;
  companyName: string;
}) {
  if (params.personType === "JURIDICA") {
    return params.companyName || params.fullName || "Organizador ConnectFish";
  }

  return params.fullName || params.companyName || "Organizador ConnectFish";
}

function extractDocuments(result: AsaasDocumentsResponse | null) {
  if (!result) return [];

  if (Array.isArray(result)) return result;

  if (Array.isArray(result.data)) return result.data;
  if (Array.isArray(result.documents)) return result.documents;

  return [];
}

function findOnboardingUrl(result: AsaasDocumentsResponse | null) {
  if (!result) return null;

  if (!Array.isArray(result) && nullableString(result.onboardingUrl)) {
    return nullableString(result.onboardingUrl);
  }

  const documents = extractDocuments(result);

  const pendingWithLink = documents.find((item) => {
    const status = safeTrim(item.status).toUpperCase();
    return nullableString(item.onboardingUrl) && status !== "APPROVED";
  });

  if (pendingWithLink?.onboardingUrl) {
    return nullableString(pendingWithLink.onboardingUrl);
  }

  const anyWithLink = documents.find((item) => nullableString(item.onboardingUrl));
  return nullableString(anyWithLink?.onboardingUrl);
}

async function createAsaasSubaccount(params: {
  personType: OrganizerPersonType;
  fullName: string;
  companyName: string;
  email: string;
  cpfCnpj: string;
  birthDate: string;
  incomeValue: number;
  phone: string;
  mobilePhone: string;
  address: string;
  addressNumber: string;
  complement: string;
  province: string;
  postalCode: string;
}) {
  const apiKey = getAsaasApiKey();

  if (!apiKey) {
    throw new Error("ASAAS_API_KEY não configurada no servidor.");
  }

  const payload: AsaasCreateAccountPayload = {
    name: buildDisplayName({
      personType: params.personType,
      fullName: params.fullName,
      companyName: params.companyName,
    }),
    email: params.email,
    loginEmail: params.email,
    cpfCnpj: params.cpfCnpj,
    companyType: resolveCompanyType(params.personType),
    incomeValue: params.incomeValue,
    address: params.address,
    addressNumber: params.addressNumber,
    complement: params.complement || undefined,
    province: params.province,
    postalCode: params.postalCode,
    phone: params.phone || undefined,
    mobilePhone: params.mobilePhone || undefined,
    birthDate: params.personType === "FISICA" ? params.birthDate : undefined,
  };

  const response = await fetch(`${getAsaasBaseUrl()}/accounts`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      access_token: apiKey,
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const result = (await response.json().catch(() => null)) as
    | AsaasCreateAccountResponse
    | { errors?: Array<{ description?: string }> }
    | null;

  if (!response.ok) {
    const apiMessage =
      Array.isArray(
        (result as { errors?: Array<{ description?: string }> } | null)?.errors
      ) &&
      (result as { errors?: Array<{ description?: string }> }).errors?.length
        ? (result as { errors?: Array<{ description?: string }> }).errors
            ?.map((item) => safeTrim(item.description))
            .filter(Boolean)
            .join(" | ")
        : "";

    throw new Error(apiMessage || "Falha ao criar subconta no Asaas.");
  }

  return {
    providerAccountId: nullableString(
      (result as AsaasCreateAccountResponse | null)?.id
    ),
    providerWalletId: nullableString(
      (result as AsaasCreateAccountResponse | null)?.walletId
    ),
    providerApiKey: nullableString(
      (result as AsaasCreateAccountResponse | null)?.apiKey
    ),
    raw: result,
  };
}

async function getAsaasDocuments(providerApiKey: string | null) {
  const apiKey = safeTrim(providerApiKey);
  if (!apiKey) return null;

  const response = await fetch(`${getAsaasBaseUrl()}/myAccount/documents`, {
    method: "GET",
    headers: {
      accept: "application/json",
      access_token: apiKey,
    },
    cache: "no-store",
  });

  const result = (await response.json().catch(() => null)) as
    | AsaasDocumentsResponse
    | { errors?: Array<{ description?: string; code?: string }> }
    | null;

  if (!response.ok) {
    console.error("Erro ao buscar documentos pendentes Asaas:", result);
    return null;
  }

  return result as AsaasDocumentsResponse;
}

async function waitForAsaasProvisioning() {
  await new Promise((resolve) => setTimeout(resolve, 15000));
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as RequestBody | null;

    if (!body) {
      return jsonError("Body inválido.");
    }

    const organizerUserId = safeTrim(body.organizerUserId);
    const personType = normalizePersonType(body.personType);

    const cpfCnpj = onlyDigits(body.cpfCnpj);
    const fullName = safeTrim(body.fullName);
    const companyName = safeTrim(body.companyName);
    const email = safeTrim(body.email).toLowerCase();
    const phone = onlyDigits(body.phone);
    const mobilePhone = onlyDigits(body.mobilePhone);
    const birthDate = safeTrim(body.birthDate);

    const postalCode = onlyDigits(body.postalCode);
    const address = safeTrim(body.address);
    const addressNumber = safeTrim(body.addressNumber);
    const complement = safeTrim(body.complement);
    const province = safeTrim(body.province);
    const city = safeTrim(body.city);
    const state = safeTrim(body.state).toUpperCase();

    const incomeValue = toPositiveNumber(body.incomeValue);

    const pixKeyType = safeTrim(body.pixKeyType).toUpperCase();
    const pixKey = safeTrim(body.pixKey);

    const bankCode = onlyDigits(body.bankCode);
    const bankName = safeTrim(body.bankName);
    const agency = safeTrim(body.agency);
    const account = safeTrim(body.account);
    const accountDigit = safeTrim(body.accountDigit);
    const accountType = safeTrim(body.accountType).toUpperCase();

    const bankAccountSummary = buildBankAccountSummary({
      bankName,
      bankCode,
      agency,
      account,
      accountDigit,
      accountType,
    });

    const pixKeySummary = buildPixKeySummary({
      pixKeyType,
      pixKey,
    });

    const termsAccepted = body.termsAccepted === true;

    if (!organizerUserId) {
      return jsonError("organizerUserId é obrigatório.");
    }

    const missing = validateRequiredFields({
      personType,
      cpfCnpj,
      fullName,
      companyName,
      email,
      phone,
      mobilePhone,
      birthDate,
      postalCode,
      address,
      addressNumber,
      province,
      city,
      state,
      incomeValue,
      termsAccepted,
    });

    if (missing.length > 0) {
      return jsonError(`Campos obrigatórios ausentes: ${missing.join(", ")}.`);
    }

    const existingProfile = await getOrganizerPaymentProfile(organizerUserId);

    let nextStatus: OrganizerKycStatus = "pending";
    let providerAccountId = existingProfile?.providerAccountId || null;
    let providerWalletId = existingProfile?.providerWalletId || null;
    let providerApiKey = existingProfile?.providerApiKey || null;
    let reused = false;

    if (providerAccountId && providerWalletId) {
      reused = true;
    } else {
      const createdAccount = await createAsaasSubaccount({
        personType: personType as OrganizerPersonType,
        fullName,
        companyName,
        email,
        cpfCnpj,
        birthDate,
        incomeValue: incomeValue as number,
        phone,
        mobilePhone,
        address,
        addressNumber,
        complement,
        province,
        postalCode,
      });

      providerAccountId = createdAccount.providerAccountId;
      providerWalletId = createdAccount.providerWalletId;
      providerApiKey = createdAccount.providerApiKey;
      reused = false;
    }

    await ensureOrganizerPaymentProfile(organizerUserId);

    const savedProfile = await upsertOrganizerPaymentProfile({
      organizerUserId,
      personType,
      cpfCnpj,
      fullName: fullName || null,
      companyName: companyName || null,
      email,
      phone: phone || null,
      mobilePhone: mobilePhone || null,
      birthDate: birthDate || null,
      postalCode: postalCode || null,
      address: address || null,
      addressNumber: addressNumber || null,
      complement: complement || null,
      province: province || null,
      city: city || null,
      state: state || null,

      incomeValue,

      pixKeyType: pixKeyType || null,
      pixKey: pixKey || null,

      bankCode: bankCode || null,
      bankName: bankName || null,
      agency: agency || null,
      account: account || null,
      accountDigit: accountDigit || null,
      accountType: accountType || null,

      bankAccountSummary,
      pixKeySummary,
      termsAcceptedAt: Date.now(),
    });

    nextStatus = savedProfile.status === "approved" ? "approved" : "pending";

    await syncOrganizerProviderAccount({
      organizerUserId,
      providerAccountId,
      providerWalletId,
      providerApiKey,
      status: nextStatus,
      chargesEnabled: nextStatus === "approved",
      payoutsEnabled: nextStatus === "approved",
      escrowEnabled: existingProfile?.escrowEnabled ?? false,
    });

    let onboardingUrl: string | null = null;
    let documents: AsaasDocumentItem[] = [];

    if (providerApiKey) {
      await waitForAsaasProvisioning();

      const documentsResult = await getAsaasDocuments(providerApiKey);
      documents = extractDocuments(documentsResult);
      onboardingUrl = findOnboardingUrl(documentsResult);

      if (onboardingUrl) {
        await setOrganizerOnboardingUrl({
          organizerUserId,
          onboardingUrl,
        });
      }
    }

    if (nextStatus === "pending") {
      await markOrganizerOnboardingSubmitted(organizerUserId);
    }

    const profile = await getOrganizerPaymentProfile(organizerUserId);

    return NextResponse.json(
      {
        success: true,
        reused,
        message: reused
          ? "Conta do organizador atualizada com sucesso."
          : "Conta do organizador criada e enviada para análise.",
        profile,
        organizerUserId,
        providerAccountId,
        providerWalletId,
        providerApiKey,
        onboardingUrl: onboardingUrl || profile?.onboardingUrl || null,
        documents,
        status: profile?.status || nextStatus,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Erro no onboarding financeiro do organizador:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Erro interno ao processar onboarding do organizador.",
      },
      { status: 500 }
    );
  }
}