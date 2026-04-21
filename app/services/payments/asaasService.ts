export type AsaasPersonType = "FISICA" | "JURIDICA";
export type AsaasBillingType = "PIX" | "BOLETO" | "CREDIT_CARD";
export type AsaasSplitType = "PERCENTAGE" | "FIXED";

export type CreateAsaasSubaccountInput = {
  name: string;
  email: string;
  cpfCnpj: string;
  birthDate?: string | null;
  companyType?: AsaasPersonType;
  mobilePhone?: string | null;
  phone?: string | null;

  address?: string | null;
  addressNumber?: string | null;
  complement?: string | null;
  province?: string | null;
  postalCode?: string | null;
};

export type AsaasSplitItem = {
  walletId: string;
  fixedValue?: number;
  percentualValue?: number;
};

export type CreateAsaasTournamentChargeInput = {
  customer?: string | null;
  billingType: AsaasBillingType;
  value: number;
  dueDate: string;
  description: string;
  externalReference: string;
  name?: string | null;
  email?: string | null;
  cpfCnpj?: string | null;
  mobilePhone?: string | null;
  phone?: string | null;
  postalCode?: string | null;
  addressNumber?: string | null;
  split?: AsaasSplitItem[];
};

function safeTrim(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeMoney(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Number(parsed.toFixed(2));
}

function getAsaasApiKey() {
  const apiKey =
    process.env.ASAAS_API_KEY ||
    process.env.NEXT_PUBLIC_ASAAS_API_KEY ||
    "";

  if (!apiKey.trim()) {
    throw new Error("ASAAS_API_KEY não configurada.");
  }

  return apiKey.trim();
}

function getAsaasBaseUrl() {
  return (
    process.env.ASAAS_BASE_URL?.trim() || "https://api.asaas.com/v3"
  ).replace(/\/+$/, "");
}

async function asaasRequest<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(`${getAsaasBaseUrl()}${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      access_token: getAsaasApiKey(),
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  const json = (await response.json().catch(() => null)) as T | {
    errors?: Array<{ code?: string; description?: string }>;
  } | null;

  if (!response.ok) {
    const message =
      json &&
      typeof json === "object" &&
      "errors" in json &&
      Array.isArray(json.errors) &&
      json.errors.length > 0
        ? json.errors.map((item) => item.description || item.code).join(" | ")
        : `Erro Asaas (${response.status})`;

    throw new Error(message);
  }

  return json as T;
}

export async function createAsaasSubaccount(
  input: CreateAsaasSubaccountInput
) {
  const payload = {
    name: safeTrim(input.name),
    email: safeTrim(input.email).toLowerCase(),
    cpfCnpj: safeTrim(input.cpfCnpj),
    birthDate: safeTrim(input.birthDate) || undefined,
    companyType: safeTrim(input.companyType).toUpperCase() || undefined,
    mobilePhone: safeTrim(input.mobilePhone) || undefined,
    phone: safeTrim(input.phone) || undefined,
    address: safeTrim(input.address) || undefined,
    addressNumber: safeTrim(input.addressNumber) || undefined,
    complement: safeTrim(input.complement) || undefined,
    province: safeTrim(input.province) || undefined,
    postalCode: safeTrim(input.postalCode) || undefined,
  };

  return asaasRequest<Record<string, unknown>>("/accounts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getAsaasSubaccount(accountId: string) {
  const id = safeTrim(accountId);
  if (!id) {
    throw new Error("accountId é obrigatório.");
  }

  return asaasRequest<Record<string, unknown>>(`/accounts/${id}`, {
    method: "GET",
  });
}

export async function createAsaasCustomer(params: {
  name: string;
  email?: string | null;
  cpfCnpj?: string | null;
  mobilePhone?: string | null;
  phone?: string | null;
}) {
  const payload = {
    name: safeTrim(params.name),
    email: safeTrim(params.email).toLowerCase() || undefined,
    cpfCnpj: safeTrim(params.cpfCnpj) || undefined,
    mobilePhone: safeTrim(params.mobilePhone) || undefined,
    phone: safeTrim(params.phone) || undefined,
  };

  return asaasRequest<Record<string, unknown>>("/customers", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createAsaasTournamentCharge(
  input: CreateAsaasTournamentChargeInput
) {
  const payload = {
    customer: safeTrim(input.customer) || undefined,
    billingType: safeTrim(input.billingType).toUpperCase(),
    value: normalizeMoney(input.value),
    dueDate: safeTrim(input.dueDate),
    description: safeTrim(input.description),
    externalReference: safeTrim(input.externalReference),

    name: safeTrim(input.name) || undefined,
    email: safeTrim(input.email).toLowerCase() || undefined,
    cpfCnpj: safeTrim(input.cpfCnpj) || undefined,
    mobilePhone: safeTrim(input.mobilePhone) || undefined,
    phone: safeTrim(input.phone) || undefined,
    postalCode: safeTrim(input.postalCode) || undefined,
    addressNumber: safeTrim(input.addressNumber) || undefined,

    split: Array.isArray(input.split)
      ? input.split.map((item) => ({
          walletId: safeTrim(item.walletId),
          fixedValue:
            item.fixedValue !== undefined
              ? normalizeMoney(item.fixedValue)
              : undefined,
          percentualValue:
            item.percentualValue !== undefined
              ? Number(item.percentualValue)
              : undefined,
        }))
      : undefined,
  };

  type AsaasPaymentResponse = {
  id: string;
  invoiceUrl?: string;
  pixQrCode?: string;
  pixCopyPaste?: string;
};

return asaasRequest<AsaasPaymentResponse>("/payments",{
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getAsaasPayment(paymentId: string) {
  const id = safeTrim(paymentId);
  if (!id) {
    throw new Error("paymentId é obrigatório.");
  }

  return asaasRequest<Record<string, unknown>>(`/payments/${id}`, {
    method: "GET",
  });
}

export async function createAsaasWebhook(params: {
  url: string;
  email?: string | null;
  enabled?: boolean;
  interrupted?: boolean;
  apiVersion?: number;
}) {
  const payload = {
    url: safeTrim(params.url),
    email: safeTrim(params.email).toLowerCase() || undefined,
    enabled: params.enabled ?? true,
    interrupted: params.interrupted ?? false,
    apiVersion: params.apiVersion ?? 3,
  };

  return asaasRequest<Record<string, unknown>>("/webhook", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}