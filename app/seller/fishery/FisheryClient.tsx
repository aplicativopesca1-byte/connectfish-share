"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from "firebase/storage";
import { db, storage } from "../../../src/lib/firebase";

type FisheryClientProps = {
  uid: string;
};

type FormState = {
  name: string;
  description: string;
  city: string;
  state: string;
  fishTypesText: string;
  openHoursStart: string;
  openHoursEnd: string;
  phone: string;
  whatsapp: string;
  instagram: string;
  address: string;
  latitude: string;
  longitude: string;

  rules: string;
  cancellationPolicy: string;

  restaurant: boolean;
  parking: boolean;
  bathroom: boolean;
  fishCleaningArea: boolean;
  baitShop: boolean;
  boatRental: boolean;
  accessibility: boolean;

  lakesCount: string;
  kiosksCount: string;
  platformsCount: string;
  decksCount: string;
  cabinsCount: string;
  boatsAvailable: string;
};

type ExistingImage = {
  url: string;
  path?: string;
};

const initialForm: FormState = {
  name: "",
  description: "",
  city: "",
  state: "",
  fishTypesText: "",
  openHoursStart: "",
  openHoursEnd: "",
  phone: "",
  whatsapp: "",
  instagram: "",
  address: "",
  latitude: "",
  longitude: "",

  rules: "",
  cancellationPolicy: "",

  restaurant: false,
  parking: false,
  bathroom: false,
  fishCleaningArea: false,
  baitShop: false,
  boatRental: false,
  accessibility: false,

  lakesCount: "",
  kiosksCount: "",
  platformsCount: "",
  decksCount: "",
  cabinsCount: "",
  boatsAvailable: "",
};

function parseFishTypes(input: string) {
  return input
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function slugifyFileName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .toLowerCase();
}

function toNumber(value: string) {
  const normalized = Number(value || 0);
  return Number.isFinite(normalized) ? normalized : 0;
}

function buildLocationQuery(form: FormState) {
  const parts = [form.address, form.city, form.state, "Brasil"]
    .map((item) => item.trim())
    .filter(Boolean);

  return parts.join(", ");
}

