import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";

export type OrganizerPaymentProvider = "asaas";

export type OrganizerKycStatus =
  | "not_started"
  | "draft"
  | "pending"
  | "approved"
  | "rejected";

export type OrganizerPersonType = "FISICA" | "JURIDICA";

export type OrganizerAsaasStatus = {
  commercialInfo: string | null;
  bankAccountInfo: string | null;
  documentation: string | null;
  general: string | null;
};

export type OrganizerPaymentProfile = {
  id: string;
  organizerUserId: string;
  provider: OrganizerPaymentProvider;

  providerAccountId: string | null;
  providerWalletId: string | null;
  providerApiKey: string | null;

  status: OrganizerKycStatus;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  escrowEnabled: boolean;

  onboardingUrl: string | null;
  asaasStatus: OrganizerAsaasStatus | null;

  personType: OrganizerPersonType | null;
  cpfCnpj: string | null;
  fullName: string | null;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  mobilePhone: string | null;
  birthDate: string | null;

  postalCode: string | null;
  address: string | null;
  addressNumber: string | null;
  complement: string | null;
  province: string | null;
  city: string | null;
  state: string | null;

  incomeValue: number | null;

  pixKeyType: string | null;
  pixKey: string | null;

  bankCode: string | null;
  bankName: string | null;
  agency: string | null;
  account: string | null;
  accountDigit: string | null;
  accountType: string | null;

  bankAccountSummary: string | null;
  pixKeySummary: string | null;

  termsAcceptedAt: number | null;
  onboardingSubmittedAt: number | null;
  approvedAt: number | null;
  rejectedAt: number | null;
  rejectionReason: string | null;

  createdAt: number | null;
  updatedAt: number | null;
};

export type UpsertOrganizerPaymentProfileInput = {
  organizerUserId: string;
  provider?: OrganizerPaymentProvider;

  personType?: OrganizerPersonType | null;
  cpfCnpj?: string | null;
  fullName?: string | null;
  companyName?: string | null;
  email?: string | null;
  phone?: string | null;
  mobilePhone?: string | null;
  birthDate?: string | null;

  postalCode?: string | null;
  address?: string | null;
  addressNumber?: string | null;
  complement?: string | null;
  province?: string | null;
  city?: string | null;
  state?: string | null;

  incomeValue?: number | null;

  pixKeyType?: string | null;
  pixKey?: string | null;

  bankCode?: string | null;
  bankName?: string | null;
  agency?: string | null;
  account?: string | null;
  accountDigit?: string | null;
  accountType?: string | null;

  bankAccountSummary?: string | null;
  pixKeySummary?: string | null;

  termsAcceptedAt?: number | null;
};

function safeTrim(value: unknown) {
  return String(value ?? "").trim();
}

function nullableString(value: unknown) {
  const text = safeTrim(value);
  return text || null;
}

function nullableNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function now() {
  return Date.now();
}

function profilesCollection() {
  return adminDb().collection("organizerPaymentProfiles");
}

function profileRef(organizerUserId: string) {
  return profilesCollection().doc(safeTrim(organizerUserId));
}

function normalizeStatus(value: unknown): OrganizerKycStatus {
  const status = safeTrim(value).toLowerCase();

  if (status === "draft") return "draft";
  if (status === "pending") return "pending";
  if (status === "approved") return "approved";
  if (status === "rejected") return "rejected";
  return "not_started";
}

function normalizePersonType(value: unknown): OrganizerPersonType | null {
  const type = safeTrim(value).toUpperCase();
  if (type === "FISICA") return "FISICA";
  if (type === "JURIDICA") return "JURIDICA";
  return null;
}

function normalizeAsaasStatus(value: unknown): OrganizerAsaasStatus | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const raw = value as Record<string, unknown>;

  return {
    commercialInfo: nullableString(raw.commercialInfo),
    bankAccountInfo: nullableString(raw.bankAccountInfo),
    documentation: nullableString(raw.documentation),
    general: nullableString(raw.general),
  };
}

