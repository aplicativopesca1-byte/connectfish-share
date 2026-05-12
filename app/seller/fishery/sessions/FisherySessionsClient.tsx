"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../../../../src/lib/firebase";

type Props = {
  uid: string;
};

type SessionType =
  | "day_use"
  | "half_day"
  | "night"
  | "tournament"
  | "hourly"
  | "private";

type FisheryArea = {
  id: string;
  name: string;
  type: string;
  customTypeLabel: string;
  capacity: number;
  price: number;
  active: boolean;
};

type FishingSession = {
  id: string;
  pesqueiroId: string;
  ownerId: string;
  areaId: string;
  areaName: string;
  title: string;
  sessionType: SessionType;
  startAt: string;
  endAt: string;
  capacity: number;
  reservedSpots: number;
  price: number;
  waitlistEnabled: boolean;
  active: boolean;
  status: string;
  rules: string;
};

type FormState = {
  areaId: string;
  title: string;
  sessionType: SessionType;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  capacity: string;
  price: string;
  waitlistEnabled: boolean;
  active: boolean;
  rules: string;
};

const initialForm: FormState = {
  areaId: "",
  title: "",
  sessionType: "day_use",
  startDate: "",
  startTime: "",
  endDate: "",
  endTime: "",
  capacity: "",
  price: "",
  waitlistEnabled: true,
  active: true,
  rules: "",
};

function toNumber(value: string) {
  const n = Number(String(value || "0").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function buildDateTime(date: string, time: string) {
  if (!date || !time) return "";
  return `${date}T${time}:00`;
}

function formatDateTime(value: string) {
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
  }).format(value || 0);
}

function getSessionTypeLabel(type: SessionType) {
  if (type === "day_use") return "Day use";
  if (type === "half_day") return "Meio período";
  if (type === "night") return "Noturna";
  if (type === "tournament") return "Torneio";
  if (type === "hourly") return "Por hora";
  if (type === "private") return "Privada";
  return "Sessão";
}

function splitDateTime(value: string) {
  if (!value) return { date: "", time: "" };

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: "", time: "" };

  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");

  return {
    date: `${yyyy}-${mm}-${dd}`,
    time: `${hh}:${mi}`,
  };
}

