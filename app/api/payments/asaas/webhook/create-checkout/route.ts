import { NextResponse, type NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import { adminDb } from "../../../../../../src/lib/firebaseAdmin";
import { adminAuth } from "../../../../../../src/lib/firebaseAdminAuth";

import {
  createAsaasCustomer,
  createAsaasTournamentCharge,
} from "../../../../../../app/services/payments/asaasService";
import {
  calculateTournamentSplit,
  buildOrganizerSplitForAsaas,
  CONNECTFISH_DEFAULT_FEE_PERCENT,
} from "../../../../../../app/services/payments/splitRulesService";
import {
  createTournamentPayment,
  updateTournamentPaymentProviderData,
} from "../../../../../../app/services/tournamentPaymentService";
import { getOrganizerPaymentProfile } from "../../../../../../app/services/organizerPaymentProfileService";
import { isOrganizerFinanciallyReady } from "../../../../../../app/services/organizerPaymentProfile.shared";
import { createFinancialAuditLog } from "../../../../../../app/services/financialAuditService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RequestBody = {
  tournamentId?: string;
  teamId?: string;
  teamMemberId?: string;
  source?: string | null;

  amount?: number;
  description?: string | null;
  billingType?: "PIX" | "BOLETO" | "CREDIT_CARD" | string | null;
  dueDate?: string | null;

  participantName?: string | null;
  participantEmail?: string | null;
  participantCpfCnpj?: string | null;
  participantMobilePhone?: string | null;
  participantPhone?: string | null;

  externalReference?: string | null;
  platformFeePercent?: number | null;
};

type TeamMemberPaymentStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled"
  | "refunded"
  | "error"
  | "charged_back"
  | string;

type TeamMemberRegistrationStatus =
  | "invited"
  | "awaiting_payment"
  | "confirmed"
  | "payment_failed"
  | "cancelled"
  | "refunded"
  | "chargeback"
  | string;

type ReusablePendingPayment = {
  id: string;
  tournamentId?: string;
  participantUserId?: string;
  status?: string;
  providerPaymentId?: string | null;
  providerCustomerId?: string | null;
  billingType?: string | null;
  dueDate?: string | null;
  externalReference?: string | null;
};

function safeTrim(value: unknown) {
  return String(value ?? "").trim();
}

function compactSpaces(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function nullableString(value: unknown) {
  const text = safeTrim(value);
  return text || null;
}

function normalizeMoney(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Number(parsed.toFixed(2));
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeBillingType(value: unknown): "PIX" | "BOLETO" | "CREDIT_CARD" {
  const billingType = safeTrim(value).toUpperCase();

  if (billingType === "BOLETO") return "BOLETO";
  if (billingType === "CREDIT_CARD") return "CREDIT_CARD";
  return "PIX";
}

function normalizeDueDate(value: unknown) {
  const raw = safeTrim(value);

  if (!raw) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().slice(0, 10);
  }

  return raw;
}

function requireField(value: unknown, label: string) {
  const text = compactSpaces(value);
  if (!text) {
    throw new Error(`${label} é obrigatório.`);
  }
  return text;
}

function normalizeInviteStatus(value: unknown) {
  const raw = compactSpaces(value).toLowerCase();

  if (
    raw === "pending" ||
    raw === "accepted" ||
    raw === "declined" ||
    raw === "expired" ||
    raw === "cancelled"
  ) {
    return raw;
  }

  return "pending";
}

function normalizeRegistrationStatus(
  value: unknown
): TeamMemberRegistrationStatus {
  const raw = compactSpaces(value).toLowerCase();

  if (
    raw === "invited" ||
    raw === "awaiting_payment" ||
    raw === "confirmed" ||
    raw === "payment_failed" ||
    raw === "cancelled" ||
    raw === "refunded" ||
    raw === "chargeback"
  ) {
    return raw;
  }

  return "invited";
}

function normalizeMemberPaymentStatus(
  value: unknown
): TeamMemberPaymentStatus {
  const raw = compactSpaces(value).toLowerCase();

  if (
    raw === "pending" ||
    raw === "approved" ||
    raw === "rejected" ||
    raw === "cancelled" ||
    raw === "refunded" ||
    raw === "error" ||
    raw === "charged_back"
  ) {
    return raw;
  }

  return "pending";
}

function extractAsaasCustomerId(raw: Record<string, unknown>) {
  return safeTrim(raw.id);
}

function extractAsaasPaymentId(raw: Record<string, unknown>) {
  return safeTrim(raw.id);
}

function extractAsaasInvoiceUrl(raw: Record<string, unknown>) {
  return (
    safeTrim(raw.invoiceUrl) ||
    safeTrim(raw.bankSlipUrl) ||
    safeTrim(raw.transactionReceiptUrl) ||
    ""
  );
}

function extractAsaasPixQrCode(raw: Record<string, unknown>) {
  return safeTrim(raw.pixQrCode) || "";
}

function extractAsaasPixCopyPaste(raw: Record<string, unknown>) {
  return (
    safeTrim(raw.payload) ||
    safeTrim(raw.pixCopiaECola) ||
    safeTrim(raw.copyPasteKey) ||
    ""
  );
}

function getBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ||
    process.env.APP_URL?.replace(/\/+$/, "") ||
    "https://connectfish.app"
  );
}

