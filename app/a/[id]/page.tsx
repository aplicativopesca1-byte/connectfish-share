// app/a/[id]/page.tsx
import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { adminDb } from "@/lib/firebaseAdmin";

type PageProps = { params: { id: string } };

type ShareData = {
  id: string;
  exists: boolean;
  isPublic: boolean;
  title: string;
  description: string;
  image: string;
  username?: string;
  dateText?: string;
  statsText?: string;
  note?: string;
  regionLabel?: string;
};

const DEFAULT_IMAGE = "https://connectfish.app/og-default.png";

function safeString(v: any, fallback = "") {
  const s = typeof v === "string" ? v : "";
  const t = s.trim();
  return t || fallback;
}

function formatDateBR(d: Date) {
  try {
    return d.toLocaleDateString("pt-BR");
  } catch {
    return "";
  }
}

function formatTimeShort(sec: any) {
  const s = Number(sec || 0);
  if (!Number.isFinite(s) || s <= 0) return "0 min";

  const m = s / 60;
  if (m < 60) return `${m.toFixed(1)} min`;

  const h = Math.floor(m / 60);
  const rm = Math.round(m % 60);
  return `${h}h ${rm}min`;
}

function formatDistanceKm(km: any) {
  const v = Number(km || 0);
  if (!Number.isFinite(v) || v < 0) return "0,00 km";
  return `${v.toFixed(2)} km`;
}

function pickImageFromPost(post: any) {
  const mediaUrl = safeString(post?.mediaUrl, "");
  if (mediaUrl) return mediaUrl;

  const mapThumb = safeString(post?.feedPreview?.mapThumbnailUrl, "");
  if (mapThumb) return mapThumb;

  const g0 = Array.isArray(post?.mediaGallery) ? post.mediaGallery[0] : null;
  const g0url = safeString(g0?.url, "");
  if (g0url) return g0url;

  const thumb = safeString(post?.thumbnailUrl, "");
  if (thumb) return thumb;

  return DEFAULT_IMAGE;
}

function pickHandle(post: any, userDoc: any | null) {
  const raw =
    post?.userHandle ||
    post?.username ||
    post?.handle ||
    post?.userDisplayName ||
    post?.displayName ||
    userDoc?.username ||
    userDoc?.handle ||
    userDoc?.displayName ||
    (userDoc?.email ? String(userDoc.email).split("@")[0] : null);

  const v = safeString(raw, "pescador").replace(/^@/, "");
  return `@${v}`;
}

function isPostPublic(post: any) {
  const activityVisibility = safeString(post?.activityVisibility, "");
  const visibility = safeString(post?.visibility, "");
  const status = safeString(post?.status, "");

  if (activityVisibility === "private") return false;
  if (visibility === "private") return false;
  if (status === "draft") return false;
  if (status === "private") return false;

  return true;
}

