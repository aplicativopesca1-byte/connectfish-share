import { NextResponse } from "next/server";

import {
  getOrganizerWalletDashboardServer,
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
    const dashboard = await getOrganizerWalletDashboardServer(organizerUserId);

    return NextResponse.json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Não foi possível carregar a wallet do organizador.";

    const status =
      message === "Token de autenticação ausente." ||
      message === "Usuário não autenticado."
        ? 401
        : 500;

    return jsonError(message, status);
  }
}