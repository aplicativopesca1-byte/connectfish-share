"use client";

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { useRouter, useSearchParams } from "next/navigation";
import { db } from "../../../../src/lib/firebase";
import { useAuth } from "@/context/AuthContext";

type Props = {
  mode: "create" | "edit";
  tournamentId?: string;
  currentUserId?: string;
};

type TournamentStatus = "draft" | "scheduled" | "live" | "finished";
type TournamentVisibility = "draft" | "published";
type SetupStep = 1 | 2 | 3;

type FirestoreTimestampLike = {
  toDate?: () => Date;
};

type LatLng = {
  latitude: number;
  longitude: number;
};

type CircleBoundary = {
  type: "circle";
  center: LatLng;
  radiusM: number;
};

type PolygonBoundary = {
  type: "polygon";
  points: LatLng[];
};

type TournamentBoundary = CircleBoundary | PolygonBoundary | null;

type TournamentDoc = {
  title?: string;
  subtitle?: string | null;
  slug?: string | null;
  location?: string;
  description?: string | null;
  coverImageUrl?: string | null;
  species?: string;
  entryFee?: number;
  currency?: string | null;
  minSizeCm?: number;
  validFishCount?: number;
  rules?: string[];
  status?: TournamentStatus;
  visibility?: TournamentVisibility;
  setupStep?: number;
  basicsCompleted?: boolean;
  boundaryCompleted?: boolean;
  publishReady?: boolean;
  missingFields?: string[];
  scheduledStartAt?: unknown;
  scheduledEndAt?: unknown;
  registrationUrl?: string | null;
  adminUrl?: string | null;
  boundaryEnabled?: boolean;

  // formato novo
  boundary?: TournamentBoundary;

  // compatibilidade com formato antigo
  boundaryType?: string | null;
  boundaryCenter?: LatLng | null;
  boundaryRadiusM?: number | null;
  boundaryPolygonPoints?: LatLng[] | null;

  publishedAt?: unknown;
  startedAt?: unknown;
  finishedAt?: unknown;
};

type BoundarySummary = {
  enabled: boolean;
  type: "circle" | "polygon" | null;
  center: LatLng | null;
  radiusM: number | null;
  polygonPointsCount: number;
  isConfigured: boolean;
};

function safeTrim(value: unknown) {
  return String(value ?? "").trim();
}

function toDateTimeLocalInput(value: unknown): string {
  if (!value) return "";

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as FirestoreTimestampLike).toDate === "function"
  ) {
    const date = (value as FirestoreTimestampLike).toDate?.();
    if (!date || Number.isNaN(date.getTime())) return "";
    return formatDateForInput(date);
  }

  if (typeof value === "string") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return formatDateForInput(date);
    }
  }

  return "";
}

function toIsoStringSafe(value: unknown): string | null {
  if (!value) return null;

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as FirestoreTimestampLike).toDate === "function"
  ) {
    const date = (value as FirestoreTimestampLike).toDate?.();
    if (!date || Number.isNaN(date.getTime())) return null;
    return date.toISOString();
  }

  if (typeof value === "string") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }

  return null;
}

function formatDateForInput(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");

  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());

  return `${year}-${month}-${day}T${hours}:${minutes}`;
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