async function getShareData(id: string): Promise<ShareData> {
  const db = adminDb();

  const postSnap = await db.collection("posts").doc(id).get();

  if (!postSnap.exists) {
    return {
      id,
      exists: false,
      isPublic: false,
      title: "Atividade não encontrada – ConnectFish",
      description: "Esse link não existe ou a atividade foi removida.",
      image: DEFAULT_IMAGE,
    };
  }

  const post = postSnap.data() || {};
  const publicPost = isPostPublic(post);

  if (!publicPost) {
    return {
      id,
      exists: true,
      isPublic: false,
      title: "Atividade privada – ConnectFish",
      description:
        "Essa atividade não está disponível publicamente no ConnectFish.",
      image: DEFAULT_IMAGE,
    };
  }

let userDoc: any | null = null;

const userId = safeString(
  post?.userId || post?.uid || post?.ownerId || post?.authorId,
  ""
);

if (userId) {
  try {
    const u = await db.collection("users").doc(userId).get();

    if (u.exists) {
      userDoc = u.data() || null;
    }
  } catch {
    userDoc = null;
  }
}

  let dateObj = new Date();

  try {
    if (post?.createdAt?.toDate) {
      dateObj = post.createdAt.toDate();
    } else if (typeof post?.createdAtLocal === "string") {
      dateObj = new Date(post.createdAtLocal);
    } else if (Number.isFinite(Number(post?.createdAtMs))) {
      dateObj = new Date(Number(post.createdAtMs));
    }
  } catch {}

  const dateText = formatDateBR(dateObj);
  const timeStr = formatTimeShort(post?.time);
  const distStr = formatDistanceKm(post?.distance);
  const fishCount = Number(post?.fishCount ?? 0) || 0;
  const username = pickHandle(post, userDoc);

  const title =
    safeString(post?.title, "") || "🎣 ConnectFish — pescaria compartilhada";

  const note = safeString(post?.note, "");
  const regionLabel =
    safeString(post?.location?.regionLabel, "") ||
    safeString(post?.regionLabel, "") ||
    safeString(post?.waterBodyContext?.name, "");

  const statsText = `Tempo: ${timeStr} • Distância: ${distStr} • Peixes: ${fishCount}`;

  return {
    id,
    exists: true,
    isPublic: true,
    title,
    description:
      note ||
      `${username} compartilhou uma pescaria no ConnectFish com rota, capturas e replay.`,
    image: pickImageFromPost(post),
    username,
    dateText,
    statsText,
    note,
    regionLabel,
  };
}

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const d = await getShareData(params.id);

  const canonicalUrl = `https://connectfish.app/a/${encodeURIComponent(
    params.id
  )}`;

  const description =
    d.username && d.dateText && d.statsText
      ? `${d.username} — ${d.dateText}. ${d.statsText}`
      : d.description;

  return {
    title: d.title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title: d.title,
      description,
      url: canonicalUrl,
      type: "website",
      siteName: "ConnectFish",
      images: d.image
        ? [{ url: d.image, width: 1200, height: 630, alt: d.title }]
        : [],
    },
    twitter: {
      card: "summary_large_image",
      title: d.title,
      description,
      images: d.image ? [d.image] : [],
    },
  };
}

