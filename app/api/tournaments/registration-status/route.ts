import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "../../../../src/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RegistrationDoc = {
  tournamentId?: string;
  tournamentSlug?: string | null;
  tournamentTitle?: string | null;
  teamName?: string | null;
  captainName?: string | null;
  captainEmail?: string | null;
  registrationStatus?: string | null;
  paymentStatus?: string | null;
  paymentStatusDetail?: string | null;
  paymentProvider?: string | null;
  paymentId?: string | number | null;
  merchantOrderId?: string | number | null;
  preferenceId?: string | null;
  externalReference?: string | null;
  checkoutUrl?: string | null;
  amount?: number | null;
  currency?: string | null;
  amountPaid?: number | null;
  paymentCurrency?: string | null;
  paymentApprovedAt?: unknown;
  paymentFailedAt?: unknown;
  preferenceCreatedAt?: unknown;
  lastWebhookAt?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
};

type TeamMemberDoc = {
  teamId?: string;
  tournamentId?: string;
  userId?: string;
  role?: string | null;
  inviteStatus?: string | null;
  registrationStatus?: string | null;
  paymentStatus?: string | null;
  paymentStatusDetail?: string | null;
  paymentId?: string | number | null;
  merchantOrderId?: string | number | null;
  preferenceId?: string | null;
  checkoutUrl?: string | null;
  externalReference?: string | null;
  amount?: number | null;
  currency?: string | null;
  paymentApprovedAt?: unknown;
  paymentFailedAt?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
};

type FirestoreTimestampLike = {
  toDate?: () => Date;
};

