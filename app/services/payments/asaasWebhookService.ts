import { FieldValue } from "firebase-admin/firestore";

import {
  createFinancialAuditLog,
  createWebhookAuditTrail,
} from "../../../app/services/financialAuditService";
import {
  getTournamentPaymentByProviderPaymentId,
  updateTournamentPaymentStatus,
  type TournamentPayment,
} from "../../../app/services/tournamentPaymentService";
import {
  applyWalletChargeback,
  applyWalletPaymentReceived,
  applyWalletRefund,
  applyWalletReleaseToAvailable,
} from "../../../app/services/server/organizerWalletSyncServerService";
import { adminDb } from "../../../src/lib/firebaseAdmin";

export type AsaasWebhookEventType =
  | "PAYMENT_CREATED"
  | "PAYMENT_UPDATED"
  | "PAYMENT_RECEIVED"
  | "PAYMENT_CONFIRMED"
  | "PAYMENT_OVERDUE"
  | "PAYMENT_DELETED"
  | "PAYMENT_RESTORED"
  | "PAYMENT_REFUNDED"
  | "PAYMENT_RECEIVED_IN_CASH_UNDONE"
  | "PAYMENT_CHARGEBACK_REQUESTED"
  | "PAYMENT_CHARGEBACK_DISPUTE"
  | "PAYMENT_AWAITING_CHARGEBACK_REVERSAL"
  | "PAYMENT_DUNNING_RECEIVED"
  | "PAYMENT_DUNNING_REQUESTED"
  | "PAYMENT_BANK_SLIP_VIEWED"
  | "PAYMENT_CHECKOUT_VIEWED"
  | "UNKNOWN";

export type AsaasWebhookPayment = {
  object?: string;
  id?: string;
  dateCreated?: string;
  customer?: string;
  paymentLink?: string | null;
  value?: number;
  netValue?: number;
  originalValue?: number | null;
  interestValue?: number | null;
  description?: string | null;
  billingType?: string | null;
  status?: string | null;
  dueDate?: string | null;
  originalDueDate?: string | null;
  paymentDate?: string | null;
  clientPaymentDate?: string | null;
  installmentNumber?: number | null;
  invoiceUrl?: string | null;
  invoiceNumber?: string | null;
  externalReference?: string | null;
  deleted?: boolean;
  anticipated?: boolean;
  anticipable?: boolean;
  creditDate?: string | null;
  estimatedCreditDate?: string | null;
  transactionReceiptUrl?: string | null;
  nossoNumero?: string | null;
  bankSlipUrl?: string | null;
  lastInvoiceViewedDate?: string | null;
  lastBankSlipViewedDate?: string | null;
  postalService?: boolean;
  custody?: unknown;
  escrow?: unknown;
};

export type AsaasWebhookPayload = {
  id?: string;
  event?: string;
  dateCreated?: string;
  payment?: AsaasWebhookPayment | null;
};

