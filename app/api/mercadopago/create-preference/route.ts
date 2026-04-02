import { NextResponse, type NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "../../../../src/lib/firebaseAdmin";
import { adminAuth } from "../../../../src/lib/firebaseAdminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RequestBody = {
  tournamentId?: string;
  teamId?: string;
  source?: string | null;
};

type MercadoPagoPreferenceResponse = {
  id?: string;
  init_point?: string;
  sandbox_init_point?: string;
};

type TeamDoc = {
  tournamentId?: string;
  tournamentSlug?: string | null;
  tournamentTitle?: string;
  teamName?: string;
  captainUserId?: string;
  amountPerParticipant?: number;
  currency?: string;
  paymentMode?: string;
  teamStatus?: string;
};

type TeamMemberDoc = {
  teamId?: string;
  tournamentId?: string;
  userId?: string;
  username?: string;
  displayName?: string | null;
  email?: string | null;
  payerEmail?: string | null;
  role?: "captain" | "member" | string;
  inviteStatus?: string;
  registrationStatus?: string;
  paymentStatus?: string;
  paymentStatusDetail?: string | null;
  amount?: number;
  currency?: string;
  paymentProvider?: string | null;
  paymentId?: string | null;
  preferenceId?: string | null;
  externalReference?: string | null;
  checkoutUrl?: string | null;
};

type UserDoc = {
  email?: string | null;
  username?: string | null;
  displayName?: string | null;
  name?: string | null;
};

