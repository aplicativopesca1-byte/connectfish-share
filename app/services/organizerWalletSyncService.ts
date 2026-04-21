import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  limit,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

export type OrganizerWalletTransactionType =
  | "payment_created"
  | "payment_received"
  | "release_to_available"
  | "refund"
  | "chargeback"
  | "payout_sent"
  | "manual_adjustment";

export type OrganizerWalletTransactionStatus =
  | "pending"
  | "available"
  | "paid_out"
  | "reversed";

export type OrganizerWalletTransaction = {
  id: string;
  organizerUserId: string;
  tournamentId: string | null;
  paymentId: string | null;

  type: OrganizerWalletTransactionType;
  status: OrganizerWalletTransactionStatus;

  grossAmount: number;
  feeAmount: number;
  netAmount: number;
  currency: "BRL";

  externalReference: string | null;
  providerPaymentId: string | null;

  createdAt: number | null;
  releasedAt: number | null;
  paidOutAt: number | null;
  reversedAt: number | null;
  updatedAt: number | null;
};

export type OrganizerWalletSummary = {
  organizerUserId: string;
  availableAmount: number;
  pendingAmount: number;
  paidOutAmount: number;
  grossAmount: number;
  feeAmount: number;
  netAmount: number;
  refundedAmount: number;
  chargebackAmount: number;
  updatedAt: number | null;
};

type BaseWalletEventInput = {
  organizerUserId: string;
  tournamentId?: string | null;
  paymentId?: string | null;
  providerPaymentId?: string | null;
  externalReference?: string | null;
  grossAmount?: number;
  feeAmount?: number;
  netAmount?: number;
  currency?: "BRL" | string | null;
};

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

function now() {
  return Date.now();
}

function normalizeCurrency(value: unknown): "BRL" {
  const currency = safeTrim(value).toUpperCase();
  return currency === "BRL" ? "BRL" : "BRL";
}

function transactionCollection() {
  return collection(db, "organizerWalletTransactions");
}

function summaryRef(organizerUserId: string) {
  return doc(db, "organizerWalletSummaries", safeTrim(organizerUserId));
}

function transactionRef(transactionId: string) {
  return doc(db, "organizerWalletTransactions", safeTrim(transactionId));
}

async function findWalletTransactionByPaymentAndType(params: {
  paymentId?: string | null;
  organizerUserId: string;
  type: OrganizerWalletTransactionType;
}) {
  const paymentId = safeTrim(params.paymentId);
  const organizerUserId = safeTrim(params.organizerUserId);

  if (!paymentId || !organizerUserId) return null;

  const q = query(
    transactionCollection(),
    where("paymentId", "==", paymentId),
    where("organizerUserId", "==", organizerUserId),
    where("type", "==", params.type),
    limit(1)
  );

  const snap = await getDocs(q);
  if (snap.empty) return null;

  const first = snap.docs[0];
  return {
    id: first.id,
    ...(first.data() as Record<string, unknown>),
  };
}

async function createWalletTransaction(params: {
  organizerUserId: string;
  tournamentId?: string | null;
  paymentId?: string | null;
  providerPaymentId?: string | null;
  type: OrganizerWalletTransactionType;
  status: OrganizerWalletTransactionStatus;
  grossAmount?: number;
  feeAmount?: number;
  netAmount?: number;
  currency?: "BRL" | string | null;
  externalReference?: string | null;
  releasedAt?: number | null;
  paidOutAt?: number | null;
  reversedAt?: number | null;
}) {
  const ref = doc(transactionCollection());
  const timestamp = now();

  const payload = {
    organizerUserId: safeTrim(params.organizerUserId),
    tournamentId: nullableString(params.tournamentId),
    paymentId: nullableString(params.paymentId),
    providerPaymentId: nullableString(params.providerPaymentId),

    type: params.type,
    status: params.status,

    grossAmount: normalizeMoney(params.grossAmount),
    feeAmount: normalizeMoney(params.feeAmount),
    netAmount: normalizeMoney(params.netAmount),
    currency: normalizeCurrency(params.currency),

    externalReference: nullableString(params.externalReference),

    createdAt: timestamp,
    releasedAt:
      typeof params.releasedAt === "number" ? params.releasedAt : null,
    paidOutAt: typeof params.paidOutAt === "number" ? params.paidOutAt : null,
    reversedAt:
      typeof params.reversedAt === "number" ? params.reversedAt : null,
    updatedAt: timestamp,
    serverCreatedAt: serverTimestamp(),
    serverUpdatedAt: serverTimestamp(),
  };

  await setDoc(transactionRef(ref.id), payload);

  return {
    id: ref.id,
    ...payload,
  };
}