export type ParsedAsaasWebhookResult = {
  ok: boolean;
  ignored?: boolean;
  duplicate?: boolean;
  eventId: string;
  eventType: AsaasWebhookEventType;
  providerPaymentId: string | null;
  internalPaymentId: string | null;
  organizerUserId: string | null;
  tournamentId: string | null;
  message: string;
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

function safeTrim(value: unknown) {
  return String(value ?? "").trim();
}

function nullableString(value: unknown) {
  const text = safeTrim(value);
  return text || null;
}

function normalizeMoney(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Number(parsed.toFixed(2));
}

function normalizeEventType(value: unknown): AsaasWebhookEventType {
  const event = safeTrim(value).toUpperCase();

  if (event === "PAYMENT_CREATED") return "PAYMENT_CREATED";
  if (event === "PAYMENT_UPDATED") return "PAYMENT_UPDATED";
  if (event === "PAYMENT_RECEIVED") return "PAYMENT_RECEIVED";
  if (event === "PAYMENT_CONFIRMED") return "PAYMENT_CONFIRMED";
  if (event === "PAYMENT_OVERDUE") return "PAYMENT_OVERDUE";
  if (event === "PAYMENT_DELETED") return "PAYMENT_DELETED";
  if (event === "PAYMENT_RESTORED") return "PAYMENT_RESTORED";
  if (event === "PAYMENT_REFUNDED") return "PAYMENT_REFUNDED";
  if (event === "PAYMENT_RECEIVED_IN_CASH_UNDONE") {
    return "PAYMENT_RECEIVED_IN_CASH_UNDONE";
  }
  if (event === "PAYMENT_CHARGEBACK_REQUESTED") {
    return "PAYMENT_CHARGEBACK_REQUESTED";
  }
  if (event === "PAYMENT_CHARGEBACK_DISPUTE") {
    return "PAYMENT_CHARGEBACK_DISPUTE";
  }
  if (event === "PAYMENT_AWAITING_CHARGEBACK_REVERSAL") {
    return "PAYMENT_AWAITING_CHARGEBACK_REVERSAL";
  }
  if (event === "PAYMENT_DUNNING_RECEIVED") return "PAYMENT_DUNNING_RECEIVED";
  if (event === "PAYMENT_DUNNING_REQUESTED") return "PAYMENT_DUNNING_REQUESTED";
  if (event === "PAYMENT_BANK_SLIP_VIEWED") return "PAYMENT_BANK_SLIP_VIEWED";
  if (event === "PAYMENT_CHECKOUT_VIEWED") return "PAYMENT_CHECKOUT_VIEWED";

  return "UNKNOWN";
}

function normalizeAsaasStatus(value: unknown) {
  return safeTrim(value).toUpperCase();
}

function normalizeInviteStatus(value: unknown) {
  const raw = safeTrim(value).toLowerCase();

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
  const raw = safeTrim(value).toLowerCase();

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
  const raw = safeTrim(value).toLowerCase();

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

function toTimestampSafe(value: unknown): number | null {
  const raw = safeTrim(value);
  if (!raw) return null;

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;

  return date.getTime();
}

function mapAsaasStatusToInternalPaymentStatus(
  asaasStatus: unknown
): TournamentPayment["status"] {
  const status = normalizeAsaasStatus(asaasStatus);

  if (status === "RECEIVED") return "received";
  if (status === "CONFIRMED") return "confirmed";
  if (status === "OVERDUE") return "overdue";
  if (status === "REFUNDED") return "refunded";
  if (status === "RECEIVED_IN_CASH" || status === "RECEIVED_IN_CASH_UNDONE") {
    return "received";
  }
  if (status === "CHARGEBACK_REQUESTED") return "chargeback";
  if (status === "CHARGEBACK_DISPUTE") return "chargeback";
  if (status === "AWAITING_CHARGEBACK_REVERSAL") return "chargeback";
  if (status === "DELETED") return "cancelled";
  if (status === "RESTORED") return "pending";
  if (status === "PENDING") return "pending";

  return "pending";
}

function mapInternalPaymentToTeamMemberPaymentStatus(
  status: TournamentPayment["status"]
): TeamMemberPaymentStatus {
  if (status === "received" || status === "confirmed") return "approved";
  if (status === "refunded") return "refunded";
  if (status === "chargeback") return "charged_back";
  if (status === "cancelled") return "cancelled";
  if (status === "overdue") return "error";
  if (status === "failed") return "error";
  return "pending";
}

function shouldReleaseImmediately(_payment: TournamentPayment) {
  return true;
}

async function resolveInternalPaymentFromWebhook(
  payload: AsaasWebhookPayload
): Promise<TournamentPayment | null> {
  const providerPaymentId = nullableString(payload.payment?.id);
  if (!providerPaymentId) return null;

  return getTournamentPaymentByProviderPaymentId(providerPaymentId);
}

async function logIgnoredWebhook(params: {
  eventId: string;
  eventType: AsaasWebhookEventType;
  providerPaymentId?: string | null;
  message: string;
  payload: AsaasWebhookPayload;
}) {
  await createFinancialAuditLog({
    source: "asaas_webhook",
    eventType: params.eventType,
    level: "warning",
    providerPaymentId: params.providerPaymentId,
    message: params.message,
    payload: params.payload as unknown as Record<string, unknown>,
  });
}

async function updateTournamentFinancialSummary(params: {
  tournamentId?: string | null;
  collectedAmount?: number;
  pendingAmountDelta?: number;
  releasedAmountDelta?: number;
}) {
  const tournamentId = safeTrim(params.tournamentId);

  if (!tournamentId) return;

  const db = adminDb();
  const ref = db.collection("tournaments").doc(tournamentId);

  await ref.set(
    {
      financialSummary: {
        totalCollected: FieldValue.increment(
          normalizeMoney(params.collectedAmount)
        ),
        totalPending: FieldValue.increment(
          normalizeMoney(params.pendingAmountDelta)
        ),
        totalReleased: FieldValue.increment(
          normalizeMoney(params.releasedAmountDelta)
        ),
      },
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

async function syncTeamMemberPaymentStatus(params: {
  paymentId: string;
  providerPaymentId?: string | null;
  status: TeamMemberPaymentStatus;
  registrationStatus?: TeamMemberRegistrationStatus;
  paidAt?: number | null;
  externalReference?: string | null;
  billingType?: string | null;
}) {
  const db = adminDb();

  const snap = await db
    .collection("tournamentTeamMembers")
    .where("paymentId", "==", params.paymentId)
    .limit(1)
    .get();

  if (snap.empty) return null;

  const docSnap = snap.docs[0];

  const payload: Record<string, unknown> = {
    paymentStatus: params.status,
    providerPaymentId: params.providerPaymentId || null,
    externalReference: params.externalReference || null,
    billingType: params.billingType || null,
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (params.registrationStatus !== undefined) {
    payload.registrationStatus = params.registrationStatus;
  }

  if (params.status === "approved") {
    payload.paymentApprovedAt = params.paidAt
      ? new Date(params.paidAt)
      : FieldValue.serverTimestamp();
  }

  await docSnap.ref.update(payload);

  return docSnap.data() as Record<string, unknown>;
}

async function recalculateTeamStatusByPaymentId(paymentId: string) {
  const db = adminDb();

  const memberSnap = await db
    .collection("tournamentTeamMembers")
    .where("paymentId", "==", paymentId)
    .limit(1)
    .get();

  if (memberSnap.empty) return;

  const memberRaw = memberSnap.docs[0].data() as Record<string, unknown>;
  const teamId = safeTrim(memberRaw.teamId);
  if (!teamId) return;

  const teamRef = db.collection("tournamentTeams").doc(teamId);
  const teamDoc = await teamRef.get();
  if (!teamDoc.exists) return;

  const membersSnap = await db
    .collection("tournamentTeamMembers")
    .where("teamId", "==", teamId)
    .get();

  const members = membersSnap.docs.map(
    (item) => item.data() as Record<string, unknown>
  );

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

async function processReceivedOrConfirmedEvent(params: {
  internalPayment: TournamentPayment;
  payload: AsaasWebhookPayload;
  eventType: AsaasWebhookEventType;
}) {
  const { internalPayment, payload, eventType } = params;

  const providerPaymentId = nullableString(payload.payment?.id);
  const externalReference = nullableString(payload.payment?.externalReference);
  const billingType = nullableString(payload.payment?.billingType);
  const paidAt =
    toTimestampSafe(payload.payment?.paymentDate) ||
    toTimestampSafe(payload.payment?.clientPaymentDate) ||
    Date.now();

  await updateTournamentPaymentStatus({
    paymentId: internalPayment.id,
    status: eventType === "PAYMENT_CONFIRMED" ? "confirmed" : "received",
    paidAt,
    providerPaymentId,
    billingType,
    externalReference,
  });

  await applyWalletPaymentReceived({
    organizerUserId: internalPayment.organizerUserId,
    tournamentId: internalPayment.tournamentId,
    paymentId: internalPayment.id,
    providerPaymentId,
    externalReference,
    grossAmount: internalPayment.grossAmount,
    feeAmount: internalPayment.platformFeeAmount,
    netAmount: internalPayment.organizerNetAmount,
    currency: internalPayment.currency,
  });

  if (shouldReleaseImmediately(internalPayment)) {
    await applyWalletReleaseToAvailable({
      organizerUserId: internalPayment.organizerUserId,
      tournamentId: internalPayment.tournamentId,
      paymentId: internalPayment.id,
      providerPaymentId,
      externalReference,
      grossAmount: internalPayment.grossAmount,
      feeAmount: internalPayment.platformFeeAmount,
      netAmount: internalPayment.organizerNetAmount,
      currency: internalPayment.currency,
    });
  }

  await syncTeamMemberPaymentStatus({
    paymentId: internalPayment.id,
    providerPaymentId,
    status: "approved",
    registrationStatus: "confirmed",
    paidAt,
    externalReference,
    billingType,
  });

  await recalculateTeamStatusByPaymentId(internalPayment.id);

  await updateTournamentFinancialSummary({
    tournamentId: internalPayment.tournamentId,
    collectedAmount: internalPayment.organizerNetAmount,
    pendingAmountDelta: 0,
    releasedAmountDelta: shouldReleaseImmediately(internalPayment)
      ? internalPayment.organizerNetAmount
      : 0,
  });
}

async function processRefundEvent(params: {
  internalPayment: TournamentPayment;
  payload: AsaasWebhookPayload;
}) {
  const { internalPayment, payload } = params;

  const providerPaymentId = nullableString(payload.payment?.id);
  const externalReference = nullableString(payload.payment?.externalReference);

  await updateTournamentPaymentStatus({
    paymentId: internalPayment.id,
    status: "refunded",
    providerPaymentId,
    externalReference,
  });

  await applyWalletRefund({
    organizerUserId: internalPayment.organizerUserId,
    tournamentId: internalPayment.tournamentId,
    paymentId: internalPayment.id,
    providerPaymentId,
    externalReference,
    grossAmount: internalPayment.grossAmount,
    feeAmount: internalPayment.platformFeeAmount,
    netAmount: internalPayment.organizerNetAmount,
    currency: internalPayment.currency,
  });

  await syncTeamMemberPaymentStatus({
    paymentId: internalPayment.id,
    providerPaymentId,
    status: "refunded",
    registrationStatus: "refunded",
    externalReference,
  });

  await recalculateTeamStatusByPaymentId(internalPayment.id);
}

async function processChargebackEvent(params: {
  internalPayment: TournamentPayment;
  payload: AsaasWebhookPayload;
}) {
  const { internalPayment, payload } = params;

  const providerPaymentId = nullableString(payload.payment?.id);
  const externalReference = nullableString(payload.payment?.externalReference);

  await updateTournamentPaymentStatus({
    paymentId: internalPayment.id,
    status: "chargeback",
    providerPaymentId,
    externalReference,
  });

  await applyWalletChargeback({
    organizerUserId: internalPayment.organizerUserId,
    tournamentId: internalPayment.tournamentId,
    paymentId: internalPayment.id,
    providerPaymentId,
    externalReference,
    grossAmount: internalPayment.grossAmount,
    feeAmount: internalPayment.platformFeeAmount,
    netAmount: internalPayment.organizerNetAmount,
    currency: internalPayment.currency,
  });

  await syncTeamMemberPaymentStatus({
    paymentId: internalPayment.id,
    providerPaymentId,
    status: "charged_back",
    registrationStatus: "chargeback",
    externalReference,
  });

  await recalculateTeamStatusByPaymentId(internalPayment.id);
}

async function processSimpleStatusUpdate(params: {
  internalPayment: TournamentPayment;
  payload: AsaasWebhookPayload;
}) {
  const { internalPayment, payload } = params;

  const providerPaymentId = nullableString(payload.payment?.id);
  const externalReference = nullableString(payload.payment?.externalReference);
  const billingType = nullableString(payload.payment?.billingType);
  const mappedStatus = mapAsaasStatusToInternalPaymentStatus(
    payload.payment?.status
  );

  await updateTournamentPaymentStatus({
    paymentId: internalPayment.id,
    status: mappedStatus,
    providerPaymentId,
    billingType,
    externalReference,
  });

  const mappedMemberStatus =
    mapInternalPaymentToTeamMemberPaymentStatus(mappedStatus);

  let registrationStatus: TeamMemberRegistrationStatus | undefined;

  if (mappedMemberStatus === "approved") {
    registrationStatus = "confirmed";
  } else if (mappedMemberStatus === "refunded") {
    registrationStatus = "refunded";
  } else if (mappedMemberStatus === "charged_back") {
    registrationStatus = "chargeback";
  } else if (
    mappedMemberStatus === "error" ||
    mappedMemberStatus === "cancelled"
  ) {
    registrationStatus = "payment_failed";
  }

  await syncTeamMemberPaymentStatus({
    paymentId: internalPayment.id,
    providerPaymentId,
    status: mappedMemberStatus,
    registrationStatus,
    externalReference,
    billingType,
  });

  await recalculateTeamStatusByPaymentId(internalPayment.id);
}

export async function processAsaasWebhook(
  payload: AsaasWebhookPayload
): Promise<ParsedAsaasWebhookResult> {
  const eventType = normalizeEventType(payload.event);
  const providerPaymentId = nullableString(payload.payment?.id);
  const eventId =
    nullableString(payload.id) ||
    `${eventType}__${providerPaymentId || "no_payment"}__${safeTrim(
      payload.dateCreated
    ) || Date.now()}`;

  if (!providerPaymentId) {
    await logIgnoredWebhook({
      eventId,
      eventType,
      providerPaymentId: null,
      message: "Webhook ignorado: payment.id ausente.",
      payload,
    });

    return {
      ok: false,
      ignored: true,
      eventId,
      eventType,
      providerPaymentId: null,
      internalPaymentId: null,
      organizerUserId: null,
      tournamentId: null,
      message: "Webhook ignorado: payment.id ausente.",
    };
  }

  const internalPayment = await resolveInternalPaymentFromWebhook(payload);

  if (!internalPayment) {
    await logIgnoredWebhook({
      eventId,
      eventType,
      providerPaymentId,
      message: "Pagamento interno não encontrado para providerPaymentId.",
      payload,
    });

    return {
      ok: false,
      ignored: true,
      eventId,
      eventType,
      providerPaymentId,
      internalPaymentId: null,
      organizerUserId: null,
      tournamentId: null,
      message: "Pagamento interno não encontrado.",
    };
  }

  const auditTrail = await createWebhookAuditTrail({
    source: "asaas_webhook",
    eventId,
    eventType,
    level: "info",
    organizerUserId: internalPayment.organizerUserId,
    tournamentId: internalPayment.tournamentId,
    paymentId: internalPayment.id,
    providerPaymentId,
    externalReference: nullableString(payload.payment?.externalReference),
    message: `Webhook ${eventType} recebido para pagamento ${providerPaymentId}.`,
    payload: payload as unknown as Record<string, unknown>,
  });

  if (auditTrail.duplicate) {
    return {
      ok: true,
      duplicate: true,
      eventId,
      eventType,
      providerPaymentId,
      internalPaymentId: internalPayment.id,
      organizerUserId: internalPayment.organizerUserId,
      tournamentId: internalPayment.tournamentId,
      message: "Evento duplicado ignorado com segurança.",
    };
  }

  try {
    if (
      eventType === "PAYMENT_RECEIVED" ||
      eventType === "PAYMENT_CONFIRMED"
    ) {
      await processReceivedOrConfirmedEvent({
        internalPayment,
        payload,
        eventType,
      });
    } else if (eventType === "PAYMENT_REFUNDED") {
      await processRefundEvent({
        internalPayment,
        payload,
      });
    } else if (
      eventType === "PAYMENT_CHARGEBACK_REQUESTED" ||
      eventType === "PAYMENT_CHARGEBACK_DISPUTE" ||
      eventType === "PAYMENT_AWAITING_CHARGEBACK_REVERSAL"
    ) {
      await processChargebackEvent({
        internalPayment,
        payload,
      });
    } else {
      await processSimpleStatusUpdate({
        internalPayment,
        payload,
      });
    }

    await createFinancialAuditLog({
      source: "asaas_webhook",
      eventType: `${eventType}_processed`,
      level: "info",
      organizerUserId: internalPayment.organizerUserId,
      tournamentId: internalPayment.tournamentId,
      paymentId: internalPayment.id,
      providerPaymentId,
      externalReference: nullableString(payload.payment?.externalReference),
      message: `Webhook ${eventType} processado com sucesso.`,
      payload: {
        paymentStatus: nullableString(payload.payment?.status),
        billingType: nullableString(payload.payment?.billingType),
        value: normalizeMoney(payload.payment?.value),
        netValue: normalizeMoney(payload.payment?.netValue),
      },
    });

    return {
      ok: true,
      eventId,
      eventType,
      providerPaymentId,
      internalPaymentId: internalPayment.id,
      organizerUserId: internalPayment.organizerUserId,
      tournamentId: internalPayment.tournamentId,
      message: "Webhook processado com sucesso.",
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Erro desconhecido ao processar webhook do Asaas.";

    await createFinancialAuditLog({
      source: "asaas_webhook",
      eventType: `${eventType}_failed`,
      level: "error",
      organizerUserId: internalPayment.organizerUserId,
      tournamentId: internalPayment.tournamentId,
      paymentId: internalPayment.id,
      providerPaymentId,
      externalReference: nullableString(payload.payment?.externalReference),
      message,
      payload: payload as unknown as Record<string, unknown>,
    });

    throw error;
  }
}