function buildExternalReference(params: {
  tournamentId: string;
  teamId: string;
  teamMemberId: string;
  participantUserId: string;
}) {
  return [
    "cf",
    params.tournamentId.slice(0, 8),
    params.teamId.slice(0, 8),
    params.participantUserId.slice(0, 8),
    Date.now().toString(36),
  ].join("-");
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

async function getUserProfile(userId: string) {
  const db = adminDb();
  const snap = await db.collection("users").doc(userId).get();

  if (!snap.exists) return null;

  const data = snap.data() as Record<string, unknown>;
  const billing = isObject(data.billing) ? data.billing : {};

  return {
    userId: snap.id,
    displayName:
      compactSpaces(data.displayName) ||
      compactSpaces(data.name) ||
      compactSpaces(data.username) ||
      "Participante",
    email: nullableString(data.email),
    cpfCnpj:
      nullableString(billing.documentNumber) ||
      nullableString(data.documentNumber) ||
      nullableString(data.cpfCnpj) ||
      nullableString(data.cpf) ||
      nullableString(data.document),
    mobilePhone:
      nullableString(data.mobilePhone) ||
      nullableString(data.whatsapp) ||
      nullableString(data.phone),
    phone: nullableString(data.phone),
  };
}

async function recalculateTeamStatus(teamId: string) {
  const db = adminDb();

  const teamRef = db.collection("tournamentTeams").doc(teamId);
  const teamSnap = await teamRef.get();

  if (!teamSnap.exists) return;

  const membersSnap = await db
    .collection("tournamentTeamMembers")
    .where("teamId", "==", teamId)
    .get();

  const members = membersSnap.docs.map((docSnap) => docSnap.data());

  const totalSlots = members.length;

  const acceptedMembersCount = members.filter(
    (member) => normalizeInviteStatus(member.inviteStatus) === "accepted"
  ).length;

  const paidMembersCount = members.filter(
    (member) => normalizeMemberPaymentStatus(member.paymentStatus) === "approved"
  ).length;

  const hasPendingInvites = members.some(
    (member) => normalizeInviteStatus(member.inviteStatus) === "pending"
  );

  const hasDeclinedMembers = members.some(
    (member) => normalizeInviteStatus(member.inviteStatus) === "declined"
  );

  let teamStatus = "building";

  if (hasPendingInvites) {
    teamStatus = "pending_invites";
  } else if (
    acceptedMembersCount > 0 &&
    paidMembersCount < acceptedMembersCount
  ) {
    teamStatus = "pending_payments";
  }

  if (
    acceptedMembersCount > 0 &&
    acceptedMembersCount === totalSlots &&
    paidMembersCount === acceptedMembersCount
  ) {
    teamStatus = "confirmed";
  }

  if (hasDeclinedMembers && acceptedMembersCount === 0) {
    teamStatus = "building";
  }

  await teamRef.update({
    totalSlots,
    acceptedMembersCount,
    paidMembersCount,
    teamStatus,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

async function findReusablePendingPayment(params: {
  tournamentId: string;
  participantUserId: string;
  teamMemberPaymentId?: string | null;
}): Promise<ReusablePendingPayment | null> {
  const db = adminDb();

  const explicitId = compactSpaces(params.teamMemberPaymentId);
  if (explicitId) {
    const explicitSnap = await db.collection("tournamentPayments").doc(explicitId).get();

    if (explicitSnap.exists) {
      const raw = explicitSnap.data() as Record<string, unknown>;

      const candidate: ReusablePendingPayment = {
        id: explicitSnap.id,
        tournamentId: nullableString(raw.tournamentId) || undefined,
        participantUserId: nullableString(raw.participantUserId) || undefined,
        status: nullableString(raw.status) || undefined,
        providerPaymentId: nullableString(raw.providerPaymentId),
        providerCustomerId: nullableString(raw.providerCustomerId),
        billingType: nullableString(raw.billingType),
        dueDate: nullableString(raw.dueDate),
        externalReference: nullableString(raw.externalReference),
      };

      const status = compactSpaces(candidate.status).toLowerCase();

      if (
        candidate.tournamentId === params.tournamentId &&
        candidate.participantUserId === params.participantUserId &&
        candidate.providerPaymentId &&
        (status === "pending" || status === "received" || status === "confirmed")
      ) {
        return candidate;
      }
    }
  }

  const snap = await db
    .collection("tournamentPayments")
    .where("tournamentId", "==", params.tournamentId)
    .where("participantUserId", "==", params.participantUserId)
    .limit(10)
    .get();

  if (snap.empty) return null;

  for (const item of snap.docs) {
    const raw = item.data() as Record<string, unknown>;

    const candidate: ReusablePendingPayment = {
      id: item.id,
      tournamentId: nullableString(raw.tournamentId) || undefined,
      participantUserId: nullableString(raw.participantUserId) || undefined,
      status: nullableString(raw.status) || undefined,
      providerPaymentId: nullableString(raw.providerPaymentId),
      providerCustomerId: nullableString(raw.providerCustomerId),
      billingType: nullableString(raw.billingType),
      dueDate: nullableString(raw.dueDate),
      externalReference: nullableString(raw.externalReference),
    };

    const status = compactSpaces(candidate.status).toLowerCase();

    if (
      candidate.providerPaymentId &&
      (status === "pending" || status === "received" || status === "confirmed")
    ) {
      return candidate;
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  let organizerUserId: string | null = null;
  let tournamentId: string | null = null;
  let participantUserId: string | null = null;
  let teamId: string | null = null;
  let teamMemberId: string | null = null;
  let externalReference: string | null = null;

  try {
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

    const raw = await request.json().catch(() => null);

    if (!isObject(raw)) {
      return NextResponse.json(
        {
          success: false,
          message: "Payload inválido.",
        },
        { status: 400 }
      );
    }

    const body = raw as RequestBody;

    tournamentId = requireField(body.tournamentId, "tournamentId");
    teamId = requireField(body.teamId, "teamId");
    teamMemberId = requireField(body.teamMemberId, "teamMemberId");

    const source = nullableString(body.source) || "team_invite_checkout_page";
    const billingType = normalizeBillingType(body.billingType);
    const db = adminDb();

    const [tournamentSnap, teamSnap, memberSnap] = await Promise.all([
      db.collection("tournaments").doc(tournamentId).get(),
      db.collection("tournamentTeams").doc(teamId).get(),
      db.collection("tournamentTeamMembers").doc(teamMemberId).get(),
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

    const tournamentRaw = tournamentSnap.data() as Record<string, unknown>;
    const teamRaw = teamSnap.data() as Record<string, unknown>;
    const memberRaw = memberSnap.data() as Record<string, unknown>;

    const memberTournamentId = requireField(
      memberRaw.tournamentId,
      "member.tournamentId"
    );
    const memberTeamId = requireField(memberRaw.teamId, "member.teamId");
    participantUserId = requireField(memberRaw.userId, "member.userId");

    if (memberTournamentId !== tournamentId || memberTeamId !== teamId) {
      return NextResponse.json(
        {
          success: false,
          message: "Participante inconsistente com o torneio/equipe.",
        },
        { status: 409 }
      );
    }

    if (participantUserId !== authenticatedUserId) {
      return NextResponse.json(
        {
          success: false,
          message: "Este pagamento não pertence ao usuário autenticado.",
        },
        { status: 403 }
      );
    }

   organizerUserId = requireField(
  tournamentRaw.organizerUserId ||
    tournamentRaw.ownerId ||
    tournamentRaw.createdBy ||
    tournamentRaw.createdByUserId ||
    teamRaw.organizerUserId ||
    teamRaw.captainUserId, // fallback final (segurança)
  "organizerUserId"
);

    const inviteStatus = normalizeInviteStatus(memberRaw.inviteStatus);
    const registrationStatus = normalizeRegistrationStatus(
      memberRaw.registrationStatus
    );
    const paymentStatus = normalizeMemberPaymentStatus(memberRaw.paymentStatus);

    const memberRole = compactSpaces(memberRaw.role).toLowerCase();
const isCaptain = memberRole === "captain";

if (!isCaptain && inviteStatus !== "accepted") {
  return NextResponse.json(
    {
      success: false,
      message: "O convite precisa estar aceito antes do pagamento.",
    },
    { status: 400 }
  );
}

    if (
      registrationStatus !== "awaiting_payment" &&
      registrationStatus !== "payment_failed"
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Este participante não está apto para iniciar pagamento.",
        },
        { status: 400 }
      );
    }

    if (paymentStatus === "approved") {
      return NextResponse.json(
        {
          success: true,
          message: "Pagamento já aprovado.",
          alreadyApproved: true,
          paymentId: nullableString(memberRaw.paymentId),
          providerPaymentId: nullableString(memberRaw.providerPaymentId),
          checkoutUrl:
            nullableString(memberRaw.checkoutUrl) ||
            nullableString(memberRaw.asaasInvoiceUrl),
        },
        { status: 200 }
      );
    }

    const existingCheckoutUrl =
      nullableString(memberRaw.checkoutUrl) ||
      nullableString(memberRaw.asaasInvoiceUrl);

    const existingPaymentId = nullableString(memberRaw.paymentId);
    const existingProviderPaymentId = nullableString(memberRaw.providerPaymentId);

    if (
      paymentStatus === "pending" &&
      existingCheckoutUrl &&
      existingPaymentId &&
      existingProviderPaymentId
    ) {
      return NextResponse.json(
        {
          success: true,
          reused: true,
          message: "Checkout pendente reutilizado com sucesso.",
          paymentId: existingPaymentId,
          providerPaymentId: existingProviderPaymentId,
          providerCustomerId: nullableString(memberRaw.providerCustomerId),
          billingType: nullableString(memberRaw.billingType) || billingType,
          dueDate: nullableString(memberRaw.dueDate),
          externalReference: nullableString(memberRaw.externalReference),
          charge: {
            id: existingProviderPaymentId,
            invoiceUrl: existingCheckoutUrl,
            pixQrCode: nullableString(memberRaw.asaasPixQrCode),
            pixCopyPaste: nullableString(memberRaw.asaasPixCopyPaste),
            raw: null,
          },
        },
        { status: 200 }
      );
    }

    const reusablePayment = await findReusablePendingPayment({
      tournamentId,
      participantUserId,
      teamMemberPaymentId: existingPaymentId,
    });

    if (
      reusablePayment &&
      existingCheckoutUrl &&
      nullableString(reusablePayment.providerPaymentId)
    ) {
      await memberSnap.ref.update({
        paymentId: reusablePayment.id,
        paymentStatus: "pending",
        paymentProvider: "asaas",
        providerPaymentId: nullableString(reusablePayment.providerPaymentId),
        providerCustomerId: nullableString(reusablePayment.providerCustomerId),
        billingType: nullableString(reusablePayment.billingType) || billingType,
        dueDate: nullableString(reusablePayment.dueDate),
        externalReference: nullableString(reusablePayment.externalReference),
        checkoutUrl: existingCheckoutUrl,
        asaasInvoiceUrl: existingCheckoutUrl,
        updatedAt: FieldValue.serverTimestamp(),
        paymentSource: source,
      });

      await recalculateTeamStatus(teamId);

      return NextResponse.json(
        {
          success: true,
          reused: true,
          message: "Pagamento pendente já existente reutilizado.",
          paymentId: reusablePayment.id,
          providerPaymentId: nullableString(reusablePayment.providerPaymentId),
          providerCustomerId: nullableString(reusablePayment.providerCustomerId),
          billingType: nullableString(reusablePayment.billingType) || billingType,
          dueDate: nullableString(reusablePayment.dueDate),
          externalReference: nullableString(reusablePayment.externalReference),
          charge: {
            id: nullableString(reusablePayment.providerPaymentId),
            invoiceUrl: existingCheckoutUrl,
            pixQrCode: nullableString(memberRaw.asaasPixQrCode),
            pixCopyPaste: nullableString(memberRaw.asaasPixCopyPaste),
            raw: null,
          },
        },
        { status: 200 }
      );
    }

    const teamAmount = normalizeMoney(teamRaw.amountPerParticipant);
    const memberAmount = normalizeMoney(memberRaw.amount);
    const tournamentAmount =
      normalizeMoney(tournamentRaw.entryFee) ||
      normalizeMoney(tournamentRaw.entryFeeAmount) ||
      normalizeMoney(tournamentRaw.price);

    const amount =
      normalizeMoney(body.amount) || memberAmount || teamAmount || tournamentAmount;

    if (amount <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "amount deve ser maior que zero.",
        },
        { status: 400 }
      );
    }

    const participantProfile = await getUserProfile(participantUserId);
    console.log("🔥 PARTICIPANT PROFILE ASAAS:", {
  participantUserId,
  authenticatedUserId,
  participantProfile,
});

    const participantName = requireField(
      body.participantName ||
        memberRaw.displayName ||
        memberRaw.username ||
        participantProfile?.displayName,
      "participantName"
    );

    const participantEmail =
      nullableString(body.participantEmail) ||
      nullableString(memberRaw.payerEmail) ||
      participantProfile?.email ||
      null;

    const participantCpfCnpj =
      nullableString(body.participantCpfCnpj) ||
      participantProfile?.cpfCnpj ||
      null;
      if (!participantCpfCnpj) {
  return NextResponse.json(
    {
      success: false,
      message: "Você precisa completar seu CPF antes de pagar a inscrição.",
      code: "MISSING_CPF",
    },
    { status: 400 }
  );
}

    const participantMobilePhone =
      nullableString(body.participantMobilePhone) ||
      participantProfile?.mobilePhone ||
      null;

    const participantPhone =
      nullableString(body.participantPhone) ||
      participantProfile?.phone ||
      null;

    const financialProfile = await getOrganizerPaymentProfile(organizerUserId);

    if (!financialProfile) {
      return NextResponse.json(
        {
          success: false,
          message: "Perfil financeiro do organizador não encontrado.",
        },
        { status: 404 }
      );
    }

    if (!isOrganizerFinanciallyReady(financialProfile)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "O organizador ainda não está apto financeiramente para receber pagamentos.",
        },
        { status: 409 }
      );
    }

    if (!financialProfile.providerWalletId) {
      return NextResponse.json(
        {
          success: false,
          message: "providerWalletId do organizador não encontrado.",
        },
        { status: 409 }
      );
    }

    const platformFeePercent =
      typeof body.platformFeePercent === "number"
        ? body.platformFeePercent
        : CONNECTFISH_DEFAULT_FEE_PERCENT;

    const split = calculateTournamentSplit({
      grossAmount: amount,
      platformFeePercent,
      currency: "BRL",
    });

    const organizerSplit = buildOrganizerSplitForAsaas({
      grossAmount: amount,
      organizerWalletId: financialProfile.providerWalletId,
      platformFeePercent,
    });

    const customer = await createAsaasCustomer({
      name: participantName,
      email: participantEmail,
      cpfCnpj: participantCpfCnpj,
      mobilePhone: participantMobilePhone,
      phone: participantPhone,
    });

    const providerCustomerId = extractAsaasCustomerId(customer) || null;

    externalReference =
      nullableString(body.externalReference) ||
      buildExternalReference({
        tournamentId,
        teamId,
        teamMemberId,
        participantUserId,
      });

    const teamName = nullableString(teamRaw.teamName) || "Equipe sem nome";
    const tournamentTitle =
      nullableString(tournamentRaw.title) || "Torneio ConnectFish";

    const description =
      nullableString(body.description) ||
      `Inscrição individual • ${tournamentTitle} • ${teamName}`;

    const dueDate = normalizeDueDate(body.dueDate);

    const payment = await createTournamentPayment({
      tournamentId,
      organizerUserId,
      participantUserId,
      provider: "asaas",
      providerPaymentId: null,
      providerCheckoutId: null,
      providerCustomerId,
      billingType,
      currency: "BRL",
      grossAmount: split.grossAmount,
      platformFeePercent: split.platformFeePercent,
      platformFeeAmount: split.platformFeeAmount,
      organizerNetAmount: split.organizerNetAmount,
      status: "pending",
      escrowStatus: "none",
      externalReference,
      description,
      dueDate,
    });

    const asaasCharge = await createAsaasTournamentCharge({
      customer: providerCustomerId,
      billingType,
      value: split.grossAmount,
      dueDate,
      description,
      externalReference,
      name: participantName,
      email: participantEmail,
      cpfCnpj: participantCpfCnpj,
      mobilePhone: participantMobilePhone,
      phone: participantPhone,
      split: organizerSplit,
    });

    const providerPaymentId = extractAsaasPaymentId(asaasCharge);
    if (!providerPaymentId) {
      throw new Error("O Asaas não retornou um providerPaymentId válido.");
    }

    const invoiceUrl = extractAsaasInvoiceUrl(asaasCharge) || null;
    const pixQrCode = extractAsaasPixQrCode(asaasCharge) || null;
    const pixCopyPaste = extractAsaasPixCopyPaste(asaasCharge) || null;
    const checkoutUrl = invoiceUrl;

    await updateTournamentPaymentProviderData({
      paymentId: payment.id,
      providerPaymentId,
      providerCheckoutId: null,
      providerCustomerId,
      billingType,
      dueDate,
      externalReference,
    });

    await memberSnap.ref.update({
      paymentId: payment.id,
      paymentStatus: "pending",
      paymentStatusDetail: "checkout_created",
      registrationStatus: "awaiting_payment",
      paymentStartedAt: FieldValue.serverTimestamp(),

      paymentProvider: "asaas",
      providerPaymentId,
      providerCustomerId,
      billingType,
      dueDate,
      externalReference,

      checkoutUrl,
      asaasInvoiceUrl: invoiceUrl,
      asaasPixQrCode: pixQrCode,
      asaasPixCopyPaste: pixCopyPaste,

      payerEmail: participantEmail,
      amount: split.grossAmount,
      currency: "BRL",

      updatedAt: FieldValue.serverTimestamp(),
      paymentSource: source,
    });

    await recalculateTeamStatus(teamId);

    await createFinancialAuditLog({
      source: "asaas_checkout",
      eventType: "checkout_created",
      level: "info",
      organizerUserId,
      tournamentId,
      paymentId: payment.id,
      providerPaymentId,
      providerAccountId: financialProfile.providerAccountId,
      externalReference,
      message: "Checkout criado com sucesso no Asaas.",
      payload: {
        source,
        teamId,
        teamMemberId,
        participantUserId,
        participantName,
        participantEmail,
        billingType,
        dueDate,
        grossAmount: split.grossAmount,
        platformFeePercent: split.platformFeePercent,
        platformFeeAmount: split.platformFeeAmount,
        organizerNetAmount: split.organizerNetAmount,
        providerCustomerId,
        organizerWalletId: financialProfile.providerWalletId,
        inviteUrl: `${getBaseUrl()}/team-invite/${encodeURIComponent(teamMemberId)}`,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Checkout criado com sucesso.",
        paymentId: payment.id,
        providerPaymentId,
        providerCustomerId,
        billingType,
        dueDate,
        externalReference,
        amounts: {
          grossAmount: split.grossAmount,
          platformFeePercent: split.platformFeePercent,
          platformFeeAmount: split.platformFeeAmount,
          organizerNetAmount: split.organizerNetAmount,
        },
        charge: {
          id: providerPaymentId,
          invoiceUrl,
          pixQrCode,
          pixCopyPaste,
          raw: asaasCharge,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Erro desconhecido ao criar checkout no Asaas.";

    try {
      await createFinancialAuditLog({
        source: "asaas_checkout",
        eventType: "checkout_create_failed",
        level: "error",
        organizerUserId,
        tournamentId,
        paymentId: null,
        providerPaymentId: null,
        externalReference,
        message,
        payload: {
          organizerUserId,
          tournamentId,
          participantUserId,
          teamId,
          teamMemberId,
        },
      });
    } catch (auditError) {
      console.error("Erro ao salvar audit log do checkout:", auditError);
    }

    const status =
      /não autenticado/i.test(message)
        ? 401
        : /não encontrado/i.test(message)
          ? 404
          : /obrigatório|inválido|aceito|apto|maior que zero|inconsistente/i.test(
                message
              )
            ? 400
            : /não pertence|autenticado/i.test(message)
              ? 403
              : /ainda não está apto financeiramente|providerWalletId/i.test(
                    message
                  )
                ? 409
                : 500;

    return NextResponse.json(
      {
        success: false,
        message,
      },
      { status }
    );
  }
}