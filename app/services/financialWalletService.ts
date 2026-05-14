// 📂 src/services/financialWalletService.ts
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";

type WalletTransactionType =
  | "payment_approved"
  | "payment_refunded"
  | "payment_chargeback"
  | "release_to_available"
  | "payout_sent"
  | "manual_adjustment";

type WalletTransactionStatus =
  | "pending_release"
  | "available"
  | "paid_out"
  | "reversed";

type ReleaseMode = "instant" | "after_tournament" | "days_after_payment";

type TournamentFinancialConfig = {
  connectfishFeePercent?: number;
  releaseMode?: ReleaseMode;
  releaseDelayDays?: number;
  payoutMode?: "manual" | "automatic";
};

type TournamentDoc = {
  organizerUserId?: string | null;
  title?: string | null;
  slug?: string | null;
  status?: string | null;
  currency?: string | null;
  financialConfig?: TournamentFinancialConfig | null;
  scheduledEndAt?: unknown;
  finishedAt?: unknown;
};

type WalletDoc = {
  organizerUserId: string;
  currency: string;
  pendingAmount: number;
  availableAmount: number;
  paidOutAmount: number;
  refundedAmount: number;
  chargebackAmount: number;
  grossAmount: number;
  feeAmount: number;
  netAmount: number;
  createdAt?: unknown;
  updatedAt?: unknown;
};

type TournamentFinancialDoc = {
  tournamentId: string;
  organizerUserId: string;
  currency: string;
  grossAmount: number;
  approvedAmount: number;
  refundedAmount: number;
  chargebackAmount: number;
  feeAmount: number;
  netAmount: number;
  pendingAmount: number;
  availableAmount: number;
  paidOutAmount: number;
  participantsPaidCount: number;
  updatedAt?: unknown;
  createdAt?: unknown;
};

type ApplyApprovedPaymentInput = {
  tournamentId: string;
  teamId: string;
  memberUserId: string;
  paymentId: string;
  externalReference?: string | null;
  grossAmount: number;
  currency?: string | null;
  paymentApprovedAt?: string | null;
};

type ReleaseWalletFundsInput = {
  organizerUserId: string;
  tournamentId?: string | null;
  transactionIds?: string[];
  releaseReason?: string | null;
};

function compactSpaces(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeMoney(value: unknown, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Number(parsed.toFixed(2));
}

function normalizeCurrency(value: unknown) {
  return compactSpaces(value).toUpperCase() || "BRL";
}

function nowIso() {
  return new Date().toISOString();
}

function toDateSafe(value: unknown): Date | null {
  if (!value) return null;

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate?: () => Date }).toDate === "function"
  ) {
    const date = (value as { toDate?: () => Date }).toDate?.();
    if (!date || Number.isNaN(date.getTime())) return null;
    return date;
  }

  if (typeof value === "string") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }

  return null;
}

