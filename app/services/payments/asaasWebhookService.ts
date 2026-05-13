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

type ReservationPayment = {
  id: string;
  ownerId: string;
  pesqueiroId: string | null;
  providerPaymentId: string | null;
  externalReference: string | null;
  totalPrice: number;
  paymentStatus: string | null;
  sessionTitle: string | null;
  areaName: string | null;
  userName: string | null;
  userEmail: string | null;
  currency: "BRL";
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
  if (event === "PAYMENT_RECEIVED_IN_CASH_UNDONE") return "PAYMENT_RECEIVED_IN_CASH_UNDONE";
  if (event === "PAYMENT_CHARGEBACK_REQUESTED") return "PAYMENT_CHARGEBACK_REQUESTED";
  if (event === "PAYMENT_CHARGEBACK_DISPUTE") return "PAYMENT_CHARGEBACK_DISPUTE";
  if (event === "PAYMENT_AWAITING_CHARGEBACK_REVERSAL") return "PAYMENT_AWAITING_CHARGEBACK_REVERSAL";
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

function normalizeRegistrationStatus(value: unknown): TeamMemberRegistrationStatus {
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

function normalizeMemberPaymentStatus(value: unknown): TeamMemberPaymentStatus {
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
  if (status === "RECEIVED_IN_CASH" || status === "RECEIVED_IN_CASH_UNDONE") return "received";
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

async function resolveReservationPaymentFromWebhook(
  payload: AsaasWebhookPayload
): Promise<ReservationPayment | null> {
  const providerPaymentId = nullableString(payload.payment?.id);
  if (!providerPaymentId) return null;

  const db = adminDb();

  const snap = await db
    .collection("fishingReservations")
    .where("providerPaymentId", "==", providerPaymentId)
    .limit(1)
    .get();

  if (snap.empty) return null;

  const docSnap = snap.docs[0];
  const raw = docSnap.data() as Record<string, unknown>;

  const ownerId = safeTrim(raw.ownerId);

  if (!ownerId) return null;

  return {
    id: docSnap.id,
    ownerId,
    pesqueiroId: nullableString(raw.pesqueiroId),
    providerPaymentId,
    externalReference: nullableString(raw.externalReference),
    totalPrice: normalizeMoney(raw.totalPrice),
    paymentStatus: nullableString(raw.paymentStatus),
    sessionTitle: nullableString(raw.sessionTitle),
    areaName: nullableString(raw.areaName),
    userName: nullableString(raw.userName),
    userEmail: nullableString(raw.userEmail),
    currency: "BRL",
  };
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
        totalCollected: FieldValue.increment(normalizeMoney(params.collectedAmount)),
        totalPending: FieldValue.increment(normalizeMoney(params.pendingAmountDelta)),
        totalReleased: FieldValue.increment(normalizeMoney(params.releasedAmountDelta)),
      },
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

async function upsertReservationWalletTransaction(params: {
  transactionId: string;
  ownerId: string;
  reservationId: string;
  pesqueiroId: string | null;
  providerPaymentId: string | null;
  externalReference: string | null;
  type: "payment_received" | "release_to_available" | "refund" | "chargeback";
  status: "pending" | "available" | "reversed";
  grossAmount: number;
  feeAmount: number;
  netAmount: number;
  title: string;
  subtitle: string | null;
}) {
  const db = adminDb();
  const txRef = db.collection("organizerWalletTransactions").doc(params.transactionId);
  const summaryRef = db.collection("organizerWalletSummaries").doc(params.ownerId);

  await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(txRef);

    if (existing.exists) {
      return;
    }

    const now = Date.now();

    transaction.set(txRef, {
      organizerUserId: params.ownerId,
      ownerId: params.ownerId,

      sourceType: params.type === "refund" || params.type === "chargeback" ? "refund" : "reservation",
      sourceId: params.reservationId,

      tournamentId: null,
      reservationId: params.reservationId,
      pesqueiroId: params.pesqueiroId,
      paymentId: params.providerPaymentId,

      title: params.title,
      subtitle: params.subtitle,

      type: params.type,
      status: params.status,

      grossAmount: normalizeMoney(params.grossAmount),
      feeAmount: normalizeMoney(params.feeAmount),
      netAmount: normalizeMoney(params.netAmount),
      currency: "BRL",

      externalReference: params.externalReference,
      providerPaymentId: params.providerPaymentId,

      createdAt: now,
      releasedAt: params.type === "release_to_available" ? now : null,
      paidOutAt: null,
      reversedAt:
        params.type === "refund" || params.type === "chargeback" ? now : null,
      updatedAt: now,

      serverCreatedAt: FieldValue.serverTimestamp(),
      serverUpdatedAt: FieldValue.serverTimestamp(),
    });

    const baseSummaryPayload = {
      organizerUserId: params.ownerId,
      currency: "BRL",
      updatedAt: now,
      serverUpdatedAt: FieldValue.serverTimestamp(),
    };

    if (params.type === "payment_received") {
      transaction.set(
        summaryRef,
        {
          ...baseSummaryPayload,
          grossAmount: FieldValue.increment(normalizeMoney(params.grossAmount)),
          netAmount: FieldValue.increment(normalizeMoney(params.netAmount)),
          pendingAmount: FieldValue.increment(normalizeMoney(params.netAmount)),
          reservationsAmount: FieldValue.increment(normalizeMoney(params.netAmount)),
        },
        { merge: true }
      );
    }

    if (params.type === "release_to_available") {
      transaction.set(
        summaryRef,
        {
          ...baseSummaryPayload,
          pendingAmount: FieldValue.increment(-normalizeMoney(params.netAmount)),
          availableAmount: FieldValue.increment(normalizeMoney(params.netAmount)),
        },
        { merge: true }
      );
    }

    if (params.type === "refund") {
      transaction.set(
        summaryRef,
        {
          ...baseSummaryPayload,
          refundedAmount: FieldValue.increment(normalizeMoney(params.netAmount)),
          availableAmount: FieldValue.increment(-normalizeMoney(params.netAmount)),
        },
        { merge: true }
      );
    }

    if (params.type === "chargeback") {
      transaction.set(
        summaryRef,
        {
          ...baseSummaryPayload,
          chargebackAmount: FieldValue.increment(normalizeMoney(params.netAmount)),
          availableAmount: FieldValue.increment(-normalizeMoney(params.netAmount)),
        },
        { merge: true }
      );
    }
  });
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

async function processReservationReceivedOrConfirmedEvent(params: {
  reservation: ReservationPayment;
  payload: AsaasWebhookPayload;
  eventType: AsaasWebhookEventType;
}) {
  const { reservation, payload } = params;

  const db = adminDb();

  const providerPaymentId = nullableString(payload.payment?.id);
  const externalReference =
    nullableString(payload.payment?.externalReference) ||
    reservation.externalReference;

  const paidAt =
    toTimestampSafe(payload.payment?.paymentDate) ||
    toTimestampSafe(payload.payment?.clientPaymentDate) ||
    Date.now();

  const title = `Reserva · ${reservation.sessionTitle || "Sessão de pesca"}`;
  const subtitle =
    [
      reservation.areaName,
      reservation.userName,
      reservation.userEmail,
    ]
      .filter(Boolean)
      .join(" · ") || null;

  await db.collection("fishingReservations").doc(reservation.id).set(
    {
      paymentStatus: "paid",
      paymentStatusDetail: "payment_received",
      status: "confirmed",
      paidAt: new Date(paidAt),
      paidAtMs: paidAt,
      providerPaymentId,
      externalReference,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await upsertReservationWalletTransaction({
    transactionId: `reservation_payment_received_${reservation.id}`,
    ownerId: reservation.ownerId,
    reservationId: reservation.id,
    pesqueiroId: reservation.pesqueiroId,
    providerPaymentId,
    externalReference,
    type: "payment_received",
    status: "pending",
    grossAmount: reservation.totalPrice,
    feeAmount: 0,
    netAmount: reservation.totalPrice,
    title,
    subtitle,
  });

  await upsertReservationWalletTransaction({
    transactionId: `reservation_release_to_available_${reservation.id}`,
    ownerId: reservation.ownerId,
    reservationId: reservation.id,
    pesqueiroId: reservation.pesqueiroId,
    providerPaymentId,
    externalReference,
    type: "release_to_available",
    status: "available",
    grossAmount: reservation.totalPrice,
    feeAmount: 0,
    netAmount: reservation.totalPrice,
    title,
    subtitle,
  });
}

async function processReservationRefundEvent(params: {
  reservation: ReservationPayment;
  payload: AsaasWebhookPayload;
}) {
  const { reservation, payload } = params;

  const db = adminDb();

  const providerPaymentId = nullableString(payload.payment?.id);
  const externalReference =
    nullableString(payload.payment?.externalReference) ||
    reservation.externalReference;

  const title = `Reserva · ${reservation.sessionTitle || "Sessão de pesca"}`;
  const subtitle =
    [
      reservation.areaName,
      reservation.userName,
      reservation.userEmail,
    ]
      .filter(Boolean)
      .join(" · ") || null;

  await db.collection("fishingReservations").doc(reservation.id).set(
    {
      paymentStatus: "refunded",
      paymentStatusDetail: "payment_refunded",
      status: "cancelled",
      refundedAt: FieldValue.serverTimestamp(),
      providerPaymentId,
      externalReference,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await upsertReservationWalletTransaction({
    transactionId: `reservation_refund_${reservation.id}`,
    ownerId: reservation.ownerId,
    reservationId: reservation.id,
    pesqueiroId: reservation.pesqueiroId,
    providerPaymentId,
    externalReference,
    type: "refund",
    status: "reversed",
    grossAmount: reservation.totalPrice,
    feeAmount: 0,
    netAmount: reservation.totalPrice,
    title,
    subtitle,
  });
}

async function processReservationChargebackEvent(params: {
  reservation: ReservationPayment;
  payload: AsaasWebhookPayload;
}) {
  const { reservation, payload } = params;

  const db = adminDb();

  const providerPaymentId = nullableString(payload.payment?.id);
  const externalReference =
    nullableString(payload.payment?.externalReference) ||
    reservation.externalReference;

  const title = `Reserva · ${reservation.sessionTitle || "Sessão de pesca"}`;
  const subtitle =
    [
      reservation.areaName,
      reservation.userName,
      reservation.userEmail,
    ]
      .filter(Boolean)
      .join(" · ") || null;

  await db.collection("fishingReservations").doc(reservation.id).set(
    {
      paymentStatus: "chargeback",
      paymentStatusDetail: "payment_chargeback",
      status: "cancelled",
      chargebackAt: FieldValue.serverTimestamp(),
      providerPaymentId,
      externalReference,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await upsertReservationWalletTransaction({
    transactionId: `reservation_chargeback_${reservation.id}`,
    ownerId: reservation.ownerId,
    reservationId: reservation.id,
    pesqueiroId: reservation.pesqueiroId,
    providerPaymentId,
    externalReference,
    type: "chargeback",
    status: "reversed",
    grossAmount: reservation.totalPrice,
    feeAmount: 0,
    netAmount: reservation.totalPrice,
    title,
    subtitle,
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
  const mappedStatus = mapAsaasStatusToInternalPaymentStatus(payload.payment?.status);

  await updateTournamentPaymentStatus({
    paymentId: internalPayment.id,
    status: mappedStatus,
    providerPaymentId,
    billingType,
    externalReference,
  });

  const mappedMemberStatus = mapInternalPaymentToTeamMemberPaymentStatus(mappedStatus);

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

async function processReservationSimpleStatusUpdate(params: {
  reservation: ReservationPayment;
  payload: AsaasWebhookPayload;
}) {
  const { reservation, payload } = params;

  const db = adminDb();

  const providerPaymentId = nullableString(payload.payment?.id);
  const externalReference =
    nullableString(payload.payment?.externalReference) ||
    reservation.externalReference;

  const asaasStatus = normalizeAsaasStatus(payload.payment?.status);

  let paymentStatus = reservation.paymentStatus || "pending";
  let paymentStatusDetail = "payment_updated";
  let status: string | undefined;

  if (asaasStatus === "PENDING") {
    paymentStatus = "pending";
    paymentStatusDetail = "payment_pending";
  } else if (asaasStatus === "OVERDUE") {
    paymentStatus = "overdue";
    paymentStatusDetail = "payment_overdue";
  } else if (asaasStatus === "DELETED") {
    paymentStatus = "cancelled";
    paymentStatusDetail = "payment_deleted";
    status = "cancelled";
  } else if (asaasStatus === "RESTORED") {
    paymentStatus = "pending";
    paymentStatusDetail = "payment_restored";
  }

  await db.collection("fishingReservations").doc(reservation.id).set(
    {
      paymentStatus,
      paymentStatusDetail,
      ...(status ? { status } : {}),
      providerPaymentId,
      externalReference,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

export async function processAsaasWebhook(
  payload: AsaasWebhookPayload
): Promise<ParsedAsaasWebhookResult> {
  const eventType = normalizeEventType(payload.event);
  const providerPaymentId = nullableString(payload.payment?.id);
  const eventId =
    nullableString(payload.id) ||
    `${eventType}__${providerPaymentId || "no_payment"}__${
      safeTrim(payload.dateCreated) || Date.now()
    }`;

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

  const [internalPayment, reservationPayment] = await Promise.all([
    resolveInternalPaymentFromWebhook(payload),
    resolveReservationPaymentFromWebhook(payload),
  ]);

  if (!internalPayment && !reservationPayment) {
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
    organizerUserId:
      internalPayment?.organizerUserId || reservationPayment?.ownerId || null,
    tournamentId: internalPayment?.tournamentId || null,
    paymentId: internalPayment?.id || reservationPayment?.id || null,
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
      internalPaymentId: internalPayment?.id || reservationPayment?.id || null,
      organizerUserId:
        internalPayment?.organizerUserId || reservationPayment?.ownerId || null,
      tournamentId: internalPayment?.tournamentId || null,
      message: "Evento duplicado ignorado com segurança.",
    };
  }

  try {
    if (reservationPayment) {
      if (
        eventType === "PAYMENT_RECEIVED" ||
        eventType === "PAYMENT_CONFIRMED"
      ) {
        await processReservationReceivedOrConfirmedEvent({
          reservation: reservationPayment,
          payload,
          eventType,
        });
      } else if (eventType === "PAYMENT_REFUNDED") {
        await processReservationRefundEvent({
          reservation: reservationPayment,
          payload,
        });
      } else if (
        eventType === "PAYMENT_CHARGEBACK_REQUESTED" ||
        eventType === "PAYMENT_CHARGEBACK_DISPUTE" ||
        eventType === "PAYMENT_AWAITING_CHARGEBACK_REVERSAL"
      ) {
        await processReservationChargebackEvent({
          reservation: reservationPayment,
          payload,
        });
      } else {
        await processReservationSimpleStatusUpdate({
          reservation: reservationPayment,
          payload,
        });
      }

      await createFinancialAuditLog({
        source: "asaas_webhook",
        eventType: `${eventType}_reservation_processed`,
        level: "info",
        organizerUserId: reservationPayment.ownerId,
        tournamentId: null,
        paymentId: reservationPayment.id,
        providerPaymentId,
        externalReference: nullableString(payload.payment?.externalReference),
        message: `Webhook ${eventType} de reserva processado com sucesso.`,
        payload: {
          reservationId: reservationPayment.id,
          pesqueiroId: reservationPayment.pesqueiroId,
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
        internalPaymentId: reservationPayment.id,
        organizerUserId: reservationPayment.ownerId,
        tournamentId: null,
        message: "Webhook de reserva processado com sucesso.",
      };
    }

    if (!internalPayment) {
      throw new Error("Pagamento interno de torneio não encontrado.");
    }

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
      organizerUserId:
        internalPayment?.organizerUserId || reservationPayment?.ownerId || null,
      tournamentId: internalPayment?.tournamentId || null,
      paymentId: internalPayment?.id || reservationPayment?.id || null,
      providerPaymentId,
      externalReference: nullableString(payload.payment?.externalReference),
      message,
      payload: payload as unknown as Record<string, unknown>,
    });

    throw error;
  }
}