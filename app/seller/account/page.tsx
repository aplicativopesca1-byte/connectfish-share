"use client";

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  isOrganizerFinanciallyReady,
  type OrganizerKycStatus,
  type OrganizerPaymentProfile,
  type OrganizerPersonType,
} from "../../../app/services/organizerPaymentProfileService";

const ORGANIZER_PROFILE_API_ENDPOINT = "/api/finance/organizer/profile";
const ONBOARDING_API_ENDPOINT = "/api/finance/organizer/onboarding";
const ORGANIZER_DOCUMENTS_API_ENDPOINT = "/api/finance/organizer/documents";

function safeTrim(value: unknown) {
  return String(value ?? "").trim();
}

function onlyDigits(value: unknown) {
  return String(value ?? "").replace(/\D+/g, "");
}

function maskCpfCnpj(value: string) {
  const digits = onlyDigits(value);

  if (digits.length <= 11) {
    return digits
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1-$2")
      .slice(0, 14);
  }

  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2")
    .slice(0, 18);
}

function maskPhone(value: string) {
  const digits = onlyDigits(value).slice(0, 11);

  if (digits.length <= 10) {
    return digits
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }

  return digits
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
}

function maskPostalCode(value: string) {
  return onlyDigits(value).replace(/^(\d{5})(\d)/, "$1-$2").slice(0, 9);
}

function normalizeStatus(
  profile: OrganizerPaymentProfile | null,
  financialReady: boolean
): OrganizerKycStatus {
  if (!profile) return "not_started";
  if (financialReady) return "approved";
  return profile.status || "not_started";
}

function formatDateTime(value: unknown) {
  const raw = Number(value);
  if (!Number.isFinite(raw) || raw <= 0) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(raw));
}

function getStatusLabel(status: OrganizerKycStatus) {
  if (status === "approved") return "Conta aprovada";
  if (status === "pending") return "Em análise";
  if (status === "rejected") return "Revisão necessária";
  if (status === "draft") return "Cadastro incompleto";
  return "Não iniciado";
}

function getStatusDescription(
  status: OrganizerKycStatus,
  hasPendingDocs: boolean
) {
  if (status === "approved") {
    return "Sua conta está pronta para criar e receber inscrições de torneios.";
  }

  if (status === "pending") {
    return hasPendingDocs
      ? "Faltam documentos para aprovação da conta."
      : "Seu cadastro foi enviado e está em análise.";
  }

  if (status === "rejected") {
    return "Seu cadastro precisa de correções antes de ser aprovado.";
  }

  if (status === "draft") {
    return "Complete seu cadastro financeiro para liberar a criação de torneios pagos.";
  }

  return "Preencha seus dados para ativar a conta de organizador.";
}

function getStatusBadgeStyle(
  status: OrganizerKycStatus,
  isMobile: boolean
): CSSProperties {
  const base = {
    ...styles.badge,
    width: isMobile ? "100%" : "auto",
    justifyContent: "center" as const,
  };

  if (status === "approved") {
    return {
      ...base,
      background: "#DCFCE7",
      color: "#166534",
    };
  }

  if (status === "pending") {
    return {
      ...base,
      background: "#FEF3C7",
      color: "#92400E",
    };
  }

  if (status === "rejected") {
    return {
      ...base,
      background: "#FEE2E2",
      color: "#991B1B",
    };
  }

  if (status === "draft") {
    return {
      ...base,
      background: "#DBEAFE",
      color: "#1D4ED8",
    };
  }

  return {
    ...base,
    background: "#E5E7EB",
    color: "#374151",
  };
}

function getPrimaryButtonLabel(status: OrganizerKycStatus, saving: boolean) {
  if (saving) return "Salvando...";
  if (status === "approved") return "Atualizar conta";
  if (status === "pending") return "Atualizar cadastro";
  if (status === "rejected") return "Corrigir cadastro";
  if (status === "draft") return "Continuar cadastro";
  return "Ativar conta de organizador";
}

