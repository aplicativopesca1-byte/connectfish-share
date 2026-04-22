import { NextResponse } from "next/server";
import { getOrganizerPaymentProfile } from "../../../../../app/services/organizerPaymentProfileService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AsaasDocumentStatus =
  | "APPROVED"
  | "PENDING"
  | "REJECTED"
  | "AWAITING_APPROVAL"
  | string;

type AsaasDocumentItem = {
  id?: string;
  type?: string;
  status?: AsaasDocumentStatus;
  sent?: boolean;
  onboardingUrl?: string | null;
  [key: string]: unknown;
};

type AsaasDocumentsResponse = {
  data?: AsaasDocumentItem[];
  [key: string]: unknown;
};

function safeTrim(value: unknown) {
  return String(value ?? "").trim();
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ success: false, message }, { status });
}

function getAsaasBaseUrl() {
  const configured = safeTrim(process.env.ASAAS_BASE_URL);
  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  const env = safeTrim(process.env.ASAAS_ENV).toLowerCase();
  if (env === "production") {
    return "https://api.asaas.com/v3";
  }

  return "https://api-sandbox.asaas.com/v3";
}

function getProviderApiKey(profile: unknown) {
  if (!profile || typeof profile !== "object") return null;

  const raw = profile as Record<string, unknown>;
  return (
    safeTrim(raw.providerApiKey) ||
    safeTrim(raw.subaccountApiKey) ||
    safeTrim(raw.accountApiKey) ||
    null
  );
}

function isDocPending(status: unknown) {
  const normalized = safeTrim(status).toUpperCase();
  return normalized !== "APPROVED";
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const organizerUserId = safeTrim(searchParams.get("organizerUserId"));

    if (!organizerUserId) {
      return jsonError("organizerUserId é obrigatório.");
    }

    const profile = await getOrganizerPaymentProfile(organizerUserId);

    if (!profile) {
      return jsonError("Perfil financeiro não encontrado.", 404);
    }

    if (!profile.providerAccountId) {
      return jsonError("Conta Asaas ainda não criada.", 409);
    }

    const providerApiKey = getProviderApiKey(profile);

    if (!providerApiKey) {
      return jsonError(
        "API key da subconta não encontrada. Salve a providerApiKey ao criar a conta Asaas.",
        409
      );
    }

    const response = await fetch(`${getAsaasBaseUrl()}/myAccount/documents`, {
      method: "GET",
      headers: {
        accept: "application/json",
        access_token: providerApiKey,
      },
      cache: "no-store",
    });

    const data =
      (await response.json().catch(() => null)) as AsaasDocumentsResponse | null;

    if (!response.ok) {
      const apiMessage =
        Array.isArray(data?.data) === false
          ? "Erro ao consultar documentos do Asaas."
          : "Erro ao consultar documentos do Asaas.";

      return jsonError(apiMessage, response.status || 502);
    }

    const documents = Array.isArray(data?.data) ? data!.data! : [];
    const pendingDocs = documents.filter((doc) => isDocPending(doc.status));

    const onboardingUrl =
      pendingDocs.find((doc) => safeTrim(doc.onboardingUrl))?.onboardingUrl ||
      documents.find((doc) => safeTrim(doc.onboardingUrl))?.onboardingUrl ||
      null;

    return NextResponse.json(
      {
        success: true,
        pending: pendingDocs.length > 0,
        documents: pendingDocs,
        documentsCount: documents.length,
        pendingCount: pendingDocs.length,
        onboardingUrl: safeTrim(onboardingUrl) || null,
        providerAccountId: profile.providerAccountId,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Erro ao buscar documentos Asaas:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Erro ao buscar documentos.",
      },
      { status: 500 }
    );
  }
}