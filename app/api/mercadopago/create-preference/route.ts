export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "../../../../src/lib/firebaseAdmin";

type MemberInput = {
  userId?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
};

type NormalizedMember = {
  userId: string | null;
  name: string;
  email: string | null;
  phone: string | null;
};

type ParticipantRole = "captain" | "member";
type ParticipantStatus = "linked" | "pending";

type ParticipantDoc = {
  role: ParticipantRole;
  userId: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  status: ParticipantStatus;
};

type RequestBody = {
  tournamentId?: string;
  tournamentSlug?: string | null;
  teamName?: string;
  captainName?: string;
  captainEmail?: string;
  captainPhone?: string | null;
  captainUserId?: string | null;
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
  captainUserId?: string | null;
  captainStatus?: ParticipantStatus;
  members?: NormalizedMember[];
  participants?: ParticipantDoc[];
  registrationStatus?: string;
  paymentStatus?: string;
  paymentStatusDetail?: string | null;
  externalReference?: string | null;
  preferenceId?: string | null;
  checkoutUrl?: string | null;
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

function normalizeEmail(value: unknown) {
  const email = compactSpaces(value).toLowerCase();
  return email || null;
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
    const email = normalizeEmail(raw.email);
    const phone = normalizePhone(raw.phone);

    if (!name) continue;

    const dedupeKey = [name.toLocaleLowerCase("pt-BR"), email || "", userId || ""]
      .filter(Boolean)
      .join("::");

    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    result.push({
      userId,
      name,
      email,
      phone,
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
    status === "awaiting_payment" ||
    status === "checkout_created" ||
    status === "awaiting_checkout"
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
        email: item.email ?? null,
        phone: item.phone ?? null,
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

function buildBackUrls(params: {
  baseUrl: string;
  tournamentPublicPath: string;
  registrationId: string;
}) {
  const successUrl = `${params.baseUrl}/tournaments/${params.tournamentPublicPath}/payment/success?registrationId=${params.registrationId}`;
  const failureUrl = `${params.baseUrl}/tournaments/${params.tournamentPublicPath}/payment/failure?registrationId=${params.registrationId}`;
  const pendingUrl = `${params.baseUrl}/tournaments/${params.tournamentPublicPath}/payment/pending?registrationId=${params.registrationId}`;

  return {
    successUrl,
    failureUrl,
    pendingUrl,
  };
}

function splitCaptainName(fullName: string) {
  const parts = compactSpaces(fullName).split(" ").filter(Boolean);

  if (parts.length === 0) {
    return {
      firstName: "Participante",
      lastName: "ConnectFish",
    };
  }

  if (parts.length === 1) {
    return {
      firstName: parts[0],
      lastName: parts[0],
    };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

function buildCheckoutUrlFromPreference(
  mpData: MercadoPagoPreferenceResponse | null
) {
  return mpData?.init_point ?? mpData?.sandbox_init_point ?? null;
}

function buildParticipants(params: {
  captainName: string;
  captainEmail: string;
  captainPhone: string | null;
  captainUserId: string | null;
  members: NormalizedMember[];
}): ParticipantDoc[] {
  const captainStatus: ParticipantStatus = params.captainUserId
    ? "linked"
    : "pending";

  const participants: ParticipantDoc[] = [
    {
      role: "captain",
      userId: params.captainUserId,
      name: params.captainName,
      email: params.captainEmail,
      phone: params.captainPhone,
      status: captainStatus,
    },
  ];

  for (const member of params.members) {
    const memberStatus: ParticipantStatus = member.userId ? "linked" : "pending";

    participants.push({
      role: "member",
      userId: member.userId,
      name: member.name,
      email: member.email,
      phone: member.phone,
      status: memberStatus,
    });
  }

  return participants;
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

    const body = (await request.json().catch(() => ({}))) as RequestBody;

    const tournamentId = compactSpaces(body.tournamentId);
    const teamName = compactSpaces(body.teamName);
    const captainName = compactSpaces(body.captainName);
    const captainEmail = normalizeEmail(body.captainEmail) || "";
    const captainPhone = normalizePhone(body.captainPhone);
    const captainUserId = compactSpaces(body.captainUserId) || null;
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

    const duplicateMemberEmails = new Set<string>();
    for (const member of members) {
      if (!member.email) continue;
      if (member.email === captainEmail) {
        return NextResponse.json(
          {
            success: false,
            message: "O e-mail do capitão não pode ser reutilizado em um membro.",
          },
          { status: 400 }
        );
      }
      if (duplicateMemberEmails.has(member.email)) {
        return NextResponse.json(
          {
            success: false,
            message: "Existem membros com e-mail repetido na equipe.",
          },
          { status: 400 }
        );
      }
      duplicateMemberEmails.add(member.email);
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
      const existingCheckoutUrl = compactSpaces(existing.checkoutUrl);
      const existingPreferenceId = compactSpaces(existing.preferenceId);
      const existingExternalReference = compactSpaces(existing.externalReference);

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
        (isPendingLikeStatus(existingPaymentStatus) ||
          isPendingLikeStatus(existingRegistrationStatus)) &&
        existingCheckoutUrl &&
        existingPreferenceId
      ) {
        return NextResponse.json(
          {
            success: true,
            reusedExistingCheckout: true,
            registrationId: existingRegistrationDoc.id,
            preferenceId: existingPreferenceId,
            externalReference: existingExternalReference || null,
            checkoutUrl: existingCheckoutUrl,
          },
          { status: 200 }
        );
      }
    }

    const registrationRef = db.collection("tournamentRegistrations").doc();

    const externalReference = buildExternalReference({
      tournamentId,
      registrationId: registrationRef.id,
    });

    const captainStatus: ParticipantStatus = captainUserId ? "linked" : "pending";
    const participants = buildParticipants({
      captainName,
      captainEmail,
      captainPhone,
      captainUserId,
      members,
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
      captainUserId,
      captainStatus,
      members,
      participants,
      source,

      registrationStatus: "checkout_created",
      paymentProvider: "mercado_pago",
      paymentStatus: "awaiting_checkout",
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
      payerEmail: null,
      checkoutUrl: null,

      paymentStartedAt: FieldValue.serverTimestamp(),
      preferenceCreatedAt: null,
      paymentApprovedAt: null,
      paymentFailedAt: null,
      lastWebhookAt: null,

      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const tournamentPublicPath = tournamentSlug ?? tournamentId;

    const { successUrl, failureUrl, pendingUrl } = buildBackUrls({
      baseUrl,
      tournamentPublicPath,
      registrationId: registrationRef.id,
    });

    const { firstName, lastName } = splitCaptainName(captainName);

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
        first_name: firstName,
        last_name: lastName,
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
        captainUserId,
        source,
        flow: "team_registration_with_captain_binding",
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

    const checkoutUrl = buildCheckoutUrlFromPreference(mpData);

    await registrationRef.update({
      preferenceId: mpData.id,
      externalReference,
      checkoutUrl,
      registrationStatus: "awaiting_payment",
      paymentStatus: "pending",
      paymentStatusDetail: "checkout_created",
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