function mapProfile(
  id: string,
  raw: Record<string, unknown> | undefined
): OrganizerPaymentProfile | null {
  if (!raw) return null;

  return {
    id,
    organizerUserId: safeTrim(raw.organizerUserId),
    provider: "asaas",

    providerAccountId: nullableString(raw.providerAccountId),
    providerWalletId: nullableString(raw.providerWalletId),
    providerApiKey: nullableString(raw.providerApiKey),

    status: normalizeStatus(raw.status),
    chargesEnabled: Boolean(raw.chargesEnabled),
    payoutsEnabled: Boolean(raw.payoutsEnabled),
    escrowEnabled: Boolean(raw.escrowEnabled),

    onboardingUrl: nullableString(raw.onboardingUrl),
    asaasStatus: normalizeAsaasStatus(raw.asaasStatus),

    personType: normalizePersonType(raw.personType),
    cpfCnpj: nullableString(raw.cpfCnpj),
    fullName: nullableString(raw.fullName),
    companyName: nullableString(raw.companyName),
    email: nullableString(raw.email),
    phone: nullableString(raw.phone),
    mobilePhone: nullableString(raw.mobilePhone),
    birthDate: nullableString(raw.birthDate),

    postalCode: nullableString(raw.postalCode),
    address: nullableString(raw.address),
    addressNumber: nullableString(raw.addressNumber),
    complement: nullableString(raw.complement),
    province: nullableString(raw.province),
    city: nullableString(raw.city),
    state: nullableString(raw.state),

    incomeValue: nullableNumber(raw.incomeValue),

    pixKeyType: nullableString(raw.pixKeyType),
    pixKey: nullableString(raw.pixKey),

    bankCode: nullableString(raw.bankCode),
    bankName: nullableString(raw.bankName),
    agency: nullableString(raw.agency),
    account: nullableString(raw.account),
    accountDigit: nullableString(raw.accountDigit),
    accountType: nullableString(raw.accountType),

    bankAccountSummary: nullableString(raw.bankAccountSummary),
    pixKeySummary: nullableString(raw.pixKeySummary),

    termsAcceptedAt:
      typeof raw.termsAcceptedAt === "number" ? raw.termsAcceptedAt : null,
    onboardingSubmittedAt:
      typeof raw.onboardingSubmittedAt === "number"
        ? raw.onboardingSubmittedAt
        : null,
    approvedAt: typeof raw.approvedAt === "number" ? raw.approvedAt : null,
    rejectedAt: typeof raw.rejectedAt === "number" ? raw.rejectedAt : null,
    rejectionReason: nullableString(raw.rejectionReason),

    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : null,
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : null,
  };
}

export async function getOrganizerPaymentProfile(
  organizerUserId: string
): Promise<OrganizerPaymentProfile | null> {
  const userId = safeTrim(organizerUserId);
  if (!userId) return null;

  const snap = await profileRef(userId).get();
  if (!snap.exists) return null;

  return mapProfile(
    snap.id,
    snap.data() as Record<string, unknown> | undefined
  );
}

export async function createOrganizerPaymentProfile(
  organizerUserId: string
): Promise<OrganizerPaymentProfile> {
  const userId = safeTrim(organizerUserId);
  if (!userId) {
    throw new Error("organizerUserId é obrigatório.");
  }

  const existing = await getOrganizerPaymentProfile(userId);
  if (existing) return existing;

  const createdAt = now();

  const payload = {
    organizerUserId: userId,
    provider: "asaas" as OrganizerPaymentProvider,

    providerAccountId: null,
    providerWalletId: null,
    providerApiKey: null,

    status: "not_started" as OrganizerKycStatus,
    chargesEnabled: false,
    payoutsEnabled: false,
    escrowEnabled: false,

    onboardingUrl: null,
    asaasStatus: null,

    personType: null,
    cpfCnpj: null,
    fullName: null,
    companyName: null,
    email: null,
    phone: null,
    mobilePhone: null,
    birthDate: null,

    postalCode: null,
    address: null,
    addressNumber: null,
    complement: null,
    province: null,
    city: null,
    state: null,

    incomeValue: null,

    pixKeyType: null,
    pixKey: null,

    bankCode: null,
    bankName: null,
    agency: null,
    account: null,
    accountDigit: null,
    accountType: null,

    bankAccountSummary: null,
    pixKeySummary: null,

    termsAcceptedAt: null,
    onboardingSubmittedAt: null,
    approvedAt: null,
    rejectedAt: null,
    rejectionReason: null,

    createdAt,
    updatedAt: createdAt,
    serverCreatedAt: FieldValue.serverTimestamp(),
    serverUpdatedAt: FieldValue.serverTimestamp(),
  };

  await profileRef(userId).set(payload);

  return {
    id: userId,
    ...payload,
  };
}