async function listOrganizerWalletTransactions(
  organizerUserId: string
): Promise<OrganizerWalletTransaction[]> {
  const uid = safeTrim(organizerUserId);
  if (!uid) return [];

  const q = query(
    transactionCollection(),
    where("organizerUserId", "==", uid)
  );

  const snap = await getDocs(q);

  return snap.docs.map((docSnap) => {
    const raw = docSnap.data() as Record<string, unknown>;

    return {
      id: docSnap.id,
      organizerUserId: safeTrim(raw.organizerUserId),
      tournamentId: nullableString(raw.tournamentId),
      paymentId: nullableString(raw.paymentId),

      type: safeTrim(raw.type) as OrganizerWalletTransactionType,
      status: safeTrim(raw.status) as OrganizerWalletTransactionStatus,

      grossAmount: normalizeMoney(raw.grossAmount),
      feeAmount: normalizeMoney(raw.feeAmount),
      netAmount: normalizeMoney(raw.netAmount),
      currency: normalizeCurrency(raw.currency),

      externalReference: nullableString(raw.externalReference),
      providerPaymentId: nullableString(raw.providerPaymentId),

      createdAt: typeof raw.createdAt === "number" ? raw.createdAt : null,
      releasedAt: typeof raw.releasedAt === "number" ? raw.releasedAt : null,
      paidOutAt: typeof raw.paidOutAt === "number" ? raw.paidOutAt : null,
      reversedAt: typeof raw.reversedAt === "number" ? raw.reversedAt : null,
      updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : null,
    };
  });
}

