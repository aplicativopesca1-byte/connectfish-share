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

function normalizeTournamentStatus(value: unknown) {
  const status = normalizeStatus(value);

  if (["live", "ativo", "active", "in_progress"].includes(status)) {
    return "live";
  }

  if (["finished", "encerrado", "ended", "closed"].includes(status)) {
    return "finished";
  }

  if (["draft", "rascunho"].includes(status)) {
    return "draft";
  }

  return "scheduled";
}

function canCreatePaymentForTournamentStatus(value: unknown) {
  const status = normalizeTournamentStatus(value);
  return status === "scheduled" || status === "live";
}

function normalizeTeamStatus(value: unknown) {
  const status = normalizeStatus(value);

  if (
    ["building", "pending_invites", "pending_payments", "confirmed", "cancelled"].includes(
      status
    )
  ) {
    return status;
  }

  return "building";
}

function isReusablePendingPaymentStatus(value: unknown) {
  const status = normalizeStatus(value);
  return status === "pending" || status === "in_process";
}

function isApprovedPaymentStatus(value: unknown) {
  return normalizeStatus(value) === "approved";
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
          message: "MERCADO_PAGO_ACCESS_TOKEN não configurado.",
        },
        { status: 500 }
      );
    }

    const baseUrl = getBaseUrl();
    if (!baseUrl) {
      return NextResponse.json(
        {
          success: false,
          message: "APP_URL não configurado.",
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
    const source = compactSpaces(body.source || "individual_checkout");
    const userId = authenticatedUserId;

    if (!tournamentId || !teamId) {
      return NextResponse.json(
        {
          success: false,
          message: "tournamentId e teamId são obrigatórios.",
        },
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
        {
          success: false,
          message: "Torneio não encontrado.",
        },
        { status: 404 }
      );
    }

    if (!teamSnap.exists) {
      return NextResponse.json(
        {
          success: false,
          message: "Equipe não encontrada.",
        },
        { status: 404 }
      );
    }

    if (!memberSnap.exists) {
      return NextResponse.json(
        {
          success: false,
          message: "Participante da equipe não encontrado.",
        },
        { status: 404 }
      );
    }

    if (!userSnap.exists) {
      return NextResponse.json(
        {
          success: false,
          message: "Usuário não encontrado.",
        },
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

    if (!canCreatePaymentForTournamentStatus(tournamentData.status)) {
      return NextResponse.json(
        {
          success: false,
          message: "Este torneio não está aceitando novos pagamentos.",
        },
        { status: 409 }
      );
    }

    const teamStatus = normalizeTeamStatus(teamData.teamStatus);
    if (teamStatus === "cancelled") {
      return NextResponse.json(
        {
          success: false,
          message: "Esta equipe foi cancelada e não pode gerar pagamento.",
        },
        { status: 409 }
      );
    }

    const role = normalizeStatus(memberData.role);
    if (role !== "captain" && role !== "member") {
      return NextResponse.json(
        {
          success: false,
          message: "Papel do participante inválido.",
        },
        { status: 409 }
      );
    }

    const inviteStatus = normalizeStatus(memberData.inviteStatus);
    if (inviteStatus !== "accepted") {
      return NextResponse.json(
        {
          success: false,
          message: "Este participante ainda não está apto para pagar.",
        },
        { status: 409 }
      );
    }

    const paymentStatus = normalizeStatus(memberData.paymentStatus);
    const registrationStatus = normalizeStatus(memberData.registrationStatus);
    const existingCheckoutUrl = compactSpaces(memberData.checkoutUrl);
    const existingPreferenceId = compactSpaces(memberData.preferenceId);
    const existingExternalReference = compactSpaces(memberData.externalReference);

    if (isApprovedPaymentStatus(paymentStatus)) {
      return NextResponse.json(
        {
          success: false,
          message: "Este participante já possui pagamento aprovado.",
        },
        { status: 409 }
      );
    }

    if (
      isReusablePendingPaymentStatus(paymentStatus) &&
      existingCheckoutUrl &&
      existingPreferenceId
    ) {
      return NextResponse.json(
        {
          success: true,
          reused: true,
          teamId,
          userId,
          preferenceId: existingPreferenceId,
          externalReference: existingExternalReference || null,
          checkoutUrl: existingCheckoutUrl,
          role,
          message: "Checkout existente reutilizado com sucesso.",
        },
        { status: 200 }
      );
    }

    if (
      registrationStatus !== "awaiting_payment" &&
      registrationStatus !== "payment_failed" &&
      registrationStatus !== "checkout_created"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Este participante não está em um estado válido para pagamento.",
        },
        { status: 409 }
      );
    }

    const amount = normalizeMoney(memberData.amount);
    const currency = normalizeCurrency(memberData.currency);
    const tournamentTitle = compactSpaces(tournamentData.title || "Torneio");
    const tournamentSlug = compactSpaces(tournamentData.slug) || null;
    const teamName = compactSpaces(teamData.teamName || "Equipe");

    const username = userData.username
      ? compactSpaces(userData.username).toLowerCase()
      : "";

    const email = userData.email
      ? compactSpaces(userData.email).toLowerCase()
      : null;

    const displayName =
      compactSpaces(userData.displayName) ||
      compactSpaces(userData.name) ||
      username ||
      "Participante";

    if (amount <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Valor individual inválido.",
        },
        { status: 400 }
      );
    }

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        {
          success: false,
          message: "Usuário sem e-mail válido para pagamento.",
        },
        { status: 400 }
      );
    }

    const isCaptain = role === "captain";

    const externalReference = `tournament:${tournamentId}:team:${teamId}:user:${userId}:role:${role}`;

    const tournamentPublicPath = tournamentSlug || tournamentId;

    const successUrl = `${baseUrl}/tournaments/${tournamentPublicPath}/payment/success?teamId=${encodeURIComponent(
      teamId
    )}&userId=${encodeURIComponent(userId)}`;

    const failureUrl = `${baseUrl}/tournaments/${tournamentPublicPath}/payment/failure?teamId=${encodeURIComponent(
      teamId
    )}&userId=${encodeURIComponent(userId)}`;

    const pendingUrl = `${baseUrl}/tournaments/${tournamentPublicPath}/payment/pending?teamId=${encodeURIComponent(
      teamId
    )}&userId=${encodeURIComponent(userId)}`;

    const preferencePayload = {
      items: [
        {
          id: `tournament-${tournamentId}-team-${teamId}-user-${userId}`,
          title: isCaptain
            ? `Inscricao do capitao - ${tournamentTitle}`
            : `Inscricao individual - ${tournamentTitle}`,
          description: username
            ? `Equipe ${teamName} - @${username}`
            : `Equipe ${teamName}`,
          quantity: 1,
          currency_id: currency,
          unit_price: amount,
        },
      ],
      payer: {
        name: displayName || "Participante",
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
        role,
      },
    };

    console.log(
      "MP PAYLOAD DEBUG",
      JSON.stringify(preferencePayload, null, 2)
    );

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
      (await mpResponse.json().catch(() => null)) as MercadoPagoPreferenceResponse | null;

    console.log("MP RESPONSE DEBUG", {
      status: mpResponse.status,
      body: mpData,
    });

    if (!mpResponse.ok || !mpData?.id || !mpData.init_point) {
      await memberRef.update({
        registrationStatus: "payment_failed",
        paymentStatus: "error",
        paymentStatusDetail: "preference_creation_failed",
        paymentStartedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        preferenceId: null,
        externalReference: null,
        checkoutUrl: null,
      });

      return NextResponse.json(
        {
          success: false,
          message: "Não foi possível criar o checkout.",
        },
        { status: 500 }
      );
    }

    const checkoutUrl = mpData.init_point;

    await memberRef.update({
      registrationStatus: "checkout_created",
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
      reused: false,
      teamId,
      userId,
      preferenceId: mpData.id,
      externalReference,
      checkoutUrl,
      role,
      message: isCaptain
        ? "Checkout do capitão criado com sucesso."
        : "Checkout individual criado com sucesso.",
    });
  } catch (error) {
    console.error("Erro interno ao criar checkout individual:", error);

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