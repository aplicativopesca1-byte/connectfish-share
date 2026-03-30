"use client";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { db } from "../../../src/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import AppSessionBridge from "../../seller/tournaments/components/AppSessionBridge";

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

type UserProfile = {
  userId: string;
  username: string;
  email: string | null;
  photoUrl: string | null;
  displayName: string | null;
};

type UserSearchResult = {
  userId: string;
  username: string;
  email: string | null;
  photoUrl: string | null;
};

type UserSearchResponse = {
  success: boolean;
  results?: UserSearchResult[];
  message?: string;
};

type CreateTeamResponse = {
  success: boolean;
  teamId?: string;
  message?: string;
};

type CreateMemberPreferenceResponse = {
  success: boolean;
  checkoutUrl?: string;
  preferenceId?: string;
  externalReference?: string;
  message?: string;
};

const LOGIN_PATH = "/login";
const SIGNUP_PATH = "/signup";

function compactSpaces(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

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
  return value.map((item) => compactSpaces(item)).filter(Boolean);
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

function isPubliclyVisibleTournament(raw: Record<string, unknown>) {
  const status = String(raw.status ?? "draft").toLowerCase();
  const visibility = String(raw.visibility ?? "").toLowerCase();

  return (
    visibility === "published" ||
    (visibility !== "published" && status !== "draft")
  );
}

function mapTournamentDoc(
  tournamentId: string,
  raw: Record<string, unknown>
): TournamentPublic {
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

  return {
    id: tournamentId,
    title: compactSpaces(raw.title || "Torneio"),
    subtitle: raw.subtitle ? compactSpaces(raw.subtitle) : null,
    slug: raw.slug ? compactSpaces(raw.slug) : null,
    location: compactSpaces(raw.location || "Local não definido"),
    description: raw.description ? String(raw.description) : null,
    coverImageUrl: raw.coverImageUrl ? String(raw.coverImageUrl) : null,
    species: compactSpaces(raw.species || "Espécie não definida"),
    minSizeCm: Number(raw.minSizeCm ?? 0) || 0,
    validFishCount: Number(raw.validFishCount ?? 3) || 3,
    rules: normalizeRules(raw.rules),
    status: String(raw.status ?? "scheduled"),
    scheduledStartAt: toIsoStringSafe(raw.scheduledStartAt),
    scheduledEndAt: toIsoStringSafe(raw.scheduledEndAt),
    boundaryEnabled: raw.boundaryEnabled !== false,
    entryFee,
    currency,
  };
}

export default function TournamentPublicClient({ slug }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tournamentIdFromUrl = compactSpaces(searchParams.get("id"));

  const { uid, email, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchingCaptain, setSearchingCaptain] = useState(false);
  const [searchingMembers, setSearchingMembers] = useState(false);

  const [tournament, setTournament] = useState<TournamentPublic | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);

  const [teamName, setTeamName] = useState("");
  const [captainQuery, setCaptainQuery] = useState("");
  const [captainResults, setCaptainResults] = useState<UserSearchResult[]>([]);
  const [selectedCaptain, setSelectedCaptain] = useState<UserSearchResult | null>(null);

  const [memberQuery, setMemberQuery] = useState("");
  const [memberResults, setMemberResults] = useState<UserSearchResult[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<UserSearchResult[]>([]);

  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const maxAdditionalMembers = 3;

  const registrationBlockedMessage = useMemo(() => {
    if (!tournament) return null;
    return getRegistrationBlockMessage(tournament.status);
  }, [tournament]);

  const highlightedRules = useMemo(() => {
    if (!tournament) return [];
    return tournament.rules.slice(0, 4);
  }, [tournament]);

  const isLoggedIn = !!uid;
  const isFormDisabled =
    saving || !isLoggedIn || !!authLoading || !!registrationBlockedMessage;

  useEffect(() => {
    void loadTournament();
  }, [slug, tournamentIdFromUrl]);

  useEffect(() => {
    void loadCurrentUserProfile();
  }, [uid, email]);

  useEffect(() => {
    if (!isLoggedIn || selectedCaptain) {
      setCaptainResults([]);
      return;
    }

    const queryValue = compactSpaces(captainQuery);
    if (!queryValue || queryValue.length < 2) {
      setCaptainResults([]);
      return;
    }

    const timeout = setTimeout(() => {
      void searchUsers(queryValue, "captain");
    }, 250);

    return () => clearTimeout(timeout);
  }, [captainQuery, isLoggedIn, selectedCaptain, selectedMembers, uid]);

  useEffect(() => {
    if (!isLoggedIn) {
      setMemberResults([]);
      return;
    }

    const queryValue = compactSpaces(memberQuery);
    if (!queryValue || queryValue.length < 2) {
      setMemberResults([]);
      return;
    }

    const timeout = setTimeout(() => {
      void searchUsers(queryValue, "member");
    }, 250);

    return () => clearTimeout(timeout);
  }, [memberQuery, isLoggedIn, selectedCaptain, selectedMembers, uid]);

  useEffect(() => {
    if (!isLoggedIn || !currentUserProfile || selectedCaptain) return;

    setSelectedCaptain({
      userId: currentUserProfile.userId,
      username: currentUserProfile.username,
      email: currentUserProfile.email,
      photoUrl: currentUserProfile.photoUrl,
    });
  }, [isLoggedIn, currentUserProfile, selectedCaptain]);

  function clearFeedback() {
    if (error) setError(null);
    if (message) setMessage(null);
  }

  function buildReturnUrl() {
    if (typeof window === "undefined") return "/";
    return window.location.pathname + window.location.search;
  }

  function goToLogin() {
    const next = encodeURIComponent(buildReturnUrl());
    router.push(`${LOGIN_PATH}?next=${next}`);
  }

  function goToSignup() {
    const next = encodeURIComponent(buildReturnUrl());
    router.push(`${SIGNUP_PATH}?next=${next}`);
  }

  async function loadTournament() {
    setLoading(true);
    setError(null);
    setTournament(null);

    try {
      const slugValue = compactSpaces(slug);
      const idValue = compactSpaces(tournamentIdFromUrl);

      if (!slugValue && !idValue) {
        setError("Link do torneio inválido.");
        return;
      }

      if (idValue) {
        const snap = await getDoc(doc(db, "tournaments", idValue));

        if (snap.exists()) {
          const raw = snap.data() as Record<string, unknown>;
          const docSlug = compactSpaces(raw.slug);

          if (!isPubliclyVisibleTournament(raw)) {
            setError("Torneio não encontrado.");
            return;
          }

          if (slugValue && docSlug && docSlug !== slugValue) {
            setError("Torneio não encontrado.");
            return;
          }

          setTournament(mapTournamentDoc(snap.id, raw));
          return;
        }
      }

      if (!slugValue) {
        setError("Torneio não encontrado.");
        return;
      }

      const tournamentsRef = collection(db, "tournaments");
      const tournamentsQuery = query(tournamentsRef, where("slug", "==", slugValue));
      const snapshot = await getDocs(tournamentsQuery);

      if (snapshot.empty) {
        setError("Torneio não encontrado.");
        return;
      }

      const publishedDoc = snapshot.docs.find((item) => {
        const raw = item.data() as Record<string, unknown>;

        if (!isPubliclyVisibleTournament(raw)) return false;
        if (idValue && item.id !== idValue) return false;

        return true;
      });

      if (!publishedDoc) {
        setError("Torneio não encontrado.");
        return;
      }

      const raw = publishedDoc.data() as Record<string, unknown>;
      setTournament(mapTournamentDoc(publishedDoc.id, raw));
    } catch (err) {
      console.error("Erro ao carregar torneio público:", err);
      setError("Não foi possível carregar o torneio.");
    } finally {
      setLoading(false);
    }
  }

  async function loadCurrentUserProfile() {
    if (!uid) {
      setCurrentUserProfile(null);
      setSelectedCaptain(null);
      return;
    }

    try {
      const userSnap = await getDoc(doc(db, "users", uid));

      if (!userSnap.exists()) {
        setCurrentUserProfile({
          userId: uid,
          username: "",
          email: email || null,
          photoUrl: null,
          displayName: email || "Usuário logado",
        });
        return;
      }

      const raw = userSnap.data() as Record<string, unknown>;
      const username = compactSpaces(raw.username).toLowerCase();

      setCurrentUserProfile({
        userId: userSnap.id,
        username,
        email: raw.email ? String(raw.email) : email || null,
        photoUrl: raw.photoUrl ? String(raw.photoUrl) : null,
        displayName:
          compactSpaces(raw.displayName) ||
          compactSpaces(raw.name) ||
          username ||
          email ||
          "Usuário logado",
      });
    } catch (err) {
      console.error("Erro ao carregar perfil do usuário:", err);
      setCurrentUserProfile({
        userId: uid,
        username: "",
        email: email || null,
        photoUrl: null,
        displayName: email || "Usuário logado",
      });
    }
  }

  async function searchUsers(queryValue: string, target: "captain" | "member") {
    try {
      if (target === "captain") {
        setSearchingCaptain(true);
      } else {
        setSearchingMembers(true);
      }

      const response = await fetch(
        `/api/users/search?query=${encodeURIComponent(queryValue)}`,
        {
          method: "GET",
          credentials: "include",
        }
      );

      const data = (await response.json()) as UserSearchResponse;

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Não foi possível buscar usuários.");
      }

      const currentUid = uid || "";
      const selectedMemberIds = new Set(selectedMembers.map((member) => member.userId));
      const selectedCaptainId = selectedCaptain?.userId || "";

      const filtered = (data.results || []).filter((item) => {
        if (!item.userId) return false;

        if (target === "captain") {
          if (item.userId !== currentUid && item.userId !== selectedCaptainId) {
            return false;
          }
          if (selectedMemberIds.has(item.userId)) return false;
          return true;
        }

        if (item.userId === selectedCaptainId) return false;
        if (selectedMemberIds.has(item.userId)) return false;
        return true;
      });

      if (target === "captain") {
        setCaptainResults(filtered);
      } else {
        setMemberResults(filtered);
      }
    } catch (err) {
      console.error("Erro ao buscar usuários:", err);
      if (target === "captain") {
        setCaptainResults([]);
      } else {
        setMemberResults([]);
      }
    } finally {
      if (target === "captain") {
        setSearchingCaptain(false);
      } else {
        setSearchingMembers(false);
      }
    }
  }

  function selectCaptain(user: UserSearchResult) {
    clearFeedback();

    if (selectedMembers.some((member) => member.userId === user.userId)) {
      setError("Este usuário já está na lista de membros.");
      return;
    }

    setSelectedCaptain(user);
    setCaptainQuery("");
    setCaptainResults([]);
  }

  function clearCaptain() {
    if (!currentUserProfile) {
      setSelectedCaptain(null);
      return;
    }

    clearFeedback();
    setSelectedCaptain({
      userId: currentUserProfile.userId,
      username: currentUserProfile.username,
      email: currentUserProfile.email,
      photoUrl: currentUserProfile.photoUrl,
    });
    setCaptainQuery("");
    setCaptainResults([]);
  }

  function addMember(user: UserSearchResult) {
    clearFeedback();

    if (selectedMembers.length >= maxAdditionalMembers) {
      setError(`Você pode adicionar no máximo ${maxAdditionalMembers} membros.`);
      return;
    }

    if (selectedCaptain?.userId === user.userId) {
      setError("O capitão não pode ser adicionado como membro.");
      return;
    }

    if (selectedMembers.some((item) => item.userId === user.userId)) {
      setError("Este participante já foi adicionado.");
      return;
    }

    setSelectedMembers((current) => [...current, user]);
    setMemberQuery("");
    setMemberResults([]);
  }

  function removeMember(userId: string) {
    clearFeedback();
    setSelectedMembers((current) =>
      current.filter((item) => item.userId !== userId)
    );
  }

  function validateForm() {
    if (!tournament) return "Torneio inválido.";

    if (!isLoggedIn || !uid) {
      return "Para realizar a inscrição, é obrigatório ter uma conta ConnectFish.";
    }

    if (!canAcceptRegistration(tournament.status)) {
      return (
        getRegistrationBlockMessage(tournament.status) ??
        "Inscrições indisponíveis."
      );
    }

    if (!selectedCaptain?.userId) {
      return "Selecione o capitão da equipe.";
    }

    if (selectedCaptain.userId !== uid) {
      return "O capitão da equipe precisa ser a conta ConnectFish atualmente logada.";
    }

    if (!compactSpaces(teamName) || compactSpaces(teamName).length < 3) {
      return "Informe um nome de equipe válido com pelo menos 3 caracteres.";
    }

    if (!acceptedTerms) {
      return "Você precisa aceitar os termos para continuar.";
    }

    return null;
  }

  async function handleCreateTeamAndPay() {
    if (!tournament || !selectedCaptain?.userId) return;

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const validationError = validateForm();

      if (validationError) {
        setError(validationError);
        return;
      }

      setMessage("Criando sua equipe...");

      const createTeamResponse = await fetch("/api/tournaments/team/create", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tournamentId: tournament.id,
          teamName: compactSpaces(teamName),
          captain: {
            userId: selectedCaptain.userId,
            name: selectedCaptain.username || selectedCaptain.email || "",
            email: selectedCaptain.email || "",
          },
          members: selectedMembers.map((member) => ({
            userId: member.userId,
            name: member.username || member.email || "",
            email: member.email || null,
          })),
          source: "public_tournament_web",
        }),
      });

      const createTeamData = (await createTeamResponse.json()) as CreateTeamResponse;

      if (
        !createTeamResponse.ok ||
        !createTeamData.success ||
        !createTeamData.teamId
      ) {
        throw new Error(createTeamData.message || "Não foi possível criar a equipe.");
      }

      setMessage("Equipe criada. Preparando o pagamento do capitão...");

      const paymentResponse = await fetch(
        "/api/mercadopago/create-member-preference",
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tournamentId: tournament.id,
            teamId: createTeamData.teamId,
            source: "public_tournament_web",
          }),
        }
      );

      const paymentData =
        (await paymentResponse.json()) as CreateMemberPreferenceResponse;

      if (!paymentResponse.ok || !paymentData.success) {
        throw new Error(
          paymentData.message || "Não foi possível iniciar o pagamento do capitão."
        );
      }

      if (!paymentData.checkoutUrl) {
        throw new Error("O checkout individual não retornou uma URL válida.");
      }

      setMessage("Redirecionando para o pagamento do capitão...");
      window.location.assign(paymentData.checkoutUrl);
    } catch (err) {
      console.error("Erro ao criar equipe e iniciar pagamento:", err);
      setMessage(null);
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível concluir a criação da equipe."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <AppSessionBridge />
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
          <AppSessionBridge />
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
          <AppSessionBridge />
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
        <AppSessionBridge />

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
                label="Valor por participante"
                value={formatMoney(tournament.entryFee, tournament.currency)}
              />
            </div>
          </div>
        </section>

        <section style={styles.twoColumnGrid}>
          <div style={styles.leftColumn}>
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
          </div>

          <aside style={styles.rightColumn}>
            <section style={styles.checkoutCard}>
              <div style={styles.checkoutTop}>
                <div>
                  <span style={styles.checkoutEyebrow}>Equipe e pagamento</span>
                  <h2 style={styles.checkoutTitle}>Criar minha equipe</h2>
                  <p style={styles.sectionText}>
                    Para participar deste torneio, é obrigatório ter uma conta
                    ConnectFish. Com sua conta, você cria a equipe, define o
                    capitão, recebe convites e registra capturas no app.
                  </p>
                </div>

                <div style={styles.priceCard}>
                  <span style={styles.priceLabel}>Valor por participante</span>
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

              {!isLoggedIn ? (
                <div style={styles.loginBox}>
                  <p style={styles.loginTitle}>Conta ConnectFish obrigatória</p>
                  <p style={styles.loginText}>
                    Para realizar a inscrição, é obrigatório ter uma conta
                    ConnectFish. Faça login para continuar ou crie sua conta
                    agora.
                  </p>

                  <div style={styles.loginActions}>
                    <button
                      type="button"
                      onClick={goToLogin}
                      style={styles.primaryButton}
                    >
                      Entrar na minha conta
                    </button>

                    <button
                      type="button"
                      onClick={goToSignup}
                      style={styles.secondaryButton}
                    >
                      Criar conta ConnectFish
                    </button>
                  </div>
                </div>
              ) : null}

              <div style={styles.checkoutSection}>
                <p style={styles.checkoutSectionTitle}>Capitão da equipe</p>

                {!selectedCaptain ? (
                  <>
                    <Field label="Buscar capitão por @username">
                      <input
                        type="text"
                        value={captainQuery}
                        onChange={(e) => {
                          clearFeedback();
                          setCaptainQuery(e.target.value.replace(/^@+/, ""));
                        }}
                        style={styles.input}
                        placeholder="Ex.: pescador_sp"
                        disabled={isFormDisabled}
                        maxLength={40}
                      />
                    </Field>

                    {searchingCaptain ? (
                      <p style={styles.helperText}>Buscando capitão...</p>
                    ) : null}

                    {captainResults.length > 0 ? (
                      <div style={styles.searchResults}>
                        {captainResults.map((user) => (
                          <button
                            key={user.userId}
                            type="button"
                            onClick={() => selectCaptain(user)}
                            style={styles.searchResultButton}
                            disabled={isFormDisabled}
                          >
                            <span style={styles.searchResultUsername}>
                              @{user.username}
                            </span>
                            <span style={styles.searchResultMeta}>
                              {user.email || "Usuário ConnectFish"}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p style={styles.helperText}>
                        O capitão da equipe deve ser a conta ConnectFish logada.
                      </p>
                    )}
                  </>
                ) : (
                  <div style={styles.captainCard}>
                    <div style={styles.captainAvatar}>
                      {selectedCaptain.username?.charAt(0)?.toUpperCase() || "@"}
                    </div>

                    <div style={styles.captainInfo}>
                      <strong style={styles.captainName}>
                        @{selectedCaptain.username}
                      </strong>
                      <span style={styles.captainUsername}>
                        {selectedCaptain.email || "Capitão selecionado"}
                      </span>
                      <span style={styles.captainMeta}>
                        Capitão responsável pela equipe
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={clearCaptain}
                      style={styles.removeMemberButton}
                      disabled={isFormDisabled}
                    >
                      Recarregar
                    </button>
                  </div>
                )}
              </div>

              <div style={styles.checkoutSection}>
                <p style={styles.checkoutSectionTitle}>Dados da equipe</p>

                <div style={styles.formGrid}>
                  <Field label="Nome da equipe *">
                    <input
                      type="text"
                      value={teamName}
                      onChange={(e) => {
                        clearFeedback();
                        setTeamName(e.target.value);
                      }}
                      style={styles.input}
                      placeholder="Ex.: Tucuna Hunters"
                      disabled={isFormDisabled}
                      maxLength={60}
                    />
                  </Field>
                </div>
              </div>

              <div style={styles.checkoutSection}>
                <p style={styles.checkoutSectionTitle}>Convidar membros</p>

                <Field label="Buscar por @username">
                  <input
                    type="text"
                    value={memberQuery}
                    onChange={(e) => {
                      clearFeedback();
                      setMemberQuery(e.target.value.replace(/^@+/, ""));
                    }}
                    style={styles.input}
                    placeholder="Ex.: pescador_sp"
                    disabled={
                      isFormDisabled || selectedMembers.length >= maxAdditionalMembers
                    }
                    maxLength={40}
                  />
                </Field>

                {searchingMembers ? (
                  <p style={styles.helperText}>Buscando usuários...</p>
                ) : null}

                {memberResults.length > 0 ? (
                  <div style={styles.searchResults}>
                    {memberResults.map((user) => (
                      <button
                        key={user.userId}
                        type="button"
                        onClick={() => addMember(user)}
                        style={styles.searchResultButton}
                        disabled={isFormDisabled}
                      >
                        <span style={styles.searchResultUsername}>
                          @{user.username}
                        </span>
                        <span style={styles.searchResultMeta}>
                          {user.email || "Usuário ConnectFish"}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}

                <div style={styles.selectedMembersBox}>
                  <p style={styles.selectedMembersTitle}>
                    Membros adicionados ({selectedMembers.length}/{maxAdditionalMembers})
                  </p>

                  {selectedMembers.length === 0 ? (
                    <p style={styles.helperText}>
                      Você pode convidar até {maxAdditionalMembers} membros para a equipe.
                    </p>
                  ) : (
                    <div style={styles.selectedMembersList}>
                      {selectedMembers.map((member) => (
                        <div key={member.userId} style={styles.selectedMemberRow}>
                          <div style={styles.selectedMemberInfo}>
                            <strong style={styles.selectedMemberUsername}>
                              @{member.username}
                            </strong>
                            <span style={styles.selectedMemberMeta}>
                              Convite pendente após criação da equipe
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeMember(member.userId)}
                            style={styles.removeMemberButton}
                            disabled={isFormDisabled}
                          >
                            Remover
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div style={styles.checkoutSection}>
                <p style={styles.checkoutSectionTitle}>Resumo da inscrição</p>

                <div style={styles.summaryCard}>
                  <SummaryRow label="Torneio" value={tournament.title} />
                  <SummaryRow
                    label="Equipe"
                    value={compactSpaces(teamName) || "A informar"}
                  />
                  <SummaryRow
                    label="Capitão"
                    value={
                      selectedCaptain?.username
                        ? `@${selectedCaptain.username}`
                        : "Faça login para definir o capitão"
                    }
                  />
                  <SummaryRow
                    label="Membros convidados"
                    value={String(selectedMembers.length)}
                  />
                  <SummaryRow
                    label="Pagamento do capitão"
                    value={formatMoney(tournament.entryFee, tournament.currency)}
                  />
                  <SummaryRow
                    label="Demais membros"
                    value="Pagamento individual após aceite"
                    highlight
                  />
                </div>
              </div>

              <div style={styles.checkoutSection}>
                <p style={styles.checkoutSectionTitle}>Como funciona agora</p>

                <div style={styles.processingBox}>
                  <div style={styles.paymentInfoList}>
                    <div style={styles.paymentInfoRow}>
                      <span style={styles.paymentInfoDot}>1</span>
                      <span style={styles.paymentInfoText}>
                        Faça login ou crie sua conta ConnectFish.
                      </span>
                    </div>
                    <div style={styles.paymentInfoRow}>
                      <span style={styles.paymentInfoDot}>2</span>
                      <span style={styles.paymentInfoText}>
                        A conta logada será usada como capitão da equipe.
                      </span>
                    </div>
                    <div style={styles.paymentInfoRow}>
                      <span style={styles.paymentInfoDot}>3</span>
                      <span style={styles.paymentInfoText}>
                        Adicione os membros por @username e envie os convites.
                      </span>
                    </div>
                    <div style={styles.paymentInfoRow}>
                      <span style={styles.paymentInfoDot}>4</span>
                      <span style={styles.paymentInfoText}>
                        O capitão paga agora e os demais membros pagam após aceitarem.
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {highlightedRules.length > 0 ? (
                <div style={styles.checkoutSection}>
                  <p style={styles.checkoutSectionTitle}>
                    Resumo rápido das regras
                  </p>

                  <div style={styles.miniRulesList}>
                    {highlightedRules.map((rule, index) => (
                      <div key={`${rule}-${index}`} style={styles.miniRuleItem}>
                        <span style={styles.miniRuleDot}>•</span>
                        <span style={styles.miniRuleText}>{rule}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <label style={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => {
                    clearFeedback();
                    setAcceptedTerms(e.target.checked);
                  }}
                  disabled={isFormDisabled}
                />
                <span style={styles.checkboxText}>
                  Confirmo que os dados da equipe estão corretos e aceito seguir
                  para a criação da equipe e para o pagamento individual do capitão.
                </span>
              </label>

              <div style={styles.actionsColumn}>
                <button
                  type="button"
                  onClick={handleCreateTeamAndPay}
                  disabled={isFormDisabled}
                  style={{
                    ...styles.primaryButton,
                    ...(isFormDisabled ? styles.disabledButton : {}),
                  }}
                >
                  {saving ? "Criando equipe..." : "Criar equipe e pagar inscrição do capitão"}
                </button>

                {!isLoggedIn ? (
                  <p style={styles.securityText}>
                    Ao criar sua conta ConnectFish, você volta para este torneio
                    e pode concluir a inscrição normalmente.
                  </p>
                ) : (
                  <p style={styles.securityText}>
                    Os demais participantes receberão convite e pagarão a própria
                    inscrição após aceitarem entrar na equipe.
                  </p>
                )}
              </div>

              {message ? <p style={styles.successText}>{message}</p> : null}
              {error ? <p style={styles.errorText}>{error}</p> : null}
            </section>
          </aside>
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
  children: ReactNode;
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

function SummaryRow({
  label,
  value,
  total = false,
  highlight = false,
}: {
  label: string;
  value: string;
  total?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        ...styles.summaryRow,
        ...(total ? styles.summaryRowTotal : {}),
      }}
    >
      <span
        style={{
          ...styles.summaryLabel,
          ...(highlight ? styles.summaryLabelHighlight : {}),
          ...(total ? styles.summaryLabelTotal : {}),
        }}
      >
        {label}
      </span>

      <span
        style={{
          ...styles.summaryValue,
          ...(highlight ? styles.summaryValueHighlight : {}),
          ...(total ? styles.summaryValueTotal : {}),
        }}
      >
        {value}
      </span>
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
    maxWidth: 1220,
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: 18,
  },
  heroCard: {
    background: "#FFFFFF",
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 26,
    overflow: "hidden",
    boxShadow: "0 14px 30px rgba(15,23,42,0.05)",
  },
  cover: {
    width: "100%",
    height: 280,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundColor: "#E2E8F0",
  },
  heroContent: {
    padding: 24,
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
    lineHeight: 1.1,
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
  twoColumnGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(340px, 430px)",
    gap: 18,
    alignItems: "start",
  },
  leftColumn: {
    display: "flex",
    flexDirection: "column",
    gap: 18,
  },
  rightColumn: {
    position: "relative",
  },
  card: {
    background: "#FFFFFF",
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 22,
    padding: 22,
    boxShadow: "0 10px 24px rgba(15,23,42,0.04)",
  },
  checkoutCard: {
    background: "#FFFFFF",
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 24,
    padding: 22,
    boxShadow: "0 18px 34px rgba(15,23,42,0.06)",
    position: "sticky",
    top: 24,
    display: "flex",
    flexDirection: "column",
    gap: 18,
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
    borderRadius: 16,
    padding: 14,
    border: "1px solid rgba(15,23,42,0.06)",
  },
  infoLabel: {
    margin: 0,
    fontSize: 12,
    fontWeight: 800,
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.2,
  },
  infoValue: {
    margin: "8px 0 0 0",
    fontSize: 15,
    fontWeight: 900,
    color: "#0F172A",
    lineHeight: 1.5,
  },
  rulesList: {
    marginTop: 14,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  ruleRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
  },
  ruleDot: {
    color: "#1D4ED8",
    fontWeight: 1000,
    lineHeight: 1.6,
  },
  ruleText: {
    color: "#334155",
    fontSize: 14,
    fontWeight: 700,
    lineHeight: 1.7,
  },
  checkoutTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
  },
  checkoutEyebrow: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: 999,
    background: "#DBEAFE",
    color: "#1D4ED8",
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  checkoutTitle: {
    margin: "10px 0 0 0",
    fontSize: 24,
    fontWeight: 1000,
    color: "#0F172A",
  },
  priceCard: {
    minWidth: 150,
    background: "#F8FAFC",
    borderRadius: 16,
    padding: 16,
    border: "1px solid rgba(15,23,42,0.06)",
  },
  priceLabel: {
    display: "block",
    color: "#64748B",
    fontSize: 12,
    fontWeight: 800,
    marginBottom: 6,
  },
  priceValue: {
    color: "#0B3C5D",
    fontSize: 22,
    fontWeight: 1000,
    lineHeight: 1.1,
  },
  warningBox: {
    background: "#FFF7ED",
    border: "1px solid #FED7AA",
    borderRadius: 16,
    padding: 14,
  },
  warningTitle: {
    margin: 0,
    color: "#9A3412",
    fontSize: 14,
    fontWeight: 900,
  },
  warningText: {
    margin: "8px 0 0 0",
    color: "#9A3412",
    fontSize: 13,
    fontWeight: 700,
    lineHeight: 1.6,
  },
  loginBox: {
    background: "#EFF6FF",
    border: "1px solid #BFDBFE",
    borderRadius: 16,
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  loginTitle: {
    margin: 0,
    color: "#1E3A8A",
    fontSize: 15,
    fontWeight: 900,
  },
  loginText: {
    margin: 0,
    color: "#1D4ED8",
    fontSize: 13,
    fontWeight: 700,
    lineHeight: 1.6,
  },
  loginActions: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  checkoutSection: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  checkoutSectionTitle: {
    margin: 0,
    color: "#0F172A",
    fontSize: 15,
    fontWeight: 900,
  },
  captainCard: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    background: "#F8FAFC",
    borderRadius: 16,
    padding: 16,
    border: "1px solid rgba(15,23,42,0.06)",
  },
  captainAvatar: {
    width: 44,
    height: 44,
    borderRadius: 999,
    background: "#DBEAFE",
    color: "#1D4ED8",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
    fontWeight: 1000,
    flexShrink: 0,
  },
  captainInfo: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    flex: 1,
    minWidth: 0,
  },
  captainName: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: 900,
  },
  captainUsername: {
    color: "#1D4ED8",
    fontSize: 13,
    fontWeight: 900,
  },
  captainMeta: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: 700,
    lineHeight: 1.5,
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr",
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
  helperText: {
    margin: 0,
    color: "#64748B",
    fontSize: 13,
    fontWeight: 700,
    lineHeight: 1.5,
  },
  searchResults: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  searchResultButton: {
    border: "1px solid rgba(15,23,42,0.08)",
    background: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    display: "flex",
    flexDirection: "column",
    gap: 4,
    cursor: "pointer",
    textAlign: "left",
  },
  searchResultUsername: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: 900,
  },
  searchResultMeta: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: 700,
  },
  selectedMembersBox: {
    background: "#F8FAFC",
    borderRadius: 16,
    padding: 16,
    border: "1px solid rgba(15,23,42,0.06)",
  },
  selectedMembersTitle: {
    margin: 0,
    color: "#0F172A",
    fontSize: 13,
    fontWeight: 900,
  },
  selectedMembersList: {
    marginTop: 12,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  selectedMemberRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    background: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    border: "1px solid rgba(15,23,42,0.06)",
  },
  selectedMemberInfo: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  selectedMemberUsername: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: 900,
  },
  selectedMemberMeta: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: 700,
  },
  removeMemberButton: {
    border: "none",
    background: "#FEE2E2",
    color: "#B91C1C",
    borderRadius: 10,
    padding: "8px 10px",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
    flexShrink: 0,
  },
  summaryCard: {
    background: "#F8FAFC",
    borderRadius: 16,
    padding: 16,
    border: "1px solid rgba(15,23,42,0.06)",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  summaryRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  summaryRowTotal: {
    paddingTop: 10,
    marginTop: 4,
    borderTop: "1px solid rgba(15,23,42,0.08)",
  },
  summaryLabel: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: 800,
  },
  summaryValue: {
    color: "#0F172A",
    fontSize: 13,
    fontWeight: 900,
    textAlign: "right",
  },
  summaryLabelHighlight: {
    color: "#1D4ED8",
  },
  summaryValueHighlight: {
    color: "#1D4ED8",
  },
  summaryLabelTotal: {
    fontSize: 14,
    color: "#0F172A",
  },
  summaryValueTotal: {
    fontSize: 18,
    color: "#0B3C5D",
  },
  checkboxRow: {
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
  processingBox: {
    background: "#F8FAFC",
    borderRadius: 16,
    padding: 16,
    border: "1px solid rgba(15,23,42,0.06)",
  },
  paymentInfoList: {
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
    fontSize: 12,
    fontWeight: 1000,
    flexShrink: 0,
  },
  paymentInfoText: {
    color: "#475569",
    fontSize: 13,
    fontWeight: 700,
    lineHeight: 1.6,
  },
  miniRulesList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  miniRuleItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
  },
  miniRuleDot: {
    color: "#1D4ED8",
    fontWeight: 1000,
    lineHeight: 1.6,
  },
  miniRuleText: {
    color: "#475569",
    fontSize: 13,
    fontWeight: 700,
    lineHeight: 1.6,
  },
  actionsColumn: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  primaryButton: {
    border: "none",
    borderRadius: 14,
    padding: "14px 18px",
    background: "#0B3C5D",
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: 1000,
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 14,
    padding: "12px 16px",
    background: "#FFFFFF",
    color: "#0F172A",
    fontSize: 14,
    fontWeight: 900,
    cursor: "pointer",
  },
  disabledButton: {
    opacity: 0.55,
    cursor: "not-allowed",
  },
  securityText: {
    margin: 0,
    color: "#64748B",
    fontSize: 12,
    fontWeight: 700,
    lineHeight: 1.6,
  },
  successText: {
    margin: 0,
    color: "#166534",
    fontSize: 13,
    fontWeight: 900,
  },
  errorText: {
    margin: 0,
    color: "#B91C1C",
    fontSize: 13,
    fontWeight: 900,
    lineHeight: 1.6,
  },
};