export async function upsertOrganizerPaymentProfile(
  input: UpsertOrganizerPaymentProfileInput
): Promise<OrganizerPaymentProfile> {
  const userId = safeTrim(input.organizerUserId);
  if (!userId) {
    throw new Error("organizerUserId é obrigatório.");
  }

  const existing = await getOrganizerPaymentProfile(userId);

  if (!existing) {
    await createOrganizerPaymentProfile(userId);
  }

  const payload = {
    organizerUserId: userId,
    provider: "asaas" as OrganizerPaymentProvider,

    personType: normalizePersonType(input.personType),
    cpfCnpj: nullableString(input.cpfCnpj),
    fullName: nullableString(input.fullName),
    companyName: nullableString(input.companyName),
    email: nullableString(input.email),
    phone: nullableString(input.phone),
    mobilePhone: nullableString(input.mobilePhone),
    birthDate: nullableString(input.birthDate),

    postalCode: nullableString(input.postalCode),
    address: nullableString(input.address),
    addressNumber: nullableString(input.addressNumber),
    complement: nullableString(input.complement),
    province: nullableString(input.province),
    city: nullableString(input.city),
    state: nullableString(input.state),

    incomeValue: nullableNumber(input.incomeValue),

    pixKeyType: nullableString(input.pixKeyType),
    pixKey: nullableString(input.pixKey),

    bankCode: nullableString(input.bankCode),
    bankName: nullableString(input.bankName),
    agency: nullableString(input.agency),
    account: nullableString(input.account),
    accountDigit: nullableString(input.accountDigit),
    accountType: nullableString(input.accountType),

    bankAccountSummary: nullableString(input.bankAccountSummary),
    pixKeySummary: nullableString(input.pixKeySummary),

    termsAcceptedAt:
      typeof input.termsAcceptedAt === "number" ? input.termsAcceptedAt : null,

    status: "draft" as OrganizerKycStatus,
    updatedAt: now(),
    serverUpdatedAt: FieldValue.serverTimestamp(),
  };

  await profileRef(userId).set(payload, { merge: true });

  const next = await getOrganizerPaymentProfile(userId);
  if (!next) {
    throw new Error("Não foi possível salvar o perfil financeiro.");
  }

  return next;
}

export async function markOrganizerOnboardingSubmitted(
  organizerUserId: string
) {
  const userId = safeTrim(organizerUserId);
  if (!userId) {
    throw new Error("organizerUserId é obrigatório.");
  }

  await profileRef(userId).update({
    status: "pending",
    onboardingSubmittedAt: now(),
    updatedAt: now(),
    rejectionReason: null,
    serverUpdatedAt: FieldValue.serverTimestamp(),
  });
}

export async function markOrganizerOnboardingApproved(params: {
  organizerUserId: string;
  providerAccountId: string;
  providerWalletId?: string | null;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  escrowEnabled?: boolean;
}) {
  const userId = safeTrim(params.organizerUserId);
  if (!userId) throw new Error("organizerUserId é obrigatório.");

  await profileRef(userId).update({
    status: "approved",
    providerAccountId: nullableString(params.providerAccountId),
    providerWalletId: nullableString(params.providerWalletId),
    chargesEnabled: params.chargesEnabled ?? true,
    payoutsEnabled: params.payoutsEnabled ?? true,
    escrowEnabled: params.escrowEnabled ?? false,
    approvedAt: now(),
    rejectedAt: null,
    rejectionReason: null,
    updatedAt: now(),
    serverUpdatedAt: FieldValue.serverTimestamp(),
  });
}

