"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
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

type FishingSpot = {
  id: string;
  ownerId: string;
  pesqueiroId: string;
  areaId: string;
  areaName: string;
  name: string;
  type: string;
  capacity: number;
  active: boolean;
  order: number;
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

function getSpotTypeLabel(type: string) {
  if (type === "deck") return "Deck";
  if (type === "platform") return "Plataforma";
  if (type === "kiosk") return "Quiosque";
  if (type === "cabin") return "Rancho / chalé";
  if (type === "shore") return "Margem";
  return "Outro";
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);
}

export default function FisheryAreasClient({ uid }: Props) {
  const [areas, setAreas] = useState<FisheryArea[]>([]);
  const [spots, setSpots] = useState<FishingSpot[]>([]);

  const [form, setForm] = useState<FormState>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [selectedAreaForSpots, setSelectedAreaForSpots] =
    useState<FisheryArea | null>(null);
  const [spotName, setSpotName] = useState("");
  const [spotType, setSpotType] = useState("deck");
  const [spotCapacity, setSpotCapacity] = useState("");
  const [savingSpot, setSavingSpot] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeCount = useMemo(
    () => areas.filter((item) => item.active).length,
    [areas]
  );

  const selectedAreaSpots = useMemo(() => {
    if (!selectedAreaForSpots) return [];

    return spots
      .filter((spot) => spot.areaId === selectedAreaForSpots.id)
      .sort((a, b) => {
        if (a.order !== b.order) return a.order - b.order;
        return a.name.localeCompare(b.name);
      });
  }, [spots, selectedAreaForSpots]);

  useEffect(() => {
    void loadAll();
  }, [uid]);

  async function loadAll() {
    setLoading(true);

    try {
      await Promise.all([loadAreas(), loadSpots()]);
    } finally {
      setLoading(false);
    }
  }

  async function loadAreas() {
    try {
      setError(null);

      const q = query(collection(db, "pesqueiroAreas"), where("ownerId", "==", uid));
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
      console.error("Erro ao carregar pesqueiroAreas:", e);
      setError(e?.message || "Não foi possível carregar as estruturas.");
    }
  }

  async function loadSpots() {
    try {
      const q = query(collection(db, "fishingSpots"), where("ownerId", "==", uid));
      const snap = await getDocs(q);

      const items: FishingSpot[] = snap.docs.map((item) => {
        const data = item.data() as any;

        return {
          id: item.id,
          ownerId: data?.ownerId ?? uid,
          pesqueiroId: data?.pesqueiroId ?? uid,
          areaId: data?.areaId ?? "",
          areaName: data?.areaName ?? "",
          name: data?.name ?? "Sem nome",
          type: data?.type ?? "deck",
          capacity: Number(data?.capacity ?? 0),
          active: data?.active !== false,
          order: Number(data?.order ?? 0),
        };
      });

      setSpots(items);
    } catch (e: any) {
      console.error("Erro ao carregar fishingSpots:", e);
      setError(e?.message || "Não foi possível carregar os locais reserváveis.");
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

  function resetSpotForm() {
    setSpotName("");
    setSpotType("deck");
    setSpotCapacity("");
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

  function openSpotsManager(area: FisheryArea) {
    setSelectedAreaForSpots(area);
    resetSpotForm();
    setMessage(null);
    setError(null);

    window.setTimeout(() => {
      const el = document.getElementById("fishery-spots-manager");
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
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
        setMessage("Estrutura salva com sucesso. Você pode cadastrar outra ou continuar.");
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

  async function handleSaveSpot(area: FisheryArea) {
    try {
      setSavingSpot(true);
      setError(null);
      setMessage(null);

      if (!spotName.trim()) {
        throw new Error("Informe o nome do local.");
      }

      if (toNumber(spotCapacity) <= 0) {
        throw new Error("Informe a capacidade do local.");
      }

      const currentAreaSpots = spots.filter((item) => item.areaId === area.id);

      await addDoc(collection(db, "fishingSpots"), {
        ownerId: uid,
        pesqueiroId: uid,

        areaId: area.id,
        areaName: area.name,

        name: spotName.trim(),
        type: spotType,
        capacity: toNumber(spotCapacity),
        active: true,
        order: currentAreaSpots.length + 1,

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      resetSpotForm();
      setMessage("Local reservável criado com sucesso.");
      await loadSpots();
    } catch (e: any) {
      setError(e?.message || "Não foi possível salvar o local.");
    } finally {
      setSavingSpot(false);
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

  async function toggleSpotActive(spot: FishingSpot) {
    try {
      setError(null);
      setMessage(null);

      await updateDoc(doc(db, "fishingSpots", spot.id), {
        active: !spot.active,
        updatedAt: serverTimestamp(),
      });

      setMessage(spot.active ? "Local pausado." : "Local ativado.");
      await loadSpots();
    } catch (e: any) {
      setError(e?.message || "Não foi possível alterar o local.");
    }
  }

  async function removeArea(area: FisheryArea) {
    const areaSpotsCount = spots.filter((spot) => spot.areaId === area.id).length;

    const ok = window.confirm(
      areaSpotsCount > 0
        ? `A estrutura "${area.name}" possui ${areaSpotsCount} local(is) reservável(is). Exclua ou pause os locais antes de excluir a estrutura.`
        : `Tem certeza que deseja excluir "${area.name}"? Essa ação não pode ser desfeita.`
    );

    if (!ok) return;
    if (areaSpotsCount > 0) return;

    try {
      setError(null);
      setMessage(null);

      await deleteDoc(doc(db, "pesqueiroAreas", area.id));

      if (editingId === area.id) resetForm();
      if (selectedAreaForSpots?.id === area.id) setSelectedAreaForSpots(null);

      setMessage("Estrutura excluída com sucesso.");
      await loadAreas();
    } catch (e: any) {
      setError(e?.message || "Não foi possível excluir a estrutura.");
    }
  }

  async function removeSpot(spot: FishingSpot) {
    const ok = window.confirm(`Excluir "${spot.name}"? Essa ação não pode ser desfeita.`);
    if (!ok) return;

    try {
      setError(null);
      setMessage(null);

      await deleteDoc(doc(db, "fishingSpots", spot.id));
      setMessage("Local excluído com sucesso.");
      await loadSpots();
    } catch (e: any) {
      setError(e?.message || "Não foi possível excluir o local.");
    }
  }

  if (loading) {
    return (
      <div style={styles.wrap}>
        <div style={styles.card}>
          <div style={styles.title}>Estruturas do pesqueiro</div>
          <div style={styles.sub}>Carregando estruturas e locais...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.hero}>
        <div style={styles.heroText}>
          <div style={styles.stepLabel}>Etapa 2 de 4</div>
          <div style={styles.title}>Estruturas do pesqueiro</div>
          <div style={styles.sub}>
            Cadastre as estruturas principais e, dentro delas, os locais
            reserváveis que o pescador poderá escolher no app.
          </div>
        </div>

        <div style={styles.statusChip}>
          {activeCount} estruturas ativas · {spots.length} locais cadastrados
        </div>
      </div>

      <form onSubmit={handleSave} style={styles.formCard}>
        <div style={styles.sectionTitle}>
          {editingId ? "Editar estrutura principal" : "Nova estrutura principal"}
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
          <Field
            label="Nome da estrutura"
            value={form.name}
            onChange={(v) => updateField("name", v)}
            placeholder="Ex: Rancho Família"
          />
        ) : null}

        <TextAreaField
          label="Descrição"
          value={form.description}
          onChange={(v) => updateField("description", v)}
          placeholder="Descreva a estrutura, localização dentro do pesqueiro e diferenciais."
        />

        <div style={styles.grid2}>
          <Field
            label="Capacidade total da estrutura"
            value={form.capacity}
            onChange={(v) => updateField("capacity", v)}
            placeholder="Ex: 30"
          />

          <Field
            label="Reservas simultâneas"
            value={form.maxReservations}
            onChange={(v) => updateField("maxReservations", v)}
            placeholder="Ex: 10"
          />
        </div>

        <Field
          label="Preço base"
          value={form.price}
          onChange={(v) => updateField("price", v)}
          placeholder="Ex: 120"
        />

        <TextAreaField
          label="Regras específicas"
          value={form.rules}
          onChange={(v) => updateField("rules", v)}
          placeholder="Ex: permitido até 4 varas, proibido ceva externa..."
        />

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
                : "Salvar estrutura"}
          </button>
        </div>
      </form>

      <section style={styles.card}>
        <div style={styles.sectionHeader}>
          <div>
            <div style={styles.sectionTitle}>Estruturas cadastradas</div>
            <div style={styles.sectionSub}>
              Depois de criar uma estrutura, cadastre os locais reserváveis dentro
              dela, como decks, plataformas, quiosques ou pontos de pesca.
            </div>
          </div>
        </div>

        {areas.length === 0 ? (
          <div style={styles.emptyBox}>
            Nenhuma estrutura cadastrada ainda. Cadastre pelo menos uma estrutura
            antes de avançar para sessões.
          </div>
        ) : (
          <div style={styles.list}>
            {areas.map((area) => {
              const areaSpots = spots.filter((spot) => spot.areaId === area.id);
              const activeSpots = areaSpots.filter((spot) => spot.active);

              return (
                <article key={area.id} style={styles.areaCard}>
                  <div style={styles.areaTop}>
                    <div style={styles.areaTitleBox}>
                      <div style={styles.areaTitle}>{area.name}</div>
                      <div style={styles.areaType}>
                        {getTypeLabel(area.type, area.customTypeLabel)}
                      </div>
                    </div>

                    <span
                      style={{
                        ...styles.areaStatusChip,
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
                    <Info
                      label="Locais"
                      value={`${activeSpots.length} ativos · ${areaSpots.length} total`}
                    />
                  </div>

                  {area.rules ? (
                    <div style={styles.rulesBox}>
                      <strong>Regras:</strong> {area.rules}
                    </div>
                  ) : null}

                  <div style={styles.cardActions}>
                    <button
                      type="button"
                      onClick={() => openSpotsManager(area)}
                      style={styles.primaryBtnSmall}
                    >
                      Gerenciar locais
                    </button>

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
              );
            })}
          </div>
        )}
      </section>

      {selectedAreaForSpots ? (
        <section id="fishery-spots-manager" style={styles.card}>
          <div style={styles.sectionHeader}>
            <div>
              <div style={styles.sectionTitle}>
                Locais reserváveis · {selectedAreaForSpots.name}
              </div>
              <div style={styles.sectionSub}>
                Cadastre decks, plataformas, quiosques, ranchos ou pontos
                específicos dentro desta estrutura.
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectedAreaForSpots(null);
                resetSpotForm();
              }}
              style={styles.secondaryBtn}
            >
              Fechar
            </button>
          </div>

          <div style={styles.formCardSoft}>
            <div style={styles.grid2}>
              <Field
                label="Nome do local"
                value={spotName}
                onChange={setSpotName}
                placeholder="Ex: Deck 01"
              />

              <label style={styles.labelWrap}>
                <span style={styles.label}>Tipo</span>
                <select
                  value={spotType}
                  onChange={(e) => setSpotType(e.target.value)}
                  style={styles.input}
                >
                  <option value="deck">Deck</option>
                  <option value="platform">Plataforma</option>
                  <option value="kiosk">Quiosque</option>
                  <option value="cabin">Rancho / chalé</option>
                  <option value="shore">Margem</option>
                  <option value="other">Outro</option>
                </select>
              </label>
            </div>

            <Field
              label="Capacidade do local"
              value={spotCapacity}
              onChange={setSpotCapacity}
              placeholder="Ex: 4"
            />

            <div style={styles.actions}>
              <button
                type="button"
                onClick={() => handleSaveSpot(selectedAreaForSpots)}
                disabled={savingSpot}
                style={{
                  ...styles.primaryBtn,
                  ...(savingSpot ? styles.btnDisabled : {}),
                }}
              >
                {savingSpot ? "Salvando..." : "Salvar local"}
              </button>
            </div>
          </div>

          {selectedAreaSpots.length === 0 ? (
            <div style={styles.emptyBox}>
              Nenhum local criado para esta estrutura. Crie o primeiro local
              reservável para o pescador escolher no app.
            </div>
          ) : (
            <div style={styles.list}>
              {selectedAreaSpots.map((spot) => (
                <article key={spot.id} style={styles.spotCard}>
                  <div style={styles.areaTop}>
                    <div style={styles.areaTitleBox}>
                      <div style={styles.areaTitle}>{spot.name}</div>
                      <div style={styles.areaType}>
                        {getSpotTypeLabel(spot.type)} · {spot.capacity || 0} pessoas
                      </div>
                    </div>

                    <span
                      style={{
                        ...styles.areaStatusChip,
                        ...(spot.active ? styles.statusActive : styles.statusPaused),
                      }}
                    >
                      {spot.active ? "Ativo" : "Pausado"}
                    </span>
                  </div>

                  <div style={styles.cardActions}>
                    <button
                      type="button"
                      onClick={() => toggleSpotActive(spot)}
                      style={styles.secondaryBtn}
                    >
                      {spot.active ? "Pausar" : "Ativar"}
                    </button>

                    <button
                      type="button"
                      onClick={() => removeSpot(spot)}
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
      ) : null}

      <section style={styles.footerCard}>
        <div style={styles.footerText}>
          <div style={styles.sectionTitle}>Próxima etapa</div>
          <div style={styles.sectionSub}>
            Cadastre todas as estruturas e locais necessários. Depois configure
            horários, vagas e preços das sessões.
          </div>
        </div>

        <div style={styles.footerActions}>
          <Link href="/seller/fishery/profile" style={styles.secondaryLink}>
            Voltar ao cadastro
          </Link>

          <Link
            href="/seller/fishery/sessions"
            style={{
              ...styles.primaryLink,
              ...(areas.length === 0 ? styles.linkDisabled : {}),
            }}
            aria-disabled={areas.length === 0}
          >
            Continuar para sessões
          </Link>
        </div>
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
        rows={5}
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

const baseBox: CSSProperties = {
  width: "100%",
  maxWidth: "100%",
  minWidth: 0,
  boxSizing: "border-box",
};

const styles: Record<string, CSSProperties> = {
  wrap: {
    ...baseBox,
    display: "grid",
    gap: 14,
    overflowX: "hidden",
  },

  hero: {
    ...baseBox,
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
    padding: 18,
    borderRadius: 18,
    background: "#FFFFFF",
    border: "1px solid rgba(15,23,42,0.08)",
    boxShadow: "0 10px 24px rgba(15,23,42,0.06)",
    flexWrap: "wrap",
    overflow: "hidden",
  },

  heroText: {
    minWidth: 0,
    flex: "1 1 280px",
  },

  card: {
    ...baseBox,
    padding: 18,
    borderRadius: 18,
    background: "#FFFFFF",
    border: "1px solid rgba(15,23,42,0.08)",
    boxShadow: "0 10px 24px rgba(15,23,42,0.06)",
    overflow: "hidden",
  },

  footerCard: {
    ...baseBox,
    padding: 18,
    borderRadius: 18,
    background: "#FFFFFF",
    border: "1px solid rgba(15,23,42,0.08)",
    boxShadow: "0 10px 24px rgba(15,23,42,0.06)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
    flexWrap: "wrap",
    overflow: "hidden",
  },

  footerText: {
    minWidth: 0,
    flex: "1 1 260px",
  },

  stepLabel: {
    fontSize: 11,
    fontWeight: 1000,
    color: "#0B3C5D",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },

  title: {
    fontSize: 22,
    fontWeight: 1000,
    color: "#0F172A",
    wordBreak: "break-word",
  },

  sub: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: 700,
    color: "#475569",
    lineHeight: 1.5,
    wordBreak: "break-word",
  },

  statusChip: {
    maxWidth: "100%",
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(100,116,139,0.10)",
    border: "1px solid rgba(100,116,139,0.18)",
    color: "#334155",
    fontSize: 12,
    fontWeight: 1000,
  },

  formCard: {
    ...baseBox,
    padding: 18,
    borderRadius: 18,
    background: "#FFFFFF",
    border: "1px solid rgba(15,23,42,0.08)",
    boxShadow: "0 10px 24px rgba(15,23,42,0.06)",
    display: "grid",
    gap: 14,
    overflow: "hidden",
  },

  formCardSoft: {
    ...baseBox,
    padding: 14,
    borderRadius: 16,
    background: "#F8FAFC",
    border: "1px solid rgba(15,23,42,0.08)",
    display: "grid",
    gap: 14,
    marginBottom: 14,
  },

  sectionHeader: {
    ...baseBox,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14,
    flexWrap: "wrap",
  },

  sectionTitle: {
    fontSize: 14,
    fontWeight: 1000,
    color: "#0F172A",
    marginTop: 4,
  },

  sectionSub: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: 700,
    color: "#64748B",
    lineHeight: 1.5,
  },

  grid2: {
    ...baseBox,
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  },

  labelWrap: {
    ...baseBox,
    display: "grid",
    gap: 8,
  },

  label: {
    fontSize: 12,
    fontWeight: 900,
    color: "#334155",
  },

  input: {
    ...baseBox,
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
    ...baseBox,
    borderRadius: 12,
    border: "1px solid rgba(15,23,42,0.12)",
    background: "#FFFFFF",
    padding: 12,
    fontSize: 14,
    fontWeight: 700,
    color: "#0F172A",
    outline: "none",
    resize: "vertical",
    minHeight: 120,
    fontFamily: "system-ui, sans-serif",
  },

  checkItem: {
    ...baseBox,
    minHeight: 44,
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(15,23,42,0.10)",
    background: "rgba(248,250,252,0.9)",
    cursor: "pointer",
    flexWrap: "wrap",
  },

  checkbox: {
    width: 16,
    height: 16,
    accentColor: "#0B3C5D",
    cursor: "pointer",
    flexShrink: 0,
  },

  checkLabel: {
    minWidth: 0,
    fontSize: 13,
    fontWeight: 900,
    color: "#334155",
  },

  actions: {
    ...baseBox,
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 4,
  },

  footerActions: {
    display: "flex",
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

  primaryBtnSmall: {
    height: 40,
    padding: "0 14px",
    borderRadius: 12,
    border: "1px solid rgba(15,23,42,0.10)",
    background: "#0B3C5D",
    color: "#FFFFFF",
    fontSize: 12,
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

  primaryLink: {
    height: 44,
    padding: "0 18px",
    borderRadius: 12,
    border: "1px solid rgba(15,23,42,0.10)",
    background: "#0B3C5D",
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: 1000,
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },

  secondaryLink: {
    height: 44,
    padding: "0 18px",
    borderRadius: 12,
    border: "1px solid rgba(15,23,42,0.10)",
    background: "#FFFFFF",
    color: "#0F172A",
    fontSize: 13,
    fontWeight: 1000,
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },

  linkDisabled: {
    opacity: 0.45,
    pointerEvents: "none",
    cursor: "not-allowed",
  },

  btnDisabled: {
    opacity: 0.7,
    cursor: "not-allowed",
  },

  success: {
    ...baseBox,
    padding: 12,
    borderRadius: 12,
    background: "rgba(46,139,87,0.10)",
    border: "1px solid rgba(46,139,87,0.20)",
    color: "#14532D",
    fontSize: 12,
    fontWeight: 900,
  },

  error: {
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
    padding: 12,
    borderRadius: 12,
    background: "rgba(229,57,53,0.10)",
    border: "1px solid rgba(229,57,53,0.20)",
    color: "#B91C1C",
    fontSize: 12,
    fontWeight: 900,
    overflowWrap: "anywhere",
    wordBreak: "break-word",
    whiteSpace: "pre-wrap",
    lineHeight: 1.5,
    boxSizing: "border-box",
  },

  emptyBox: {
    ...baseBox,
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
    ...baseBox,
    display: "grid",
    gap: 12,
  },

  areaCard: {
    ...baseBox,
    display: "grid",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    border: "1px solid rgba(15,23,42,0.08)",
    background: "#FFFFFF",
  },

  spotCard: {
    ...baseBox,
    display: "grid",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    border: "1px solid rgba(11,60,93,0.12)",
    background: "rgba(11,60,93,0.035)",
  },

  areaTop: {
    ...baseBox,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap",
  },

  areaTitleBox: {
    minWidth: 0,
    flex: "1 1 220px",
  },

  areaTitle: {
    fontSize: 17,
    fontWeight: 1000,
    color: "#0F172A",
    wordBreak: "break-word",
  },

  areaType: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: 800,
    color: "#64748B",
  },

  areaStatusChip: {
    display: "inline-flex",
    alignItems: "center",
    padding: "7px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 1000,
    flexShrink: 0,
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
    wordBreak: "break-word",
  },

  infoGrid: {
    ...baseBox,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 10,
  },

  infoCard: {
    ...baseBox,
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
    wordBreak: "break-word",
  },

  rulesBox: {
    ...baseBox,
    padding: 12,
    borderRadius: 12,
    background: "rgba(11,60,93,0.06)",
    border: "1px solid rgba(11,60,93,0.10)",
    color: "#0B3C5D",
    fontSize: 12,
    fontWeight: 800,
    lineHeight: 1.5,
    wordBreak: "break-word",
  },

  cardActions: {
    ...baseBox,
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
};