async function recalculateOrganizerWalletSummary(
  organizerUserId: string
): Promise<OrganizerWalletSummary> {
  const uid = safeTrim(organizerUserId);
  if (!uid) {
    throw new Error("organizerUserId é obrigatório.");
  }

  const items = await listOrganizerWalletTransactions(uid);

  const summary: OrganizerWalletSummary = {
    organizerUserId: uid,
    availableAmount: 0,
    pendingAmount: 0,
    paidOutAmount: 0,
    grossAmount: 0,
    feeAmount: 0,
    netAmount: 0,
    refundedAmount: 0,
    chargebackAmount: 0,
    updatedAt: now(),
  };

  for (const item of items) {
    if (item.type === "payment_received") {
      summary.grossAmount += item.grossAmount;
      summary.feeAmount += item.feeAmount;
      summary.netAmount += item.netAmount;

      if (item.status === "pending") {
        summary.pendingAmount += item.netAmount;
      }
    }

    if (item.type === "release_to_available" && item.status === "available") {
      summary.availableAmount += item.netAmount;
    }

    if (item.type === "payout_sent" && item.status === "paid_out") {
      summary.paidOutAmount += item.netAmount;
    }

    if (item.type === "refund") {
      summary.refundedAmount += item.netAmount;
    }

    if (item.type === "chargeback") {
      summary.chargebackAmount += item.netAmount;
    }

    if (
      (item.type === "refund" || item.type === "chargeback") &&
      item.status === "reversed"
    ) {
      summary.availableAmount = Math.max(
        0,
        summary.availableAmount - item.netAmount
      );
    }

    if (item.type === "payout_sent" && item.status === "paid_out") {
      summary.availableAmount = Math.max(
        0,
        summary.availableAmount - item.netAmount
      );
    }
  }

  summary.availableAmount = normalizeMoney(summary.availableAmount);
  summary.pendingAmount = normalizeMoney(summary.pendingAmount);
  summary.paidOutAmount = normalizeMoney(summary.paidOutAmount);
  summary.grossAmount = normalizeMoney(summary.grossAmount);
  summary.feeAmount = normalizeMoney(summary.feeAmount);
  summary.netAmount = normalizeMoney(summary.netAmount);
  summary.refundedAmount = normalizeMoney(summary.refundedAmount);
  summary.chargebackAmount = normalizeMoney(summary.chargebackAmount);

  await setDoc(
    summaryRef(uid),
    {
      ...summary,
      serverUpdatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return summary;
}

export async function applyWalletPaymentReceived(
  input: BaseWalletEventInput
) {
  const organizerUserId = safeTrim(input.organizerUserId);
  if (!organizerUserId) {
    throw new Error("organizerUserId é obrigatório.");
  }

  const existing = await findWalletTransactionByPaymentAndType({
    paymentId: input.paymentId,
    organizerUserId,
    type: "payment_received",
  });

  if (!existing) {
    await createWalletTransaction({
      organizerUserId,
      tournamentId: input.tournamentId,
      paymentId: input.paymentId,
      providerPaymentId: input.providerPaymentId,
      type: "payment_received",
      status: "pending",
      grossAmount: input.grossAmount,
      feeAmount: input.feeAmount,
      netAmount: input.netAmount,
      currency: input.currency,
      externalReference: input.externalReference,
    });
  }

  return recalculateOrganizerWalletSummary(organizerUserId);
}

export async function applyWalletReleaseToAvailable(
  input: BaseWalletEventInput
) {
  const organizerUserId = safeTrim(input.organizerUserId);
  if (!organizerUserId) {
    throw new Error("organizerUserId é obrigatório.");
  }

  const existing = await findWalletTransactionByPaymentAndType({
    paymentId: input.paymentId,
    organizerUserId,
    type: "release_to_available",
  });

  if (!existing) {
    await createWalletTransaction({
      organizerUserId,
      tournamentId: input.tournamentId,
      paymentId: input.paymentId,
      providerPaymentId: input.providerPaymentId,
      type: "release_to_available",
      status: "available",
      grossAmount: input.grossAmount,
      feeAmount: input.feeAmount,
      netAmount: input.netAmount,
      currency: input.currency,
      externalReference: input.externalReference,
      releasedAt: now(),
    });
  }

  return recalculateOrganizerWalletSummary(organizerUserId);
}

export async function applyWalletRefund(
  input: BaseWalletEventInput
) {
  const organizerUserId = safeTrim(input.organizerUserId);
  if (!organizerUserId) {
    throw new Error("organizerUserId é obrigatório.");
  }

  const existing = await findWalletTransactionByPaymentAndType({
    paymentId: input.paymentId,
    organizerUserId,
    type: "refund",
  });

  if (!existing) {
    await createWalletTransaction({
      organizerUserId,
      tournamentId: input.tournamentId,
      paymentId: input.paymentId,
      providerPaymentId: input.providerPaymentId,
      type: "refund",
      status: "reversed",
      grossAmount: input.grossAmount,
      feeAmount: input.feeAmount,
      netAmount: input.netAmount,
      currency: input.currency,
      externalReference: input.externalReference,
      reversedAt: now(),
    });
  }

  return recalculateOrganizerWalletSummary(organizerUserId);
}

export async function applyWalletChargeback(
  input: BaseWalletEventInput
) {
  const organizerUserId = safeTrim(input.organizerUserId);
  if (!organizerUserId) {
    throw new Error("organizerUserId é obrigatório.");
  }

  const existing = await findWalletTransactionByPaymentAndType({
    paymentId: input.paymentId,
    organizerUserId,
    type: "chargeback",
  });

  if (!existing) {
    await createWalletTransaction({
      organizerUserId,
      tournamentId: input.tournamentId,
      paymentId: input.paymentId,
      providerPaymentId: input.providerPaymentId,
      type: "chargeback",
      status: "reversed",
      grossAmount: input.grossAmount,
      feeAmount: input.feeAmount,
      netAmount: input.netAmount,
      currency: input.currency,
      externalReference: input.externalReference,
      reversedAt: now(),
    });
  }

  return recalculateOrganizerWalletSummary(organizerUserId);
}

export async function applyWalletPayoutSent(
  input: BaseWalletEventInput
) {
  const organizerUserId = safeTrim(input.organizerUserId);
  if (!organizerUserId) {
    throw new Error("organizerUserId é obrigatório.");
  }

  const existing = await findWalletTransactionByPaymentAndType({
    paymentId: input.paymentId,
    organizerUserId,
    type: "payout_sent",
  });

  if (!existing) {
    await createWalletTransaction({
      organizerUserId,
      tournamentId: input.tournamentId,
      paymentId: input.paymentId,
      providerPaymentId: input.providerPaymentId,
      type: "payout_sent",
      status: "paid_out",
      grossAmount: input.grossAmount,
      feeAmount: input.feeAmount,
      netAmount: input.netAmount,
      currency: input.currency,
      externalReference: input.externalReference,
      paidOutAt: now(),
    });
  }

  return recalculateOrganizerWalletSummary(organizerUserId);
}

export async function markWalletTransactionAsPaidOut(params: {
  transactionId: string;
}) {
  const transactionId = safeTrim(params.transactionId);
  if (!transactionId) {
    throw new Error("transactionId é obrigatório.");
  }

  await updateDoc(transactionRef(transactionId), {
    status: "paid_out",
    paidOutAt: now(),
    updatedAt: now(),
    serverUpdatedAt: serverTimestamp(),
  });
}

export async function forceRecalculateOrganizerWalletSummary(
  organizerUserId: string
) {
  return recalculateOrganizerWalletSummary(organizerUserId);
}