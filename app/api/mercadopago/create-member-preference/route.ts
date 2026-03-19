import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "../../../../src/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RequestBody = {
  tournamentId?: string;
  teamId?: string;
  userId?: string;
  source?: string | null;
};

type MercadoPagoPreferenceResponse = {
  id?: string;
  init_point?: string;
  sandbox_init_point?: string;
};

function compactSpaces(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeMoney(value: unknown, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Number(parsed.toFixed(2));
}

function normalizeCurrency(value: unknown) {
  return compactSpaces(value).toUpperCase() || "BRL";
}

function getBaseUrl() {
  const envBaseUrl =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.SITE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL;

  if (envBaseUrl && envBaseUrl.trim()) {
    return envBaseUrl.replace(/\/+$/, "");
  }

  return null;
}

function buildExternalReference(params: {
  tournamentId: string;
  teamId: string;
  userId: string;
}) {
  return `tournament:${params.tournamentId}:team:${params.teamId}:user:${params.userId}`;
}

function getMemberDocId(teamId: string, userId: string) {
  return `${teamId}_${userId}`;
}

function normalizeStatus(value: unknown) {
  return compactSpaces(value).toLowerCase();
}

function isBlockedPaymentStatus(value: unknown) {
  const status = normalizeStatus(value);
  return status === "approved";
}

function isAllowedInviteStatus(value: unknown) {
  return normalizeStatus(value) === "accepted";
}

function isAllowedRegistrationStatus(value: unknown) {
  const status = normalizeStatus(value);
  return (
    status === "awaiting_payment" ||
    status === "payment_failed" ||
    status === "invited"
  );
}

export async function POST(request: Request) {
  try {
    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;

    if (!accessToken) {
      return NextResponse.json(
        {
          success: false,
          message:
            "MERCADO_PAGO_ACCESS_TOKEN não configurado nas variáveis de ambiente.",
        },
        { status: 500 }
      );
    }

    const baseUrl = getBaseUrl();

    if (!baseUrl) {
      return NextResponse.json(
        {
          success: false,
          message:
            "APP_URL ou NEXT_PUBLIC_APP_URL não configurado nas variáveis de ambiente.",
        },
        { status: 500 }
      );
    }

    const body = (await request.json()) as RequestBody;

    const tournamentId = compactSpaces(body.tournamentId);
    const teamId = compactSpaces(body.teamId);
    const userId = compactSpaces(body.userId);
    const source = compactSpaces(body.source || "member_individual_checkout");

    if (!tournamentId) {
      return NextResponse.json(
        { success: false, message: "tournamentId é obrigatório." },
        { status: 400 }
      );
    }

    if (!teamId) {
      return NextResponse.json(
        { success: false, message: "teamId é obrigatório." },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, message: "userId é obrigatório." },
        { status: 400 }
      );
    }

    const db = adminDb();

    const tournamentRef = db.collection("tournaments").doc(tournamentId);
    const teamRef = db.collection("tournamentTeams").doc(teamId);
    const memberRef = db
      .collection("tournamentTeamMembers")
      .doc(getMemberDocId(teamId, userId));
    const userRef = db.collection("users").doc(userId);

    const [tournamentSnap, teamSnap, memberSnap, userSnap] = await Promise.all([
      tournamentRef.get(),
      teamRef.get(),
      memberRef.get(),
      userRef.get(),
    ]);

    if (!tournamentSnap.exists) {
      return NextResponse.json(
        { success: false, message: "Torneio não encontrado." },
        { status: 404 }
      );
    }

    if (!teamSnap.exists) {
      return NextResponse.json(
        { success: false, message: "Equipe não encontrada." },
        { status: 404 }
      );
    }

    if (!memberSnap.exists) {
      return NextResponse.json(
        { success: false, message: "Participante da equipe não encontrado." },
        { status: 404 }
      );
    }

    if (!userSnap.exists) {
      return NextResponse.json(
        { success: false, message: "Usuário não encontrado." },
        { status: 404 }
      );
    }

    const tournamentData = tournamentSnap.data() as Record<string, unknown>;
    const teamData = teamSnap.data() as Record<string, unknown>;
    const memberData = memberSnap.data() as Record<string, unknown>;
    const userData = userSnap.data() as Record<string, unknown>;

    const teamTournamentId = compactSpaces(teamData.tournamentId);
    if (teamTournamentId !== tournamentId) {
      return NextResponse.json(
        {
          success: false,
          message: "A equipe informada não pertence ao torneio informado.",
        },
        { status: 400 }
      );
    }

    const memberTournamentId = compactSpaces(memberData.tournamentId);
    const memberUserId = compactSpaces(memberData.userId);

    if (memberTournamentId !== tournamentId || memberUserId !== userId) {
      return NextResponse.json(
        {
          success: false,
          message: "O participante informado não pertence a esta equipe.",
        },
        { status: 400 }
      );
    }

    const inviteStatus = normalizeStatus(memberData.inviteStatus);
    if (!isAllowedInviteStatus(inviteStatus)) {
      return NextResponse.json(
        {
          success: false,
          message: "O convite deste participante ainda não foi aceito.",
        },
        { status: 409 }
      );
    }

    const paymentStatus = normalizeStatus(memberData.paymentStatus);
    if (isBlockedPaymentStatus(paymentStatus)) {
      return NextResponse.json(
        {
          success: false,
          message: "Este participante já possui pagamento aprovado.",
        },
        { status: 409 }
      );
    }

    const registrationStatus = normalizeStatus(memberData.registrationStatus);
    if (!isAllowedRegistrationStatus(registrationStatus)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Este participante não está em um estado válido para iniciar pagamento.",
        },
        { status: 409 }
      );
    }

    const amount = normalizeMoney(memberData.amount);
    const currency = normalizeCurrency(memberData.currency);
    const tournamentTitle = compactSpaces(tournamentData.title || "Torneio");
    const tournamentSlug = compactSpaces(tournamentData.slug) || null;
    const teamName = compactSpaces(teamData.teamName || "Equipe");
    const username = compactSpaces(userData.username).toLowerCase();
    const email = compactSpaces(userData.email).toLowerCase() || null;
    const displayName =
      compactSpaces(userData.displayName) ||
      compactSpaces(userData.name) ||
      username ||
      "Participante";

    if (amount <= 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Este torneio não possui um valor individual válido configurado.",
        },
        { status: 400 }
      );
    }

    if (!email) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Este usuário não possui e-mail válido cadastrado para pagamento.",
        },
        { status: 400 }
      );
    }

    const externalReference = buildExternalReference({
      tournamentId,
      teamId,
      userId,
    });

    const tournamentPublicPath = tournamentSlug || tournamentId;

    const successUrl = `${baseUrl}/tournaments/${tournamentPublicPath}/payment/success?teamId=${teamId}&userId=${userId}`;
    const failureUrl = `${baseUrl}/tournaments/${tournamentPublicPath}/payment/failure?teamId=${teamId}&userId=${userId}`;
    const pendingUrl = `${baseUrl}/tournaments/${tournamentPublicPath}/payment/pending?teamId=${teamId}&userId=${userId}`;

    const preferencePayload = {
      items: [
        {
          id: `tournament-${tournamentId}-team-${teamId}-user-${userId}`,
          title: `Inscrição individual - ${tournamentTitle}`,
          description: `Equipe ${teamName} • @${username}`,
          quantity: 1,
          currency_id: currency,
          unit_price: amount,
        },
      ],
      payer: {
        name: displayName,
        email,
      },
      external_reference: externalReference,
      notification_url: `${baseUrl}/api/mercadopago/member-webhook`,
      back_urls: {
        success: successUrl,
        failure: failureUrl,
        pending: pendingUrl,
      },
      auto_return: "approved",
      statement_descriptor: "CONNECTFISH",
      metadata: {
        tournamentId,
        tournamentSlug,
        teamId,
        userId,
        username,
        teamName,
        source,
      },
    };

    const mpResponse = await fetch(
      "https://api.mercadopago.com/checkout/preferences",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(preferencePayload),
        cache: "no-store",
      }
    );

    const mpData =
      (await mpResponse.json().catch(() => null)) as
        | MercadoPagoPreferenceResponse
        | null;

    if (
      !mpResponse.ok ||
      !mpData?.id ||
      (!mpData.init_point && !mpData.sandbox_init_point)
    ) {
      console.error("Erro Mercado Pago create-member-preference:", {
        status: mpResponse.status,
        body: mpData,
        tournamentId,
        teamId,
        userId,
      });

      await memberRef.update({
        registrationStatus: "payment_failed",
        paymentStatus: "error",
        paymentStatusDetail: "preference_creation_failed",
        paymentStartedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      return NextResponse.json(
        {
          success: false,
          message: "Não foi possível criar o checkout individual.",
        },
        { status: 500 }
      );
    }

    const checkoutUrl = mpData.init_point ?? mpData.sandbox_init_point ?? null;

    await memberRef.update({
      registrationStatus: "awaiting_payment",
      paymentStatus: "pending",
      paymentStatusDetail: null,
      paymentProvider: "mercado_pago",
      preferenceId: mpData.id,
      externalReference,
      payerEmail: email,
      paymentStartedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      checkoutUrl,
      source,
    });

    return NextResponse.json({
      success: true,
      teamId,
      userId,
      preferenceId: mpData.id,
      externalReference,
      checkoutUrl,
      message: "Checkout individual criado com sucesso.",
    });
  } catch (error) {
    console.error("Erro interno ao criar preferência individual:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Erro interno ao iniciar pagamento individual.",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 }
    );
  }
}