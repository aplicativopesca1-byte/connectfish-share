import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";

import { adminDb } from "../../..//src/lib/firebaseAdmin";

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

export type WalletTournamentRow = {
  tournamentId: string;
  title: string;
  subtitle: string | null;
  location: string | null;
  status: string | null;
  currency: "BRL";
  grossAmount: number;
  feeAmount: number;
  netAmount: number;
  availableAmount: number;
  pendingAmount: number;
  paidOutAmount: number;
  refundedAmount: number;
  chargebackAmount: number;
  participantsPaidCount: number;
  adminUrl: string | null;
};

export type OrganizerWalletDoc = OrganizerWalletSummary & {
  currency: "BRL";
};

export type OrganizerPayoutRequestStatus =
  | "pending"
  | "processing"
  | "paid"
  | "rejected"
  | "cancelled";

export type OrganizerPayoutRequest = {
  id: string;
  organizerUserId: string;
  walletId: string | null;
  currency: "BRL";
  requestedAmount: number;
  availableAmountSnapshot: number;
  pendingAmountSnapshot: number;
  paidOutAmountSnapshot: number;
  status: OrganizerPayoutRequestStatus;
  payoutMethod: string | null;
  payoutKey: string | null;
  notes: string | null;
  adminNotes: string | null;
  externalReference: string | null;
  processedAmount: number;
  createdAt: number | null;
  updatedAt: number | null;
  processedAt: number | null;
};

export type OrganizerWalletDashboardResponse = {
  wallet: OrganizerWalletDoc | null;
  transactions: OrganizerWalletTransaction[];
  tournamentRows: WalletTournamentRow[];
  currency: "BRL";
  walletSummary: OrganizerWalletSummary;
  stats: {
    tournamentsCount: number;
    paymentsCount: number;
    releasesCount: number;
    payoutsCount: number;
  };
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

function toMillis(value: unknown): number | null {
  if (!value) return null;

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.getTime();
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate?: () => Date }).toDate === "function"
  ) {
    const date = (value as { toDate?: () => Date }).toDate?.();
    return !date || Number.isNaN(date.getTime()) ? null : date.getTime();
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "seconds" in value &&
    typeof (value as { seconds?: number }).seconds === "number"
  ) {
    return ((value as { seconds: number }).seconds ?? 0) * 1000;
  }

  return null;
}

function normalizeCurrency(value: unknown): "BRL" {
  const currency = safeTrim(value).toUpperCase();
  return currency === "BRL" ? "BRL" : "BRL";
}

function normalizeTransactionType(value: unknown): OrganizerWalletTransactionType {
  const raw = safeTrim(value) as OrganizerWalletTransactionType;

  if (
    raw === "payment_created" ||
    raw === "payment_received" ||
    raw === "release_to_available" ||
    raw === "refund" ||
    raw === "chargeback" ||
    raw === "payout_sent" ||
    raw === "manual_adjustment"
  ) {
    return raw;
  }

  return "manual_adjustment";
}

function normalizeTransactionStatus(value: unknown): OrganizerWalletTransactionStatus {
  const raw = safeTrim(value) as OrganizerWalletTransactionStatus;

  if (
    raw === "pending" ||
    raw === "available" ||
    raw === "paid_out" ||
    raw === "reversed"
  ) {
    return raw;
  }

  return "pending";
}

function normalizePayoutStatus(value: unknown): OrganizerPayoutRequestStatus {
  const raw = safeTrim(value).toLowerCase();

  if (
    raw === "pending" ||
    raw === "processing" ||
    raw === "paid" ||
    raw === "rejected" ||
    raw === "cancelled"
  ) {
    return raw;
  }

  return "pending";
}

async function getUserIdFromRequest(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";

  if (!token) {
    throw new Error("Token de autenticação ausente.");
  }

  const decoded = await getAuth().verifyIdToken(token);
  return safeTrim(decoded.uid);
}

export async function requireOrganizerUserIdFromRequest(request: Request) {
  const uid = await getUserIdFromRequest(request);

  if (!uid) {
    throw new Error("Usuário não autenticado.");
  }

  return uid;
}