function buildMissingChecklist(params: {
  personType: OrganizerPersonType;
  fullName: string;
  companyName: string;
  cpfCnpj: string;
  email: string;
  phone: string;
  mobilePhone: string;
  birthDate: string;
  postalCode: string;
  address: string;
  addressNumber: string;
  province: string;
  city: string;
  state: string;
  termsAccepted: boolean;
}) {
  const missing: string[] = [];

  if (params.personType === "FISICA" && !safeTrim(params.fullName)) {
    missing.push("Nome completo");
  }

  if (params.personType === "JURIDICA" && !safeTrim(params.companyName)) {
    missing.push("Razão social / empresa");
  }

  if (!onlyDigits(params.cpfCnpj)) missing.push("CPF/CNPJ");
  if (!safeTrim(params.email)) missing.push("E-mail");
  if (!safeTrim(params.phone) && !safeTrim(params.mobilePhone)) {
    missing.push("Telefone ou celular");
  }
  if (!safeTrim(params.birthDate)) missing.push("Data de nascimento");
  if (!safeTrim(params.postalCode)) missing.push("CEP");
  if (!safeTrim(params.address)) missing.push("Endereço");
  if (!safeTrim(params.addressNumber)) missing.push("Número");
  if (!safeTrim(params.province)) missing.push("Bairro");
  if (!safeTrim(params.city)) missing.push("Cidade");
  if (!safeTrim(params.state)) missing.push("UF");
  if (!params.termsAccepted) missing.push("Aceite dos termos");

  return missing;
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string | null;
  children: ReactNode;
}) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>
      {children}
      {hint ? <span style={styles.hint}>{hint}</span> : null}
    </label>
  );
}

