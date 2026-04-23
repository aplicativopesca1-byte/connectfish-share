import { NextResponse } from "next/server";

import {
  createOrganizerWalletPayoutRequestServer,
  requireOrganizerUserIdFromRequest,
} from "../../../../../../app/services/server/organizerWalletServerService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status = 400) {
  return NextResponse.json(
    {
      success: false,
      message,
    },
    { status }
  );
}

export async function POST(request: Request) {
  try {
    const organizerUserId = await requireOrganizerUserIdFromRequest(request);
    const created = await createOrganizerWalletPayoutRequestServer({
      organizerUserId,
    });

    return NextResponse.json({
      success: true,
      data: created,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Não foi possível solicitar o repasse.";

    const status =
      message === "Token de autenticação ausente." ||
      message === "Usuário não autenticado."
        ? 401
        : message.includes("saldo disponível") || message.includes("em andamento")
          ? 400
          : 500;

    return jsonError(message, status);
  }
}