export default function FisheryClient({ uid }: FisheryClientProps) {
  const router = useRouter();

  const [form, setForm] = useState<FormState>(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [resolvingLocation, setResolvingLocation] = useState(false);
  const [hasExistingDoc, setHasExistingDoc] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [images, setImages] = useState<ExistingImage[]>([]);
  const [coverImage, setCoverImage] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fisheryRef = useMemo(() => doc(db, "pesqueiros", uid), [uid]);

  useEffect(() => {
    let alive = true;

    async function loadFishery() {
      try {
        setLoading(true);
        setError(null);
        setMessage(null);

        const snap = await getDoc(fisheryRef);

        if (!alive) return;

        if (!snap.exists()) {
          setHasExistingDoc(false);
          setForm(initialForm);
          setImages([]);
          setCoverImage("");
          return;
        }

        const data = snap.data() as any;

        setHasExistingDoc(true);
        setForm({
          name: data?.name ?? "",
          description: data?.description ?? "",
          city: data?.city ?? "",
          state: data?.state ?? "",
          fishTypesText: Array.isArray(data?.fishTypes)
            ? data.fishTypes.join(", ")
            : "",
          openHoursStart: data?.openHoursStart ?? "",
          openHoursEnd: data?.openHoursEnd ?? "",
          phone: data?.phone ?? "",
          whatsapp: data?.whatsapp ?? "",
          instagram: data?.instagram ?? "",
          address: data?.address ?? "",
          latitude:
            data?.location?.latitude !== null &&
            data?.location?.latitude !== undefined
              ? String(data.location.latitude)
              : "",
          longitude:
            data?.location?.longitude !== null &&
            data?.location?.longitude !== undefined
              ? String(data.location.longitude)
              : "",

          rules: data?.rules ?? "",
          cancellationPolicy: data?.cancellationPolicy ?? "",

          restaurant: Boolean(data?.amenities?.restaurant),
          parking: Boolean(data?.amenities?.parking),
          bathroom: Boolean(data?.amenities?.bathroom),
          fishCleaningArea: Boolean(data?.amenities?.fishCleaningArea),
          baitShop: Boolean(data?.amenities?.baitShop),
          boatRental: Boolean(data?.amenities?.boatRental),
          accessibility: Boolean(data?.amenities?.accessibility),

          lakesCount:
            data?.structureSummary?.lakesCount !== undefined
              ? String(data.structureSummary.lakesCount)
              : "",
          kiosksCount:
            data?.structureSummary?.kiosksCount !== undefined
              ? String(data.structureSummary.kiosksCount)
              : "",
          platformsCount:
            data?.structureSummary?.platformsCount !== undefined
              ? String(data.structureSummary.platformsCount)
              : "",
          decksCount:
            data?.structureSummary?.decksCount !== undefined
              ? String(data.structureSummary.decksCount)
              : "",
          cabinsCount:
            data?.structureSummary?.cabinsCount !== undefined
              ? String(data.structureSummary.cabinsCount)
              : "",
          boatsAvailable:
            data?.structureSummary?.boatsAvailable !== undefined
              ? String(data.structureSummary.boatsAvailable)
              : "",
        });

        setImages(Array.isArray(data?.images) ? data.images : []);
        setCoverImage(data?.coverImage ?? "");
      } catch (e: any) {
        setError(e?.message || "Não foi possível carregar os dados do pesqueiro.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadFishery();

    return () => {
      alive = false;
    };
  }, [fisheryRef]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleResolveLocation() {
    try {
      setResolvingLocation(true);
      setError(null);
      setMessage(null);

      const query = buildLocationQuery(form);

      if (!query) {
        throw new Error("Preencha o endereço antes de buscar a localização.");
      }

      const params = new URLSearchParams({
        q: query,
        format: "jsonv2",
        limit: "1",
        addressdetails: "1",
      });

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?${params.toString()}`,
        {
          headers: {
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Não foi possível consultar a localização agora.");
      }

      const data = (await response.json()) as Array<{
        lat: string;
        lon: string;
        display_name?: string;
      }>;

      if (!Array.isArray(data) || data.length === 0) {
        throw new Error(
          "Não encontramos esse endereço. Tente informar rua/estrada, cidade e estado."
        );
      }

      const first = data[0];

      setForm((prev) => ({
        ...prev,
        latitude: first.lat ?? "",
        longitude: first.lon ?? "",
      }));

      setMessage("Localização encontrada com sucesso. Confira as coordenadas antes de salvar.");
    } catch (e: any) {
      setError(e?.message || "Não foi possível localizar o endereço.");
    } finally {
      setResolvingLocation(false);
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    try {
      setUploadingImages(true);
      setError(null);
      setMessage(null);

      const uploaded: ExistingImage[] = [];

      for (const file of files) {
        const safeName = slugifyFileName(file.name || "imagem.jpg");
        const filePath = `pesqueiros/${uid}/${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}-${safeName}`;

        const storageRef = ref(storage, filePath);
        await uploadBytes(storageRef, file, {
          contentType: file.type || "image/jpeg",
        });

        const url = await getDownloadURL(storageRef);
        uploaded.push({ url, path: filePath });
      }

      const nextImages = [...images, ...uploaded];
      const nextCoverImage = coverImage || uploaded[0]?.url || "";

      setImages(nextImages);
      setCoverImage(nextCoverImage);

      await setDoc(
        fisheryRef,
        {
          ownerId: uid,
          images: nextImages,
          coverImage: nextCoverImage,
          updatedAt: serverTimestamp(),
          ...(hasExistingDoc ? {} : { createdAt: serverTimestamp() }),
        },
        { merge: true }
      );

      setHasExistingDoc(true);
      setMessage("Fotos enviadas com sucesso.");
    } catch (e: any) {
      setError(e?.message || "Não foi possível enviar as fotos.");
    } finally {
      setUploadingImages(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleRemoveImage(image: ExistingImage) {
    try {
      setError(null);
      setMessage(null);

      if (image.path) {
        const storageRef = ref(storage, image.path);
        await deleteObject(storageRef).catch(() => {});
      }

      const nextImages = images.filter((item) => item.url !== image.url);
      const nextCoverImage =
        coverImage === image.url ? nextImages[0]?.url || "" : coverImage;

      setImages(nextImages);
      setCoverImage(nextCoverImage);

      await setDoc(
        fisheryRef,
        {
          ownerId: uid,
          images: nextImages,
          coverImage: nextCoverImage,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setMessage("Foto removida com sucesso.");
    } catch (e: any) {
      setError(e?.message || "Não foi possível remover a foto.");
    }
  }

  async function handleSetCoverImage(url: string) {
    try {
      setError(null);
      setMessage(null);

      setCoverImage(url);

      await setDoc(
        fisheryRef,
        {
          ownerId: uid,
          coverImage: url,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setMessage("Capa do pesqueiro atualizada.");
    } catch (e: any) {
      setError(e?.message || "Não foi possível definir a capa.");
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();

    try {
      setSaving(true);
      setError(null);
      setMessage(null);

      const fishTypes = parseFishTypes(form.fishTypesText);

      const payload: any = {
        ownerId: uid,
        name: form.name.trim(),
        description: form.description.trim(),
        city: form.city.trim(),
        state: form.state.trim().toUpperCase(),
        fishTypes,
        openHoursStart: form.openHoursStart.trim(),
        openHoursEnd: form.openHoursEnd.trim(),
        phone: form.phone.trim(),
        whatsapp: form.whatsapp.trim(),
        instagram: form.instagram.trim(),
        address: form.address.trim(),
        location: {
          latitude: form.latitude ? Number(form.latitude) : null,
          longitude: form.longitude ? Number(form.longitude) : null,
        },

        rules: form.rules.trim(),
        cancellationPolicy: form.cancellationPolicy.trim(),

        amenities: {
          restaurant: form.restaurant,
          parking: form.parking,
          bathroom: form.bathroom,
          fishCleaningArea: form.fishCleaningArea,
          baitShop: form.baitShop,
          boatRental: form.boatRental,
          accessibility: form.accessibility,
        },

        structureSummary: {
          lakesCount: toNumber(form.lakesCount),
          kiosksCount: toNumber(form.kiosksCount),
          platformsCount: toNumber(form.platformsCount),
          decksCount: toNumber(form.decksCount),
          cabinsCount: toNumber(form.cabinsCount),
          boatsAvailable: toNumber(form.boatsAvailable),
        },

        images,
        coverImage: coverImage || images[0]?.url || "",
        status: "pending_review",
        submittedAt: serverTimestamp(),
        planActive: false,
        updatedAt: serverTimestamp(),
      };

      if (!hasExistingDoc) {
        payload.createdAt = serverTimestamp();
      }

      await setDoc(fisheryRef, payload, { merge: true });

      setHasExistingDoc(true);
      setMessage("Pesqueiro salvo com sucesso e enviado para análise.");

      setTimeout(() => {
        router.push("/seller/fishery/success");
      }, 700);
    } catch (e: any) {
      setError(e?.message || "Não foi possível salvar o pesqueiro.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={styles.wrap}>
        <div style={styles.card}>
          <div style={styles.title}>Meu pesqueiro</div>
          <div style={styles.sub}>Carregando informações do seu estabelecimento...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.hero}>
        <div>
          <div style={styles.title}>Meu pesqueiro</div>
          <div style={styles.sub}>
            Cadastre, adicione fotos e configure a operação do seu estabelecimento.
          </div>
        </div>

        <div style={styles.statusChip}>
          {hasExistingDoc ? "Cadastro em edição" : "Novo cadastro"}
        </div>
      </div>

      <form onSubmit={handleSave} style={styles.formCard}>
        <div style={styles.sectionTitle}>Informações principais</div>

        <div style={styles.grid2}>
          <Field
            label="Nome do pesqueiro"
            value={form.name}
            onChange={(v) => updateField("name", v)}
            placeholder="Ex: Pesqueiro Lago Azul"
          />

          <Field
            label="Cidade"
            value={form.city}
            onChange={(v) => updateField("city", v)}
            placeholder="Ex: Sorocaba"
          />
        </div>

        <div style={styles.grid2}>
          <Field
            label="Estado"
            value={form.state}
            onChange={(v) => updateField("state", v)}
            placeholder="Ex: SP"
            maxLength={2}
          />

          <Field
            label="Peixes disponíveis"
            value={form.fishTypesText}
            onChange={(v) => updateField("fishTypesText", v)}
            placeholder="Ex: Tilápia, Pacu, Tambaqui"
          />
        </div>

        <div style={styles.grid1}>
          <TextAreaField
            label="Descrição"
            value={form.description}
            onChange={(v) => updateField("description", v)}
            placeholder="Descreva o local, estrutura, lagos, regras e diferenciais."
          />
        </div>

        <div style={styles.sectionTitle}>Contato e funcionamento</div>

        <div style={styles.grid2}>
          <Field
            label="Telefone"
            value={form.phone}
            onChange={(v) => updateField("phone", v)}
            placeholder="Ex: (15) 3333-4444"
          />

          <Field
            label="WhatsApp"
            value={form.whatsapp}
            onChange={(v) => updateField("whatsapp", v)}
            placeholder="Ex: (15) 99999-8888"
          />
        </div>

        <div style={styles.grid2}>
          <Field
            label="Instagram"
            value={form.instagram}
            onChange={(v) => updateField("instagram", v)}
            placeholder="Ex: @pesqueirolagoazul"
          />

          <div style={styles.grid2Mini}>
            <Field
              label="Abre às"
              value={form.openHoursStart}
              onChange={(v) => updateField("openHoursStart", v)}
              placeholder="06:00"
            />
            <Field
              label="Fecha às"
              value={form.openHoursEnd}
              onChange={(v) => updateField("openHoursEnd", v)}
              placeholder="18:00"
            />
          </div>
        </div>

        <div style={styles.sectionTitle}>Localização</div>

        <div style={styles.grid1}>
          <Field
            label="Endereço de apoio"
            value={form.address}
            onChange={(v) => updateField("address", v)}
            placeholder="Ex: Estrada do Pesqueiro, km 7"
          />
        </div>

        <div style={styles.grid2}>
          <Field
            label="Cidade da localização"
            value={form.city}
            onChange={(v) => updateField("city", v)}
            placeholder="Ex: Sorocaba"
          />

          <Field
            label="Estado da localização"
            value={form.state}
            onChange={(v) => updateField("state", v)}
            placeholder="Ex: SP"
            maxLength={2}
          />
        </div>

        <div style={styles.locationActionRow}>
          <button
            type="button"
            onClick={handleResolveLocation}
            disabled={resolvingLocation}
            style={{
              ...styles.secondaryBtn,
              ...(resolvingLocation ? styles.btnDisabled : {}),
            }}
          >
            {resolvingLocation ? "Buscando localização..." : "Buscar localização"}
          </button>

          <div style={styles.locationActionText}>
            O sistema tenta encontrar as coordenadas automaticamente com base no endereço.
          </div>
        </div>

        <div style={styles.grid2}>
          <Field
            label="Latitude"
            value={form.latitude}
            onChange={(v) => updateField("latitude", v)}
            placeholder="-23.5505"
          />

          <Field
            label="Longitude"
            value={form.longitude}
            onChange={(v) => updateField("longitude", v)}
            placeholder="-47.4580"
          />
        </div>

        <div style={styles.locationHint}>
          Primeiro tente buscar a localização pelo endereço. Se necessário, você ainda pode ajustar as coordenadas manualmente.
        </div>

        <div style={styles.sectionTitle}>Estrutura do pesqueiro</div>

        <div style={styles.grid2}>
          <Field
            label="Quantidade de lagos / tanques"
            value={form.lakesCount}
            onChange={(v) => updateField("lakesCount", v)}
            placeholder="Ex: 4"
          />

          <Field
            label="Quantidade de quiosques"
            value={form.kiosksCount}
            onChange={(v) => updateField("kiosksCount", v)}
            placeholder="Ex: 12"
          />
        </div>

        <div style={styles.grid2}>
          <Field
            label="Plataformas"
            value={form.platformsCount}
            onChange={(v) => updateField("platformsCount", v)}
            placeholder="Ex: 20"
          />

          <Field
            label="Decks"
            value={form.decksCount}
            onChange={(v) => updateField("decksCount", v)}
            placeholder="Ex: 5"
          />
        </div>

        <div style={styles.grid2}>
          <Field
            label="Chalés / ranchos"
            value={form.cabinsCount}
            onChange={(v) => updateField("cabinsCount", v)}
            placeholder="Ex: 3"
          />

          <Field
            label="Barcos disponíveis"
            value={form.boatsAvailable}
            onChange={(v) => updateField("boatsAvailable", v)}
            placeholder="Ex: 8"
          />
        </div>

        <div style={styles.sectionTitle}>Comodidades</div>

        <div style={styles.checkGrid}>
          <CheckField
            label="Restaurante"
            checked={form.restaurant}
            onChange={(v) => updateField("restaurant", v)}
          />

          <CheckField
            label="Estacionamento"
            checked={form.parking}
            onChange={(v) => updateField("parking", v)}
          />

          <CheckField
            label="Banheiro"
            checked={form.bathroom}
            onChange={(v) => updateField("bathroom", v)}
          />

          <CheckField
            label="Limpeza de peixe"
            checked={form.fishCleaningArea}
            onChange={(v) => updateField("fishCleaningArea", v)}
          />

          <CheckField
            label="Venda de iscas"
            checked={form.baitShop}
            onChange={(v) => updateField("baitShop", v)}
          />

          <CheckField
            label="Aluguel de barco"
            checked={form.boatRental}
            onChange={(v) => updateField("boatRental", v)}
          />

          <CheckField
            label="Acessibilidade"
            checked={form.accessibility}
            onChange={(v) => updateField("accessibility", v)}
          />
        </div>

        <div style={styles.sectionTitle}>Regras e política</div>

        <div style={styles.grid1}>
          <TextAreaField
            label="Regras do pesqueiro"
            value={form.rules}
            onChange={(v) => updateField("rules", v)}
            placeholder="Ex: Proibido ceva externa, obrigatório uso de passaguá, pesca esportiva com soltura..."
          />
        </div>

        <div style={styles.grid1}>
          <TextAreaField
            label="Política de cancelamento"
            value={form.cancellationPolicy}
            onChange={(v) => updateField("cancellationPolicy", v)}
            placeholder="Ex: Cancelamento com até 24h de antecedência permite reagendamento..."
          />
        </div>

        <div style={styles.sectionTitle}>Fotos do pesqueiro</div>

        <div style={styles.imageUploadBox}>
          <div style={styles.imageUploadText}>
            Adicione fotos da estrutura, lagos, entrada, restaurante e áreas de pesca.
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageUpload}
            style={styles.fileInput}
          />

          <button
            type="button"
            style={{
              ...styles.secondaryBtn,
              ...(uploadingImages ? styles.btnDisabled : {}),
            }}
            disabled={uploadingImages}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploadingImages ? "Enviando fotos..." : "Adicionar fotos"}
          </button>
        </div>

        {images.length > 0 ? (
          <div style={styles.imageGrid}>
            {images.map((image, index) => {
              const isCover = coverImage === image.url;

              return (
                <div key={`${image.url}-${index}`} style={styles.imageCard}>
                  <img src={image.url} alt={`Foto ${index + 1}`} style={styles.imagePreview} />

                  <div style={styles.imageActions}>
                    <button
                      type="button"
                      style={{
                        ...styles.smallBtn,
                        ...(isCover ? styles.smallBtnActive : {}),
                      }}
                      onClick={() => handleSetCoverImage(image.url)}
                    >
                      {isCover ? "Capa atual" : "Definir capa"}
                    </button>

                    <button
                      type="button"
                      style={styles.smallBtnDanger}
                      onClick={() => handleRemoveImage(image)}
                    >
                      Remover
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={styles.emptyPhotos}>
            Nenhuma foto enviada ainda. Fotos são muito importantes para o pesqueiro ficar atraente no app.
          </div>
        )}

        {message && <div style={styles.success}>{message}</div>}
        {error && <div style={styles.error}>{error}</div>}

        <div style={styles.actions}>
          <button
            type="submit"
            disabled={saving}
            style={{
              ...styles.primaryBtn,
              ...(saving ? styles.btnDisabled : {}),
            }}
          >
            {saving ? "Salvando..." : "Salvar e enviar para análise"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <label style={styles.labelWrap}>
      <span style={styles.label}>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
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

function CheckField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label style={styles.checkItem}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={styles.checkbox}
      />
      <span style={styles.checkLabel}>{label}</span>
    </label>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: {
    display: "grid",
    gap: 14,
  },

  hero: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
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

  title: {
    fontSize: 22,
    fontWeight: 1000,
    color: "#0F172A",
  },

  sub: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: 700,
    color: "#475569",
  },

  statusChip: {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(100,116,139,0.10)",
    border: "1px solid rgba(100,116,139,0.18)",
    color: "#334155",
    fontSize: 12,
    fontWeight: 1000,
    whiteSpace: "nowrap",
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

  sectionTitle: {
    fontSize: 14,
    fontWeight: 1000,
    color: "#0F172A",
    marginTop: 4,
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

  grid2Mini: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
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
    minHeight: 120,
    fontFamily: "system-ui, sans-serif",
  },

  checkGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 10,
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

  locationActionRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },

  locationActionText: {
    fontSize: 12,
    fontWeight: 800,
    color: "#475569",
    lineHeight: 1.5,
  },

  locationHint: {
    marginTop: -2,
    padding: 10,
    borderRadius: 12,
    background: "rgba(11,60,93,0.06)",
    border: "1px solid rgba(11,60,93,0.10)",
    color: "#0B3C5D",
    fontSize: 12,
    fontWeight: 800,
  },

  imageUploadBox: {
    display: "grid",
    gap: 10,
    padding: 14,
    borderRadius: 14,
    border: "1px dashed rgba(15,23,42,0.18)",
    background: "rgba(248,250,252,0.9)",
  },

  imageUploadText: {
    fontSize: 12,
    fontWeight: 800,
    color: "#475569",
    lineHeight: 1.5,
  },

  fileInput: {
    display: "none",
  },

  imageGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
    gap: 12,
  },

  imageCard: {
    display: "grid",
    gap: 8,
    padding: 10,
    borderRadius: 14,
    border: "1px solid rgba(15,23,42,0.10)",
    background: "#FFFFFF",
  },

  imagePreview: {
    width: "100%",
    aspectRatio: "4 / 3",
    objectFit: "cover",
    borderRadius: 12,
    border: "1px solid rgba(15,23,42,0.08)",
    background: "#F8FAFC",
  },

  imageActions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },

  emptyPhotos: {
    padding: 14,
    borderRadius: 14,
    border: "1px dashed rgba(15,23,42,0.18)",
    background: "rgba(100,116,139,0.06)",
    fontSize: 12,
    fontWeight: 800,
    color: "#475569",
    lineHeight: 1.5,
  },

  actions: {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: 4,
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
    height: 42,
    padding: "0 16px",
    borderRadius: 12,
    border: "1px solid rgba(15,23,42,0.10)",
    background: "#FFFFFF",
    color: "#0F172A",
    fontSize: 12,
    fontWeight: 1000,
    cursor: "pointer",
    width: "fit-content",
  },

  smallBtn: {
    height: 34,
    padding: "0 10px",
    borderRadius: 10,
    border: "1px solid rgba(15,23,42,0.10)",
    background: "#FFFFFF",
    color: "#0F172A",
    fontSize: 11,
    fontWeight: 1000,
    cursor: "pointer",
  },

  smallBtnActive: {
    background: "rgba(46,139,87,0.10)",
    border: "1px solid rgba(46,139,87,0.18)",
    color: "#14532D",
  },

  smallBtnDanger: {
    height: 34,
    padding: "0 10px",
    borderRadius: 10,
    border: "1px solid rgba(229,57,53,0.16)",
    background: "rgba(229,57,53,0.08)",
    color: "#B91C1C",
    fontSize: 11,
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
};