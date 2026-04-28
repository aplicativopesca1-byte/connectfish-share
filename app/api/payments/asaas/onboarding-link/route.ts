import { NextResponse } from "next/server";
import {
  getOrganizerPaymentProfile,
  markOrganizerOnboardingSubmitted,
  setOrganizerOnboardingUrl,
  syncAsaasAccountStatus,
} from "../../../../../app/services/organizerPaymentProfileService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
      data?: AsaasDocumentItem[];
      documents?: AsaasDocumentItem[];
      commercialInfo?: string | null;
      bankAccountInfo?: string | null;
      documentation?: string | null;
      general?: string | null;
      [key: string]: unknown;
    };

type RequestBody = {
  organizerUserId?: string | null;
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

function getAsaasBaseUrl() {
  const explicit = safeTrim(process.env.ASAAS_BASE_URL);
  if (explicit) return explicit.replace(/\/+$/, "");

  const sandbox = safeTrim(process.env.ASAAS_ENV).toLowerCase() === "sandbox";

  return sandbox
    ? "https://api-sandbox.asaas.com/v3"
    : "https://api.asaas.com/v3";
}

function extractDocuments(result: AsaasDocumentsResponse | null) {
  if (!result) return [];

  if (Array.isArray(result)) {
    return result;
  }

  if (Array.isArray(result.data)) {
    return result.data;
  }

  if (Array.isArray(result.documents)) {
    return result.documents;
  }

  return [];
}

function findBestOnboardingUrl(documents: AsaasDocumentItem[]) {
  const pendingWithLink = documents.find((item) => {
    const status = safeTrim(item.status).toUpperCase();
    return item.onboardingUrl && status !== "APPROVED";
  });

  if (pendingWithLink?.onboardingUrl) {
    return safeTrim(pendingWithLink.onboardingUrl);
  }

  const anyWithLink = documents.find((item) => item.onboardingUrl);

  return safeTrim(anyWithLink?.onboardingUrl) || null;
}

async function getAsaasDocuments(providerApiKey: string) {
  const response = await fetch(`${getAsaasBaseUrl()}/myAccount/documents`, {
    method: "GET",
    headers: {
      accept: "application/json",
      access_token: providerApiKey,
    },
    cache: "no-store",
  });

  const result = (await response.json().catch(() => null)) as
    | AsaasDocumentsResponse
    | { errors?: Array<{ description?: string; code?: string }> }
    | null;

  if (!response.ok) {
    const message =
      result &&
      typeof result === "object" &&
      "errors" in result &&
      Array.isArray(result.errors)
        ? result.errors
            .map((item) => item.description || item.code)
            .filter(Boolean)
            .join(" | ")
        : "";

    throw new Error(message || "Não foi possível buscar documentos no Asaas.");
  }

  return result as AsaasDocumentsResponse;
}

async function getAsaasMyAccountStatus(providerApiKey: string) {
  const response = await fetch(`${getAsaasBaseUrl()}/myAccount/status`, {
    method: "GET",
    headers: {
      accept: "application/json",
      access_token: providerApiKey,
    },
    cache: "no-store",
  });

  if (!response.ok) return null;

  return (await response.json().catch(() => null)) as Record<string, unknown> | null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as RequestBody | null;
    const organizerUserId = safeTrim(body?.organizerUserId);

    if (!organizerUserId) {
      return jsonError("organizerUserId é obrigatório.");
    }

    const profile = await getOrganizerPaymentProfile(organizerUserId);

    if (!profile) {
      return jsonError("Perfil financeiro não encontrado.", 404);
    }

    if (!profile.providerApiKey) {
      return jsonError(
        "Subconta Asaas ainda não possui API Key. Finalize o cadastro financeiro primeiro.",
        409
      );
    }

    const [documentsResult, statusResult] = await Promise.all([
      getAsaasDocuments(profile.providerApiKey),
      getAsaasMyAccountStatus(profile.providerApiKey),
    ]);

    const documents = extractDocuments(documentsResult);
    const onboardingUrl = findBestOnboardingUrl(documents);

    const commercialInfo =
      safeTrim(statusResult?.commercialInfo) ||
      safeTrim((documentsResult as Record<string, unknown>)?.commercialInfo) ||
      null;

    const bankAccountInfo =
      safeTrim(statusResult?.bankAccountInfo) ||
      safeTrim((documentsResult as Record<string, unknown>)?.bankAccountInfo) ||
      null;

    const documentation =
      safeTrim(statusResult?.documentation) ||
      safeTrim((documentsResult as Record<string, unknown>)?.documentation) ||
      null;

    const general =
      safeTrim(statusResult?.general) ||
      safeTrim((documentsResult as Record<string, unknown>)?.general) ||
      null;

    await syncAsaasAccountStatus({
      organizerUserId,
      commercialInfo,
      bankAccountInfo,
      documentation,
      general,
    });

    if (onboardingUrl) {
      await setOrganizerOnboardingUrl({
        organizerUserId,
        onboardingUrl,
      });

      await markOrganizerOnboardingSubmitted(organizerUserId);
    }

    const updatedProfile = await getOrganizerPaymentProfile(organizerUserId);

    return NextResponse.json(
      {
        success: true,
        data: {
          onboardingUrl: onboardingUrl || updatedProfile?.onboardingUrl || null,
          documents,
          profile: updatedProfile,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Erro ao gerar link de onboarding Asaas:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Erro interno ao gerar link de onboarding.",
      },
      { status: 500 }
    );
  }
}