async function listWalletTransactions(
  organizerUserId: string
): Promise<OrganizerWalletTransaction[]> {
  const db = adminDb();
  const uid = safeTrim(organizerUserId);
  if (!uid) return [];

  const snap = await db
    .collection("organizerWalletTransactions")
    .where("organizerUserId", "==", uid)
    .get();

  const rows = snap.docs.map((docSnap) => {
    const raw = docSnap.data() as Record<string, unknown>;

    return {
      id: docSnap.id,
      organizerUserId: safeTrim(raw.organizerUserId),
      tournamentId: nullableString(raw.tournamentId),
      paymentId: nullableString(raw.paymentId),

      type: normalizeTransactionType(raw.type),
      status: normalizeTransactionStatus(raw.status),

      grossAmount: normalizeMoney(raw.grossAmount),
      feeAmount: normalizeMoney(raw.feeAmount),
      netAmount: normalizeMoney(raw.netAmount),
      currency: normalizeCurrency(raw.currency),

      externalReference: nullableString(raw.externalReference),
      providerPaymentId: nullableString(raw.providerPaymentId),

      createdAt: toMillis(raw.createdAt),
      releasedAt: toMillis(raw.releasedAt),
      paidOutAt: toMillis(raw.paidOutAt),
      reversedAt: toMillis(raw.reversedAt),
      updatedAt: toMillis(raw.updatedAt),
    } satisfies OrganizerWalletTransaction;
  });

  rows.sort((a, b) => {
    const aTime =
      a.createdAt ?? a.releasedAt ?? a.paidOutAt ?? a.reversedAt ?? a.updatedAt ?? 0;
    const bTime =
      b.createdAt ?? b.releasedAt ?? b.paidOutAt ?? b.reversedAt ?? b.updatedAt ?? 0;

    return bTime - aTime;
  });

  return rows;
}

async function getWalletSummary(
  organizerUserId: string
): Promise<OrganizerWalletSummary> {
  const db = adminDb();
  const uid = safeTrim(organizerUserId);

  const ref = db.collection("organizerWalletSummaries").doc(uid);
  const snap = await ref.get();

  if (!snap.exists) {
    return {
      organizerUserId: uid,
      availableAmount: 0,
      pendingAmount: 0,
      paidOutAmount: 0,
      grossAmount: 0,
      feeAmount: 0,
      netAmount: 0,
      refundedAmount: 0,
      chargebackAmount: 0,
      updatedAt: null,
    };
  }

  const raw = snap.data() as Record<string, unknown>;

  return {
    organizerUserId: uid,
    availableAmount: normalizeMoney(raw.availableAmount),
    pendingAmount: normalizeMoney(raw.pendingAmount),
    paidOutAmount: normalizeMoney(raw.paidOutAmount),
    grossAmount: normalizeMoney(raw.grossAmount),
    feeAmount: normalizeMoney(raw.feeAmount),
    netAmount: normalizeMoney(raw.netAmount),
    refundedAmount: normalizeMoney(raw.refundedAmount),
    chargebackAmount: normalizeMoney(raw.chargebackAmount),
    updatedAt: toMillis(raw.updatedAt),
  };
}