function addDays(date: Date, days: number) {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

function getTransactionId(params: {
  tournamentId: string;
  teamId: string;
  memberUserId: string;
  paymentId: string;
}) {
  return [
    "payment",
    params.tournamentId,
    params.teamId,
    params.memberUserId,
    params.paymentId,
  ].join("_");
}

function getReleaseTransactionId(baseTransactionId: string) {
  return `release_${baseTransactionId}`;
}

function getDefaultFinancialConfig(): Required<TournamentFinancialConfig> {
  return {
    connectfishFeePercent: 10,
    releaseMode: "after_tournament",
    releaseDelayDays: 2,
    payoutMode: "manual",
  };
}

function resolveFinancialConfig(
  config: TournamentFinancialConfig | null | undefined
): Required<TournamentFinancialConfig> {
  const defaults = getDefaultFinancialConfig();

  return {
    connectfishFeePercent: normalizeMoney(
      config?.connectfishFeePercent,
      defaults.connectfishFeePercent
    ),
    releaseMode:
      config?.releaseMode === "instant" ||
      config?.releaseMode === "after_tournament" ||
      config?.releaseMode === "days_after_payment"
        ? config.releaseMode
        : defaults.releaseMode,
    releaseDelayDays: Math.max(
      0,
      Math.floor(normalizeMoney(config?.releaseDelayDays, defaults.releaseDelayDays))
    ),
    payoutMode:
      config?.payoutMode === "automatic" ? "automatic" : defaults.payoutMode,
  };
}

function calculateFeeBreakdown(grossAmount: number, feePercent: number) {
  const gross = normalizeMoney(grossAmount);
  const fee = normalizeMoney((gross * feePercent) / 100);
  const net = normalizeMoney(gross - fee);

  return {
    grossAmount: gross,
    connectfishFeeAmount: fee,
    netAmount: net,
  };
}

function getExpectedReleaseAt(params: {
  releaseMode: ReleaseMode;
  releaseDelayDays: number;
  paymentApprovedAt?: string | null;
  tournamentFinishedAt?: unknown;
  tournamentScheduledEndAt?: unknown;
}) {
  const paymentDate = toDateSafe(params.paymentApprovedAt) || new Date();

  if (params.releaseMode === "instant") {
    return paymentDate.toISOString();
  }

  if (params.releaseMode === "days_after_payment") {
    return addDays(paymentDate, params.releaseDelayDays).toISOString();
  }

  const tournamentFinishDate =
    toDateSafe(params.tournamentFinishedAt) ||
    toDateSafe(params.tournamentScheduledEndAt);

  if (!tournamentFinishDate) {
    return null;
  }

  return addDays(tournamentFinishDate, params.releaseDelayDays).toISOString();
}

async function getOrCreateOrganizerWallet(
  organizerUserId: string,
  currency: string
) {
  const db = adminDb();
  const walletRef = db.collection("organizerWallets").doc(organizerUserId);
  const walletSnap = await walletRef.get();

  if (!walletSnap.exists) {
    const initialData: WalletDoc = {
      organizerUserId,
      currency,
      pendingAmount: 0,
      availableAmount: 0,
      paidOutAmount: 0,
      refundedAmount: 0,
      chargebackAmount: 0,
      grossAmount: 0,
      feeAmount: 0,
      netAmount: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    await walletRef.set(initialData);
    return { walletRef, walletData: initialData };
  }

  const walletData = walletSnap.data() as WalletDoc;
  return { walletRef, walletData };
}

async function getOrCreateTournamentFinancial(
  tournamentId: string,
  organizerUserId: string,
  currency: string
) {
  const db = adminDb();
  const ref = db.collection("tournamentFinancials").doc(tournamentId);
  const snap = await ref.get();

  if (!snap.exists) {
    const initialData: TournamentFinancialDoc = {
      tournamentId,
      organizerUserId,
      currency,
      grossAmount: 0,
      approvedAmount: 0,
      refundedAmount: 0,
      chargebackAmount: 0,
      feeAmount: 0,
      netAmount: 0,
      pendingAmount: 0,
      availableAmount: 0,
      paidOutAmount: 0,
      participantsPaidCount: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    await ref.set(initialData);
    return { ref, data: initialData };
  }

  const data = snap.data() as TournamentFinancialDoc;
  return { ref, data };
}

export async function applyOrganizerWalletApprovedPayment(
  input: ApplyApprovedPaymentInput
) {
  const db = adminDb();

  const tournamentRef = db.collection("tournaments").doc(input.tournamentId);
  const tournamentSnap = await tournamentRef.get();

  if (!tournamentSnap.exists) {
    throw new Error("Torneio não encontrado para lançamento financeiro.");
  }

  const tournamentData = (tournamentSnap.data() || {}) as TournamentDoc;
  const organizerUserId = compactSpaces(tournamentData.organizerUserId);

  if (!organizerUserId) {
    throw new Error("Torneio sem organizerUserId configurado.");
  }

  const currency = normalizeCurrency(
    input.currency || tournamentData.currency || "BRL"
  );

  const financialConfig = resolveFinancialConfig(tournamentData.financialConfig);
  const breakdown = calculateFeeBreakdown(
    input.grossAmount,
    financialConfig.connectfishFeePercent
  );

  const expectedReleaseAt = getExpectedReleaseAt({
    releaseMode: financialConfig.releaseMode,
    releaseDelayDays: financialConfig.releaseDelayDays,
    paymentApprovedAt: input.paymentApprovedAt || null,
    tournamentFinishedAt: tournamentData.finishedAt,
    tournamentScheduledEndAt: tournamentData.scheduledEndAt,
  });

  const baseTransactionId = getTransactionId({
    tournamentId: input.tournamentId,
    teamId: input.teamId,
    memberUserId: input.memberUserId,
    paymentId: input.paymentId,
  });

  const transactionRef = db
    .collection("organizerWalletTransactions")
    .doc(baseTransactionId);

  const transactionSnap = await transactionRef.get();
  if (transactionSnap.exists) {
    return {
      success: true,
      reused: true,
      transactionId: baseTransactionId,
      organizerUserId,
    };
  }

  const { walletRef } = await getOrCreateOrganizerWallet(
    organizerUserId,
    currency
  );
  const { ref: tournamentFinancialRef } = await getOrCreateTournamentFinancial(
    input.tournamentId,
    organizerUserId,
    currency
  );

  const isInstantRelease = financialConfig.releaseMode === "instant";

  await db.runTransaction(async (tx) => {
    const [freshWalletSnap, freshTournamentFinancialSnap, freshTransactionSnap] =
      await Promise.all([
        tx.get(walletRef),
        tx.get(tournamentFinancialRef),
        tx.get(transactionRef),
      ]);

    if (freshTransactionSnap.exists) {
      return;
    }

    const walletData = (freshWalletSnap.data() || {}) as Partial<WalletDoc>;
    const tournamentFinancialData =
      (freshTournamentFinancialSnap.data() || {}) as Partial<TournamentFinancialDoc>;

    tx.set(
      transactionRef,
      {
        transactionId: baseTransactionId,
        organizerUserId,
        tournamentId: input.tournamentId,
        teamId: input.teamId,
        memberUserId: input.memberUserId,
        type: "payment_approved" as WalletTransactionType,
        status: isInstantRelease
          ? ("available" as WalletTransactionStatus)
          : ("pending_release" as WalletTransactionStatus),
        grossAmount: breakdown.grossAmount,
        connectfishFeeAmount: breakdown.connectfishFeeAmount,
        netAmount: breakdown.netAmount,
        currency,
        paymentId: input.paymentId,
        externalReference: input.externalReference || null,
        paymentApprovedAt: input.paymentApprovedAt || nowIso(),
        expectedReleaseAt: expectedReleaseAt || null,
        releaseMode: financialConfig.releaseMode,
        releaseDelayDays: financialConfig.releaseDelayDays,
        payoutMode: financialConfig.payoutMode,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    tx.set(
      walletRef,
      {
        organizerUserId,
        currency,
        pendingAmount: normalizeMoney(
          (walletData.pendingAmount || 0) + (isInstantRelease ? 0 : breakdown.netAmount)
        ),
        availableAmount: normalizeMoney(
          (walletData.availableAmount || 0) + (isInstantRelease ? breakdown.netAmount : 0)
        ),
        paidOutAmount: normalizeMoney(walletData.paidOutAmount || 0),
        refundedAmount: normalizeMoney(walletData.refundedAmount || 0),
        chargebackAmount: normalizeMoney(walletData.chargebackAmount || 0),
        grossAmount: normalizeMoney(
          (walletData.grossAmount || 0) + breakdown.grossAmount
        ),
        feeAmount: normalizeMoney(
          (walletData.feeAmount || 0) + breakdown.connectfishFeeAmount
        ),
        netAmount: normalizeMoney((walletData.netAmount || 0) + breakdown.netAmount),
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: walletData.createdAt || FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    tx.set(
      tournamentFinancialRef,
      {
        tournamentId: input.tournamentId,
        organizerUserId,
        currency,
        grossAmount: normalizeMoney(
          (tournamentFinancialData.grossAmount || 0) + breakdown.grossAmount
        ),
        approvedAmount: normalizeMoney(
          (tournamentFinancialData.approvedAmount || 0) + breakdown.grossAmount
        ),
        refundedAmount: normalizeMoney(tournamentFinancialData.refundedAmount || 0),
        chargebackAmount: normalizeMoney(
          tournamentFinancialData.chargebackAmount || 0
        ),
        feeAmount: normalizeMoney(
          (tournamentFinancialData.feeAmount || 0) + breakdown.connectfishFeeAmount
        ),
        netAmount: normalizeMoney(
          (tournamentFinancialData.netAmount || 0) + breakdown.netAmount
        ),
        pendingAmount: normalizeMoney(
          (tournamentFinancialData.pendingAmount || 0) +
            (isInstantRelease ? 0 : breakdown.netAmount)
        ),
        availableAmount: normalizeMoney(
          (tournamentFinancialData.availableAmount || 0) +
            (isInstantRelease ? breakdown.netAmount : 0)
        ),
        paidOutAmount: normalizeMoney(
          tournamentFinancialData.paidOutAmount || 0
        ),
        participantsPaidCount: Number(
          (tournamentFinancialData.participantsPaidCount || 0) + 1
        ),
        updatedAt: FieldValue.serverTimestamp(),
        createdAt:
          tournamentFinancialData.createdAt || FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });

  return {
    success: true,
    reused: false,
    transactionId: baseTransactionId,
    organizerUserId,
    breakdown,
    expectedReleaseAt,
  };
}

export async function releaseOrganizerWalletFunds(
  input: ReleaseWalletFundsInput
) {
  const db = adminDb();
  const walletRef = db.collection("organizerWallets").doc(input.organizerUserId);

  let transactionsQuery = db
    .collection("organizerWalletTransactions")
    .where("organizerUserId", "==", input.organizerUserId)
    .where("status", "==", "pending_release");

  if (input.tournamentId) {
    transactionsQuery = transactionsQuery.where("tournamentId", "==", input.tournamentId);
  }

  const transactionsSnap = await transactionsQuery.get();

  if (transactionsSnap.empty) {
    return {
      success: true,
      releasedCount: 0,
      releasedAmount: 0,
    };
  }

  const eligibleDocs = transactionsSnap.docs.filter((docSnap) => {
    if (Array.isArray(input.transactionIds) && input.transactionIds.length > 0) {
      return input.transactionIds.includes(docSnap.id);
    }

    const data = docSnap.data() as Record<string, unknown>;
    const expectedReleaseAt = compactSpaces(data.expectedReleaseAt);
    if (!expectedReleaseAt) return true;

    const releaseDate = new Date(expectedReleaseAt);
    if (Number.isNaN(releaseDate.getTime())) return true;

    return releaseDate.getTime() <= Date.now();
  });

  if (!eligibleDocs.length) {
    return {
      success: true,
      releasedCount: 0,
      releasedAmount: 0,
    };
  }

  const releasedAmount = normalizeMoney(
    eligibleDocs.reduce((sum, docSnap) => {
      const data = docSnap.data() as Record<string, unknown>;
      return sum + normalizeMoney(data.netAmount);
    }, 0)
  );

  const tournamentIds = Array.from(
    new Set(
      eligibleDocs
        .map((docSnap) => compactSpaces(docSnap.data().tournamentId))
        .filter(Boolean)
    )
  );

  await db.runTransaction(async (tx) => {
    const walletSnap = await tx.get(walletRef);
    const walletData = (walletSnap.data() || {}) as Partial<WalletDoc>;

    tx.set(
      walletRef,
      {
        pendingAmount: normalizeMoney(
          (walletData.pendingAmount || 0) - releasedAmount
        ),
        availableAmount: normalizeMoney(
          (walletData.availableAmount || 0) + releasedAmount
        ),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    for (const docSnap of eligibleDocs) {
      const data = docSnap.data() as Record<string, unknown>;

      tx.set(
        docSnap.ref,
        {
          status: "available",
          releasedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      tx.set(
        db
          .collection("organizerWalletTransactions")
          .doc(getReleaseTransactionId(docSnap.id)),
        {
          organizerUserId: input.organizerUserId,
          tournamentId: compactSpaces(data.tournamentId) || null,
          teamId: compactSpaces(data.teamId) || null,
          memberUserId: compactSpaces(data.memberUserId) || null,
          type: "release_to_available",
          status: "available",
          currency: normalizeCurrency(data.currency),
          grossAmount: 0,
          connectfishFeeAmount: 0,
          netAmount: normalizeMoney(data.netAmount),
          relatedTransactionId: docSnap.id,
          releaseReason: input.releaseReason || "scheduled_release",
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    for (const tournamentId of tournamentIds) {
      const ref = db.collection("tournamentFinancials").doc(tournamentId);
      const snap = await tx.get(ref);
      if (!snap.exists) continue;

      const current = (snap.data() || {}) as Partial<TournamentFinancialDoc>;
      const tournamentReleaseAmount = normalizeMoney(
        eligibleDocs
          .filter((item) => compactSpaces(item.data().tournamentId) === tournamentId)
          .reduce((sum, item) => sum + normalizeMoney(item.data().netAmount), 0)
      );

      tx.set(
        ref,
        {
          pendingAmount: normalizeMoney(
            (current.pendingAmount || 0) - tournamentReleaseAmount
          ),
          availableAmount: normalizeMoney(
            (current.availableAmount || 0) + tournamentReleaseAmount
          ),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }
  });

  return {
    success: true,
    releasedCount: eligibleDocs.length,
    releasedAmount,
  };
}