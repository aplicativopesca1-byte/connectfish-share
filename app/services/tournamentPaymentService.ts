import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

export type TournamentPaymentProvider = "asaas";
export type TournamentPaymentCurrency = "BRL";

export type TournamentPaymentStatus =
  | "pending"
  | "received"
  | "confirmed"
  | "overdue"
  | "refunded"
  | "chargeback"
  | "cancelled"
  | "failed";

export type TournamentPaymentEscrowStatus =
  | "none"
  | "held"
  | "released";

export type TournamentPayment = {
  id: string;
  tournamentId: string;
  organizerUserId: string;
  participantUserId: string;

  provider: TournamentPaymentProvider;
  providerPaymentId: string | null;
  providerCheckoutId: string | null;
  providerCustomerId: string | null;

  billingType: string | null;
  currency: TournamentPaymentCurrency;

  grossAmount: number;
  platformFeePercent: number;
  platformFeeAmount: number;
  organizerNetAmount: number;

  status: TournamentPaymentStatus;
  escrowStatus: TournamentPaymentEscrowStatus;

  externalReference: string | null;
  description: string | null;

  paidAt: number | null;
  dueDate: string | null;

  createdAt: number | null;
  updatedAt: number | null;
};

export type CreateTournamentPaymentInput = {
  tournamentId: string;
  organizerUserId: string;
  participantUserId: string;

  provider?: TournamentPaymentProvider;
  providerPaymentId?: string | null;
  providerCheckoutId?: string | null;
  providerCustomerId?: string | null;

  billingType?: string | null;
  currency?: TournamentPaymentCurrency | string | null;

  grossAmount: number;
  platformFeePercent: number;
  platformFeeAmount: number;
  organizerNetAmount: number;

  status?: TournamentPaymentStatus;
  escrowStatus?: TournamentPaymentEscrowStatus;

  externalReference?: string | null;
  description?: string | null;
  paidAt?: number | null;
  dueDate?: string | null;
};