function formatMoney(value: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  }).format(Number(value || 0));
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function parseRules(text: string) {
  return text
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getStatusLabel(status: TournamentStatus) {
  if (status === "live") return "Ao vivo";
  if (status === "finished") return "Finalizado";
  if (status === "scheduled") return "Publicado";
  return "Rascunho";
}

function getStatusBadgeStyle(status: TournamentStatus): CSSProperties {
  if (status === "live") {
    return {
      ...styles.statusBadge,
      background: "#DCFCE7",
      color: "#166534",
    };
  }

  if (status === "finished") {
    return {
      ...styles.statusBadge,
      background: "#E5E7EB",
      color: "#374151",
    };
  }

  if (status === "scheduled") {
    return {
      ...styles.statusBadge,
      background: "#FEF3C7",
      color: "#92400E",
    };
  }

  return {
    ...styles.statusBadge,
    background: "#DBEAFE",
    color: "#1D4ED8",
  };
}

function parseLatLng(value: unknown): LatLng | null {
  if (!value || typeof value !== "object") return null;

  const raw = value as Record<string, unknown>;
  const latitude = Number(raw.latitude);
  const longitude = Number(raw.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  return { latitude, longitude };
}

function parsePolygonPoints(value: unknown): LatLng[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => parseLatLng(item))
    .filter(Boolean) as LatLng[];
}

function calculatePolygonCenter(points: LatLng[]): LatLng | null {
  if (!Array.isArray(points) || points.length === 0) return null;

  const sum = points.reduce(
    (acc, point) => {
      acc.latitude += point.latitude;
      acc.longitude += point.longitude;
      return acc;
    },
    { latitude: 0, longitude: 0 }
  );

  return {
    latitude: sum.latitude / points.length,
    longitude: sum.longitude / points.length,
  };
}

function buildBoundarySummary(data: TournamentDoc): BoundarySummary {
  const enabled = data.boundaryEnabled !== false;

  if (!enabled) {
    return {
      enabled: false,
      type: null,
      center: null,
      radiusM: null,
      polygonPointsCount: 0,
      isConfigured: true,
    };
  }

  // 1) formato novo: boundary
  const boundary = data.boundary;

  if (boundary?.type === "circle") {
    const center = parseLatLng(boundary.center);
    const radiusM =
      boundary.radiusM !== undefined && boundary.radiusM !== null
        ? Number(boundary.radiusM)
        : null;

    return {
      enabled: true,
      type: "circle",
      center,
      radiusM,
      polygonPointsCount: 0,
      isConfigured: !!center && !!radiusM && radiusM > 0,
    };
  }

  if (boundary?.type === "polygon") {
    const points = parsePolygonPoints(boundary.points);

    return {
      enabled: true,
      type: "polygon",
      center: calculatePolygonCenter(points),
      radiusM: null,
      polygonPointsCount: points.length,
      isConfigured: points.length >= 3,
    };
  }

  // 2) fallback para formato antigo
  const typeRaw = safeTrim(data.boundaryType).toLowerCase();
  const type =
    typeRaw === "circle" || typeRaw === "polygon"
      ? (typeRaw as "circle" | "polygon")
      : null;

  const center = parseLatLng(data.boundaryCenter);
  const radiusM =
    data.boundaryRadiusM !== undefined && data.boundaryRadiusM !== null
      ? Number(data.boundaryRadiusM)
      : null;
  const polygonPoints = parsePolygonPoints(data.boundaryPolygonPoints);

  const isConfigured =
    type === "circle"
      ? !!center && !!radiusM && radiusM > 0
      : type === "polygon"
      ? polygonPoints.length >= 3
      : false;

  return {
    enabled: true,
    type,
    center,
    radiusM,
    polygonPointsCount: polygonPoints.length,
    isConfigured,
  };
}

function getStepFromSearchParam(raw: string | null): SetupStep {
  if (raw === "2") return 2;
  if (raw === "3") return 3;
  return 1;
}

export default function TournamentForm({
  mode,
  tournamentId,
  currentUserId,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const { uid, email, loading: authLoading } = useAuth() as {
    uid?: string | null;
    email?: string | null;
    loading?: boolean;
  };

  const isEdit = mode === "edit";
  const searchStep = getStepFromSearchParam(searchParams.get("step"));

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState<SetupStep>(searchStep);

  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [slug, setSlug] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [species, setSpecies] = useState("");
  const [entryFee, setEntryFee] = useState<number>(0);
  const [currency, setCurrency] = useState("BRL");
  const [minSizeCm, setMinSizeCm] = useState<number>(30);
  const [validFishCount, setValidFishCount] = useState<number>(3);
  const [rulesText, setRulesText] = useState("");
  const [status, setStatus] = useState<TournamentStatus>("draft");
  const [visibility, setVisibility] = useState<TournamentVisibility>("draft");
  const [scheduledStartAt, setScheduledStartAt] = useState("");
  const [scheduledEndAt, setScheduledEndAt] = useState("");
  const [boundaryEnabled, setBoundaryEnabled] = useState(true);

  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [finishedAt, setFinishedAt] = useState<string | null>(null);

  const [boundarySummary, setBoundarySummary] = useState<BoundarySummary>({
    enabled: true,
    type: null,
    center: null,
    radiusM: null,
    polygonPointsCount: 0,
    isConfigured: false,
  });

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generatedSlug = useMemo(() => slugify(title), [title]);
  const resolvedUserId = String(uid || currentUserId || "").trim();
  const resolvedUserName = String(email || "Organizador").trim();
  const finalSlugPreview = slug.trim() || generatedSlug;

  const isOperationallyLocked =
    isEdit && (status === "live" || status === "finished");
  const canEditStructure = !isOperationallyLocked;

  const parsedRules = useMemo(() => parseRules(rulesText), [rulesText]);

  const basicsValidation = useMemo(() => {
    const missing: string[] = [];

    if (!title.trim()) missing.push("Nome do torneio");
    if (!finalSlugPreview.trim()) missing.push("Slug público");
    if (!location.trim()) missing.push("Local");
    if (!description.trim()) missing.push("Descrição");
    if (!species.trim()) missing.push("Espécie");
    if (Number(entryFee) < 0) missing.push("Valor da inscrição inválido");
    if (Number(minSizeCm) < 0) missing.push("Tamanho mínimo inválido");
    if (Number(validFishCount) < 1) missing.push("Quantidade de peixes válidos");
    if (parsedRules.length === 0) missing.push("Regras do torneio");
    if (!scheduledStartAt) missing.push("Início programado");
    if (!scheduledEndAt) missing.push("Fim programado");

    if (scheduledStartAt && scheduledEndAt) {
      const start = new Date(scheduledStartAt).getTime();
      const end = new Date(scheduledEndAt).getTime();

      if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
        missing.push("Período do torneio inválido");
      }
    }

    return {
      valid: missing.length === 0,
      missing,
    };
  }, [
    title,
    finalSlugPreview,
    location,
    description,
    species,
    entryFee,
    minSizeCm,
    validFishCount,
    parsedRules,
    scheduledStartAt,
    scheduledEndAt,
  ]);

  const reviewChecklist = useMemo(() => {
    const items = [
      {
        label: "Informações principais completas",
        ok: basicsValidation.valid,
      },
      {
        label: boundaryEnabled
          ? "Perímetro configurado"
          : "Perímetro desativado pelo organizador",
        ok: boundaryEnabled ? boundarySummary.isConfigured : true,
      },
      {
        label: "Slug público pronto",
        ok: !!finalSlugPreview.trim(),
      },
      {
        label: "Torneio em rascunho antes de publicar",
        ok: status === "draft" || status === "scheduled",
      },
    ];

    const missingFields: string[] = [
      ...basicsValidation.missing,
      ...(boundaryEnabled && !boundarySummary.isConfigured
        ? ["Perímetro do torneio"]
        : []),
    ];

    return {
      items,
      publishReady: missingFields.length === 0,
      missingFields,
    };
  }, [
    basicsValidation,
    boundaryEnabled,
    boundarySummary.isConfigured,
    finalSlugPreview,
    status,
  ]);

  useEffect(() => {
    setCurrentStep(searchStep);
  }, [searchStep]);

  useEffect(() => {
    if (!isEdit || !tournamentId) return;
    void loadTournament();
  }, [isEdit, tournamentId]);

  function clearFeedback() {
    if (message) setMessage(null);
    if (error) setError(null);
  }

  async function loadTournament() {
    setLoading(true);
    setError(null);

    try {
      const ref = doc(db, "tournaments", tournamentId!);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        setError("Torneio não encontrado.");
        return;
      }

      const data = snap.data() as TournamentDoc;

      setTitle(data.title || "");
      setSubtitle(data.subtitle || "");
      setSlug(data.slug || "");
      setLocation(data.location || "");
      setDescription(data.description || "");
      setCoverImageUrl(data.coverImageUrl || "");
      setSpecies(data.species || "");
      setEntryFee(Number(data.entryFee ?? 0) || 0);
      setCurrency(safeTrim(data.currency).toUpperCase() || "BRL");
      setMinSizeCm(Number(data.minSizeCm ?? 30) || 30);
      setValidFishCount(Number(data.validFishCount ?? 3) || 3);
      setRulesText(Array.isArray(data.rules) ? data.rules.join("\n") : "");
      setStatus(data.status || "draft");
      setVisibility(data.visibility || "draft");
      setScheduledStartAt(toDateTimeLocalInput(data.scheduledStartAt));
      setScheduledEndAt(toDateTimeLocalInput(data.scheduledEndAt));
      setBoundaryEnabled(data.boundaryEnabled !== false);
      setPublishedAt(toIsoStringSafe(data.publishedAt));
      setStartedAt(toIsoStringSafe(data.startedAt));
      setFinishedAt(toIsoStringSafe(data.finishedAt));
      setBoundarySummary(buildBoundarySummary(data));
    } catch (err) {
      console.error("Erro ao carregar torneio:", err);
      setError("Não foi possível carregar os dados do torneio.");
    } finally {
      setLoading(false);
    }
  }

  function getBasePayload() {
    return {
      title: title.trim(),
      subtitle: subtitle.trim() || null,
      slug: finalSlugPreview || null,
      location: location.trim(),
      description: description.trim() || null,
      coverImageUrl: coverImageUrl.trim() || null,
      species: species.trim(),
      entryFee: Number(entryFee || 0),
      currency: safeTrim(currency).toUpperCase() || "BRL",
      minSizeCm: Number(minSizeCm || 0),
      validFishCount: Number(validFishCount || 0),
      rules: parsedRules,
      scheduledStartAt: scheduledStartAt ? new Date(scheduledStartAt) : null,
      scheduledEndAt: scheduledEndAt ? new Date(scheduledEndAt) : null,
      boundaryEnabled,
      updatedAt: serverTimestamp(),
    };
  }

  async function createDraftTournament(stepAfterCreate: SetupStep) {
    if (authLoading) {
      throw new Error("Aguardando identificação do usuário.");
    }

    if (!resolvedUserId) {
      throw new Error("Usuário não identificado para criar o torneio.");
    }

    const ref = await addDoc(collection(db, "tournaments"), {
      ...getBasePayload(),
      status: "draft",
      visibility: "draft",
      setupStep: stepAfterCreate,
      basicsCompleted: basicsValidation.valid,
      boundaryCompleted: boundaryEnabled ? boundarySummary.isConfigured : true,
      publishReady: false,
      missingFields: reviewChecklist.missingFields,
      createdBy: resolvedUserId,
      createdByName: resolvedUserName,
      createdAt: serverTimestamp(),
    });

    return ref.id;
  }

  async function saveDraft(options?: {
    nextStep?: SetupStep;
    successMessage?: string;
    redirectToStep?: boolean;
  }) {
    clearFeedback();
    setSaving(true);

    try {
      const nextStep = options?.nextStep ?? currentStep;

      if (isEdit && tournamentId) {
        const ref = doc(db, "tournaments", tournamentId);

        await updateDoc(ref, {
          ...getBasePayload(),
          status: "draft",
          visibility: "draft",
          setupStep: nextStep,
          basicsCompleted: basicsValidation.valid,
          boundaryCompleted: boundaryEnabled ? boundarySummary.isConfigured : true,
          publishReady: false,
          missingFields: reviewChecklist.missingFields,
        });

        setStatus("draft");
        setVisibility("draft");
        setMessage(options?.successMessage || "Rascunho salvo com sucesso.");

        if (options?.redirectToStep) {
          router.push(`/seller/tournaments/${tournamentId}/edit?step=${nextStep}`);
        } else {
          setCurrentStep(nextStep);
        }

        return tournamentId;
      }

      const newTournamentId = await createDraftTournament(nextStep);
      setMessage(options?.successMessage || "Rascunho criado com sucesso.");
      router.push(`/seller/tournaments/${newTournamentId}/edit?step=${nextStep}`);
      return newTournamentId;
    } catch (err) {
      console.error("Erro ao salvar rascunho:", err);
      setError(
        err instanceof Error ? err.message : "Não foi possível salvar o rascunho."
      );
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handleContinueToBoundary() {
    clearFeedback();

    if (!canEditStructure) {
      setError("A estrutura do torneio está bloqueada para edição.");
      return;
    }

    if (!basicsValidation.valid) {
      setError(
        `Preencha os campos obrigatórios antes de avançar: ${basicsValidation.missing.join(
          ", "
        )}.`
      );
      return;
    }

    await saveDraft({
      nextStep: 2,
      successMessage: "Etapa 1 concluída. Agora configure o perímetro.",
      redirectToStep: true,
    });
  }

  function handleOpenBoundaryEditor() {
    clearFeedback();

    if (!isEdit || !tournamentId) {
      setError("Salve o torneio antes de abrir o editor de perímetro.");
      return;
    }

    router.push(`/seller/tournaments/${tournamentId}/map`);
  }

  async function handleContinueToReview() {
    clearFeedback();

    if (boundaryEnabled && !boundarySummary.isConfigured) {
      setError(
        "Configure o perímetro do torneio antes de seguir para a revisão final."
      );
      return;
    }

    await saveDraft({
      nextStep: 3,
      successMessage: "Etapa 2 concluída. Revise o torneio antes de publicar.",
      redirectToStep: true,
    });
  }

  async function handlePublishTournament() {
    clearFeedback();

    if (!isEdit || !tournamentId) {
      setError("Salve o torneio como rascunho antes de publicar.");
      return;
    }

    if (isOperationallyLocked) {
      setError("Este torneio não pode ser publicado novamente neste momento.");
      return;
    }

    if (!reviewChecklist.publishReady) {
      setError(
        `Ainda faltam itens obrigatórios para publicar: ${reviewChecklist.missingFields.join(
          ", "
        )}.`
      );
      return;
    }

    setSaving(true);

    try {
      const ref = doc(db, "tournaments", tournamentId);

      await updateDoc(ref, {
        ...getBasePayload(),
        status: "scheduled",
        visibility: "published",
        setupStep: 3,
        basicsCompleted: true,
        boundaryCompleted: boundaryEnabled ? boundarySummary.isConfigured : true,
        publishReady: true,
        missingFields: [],
        publishedAt: publishedAt ? new Date(publishedAt) : serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setStatus("scheduled");
      setVisibility("published");
      setMessage("Torneio publicado com sucesso.");
    } catch (err) {
      console.error("Erro ao publicar torneio:", err);
      setError("Não foi possível publicar o torneio.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.card}>
          <h1 style={styles.title}>
            {isEdit ? "Editar torneio" : "Criar torneio"}
          </h1>
          <p style={styles.muted}>Carregando dados do torneio...</p>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <section style={styles.heroCard}>
        <div style={styles.heroTop}>
          <div>
            <h1 style={styles.title}>
              {isEdit ? "Configuração do torneio" : "Novo torneio"}
            </h1>
            <p style={styles.sectionSub}>
              Crie em 3 etapas: informações principais, perímetro e revisão final.
            </p>
          </div>

          <div style={styles.heroBadges}>
            <span style={getStatusBadgeStyle(status)}>{getStatusLabel(status)}</span>
            <span
              style={
                visibility === "published"
                  ? styles.publishedBadge
                  : styles.draftBadge
              }
            >
              {visibility === "published"
                ? "Visível ao público"
                : "Apenas criador vê"}
            </span>
            {isOperationallyLocked ? (
              <span style={styles.lockBadge}>Edição estrutural bloqueada</span>
            ) : (
              <span style={styles.editBadge}>Edição liberada</span>
            )}
          </div>
        </div>

        <div style={styles.timelineGrid}>
          <PreviewCard label="Publicado em" value={formatDateTime(publishedAt)} />
          <PreviewCard label="Iniciado em" value={formatDateTime(startedAt)} />
          <PreviewCard label="Encerrado em" value={formatDateTime(finishedAt)} />
        </div>

        <div style={styles.stepsRow}>
          <StepPill
            active={currentStep === 1}
            done={basicsValidation.valid}
            step="1"
            label="Informações"
          />
          <StepPill
            active={currentStep === 2}
            done={boundaryEnabled ? boundarySummary.isConfigured : true}
            step="2"
            label="Perímetro"
          />
          <StepPill
            active={currentStep === 3}
            done={reviewChecklist.publishReady && visibility === "published"}
            step="3"
            label="Revisão"
          />
        </div>
      </section>

      {currentStep === 1 ? (
        <>
          <section style={styles.card}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>Etapa 1 · Informações principais</h2>
              <p style={styles.sectionSub}>
                Preencha toda a estrutura do torneio antes de seguir para o mapa.
              </p>
            </div>

            <div style={styles.formGrid}>
              <Field label="Nome do torneio *">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => {
                    clearFeedback();
                    setTitle(e.target.value);
                  }}
                  style={styles.input}
                  placeholder="Ex.: Torneio Tucunaré Master"
                  disabled={!canEditStructure}
                />
              </Field>

              <Field label="Subtítulo">
                <input
                  type="text"
                  value={subtitle}
                  onChange={(e) => {
                    clearFeedback();
                    setSubtitle(e.target.value);
                  }}
                  style={styles.input}
                  placeholder="Ex.: Etapa ConnectFish"
                  disabled={!canEditStructure}
                />
              </Field>

              <Field label="Slug público *">
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => {
                    clearFeedback();
                    setSlug(slugify(e.target.value));
                  }}
                  style={styles.input}
                  placeholder={generatedSlug || "torneio-tucunare-master"}
                  disabled={!canEditStructure}
                />
              </Field>

              <Field label="Local *">
                <input
                  type="text"
                  value={location}
                  onChange={(e) => {
                    clearFeedback();
                    setLocation(e.target.value);
                  }}
                  style={styles.input}
                  placeholder="Ex.: Rio Juruena - MT"
                  disabled={!canEditStructure}
                />
              </Field>
            </div>

            <Field label="Descrição *">
              <textarea
                value={description}
                onChange={(e) => {
                  clearFeedback();
                  setDescription(e.target.value);
                }}
                style={styles.textarea}
                placeholder="Explique rapidamente como será o torneio, o local e a operação."
                disabled={!canEditStructure}
              />
            </Field>

            <Field label="URL da capa">
              <input
                type="text"
                value={coverImageUrl}
                onChange={(e) => {
                  clearFeedback();
                  setCoverImageUrl(e.target.value);
                }}
                style={styles.input}
                placeholder="https://..."
                disabled={!canEditStructure}
              />
            </Field>
          </section>

          <section style={styles.card}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>Regras e critérios</h2>
              <p style={styles.sectionSub}>
                Esses dados alimentam ranking, validação e página pública.
              </p>
            </div>

            <div style={styles.formGrid}>
              <Field label="Espécie válida *">
                <input
                  type="text"
                  value={species}
                  onChange={(e) => {
                    clearFeedback();
                    setSpecies(e.target.value);
                  }}
                  style={styles.input}
                  placeholder="Ex.: Tucunaré"
                  disabled={!canEditStructure}
                />
              </Field>

              <Field label="Valor da inscrição (R$) *">
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={entryFee}
                  onChange={(e) => {
                    clearFeedback();
                    setEntryFee(Number(e.target.value));
                  }}
                  style={styles.input}
                  disabled={!canEditStructure}
                />
              </Field>

              <Field label="Moeda">
                <input
                  type="text"
                  value={currency}
                  onChange={(e) => {
                    clearFeedback();
                    setCurrency(e.target.value.toUpperCase());
                  }}
                  style={styles.input}
                  placeholder="BRL"
                  disabled={!canEditStructure}
                  maxLength={5}
                />
              </Field>

              <Field label="Tamanho mínimo (cm) *">
                <input
                  type="number"
                  min={0}
                  value={minSizeCm}
                  onChange={(e) => {
                    clearFeedback();
                    setMinSizeCm(Number(e.target.value));
                  }}
                  style={styles.input}
                  disabled={!canEditStructure}
                />
              </Field>

              <Field label="Quantidade de peixes válidos *">
                <input
                  type="number"
                  min={1}
                  value={validFishCount}
                  onChange={(e) => {
                    clearFeedback();
                    setValidFishCount(Number(e.target.value));
                  }}
                  style={styles.input}
                  disabled={!canEditStructure}
                />
              </Field>

              <Field label="Status operacional">
                <input
                  type="text"
                  value={getStatusLabel(status)}
                  style={styles.inputReadonly}
                  disabled
                  readOnly
                />
              </Field>
            </div>

            <Field label="Regras principais (uma por linha) *">
              <textarea
                value={rulesText}
                onChange={(e) => {
                  clearFeedback();
                  setRulesText(e.target.value);
                }}
                style={styles.textareaLarge}
                placeholder={`Valem os 3 maiores peixes da equipe.
Captura deve ser fotografada na régua oficial do torneio.
Somente o capitão envia capturas.
O ranking só atualiza após validação da organização.`}
                disabled={!canEditStructure}
              />
            </Field>
          </section>

          <section style={styles.card}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>Agenda</h2>
              <p style={styles.sectionSub}>
                Janela de funcionamento do torneio e período de inscrições.
              </p>
            </div>

            <div style={styles.formGrid}>
              <Field label="Início programado *">
                <input
                  type="datetime-local"
                  value={scheduledStartAt}
                  onChange={(e) => {
                    clearFeedback();
                    setScheduledStartAt(e.target.value);
                  }}
                  style={styles.input}
                  disabled={!canEditStructure}
                />
              </Field>

              <Field label="Fim programado *">
                <input
                  type="datetime-local"
                  value={scheduledEndAt}
                  onChange={(e) => {
                    clearFeedback();
                    setScheduledEndAt(e.target.value);
                  }}
                  style={styles.input}
                  disabled={!canEditStructure}
                />
              </Field>
            </div>
          </section>

          <section style={styles.card}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>Preview rápido</h2>
              <p style={styles.sectionSub}>
                Confira os dados principais antes de seguir para o perímetro.
              </p>
            </div>

            <div style={styles.previewGrid}>
              <PreviewCard label="Título" value={title || "—"} />
              <PreviewCard label="Slug" value={finalSlugPreview || "—"} />
              <PreviewCard label="Espécie" value={species || "—"} />
              <PreviewCard
                label="Inscrição"
                value={formatMoney(entryFee || 0, currency || "BRL")}
              />
              <PreviewCard label="Mínimo" value={`${minSizeCm || 0} cm`} />
              <PreviewCard
                label="Peixes válidos"
                value={String(validFishCount || 0)}
              />
            </div>

            {!basicsValidation.valid ? (
              <div style={styles.warningBox}>
                <p style={styles.warningTitle}>Antes de avançar</p>
                <p style={styles.warningText}>
                  Faltam: {basicsValidation.missing.join(", ")}.
                </p>
              </div>
            ) : null}
          </section>

          <div style={styles.actionsRow}>
            <button
              type="button"
              onClick={() =>
                void saveDraft({
                  nextStep: 1,
                  successMessage: "Rascunho salvo com sucesso.",
                })
              }
              disabled={saving || !canEditStructure || (!isEdit && !!authLoading)}
              style={{
                ...styles.secondaryButton,
                ...((saving || !canEditStructure || (!isEdit && !!authLoading))
                  ? styles.disabledButton
                  : {}),
              }}
            >
              Salvar rascunho
            </button>

            <button
              type="button"
              onClick={() => void handleContinueToBoundary()}
              disabled={saving || !canEditStructure || (!isEdit && !!authLoading)}
              style={{
                ...styles.primaryButton,
                ...((saving || !canEditStructure || (!isEdit && !!authLoading))
                  ? styles.disabledButton
                  : {}),
              }}
            >
              {saving ? "Salvando..." : "Continuar para perímetro"}
            </button>
          </div>
        </>
      ) : null}

      {currentStep === 2 ? (
        <>
          <section style={styles.card}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>Etapa 2 · Perímetro</h2>
              <p style={styles.sectionSub}>
                Configure a área oficial do torneio antes de publicar.
              </p>
            </div>

            <label style={styles.toggleRow}>
              <input
                type="checkbox"
                checked={boundaryEnabled}
                onChange={(e) => {
                  clearFeedback();
                  setBoundaryEnabled(e.target.checked);
                }}
                disabled={!canEditStructure}
              />
              <span style={styles.toggleLabel}>Ativar perímetro do torneio</span>
            </label>

            <div style={styles.boundarySummaryGrid}>
              <PreviewCard
                label="Perímetro"
                value={boundaryEnabled ? "Ativo" : "Desativado"}
              />
              <PreviewCard
                label="Tipo"
                value={
                  boundaryEnabled
                    ? boundarySummary.type === "circle"
                      ? "Círculo"
                      : boundarySummary.type === "polygon"
                      ? "Polígono"
                      : "Não definido"
                    : "Não obrigatório"
                }
              />
              <PreviewCard
                label="Raio"
                value={
                  boundarySummary.radiusM && boundarySummary.radiusM > 0
                    ? `${boundarySummary.radiusM} m`
                    : "—"
                }
              />
              <PreviewCard
                label="Pontos do polígono"
                value={String(boundarySummary.polygonPointsCount || 0)}
              />
            </div>

            <div
              style={{
                ...styles.boundaryStatusBox,
                ...(boundaryEnabled
                  ? boundarySummary.isConfigured
                    ? styles.boundaryStatusOk
                    : styles.boundaryStatusPending
                  : styles.boundaryStatusNeutral),
              }}
            >
              {boundaryEnabled ? (
                boundarySummary.isConfigured ? (
                  <>
                    <p style={styles.boundaryStatusTitle}>Perímetro configurado</p>
                    <p style={styles.boundaryStatusText}>
                      O torneio já possui uma área oficial pronta para validação de
                      capturas.
                    </p>
                  </>
                ) : (
                  <>
                    <p style={styles.boundaryStatusTitle}>
                      Perímetro ainda não configurado
                    </p>
                    <p style={styles.boundaryStatusText}>
                      Abra o editor de mapa e desenhe o círculo ou polígono antes
                      de seguir para a revisão final.
                    </p>
                  </>
                )
              ) : (
                <>
                  <p style={styles.boundaryStatusTitle}>Perímetro desativado</p>
                  <p style={styles.boundaryStatusText}>
                    O organizador optou por não exigir geofence neste torneio.
                  </p>
                </>
              )}
            </div>

            <div style={styles.actionsRow}>
              <button
                type="button"
                onClick={() => {
                  setCurrentStep(1);
                  if (isEdit && tournamentId) {
                    router.push(`/seller/tournaments/${tournamentId}/edit?step=1`);
                  }
                }}
                style={styles.secondaryButton}
              >
                Voltar para informações
              </button>

              <button
                type="button"
                onClick={handleOpenBoundaryEditor}
                disabled={!isEdit || !tournamentId}
                style={{
                  ...styles.secondaryBlueButton,
                  ...((!isEdit || !tournamentId) ? styles.disabledButton : {}),
                }}
              >
                Abrir editor de perímetro
              </button>

              <button
                type="button"
                onClick={() => void loadTournament()}
                disabled={saving}
                style={styles.secondaryButton}
              >
                Atualizar status do perímetro
              </button>

              <button
                type="button"
                onClick={() =>
                  void saveDraft({
                    nextStep: 2,
                    successMessage: "Rascunho salvo com sucesso.",
                    redirectToStep: true,
                  })
                }
                disabled={saving}
                style={{
                  ...styles.secondaryButton,
                  ...(saving ? styles.disabledButton : {}),
                }}
              >
                Salvar rascunho
              </button>

              <button
                type="button"
                onClick={() => void handleContinueToReview()}
                disabled={saving || (boundaryEnabled && !boundarySummary.isConfigured)}
                style={{
                  ...styles.primaryButton,
                  ...((saving || (boundaryEnabled && !boundarySummary.isConfigured))
                    ? styles.disabledButton
                    : {}),
                }}
              >
                Ir para revisão final
              </button>
            </div>
          </section>
        </>
      ) : null}

      {currentStep === 3 ? (
        <>
          <section style={styles.card}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>Etapa 3 · Revisão e publicação</h2>
              <p style={styles.sectionSub}>
                Confira o checklist final antes de deixar o torneio visível ao
                público.
              </p>
            </div>

            <div style={styles.reviewGrid}>
              {reviewChecklist.items.map((item) => (
                <div
                  key={item.label}
                  style={{
                    ...styles.reviewItem,
                    ...(item.ok ? styles.reviewItemOk : styles.reviewItemPending),
                  }}
                >
                  <span style={styles.reviewItemIcon}>{item.ok ? "✓" : "!"}</span>
                  <span style={styles.reviewItemText}>{item.label}</span>
                </div>
              ))}
            </div>

            <div style={styles.previewGrid}>
              <PreviewCard label="Título" value={title || "—"} />
              <PreviewCard label="Slug público" value={finalSlugPreview || "—"} />
              <PreviewCard label="Local" value={location || "—"} />
              <PreviewCard
                label="Inscrição"
                value={formatMoney(entryFee || 0, currency || "BRL")}
              />
              <PreviewCard
                label="Perímetro"
                value={
                  boundaryEnabled
                    ? boundarySummary.isConfigured
                      ? "Configurado"
                      : "Pendente"
                    : "Desativado"
                }
              />
              <PreviewCard
                label="Visibilidade"
                value={
                  visibility === "published"
                    ? "Visível ao público"
                    : "Apenas criador vê"
                }
              />
            </div>

            {!reviewChecklist.publishReady ? (
              <div style={styles.warningBox}>
                <p style={styles.warningTitle}>Publicação bloqueada</p>
                <p style={styles.warningText}>
                  Ainda faltam: {reviewChecklist.missingFields.join(", ")}.
                </p>
              </div>
            ) : (
              <div style={styles.successBox}>
                <p style={styles.successBoxTitle}>Tudo pronto para publicar</p>
                <p style={styles.successBoxText}>
                  Ao publicar, o torneio deixa de ser rascunho e passa a ficar
                  visível para os usuários realizarem inscrições.
                </p>
              </div>
            )}
          </section>

          <div style={styles.actionsRow}>
            <button
              type="button"
              onClick={() => {
                setCurrentStep(2);
                if (isEdit && tournamentId) {
                  router.push(`/seller/tournaments/${tournamentId}/edit?step=2`);
                }
              }}
              style={styles.secondaryButton}
            >
              Voltar para perímetro
            </button>

            <button
              type="button"
              onClick={() =>
                void saveDraft({
                  nextStep: 3,
                  successMessage: "Rascunho salvo com sucesso.",
                  redirectToStep: true,
                })
              }
              disabled={saving}
              style={{
                ...styles.secondaryButton,
                ...(saving ? styles.disabledButton : {}),
              }}
            >
              Salvar como rascunho
            </button>

            <button
              type="button"
              onClick={() => void handlePublishTournament()}
              disabled={saving || !reviewChecklist.publishReady}
              style={{
                ...styles.primaryButton,
                ...((saving || !reviewChecklist.publishReady)
                  ? styles.disabledButton
                  : {}),
              }}
            >
              {saving ? "Publicando..." : "Publicar torneio"}
            </button>
          </div>
        </>
      ) : null}

      <div style={styles.actionsFooter}>
        <button
          type="button"
          onClick={() =>
            router.push(
              isEdit && tournamentId
                ? `/seller/tournaments/${tournamentId}`
                : "/seller/tournaments"
            )
          }
          style={styles.ghostButton}
        >
          Cancelar
        </button>
      </div>

      {message ? <p style={styles.successText}>{message}</p> : null}
      {error ? <p style={styles.errorText}>{error}</p> : null}
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

function PreviewCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.previewCard}>
      <p style={styles.previewLabel}>{label}</p>
      <p style={styles.previewValue}>{value}</p>
    </div>
  );
}

function StepPill({
  step,
  label,
  active,
  done,
}: {
  step: string;
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <div
      style={{
        ...styles.stepPill,
        ...(active ? styles.stepPillActive : {}),
        ...(done ? styles.stepPillDone : {}),
      }}
    >
      <span style={styles.stepCircle}>{done ? "✓" : step}</span>
      <span style={styles.stepLabel}>{label}</span>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },

  card: {
    background: "#FFFFFF",
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 22,
    padding: 20,
    boxShadow: "0 10px 24px rgba(15,23,42,0.04)",
  },

  heroCard: {
    background: "#FFFFFF",
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 22,
    padding: 20,
    boxShadow: "0 10px 24px rgba(15,23,42,0.04)",
  },

  heroTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    flexWrap: "wrap",
  },

  heroBadges: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },

  statusBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 12px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 900,
  },

  lockBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 12px",
    borderRadius: 999,
    background: "#FEE2E2",
    color: "#B91C1C",
    fontSize: 13,
    fontWeight: 900,
  },

  editBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 12px",
    borderRadius: 999,
    background: "#DCFCE7",
    color: "#166534",
    fontSize: 13,
    fontWeight: 900,
  },

  draftBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 12px",
    borderRadius: 999,
    background: "#EFF6FF",
    color: "#1D4ED8",
    fontSize: 13,
    fontWeight: 900,
  },

  publishedBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 12px",
    borderRadius: 999,
    background: "#ECFDF5",
    color: "#166534",
    fontSize: 13,
    fontWeight: 900,
  },

  timelineGrid: {
    marginTop: 16,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
  },

  stepsRow: {
    marginTop: 16,
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },

  stepPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 14px",
    borderRadius: 999,
    border: "1px solid rgba(15,23,42,0.08)",
    background: "#FFFFFF",
  },

  stepPillActive: {
    border: "1px solid #0B3C5D",
    boxShadow: "0 0 0 3px rgba(11,60,93,0.06)",
  },

  stepPillDone: {
    background: "#F0FDF4",
    border: "1px solid #BBF7D0",
  },

  stepCircle: {
    width: 24,
    height: 24,
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#0B3C5D",
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: 900,
    flexShrink: 0,
  },

  stepLabel: {
    fontSize: 13,
    fontWeight: 900,
    color: "#0F172A",
  },

  title: {
    margin: 0,
    fontSize: 28,
    fontWeight: 1000,
    color: "#0B3C5D",
  },

  muted: {
    margin: "8px 0 0 0",
    color: "#64748B",
    fontSize: 14,
    fontWeight: 700,
  },

  sectionHeader: {
    marginBottom: 16,
  },

  sectionTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 1000,
    color: "#0F172A",
  },

  sectionSub: {
    margin: "6px 0 0 0",
    color: "#64748B",
    fontSize: 13,
    fontWeight: 700,
    lineHeight: 1.6,
  },

  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 12,
  },

  field: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    marginBottom: 14,
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

  inputReadonly: {
    width: "100%",
    border: "1px solid rgba(15,23,42,0.12)",
    borderRadius: 12,
    padding: "12px 14px",
    fontSize: 14,
    color: "#475569",
    background: "#F8FAFC",
    outline: "none",
  },

  textarea: {
    minHeight: 110,
    resize: "vertical",
    border: "1px solid rgba(15,23,42,0.12)",
    borderRadius: 12,
    padding: "12px 14px",
    fontSize: 14,
    color: "#0F172A",
    background: "#FFFFFF",
    outline: "none",
    fontFamily: "system-ui, sans-serif",
  },

  textareaLarge: {
    minHeight: 170,
    resize: "vertical",
    border: "1px solid rgba(15,23,42,0.12)",
    borderRadius: 12,
    padding: "12px 14px",
    fontSize: 14,
    color: "#0F172A",
    background: "#FFFFFF",
    outline: "none",
    fontFamily: "system-ui, sans-serif",
  },

  toggleRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
    fontWeight: 800,
    color: "#0F172A",
  },

  toggleLabel: {
    fontSize: 14,
  },

  previewGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
  },

  previewCard: {
    background: "#F8FAFC",
    border: "1px solid rgba(15,23,42,0.06)",
    borderRadius: 14,
    padding: 14,
  },

  previewLabel: {
    margin: 0,
    color: "#64748B",
    fontSize: 12,
    fontWeight: 800,
  },

  previewValue: {
    margin: "6px 0 0 0",
    color: "#0F172A",
    fontSize: 14,
    fontWeight: 1000,
    lineHeight: 1.4,
  },

  warningBox: {
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
    background: "#FEF3C7",
    border: "1px solid #FDE68A",
  },

  warningTitle: {
    margin: 0,
    color: "#92400E",
    fontSize: 14,
    fontWeight: 900,
  },

  warningText: {
    margin: "8px 0 0 0",
    color: "#92400E",
    fontSize: 14,
    fontWeight: 700,
    lineHeight: 1.6,
  },

  successBox: {
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
    background: "#ECFDF5",
    border: "1px solid #A7F3D0",
  },

  successBoxTitle: {
    margin: 0,
    color: "#166534",
    fontSize: 14,
    fontWeight: 900,
  },

  successBoxText: {
    margin: "8px 0 0 0",
    color: "#166534",
    fontSize: 14,
    fontWeight: 700,
    lineHeight: 1.6,
  },

  boundarySummaryGrid: {
    marginTop: 16,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
  },

  boundaryStatusBox: {
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
  },

  boundaryStatusOk: {
    background: "#ECFDF5",
    border: "1px solid #A7F3D0",
  },

  boundaryStatusPending: {
    background: "#FEF2F2",
    border: "1px solid #FECACA",
  },

  boundaryStatusNeutral: {
    background: "#EFF6FF",
    border: "1px solid #BFDBFE",
  },

  boundaryStatusTitle: {
    margin: 0,
    fontSize: 14,
    fontWeight: 900,
    color: "#0F172A",
  },

  boundaryStatusText: {
    margin: "8px 0 0 0",
    fontSize: 14,
    fontWeight: 700,
    lineHeight: 1.6,
    color: "#475569",
  },

  reviewGrid: {
    display: "grid",
    gap: 10,
    marginBottom: 16,
  },

  reviewItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    padding: "12px 14px",
  },

  reviewItemOk: {
    background: "#ECFDF5",
    border: "1px solid #A7F3D0",
  },

  reviewItemPending: {
    background: "#FEF2F2",
    border: "1px solid #FECACA",
  },

  reviewItemIcon: {
    width: 22,
    height: 22,
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#FFFFFF",
    fontSize: 12,
    fontWeight: 900,
    flexShrink: 0,
  },

  reviewItemText: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: 800,
  },

  actionsRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },

  actionsFooter: {
    display: "flex",
    justifyContent: "flex-start",
  },

  primaryButton: {
    border: "none",
    borderRadius: 12,
    padding: "12px 16px",
    background: "#0B3C5D",
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: 900,
    cursor: "pointer",
  },

  secondaryButton: {
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 12,
    padding: "12px 16px",
    background: "#FFFFFF",
    color: "#0F172A",
    fontSize: 14,
    fontWeight: 900,
    cursor: "pointer",
  },

  secondaryBlueButton: {
    border: "1px solid #BFDBFE",
    borderRadius: 12,
    padding: "12px 16px",
    background: "#EFF6FF",
    color: "#1D4ED8",
    fontSize: 14,
    fontWeight: 900,
    cursor: "pointer",
  },

  ghostButton: {
    border: "none",
    borderRadius: 12,
    padding: "12px 0",
    background: "transparent",
    color: "#475569",
    fontSize: 14,
    fontWeight: 900,
    cursor: "pointer",
  },

  disabledButton: {
    opacity: 0.55,
    cursor: "not-allowed",
  },

  successText: {
    margin: 0,
    color: "#166534",
    fontWeight: 800,
  },

  errorText: {
    margin: 0,
    color: "#B91C1C",
    fontWeight: 800,
  },
};