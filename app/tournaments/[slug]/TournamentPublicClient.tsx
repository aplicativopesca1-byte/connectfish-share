"use client";

import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { db } from "../../../src/lib/firebase";

type Props = {
  slug: string;
};

type TournamentStatus = "draft" | "scheduled" | "live" | "finished" | string;

type TournamentPublic = {
  id: string;
  title: string;
  subtitle: string | null;
  slug: string | null;
  location: string;
  description: string | null;
  coverImageUrl: string | null;
  species: string;
  minSizeCm: number;
  validFishCount: number;
  rules: string[];
  status: TournamentStatus;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  boundaryEnabled: boolean;
  entryFee: number | null;
  currency: string;
};

type CreatePreferenceResponse = {
  success: boolean;
  checkoutUrl?: string;
  registrationId?: string;
  externalReference?: string;
  message?: string;
};

function toIsoStringSafe(value: unknown): string | null {
  if (!value) return null;

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate?: () => Date }).toDate === "function"
  ) {
    const date = (value as { toDate?: () => Date }).toDate?.();
    if (!date || Number.isNaN(date.getTime())) return null;
    return date.toISOString();
  }

  if (typeof value === "string") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }

  return null;
}

function formatDateTime(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function formatMoney(value: number | null, currency = "BRL") {
  if (typeof value !== "number" || Number.isNaN(value)) return "A definir";

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  }).format(value);
}

function getStatusLabel(status: TournamentStatus) {
  const normalized = String(status || "").toLowerCase();

  if (normalized === "live") return "Ao vivo";
  if (normalized === "finished") return "Finalizado";
  if (normalized === "draft") return "Rascunho";
  return "Agendado";
}

function getStatusBadgeStyle(status: TournamentStatus): CSSProperties {
  const normalized = String(status || "").toLowerCase();

  if (normalized === "live") {
    return {
      ...styles.statusBadge,
      background: "#DCFCE7",
      color: "#166534",
    };
  }

  if (normalized === "finished") {
    return {
      ...styles.statusBadge,
      background: "#E5E7EB",
      color: "#374151",
    };
  }

  if (normalized === "draft") {
    return {
      ...styles.statusBadge,
      background: "#DBEAFE",
      color: "#1D4ED8",
    };
  }

  return {
    ...styles.statusBadge,
    background: "#FEF3C7",
    color: "#92400E",
  };
}

function normalizeRules(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).filter(Boolean);
}

function canAcceptRegistration(status: TournamentStatus) {
  const normalized = String(status || "").toLowerCase();
  return normalized === "scheduled" || normalized === "live";
}

function getRegistrationBlockMessage(status: TournamentStatus) {
  const normalized = String(status || "").toLowerCase();

  if (normalized === "draft") {
    return "Este torneio ainda está em rascunho e não está aceitando inscrições.";
  }

  if (normalized === "finished") {
    return "Este torneio já foi finalizado e não aceita novas inscrições.";
  }

  return null;
}