export type UpdateTournamentPaymentStatusInput = {
  paymentId: string;
  status: TournamentPaymentStatus;
  paidAt?: number | null;
  escrowStatus?: TournamentPaymentEscrowStatus;
  providerPaymentId?: string | null;
  billingType?: string | null;
  externalReference?: string | null;
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

function normalizeCurrency(value: unknown): TournamentPaymentCurrency {
  const currency = safeTrim(value).toUpperCase();
  return currency === "BRL" ? "BRL" : "BRL";
}

function normalizeStatus(value: unknown): TournamentPaymentStatus {
  const status = safeTrim(value).toLowerCase();

  if (status === "received") return "received";
  if (status === "confirmed") return "confirmed";
  if (status === "overdue") return "overdue";
  if (status === "refunded") return "refunded";
  if (status === "chargeback") return "chargeback";
  if (status === "cancelled") return "cancelled";
  if (status === "failed") return "failed";

  return "pending";
}

function normalizeEscrowStatus(value: unknown): TournamentPaymentEscrowStatus {
  const status = safeTrim(value).toLowerCase();

  if (status === "held") return "held";
  if (status === "released") return "released";

  return "none";
}

function paymentRef(paymentId: string) {
  return doc(db, "tournamentPayments", safeTrim(paymentId));
}

function paymentCollection() {
  return collection(db, "tournamentPayments");
}

function mapTournamentPayment(
  id: string,
  raw: Record<string, unknown> | undefined
): TournamentPayment | null {
  if (!raw) return null;

  return {
    id,
    tournamentId: safeTrim(raw.tournamentId),
    organizerUserId: safeTrim(raw.organizerUserId),
    participantUserId: safeTrim(raw.participantUserId),

    provider: "asaas",
    providerPaymentId: nullableString(raw.providerPaymentId),
    providerCheckoutId: nullableString(raw.providerCheckoutId),
    providerCustomerId: nullableString(raw.providerCustomerId),

    billingType: nullableString(raw.billingType),
    currency: normalizeCurrency(raw.currency),

    grossAmount: normalizeMoney(raw.grossAmount),
    platformFeePercent: normalizeMoney(raw.platformFeePercent),
    platformFeeAmount: normalizeMoney(raw.platformFeeAmount),
    organizerNetAmount: normalizeMoney(raw.organizerNetAmount),

    status: normalizeStatus(raw.status),
    escrowStatus: normalizeEscrowStatus(raw.escrowStatus),

    externalReference: nullableString(raw.externalReference),
    description: nullableString(raw.description),

    paidAt: typeof raw.paidAt === "number" ? raw.paidAt : null,
    dueDate: nullableString(raw.dueDate),

    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : null,
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : null,
  };
}

export async function getTournamentPayment(
  paymentId: string
): Promise<TournamentPayment | null> {
  const id = safeTrim(paymentId);
  if (!id) return null;

  const snap = await getDoc(paymentRef(id));
  if (!snap.exists()) return null;

  return mapTournamentPayment(snap.id, snap.data() as Record<string, unknown>);
}

export async function createTournamentPayment(
  input: CreateTournamentPaymentInput
): Promise<TournamentPayment> {
  const tournamentId = safeTrim(input.tournamentId);
  const organizerUserId = safeTrim(input.organizerUserId);
  const participantUserId = safeTrim(input.participantUserId);

  if (!tournamentId) {
    throw new Error("tournamentId é obrigatório.");
  }

  if (!organizerUserId) {
    throw new Error("organizerUserId é obrigatório.");
  }

  if (!participantUserId) {
    throw new Error("participantUserId é obrigatório.");
  }

  const paymentDoc = doc(paymentCollection());
  const createdAt = now();

  const payload = {
    tournamentId,
    organizerUserId,
    participantUserId,

    provider: "asaas" as TournamentPaymentProvider,
    providerPaymentId: nullableString(input.providerPaymentId),
    providerCheckoutId: nullableString(input.providerCheckoutId),
    providerCustomerId: nullableString(input.providerCustomerId),

    billingType: nullableString(input.billingType),
    currency: normalizeCurrency(input.currency),

    grossAmount: normalizeMoney(input.grossAmount),
    platformFeePercent: normalizeMoney(input.platformFeePercent),
    platformFeeAmount: normalizeMoney(input.platformFeeAmount),
    organizerNetAmount: normalizeMoney(input.organizerNetAmount),

    status: normalizeStatus(input.status),
    escrowStatus: normalizeEscrowStatus(input.escrowStatus),

    externalReference: nullableString(input.externalReference),
    description: nullableString(input.description),

    paidAt: typeof input.paidAt === "number" ? input.paidAt : null,
    dueDate: nullableString(input.dueDate),

    createdAt,
    updatedAt: createdAt,
    serverCreatedAt: serverTimestamp(),
    serverUpdatedAt: serverTimestamp(),
  };

  await setDoc(paymentRef(paymentDoc.id), payload);

  return {
    id: paymentDoc.id,
    ...payload,
  };
}

export async function updateTournamentPaymentStatus(
  input: UpdateTournamentPaymentStatusInput
): Promise<void> {
  const paymentId = safeTrim(input.paymentId);
  if (!paymentId) {
    throw new Error("paymentId é obrigatório.");
  }

  const payload: Record<string, unknown> = {
    status: normalizeStatus(input.status),
    updatedAt: now(),
    serverUpdatedAt: serverTimestamp(),
  };

  if (input.paidAt !== undefined) {
    payload.paidAt = typeof input.paidAt === "number" ? input.paidAt : null;
  }

  if (input.escrowStatus !== undefined) {
    payload.escrowStatus = normalizeEscrowStatus(input.escrowStatus);
  }

  if (input.providerPaymentId !== undefined) {
    payload.providerPaymentId = nullableString(input.providerPaymentId);
  }

  if (input.billingType !== undefined) {
    payload.billingType = nullableString(input.billingType);
  }

  if (input.externalReference !== undefined) {
    payload.externalReference = nullableString(input.externalReference);
  }

  await updateDoc(paymentRef(paymentId), payload);
}

export async function updateTournamentPaymentProviderData(params: {
  paymentId: string;
  providerPaymentId?: string | null;
  providerCheckoutId?: string | null;
  providerCustomerId?: string | null;
  billingType?: string | null;
  dueDate?: string | null;
  externalReference?: string | null;
}) {
  const paymentId = safeTrim(params.paymentId);
  if (!paymentId) {
    throw new Error("paymentId é obrigatório.");
  }

  const payload: Record<string, unknown> = {
    updatedAt: now(),
    serverUpdatedAt: serverTimestamp(),
  };

  if (params.providerPaymentId !== undefined) {
    payload.providerPaymentId = nullableString(params.providerPaymentId);
  }

  if (params.providerCheckoutId !== undefined) {
    payload.providerCheckoutId = nullableString(params.providerCheckoutId);
  }

  if (params.providerCustomerId !== undefined) {
    payload.providerCustomerId = nullableString(params.providerCustomerId);
  }

  if (params.billingType !== undefined) {
    payload.billingType = nullableString(params.billingType);
  }

  if (params.dueDate !== undefined) {
    payload.dueDate = nullableString(params.dueDate);
  }

  if (params.externalReference !== undefined) {
    payload.externalReference = nullableString(params.externalReference);
  }

  await updateDoc(paymentRef(paymentId), payload);
}

export async function getTournamentPaymentByProviderPaymentId(
  providerPaymentId: string
): Promise<TournamentPayment | null> {
  const value = safeTrim(providerPaymentId);
  if (!value) return null;

  const q = query(
    paymentCollection(),
    where("providerPaymentId", "==", value),
    limit(1)
  );

  const snap = await getDocs(q);
  if (snap.empty) return null;

  const first = snap.docs[0];
  return mapTournamentPayment(first.id, first.data() as Record<string, unknown>);
}

export async function listTournamentPaymentsByTournament(
  tournamentId: string
): Promise<TournamentPayment[]> {
  const value = safeTrim(tournamentId);
  if (!value) return [];

  const q = query(
    paymentCollection(),
    where("tournamentId", "==", value),
    orderBy("createdAt", "desc")
  );

  const snap = await getDocs(q);

  return snap.docs
    .map((docSnap) =>
      mapTournamentPayment(docSnap.id, docSnap.data() as Record<string, unknown>)
    )
    .filter(Boolean) as TournamentPayment[];
}

export async function listTournamentPaymentsByOrganizer(
  organizerUserId: string
): Promise<TournamentPayment[]> {
  const value = safeTrim(organizerUserId);
  if (!value) return [];

  const q = query(
    paymentCollection(),
    where("organizerUserId", "==", value),
    orderBy("createdAt", "desc")
  );

  const snap = await getDocs(q);

  return snap.docs
    .map((docSnap) =>
      mapTournamentPayment(docSnap.id, docSnap.data() as Record<string, unknown>)
    )
    .filter(Boolean) as TournamentPayment[];
}

export async function listTournamentPaymentsByParticipant(
  participantUserId: string
): Promise<TournamentPayment[]> {
  const value = safeTrim(participantUserId);
  if (!value) return [];

  const q = query(
    paymentCollection(),
    where("participantUserId", "==", value),
    orderBy("createdAt", "desc")
  );

  const snap = await getDocs(q);

  return snap.docs
    .map((docSnap) =>
      mapTournamentPayment(docSnap.id, docSnap.data() as Record<string, unknown>)
    )
    .filter(Boolean) as TournamentPayment[];
}