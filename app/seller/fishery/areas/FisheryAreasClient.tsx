"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
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

type AreaType =
  | "lake"
  | "kiosk"
  | "platform"
  | "deck"
  | "cabin"
  | "boat"
  | "other";

type FisheryArea = {
  id: string;
  pesqueiroId: string;
  ownerId: string;
  type: AreaType;
  customTypeLabel: string;
  name: string;
  description: string;
  capacity: number;
  maxReservations: number;
  price: number;
  rules: string;
  active: boolean;
};

type FormState = {
  type: AreaType;
  customTypeLabel: string;
  name: string;
  description: string;
  capacity: string;
  maxReservations: string;
  price: string;
  rules: string;
  active: boolean;
};

const initialForm: FormState = {
  type: "lake",
  customTypeLabel: "",
  name: "",
  description: "",
  capacity: "",
  maxReservations: "",
  price: "",
  rules: "",
  active: true,
};

function toNumber(value: string) {
  const n = Number(String(value || "0").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function getTypeLabel(type: AreaType, customTypeLabel?: string) {
  if (type === "lake") return "Lago / tanque";
  if (type === "kiosk") return "Quiosque";
  if (type === "platform") return "Plataforma";
  if (type === "deck") return "Deck";
  if (type === "cabin") return "Chalé / rancho";
  if (type === "boat") return "Barco";
  return customTypeLabel || "Outro";
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);
}

export default function FisheryAreasClient({ uid }: Props) {
  const [areas, setAreas] = useState<FisheryArea[]>([]);
  const [form, setForm] = useState<FormState>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeCount = useMemo(
    () => areas.filter((item) => item.active).length,
    [areas]
  );

  useEffect(() => {
    void loadAreas();
  }, [uid]);

  async function loadAreas() {
    try {
      setLoading(true);
      setError(null);

      const q = query(
        collection(db, "pesqueiroAreas"),
        where("ownerId", "==", uid),
        orderBy("createdAt", "desc")
      );

      const snap = await getDocs(q);

      const items: FisheryArea[] = snap.docs.map((item) => {
        const data = item.data() as any;

        return {
          id: item.id,
          pesqueiroId: data?.pesqueiroId ?? uid,
          ownerId: data?.ownerId ?? uid,
          type: data?.type ?? "other",
          customTypeLabel: data?.customTypeLabel ?? "",
          name: data?.name ?? "Sem nome",
          description: data?.description ?? "",
          capacity: Number(data?.capacity ?? 0),
          maxReservations: Number(data?.maxReservations ?? 0),
          price: Number(data?.price ?? 0),
          rules: data?.rules ?? "",
          active: data?.active !== false,
        };
      });

      setAreas(items);
    } catch (e: any) {
      setError(e?.message || "Não foi possível carregar as estruturas.");
    } finally {
      setLoading(false);
    }
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

  function startEdit(area: FisheryArea) {
    setEditingId(area.id);
    setForm({
      type: area.type,
      customTypeLabel: area.customTypeLabel || "",
      name: area.name || "",
      description: area.description || "",
      capacity: String(area.capacity || ""),
      maxReservations: String(area.maxReservations || ""),
      price: String(area.price || ""),
      rules: area.rules || "",
      active: area.active,
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();

    try {
      setSaving(true);
      setError(null);
      setMessage(null);

      if (!form.name.trim()) {
        throw new Error("Informe o nome da estrutura.");
      }

      if (form.type === "other" && !form.customTypeLabel.trim()) {
        throw new Error("Informe como essa estrutura é chamada no pesqueiro.");
      }

      const payload = {
        pesqueiroId: uid,
        ownerId: uid,
        type: form.type,
        customTypeLabel:
          form.type === "other" ? form.customTypeLabel.trim() : "",
        name: form.name.trim(),
        description: form.description.trim(),
        capacity: toNumber(form.capacity),
        maxReservations: toNumber(form.maxReservations),
        price: toNumber(form.price),
        rules: form.rules.trim(),
        active: form.active,
        updatedAt: serverTimestamp(),
      };

      if (editingId) {
        await updateDoc(doc(db, "pesqueiroAreas", editingId), payload);
        setMessage("Estrutura atualizada com sucesso.");
      } else {
        await addDoc(collection(db, "pesqueiroAreas"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        setMessage("Estrutura criada com sucesso.");
      }

      setForm(initialForm);
      setEditingId(null);
      await loadAreas();
    } catch (e: any) {
      setError(e?.message || "Não foi possível salvar a estrutura.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(area: FisheryArea) {
    try {
      setError(null);
      setMessage(null);

      await updateDoc(doc(db, "pesqueiroAreas", area.id), {
        active: !area.active,
        updatedAt: serverTimestamp(),
      });

      setMessage(area.active ? "Estrutura pausada." : "Estrutura ativada.");
      await loadAreas();
    } catch (e: any) {
      setError(e?.message || "Não foi possível alterar o status.");
    }
  }

  async function removeArea(area: FisheryArea) {
    const ok = window.confirm(
      `Tem certeza que deseja excluir "${area.name}"? Essa ação não pode ser desfeita.`
    );

    if (!ok) return;

    try {
      setError(null);
      setMessage(null);

      await deleteDoc(doc(db, "pesqueiroAreas", area.id));

      if (editingId === area.id) resetForm();

      setMessage("Estrutura excluída com sucesso.");
      await loadAreas();
    } catch (e: any) {
      setError(e?.message || "Não foi possível excluir a estrutura.");
    }
  }

  if (loading) {
    return (
      <div style={styles.wrap}>
        <div style={styles.card}>
          <div style={styles.title}>Estruturas do pesqueiro</div>
          <div style={styles.sub}>Carregando estruturas...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      <section style={styles.hero}>
        <div>
          <div style={styles.title}>Estruturas do pesqueiro</div>
          <div style={styles.sub}>
            Cadastre lagos, quiosques, plataformas, decks, barcos ou qualquer
            estrutura que possa ser reservada.
          </div>
        </div>

        <div style={styles.statPill}>
          {activeCount} ativas · {areas.length} cadastradas
        </div>
      </section>

      <form onSubmit={handleSave} style={styles.formCard}>
        <div style={styles.sectionTitle}>
          {editingId ? "Editar estrutura" : "Nova estrutura"}
        </div>

        <div style={styles.grid2}>
          <label style={styles.labelWrap}>
            <span style={styles.label}>Tipo</span>
            <select
              value={form.type}
              onChange={(e) => updateField("type", e.target.value as AreaType)}
              style={styles.input}
            >
              <option value="lake">Lago / tanque</option>
              <option value="kiosk">Quiosque</option>
              <option value="platform">Plataforma</option>
              <option value="deck">Deck</option>
              <option value="cabin">Chalé / rancho</option>
              <option value="boat">Barco</option>
              <option value="other">Outro</option>
            </select>
          </label>

          {form.type === "other" ? (
            <Field
              label="Como o pesqueiro chama essa estrutura?"
              value={form.customTypeLabel}
              onChange={(v) => updateField("customTypeLabel", v)}
              placeholder="Ex: Rancho, Área VIP, Ponto de pesca"
            />
          ) : (
            <Field
              label="Nome da estrutura"
              value={form.name}
              onChange={(v) => updateField("name", v)}
              placeholder="Ex: Lago esportivo"
            />
          )}
        </div>

        {form.type === "other" ? (
          <div style={styles.grid1}>
            <Field
              label="Nome da estrutura"
              value={form.name}
              onChange={(v) => updateField("name", v)}
              placeholder="Ex: Rancho Família"
            />
          </div>
        ) : null}

        <div style={styles.grid1}>
          <TextAreaField
            label="Descrição"
            value={form.description}
            onChange={(v) => updateField("description", v)}
            placeholder="Descreva a estrutura, localização dentro do pesqueiro e diferenciais."
          />
        </div>

        <div style={styles.grid3}>
          <Field
            label="Capacidade de pessoas"
            value={form.capacity}
            onChange={(v) => updateField("capacity", v)}
            placeholder="Ex: 8"
          />

          <Field
            label="Reservas simultâneas"
            value={form.maxReservations}
            onChange={(v) => updateField("maxReservations", v)}
            placeholder="Ex: 1"
          />

          <Field
            label="Preço base"
            value={form.price}
            onChange={(v) => updateField("price", v)}
            placeholder="Ex: 120"
          />
        </div>

        <div style={styles.grid1}>
          <TextAreaField
            label="Regras específicas"
            value={form.rules}
            onChange={(v) => updateField("rules", v)}
            placeholder="Ex: permitido até 4 varas, proibido ceva externa, uso obrigatório de passaguá..."
          />
        </div>

        <label style={styles.checkItem}>
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => updateField("active", e.target.checked)}
            style={styles.checkbox}
          />
          <span style={styles.checkLabel}>Estrutura ativa para futuras reservas</span>
        </label>

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
            disabled={saving}
            style={{
              ...styles.primaryBtn,
              ...(saving ? styles.btnDisabled : {}),
            }}
          >
            {saving
              ? "Salvando..."
              : editingId
              ? "Salvar alterações"
              : "Criar estrutura"}
          </button>
        </div>
      </form>

      <section style={styles.card}>
        <div style={styles.sectionHeader}>
          <div>
            <div style={styles.sectionTitle}>Estruturas cadastradas</div>
            <div style={styles.sectionSub}>
              Essas estruturas serão usadas depois para criar sessões, reservas
              e fila digital.
            </div>
          </div>
        </div>

        {areas.length === 0 ? (
          <div style={styles.emptyBox}>
            Nenhuma estrutura cadastrada ainda. Crie o primeiro lago, quiosque,
            plataforma ou área reservável.
          </div>
        ) : (
          <div style={styles.list}>
            {areas.map((area) => (
              <article key={area.id} style={styles.areaCard}>
                <div style={styles.areaTop}>
                  <div>
                    <div style={styles.areaTitle}>{area.name}</div>
                    <div style={styles.areaType}>
                      {getTypeLabel(area.type, area.customTypeLabel)}
                    </div>
                  </div>

                  <span
                    style={{
                      ...styles.statusChip,
                      ...(area.active ? styles.statusActive : styles.statusPaused),
                    }}
                  >
                    {area.active ? "Ativa" : "Pausada"}
                  </span>
                </div>

                {area.description ? (
                  <div style={styles.description}>{area.description}</div>
                ) : null}

                <div style={styles.infoGrid}>
                  <Info label="Capacidade" value={`${area.capacity || 0} pessoas`} />
                  <Info
                    label="Reservas"
                    value={`${area.maxReservations || 0} simultâneas`}
                  />
                  <Info label="Preço base" value={formatMoney(area.price)} />
                </div>

                {area.rules ? (
                  <div style={styles.rulesBox}>
                    <strong>Regras:</strong> {area.rules}
                  </div>
                ) : null}

                <div style={styles.cardActions}>
                  <button
                    type="button"
                    onClick={() => startEdit(area)}
                    style={styles.secondaryBtn}
                  >
                    Editar
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleActive(area)}
                    style={styles.secondaryBtn}
                  >
                    {area.active ? "Pausar" : "Ativar"}
                  </button>

                  <button
                    type="button"
                    onClick={() => removeArea(area)}
                    style={styles.dangerBtn}
                  >
                    Excluir
                  </button>
                </div>
              </article>
            ))}
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label style={styles.labelWrap}>
      <span style={styles.label}>{label}</span>
      <input
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
  wrap: {
    display: "grid",
    gap: 14,
  },
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
  title: {
    fontSize: 24,
    fontWeight: 1000,
    color: "#0F172A",
  },
  sub: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: 700,
    color: "#475569",
    lineHeight: 1.5,
    maxWidth: 760,
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
  sectionTitle: {
    fontSize: 15,
    fontWeight: 1000,
    color: "#0F172A",
  },
  sectionSub: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: 700,
    color: "#64748B",
    lineHeight: 1.5,
  },
  grid1: {
    display: "grid",
    gap: 12,
  },
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
  labelWrap: {
    display: "grid",
    gap: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: 900,
    color: "#334155",
  },
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
  checkLabel: {
    fontSize: 13,
    fontWeight: 900,
    color: "#334155",
  },
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
  btnDisabled: {
    opacity: 0.7,
    cursor: "not-allowed",
  },
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
  list: {
    display: "grid",
    gap: 12,
  },
  areaCard: {
    display: "grid",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    border: "1px solid rgba(15,23,42,0.08)",
    background: "#FFFFFF",
  },
  areaTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  areaTitle: {
    fontSize: 17,
    fontWeight: 1000,
    color: "#0F172A",
  },
  areaType: {
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
  description: {
    fontSize: 13,
    fontWeight: 700,
    color: "#475569",
    lineHeight: 1.6,
  },
  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 10,
  },
  infoCard: {
    padding: 12,
    borderRadius: 12,
    background: "#F8FAFC",
    border: "1px solid rgba(15,23,42,0.06)",
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: 900,
    color: "#64748B",
  },
  infoValue: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: 1000,
    color: "#0F172A",
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
  cardActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
};