import { NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
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

type RegistrationDoc = {
  tournamentId?: string;
  tournamentSlug?: string | null;
  teamName?: string;
  captainName?: string;
  captainEmail?: string;
  captainPhone?: string | null;
  members?: NormalizedMember[];
  registrationStatus?: string;
  paymentStatus?: string;
  externalReference?: string | null;
  preferenceId?: string | null;
  amount?: number;
  currency?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
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

function compactSpaces(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizePhone(value: unknown) {
  const digits = String(value ?? "").replace(/\D+/g, "");
  return digits || null;
}

function normalizeMembers(value: unknown): NormalizedMember[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const result: NormalizedMember[] = [];

  for (const item of value) {
    const raw = (item ?? {}) as MemberInput;

    const userId =
      typeof raw.userId === "string" && raw.userId.trim()
        ? raw.userId.trim()
        : null;

    const name = compactSpaces(raw.name);
    if (!name) continue;

    const dedupeKey = name.toLocaleLowerCase("pt-BR");
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    result.push({
      userId,
      name,
    });
  }

  return result;
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

function buildExternalReference(params: {
  tournamentId: string;
  registrationId: string;
}) {
  return `tournament:${params.tournamentId}:registration:${params.registrationId}`;
}

function isPendingLikeStatus(value: unknown) {
  const status = String(value ?? "").trim().toLowerCase();
  return (
    status === "pending" ||
    status === "in_process" ||
    status === "awaiting_payment"
  );
}

function isConfirmedStatus(value: unknown) {
  const status = String(value ?? "").trim().toLowerCase();
  return status === "approved" || status === "confirmed";
}

function areMembersEquivalent(
  a: NormalizedMember[] | undefined,
  b: NormalizedMember[]
) {
  const left = Array.isArray(a) ? a : [];
  if (left.length !== b.length) return false;

  const normalize = (items: NormalizedMember[]) =>
    items
      .map((item) => ({
        userId: item.userId ?? null,
        name: compactSpaces(item.name).toLocaleLowerCase("pt-BR"),
      }))
      .sort((x, y) => x.name.localeCompare(y.name, "pt-BR"));

  const leftNorm = normalize(left);
  const rightNorm = normalize(b);

  return JSON.stringify(leftNorm) === JSON.stringify(rightNorm);
}

async function findExistingRegistration(params: {
  tournamentId: string;
  captainEmail: string;
  teamName: string;
  members: NormalizedMember[];
}) {
  const db = adminDb();

  const snapshot = await db
    .collection("tournamentRegistrations")
    .where("tournamentId", "==", params.tournamentId)
    .where("captainEmail", "==", params.captainEmail)
    .where("teamName", "==", params.teamName)
    .orderBy("createdAt", "desc")
    .limit(10)
    .get();

  if (snapshot.empty) return null;

  for (const doc of snapshot.docs) {
    const data = doc.data() as RegistrationDoc;

    const sameMembers = areMembersEquivalent(data.members, params.members);
    if (!sameMembers) continue;

    return doc;
  }

  return null;
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
    const teamName = compactSpaces(body.teamName);
    const captainName = compactSpaces(body.captainName);
    const captainEmail = compactSpaces(body.captainEmail).toLowerCase();
    const captainPhone = normalizePhone(body.captainPhone);
    const source = compactSpaces(body.source || "public_registration_web");

    const members = normalizeMembers(body.members);

    if (!tournamentId) {
      return NextResponse.json(
        { success: false, message: "tournamentId é obrigatório." },
        { status: 400 }
      );
    }

    if (!teamName || teamName.length < 3) {
      return NextResponse.json(
        {
          success: false,
          message: "Informe um nome de equipe válido com pelo menos 3 caracteres.",
        },
        { status: 400 }
      );
    }

    if (!captainName || captainName.length < 3) {
      return NextResponse.json(
        {
          success: false,
          message: "Informe o nome do capitão com pelo menos 3 caracteres.",
        },
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

    const captainNameKey = captainName.toLocaleLowerCase("pt-BR");
    const duplicateCaptainMember = members.some(
      (member) => member.name.toLocaleLowerCase("pt-BR") === captainNameKey
    );

    if (duplicateCaptainMember) {
      return NextResponse.json(
        {
          success: false,
          message: "O capitão não pode estar repetido na lista de membros.",
        },
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

    const tournamentTitle = compactSpaces(tournamentRaw.title || "Torneio");
    const tournamentSlug = compactSpaces(tournamentRaw.slug) || null;
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

    const existingRegistrationDoc = await findExistingRegistration({
      tournamentId,
      captainEmail,
      teamName,
      members,
    });

    if (existingRegistrationDoc) {
      const existing = existingRegistrationDoc.data() as RegistrationDoc;
      const existingPaymentStatus = String(existing.paymentStatus ?? "")
        .trim()
        .toLowerCase();
      const existingRegistrationStatus = String(existing.registrationStatus ?? "")
        .trim()
        .toLowerCase();

      if (
        isConfirmedStatus(existingPaymentStatus) ||
        isConfirmedStatus(existingRegistrationStatus)
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Já existe uma inscrição confirmada para esta equipe neste torneio.",
          },
          { status: 409 }
        );
      }

      if (
        isPendingLikeStatus(existingPaymentStatus) ||
        isPendingLikeStatus(existingRegistrationStatus)
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Já existe uma inscrição pendente para esta equipe. Finalize o pagamento existente ou aguarde a atualização do sistema.",
            registrationId: existingRegistrationDoc.id,
            externalReference: existing.externalReference ?? null,
          },
          { status: 409 }
        );
      }
    }

    const registrationRef = db.collection("tournamentRegistrations").doc();

    const externalReference = buildExternalReference({
      tournamentId,
      registrationId: registrationRef.id,
    });

    await registrationRef.set({
      tournamentId,
      tournamentSlug,
      tournamentTitle,
      tournamentStatusSnapshot: tournamentStatus,

      teamName,
      captainName,
      captainEmail,
      captainPhone,
      members,
      source,

      registrationStatus: "awaiting_payment",
      paymentProvider: "mercado_pago",
      paymentStatus: "pending",
      paymentStatusDetail: null,

      paymentId: null,
      merchantOrderId: null,
      preferenceId: null,
      externalReference,

      amount: entryFee,
      currency,
      tournamentEntryFeeSnapshot: entryFee,
      tournamentCurrencySnapshot: currency,

      amountPaid: null,
      paymentCurrency: null,
      payerEmail: captainEmail,

      paymentStartedAt: FieldValue.serverTimestamp(),
      preferenceCreatedAt: null,
      paymentApprovedAt: null,
      paymentFailedAt: null,
      lastWebhookAt: null,

      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

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

      await registrationRef.update({
        registrationStatus: "payment_failed",
        paymentStatus: "error",
        paymentStatusDetail: "preference_creation_failed",
        paymentFailedAt: FieldValue.serverTimestamp(),
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

    const checkoutUrl = mpData.init_point ?? mpData.sandbox_init_point ?? null;

    await registrationRef.update({
      preferenceId: mpData.id,
      externalReference,
      checkoutUrl,
      preferenceCreatedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      registrationId: registrationRef.id,
      preferenceId: mpData.id,
      externalReference,
      checkoutUrl,
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