export default function FisherySessionsClient({ uid }: Props) {
  const [fisheryId, setFisheryId] = useState<string | null>(null);
  const [fisheryName, setFisheryName] = useState<string>("");

  const [areas, setAreas] = useState<FisheryArea[]>([]);
  const [sessions, setSessions] = useState<FishingSession[]>([]);
  const [form, setForm] = useState<FormState>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedArea = useMemo(
    () => areas.find((item) => item.id === form.areaId) || null,
    [areas, form.areaId]
  );

  const activeSessionsCount = useMemo(
    () => sessions.filter((item) => item.active).length,
    [sessions]
  );

  useEffect(() => {
    void loadPage();
  }, [uid]);

  async function resolveFisheryId() {
    const q = query(
      collection(db, "pesqueiros"),
      where("ownerId", "==", uid),
      limit(1)
    );

    const snap = await getDocs(q);

    if (!snap.empty) {
      const docSnap = snap.docs[0];
      const data = docSnap.data() as any;

      setFisheryId(docSnap.id);
      setFisheryName(data?.name ?? "Meu pesqueiro");

      return docSnap.id;
    }

    const directFisheryId = uid;
    setFisheryId(directFisheryId);
    setFisheryName("Meu pesqueiro");

    return directFisheryId;
  }

  async function loadPage() {
    try {
      setLoading(true);
      setError(null);

      const resolvedFisheryId = await resolveFisheryId();

      await Promise.all([
        loadAreas(resolvedFisheryId),
        loadSessions(resolvedFisheryId),
      ]);
    } catch (e: any) {
      setError(e?.message || "Não foi possível carregar as sessões.");
    } finally {
      setLoading(false);
    }
  }

  async function loadAreas(currentFisheryId = fisheryId) {
    const q = query(
      collection(db, "pesqueiroAreas"),
      where("ownerId", "==", uid),
      where("active", "==", true),
      orderBy("createdAt", "desc")
    );

    const snap = await getDocs(q);

    const items: FisheryArea[] = snap.docs.map((item) => {
      const data = item.data() as any;

      return {
        id: item.id,
        name: data?.name ?? "Sem nome",
        type: data?.type ?? "other",
        customTypeLabel: data?.customTypeLabel ?? "",
        capacity: Number(data?.capacity ?? 0),
        price: Number(data?.price ?? 0),
        active: data?.active !== false,
      };
    });

    setAreas(items);
  }

  async function loadSessions(currentFisheryId = fisheryId) {
    const q = query(
      collection(db, "fishingSessions"),
      where("ownerId", "==", uid),
      orderBy("startAt", "desc")
    );

    const snap = await getDocs(q);

    const items: FishingSession[] = snap.docs.map((item) => {
      const data = item.data() as any;

      return {
        id: item.id,
        pesqueiroId: data?.pesqueiroId ?? currentFisheryId ?? uid,
        ownerId: data?.ownerId ?? uid,
        areaId: data?.areaId ?? "",
        areaName: data?.areaName ?? "Estrutura não informada",
        title: data?.title ?? "Sessão",
        sessionType: data?.sessionType ?? "day_use",
        startAt: data?.startAt ?? "",
        endAt: data?.endAt ?? "",
        capacity: Number(data?.capacity ?? 0),
        reservedSpots: Number(data?.reservedSpots ?? 0),
        price: Number(data?.price ?? 0),
        waitlistEnabled: Boolean(data?.waitlistEnabled),
        active: data?.active !== false,
        status: data?.status ?? "scheduled",
        rules: data?.rules ?? "",
      };
    });

    setSessions(items);
  }

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function resetForm() {
    setForm(initialForm);
    setEditingId(null);
    setMessage(null);
    setError(null);
  }

  function startEdit(session: FishingSession) {
    const start = splitDateTime(session.startAt);
    const end = splitDateTime(session.endAt);

    setEditingId(session.id);
    setForm({
      areaId: session.areaId,
      title: session.title,
      sessionType: session.sessionType,
      startDate: start.date,
      startTime: start.time,
      endDate: end.date,
      endTime: end.time,
      capacity: String(session.capacity || ""),
      price: String(session.price || ""),
      waitlistEnabled: session.waitlistEnabled,
      active: session.active,
      rules: session.rules || "",
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();

    try {
      setSaving(true);
      setError(null);
      setMessage(null);

      const currentFisheryId = fisheryId || (await resolveFisheryId());

      const area = areas.find((item) => item.id === form.areaId);

      if (!currentFisheryId) {
        throw new Error("Não foi possível identificar o pesqueiro.");
      }

      if (!area) {
        throw new Error("Selecione uma estrutura ativa para esta sessão.");
      }

      if (!form.title.trim()) {
        throw new Error("Informe o título da sessão.");
      }

      const startAt = buildDateTime(form.startDate, form.startTime);
      const endAt = buildDateTime(form.endDate, form.endTime);

      if (!startAt || !endAt) {
        throw new Error("Informe data e horário de início e fim.");
      }

      const startMs = new Date(startAt).getTime();
      const endMs = new Date(endAt).getTime();

      if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
        throw new Error("Data ou horário inválido.");
      }

      if (endMs <= startMs) {
        throw new Error("O horário final precisa ser depois do início.");
      }

      const capacity = toNumber(form.capacity);

      if (capacity <= 0) {
        throw new Error("Informe a quantidade de vagas.");
      }

      const payload = {
        pesqueiroId: currentFisheryId,
        ownerId: uid,
        areaId: area.id,
        areaName: area.name,
        title: form.title.trim(),
        sessionType: form.sessionType,
        startAt,
        endAt,
        capacity,
        price: toNumber(form.price),
        waitlistEnabled: form.waitlistEnabled,
        active: form.active,
        status: "scheduled",
        rules: form.rules.trim(),
        updatedAt: serverTimestamp(),
      };

      if (editingId) {
        await updateDoc(doc(db, "fishingSessions", editingId), payload);
        setMessage("Sessão atualizada com sucesso.");
      } else {
        await addDoc(collection(db, "fishingSessions"), {
          ...payload,
          reservedSpots: 0,
          createdAt: serverTimestamp(),
        });
        setMessage("Sessão criada com sucesso.");
      }

      setForm(initialForm);
      setEditingId(null);
      await loadSessions(currentFisheryId);
    } catch (e: any) {
      setError(e?.message || "Não foi possível salvar a sessão.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(session: FishingSession) {
    try {
      setError(null);
      setMessage(null);

      await updateDoc(doc(db, "fishingSessions", session.id), {
        active: !session.active,
        updatedAt: serverTimestamp(),
      });

      setMessage(session.active ? "Sessão pausada." : "Sessão ativada.");
      await loadSessions(fisheryId);
    } catch (e: any) {
      setError(e?.message || "Não foi possível alterar o status.");
    }
  }

  async function removeSession(session: FishingSession) {
    const ok = window.confirm(
      `Tem certeza que deseja excluir "${session.title}"? Essa ação não pode ser desfeita.`
    );

    if (!ok) return;

    try {
      setError(null);
      setMessage(null);

      if (session.reservedSpots > 0) {
        throw new Error(
          "Essa sessão já possui reservas. Pause a sessão em vez de excluir."
        );
      }

      await deleteDoc(doc(db, "fishingSessions", session.id));

      if (editingId === session.id) resetForm();

      setMessage("Sessão excluída com sucesso.");
      await loadSessions(fisheryId);
    } catch (e: any) {
      setError(e?.message || "Não foi possível excluir a sessão.");
    }
  }

  if (loading) {
    return (
      <div style={styles.wrap}>
        <div style={styles.card}>
          <div style={styles.title}>Sessões de pesca</div>
          <div style={styles.sub}>Carregando sessões...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      <section style={styles.hero}>
        <div>
          <div style={styles.title}>Sessões de pesca</div>
          <div style={styles.sub}>
            Crie horários, datas, vagas e preços para cada estrutura do seu
            pesqueiro.
          </div>
          <div style={styles.fisheryHint}>
            Pesqueiro vinculado: {fisheryName || "Meu pesqueiro"} · ID:{" "}
            {fisheryId || uid}
          </div>
        </div>

        <div style={styles.statPill}>
          {activeSessionsCount} ativas · {sessions.length} cadastradas
        </div>
      </section>

      <form onSubmit={handleSave} style={styles.formCard}>
        <div style={styles.sectionTitle}>
          {editingId ? "Editar sessão" : "Nova sessão"}
        </div>

        {areas.length === 0 ? (
          <div style={styles.warning}>
            Antes de criar uma sessão, cadastre pelo menos uma estrutura ativa em
            “Estruturas do pesqueiro”.
          </div>
        ) : null}

        <div style={styles.grid2}>
          <label style={styles.labelWrap}>
            <span style={styles.label}>Estrutura</span>
            <select
              value={form.areaId}
              onChange={(e) => {
                const areaId = e.target.value;
                const area = areas.find((item) => item.id === areaId);

                setForm((prev) => ({
                  ...prev,
                  areaId,
                  capacity: area?.capacity ? String(area.capacity) : prev.capacity,
                  price: area?.price ? String(area.price) : prev.price,
                }));
              }}
              style={styles.input}
            >
              <option value="">Selecione uma estrutura</option>
              {areas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </select>
          </label>

          <Field
            label="Título da sessão"
            value={form.title}
            onChange={(v) => updateField("title", v)}
            placeholder="Ex: Day use sábado"
          />
        </div>

        {selectedArea ? (
          <div style={styles.hint}>
            Estrutura selecionada: {selectedArea.name} · capacidade sugerida{" "}
            {selectedArea.capacity || 0} pessoas · preço base{" "}
            {formatMoney(selectedArea.price || 0)}
          </div>
        ) : null}

        <div style={styles.grid3}>
          <label style={styles.labelWrap}>
            <span style={styles.label}>Tipo de sessão</span>
            <select
              value={form.sessionType}
              onChange={(e) =>
                updateField("sessionType", e.target.value as SessionType)
              }
              style={styles.input}
            >
              <option value="day_use">Day use</option>
              <option value="half_day">Meio período</option>
              <option value="night">Noturna</option>
              <option value="tournament">Torneio</option>
              <option value="hourly">Por hora</option>
              <option value="private">Privada</option>
            </select>
          </label>

          <Field
            label="Vagas"
            value={form.capacity}
            onChange={(v) => updateField("capacity", v)}
            placeholder="Ex: 40"
          />

          <Field
            label="Preço por vaga"
            value={form.price}
            onChange={(v) => updateField("price", v)}
            placeholder="Ex: 120"
          />
        </div>

        <div style={styles.grid4}>
          <Field
            label="Data início"
            value={form.startDate}
            onChange={(v) => updateField("startDate", v)}
            type="date"
          />

          <Field
            label="Hora início"
            value={form.startTime}
            onChange={(v) => updateField("startTime", v)}
            type="time"
          />

          <Field
            label="Data fim"
            value={form.endDate}
            onChange={(v) => updateField("endDate", v)}
            type="date"
          />

          <Field
            label="Hora fim"
            value={form.endTime}
            onChange={(v) => updateField("endTime", v)}
            type="time"
          />
        </div>

        <div style={styles.grid1}>
          <TextAreaField
            label="Regras específicas da sessão"
            value={form.rules}
            onChange={(v) => updateField("rules", v)}
            placeholder="Ex: chegada com 30 minutos de antecedência, limite de acompanhantes, regras da noturna..."
          />
        </div>

        <div style={styles.checkGrid}>
          <label style={styles.checkItem}>
            <input
              type="checkbox"
              checked={form.waitlistEnabled}
              onChange={(e) => updateField("waitlistEnabled", e.target.checked)}
              style={styles.checkbox}
            />
            <span style={styles.checkLabel}>Ativar fila quando lotar</span>
          </label>

          <label style={styles.checkItem}>
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => updateField("active", e.target.checked)}
              style={styles.checkbox}
            />
            <span style={styles.checkLabel}>Sessão ativa para reservas</span>
          </label>
        </div>

        {message ? <div style={styles.success}>{message}</div> : null}
        {error ? <div style={styles.error}>{error}</div> : null}

        <div style={styles.actions}>
          {editingId ? (
            <button type="button" onClick={resetForm} style={styles.secondaryBtn}>
              Cancelar edição
            </button>
          ) : null}

          <button
            type="submit"
            disabled={saving || areas.length === 0}
            style={{
              ...styles.primaryBtn,
              ...(saving || areas.length === 0 ? styles.btnDisabled : {}),
            }}
          >
            {saving
              ? "Salvando..."
              : editingId
              ? "Salvar alterações"
              : "Criar sessão"}
          </button>
        </div>
      </form>

      <section style={styles.card}>
        <div style={styles.sectionHeader}>
          <div>
            <div style={styles.sectionTitle}>Sessões cadastradas</div>
            <div style={styles.sectionSub}>
              Essas sessões serão usadas na próxima etapa para reservas,
              pagamentos e fila digital.
            </div>
          </div>
        </div>

        {sessions.length === 0 ? (
          <div style={styles.emptyBox}>
            Nenhuma sessão cadastrada ainda. Crie o primeiro horário de pesca.
          </div>
        ) : (
          <div style={styles.list}>
            {sessions.map((session) => {
              const available = Math.max(
                0,
                session.capacity - session.reservedSpots
              );

              return (
                <article key={session.id} style={styles.sessionCard}>
                  <div style={styles.sessionTop}>
                    <div>
                      <div style={styles.sessionTitle}>{session.title}</div>
                      <div style={styles.sessionSub}>
                        {session.areaName} ·{" "}
                        {getSessionTypeLabel(session.sessionType)}
                      </div>
                    </div>

                    <span
                      style={{
                        ...styles.statusChip,
                        ...(session.active
                          ? styles.statusActive
                          : styles.statusPaused),
                      }}
                    >
                      {session.active ? "Ativa" : "Pausada"}
                    </span>
                  </div>

                  <div style={styles.infoGrid}>
                    <Info label="Início" value={formatDateTime(session.startAt)} />
                    <Info label="Fim" value={formatDateTime(session.endAt)} />
                    <Info label="Preço" value={formatMoney(session.price)} />
                    <Info
                      label="Vagas"
                      value={`${available}/${session.capacity} disponíveis`}
                    />
                    <Info
                      label="Reservadas"
                      value={`${session.reservedSpots || 0}`}
                    />
                    <Info
                      label="Fila"
                      value={session.waitlistEnabled ? "Ativa" : "Desativada"}
                    />
                  </div>

                  <div style={styles.sessionIdBox}>
                    pesqueiroId salvo: {session.pesqueiroId || "—"}
                  </div>

                  {session.rules ? (
                    <div style={styles.rulesBox}>
                      <strong>Regras:</strong> {session.rules}
                    </div>
                  ) : null}

                  <div style={styles.cardActions}>
                    <button
                      type="button"
                      onClick={() => startEdit(session)}
                      style={styles.secondaryBtn}
                    >
                      Editar
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleActive(session)}
                      style={styles.secondaryBtn}
                    >
                      {session.active ? "Pausar" : "Ativar"}
                    </button>

                    <button
                      type="button"
                      onClick={() => removeSession(session)}
                      style={styles.dangerBtn}
                    >
                      Excluir
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label style={styles.labelWrap}>
      <span style={styles.label}>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={styles.input}
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label style={styles.labelWrap}>
      <span style={styles.label}>{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={4}
        style={styles.textarea}
      />
    </label>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.infoCard}>
      <div style={styles.infoLabel}>{label}</div>
      <div style={styles.infoValue}>{value}</div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: { display: "grid", gap: 14 },
  hero: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 12,
    padding: 18,
    borderRadius: 18,
    background: "#FFFFFF",
    border: "1px solid rgba(15,23,42,0.08)",
    boxShadow: "0 10px 24px rgba(15,23,42,0.06)",
  },
  card: {
    padding: 18,
    borderRadius: 18,
    background: "#FFFFFF",
    border: "1px solid rgba(15,23,42,0.08)",
    boxShadow: "0 10px 24px rgba(15,23,42,0.06)",
  },
  formCard: {
    padding: 18,
    borderRadius: 18,
    background: "#FFFFFF",
    border: "1px solid rgba(15,23,42,0.08)",
    boxShadow: "0 10px 24px rgba(15,23,42,0.06)",
    display: "grid",
    gap: 14,
  },
  title: { fontSize: 24, fontWeight: 1000, color: "#0F172A" },
  sub: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: 700,
    color: "#475569",
    lineHeight: 1.5,
    maxWidth: 760,
  },
  fisheryHint: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: 800,
    color: "#0B3C5D",
  },
  statPill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(11,60,93,0.06)",
    border: "1px solid rgba(11,60,93,0.10)",
    color: "#0B3C5D",
    fontSize: 12,
    fontWeight: 1000,
    whiteSpace: "nowrap",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 15, fontWeight: 1000, color: "#0F172A" },
  sectionSub: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: 700,
    color: "#64748B",
    lineHeight: 1.5,
  },
  grid1: { display: "grid", gap: 12 },
  grid2: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  },
  grid3: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 12,
  },
  grid4: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 12,
  },
  checkGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 10,
  },
  labelWrap: { display: "grid", gap: 8 },
  label: { fontSize: 12, fontWeight: 900, color: "#334155" },
  input: {
    width: "100%",
    height: 44,
    borderRadius: 12,
    border: "1px solid rgba(15,23,42,0.12)",
    background: "#FFFFFF",
    padding: "0 12px",
    fontSize: 14,
    fontWeight: 700,
    color: "#0F172A",
    outline: "none",
  },
  textarea: {
    width: "100%",
    borderRadius: 12,
    border: "1px solid rgba(15,23,42,0.12)",
    background: "#FFFFFF",
    padding: 12,
    fontSize: 14,
    fontWeight: 700,
    color: "#0F172A",
    outline: "none",
    resize: "vertical",
    minHeight: 100,
    fontFamily: "system-ui, sans-serif",
  },
  checkItem: {
    minHeight: 44,
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(15,23,42,0.10)",
    background: "rgba(248,250,252,0.9)",
    cursor: "pointer",
  },
  checkbox: {
    width: 16,
    height: 16,
    accentColor: "#0B3C5D",
    cursor: "pointer",
  },
  checkLabel: { fontSize: 13, fontWeight: 900, color: "#334155" },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    flexWrap: "wrap",
  },
  primaryBtn: {
    height: 44,
    padding: "0 18px",
    borderRadius: 12,
    border: "1px solid rgba(15,23,42,0.10)",
    background: "#0B3C5D",
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: 1000,
    cursor: "pointer",
  },
  secondaryBtn: {
    height: 40,
    padding: "0 14px",
    borderRadius: 12,
    border: "1px solid rgba(15,23,42,0.10)",
    background: "#FFFFFF",
    color: "#0F172A",
    fontSize: 12,
    fontWeight: 1000,
    cursor: "pointer",
  },
  dangerBtn: {
    height: 40,
    padding: "0 14px",
    borderRadius: 12,
    border: "1px solid rgba(229,57,53,0.18)",
    background: "rgba(229,57,53,0.08)",
    color: "#B91C1C",
    fontSize: 12,
    fontWeight: 1000,
    cursor: "pointer",
  },
  btnDisabled: { opacity: 0.7, cursor: "not-allowed" },
  success: {
    padding: 12,
    borderRadius: 12,
    background: "rgba(46,139,87,0.10)",
    border: "1px solid rgba(46,139,87,0.20)",
    color: "#14532D",
    fontSize: 12,
    fontWeight: 900,
  },
  error: {
    padding: 12,
    borderRadius: 12,
    background: "rgba(229,57,53,0.10)",
    border: "1px solid rgba(229,57,53,0.20)",
    color: "#B91C1C",
    fontSize: 12,
    fontWeight: 900,
  },
  warning: {
    padding: 12,
    borderRadius: 12,
    background: "rgba(245,158,11,0.10)",
    border: "1px solid rgba(245,158,11,0.20)",
    color: "#92400E",
    fontSize: 12,
    fontWeight: 900,
  },
  hint: {
    padding: 10,
    borderRadius: 12,
    background: "rgba(11,60,93,0.06)",
    border: "1px solid rgba(11,60,93,0.10)",
    color: "#0B3C5D",
    fontSize: 12,
    fontWeight: 800,
  },
  emptyBox: {
    padding: 16,
    borderRadius: 14,
    border: "1px dashed rgba(15,23,42,0.18)",
    background: "rgba(100,116,139,0.06)",
    fontSize: 13,
    fontWeight: 800,
    color: "#475569",
    lineHeight: 1.5,
  },
  list: { display: "grid", gap: 12 },
  sessionCard: {
    display: "grid",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    border: "1px solid rgba(15,23,42,0.08)",
    background: "#FFFFFF",
  },
  sessionTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  sessionTitle: { fontSize: 17, fontWeight: 1000, color: "#0F172A" },
  sessionSub: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: 800,
    color: "#64748B",
  },
  statusChip: {
    display: "inline-flex",
    alignItems: "center",
    padding: "7px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 1000,
    whiteSpace: "nowrap",
  },
  statusActive: {
    background: "rgba(46,139,87,0.10)",
    border: "1px solid rgba(46,139,87,0.20)",
    color: "#14532D",
  },
  statusPaused: {
    background: "rgba(100,116,139,0.10)",
    border: "1px solid rgba(100,116,139,0.18)",
    color: "#334155",
  },
  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 10,
  },
  infoCard: {
    padding: 12,
    borderRadius: 12,
    background: "#F8FAFC",
    border: "1px solid rgba(15,23,42,0.06)",
  },
  infoLabel: { fontSize: 11, fontWeight: 900, color: "#64748B" },
  infoValue: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: 1000,
    color: "#0F172A",
  },
  sessionIdBox: {
    padding: 10,
    borderRadius: 12,
    background: "rgba(11,60,93,0.06)",
    color: "#0B3C5D",
    fontSize: 12,
    fontWeight: 800,
  },
  rulesBox: {
    padding: 12,
    borderRadius: 12,
    background: "rgba(11,60,93,0.06)",
    border: "1px solid rgba(11,60,93,0.10)",
    color: "#0B3C5D",
    fontSize: 12,
    fontWeight: 800,
    lineHeight: 1.5,
  },
  cardActions: { display: "flex", gap: 10, flexWrap: "wrap" },
};