function compactSpaces(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeStatus(value: unknown, fallback = "unknown"): string {
  const normalized = compactSpaces(value).toLowerCase();
  return normalized || fallback;
}

function serializeDate(value: unknown): string | null {
  if (!value) return null;

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as FirestoreTimestampLike).toDate === "function"
  ) {
    try {
      const date = (value as FirestoreTimestampLike).toDate?.();
      if (!date || Number.isNaN(date.getTime())) return null;
      return date.toISOString();
    } catch {
      return null;
    }
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function isApprovedLike(params: {
  paymentStatus: string;
  registrationStatus: string;
}): boolean {
  return (
    params.paymentStatus === "approved" ||
    params.registrationStatus === "confirmed"
  );
}

function isPendingLike(params: {
  paymentStatus: string;
  registrationStatus: string;
}): boolean {
  return (
    params.paymentStatus === "pending" ||
    params.paymentStatus === "in_process" ||
    params.registrationStatus === "awaiting_payment"
  );
}

function isFailedLike(params: {
  paymentStatus: string;
  registrationStatus: string;
}): boolean {
  return (
    params.paymentStatus === "rejected" ||
    params.paymentStatus === "cancelled" ||
    params.paymentStatus === "error" ||
    params.paymentStatus === "refunded" ||
    params.paymentStatus === "charged_back" ||
    params.registrationStatus === "payment_failed" ||
    params.registrationStatus === "cancelled" ||
    params.registrationStatus === "refunded" ||
    params.registrationStatus === "chargeback"
  );
}

function buildResolvedStatus(params: {
  paymentStatus: string;
  registrationStatus: string;
}): "approved" | "failed" | "pending" | "unknown" {
  if (isApprovedLike(params)) return "approved";
  if (isFailedLike(params)) return "failed";
  if (isPendingLike(params)) return "pending";
  return "unknown";
}

export async function GET(request: NextRequest) {
  try {
    const db = adminDb();
    const { searchParams } = new URL(request.url);

    const registrationId = compactSpaces(searchParams.get("registrationId"));
    const teamId = compactSpaces(searchParams.get("teamId"));
    const userId = compactSpaces(searchParams.get("userId"));

    if (!registrationId && !(teamId && userId)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Informe registrationId ou o par teamId + userId para consultar o status.",
        },
        { status: 400 }
      );
    }

    if (registrationId) {
      const registrationRef = db
        .collection("tournamentRegistrations")
        .doc(registrationId);

      const registrationSnap = await registrationRef.get();

      if (!registrationSnap.exists) {
        return NextResponse.json(
          {
            success: false,
            message: "Inscrição não encontrada.",
          },
          { status: 404 }
        );
      }

      const raw = registrationSnap.data() as RegistrationDoc;

      const paymentStatus = normalizeStatus(raw.paymentStatus, "pending");
      const registrationStatus = normalizeStatus(
        raw.registrationStatus,
        "awaiting_payment"
      );
      const resolvedStatus = buildResolvedStatus({
        paymentStatus,
        registrationStatus,
      });

      return NextResponse.json(
        {
          success: true,
          flow: "captain_registration",
          resolvedStatus,
          paymentStatus,
          registrationStatus,

          registrationId,
          tournamentId: compactSpaces(raw.tournamentId),
          tournamentSlug: compactSpaces(raw.tournamentSlug),
          tournamentTitle: compactSpaces(raw.tournamentTitle),
          teamName: compactSpaces(raw.teamName),
          captainName: compactSpaces(raw.captainName),
          captainEmail: compactSpaces(raw.captainEmail),

          paymentStatusDetail: compactSpaces(raw.paymentStatusDetail) || null,
          paymentProvider: compactSpaces(raw.paymentProvider) || null,
          paymentId: raw.paymentId ?? null,
          merchantOrderId: raw.merchantOrderId ?? null,
          preferenceId: raw.preferenceId ?? null,
          externalReference: raw.externalReference ?? null,
          checkoutUrl: raw.checkoutUrl ?? null,

          amount:
            typeof raw.amount === "number" && Number.isFinite(raw.amount)
              ? raw.amount
              : null,
          currency: compactSpaces(raw.currency) || "BRL",
          amountPaid:
            typeof raw.amountPaid === "number" && Number.isFinite(raw.amountPaid)
              ? raw.amountPaid
              : null,
          paymentCurrency: compactSpaces(raw.paymentCurrency) || null,

          paymentApprovedAt: serializeDate(raw.paymentApprovedAt),
          paymentFailedAt: serializeDate(raw.paymentFailedAt),
          preferenceCreatedAt: serializeDate(raw.preferenceCreatedAt),
          lastWebhookAt: serializeDate(raw.lastWebhookAt),
          createdAt: serializeDate(raw.createdAt),
          updatedAt: serializeDate(raw.updatedAt),
        },
        {
          status: 200,
          headers: {
            "Cache-Control": "no-store, max-age=0",
          },
        }
      );
    }

    const membersSnap = await db
      .collection("tournamentTeamMembers")
      .where("teamId", "==", teamId)
      .where("userId", "==", userId)
      .limit(1)
      .get();

    if (membersSnap.empty) {
      return NextResponse.json(
        {
          success: false,
          message: "Membro do torneio não encontrado.",
        },
        { status: 404 }
      );
    }

    const memberDoc = membersSnap.docs[0];
    const raw = memberDoc.data() as TeamMemberDoc;

    const paymentStatus = normalizeStatus(raw.paymentStatus, "pending");
    const registrationStatus = normalizeStatus(
      raw.registrationStatus,
      "awaiting_payment"
    );
    const inviteStatus = normalizeStatus(raw.inviteStatus, "pending");
    const resolvedStatus = buildResolvedStatus({
      paymentStatus,
      registrationStatus,
    });

    return NextResponse.json(
      {
        success: true,
        flow: "member_individual_payment",
        resolvedStatus,
        paymentStatus,
        registrationStatus,
        inviteStatus,

        memberDocId: memberDoc.id,
        teamId: compactSpaces(raw.teamId),
        tournamentId: compactSpaces(raw.tournamentId),
        userId: compactSpaces(raw.userId),
        role: compactSpaces(raw.role) || "member",

        paymentStatusDetail: compactSpaces(raw.paymentStatusDetail) || null,
        paymentId: raw.paymentId ?? null,
        merchantOrderId: raw.merchantOrderId ?? null,
        preferenceId: raw.preferenceId ?? null,
        externalReference: raw.externalReference ?? null,
        checkoutUrl: raw.checkoutUrl ?? null,

        amount:
          typeof raw.amount === "number" && Number.isFinite(raw.amount)
            ? raw.amount
            : null,
        currency: compactSpaces(raw.currency) || "BRL",

        paymentApprovedAt: serializeDate(raw.paymentApprovedAt),
        paymentFailedAt: serializeDate(raw.paymentFailedAt),
        createdAt: serializeDate(raw.createdAt),
        updatedAt: serializeDate(raw.updatedAt),
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("Erro ao consultar status da inscrição:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Erro interno ao consultar status da inscrição.",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 }
    );
  }
}