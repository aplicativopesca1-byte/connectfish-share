import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

export type OrganizerWalletDoc = {
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

export type OrganizerWalletTransactionType =
  | "payment_created"
  | "payment_approved"
  | "release_to_available"
  | "payment_refunded"
  | "payment_chargeback"
  | "payout_sent"
  | "manual_adjustment";

export type OrganizerWalletTransactionStatus =
  | "pending_release"
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
  currency: string;

  externalReference: string | null;
  providerPaymentId: string | null;

  createdAt: number | null;
  releasedAt: number | null;
  paidOutAt: number | null;
  reversedAt: number | null;
  updatedAt: number | null;
};

export type WalletTournamentRow = {
  tournamentId: string;
  title: string;
  subtitle: string | null;
  location: string;
  status: string;
  currency: string;

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

export type OrganizerWalletDashboard = {
  wallet: OrganizerWalletDoc | null;
  transactions: OrganizerWalletTransaction[];
  tournamentRows: WalletTournamentRow[];
  currency: string;
  walletSummary: {
    availableAmount: number;
    pendingAmount: number;
    paidOutAmount: number;
    grossAmount: number;
    feeAmount: number;
    netAmount: number;
    refundedAmount: number;
    chargebackAmount: number;
  };
  stats: {
    tournamentsCount: number;
    paymentsCount: number;
    releasesCount: number;
    payoutsCount: number;
  };
};

type TournamentDoc = {
  title?: string;
  subtitle?: string | null;
  location?: string | null;
  status?: string | null;
  currency?: string | null;
  adminUrl?: string | null;
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

function normalizeCurrency(value: unknown) {
  return safeTrim(value).toUpperCase() || "BRL";
}

function normalizeTransactionType(
  value: unknown
): OrganizerWalletTransactionType {
  const type = safeTrim(value).toLowerCase();

  if (type === "payment_created") return "payment_created";
  if (type === "payment_approved") return "payment_approved";
  if (type === "release_to_available") return "release_to_available";
  if (type === "payment_refunded") return "payment_refunded";
  if (type === "payment_chargeback") return "payment_chargeback";
  if (type === "payout_sent") return "payout_sent";
  if (type === "manual_adjustment") return "manual_adjustment";

  return "payment_created";
}

function normalizeTransactionStatus(
  value: unknown
): OrganizerWalletTransactionStatus {
  const status = safeTrim(value).toLowerCase();

  if (status === "available") return "available";
  if (status === "paid_out") return "paid_out";
  if (status === "reversed") return "reversed";

  return "pending_release";
}

function normalizeTournamentStatus(value: unknown) {
  const status = safeTrim(value).toLowerCase();

  if (status === "live") return "live";
  if (status === "finished") return "finished";
  if (status === "scheduled") return "scheduled";
  if (status === "draft") return "draft";

  return "draft";
}

function sortTransactionsDesc(
  items: OrganizerWalletTransaction[]
): OrganizerWalletTransaction[] {
  return [...items].sort((a, b) => {
    const aTime =
      a.createdAt || a.releasedAt || a.paidOutAt || a.reversedAt || 0;
    const bTime =
      b.createdAt || b.releasedAt || b.paidOutAt || b.reversedAt || 0;

    return bTime - aTime;
  });
}

function mapWalletDoc(
  raw: Record<string, unknown> | undefined
): OrganizerWalletDoc | null {
  if (!raw) return null;

  return {
    organizerUserId: safeTrim(raw.organizerUserId),
    availableAmount: normalizeMoney(raw.availableAmount),
    pendingAmount: normalizeMoney(raw.pendingAmount),
    paidOutAmount: normalizeMoney(raw.paidOutAmount),
    grossAmount: normalizeMoney(raw.grossAmount),
    feeAmount: normalizeMoney(raw.feeAmount),
    netAmount: normalizeMoney(raw.netAmount),
    refundedAmount: normalizeMoney(raw.refundedAmount),
    chargebackAmount: normalizeMoney(raw.chargebackAmount),
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : null,
  };
}

function mapWalletTransaction(
  id: string,
  raw: Record<string, unknown> | undefined
): OrganizerWalletTransaction | null {
  if (!raw) return null;

  return {
    id,
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

    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : null,
    releasedAt: typeof raw.releasedAt === "number" ? raw.releasedAt : null,
    paidOutAt: typeof raw.paidOutAt === "number" ? raw.paidOutAt : null,
    reversedAt: typeof raw.reversedAt === "number" ? raw.reversedAt : null,
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : null,
  };
}

function buildEmptyWallet(organizerUserId: string): OrganizerWalletDoc {
  return {
    organizerUserId,
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

function buildWalletSummary(wallet: OrganizerWalletDoc | null) {
  return {
    availableAmount: normalizeMoney(wallet?.availableAmount),
    pendingAmount: normalizeMoney(wallet?.pendingAmount),
    paidOutAmount: normalizeMoney(wallet?.paidOutAmount),
    grossAmount: normalizeMoney(wallet?.grossAmount),
    feeAmount: normalizeMoney(wallet?.feeAmount),
    netAmount: normalizeMoney(wallet?.netAmount),
    refundedAmount: normalizeMoney(wallet?.refundedAmount),
    chargebackAmount: normalizeMoney(wallet?.chargebackAmount),
  };
}

function buildWalletStats(transactions: OrganizerWalletTransaction[]) {
  const tournamentsSet = new Set(
    transactions.map((item) => item.tournamentId).filter(Boolean)
  );

  return {
    tournamentsCount: tournamentsSet.size,
    paymentsCount: transactions.filter((item) => item.type === "payment_approved")
      .length,
    releasesCount: transactions.filter(
      (item) => item.type === "release_to_available"
    ).length,
    payoutsCount: transactions.filter((item) => item.type === "payout_sent")
      .length,
  };
}

async function getTournamentMapByIds(tournamentIds: string[]) {
  const uniqueIds = [...new Set(tournamentIds.filter(Boolean))];
  const map = new Map<string, TournamentDoc>();

  await Promise.all(
    uniqueIds.map(async (tournamentId) => {
      try {
        const snap = await getDoc(doc(db, "tournaments", tournamentId));
        if (!snap.exists()) return;
        map.set(tournamentId, (snap.data() || {}) as TournamentDoc);
      } catch (error) {
        console.error(`Erro ao carregar torneio ${tournamentId}:`, error);
      }
    })
  );

  return map;
}

function buildTournamentRows(params: {
  transactions: OrganizerWalletTransaction[];
  tournamentMap: Map<string, TournamentDoc>;
}): WalletTournamentRow[] {
  const grouped = new Map<string, WalletTournamentRow>();

  for (const tx of params.transactions) {
    const tournamentId = safeTrim(tx.tournamentId);
    if (!tournamentId) continue;

    const tournament = params.tournamentMap.get(tournamentId);

    if (!grouped.has(tournamentId)) {
      grouped.set(tournamentId, {
        tournamentId,
        title: safeTrim(tournament?.title) || "Torneio",
        subtitle: nullableString(tournament?.subtitle),
        location: safeTrim(tournament?.location) || "Local não definido",
        status: normalizeTournamentStatus(tournament?.status),
        currency: normalizeCurrency(tournament?.currency || tx.currency || "BRL"),

        grossAmount: 0,
        feeAmount: 0,
        netAmount: 0,
        availableAmount: 0,
        pendingAmount: 0,
        paidOutAmount: 0,
        refundedAmount: 0,
        chargebackAmount: 0,

        participantsPaidCount: 0,
        adminUrl:
          nullableString(tournament?.adminUrl) ||
          `/seller/tournaments/${tournamentId}`,
      });
    }

    const row = grouped.get(tournamentId)!;

    if (tx.type === "payment_approved") {
      row.grossAmount += normalizeMoney(tx.grossAmount);
      row.feeAmount += normalizeMoney(tx.feeAmount);
      row.netAmount += normalizeMoney(tx.netAmount);
      row.participantsPaidCount += 1;

      if (tx.status === "pending_release") {
        row.pendingAmount += normalizeMoney(tx.netAmount);
      }
    }

    if (tx.type === "release_to_available" && tx.status === "available") {
      row.availableAmount += normalizeMoney(tx.netAmount);
      row.pendingAmount = Math.max(
        0,
        row.pendingAmount - normalizeMoney(tx.netAmount)
      );
    }

    if (tx.type === "payout_sent" && tx.status === "paid_out") {
      row.paidOutAmount += normalizeMoney(tx.netAmount);
      row.availableAmount = Math.max(
        0,
        row.availableAmount - normalizeMoney(tx.netAmount)
      );
    }

    if (tx.type === "payment_refunded") {
      row.refundedAmount += normalizeMoney(tx.netAmount);

      if (tx.status === "reversed") {
        row.availableAmount = Math.max(
          0,
          row.availableAmount - normalizeMoney(tx.netAmount)
        );
      }
    }

    if (tx.type === "payment_chargeback") {
      row.chargebackAmount += normalizeMoney(tx.netAmount);

      if (tx.status === "reversed") {
        row.availableAmount = Math.max(
          0,
          row.availableAmount - normalizeMoney(tx.netAmount)
        );
      }
    }
  }

  return [...grouped.values()]
    .map((row) => ({
      ...row,
      grossAmount: normalizeMoney(row.grossAmount),
      feeAmount: normalizeMoney(row.feeAmount),
      netAmount: normalizeMoney(row.netAmount),
      availableAmount: normalizeMoney(row.availableAmount),
      pendingAmount: normalizeMoney(row.pendingAmount),
      paidOutAmount: normalizeMoney(row.paidOutAmount),
      refundedAmount: normalizeMoney(row.refundedAmount),
      chargebackAmount: normalizeMoney(row.chargebackAmount),
    }))
    .sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
}

export async function getOrganizerWalletSummary(
  organizerUserId: string
): Promise<OrganizerWalletDoc | null> {
  const uid = safeTrim(organizerUserId);
  if (!uid) return null;

  const snap = await getDoc(doc(db, "organizerWalletSummaries", uid));
  if (!snap.exists()) return null;

  return mapWalletDoc(snap.data() as Record<string, unknown>);
}

export async function listOrganizerWalletTransactions(
  organizerUserId: string
): Promise<OrganizerWalletTransaction[]> {
  const uid = safeTrim(organizerUserId);
  if (!uid) return [];

  const q = query(
    collection(db, "organizerWalletTransactions"),
    where("organizerUserId", "==", uid)
  );

  const snap = await getDocs(q);

  const items = snap.docs
    .map((docSnap) =>
      mapWalletTransaction(
        docSnap.id,
        docSnap.data() as Record<string, unknown>
      )
    )
    .filter(Boolean) as OrganizerWalletTransaction[];

  return sortTransactionsDesc(items);
}

export async function listWalletTournamentRows(
  organizerUserId: string
): Promise<WalletTournamentRow[]> {
  const transactions = await listOrganizerWalletTransactions(organizerUserId);
  const tournamentIds = transactions
    .map((item) => item.tournamentId)
    .filter(Boolean) as string[];

  const tournamentMap = await getTournamentMapByIds(tournamentIds);

  return buildTournamentRows({
    transactions,
    tournamentMap,
  });
}

export async function getOrganizerWalletDashboard(
  organizerUserId: string
): Promise<OrganizerWalletDashboard> {
  const uid = safeTrim(organizerUserId);
  if (!uid) {
    throw new Error("organizerUserId é obrigatório.");
  }

  const [walletFromDb, transactions] = await Promise.all([
    getOrganizerWalletSummary(uid),
    listOrganizerWalletTransactions(uid),
  ]);

  const wallet = walletFromDb || buildEmptyWallet(uid);

  const tournamentIds = transactions
    .map((item) => item.tournamentId)
    .filter(Boolean) as string[];

  const tournamentMap = await getTournamentMapByIds(tournamentIds);

  const tournamentRows = buildTournamentRows({
    transactions,
    tournamentMap,
  });

  const currency =
    tournamentRows[0]?.currency ||
    transactions[0]?.currency ||
    "BRL";

  return {
    wallet,
    transactions,
    tournamentRows,
    currency,
    walletSummary: buildWalletSummary(wallet),
    stats: buildWalletStats(transactions),
  };
}