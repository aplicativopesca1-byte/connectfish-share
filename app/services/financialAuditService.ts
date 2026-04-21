import {
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  addDoc,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

export type FinancialAuditLevel = "info" | "warning" | "error";
export type FinancialAuditSource =
  | "asaas_webhook"
  | "asaas_checkout"
  | "asaas_onboarding"
  | "wallet_sync"
  | "manual"
  | "system";

export type FinancialAuditLog = {
  id: string;
  source: FinancialAuditSource;
  eventType: string;
  level: FinancialAuditLevel;

  organizerUserId: string | null;
  tournamentId: string | null;
  paymentId: string | null;
  providerPaymentId: string | null;
  providerAccountId: string | null;
  externalReference: string | null;

  message: string | null;
  payload: Record<string, unknown> | null;
  createdAt: number | null;
};

export type CreateFinancialAuditLogInput = {
  source: FinancialAuditSource;
  eventType: string;
  level?: FinancialAuditLevel;

  organizerUserId?: string | null;
  tournamentId?: string | null;
  paymentId?: string | null;
  providerPaymentId?: string | null;
  providerAccountId?: string | null;
  externalReference?: string | null;

  message?: string | null;
  payload?: Record<string, unknown> | null;
};

export type WebhookEventLock = {
  id: string;
  source: FinancialAuditSource;
  eventId: string;
  createdAt: number | null;
};

function safeTrim(value: unknown) {
  return String(value ?? "").trim();
}

function nullableString(value: unknown) {
  const text = safeTrim(value);
  return text || null;
}

function now() {
  return Date.now();
}

function lockRef(source: FinancialAuditSource, eventId: string) {
  return doc(
    db,
    "webhookEventLocks",
    `${safeTrim(source)}__${safeTrim(eventId)}`
  );
}

function normalizeLevel(value: unknown): FinancialAuditLevel {
  const level = safeTrim(value).toLowerCase();

  if (level === "warning") return "warning";
  if (level === "error") return "error";
  return "info";
}

export async function createFinancialAuditLog(
  input: CreateFinancialAuditLogInput
): Promise<string> {
  const payload = {
    source: safeTrim(input.source) as FinancialAuditSource,
    eventType: safeTrim(input.eventType) || "unknown_event",
    level: normalizeLevel(input.level),

    organizerUserId: nullableString(input.organizerUserId),
    tournamentId: nullableString(input.tournamentId),
    paymentId: nullableString(input.paymentId),
    providerPaymentId: nullableString(input.providerPaymentId),
    providerAccountId: nullableString(input.providerAccountId),
    externalReference: nullableString(input.externalReference),

    message: nullableString(input.message),
    payload:
      input.payload && typeof input.payload === "object" ? input.payload : null,

    createdAt: now(),
    serverCreatedAt: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, "financialAuditLogs"), payload);
  return ref.id;
}

export async function createWebhookEventLock(params: {
  source: FinancialAuditSource;
  eventId: string;
}): Promise<boolean> {
  const source = safeTrim(params.source) as FinancialAuditSource;
  const eventId = safeTrim(params.eventId);

  if (!source) {
    throw new Error("source é obrigatório.");
  }

  if (!eventId) {
    throw new Error("eventId é obrigatório.");
  }

  const ref = lockRef(source, eventId);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    return false;
  }

  await setDoc(ref, {
    source,
    eventId,
    createdAt: now(),
    serverCreatedAt: serverTimestamp(),
  });

  return true;
}

export async function hasWebhookEventLock(params: {
  source: FinancialAuditSource;
  eventId: string;
}): Promise<boolean> {
  const source = safeTrim(params.source) as FinancialAuditSource;
  const eventId = safeTrim(params.eventId);

  if (!source || !eventId) return false;

  const snap = await getDoc(lockRef(source, eventId));
  return snap.exists();
}

export async function createWebhookAuditTrail(params: {
  source: FinancialAuditSource;
  eventId: string;
  eventType: string;
  level?: FinancialAuditLevel;
  organizerUserId?: string | null;
  tournamentId?: string | null;
  paymentId?: string | null;
  providerPaymentId?: string | null;
  providerAccountId?: string | null;
  externalReference?: string | null;
  message?: string | null;
  payload?: Record<string, unknown> | null;
}) {
  const created = await createWebhookEventLock({
    source: params.source,
    eventId: params.eventId,
  });

  if (!created) {
    await createFinancialAuditLog({
      source: params.source,
      eventType: `${safeTrim(params.eventType)}_duplicate`,
      level: "warning",
      organizerUserId: params.organizerUserId,
      tournamentId: params.tournamentId,
      paymentId: params.paymentId,
      providerPaymentId: params.providerPaymentId,
      providerAccountId: params.providerAccountId,
      externalReference: params.externalReference,
      message:
        params.message || "Evento duplicado ignorado por idempotência.",
      payload: params.payload || null,
    });

    return {
      created: false,
      duplicate: true,
    };
  }

  await createFinancialAuditLog({
    source: params.source,
    eventType: params.eventType,
    level: params.level || "info",
    organizerUserId: params.organizerUserId,
    tournamentId: params.tournamentId,
    paymentId: params.paymentId,
    providerPaymentId: params.providerPaymentId,
    providerAccountId: params.providerAccountId,
    externalReference: params.externalReference,
    message: params.message || null,
    payload: params.payload || null,
  });

  return {
    created: true,
    duplicate: false,
  };
}