async function buildTournamentRows(
  organizerUserId: string,
  transactions: OrganizerWalletTransaction[]
): Promise<WalletTournamentRow[]> {
  const db = adminDb();
  const uid = safeTrim(organizerUserId);

  const map = new Map<string, WalletTournamentRow>();

  for (const tx of transactions) {
    const tournamentId = safeTrim(tx.tournamentId);
    if (!tournamentId) continue;

    if (!map.has(tournamentId)) {
      map.set(tournamentId, {
        tournamentId,
        title: `Torneio ${tournamentId}`,
        subtitle: null,
        location: null,
        status: null,
        currency: "BRL",
        grossAmount: 0,
        feeAmount: 0,
        netAmount: 0,
        availableAmount: 0,
        pendingAmount: 0,
        paidOutAmount: 0,
        refundedAmount: 0,
        chargebackAmount: 0,
        participantsPaidCount: 0,
        adminUrl: `/seller/tournaments/${tournamentId}`,
      });
    }

    const row = map.get(tournamentId)!;

    if (tx.type === "payment_received") {
      row.grossAmount += tx.grossAmount;
      row.feeAmount += tx.feeAmount;
      row.netAmount += tx.netAmount;

      if (tx.status === "pending") {
        row.pendingAmount += tx.netAmount;
      }
    }

    if (tx.type === "release_to_available" && tx.status === "available") {
      row.availableAmount += tx.netAmount;
    }

    if (tx.type === "payout_sent" && tx.status === "paid_out") {
      row.paidOutAmount += tx.netAmount;
      row.availableAmount = Math.max(0, row.availableAmount - tx.netAmount);
    }

    if (tx.type === "refund") {
      row.refundedAmount += tx.netAmount;
      if (tx.status === "reversed") {
        row.availableAmount = Math.max(0, row.availableAmount - tx.netAmount);
      }
    }

    if (tx.type === "chargeback") {
      row.chargebackAmount += tx.netAmount;
      if (tx.status === "reversed") {
        row.availableAmount = Math.max(0, row.availableAmount - tx.netAmount);
      }
    }
  }

  const tournamentIds = [...map.keys()];
  if (tournamentIds.length === 0) return [];

  const tournamentDocs = await Promise.all(
    tournamentIds.map((id) => db.collection("tournaments").doc(id).get())
  );

  for (const snap of tournamentDocs) {
    if (!snap.exists) continue;

    const raw = snap.data() as Record<string, unknown>;
    const tournamentId = safeTrim(snap.id);
    const row = map.get(tournamentId);
    if (!row) continue;

    row.title =
      safeTrim(raw.title) ||
      safeTrim(raw.name) ||
      safeTrim(raw.tournamentName) ||
      row.title;

    row.subtitle =
      nullableString(raw.subtitle) ||
      nullableString(raw.description) ||
      null;

    row.location =
      nullableString(raw.locationName) ||
      nullableString(raw.location) ||
      nullableString(raw.city) ||
      null;

    row.status = nullableString(raw.status) || "draft";

    row.adminUrl =
      nullableString(raw.adminUrl) || `/seller/tournaments/${tournamentId}`;
  }

  const paymentDocs = await Promise.all(
    tournamentIds.map((tournamentId) =>
      db
        .collection("tournamentPayments")
        .where("organizerUserId", "==", uid)
        .where("tournamentId", "==", tournamentId)
        .get()
    )
  );

  paymentDocs.forEach((snap, index) => {
    const tournamentId = tournamentIds[index];
    const row = map.get(tournamentId);
    if (!row) return;

    row.participantsPaidCount = snap.docs.filter((docSnap) => {
      const raw = docSnap.data() as Record<string, unknown>;
      const status = safeTrim(raw.status).toLowerCase();
      return status === "received" || status === "confirmed";
    }).length;
  });

  const rows = [...map.values()].map((row) => ({
    ...row,
    grossAmount: normalizeMoney(row.grossAmount),
    feeAmount: normalizeMoney(row.feeAmount),
    netAmount: normalizeMoney(row.netAmount),
    availableAmount: normalizeMoney(row.availableAmount),
    pendingAmount: normalizeMoney(row.pendingAmount),
    paidOutAmount: normalizeMoney(row.paidOutAmount),
    refundedAmount: normalizeMoney(row.refundedAmount),
    chargebackAmount: normalizeMoney(row.chargebackAmount),
  }));

  rows.sort((a, b) => b.grossAmount - a.grossAmount);

  return rows;
}

async function getLatestPayoutRequest(
  organizerUserId: string
): Promise<OrganizerPayoutRequest | null> {
  const db = adminDb();
  const uid = safeTrim(organizerUserId);

  const snap = await db
    .collection("organizerPayoutRequests")
    .where("organizerUserId", "==", uid)
    .orderBy("createdAt", "desc")
    .limit(1)
    .get();

  if (snap.empty) return null;

  const docSnap = snap.docs[0];
  const raw = docSnap.data() as Record<string, unknown>;

  return {
    id: docSnap.id,
    organizerUserId: safeTrim(raw.organizerUserId),
    walletId: nullableString(raw.walletId),
    currency: normalizeCurrency(raw.currency),
    requestedAmount: normalizeMoney(raw.requestedAmount),
    availableAmountSnapshot: normalizeMoney(raw.availableAmountSnapshot),
    pendingAmountSnapshot: normalizeMoney(raw.pendingAmountSnapshot),
    paidOutAmountSnapshot: normalizeMoney(raw.paidOutAmountSnapshot),
    status: normalizePayoutStatus(raw.status),
    payoutMethod: nullableString(raw.payoutMethod),
    payoutKey: nullableString(raw.payoutKey),
    notes: nullableString(raw.notes),
    adminNotes: nullableString(raw.adminNotes),
    externalReference: nullableString(raw.externalReference),
    processedAmount: normalizeMoney(raw.processedAmount),
    createdAt: toMillis(raw.createdAt),
    updatedAt: toMillis(raw.updatedAt),
    processedAt: toMillis(raw.processedAt),
  };
}