export default function TournamentPublicClient({ slug }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [tournament, setTournament] = useState<TournamentPublic | null>(null);

  const [teamName, setTeamName] = useState("");
  const [captainName, setCaptainName] = useState("");
  const [captainEmail, setCaptainEmail] = useState("");
  const [captainPhone, setCaptainPhone] = useState("");
  const [member1, setMember1] = useState("");
  const [member2, setMember2] = useState("");
  const [member3, setMember3] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const members = useMemo(() => {
    return [member1, member2, member3]
      .map((name) => name.trim())
      .filter(Boolean)
      .map((name) => ({
        userId: null,
        name,
      }));
  }, [member1, member2, member3]);

  const registrationBlockedMessage = useMemo(() => {
    if (!tournament) return null;
    return getRegistrationBlockMessage(tournament.status);
  }, [tournament]);

  useEffect(() => {
    void loadTournament();
  }, [slug]);

  async function loadTournament() {
    setLoading(true);
    setError(null);

    try {
      if (!slug.trim()) {
        setError("Slug do torneio inválido.");
        return;
      }

      const tournamentsRef = collection(db, "tournaments");
      const tournamentsQuery = query(tournamentsRef, where("slug", "==", slug));
      const snapshot = await getDocs(tournamentsQuery);

      if (snapshot.empty) {
        setError("Torneio não encontrado.");
        return;
      }

      const docSnap = snapshot.docs[0];
      const raw = docSnap.data() as Record<string, unknown>;

      const entryFee =
        typeof raw.entryFee === "number"
          ? raw.entryFee
          : typeof raw.entryFeeAmount === "number"
          ? raw.entryFeeAmount
          : typeof raw.price === "number"
          ? raw.price
          : null;

      const currency =
        typeof raw.currency === "string" && raw.currency.trim()
          ? raw.currency.trim().toUpperCase()
          : "BRL";

      setTournament({
        id: docSnap.id,
        title: String(raw.title ?? "Torneio"),
        subtitle: raw.subtitle ? String(raw.subtitle) : null,
        slug: raw.slug ? String(raw.slug) : null,
        location: String(raw.location ?? "Local não definido"),
        description: raw.description ? String(raw.description) : null,
        coverImageUrl: raw.coverImageUrl ? String(raw.coverImageUrl) : null,
        species: String(raw.species ?? "Espécie não definida"),
        minSizeCm: Number(raw.minSizeCm ?? 0) || 0,
        validFishCount: Number(raw.validFishCount ?? 3) || 3,
        rules: normalizeRules(raw.rules),
        status: String(raw.status ?? "scheduled"),
        scheduledStartAt: toIsoStringSafe(raw.scheduledStartAt),
        scheduledEndAt: toIsoStringSafe(raw.scheduledEndAt),
        boundaryEnabled: raw.boundaryEnabled !== false,
        entryFee,
        currency,
      });
    } catch (err) {
      console.error("Erro ao carregar torneio público:", err);
      setError("Não foi possível carregar o torneio.");
    } finally {
      setLoading(false);
    }
  }

  function validateForm() {
    if (!tournament) return "Torneio inválido.";

    if (!canAcceptRegistration(tournament.status)) {
      return getRegistrationBlockMessage(tournament.status) ?? "Inscrições indisponíveis.";
    }

    if (!teamName.trim()) {
      return "Informe o nome da equipe.";
    }

    if (!captainName.trim()) {
      return "Informe o nome do capitão.";
    }

    if (!captainEmail.trim()) {
      return "Informe o e-mail do capitão.";
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(captainEmail.trim())) {
      return "Informe um e-mail válido.";
    }

    if (!acceptedTerms) {
      return "Você precisa aceitar os termos para continuar.";
    }

    return null;
  }

  async function handleStartPayment() {
    if (!tournament) return;

    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const validationError = validateForm();

      if (validationError) {
        setError(validationError);
        setSaving(false);
        return;
      }

      const response = await fetch("/api/mercadopago/create-preference", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tournamentId: tournament.id,
          tournamentSlug: tournament.slug,
          teamName: teamName.trim(),
          captainName: captainName.trim(),
          captainEmail: captainEmail.trim(),
          captainPhone: captainPhone.trim() || null,
          members,
          source: "public_registration_web",
        }),
      });

      const data = (await response.json()) as CreatePreferenceResponse;

      if (!response.ok) {
        throw new Error(data?.message || "Não foi possível iniciar o pagamento.");
      }

      if (!data?.checkoutUrl) {
        throw new Error("O checkout não retornou uma URL válida.");
      }

      setMessage("Redirecionando para o pagamento...");

      window.location.href = data.checkoutUrl;
    } catch (err) {
      console.error("Erro ao iniciar pagamento:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível iniciar o pagamento."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <section style={styles.card}>
            <h1 style={styles.title}>Carregando torneio...</h1>
            <p style={styles.muted}>Aguarde enquanto buscamos os dados.</p>
          </section>
        </div>
      </main>
    );
  }

  if (error && !tournament) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <section style={styles.card}>
            <h1 style={styles.title}>Torneio indisponível</h1>
            <p style={styles.errorText}>{error}</p>
          </section>
        </div>
      </main>
    );
  }

  if (!tournament) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <section style={styles.card}>
            <h1 style={styles.title}>Torneio indisponível</h1>
            <p style={styles.errorText}>Torneio não encontrado.</p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <section style={styles.heroCard}>
          {tournament.coverImageUrl ? (
            <div
              style={{
                ...styles.cover,
                backgroundImage: `url(${tournament.coverImageUrl})`,
              }}
            />
          ) : null}

          <div style={styles.heroContent}>
            <div style={styles.heroTop}>
              <div>
                <h1 style={styles.title}>{tournament.title}</h1>
                {tournament.subtitle ? (
                  <p style={styles.subtitle}>{tournament.subtitle}</p>
                ) : null}
                <p style={styles.location}>{tournament.location}</p>
              </div>

              <span style={getStatusBadgeStyle(tournament.status)}>
                {getStatusLabel(tournament.status)}
              </span>
            </div>

            <div style={styles.infoGrid}>
              <InfoCard label="Espécie" value={tournament.species} />
              <InfoCard
                label="Tamanho mínimo"
                value={`${tournament.minSizeCm} cm`}
              />
              <InfoCard
                label="Peixes válidos"
                value={`${tournament.validFishCount} maiores`}
              />
              <InfoCard
                label="Início"
                value={formatDateTime(tournament.scheduledStartAt)}
              />
              <InfoCard
                label="Fim"
                value={formatDateTime(tournament.scheduledEndAt)}
              />
              <InfoCard
                label="Perímetro"
                value={tournament.boundaryEnabled ? "Ativo" : "Desativado"}
              />
              <InfoCard
                label="Inscrição"
                value={formatMoney(tournament.entryFee, tournament.currency)}
              />
            </div>
          </div>
        </section>

        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>Sobre o torneio</h2>
          <p style={styles.sectionText}>
            {tournament.description || "Descrição ainda não informada."}
          </p>
        </section>

        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>Regras oficiais</h2>

          {tournament.rules.length === 0 ? (
            <p style={styles.sectionText}>Regras ainda não informadas.</p>
          ) : (
            <div style={styles.rulesList}>
              {tournament.rules.map((rule, index) => (
                <div key={`${rule}-${index}`} style={styles.ruleRow}>
                  <span style={styles.ruleDot}>•</span>
                  <span style={styles.ruleText}>{rule}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section style={styles.card}>
          <div style={styles.checkoutHeader}>
            <div>
              <h2 style={styles.sectionTitle}>Inscrever minha equipe</h2>
              <p style={styles.sectionText}>
                Preencha os dados abaixo e siga para o pagamento da inscrição.
              </p>
            </div>

            <div style={styles.priceCard}>
              <span style={styles.priceLabel}>Valor da inscrição</span>
              <strong style={styles.priceValue}>
                {formatMoney(tournament.entryFee, tournament.currency)}
              </strong>
            </div>
          </div>

          {registrationBlockedMessage ? (
            <div style={styles.warningBox}>
              <p style={styles.warningTitle}>Inscrições indisponíveis</p>
              <p style={styles.warningText}>{registrationBlockedMessage}</p>
            </div>
          ) : null}

          <div style={styles.formGrid}>
            <Field label="Nome da equipe *">
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                style={styles.input}
                placeholder="Ex.: Tucuna Hunters"
                disabled={saving || !!registrationBlockedMessage}
              />
            </Field>

            <Field label="Nome do capitão *">
              <input
                type="text"
                value={captainName}
                onChange={(e) => setCaptainName(e.target.value)}
                style={styles.input}
                placeholder="Ex.: Rafael"
                disabled={saving || !!registrationBlockedMessage}
              />
            </Field>

            <Field label="E-mail do capitão *">
              <input
                type="email"
                value={captainEmail}
                onChange={(e) => setCaptainEmail(e.target.value)}
                style={styles.input}
                placeholder="email@exemplo.com"
                disabled={saving || !!registrationBlockedMessage}
              />
            </Field>

            <Field label="Telefone do capitão">
              <input
                type="text"
                value={captainPhone}
                onChange={(e) => setCaptainPhone(e.target.value)}
                style={styles.input}
                placeholder="(11) 99999-9999"
                disabled={saving || !!registrationBlockedMessage}
              />
            </Field>

            <Field label="Membro 1">
              <input
                type="text"
                value={member1}
                onChange={(e) => setMember1(e.target.value)}
                style={styles.input}
                placeholder="Nome do membro"
                disabled={saving || !!registrationBlockedMessage}
              />
            </Field>

            <Field label="Membro 2">
              <input
                type="text"
                value={member2}
                onChange={(e) => setMember2(e.target.value)}
                style={styles.input}
                placeholder="Nome do membro"
                disabled={saving || !!registrationBlockedMessage}
              />
            </Field>

            <Field label="Membro 3">
              <input
                type="text"
                value={member3}
                onChange={(e) => setMember3(e.target.value)}
                style={styles.input}
                placeholder="Nome do membro"
                disabled={saving || !!registrationBlockedMessage}
              />
            </Field>
          </div>

          <label style={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              disabled={saving || !!registrationBlockedMessage}
            />
            <span style={styles.checkboxText}>
              Confirmo que os dados da equipe estão corretos e aceito seguir para
              a etapa de pagamento da inscrição.
            </span>
          </label>

          <div style={styles.paymentInfoBox}>
            <p style={styles.paymentInfoTitle}>Como funciona agora</p>
            <div style={styles.paymentInfoList}>
              <div style={styles.paymentInfoRow}>
                <span style={styles.paymentInfoDot}>1</span>
                <span style={styles.paymentInfoText}>
                  Você preenche os dados da equipe.
                </span>
              </div>
              <div style={styles.paymentInfoRow}>
                <span style={styles.paymentInfoDot}>2</span>
                <span style={styles.paymentInfoText}>
                  O sistema cria sua inscrição pendente e abre o checkout.
                </span>
              </div>
              <div style={styles.paymentInfoRow}>
                <span style={styles.paymentInfoDot}>3</span>
                <span style={styles.paymentInfoText}>
                  Após o pagamento aprovado, a inscrição será confirmada.
                </span>
              </div>
            </div>
          </div>

          <div style={styles.actionsRow}>
            <button
              type="button"
              onClick={handleStartPayment}
              disabled={saving || !!registrationBlockedMessage}
              style={{
                ...styles.primaryButton,
                ...(saving || !!registrationBlockedMessage
                  ? styles.disabledButton
                  : {}),
              }}
            >
              {saving ? "Redirecionando..." : "Continuar para pagamento"}
            </button>
          </div>

          {message ? <p style={styles.successText}>{message}</p> : null}
          {error ? <p style={styles.errorText}>{error}</p> : null}
        </section>
      </div>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>
      {children}
    </label>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.infoCard}>
      <p style={styles.infoLabel}>{label}</p>
      <p style={styles.infoValue}>{value}</p>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#F8FAFC",
    padding: 24,
  },
  container: {
    maxWidth: 1100,
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  heroCard: {
    background: "#FFFFFF",
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 24,
    overflow: "hidden",
  },
  cover: {
    width: "100%",
    height: 260,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundColor: "#E2E8F0",
  },
  heroContent: {
    padding: 22,
  },
  heroTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    flexWrap: "wrap",
  },
  title: {
    margin: 0,
    fontSize: 34,
    fontWeight: 1000,
    color: "#0B3C5D",
  },
  subtitle: {
    margin: "8px 0 0 0",
    fontSize: 16,
    fontWeight: 700,
    color: "#475569",
  },
  location: {
    margin: "10px 0 0 0",
    fontSize: 14,
    fontWeight: 700,
    color: "#64748B",
  },
  statusBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "8px 12px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  card: {
    background: "#FFFFFF",
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 22,
    padding: 22,
    boxShadow: "0 10px 24px rgba(15,23,42,0.04)",
  },
  sectionTitle: {
    margin: 0,
    fontSize: 22,
    fontWeight: 900,
    color: "#0F172A",
  },
  sectionText: {
    margin: "10px 0 0 0",
    fontSize: 14,
    lineHeight: 1.7,
    fontWeight: 600,
    color: "#64748B",
  },
  muted: {
    margin: "8px 0 0 0",
    fontSize: 14,
    lineHeight: 1.6,
    fontWeight: 600,
    color: "#64748B",
  },
  infoGrid: {
    marginTop: 18,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
  },
  infoCard: {
    background: "#F8FAFC",
    borderRadius: 14,
    padding: 14,
  },
  infoLabel: {
    margin: 0,
    color: "#64748B",
    fontSize: 12,
    fontWeight: 800,
  },
  infoValue: {
    margin: "6px 0 0 0",
    color: "#0F172A",
    fontSize: 14,
    fontWeight: 900,
    lineHeight: 1.5,
  },
  rulesList: {
    marginTop: 14,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  ruleRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
  },
  ruleDot: {
    color: "#0B3C5D",
    fontWeight: 900,
  },
  ruleText: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: 700,
    lineHeight: 1.6,
  },
  checkoutHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
  },
  priceCard: {
    minWidth: 220,
    background: "#0B3C5D",
    color: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  priceLabel: {
    fontSize: 12,
    fontWeight: 800,
    opacity: 0.85,
  },
  priceValue: {
    fontSize: 28,
    fontWeight: 1000,
    lineHeight: 1.1,
  },
  warningBox: {
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
    background: "#FEF2F2",
    border: "1px solid #FECACA",
  },
  warningTitle: {
    margin: 0,
    color: "#991B1B",
    fontSize: 14,
    fontWeight: 900,
  },
  warningText: {
    margin: "8px 0 0 0",
    color: "#B91C1C",
    fontSize: 14,
    fontWeight: 700,
    lineHeight: 1.6,
  },
  formGrid: {
    marginTop: 16,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 12,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  label: {
    fontSize: 13,
    color: "#475569",
    fontWeight: 900,
  },
  input: {
    width: "100%",
    border: "1px solid rgba(15,23,42,0.12)",
    borderRadius: 12,
    padding: "12px 14px",
    fontSize: 14,
    color: "#0F172A",
    background: "#FFFFFF",
    outline: "none",
  },
  checkboxRow: {
    marginTop: 16,
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
  },
  checkboxText: {
    color: "#475569",
    fontSize: 14,
    fontWeight: 700,
    lineHeight: 1.6,
  },
  paymentInfoBox: {
    marginTop: 16,
    background: "#F8FAFC",
    borderRadius: 16,
    padding: 16,
    border: "1px solid rgba(15,23,42,0.06)",
  },
  paymentInfoTitle: {
    margin: 0,
    color: "#0F172A",
    fontSize: 14,
    fontWeight: 900,
  },
  paymentInfoList: {
    marginTop: 12,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  paymentInfoRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
  },
  paymentInfoDot: {
    width: 24,
    height: 24,
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#DBEAFE",
    color: "#1D4ED8",
    fontWeight: 900,
    fontSize: 12,
    flexShrink: 0,
  },
  paymentInfoText: {
    color: "#475569",
    fontSize: 14,
    fontWeight: 700,
    lineHeight: 1.6,
  },
  actionsRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 16,
  },
  primaryButton: {
    border: "none",
    borderRadius: 12,
    padding: "13px 18px",
    background: "#0B3C5D",
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: 900,
    cursor: "pointer",
  },
  disabledButton: {
    opacity: 0.6,
    cursor: "not-allowed",
  },
  successText: {
    margin: "14px 0 0 0",
    color: "#166534",
    fontWeight: 800,
  },
  errorText: {
    margin: "14px 0 0 0",
    color: "#B91C1C",
    fontWeight: 800,
  },
};