export default async function SharePage({ params }: PageProps) {
  const d = await getShareData(params.id);

  const openAppLink = `connectfish://activity?id=${encodeURIComponent(
    params.id
  )}`;

  const showActivity = d.exists && d.isPublic;

  return (
    <main style={styles.page}>
      <div style={styles.bgGlow} aria-hidden="true" />

      <a href="/" style={styles.homeLink}>
        ConnectFish
      </a>

      <section style={styles.wrap}>
        <div style={styles.card}>
          <div style={styles.brandRow}>
            <div style={styles.logoMark} aria-hidden="true">
              CF
            </div>

            <div>
              <div style={styles.brandName}>ConnectFish</div>
              <div style={styles.brandSub}>
                {showActivity
                  ? "Atividade compartilhada"
                  : "Link compartilhado"}
              </div>
            </div>
          </div>

          <div style={styles.imageWrap}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={d.image || DEFAULT_IMAGE}
              alt={showActivity ? "Foto da pescaria" : "ConnectFish"}
              style={styles.image}
            />

            {showActivity ? (
              <div style={styles.imageBadge}>🎣 Pescaria</div>
            ) : (
              <div style={styles.imageBadge}>Link indisponível</div>
            )}
          </div>

          <div style={styles.content}>
            <h1 style={styles.title}>{d.title}</h1>

            {showActivity ? (
              <>
                <div style={styles.metaRow}>
                  {d.username ? <span>{d.username}</span> : null}
                  {d.username && d.dateText ? <span>•</span> : null}
                  {d.dateText ? <span>{d.dateText}</span> : null}
                </div>

                {d.regionLabel ? (
                  <div style={styles.location}>📍 {d.regionLabel}</div>
                ) : null}

                {d.statsText ? (
                  <div style={styles.statsCard}>{d.statsText}</div>
                ) : null}

                {d.note ? <p style={styles.note}>{d.note}</p> : null}
              </>
            ) : (
              <p style={styles.note}>
                {d.description ||
                  "Essa atividade não está disponível publicamente."}
              </p>
            )}
          </div>

          <div style={styles.actions}>
            {showActivity ? (
              <a href={openAppLink} style={styles.primaryBtn}>
                Abrir no app
              </a>
            ) : null}

            <a href="/" style={showActivity ? styles.ghostBtn : styles.primaryBtn}>
              Conhecer o ConnectFish
            </a>
          </div>

          <div style={styles.footerHint}>
            {showActivity
              ? "Quem não tem o app pode conhecer o ConnectFish por esta página."
              : "A atividade pode ter sido removida, estar privada ou o link pode estar incorreto."}
          </div>
        </div>
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(1200px 800px at 20% 10%, rgba(45,212,191,0.20), transparent 60%)," +
      "radial-gradient(900px 600px at 85% 30%, rgba(56,189,248,0.18), transparent 60%)," +
      "linear-gradient(180deg, #06141a 0%, #050a0f 100%)",
    color: "#e6f6f7",
    position: "relative",
    overflow: "hidden",
    padding: 24,
  },

  bgGlow: {
    position: "absolute",
    inset: -200,
    background:
      "radial-gradient(circle at 50% 50%, rgba(16,185,129,0.10), transparent 55%)",
    filter: "blur(30px)",
    pointerEvents: "none",
  },

  homeLink: {
    position: "fixed",
    top: 18,
    right: 18,
    zIndex: 10,
    padding: "9px 12px",
    borderRadius: 999,
    textDecoration: "none",
    fontSize: 12,
    fontWeight: 900,
    color: "rgba(230,246,247,0.88)",
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.14)",
    backdropFilter: "blur(10px)",
  },

  wrap: {
    position: "relative",
    zIndex: 1,
    minHeight: "calc(100vh - 48px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  card: {
    width: "100%",
    maxWidth: 520,
    borderRadius: 26,
    overflow: "hidden",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.035))",
    border: "1px solid rgba(255,255,255,0.12)",
    boxShadow: "0 30px 90px rgba(0,0,0,0.45)",
    backdropFilter: "blur(12px)",
  },

  brandRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: 18,
  },

  logoMark: {
    width: 46,
    height: 46,
    borderRadius: 15,
    display: "grid",
    placeItems: "center",
    fontWeight: 950,
    color: "#001114",
    background:
      "linear-gradient(135deg, rgba(45,212,191,1) 0%, rgba(56,189,248,1) 100%)",
    boxShadow: "0 14px 34px rgba(0,0,0,0.35)",
  },

  brandName: {
    fontSize: 17,
    fontWeight: 950,
    letterSpacing: -0.2,
  },

  brandSub: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: 800,
    color: "rgba(230,246,247,0.62)",
  },

  imageWrap: {
    position: "relative",
    width: "100%",
    aspectRatio: "1.25 / 1",
    background: "rgba(0,0,0,0.25)",
    overflow: "hidden",
  },

  image: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },

  imageBadge: {
    position: "absolute",
    left: 14,
    bottom: 14,
    padding: "7px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 950,
    color: "#001114",
    background:
      "linear-gradient(135deg, rgba(94,252,161,0.96), rgba(0,191,223,0.96))",
    boxShadow: "0 14px 34px rgba(0,0,0,0.35)",
  },

  content: {
    padding: 18,
  },

  title: {
    margin: 0,
    fontSize: 24,
    lineHeight: 1.15,
    fontWeight: 950,
    letterSpacing: -0.5,
  },

  metaRow: {
    marginTop: 10,
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
    fontSize: 14,
    fontWeight: 850,
    color: "rgba(230,246,247,0.72)",
  },

  location: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: 800,
    color: "#bff7ee",
  },

  statsCard: {
    marginTop: 14,
    padding: 13,
    borderRadius: 16,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.10)",
    fontSize: 14,
    fontWeight: 900,
    color: "rgba(230,246,247,0.88)",
  },

  note: {
    marginTop: 14,
    marginBottom: 0,
    fontSize: 14,
    lineHeight: 1.65,
    color: "rgba(230,246,247,0.76)",
  },

  actions: {
    padding: "0 18px 18px",
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },

  primaryBtn: {
    flex: 1,
    minWidth: 160,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "13px 15px",
    borderRadius: 14,
    textDecoration: "none",
    fontSize: 14,
    fontWeight: 950,
    color: "#001114",
    background:
      "linear-gradient(135deg, rgba(45,212,191,1) 0%, rgba(56,189,248,1) 100%)",
    boxShadow: "0 14px 34px rgba(0,0,0,0.28)",
  },

  ghostBtn: {
    flex: 1,
    minWidth: 160,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "13px 15px",
    borderRadius: 14,
    textDecoration: "none",
    fontSize: 14,
    fontWeight: 950,
    color: "rgba(247, 230, 230, 0.88)",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
  },

  footerHint: {
    padding: "14px 18px 18px",
    borderTop: "1px solid rgba(255,255,255,0.09)",
    fontSize: 12,
    lineHeight: 1.55,
    color: "rgba(230,246,247,0.55)",
  },
};