export default function OrganizerAccountPage() {
  const router = useRouter();
  const { uid, email, loading: authLoading } = useAuth() as {
    uid?: string | null;
    email?: string | null;
    loading?: boolean;
  };

  const [isMobile, setIsMobile] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [documentsLoading, setDocumentsLoading] = useState(false);

  const [profile, setProfile] = useState<OrganizerPaymentProfile | null>(null);
  const [financialReady, setFinancialReady] = useState(false);
  const [onboardingUrl, setOnboardingUrl] = useState<string | null>(null);
  const [hasPendingDocs, setHasPendingDocs] = useState(false);

  const [personType, setPersonType] = useState<OrganizerPersonType>("FISICA");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [mobilePhone, setMobilePhone] = useState("");
  const [birthDate, setBirthDate] = useState("");

  const [postalCode, setPostalCode] = useState("");
  const [address, setAddress] = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");
  const [stateValue, setStateValue] = useState("");

  const [bankAccountSummary, setBankAccountSummary] = useState("");
  const [pixKeySummary, setPixKeySummary] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkScreen = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkScreen();
    window.addEventListener("resize", checkScreen);

    return () => window.removeEventListener("resize", checkScreen);
  }, []);

  const status = useMemo(
    () => normalizeStatus(profile, financialReady),
    [profile, financialReady]
  );

  const missingChecklist = useMemo(
    () =>
      buildMissingChecklist({
        personType,
        fullName,
        companyName,
        cpfCnpj,
        email: contactEmail,
        phone,
        mobilePhone,
        birthDate,
        postalCode,
        address,
        addressNumber,
        province,
        city,
        state: stateValue,
        termsAccepted,
      }),
    [
      personType,
      fullName,
      companyName,
      cpfCnpj,
      contactEmail,
      phone,
      mobilePhone,
      birthDate,
      postalCode,
      address,
      addressNumber,
      province,
      city,
      stateValue,
      termsAccepted,
    ]
  );

  useEffect(() => {
    if (authLoading) return;

    if (!uid) {
      router.replace("/login");
      return;
    }

    void (async () => {
      await loadProfile(uid, email || null);
      await loadDocuments(uid);
    })();
  }, [authLoading, uid, email, router]);

  async function loadProfile(userId: string, fallbackEmail: string | null) {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `${ORGANIZER_PROFILE_API_ENDPOINT}?organizerUserId=${encodeURIComponent(
          userId
        )}`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        throw new Error(
          safeTrim(result?.message) ||
            "Não foi possível carregar sua conta de organizador."
        );
      }

      const nextProfile = (result?.profile || null) as OrganizerPaymentProfile | null;
      const nextReady = isOrganizerFinanciallyReady(nextProfile);

      setProfile(nextProfile);
      setFinancialReady(nextReady);

      setPersonType(
        nextProfile?.personType === "JURIDICA" ? "JURIDICA" : "FISICA"
      );
      setCpfCnpj(maskCpfCnpj(safeTrim(nextProfile?.cpfCnpj)));
      setFullName(safeTrim(nextProfile?.fullName));
      setCompanyName(safeTrim(nextProfile?.companyName));
      setContactEmail(safeTrim(nextProfile?.email) || safeTrim(fallbackEmail));
      setPhone(maskPhone(safeTrim(nextProfile?.phone)));
      setMobilePhone(maskPhone(safeTrim(nextProfile?.mobilePhone)));
      setBirthDate(safeTrim(nextProfile?.birthDate));
      setPostalCode(maskPostalCode(safeTrim(nextProfile?.postalCode)));
      setAddress(safeTrim(nextProfile?.address));
      setAddressNumber(safeTrim(nextProfile?.addressNumber));
      setComplement(safeTrim(nextProfile?.complement));
      setProvince(safeTrim(nextProfile?.province));
      setCity(safeTrim(nextProfile?.city));
      setStateValue(safeTrim(nextProfile?.state).toUpperCase().slice(0, 2));
      setBankAccountSummary(safeTrim(nextProfile?.bankAccountSummary));
      setPixKeySummary(safeTrim(nextProfile?.pixKeySummary));
      setTermsAccepted(Boolean(nextProfile?.termsAcceptedAt));
    } catch (loadError) {
      console.error("Erro ao carregar conta do organizador:", loadError);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Não foi possível carregar sua conta de organizador."
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadDocuments(userId: string) {
    try {
      setDocumentsLoading(true);

      const res = await fetch(
        `${ORGANIZER_DOCUMENTS_API_ENDPOINT}?organizerUserId=${encodeURIComponent(
          userId
        )}`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const data = await res.json().catch(() => null);

      if (data?.success) {
        setHasPendingDocs(Boolean(data.pending));
        setOnboardingUrl(safeTrim(data.onboardingUrl) || null);
        return;
      }

      setHasPendingDocs(false);
      setOnboardingUrl(null);
    } catch (err) {
      console.error("Erro ao buscar documentos:", err);
      setHasPendingDocs(false);
      setOnboardingUrl(null);
    } finally {
      setDocumentsLoading(false);
    }
  }

  function clearFeedback() {
    if (message) setMessage(null);
    if (error) setError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearFeedback();

    if (!uid) {
      setError("Usuário não identificado.");
      return;
    }

    if (missingChecklist.length > 0) {
      setError(
        `Preencha os campos obrigatórios antes de continuar: ${missingChecklist.join(
          ", "
        )}.`
      );
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(ONBOARDING_API_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          organizerUserId: uid,
          personType,
          cpfCnpj: onlyDigits(cpfCnpj),
          fullName: safeTrim(fullName) || null,
          companyName: safeTrim(companyName) || null,
          email: safeTrim(contactEmail),
          phone: onlyDigits(phone) || null,
          mobilePhone: onlyDigits(mobilePhone) || null,
          birthDate: safeTrim(birthDate) || null,

          postalCode: onlyDigits(postalCode) || null,
          address: safeTrim(address) || null,
          addressNumber: safeTrim(addressNumber) || null,
          complement: safeTrim(complement) || null,
          province: safeTrim(province) || null,
          city: safeTrim(city) || null,
          state: safeTrim(stateValue).toUpperCase() || null,

          bankAccountSummary: safeTrim(bankAccountSummary) || null,
          pixKeySummary: safeTrim(pixKeySummary) || null,

          termsAccepted: true,
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        throw new Error(
          safeTrim(result?.message) ||
            "Não foi possível salvar a conta do organizador."
        );
      }

      setMessage(
        result?.reused
          ? "Conta encontrada e sincronizada com sucesso."
          : "Cadastro financeiro salvo com sucesso."
      );

      await loadProfile(uid, contactEmail || email || null);
      await loadDocuments(uid);
    } catch (submitError) {
      console.error("Erro ao salvar conta do organizador:", submitError);
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Erro ao salvar a conta do organizador."
      );
    } finally {
      setSaving(false);
    }
  }

  function handleOpenOnboarding() {
    if (!onboardingUrl) return;
    window.open(onboardingUrl, "_blank", "noopener,noreferrer");
  }

  const pageStyle: CSSProperties = {
    ...styles.page,
    padding: isMobile ? "16px 12px 32px" : "24px 16px 40px",
  };

  const heroCardStyle: CSSProperties = {
    ...styles.heroCard,
    maxWidth: isMobile ? "100%" : 1180,
    padding: isMobile ? 16 : 22,
    borderRadius: isMobile ? 18 : 24,
  };

  const cardStyle: CSSProperties = {
    ...styles.card,
    padding: isMobile ? 16 : 22,
    borderRadius: isMobile ? 18 : 24,
  };

  const heroTopStyle: CSSProperties = {
    ...styles.heroTop,
    flexDirection: isMobile ? "column" : "row",
    alignItems: isMobile ? "stretch" : "flex-start",
    gap: isMobile ? 12 : 16,
  };

  const heroGridStyle: CSSProperties = {
    ...styles.heroGrid,
    gridTemplateColumns: isMobile
      ? "1fr"
      : "repeat(auto-fit, minmax(220px, 1fr))",
  };

  const formGridStyle: CSSProperties = {
    ...styles.formGrid,
    gridTemplateColumns: isMobile
      ? "1fr"
      : "repeat(auto-fit, minmax(240px, 1fr))",
    gap: isMobile ? 12 : 14,
  };

  const checkGridStyle: CSSProperties = {
    ...styles.checkGrid,
    gridTemplateColumns: isMobile
      ? "1fr"
      : "repeat(auto-fit, minmax(230px, 1fr))",
  };

  const footerActionsStyle: CSSProperties = {
    ...styles.footerActions,
    flexDirection: isMobile ? "column" : "row",
    alignItems: isMobile ? "stretch" : "center",
  };

  const secondaryButtonStyle: CSSProperties = {
    ...styles.secondaryButton,
    width: isMobile ? "100%" : "auto",
  };

  const primaryButtonStyle: CSSProperties = {
    ...styles.primaryButton,
    width: isMobile ? "100%" : "auto",
  };

  const pageTitleStyle: CSSProperties = {
    ...styles.pageTitle,
    fontSize: isMobile ? 22 : 28,
    lineHeight: isMobile ? 1.2 : 1.1,
  };

  const pageSubStyle: CSSProperties = {
    ...styles.pageSub,
    fontSize: isMobile ? 13 : 14,
    lineHeight: isMobile ? 1.5 : 1.6,
    maxWidth: "100%",
  };

  const inputStyle: CSSProperties = {
    ...styles.input,
    minHeight: isMobile ? 52 : 48,
    fontSize: isMobile ? 16 : 14,
  };

  const toggleRowStyle: CSSProperties = {
    ...styles.toggleRow,
    flexDirection: isMobile ? "column" : "row",
  };

  const segmentButtonStyle: CSSProperties = {
    ...styles.segmentButton,
    width: isMobile ? "100%" : "auto",
  };

  const segmentActiveStyle: CSSProperties = {
    ...styles.segmentActive,
    width: isMobile ? "100%" : "auto",
  };

  const pendingActionRowStyle: CSSProperties = {
    ...styles.pendingActionRow,
    flexDirection: isMobile ? "column" : "row",
    alignItems: isMobile ? "stretch" : "center",
  };

  if (loading) {
    return (
      <main style={pageStyle}>
        <section style={heroCardStyle}>
          <h1 style={pageTitleStyle}>Conta de organizador</h1>
          <p style={styles.muted}>Carregando seu cadastro financeiro...</p>
        </section>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <section style={heroCardStyle}>
        <div style={heroTopStyle}>
          <div>
            <h1 style={pageTitleStyle}>Conta de organizador</h1>
            <p style={pageSubStyle}>
              Complete seu cadastro para criar torneios e receber inscrições com
              segurança.
            </p>
          </div>

          <div style={styles.heroActions}>
            <span style={getStatusBadgeStyle(status, isMobile)}>
              {getStatusLabel(status)}
            </span>
          </div>
        </div>

        <div style={heroGridStyle}>
          <PreviewCard
            label="Status financeiro"
            value={getStatusLabel(status)}
            sub={getStatusDescription(status, hasPendingDocs)}
          />
          <PreviewCard
            label="Provider"
            value={safeTrim(profile?.provider).toUpperCase() || "ASAAS"}
            sub="Integração financeira do organizador"
          />
          <PreviewCard
            label="Conta enviada em"
            value={formatDateTime(profile?.termsAcceptedAt)}
            sub="Último aceite salvo"
          />
          <PreviewCard
            label="Wallet / recebedor"
            value={safeTrim(profile?.providerWalletId) || "Ainda não gerada"}
            sub={
              safeTrim(profile?.providerAccountId)
                ? `Conta ${safeTrim(profile?.providerAccountId)}`
                : "Subconta ainda não sincronizada"
            }
          />
        </div>
      </section>

      {message ? <div style={styles.successBox}>{message}</div> : null}
      {error ? <div style={styles.errorBox}>{error}</div> : null}

      {status === "pending" && hasPendingDocs ? (
        <section style={cardStyle}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>Ação necessária</h2>
            <p style={styles.sectionSub}>
              Para liberar sua conta, finalize o envio de documentos no Asaas.
            </p>
          </div>

          <div style={styles.warningBox}>
            Sua conta precisa de validação adicional, como documentos ou selfie.
          </div>

          <div style={pendingActionRowStyle}>
            <button
              type="button"
              style={primaryButtonStyle}
              disabled={!onboardingUrl || documentsLoading}
              onClick={handleOpenOnboarding}
            >
              {documentsLoading
                ? "Verificando..."
                : "Enviar documentos para aprovação"}
            </button>
          </div>
        </section>
      ) : null}

      <section style={cardStyle}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>Checklist para liberar torneios pagos</h2>
          <p style={styles.sectionSub}>
            Quanto menos itens faltarem, mais rápido o organizador fica apto.
          </p>
        </div>

        <div style={checkGridStyle}>
          <CheckItem
            done={missingChecklist.length === 0}
            label="Campos obrigatórios preenchidos"
          />
          <CheckItem done={termsAccepted} label="Termos financeiros aceitos" />
          <CheckItem
            done={!!safeTrim(profile?.providerAccountId)}
            label="Subconta financeira criada"
          />
          <CheckItem
            done={financialReady}
            label="Conta aprovada para receber"
          />
        </div>

        {missingChecklist.length > 0 ? (
          <div style={styles.warningBox}>
            <strong>Faltando agora:</strong> {missingChecklist.join(", ")}.
          </div>
        ) : null}
      </section>

      <form onSubmit={handleSubmit} style={styles.formStack}>
        <section style={cardStyle}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>Tipo de cadastro</h2>
            <p style={styles.sectionSub}>
              Escolha se o recebimento será em nome de pessoa física ou jurídica.
            </p>
          </div>

          <div style={toggleRowStyle}>
            <button
              type="button"
              onClick={() => {
                clearFeedback();
                setPersonType("FISICA");
              }}
              style={
                personType === "FISICA"
                  ? segmentActiveStyle
                  : segmentButtonStyle
              }
            >
              Pessoa física
            </button>

            <button
              type="button"
              onClick={() => {
                clearFeedback();
                setPersonType("JURIDICA");
              }}
              style={
                personType === "JURIDICA"
                  ? segmentActiveStyle
                  : segmentButtonStyle
              }
            >
              Pessoa jurídica
            </button>
          </div>
        </section>

        <section style={cardStyle}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>Dados do recebedor</h2>
            <p style={styles.sectionSub}>
              Esses dados formam a base da sua conta financeira.
            </p>
          </div>

          <div style={formGridStyle}>
            {personType === "FISICA" ? (
              <Field label="Nome completo *">
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => {
                    clearFeedback();
                    setFullName(e.target.value);
                  }}
                  style={inputStyle}
                  placeholder="Nome completo do organizador"
                />
              </Field>
            ) : (
              <Field label="Razão social / empresa *">
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => {
                    clearFeedback();
                    setCompanyName(e.target.value);
                  }}
                  style={inputStyle}
                  placeholder="Nome da empresa"
                />
              </Field>
            )}

            <Field label={personType === "FISICA" ? "CPF *" : "CNPJ *"}>
              <input
                type="text"
                value={cpfCnpj}
                onChange={(e) => {
                  clearFeedback();
                  setCpfCnpj(maskCpfCnpj(e.target.value));
                }}
                style={inputStyle}
                placeholder={
                  personType === "FISICA"
                    ? "000.000.000-00"
                    : "00.000.000/0000-00"
                }
              />
            </Field>

            <Field label="E-mail *">
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => {
                  clearFeedback();
                  setContactEmail(e.target.value);
                }}
                style={inputStyle}
                placeholder="seu@email.com"
              />
            </Field>

            <Field
              label="Data de nascimento *"
              hint="Para PJ, use a do responsável quando fizer sentido no seu fluxo atual."
            >
              <input
                type="date"
                value={birthDate}
                onChange={(e) => {
                  clearFeedback();
                  setBirthDate(e.target.value);
                }}
                style={inputStyle}
              />
            </Field>

            <Field label="Telefone">
              <input
                type="text"
                value={phone}
                onChange={(e) => {
                  clearFeedback();
                  setPhone(maskPhone(e.target.value));
                }}
                style={inputStyle}
                placeholder="(00) 0000-0000"
              />
            </Field>

            <Field label="Celular / WhatsApp">
              <input
                type="text"
                value={mobilePhone}
                onChange={(e) => {
                  clearFeedback();
                  setMobilePhone(maskPhone(e.target.value));
                }}
                style={inputStyle}
                placeholder="(00) 00000-0000"
              />
            </Field>
          </div>
        </section>

        <section style={cardStyle}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>Endereço do cadastro</h2>
            <p style={styles.sectionSub}>
              Endereço usado na conta financeira do organizador.
            </p>
          </div>

          <div style={formGridStyle}>
            <Field label="CEP *">
              <input
                type="text"
                value={postalCode}
                onChange={(e) => {
                  clearFeedback();
                  setPostalCode(maskPostalCode(e.target.value));
                }}
                style={inputStyle}
                placeholder="00000-000"
              />
            </Field>

            <Field label="Endereço *">
              <input
                type="text"
                value={address}
                onChange={(e) => {
                  clearFeedback();
                  setAddress(e.target.value);
                }}
                style={inputStyle}
                placeholder="Rua, avenida, etc."
              />
            </Field>

            <Field label="Número *">
              <input
                type="text"
                value={addressNumber}
                onChange={(e) => {
                  clearFeedback();
                  setAddressNumber(e.target.value);
                }}
                style={inputStyle}
                placeholder="123"
              />
            </Field>

            <Field label="Complemento">
              <input
                type="text"
                value={complement}
                onChange={(e) => {
                  clearFeedback();
                  setComplement(e.target.value);
                }}
                style={inputStyle}
                placeholder="Sala, bloco, ap."
              />
            </Field>

            <Field label="Bairro *">
              <input
                type="text"
                value={province}
                onChange={(e) => {
                  clearFeedback();
                  setProvince(e.target.value);
                }}
                style={inputStyle}
                placeholder="Bairro"
              />
            </Field>

            <Field label="Cidade *">
              <input
                type="text"
                value={city}
                onChange={(e) => {
                  clearFeedback();
                  setCity(e.target.value);
                }}
                style={inputStyle}
                placeholder="Cidade"
              />
            </Field>

            <Field label="UF *">
              <input
                type="text"
                value={stateValue}
                onChange={(e) => {
                  clearFeedback();
                  setStateValue(e.target.value.toUpperCase().slice(0, 2));
                }}
                style={inputStyle}
                placeholder="SP"
                maxLength={2}
              />
            </Field>
          </div>
        </section>

        <section style={cardStyle}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>Resumo financeiro interno</h2>
            <p style={styles.sectionSub}>
              Campos opcionais para sua operação interna e suporte.
            </p>
          </div>

          <div style={formGridStyle}>
            <Field label="Resumo da conta bancária">
              <input
                type="text"
                value={bankAccountSummary}
                onChange={(e) => {
                  clearFeedback();
                  setBankAccountSummary(e.target.value);
                }}
                style={inputStyle}
                placeholder="Banco, agência e final da conta"
              />
            </Field>

            <Field label="Resumo da chave PIX">
              <input
                type="text"
                value={pixKeySummary}
                onChange={(e) => {
                  clearFeedback();
                  setPixKeySummary(e.target.value);
                }}
                style={inputStyle}
                placeholder="CPF, e-mail, telefone ou aleatória"
              />
            </Field>
          </div>
        </section>

        <section style={cardStyle}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>Confirmação final</h2>
            <p style={styles.sectionSub}>
              Antes de enviar, confirme que os dados financeiros estão corretos.
            </p>
          </div>

          <label style={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => {
                clearFeedback();
                setTermsAccepted(e.target.checked);
              }}
            />
            <span>
              Confirmo que os dados informados estão corretos e autorizo o uso
              deles para ativação da conta de organizador.
            </span>
          </label>

          <div style={footerActionsStyle}>
            <button
              type="button"
              style={secondaryButtonStyle}
              onClick={() => router.push("/seller")}
            >
              Voltar ao painel
            </button>

            <button
              type="submit"
              style={primaryButtonStyle}
              disabled={saving}
            >
              {getPrimaryButtonLabel(status, saving)}
            </button>
          </div>
        </section>
      </form>
    </main>
  );
}

function PreviewCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string | null;
}) {
  return (
    <div style={styles.previewCard}>
      <span style={styles.previewLabel}>{label}</span>
      <strong style={styles.previewValue}>{value}</strong>
      {sub ? <span style={styles.previewSub}>{sub}</span> : null}
    </div>
  );
}

function CheckItem({ done, label }: { done: boolean; label: string }) {
  return (
    <div style={styles.checkItem}>
      <span style={done ? styles.checkDotDone : styles.checkDotPending} />
      <span style={styles.checkText}>{label}</span>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "linear-gradient(180deg, #071325 0%, #0B1730 40%, #0F172A 100%)",
    padding: "24px 16px 40px",
    color: "#EAF0FF",
  },

  heroCard: {
    maxWidth: 1180,
    margin: "0 auto 18px",
    background: "rgba(15, 23, 42, 0.86)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 24,
    padding: 22,
    boxShadow: "0 24px 70px rgba(0,0,0,0.24)",
  },

  heroTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    flexWrap: "wrap",
  },

  heroActions: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },

  pageTitle: {
    margin: 0,
    fontSize: 28,
    lineHeight: 1.1,
    fontWeight: 900,
    color: "#FFFFFF",
  },

  pageSub: {
    margin: "10px 0 0",
    fontSize: 14,
    lineHeight: 1.6,
    color: "rgba(234,240,255,0.78)",
    maxWidth: 760,
  },

  muted: {
    margin: "10px 0 0",
    color: "rgba(234,240,255,0.72)",
  },

  badge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 34,
    padding: "0 12px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },

  heroGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
    marginTop: 18,
  },

  previewCard: {
    background: "rgba(8, 15, 28, 0.75)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 18,
    padding: 14,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },

  previewLabel: {
    fontSize: 12,
    fontWeight: 800,
    color: "rgba(234,240,255,0.62)",
  },

  previewValue: {
    fontSize: 16,
    lineHeight: 1.35,
    color: "#FFFFFF",
  },

  previewSub: {
    fontSize: 12,
    lineHeight: 1.5,
    color: "rgba(234,240,255,0.68)",
  },

  successBox: {
    maxWidth: 1180,
    margin: "0 auto 18px",
    background: "#DCFCE7",
    color: "#166534",
    borderRadius: 18,
    padding: 14,
    fontWeight: 800,
  },

  errorBox: {
    maxWidth: 1180,
    margin: "0 auto 18px",
    background: "#FEE2E2",
    color: "#991B1B",
    borderRadius: 18,
    padding: 14,
    fontWeight: 800,
  },

  warningBox: {
    marginTop: 14,
    background: "#FEF3C7",
    color: "#92400E",
    borderRadius: 16,
    padding: 14,
    fontSize: 14,
    lineHeight: 1.5,
    fontWeight: 700,
  },

  pendingActionRow: {
    marginTop: 16,
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },

  formStack: {
    maxWidth: 1180,
    margin: "0 auto",
    display: "grid",
    gap: 18,
  },

  card: {
    background: "rgba(15, 23, 42, 0.86)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 24,
    padding: 22,
    boxShadow: "0 24px 70px rgba(0,0,0,0.18)",
  },

  sectionHeader: {
    marginBottom: 16,
  },

  sectionTitle: {
    margin: 0,
    fontSize: 20,
    lineHeight: 1.2,
    fontWeight: 900,
    color: "#FFFFFF",
  },

  sectionSub: {
    margin: "8px 0 0",
    color: "rgba(234,240,255,0.72)",
    fontSize: 14,
    lineHeight: 1.6,
  },

  checkGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
    gap: 10,
  },

  checkItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    minHeight: 44,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(8, 15, 28, 0.75)",
    padding: "0 14px",
  },

  checkDotDone: {
    width: 10,
    height: 10,
    borderRadius: 999,
    background: "#22C55E",
    flexShrink: 0,
  },

  checkDotPending: {
    width: 10,
    height: 10,
    borderRadius: 999,
    background: "#F59E0B",
    flexShrink: 0,
  },

  checkText: {
    fontSize: 14,
    lineHeight: 1.5,
    fontWeight: 700,
    color: "#EAF0FF",
  },

  toggleRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },

  segmentButton: {
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(8,15,28,0.75)",
    color: "#EAF0FF",
    minHeight: 44,
    borderRadius: 14,
    padding: "0 14px",
    fontWeight: 900,
    cursor: "pointer",
  },

  segmentActive: {
    border: "1px solid transparent",
    background: "linear-gradient(135deg, #00BFDF 0%, #5EFCA1 100%)",
    color: "#04111F",
    minHeight: 44,
    borderRadius: 14,
    padding: "0 14px",
    fontWeight: 900,
    cursor: "pointer",
  },

  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 14,
  },

  field: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },

  label: {
    fontSize: 13,
    fontWeight: 800,
    color: "#EAF0FF",
  },

  hint: {
    fontSize: 12,
    lineHeight: 1.5,
    color: "rgba(234,240,255,0.60)",
  },

  input: {
    width: "100%",
    minHeight: 48,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(8, 15, 28, 0.82)",
    color: "#FFFFFF",
    padding: "0 14px",
    outline: "none",
    fontSize: 14,
    boxSizing: "border-box",
  },

  checkboxRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    color: "#EAF0FF",
    fontSize: 14,
    lineHeight: 1.6,
    fontWeight: 700,
  },

  footerActions: {
    marginTop: 18,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },

  secondaryButton: {
    minHeight: 46,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(8, 15, 28, 0.82)",
    color: "#EAF0FF",
    padding: "0 16px",
    fontWeight: 900,
    cursor: "pointer",
  },

  primaryButton: {
    minHeight: 46,
    borderRadius: 14,
    border: "none",
    background: "linear-gradient(135deg, #00BFDF 0%, #5EFCA1 100%)",
    color: "#04111F",
    padding: "0 18px",
    fontWeight: 900,
    cursor: "pointer",
  },
};