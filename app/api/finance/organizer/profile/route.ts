import { NextResponse } from "next/server";
import { getOrganizerPaymentProfile } from "../../../../../app/services/organizerPaymentProfileService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const organizerUserId = safeTrim(searchParams.get("organizerUserId"));

    if (!organizerUserId) {
      return jsonError("organizerUserId é obrigatório.");
    }

    const profile = await getOrganizerPaymentProfile(organizerUserId);

    return NextResponse.json(
      {
        success: true,
        profile,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Erro ao buscar perfil financeiro do organizador:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Erro ao buscar perfil financeiro do organizador.",
      },
      { status: 500 }
    );
  }
}