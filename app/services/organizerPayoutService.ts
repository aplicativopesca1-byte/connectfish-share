import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Timestamp,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

export type OrganizerPayoutRequestStatus =
  | "pending"
  | "under_review"
  | "approved"
  | "processing"
  | "paid"
  | "rejected"
  | "cancelled";

export type OrganizerPayoutRequest = {
  id: string;
  organizerUserId: string;
  walletId?: string | null;
  currency: string;
  requestedAmount: number;
  availableAmountSnapshot: number;
  pendingAmountSnapshot: number;
  paidOutAmountSnapshot: number;
  status: OrganizerPayoutRequestStatus;
  payoutMethod?: string | null;
  payoutKey?: string | null;
  notes?: string | null;
  adminNotes?: string | null;
  externalReference?: string | null;
  processedAmount?: number;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
  processedAt?: Timestamp | null;
};

export type CreateOrganizerPayoutRequestInput = {
  organizerUserId: string;
  walletId?: string | null;
  currency?: string;
  requestedAmount: number;
  availableAmountSnapshot: number;
  pendingAmountSnapshot?: number;
  paidOutAmountSnapshot?: number;
  payoutMethod?: string | null;
  payoutKey?: string | null;
  notes?: string | null;
};

function safeTrim(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeCurrency(value: unknown) {
  return safeTrim(value).toUpperCase() || "BRL";
}

function normalizeMoney(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Number(parsed.toFixed(2));
}

function assertValidCreateInput(input: CreateOrganizerPayoutRequestInput) {
  const organizerUserId = safeTrim(input.organizerUserId);
  const requestedAmount = normalizeMoney(input.requestedAmount);
  const availableAmountSnapshot = normalizeMoney(input.availableAmountSnapshot);

  if (!organizerUserId) {
    throw new Error("Organizador inválido para solicitar repasse.");
  }

  if (requestedAmount <= 0) {
    throw new Error("O valor solicitado para repasse deve ser maior que zero.");
  }

  if (availableAmountSnapshot <= 0) {
    throw new Error("Não há saldo disponível para solicitar repasse.");
  }

  if (requestedAmount > availableAmountSnapshot) {
    throw new Error("O valor solicitado não pode ser maior que o saldo disponível.");
  }
}

export async function createOrganizerPayoutRequest(
  input: CreateOrganizerPayoutRequestInput
) {
  assertValidCreateInput(input);

  const organizerUserId = safeTrim(input.organizerUserId);
  const walletId = safeTrim(input.walletId) || null;
  const currency = normalizeCurrency(input.currency || "BRL");
  const requestedAmount = normalizeMoney(input.requestedAmount);
  const availableAmountSnapshot = normalizeMoney(input.availableAmountSnapshot);
  const pendingAmountSnapshot = normalizeMoney(input.pendingAmountSnapshot);
  const paidOutAmountSnapshot = normalizeMoney(input.paidOutAmountSnapshot);
  const payoutMethod = safeTrim(input.payoutMethod) || null;
  const payoutKey = safeTrim(input.payoutKey) || null;
  const notes = safeTrim(input.notes) || null;

  const payload = {
    organizerUserId,
    walletId,
    currency,
    requestedAmount,
    availableAmountSnapshot,
    pendingAmountSnapshot,
    paidOutAmountSnapshot,
    payoutMethod,
    payoutKey,
    notes,
    status: "pending" as OrganizerPayoutRequestStatus,
    processedAmount: 0,
    adminNotes: null,
    externalReference: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    processedAt: null,
  };

  const docRef = await addDoc(collection(db, "organizerPayoutRequests"), payload);

  return {
    id: docRef.id,
    ...payload,
  };
}

export async function listOrganizerPayoutRequests(
  organizerUserId: string
): Promise<OrganizerPayoutRequest[]> {
  const normalizedUserId = safeTrim(organizerUserId);

  if (!normalizedUserId) return [];

  const payoutQuery = query(
    collection(db, "organizerPayoutRequests"),
    where("organizerUserId", "==", normalizedUserId),
    orderBy("createdAt", "desc")
  );

  const snap = await getDocs(payoutQuery);

  return snap.docs.map((docSnap) => ({
    id: docSnap.id,
    ...(docSnap.data() as Omit<OrganizerPayoutRequest, "id">),
  }));
}

export async function getLatestOrganizerPayoutRequest(
  organizerUserId: string
): Promise<OrganizerPayoutRequest | null> {
  const normalizedUserId = safeTrim(organizerUserId);

  if (!normalizedUserId) return null;

  const payoutQuery = query(
    collection(db, "organizerPayoutRequests"),
    where("organizerUserId", "==", normalizedUserId),
    orderBy("createdAt", "desc"),
    limit(1)
  );

  const snap = await getDocs(payoutQuery);

  if (snap.empty) return null;

  const first = snap.docs[0];

  return {
    id: first.id,
    ...(first.data() as Omit<OrganizerPayoutRequest, "id">),
  };
}

export async function hasOpenOrganizerPayoutRequest(
  organizerUserId: string
): Promise<boolean> {
  const items = await listOrganizerPayoutRequests(organizerUserId);

  return items.some((item) =>
    ["pending", "under_review", "approved", "processing"].includes(
      safeTrim(item.status).toLowerCase()
    )
  );
}

export async function updateOrganizerPayoutRequestStatus(params: {
  payoutRequestId: string;
  status: OrganizerPayoutRequestStatus;
  adminNotes?: string | null;
  externalReference?: string | null;
  processedAmount?: number;
}) {
  const payoutRequestId = safeTrim(params.payoutRequestId);
  const status = safeTrim(params.status) as OrganizerPayoutRequestStatus;

  if (!payoutRequestId) {
    throw new Error("Pedido de repasse inválido.");
  }

  if (!status) {
    throw new Error("Status de repasse inválido.");
  }

  const ref = doc(db, "organizerPayoutRequests", payoutRequestId);

  const payload: Record<string, unknown> = {
    status,
    updatedAt: serverTimestamp(),
  };

  if (params.adminNotes !== undefined) {
    payload.adminNotes = safeTrim(params.adminNotes) || null;
  }

  if (params.externalReference !== undefined) {
    payload.externalReference = safeTrim(params.externalReference) || null;
  }

  if (params.processedAmount !== undefined) {
    payload.processedAmount = normalizeMoney(params.processedAmount);
  }

  if (status === "paid") {
    payload.processedAt = serverTimestamp();
  }

  await updateDoc(ref, payload);
}

export function getPayoutStatusMeta(status: unknown) {
  const normalized = safeTrim(status).toLowerCase();

  if (normalized === "paid") {
    return { label: "Pago", bg: "#DCFCE7", color: "#166534" };
  }

  if (normalized === "processing") {
    return { label: "Processando", bg: "#E0F2FE", color: "#075985" };
  }

  if (normalized === "approved") {
    return { label: "Aprovado", bg: "#DBEAFE", color: "#1D4ED8" };
  }

  if (normalized === "under_review") {
    return { label: "Em análise", bg: "#FEF3C7", color: "#92400E" };
  }

  if (normalized === "rejected") {
    return { label: "Recusado", bg: "#FEE2E2", color: "#B91C1C" };
  }

  if (normalized === "cancelled") {
    return { label: "Cancelado", bg: "#E5E7EB", color: "#374151" };
  }

  return { label: "Pendente", bg: "#F8FAFC", color: "#334155" };
}