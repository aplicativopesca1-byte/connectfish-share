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
import { useRouter } from "next/navigation";
import { db } from "../../../../src/lib/firebase";
import { useAuth } from "@/context/AuthContext";

type Props = {
  mode: "create" | "edit";
  tournamentId?: string;
  currentUserId?: string;
};

type TournamentStatus = "draft" | "scheduled" | "live" | "finished";

type TournamentDoc = {
  title?: string;
  subtitle?: string | null;
  slug?: string | null;
  location?: string;
  description?: string | null;
  coverImageUrl?: string | null;
  species?: string;
  entryFee?: number;
  minSizeCm?: number;
  validFishCount?: number;
  rules?: string[];
  status?: TournamentStatus;
  scheduledStartAt?: unknown;
  scheduledEndAt?: unknown;
  registrationUrl?: string | null;
  adminUrl?: string | null;
  boundaryEnabled?: boolean;
  publishedAt?: unknown;
  startedAt?: unknown;
  finishedAt?: unknown;
};

type FirestoreTimestampLike = {
  toDate?: () => Date;
};

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

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
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
  if (status === "scheduled") return "Agendado";
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

export default function TournamentForm({
  mode,
  tournamentId,
  currentUserId,
}: Props) {
  const router = useRouter();

  const { uid, email, loading: authLoading } = useAuth() as {
    uid?: string | null;
    email?: string | null;
    loading?: boolean;
  };

  const isEdit = mode === "edit";

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [slug, setSlug] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [species, setSpecies] = useState("");
  const [entryFee, setEntryFee] = useState<number>(0);
  const [minSizeCm, setMinSizeCm] = useState<number>(30);
  const [validFishCount, setValidFishCount] = useState<number>(3);
  const [rulesText, setRulesText] = useState("");
  const [status, setStatus] = useState<TournamentStatus>("draft");
  const [scheduledStartAt, setScheduledStartAt] = useState("");
  const [scheduledEndAt, setScheduledEndAt] = useState("");
  const [registrationUrl, setRegistrationUrl] = useState("");
  const [adminUrl, setAdminUrl] = useState("");
  const [boundaryEnabled, setBoundaryEnabled] = useState(true);

  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [finishedAt, setFinishedAt] = useState<string | null>(null);

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generatedSlug = useMemo(() => slugify(title), [title]);
  const resolvedUserId = String(uid || currentUserId || "").trim();
  const resolvedUserName = String(email || "Organizador").trim();

  const isOperationallyLocked =
    isEdit && (status === "live" || status === "finished");
  const canEditStructure = !isOperationallyLocked;

  useEffect(() => {
    if (!isEdit || !tournamentId) return;
    void loadTournament();
  }, [isEdit, tournamentId]);

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
      setMinSizeCm(Number(data.minSizeCm ?? 30) || 30);
      setValidFishCount(Number(data.validFishCount ?? 3) || 3);
      setRulesText(Array.isArray(data.rules) ? data.rules.join("\n") : "");
      setStatus(data.status || "draft");
      setScheduledStartAt(toDateTimeLocalInput(data.scheduledStartAt));
      setScheduledEndAt(toDateTimeLocalInput(data.scheduledEndAt));
      setRegistrationUrl(data.registrationUrl || "");
      setAdminUrl(data.adminUrl || "");
      setBoundaryEnabled(data.boundaryEnabled !== false);
      setPublishedAt(toIsoStringSafe(data.publishedAt));
      setStartedAt(toIsoStringSafe(data.startedAt));
      setFinishedAt(toIsoStringSafe(data.finishedAt));
    } catch (err) {
      console.error("Erro ao carregar torneio:", err);
      setError("Não foi possível carregar os dados do torneio.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      if (!title.trim()) {
        setError("Informe o nome do torneio.");
        setSaving(false);
        return;
      }

      if (!location.trim()) {
        setError("Informe o local do torneio.");
        setSaving(false);
        return;
      }

      if (!species.trim()) {
        setError("Informe a espécie do torneio.");
        setSaving(false);
        return;
      }

      if (Number(entryFee) < 0) {
        setError("O valor da inscrição não pode ser negativo.");
        setSaving(false);
        return;
      }

      if (!isEdit) {
        if (authLoading) {
          setError("Aguardando identificação do usuário.");
          setSaving(false);
          return;
        }

        if (!resolvedUserId) {
          console.error("Create tournament debug:", {
            uid,
            email,
            currentUserId,
            authLoading,
          });
          setError("Usuário não identificado para criar o torneio.");
          setSaving(false);
          return;
        }
      }

      if (isEdit && isOperationallyLocked) {
        setError(
          "Esse torneio está em operação ou finalizado. Edite o status pela central do torneio antes de alterar a estrutura."
        );
        setSaving(false);
        return;
      }

      const finalSlug = slug.trim() || generatedSlug;

      const payload = {
        title: title.trim(),
        subtitle: subtitle.trim() || null,
        slug: finalSlug || null,
        location: location.trim(),
        description: description.trim() || null,
        coverImageUrl: coverImageUrl.trim() || null,
        species: species.trim(),
        entryFee: Number(entryFee || 0),
        minSizeCm: Number(minSizeCm || 0),
        validFishCount: Number(validFishCount || 0),
        rules: parseRules(rulesText),
        scheduledStartAt: scheduledStartAt ? new Date(scheduledStartAt) : null,
        scheduledEndAt: scheduledEndAt ? new Date(scheduledEndAt) : null,
        registrationUrl: registrationUrl.trim() || null,
        adminUrl: adminUrl.trim() || null,
        boundaryEnabled,
        updatedAt: serverTimestamp(),
      };

      if (isEdit && tournamentId) {
        const ref = doc(db, "tournaments", tournamentId);
        await updateDoc(ref, payload);
        setMessage("Torneio atualizado com sucesso.");
        return;
      }

      const ref = await addDoc(collection(db, "tournaments"), {
        ...payload,
        status: "draft",
        createdBy: resolvedUserId,
        createdByName: resolvedUserName,
        createdAt: serverTimestamp(),
      });

      router.push(`/seller/tournaments/${ref.id}/map`);
      return;
    } catch (err) {
      console.error("Erro ao salvar torneio:", err);
      setError("Não foi possível salvar o torneio.");
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
      {isEdit ? (
        <section style={styles.heroCard}>
          <div style={styles.heroTop}>
            <div>
              <h1 style={styles.title}>Editar torneio</h1>
              <p style={styles.sectionSub}>
                Ajuste a estrutura do torneio, regras e agenda operacional.
              </p>
            </div>

            <div style={styles.heroBadges}>
              <span style={getStatusBadgeStyle(status)}>
                {getStatusLabel(status)}
              </span>
              {isOperationallyLocked ? (
                <span style={styles.lockBadge}>
                  Edição estrutural bloqueada
                </span>
              ) : (
                <span style={styles.editBadge}>Edição liberada</span>
              )}
            </div>
          </div>

          <div style={styles.timelineGrid}>
            <PreviewCard
              label="Publicado em"
              value={formatDateTime(publishedAt)}
            />
            <PreviewCard
              label="Iniciado em"
              value={formatDateTime(startedAt)}
            />
            <PreviewCard
              label="Encerrado em"
              value={formatDateTime(finishedAt)}
            />
          </div>

          {isOperationallyLocked ? (
            <p style={styles.warningText}>
              Este torneio está {status === "live" ? "ao vivo" : "finalizado"}.
              Para manter a operação consistente, os campos estruturais foram
              bloqueados. Use a central do torneio para alterar o status antes
              de editar a estrutura.
            </p>
          ) : null}
        </section>
      ) : null}

      <section style={styles.card}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>Informações principais</h2>
          <p style={styles.sectionSub}>
            Base do torneio que será usada no app, no portal e no ranking.
          </p>
        </div>

        <div style={styles.formGrid}>
          <Field label="Nome do torneio *">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={styles.input}
              placeholder="Ex.: Torneio Tucunaré Master"
              disabled={!canEditStructure}
            />
          </Field>

          <Field label="Subtítulo">
            <input
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              style={styles.input}
              placeholder="Ex.: Etapa ConnectFish"
              disabled={!canEditStructure}
            />
          </Field>

          <Field label="Slug público">
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(slugify(e.target.value))}
              style={styles.input}
              placeholder={generatedSlug || "torneio-tucunare-master"}
              disabled={!canEditStructure}
            />
          </Field>

          <Field label="Local *">
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              style={styles.input}
              placeholder="Ex.: Rio Juruena - MT"
              disabled={!canEditStructure}
            />
          </Field>
        </div>

        <Field label="Descrição">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={styles.textarea}
            placeholder="Explique rapidamente como será o torneio, o local e a operação."
            disabled={!canEditStructure}
          />
        </Field>

        <Field label="URL da capa">
          <input
            type="text"
            value={coverImageUrl}
            onChange={(e) => setCoverImageUrl(e.target.value)}
            style={styles.input}
            placeholder="https://..."
            disabled={!canEditStructure}
          />
        </Field>
      </section>

      <section style={styles.card}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>Regras do torneio</h2>
          <p style={styles.sectionSub}>
            Essas regras ajudam a padronizar app, validação e ranking.
          </p>
        </div>

        <div style={styles.formGrid}>
          <Field label="Espécie válida *">
            <input
              type="text"
              value={species}
              onChange={(e) => setSpecies(e.target.value)}
              style={styles.input}
              placeholder="Ex.: Tucunaré"
              disabled={!canEditStructure}
            />
          </Field>

          <Field label="Valor da inscrição (R$)">
            <input
              type="number"
              min={0}
              step={0.01}
              value={entryFee}
              onChange={(e) => setEntryFee(Number(e.target.value))}
              style={styles.input}
              placeholder="Ex.: 50"
              disabled={!canEditStructure}
            />
          </Field>

          <Field label="Tamanho mínimo (cm)">
            <input
              type="number"
              min={0}
              value={minSizeCm}
              onChange={(e) => setMinSizeCm(Number(e.target.value))}
              style={styles.input}
              disabled={!canEditStructure}
            />
          </Field>

          <Field label="Quantidade de peixes válidos">
            <input
              type="number"
              min={1}
              value={validFishCount}
              onChange={(e) => setValidFishCount(Number(e.target.value))}
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

        <Field label="Regras principais (uma por linha)">
          <textarea
            value={rulesText}
            onChange={(e) => setRulesText(e.target.value)}
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
          <h2 style={styles.sectionTitle}>Agenda e operação</h2>
          <p style={styles.sectionSub}>
            Janela do torneio, inscrição e links operacionais.
          </p>
        </div>

        <div style={styles.formGrid}>
          <Field label="Início programado">
            <input
              type="datetime-local"
              value={scheduledStartAt}
              onChange={(e) => setScheduledStartAt(e.target.value)}
              style={styles.input}
              disabled={!canEditStructure}
            />
          </Field>

          <Field label="Fim programado">
            <input
              type="datetime-local"
              value={scheduledEndAt}
              onChange={(e) => setScheduledEndAt(e.target.value)}
              style={styles.input}
              disabled={!canEditStructure}
            />
          </Field>

          <Field label="URL de inscrição">
            <input
              type="text"
              value={registrationUrl}
              onChange={(e) => setRegistrationUrl(e.target.value)}
              style={styles.input}
              placeholder="https://www.connectfish.app/tournaments/slug"
              disabled={!canEditStructure}
            />
          </Field>

          <Field label="URL administrativa">
            <input
              type="text"
              value={adminUrl}
              onChange={(e) => setAdminUrl(e.target.value)}
              style={styles.input}
              placeholder="https://..."
              disabled={!canEditStructure}
            />
          </Field>
        </div>

        <label style={styles.toggleRow}>
          <input
            type="checkbox"
            checked={boundaryEnabled}
            onChange={(e) => setBoundaryEnabled(e.target.checked)}
            disabled={!canEditStructure}
          />
          <span style={styles.toggleLabel}>Ativar perímetro do torneio</span>
        </label>
      </section>

      <section style={styles.card}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>Preview rápido</h2>
          <p style={styles.sectionSub}>
            Conferência da estrutura antes de salvar.
          </p>
        </div>

        <div style={styles.previewGrid}>
          <PreviewCard label="Título" value={title || "—"} />
          <PreviewCard label="Slug" value={slug || generatedSlug || "—"} />
          <PreviewCard label="Espécie" value={species || "—"} />
          <PreviewCard label="Inscrição" value={formatMoney(entryFee || 0)} />
          <PreviewCard label="Mínimo" value={`${minSizeCm || 0} cm`} />
          <PreviewCard
            label="Peixes válidos"
            value={String(validFishCount || 0)}
          />
          <PreviewCard
            label="Perímetro"
            value={boundaryEnabled ? "Ativo" : "Desativado"}
          />
        </div>
      </section>

      <div style={styles.actionsRow}>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving || !canEditStructure || (!isEdit && !!authLoading)}
          style={{
            ...styles.primaryButton,
            ...((saving || !canEditStructure || (!isEdit && !!authLoading))
              ? styles.disabledButton
              : {}),
          }}
        >
          {saving
            ? "Salvando..."
            : !isEdit && !!authLoading
            ? "Identificando usuário..."
            : isEdit
            ? "Salvar alterações"
            : "Criar torneio"}
        </button>

        <button
          type="button"
          onClick={() =>
            router.push(
              isEdit && tournamentId
                ? `/seller/tournaments/${tournamentId}`
                : "/seller/tournaments"
            )
          }
          style={styles.secondaryButton}
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
  timelineGrid: {
    marginTop: 16,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
  },
  warningText: {
    margin: "14px 0 0 0",
    color: "#92400E",
    fontSize: 14,
    fontWeight: 700,
    lineHeight: 1.6,
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
  actionsRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
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