function compactSpaces(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeStatus(value: unknown) {
  return compactSpaces(value).toLowerCase();
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

function getMemberDocId(teamId: string, userId: string) {
  return `${teamId}_${userId}`;
}

function buildExternalReference(params: {
  tournamentId: string;
  teamId: string;
  userId: string;
}) {
  return `tournament:${params.tournamentId}:team:${params.teamId}:user:${params.userId}:role:captain`;
}

function isBlockedPaymentStatus(value: unknown) {
  return normalizeStatus(value) === "approved";
}

function isPendingLikePaymentStatus(value: unknown) {
  const status = normalizeStatus(value);
  return status === "pending" || status === "in_process";
}

function isAllowedInviteStatus(value: unknown) {
  return normalizeStatus(value) === "accepted";
}

function isAllowedRegistrationStatus(value: unknown) {
  const status = normalizeStatus(value);
  return (
    status === "awaiting_payment" ||
    status === "payment_failed" ||
    status === "checkout_created"
  );
}

async function getAuthenticatedUserId(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization") || "";

    if (authHeader.toLowerCase().startsWith("bearer ")) {
      const token = authHeader.slice(7).trim();

      if (token) {
        const decoded = await adminAuth().verifyIdToken(token, true);
        return decoded.uid || null;
      }
    }
  } catch (error) {
    console.error("Erro Bearer token:", error);
  }

  try {
    const raw = request.cookies.get("__session")?.value;
    if (!raw) return null;

    const sessionCookie = raw.includes("%") ? decodeURIComponent(raw) : raw;
    const decoded = await adminAuth().verifySessionCookie(sessionCookie, true);

    return decoded.uid || null;
  } catch (error) {
    console.error("Erro session cookie:", error);
    return null;
  }
}

export async function POST(request: NextRequest) {
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

    const authenticatedUserId = await getAuthenticatedUserId(request);

    if (!authenticatedUserId) {
      return NextResponse.json(
        {
          success: false,
          message: "Usuário não autenticado.",
        },
        { status: 401 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as RequestBody;

    const tournamentId = compactSpaces(body.tournamentId);
    const teamId = compactSpaces(body.teamId);
    const source = compactSpaces(body.source || "captain_individual_checkout");
    const userId = authenticatedUserId;

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

    const teamData = (teamSnap.data() || {}) as TeamDoc;
    const memberData = (memberSnap.data() || {}) as TeamMemberDoc;
    const userData = (userSnap.data() || {}) as UserDoc;
    const tournamentData = (tournamentSnap.data() || {}) as Record<string, unknown>;

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

    const role = normalizeStatus(memberData.role);
    if (role !== "captain") {
      return NextResponse.json(
        {
          success: false,
          message: "Apenas o capitão pode iniciar este pagamento.",
        },
        { status: 403 }
      );
    }

    const inviteStatus = normalizeStatus(memberData.inviteStatus);
    if (!isAllowedInviteStatus(inviteStatus)) {
      return NextResponse.json(
        {
          success: false,
          message: "O capitão da equipe não está em um estado válido.",
        },
        { status: 409 }
      );
    }

    const paymentStatus = normalizeStatus(memberData.paymentStatus);
    if (isBlockedPaymentStatus(paymentStatus)) {
      return NextResponse.json(
        {
          success: false,
          message: "O pagamento do capitão já foi aprovado.",
        },
        { status: 409 }
      );
    }

    const registrationStatus = normalizeStatus(memberData.registrationStatus);
    if (!isAllowedRegistrationStatus(registrationStatus)) {
      return NextResponse.json(
        {
          success: false,
          message: "Este capitão não está em um estado válido para iniciar pagamento.",
        },
        { status: 409 }
      );
    }

    const amount =
      normalizeMoney(memberData.amount, -1) >= 0
        ? normalizeMoney(memberData.amount, 0)
        : normalizeMoney(teamData.amountPerParticipant, 0);

    const currency = normalizeCurrency(memberData.currency || teamData.currency);
    const tournamentTitle =
      compactSpaces(teamData.tournamentTitle) ||
      compactSpaces(tournamentData.title) ||
      "Torneio";
    const tournamentSlug =
      compactSpaces(teamData.tournamentSlug) ||
      compactSpaces(tournamentData.slug) ||
      null;
    const teamName = compactSpaces(teamData.teamName || "Equipe");
    const username = compactSpaces(userData.username).toLowerCase();
    const email =
      compactSpaces(memberData.email).toLowerCase() ||
      compactSpaces(memberData.payerEmail).toLowerCase() ||
      compactSpaces(userData.email).toLowerCase() ||
      null;
    const displayName =
      compactSpaces(memberData.displayName) ||
      compactSpaces(userData.displayName) ||
      compactSpaces(userData.name) ||
      username ||
      "Capitão";

    if (amount <= 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Este torneio não possui um valor individual válido configurado para o capitão.",
        },
        { status: 400 }
      );
    }

    if (!email) {
      return NextResponse.json(
        {
          success: false,
          message:
            "O capitão não possui e-mail válido cadastrado para pagamento.",
        },
        { status: 400 }
      );
    }

    const existingPreferenceId = compactSpaces(memberData.preferenceId) || null;
    const existingCheckoutUrl = compactSpaces(memberData.checkoutUrl) || null;

    if (
      existingPreferenceId &&
      existingCheckoutUrl &&
      isPendingLikePaymentStatus(paymentStatus)
    ) {
      return NextResponse.json(
        {
          success: true,
          reused: true,
          teamId,
          userId,
          preferenceId: existingPreferenceId,
          checkoutUrl: existingCheckoutUrl,
          message: "Pagamento do capitão já iniciado anteriormente.",
        },
        { status: 200 }
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
          id: `tournament-${tournamentId}-team-${teamId}-captain-${userId}`,
          title: `Inscrição do capitão - ${tournamentTitle}`,
          description: `Equipe ${teamName}${username ? ` • @${username}` : ""}`,
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
      notification_url: `${baseUrl}/api/mercadopago/webhook`,
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
        role: "captain",
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
      console.error("Erro Mercado Pago create-preference:", {
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
          message: "Não foi possível criar o checkout do capitão.",
        },
        { status: 500 }
      );
    }

    const checkoutUrl = mpData.sandbox_init_point ?? mpData.init_point ?? null;

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
      message: "Checkout do capitão criado com sucesso.",
    });
  } catch (error) {
    console.error("Erro interno ao criar preferência do capitão:", error);

    const message =
      error instanceof Error &&
      /session cookie/i.test(error.message || "")
        ? "Usuário não autenticado."
        : "Erro interno ao iniciar pagamento do capitão.";

    const status =
      error instanceof Error &&
      /session cookie|cookie/i.test(error.message || "")
        ? 401
        : 500;

    return NextResponse.json(
      {
        success: false,
        message,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status }
    );
  }
}