async function hasOpenPayoutRequest(organizerUserId: string): Promise<boolean> {
  const db = adminDb();
  const uid = safeTrim(organizerUserId);

  const snap = await db
    .collection("organizerPayoutRequests")
    .where("organizerUserId", "==", uid)
    .where("status", "in", ["pending", "processing"])
    .limit(1)
    .get();

  return !snap.empty;
}

export async function getOrganizerWalletDashboardServer(
  organizerUserId: string
): Promise<OrganizerWalletDashboardResponse> {
  const uid = safeTrim(organizerUserId);
  const [summary, transactions] = await Promise.all([
    getWalletSummary(uid),
    listWalletTransactions(uid),
  ]);

  const tournamentRows = await buildTournamentRows(uid, transactions);

  return {
    wallet: {
      ...summary,
      currency: "BRL",
    },
    transactions,
    tournamentRows,
    currency: "BRL",
    walletSummary: summary,
    stats: {
      tournamentsCount: tournamentRows.length,
      paymentsCount: transactions.filter((item) => item.type === "payment_received")
        .length,
      releasesCount: transactions.filter(
        (item) => item.type === "release_to_available"
      ).length,
      payoutsCount: transactions.filter((item) => item.type === "payout_sent").length,
    },
  };
}

export async function getOrganizerWalletPayoutStatusServer(organizerUserId: string) {
  const uid = safeTrim(organizerUserId);

  const [walletSummary, latestPayoutRequest, payoutOpen] = await Promise.all([
    getWalletSummary(uid),
    getLatestPayoutRequest(uid),
    hasOpenPayoutRequest(uid),
  ]);

  return {
    walletSummary,
    latestPayoutRequest,
    payoutOpen,
  };
}

export async function createOrganizerWalletPayoutRequestServer(params: {
  organizerUserId: string;
}) {
  const db = adminDb();
  const organizerUserId = safeTrim(params.organizerUserId);

  if (!organizerUserId) {
    throw new Error("organizerUserId é obrigatório.");
  }

  const [walletSummary, payoutOpen] = await Promise.all([
    getWalletSummary(organizerUserId),
    hasOpenPayoutRequest(organizerUserId),
  ]);

  const availableAmount = normalizeMoney(walletSummary.availableAmount);

  if (availableAmount <= 0) {
    throw new Error("Você não possui saldo disponível para solicitar repasse.");
  }

  if (payoutOpen) {
    throw new Error("Já existe um pedido de repasse em andamento.");
  }

  const ref = db.collection("organizerPayoutRequests").doc();
  const now = Date.now();

  const payload = {
    organizerUserId,
    walletId: organizerUserId,
    currency: "BRL",
    requestedAmount: availableAmount,
    availableAmountSnapshot: normalizeMoney(walletSummary.availableAmount),
    pendingAmountSnapshot: normalizeMoney(walletSummary.pendingAmount),
    paidOutAmountSnapshot: normalizeMoney(walletSummary.paidOutAmount),
    status: "pending",
    payoutMethod: "manual_review",
    payoutKey: null,
    notes: "Solicitação criada pela carteira do organizador.",
    adminNotes: null,
    externalReference: null,
    processedAmount: 0,
    createdAt: now,
    updatedAt: now,
    processedAt: null,
    serverCreatedAt: FieldValue.serverTimestamp(),
    serverUpdatedAt: FieldValue.serverTimestamp(),
  };

  await ref.set(payload);

  return {
    id: ref.id,
    ...payload,
  };
}