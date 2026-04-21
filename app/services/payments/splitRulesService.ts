export type SplitCurrency = "BRL";

export type SplitCalculationInput = {
  grossAmount: number;
  platformFeePercent?: number | null;
  currency?: SplitCurrency | string | null;
};

export type SplitCalculationResult = {
  currency: SplitCurrency;
  grossAmount: number;
  platformFeePercent: number;
  platformFeeAmount: number;
  organizerNetAmount: number;
};

export type BuildAsaasSplitInput = {
  grossAmount: number;
  organizerWalletId: string;
  platformFeePercent?: number | null;
};

export type AsaasSplitItem = {
  walletId: string;
  fixedValue?: number;
  percentualValue?: number;
};

export const CONNECTFISH_DEFAULT_FEE_PERCENT = 10;

function safeTrim(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeMoney(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Number(parsed.toFixed(2));
}

function roundMoney(value: number) {
  return Number(Number(value).toFixed(2));
}

function normalizePercent(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return CONNECTFISH_DEFAULT_FEE_PERCENT;
  }

  return Number(parsed.toFixed(4));
}

function normalizeCurrency(value: unknown): SplitCurrency {
  const currency = safeTrim(value).toUpperCase();
  return currency === "BRL" ? "BRL" : "BRL";
}

export function calculateTournamentSplit(
  input: SplitCalculationInput
): SplitCalculationResult {
  const grossAmount = normalizeMoney(input.grossAmount);
  const platformFeePercent = normalizePercent(input.platformFeePercent);
  const currency = normalizeCurrency(input.currency);

  if (grossAmount <= 0) {
    return {
      currency,
      grossAmount: 0,
      platformFeePercent,
      platformFeeAmount: 0,
      organizerNetAmount: 0,
    };
  }

  const platformFeeAmount = roundMoney(
    grossAmount * (platformFeePercent / 100)
  );

  const organizerNetAmount = roundMoney(
    Math.max(0, grossAmount - platformFeeAmount)
  );

  return {
    currency,
    grossAmount,
    platformFeePercent,
    platformFeeAmount,
    organizerNetAmount,
  };
}

export function buildOrganizerSplitForAsaas(
  input: BuildAsaasSplitInput
): AsaasSplitItem[] {
  const organizerWalletId = safeTrim(input.organizerWalletId);
  if (!organizerWalletId) {
    throw new Error("organizerWalletId é obrigatório para montar o split.");
  }

  const split = calculateTournamentSplit({
    grossAmount: input.grossAmount,
    platformFeePercent: input.platformFeePercent,
    currency: "BRL",
  });

  return [
    {
      walletId: organizerWalletId,
      fixedValue: split.organizerNetAmount,
    },
  ];
}

export function getConnectFishFeePercent(
  customPercent?: number | null
): number {
  return normalizePercent(customPercent);
}

export function getConnectFishFeeLabel(
  customPercent?: number | null
): string {
  const percent = getConnectFishFeePercent(customPercent);
  return `${percent}%`;
}

export function isValidSplitAmount(value: unknown): boolean {
  return normalizeMoney(value) > 0;
}

export function assertValidTournamentSplit(input: SplitCalculationInput) {
  const split = calculateTournamentSplit(input);

  if (split.grossAmount <= 0) {
    throw new Error("O valor bruto do torneio deve ser maior que zero.");
  }

  if (split.platformFeePercent < 0 || split.platformFeePercent > 100) {
    throw new Error("A taxa da ConnectFish deve estar entre 0% e 100%.");
  }

  if (split.organizerNetAmount < 0) {
    throw new Error("O valor líquido do organizador ficou inválido.");
  }

  return split;
}