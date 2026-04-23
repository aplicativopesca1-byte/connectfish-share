import { NextResponse } from "next/server";

import {
  getOrganizerWalletPayoutStatusServer,
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

export async function GET(request: Request) {
  try {
    const organizerUserId = await requireOrganizerUserIdFromRequest(request);
    const data = await getOrganizerWalletPayoutStatusServer(organizerUserId);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Não foi possível carregar o status de repasse.";

    const status =
      message === "Token de autenticação ausente." ||
      message === "Usuário não autenticado."
        ? 401
        : 500;

    return jsonError(message, status);
  }
}