export async function markOrganizerOnboardingRejected(params: {
  organizerUserId: string;
  reason?: string | null;
}) {
  const userId = safeTrim(params.organizerUserId);
  if (!userId) throw new Error("organizerUserId é obrigatório.");

  await profileRef(userId).update({
    status: "rejected",
    chargesEnabled: false,
    payoutsEnabled: false,
    rejectedAt: now(),
    rejectionReason: nullableString(params.reason),
    updatedAt: now(),
    serverUpdatedAt: FieldValue.serverTimestamp(),
  });
}

export async function syncOrganizerProviderAccount(params: {
  organizerUserId: string;
  providerAccountId?: string | null;
  providerWalletId?: string | null;
  providerApiKey?: string | null;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  escrowEnabled?: boolean;
  status?: OrganizerKycStatus;
}) {
  const userId = safeTrim(params.organizerUserId);
  if (!userId) throw new Error("organizerUserId é obrigatório.");

  const payload: Record<string, unknown> = {
    updatedAt: now(),
    serverUpdatedAt: FieldValue.serverTimestamp(),
  };

  if (params.providerAccountId !== undefined) {
    payload.providerAccountId = nullableString(params.providerAccountId);
  }

  if (params.providerWalletId !== undefined) {
    payload.providerWalletId = nullableString(params.providerWalletId);
  }

  if (params.providerApiKey !== undefined) {
    payload.providerApiKey = nullableString(params.providerApiKey);
  }

  if (params.chargesEnabled !== undefined) {
    payload.chargesEnabled = Boolean(params.chargesEnabled);
  }

  if (params.payoutsEnabled !== undefined) {
    payload.payoutsEnabled = Boolean(params.payoutsEnabled);
  }

  if (params.escrowEnabled !== undefined) {
    payload.escrowEnabled = Boolean(params.escrowEnabled);
  }

  if (params.status !== undefined) {
    payload.status = params.status;
  }

  await profileRef(userId).set(payload, { merge: true });
}

export async function syncAsaasAccountStatus(params: {
  organizerUserId: string;
  commercialInfo?: string | null;
  bankAccountInfo?: string | null;
  documentation?: string | null;
  general?: string | null;
}) {
  const userId = safeTrim(params.organizerUserId);
  if (!userId) throw new Error("organizerUserId é obrigatório.");

  await profileRef(userId).set(
    {
      asaasStatus: {
        commercialInfo: nullableString(params.commercialInfo),
        bankAccountInfo: nullableString(params.bankAccountInfo),
        documentation: nullableString(params.documentation),
        general: nullableString(params.general),
      },
      updatedAt: now(),
      serverUpdatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

export async function setOrganizerOnboardingUrl(params: {
  organizerUserId: string;
  onboardingUrl: string | null;
}) {
  const userId = safeTrim(params.organizerUserId);
  if (!userId) throw new Error("organizerUserId é obrigatório.");

  await profileRef(userId).set(
    {
      onboardingUrl: nullableString(params.onboardingUrl),
      updatedAt: now(),
      serverUpdatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

export async function ensureOrganizerPaymentProfile(
  organizerUserId: string
): Promise<OrganizerPaymentProfile> {
  const existing = await getOrganizerPaymentProfile(organizerUserId);
  if (existing) return existing;
  return createOrganizerPaymentProfile(organizerUserId);
}

export async function findOrganizerPaymentProfileByProviderAccountId(
  providerAccountId: string
): Promise<OrganizerPaymentProfile | null> {
  const accountId = safeTrim(providerAccountId);
  if (!accountId) return null;

  const snap = await profilesCollection()
    .where("providerAccountId", "==", accountId)
    .limit(1)
    .get();

  if (snap.empty) return null;

  const first = snap.docs[0];
  return mapProfile(
    first.id,
    first.data() as Record<string, unknown> | undefined
  );
}