export type OrganizerPaymentProvider = "asaas";

export type OrganizerKycStatus =
  | "not_started"
  | "draft"
  | "pending"
  | "approved"
  | "rejected";

export type OrganizerPersonType = "FISICA" | "JURIDICA";

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

export function isOrganizerFinanciallyReady(
  profile: OrganizerPaymentProfile | null
) {
  if (!profile) return false;

  return (
    profile.status === "approved" &&
    !!profile.providerAccountId &&
    !!profile.providerWalletId &&
    profile.chargesEnabled === true
  );
}