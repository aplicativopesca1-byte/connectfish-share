// app/api/mercadopago/create-preference/route.ts

import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "../../../../src/lib/firebaseAdmin";

type MemberInput = {
  userId?: string | null;
  name?: string | null;
};

type NormalizedMember = {
  userId: string | null;
  name: string;
};

type RequestBody = {
  tournamentId?: string;
  tournamentSlug?: string | null;
  teamName?: string;
  captainName?: string;
  captainEmail?: string;
  captainPhone?: string | null;
  members?: MemberInput[];
  source?: string | null;
};

type MercadoPagoPreferenceResponse = {
  id?: string;
  init_point?: string;
  sandbox_init_point?: string;
};

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

function normalizeMembers(value: unknown): NormalizedMember[] {
  if (!Array.isArray(value)) return [];

  return value.reduce<NormalizedMember[]>((acc, item) => {
    const raw = (item ?? {}) as MemberInput;

    const userId =
      typeof raw.userId === "string" && raw.userId.trim()
        ? raw.userId.trim()
        : null;

    const name =
      typeof raw.name === "string" && raw.name.trim()
        ? raw.name.trim()
        : null;

    if (!name) return acc;

    acc.push({
      userId,
      name,
    });

    return acc;
  }, []);
}

function normalizeMoney(value: unknown, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Number(parsed.toFixed(2));
}

function getTournamentEntryFee(raw: Record<string, unknown>) {
  if (typeof raw.entryFee === "number") return normalizeMoney(raw.entryFee);
  if (typeof raw.entryFeeAmount === "number") {
    return normalizeMoney(raw.entryFeeAmount);
  }
  if (typeof raw.price === "number") return normalizeMoney(raw.price);
  return 0;
}

function getTournamentCurrency(raw: Record<string, unknown>) {
  if (typeof raw.currency === "string" && raw.currency.trim()) {
    return raw.currency.trim().toUpperCase();
  }

  return "BRL";
}

function getTournamentStatus(raw: Record<string, unknown>) {
  return String(raw.status ?? "scheduled").toLowerCase();
}

function isTournamentAcceptingRegistrations(status: string) {
  return status === "scheduled" || status === "live";
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

    const tournamentId = String(body.tournamentId ?? "").trim();
    const tournamentSlug = String(body.tournamentSlug ?? "").trim() || null;
    const teamName = String(body.teamName ?? "").trim();
    const captainName = String(body.captainName ?? "").trim();
    const captainEmail = String(body.captainEmail ?? "").trim().toLowerCase();
    const captainPhone = String(body.captainPhone ?? "").trim() || null;
    const source = String(body.source ?? "public_registration_web").trim();

    const members = normalizeMembers(body.members);

    if (!tournamentId) {
      return NextResponse.json(
        { success: false, message: "tournamentId é obrigatório." },
        { status: 400 }
      );
    }

    if (!teamName) {
      return NextResponse.json(
        { success: false, message: "Nome da equipe é obrigatório." },
        { status: 400 }
      );
    }

    if (!captainName) {
      return NextResponse.json(
        { success: false, message: "Nome do capitão é obrigatório." },
        { status: 400 }
      );
    }

    if (!captainEmail) {
      return NextResponse.json(
        { success: false, message: "E-mail do capitão é obrigatório." },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(captainEmail)) {
      return NextResponse.json(
        { success: false, message: "Informe um e-mail válido." },
        { status: 400 }
      );
    }

    const db = adminDb();

    const tournamentRef = db.collection("tournaments").doc(tournamentId);
    const tournamentSnap = await tournamentRef.get();

    if (!tournamentSnap.exists) {
      return NextResponse.json(
        { success: false, message: "Torneio não encontrado." },
        { status: 404 }
      );
    }

    const tournamentRaw = tournamentSnap.data() as Record<string, unknown>;
    const tournamentStatus = getTournamentStatus(tournamentRaw);

    if (!isTournamentAcceptingRegistrations(tournamentStatus)) {
      return NextResponse.json(
        {
          success: false,
          message: "Este torneio não está aceitando inscrições no momento.",
        },
        { status: 400 }
      );
    }

    const tournamentTitle = String(tournamentRaw.title ?? "Torneio");
    const entryFee = getTournamentEntryFee(tournamentRaw);
    const currency = getTournamentCurrency(tournamentRaw);

    if (entryFee <= 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "O torneio ainda não possui um valor de inscrição válido configurado.",
        },
        { status: 400 }
      );
    }

    const registrationRef = await db.collection("tournamentRegistrations").add({
      tournamentId,
      tournamentSlug,
      tournamentTitle,
      teamName,
      captainName,
      captainEmail,
      captainPhone,
      members,
      source,

      registrationStatus: "awaiting_payment",
      paymentProvider: "mercado_pago",
      paymentStatus: "pending",

      paymentId: null,
      merchantOrderId: null,
      preferenceId: null,
      externalReference: null,

      amount: entryFee,
      currency,

      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const externalReference = `tournament:${tournamentId}:registration:${registrationRef.id}`;
    const tournamentPublicPath = tournamentSlug ?? tournamentId;

    const successUrl = `${baseUrl}/tournaments/${tournamentPublicPath}/payment/success?registrationId=${registrationRef.id}`;
    const failureUrl = `${baseUrl}/tournaments/${tournamentPublicPath}/payment/failure?registrationId=${registrationRef.id}`;
    const pendingUrl = `${baseUrl}/tournaments/${tournamentPublicPath}/payment/pending?registrationId=${registrationRef.id}`;

    const preferencePayload = {
      items: [
        {
          id: `tournament-${tournamentId}`,
          title: `Inscrição - ${tournamentTitle}`,
          description: `Equipe ${teamName}`,
          quantity: 1,
          currency_id: currency,
          unit_price: entryFee,
        },
      ],
      payer: {
        name: captainName,
        email: captainEmail,
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
        registrationId: registrationRef.id,
        tournamentId,
        tournamentSlug,
        teamName,
        captainEmail,
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
      console.error("Erro Mercado Pago create preference:", {
        status: mpResponse.status,
        body: mpData,
      });

      await db.collection("tournamentRegistrations").doc(registrationRef.id).update({
        registrationStatus: "payment_error",
        paymentStatus: "error",
        updatedAt: FieldValue.serverTimestamp(),
      });

      return NextResponse.json(
        {
          success: false,
          message: "Não foi possível criar o checkout do pagamento.",
        },
        { status: 500 }
      );
    }

    await db.collection("tournamentRegistrations").doc(registrationRef.id).update({
      preferenceId: mpData.id,
      externalReference,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      registrationId: registrationRef.id,
      preferenceId: mpData.id,
      externalReference,
      checkoutUrl: mpData.init_point ?? mpData.sandbox_init_point ?? null,
    });
  } catch (error) {
    console.error("Erro interno ao criar preferência Mercado Pago:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Erro interno ao iniciar pagamento.",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 }
    );
  }
}