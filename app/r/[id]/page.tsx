// app/r/[id]/page.tsx

import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { adminDb } from "@/lib/firebaseAdmin";

type PageProps = {
  params: {
    id: string;
  };
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

  if (!Number.isFinite(s) || s <= 0) {
    return "0 min";
  }

  const m = s / 60;

  if (m < 60) {
    return `${m.toFixed(1)} min`;
  }

  const h = Math.floor(m / 60);
  const rm = Math.round(m % 60);

  return `${h}h ${rm}min`;
}

function formatDistanceKm(km: any) {
  const v = Number(km || 0);

  if (!Number.isFinite(v) || v < 0) {
    return "0,00 km";
  }

  return `${v.toFixed(2)} km`;
}

function isReplayPublic(post: any) {
  const visibility = safeString(post?.activityVisibility, "");
  const allowReplay = Boolean(post?.allowReplayNavigation);

  if (visibility === "private") return false;
  if (!allowReplay) return false;

  return true;
}

function pickImage(post: any) {
  const mediaUrl = safeString(post?.mediaUrl, "");
  if (mediaUrl) return mediaUrl;

  const mapThumb = safeString(post?.feedPreview?.mapThumbnailUrl, "");
  if (mapThumb) return mapThumb;

  const g0 = Array.isArray(post?.mediaGallery)
    ? post.mediaGallery[0]
    : null;

  const g0url = safeString(g0?.url, "");
  if (g0url) return g0url;

  return DEFAULT_IMAGE;
}

function pickHandle(post: any, userDoc: any | null) {
  const raw =
    post?.userHandle ||
    post?.username ||
    post?.handle ||
    post?.displayName ||
    userDoc?.username ||
    userDoc?.handle ||
    userDoc?.displayName ||
    (userDoc?.email
      ? String(userDoc.email).split("@")[0]
      : null);

  const v = safeString(raw, "pescador").replace(/^@/, "");

  return `@${v}`;
}

async function getReplayData(id: string) {
  const db = adminDb();

  const snap = await db.collection("posts").doc(id).get();

  if (!snap.exists) {
    return {
      exists: false,
      title: "Replay não encontrado – ConnectFish",
      description:
        "Esse replay não existe ou não está mais disponível.",
      image: DEFAULT_IMAGE,
    };
  }

  const post = snap.data() || {};

  if (!isReplayPublic(post)) {
    return {
      exists: false,
      title: "Replay privado – ConnectFish",
      description:
        "Esse replay não está disponível publicamente.",
      image: DEFAULT_IMAGE,
    };
  }

  let userDoc: any | null = null;

  try {
    const uid = safeString(post?.userId, "");

    if (uid) {
      const u = await db.collection("users").doc(uid).get();

      if (u.exists) {
        userDoc = u.data() || null;
      }
    }
  } catch {}

  let createdAt = new Date();

  try {
    if (post?.createdAt?.toDate) {
      createdAt = post.createdAt.toDate();
    } else if (post?.createdAtLocal) {
      createdAt = new Date(post.createdAtLocal);
    }
  } catch {}

  const username = pickHandle(post, userDoc);

  const fishCount = Number(post?.fishCount ?? 0) || 0;

  const statsText =
    `Tempo: ${formatTimeShort(post?.time)} • ` +
    `Distância: ${formatDistanceKm(post?.distance)} • ` +
    `Peixes: ${fishCount}`;

  return {
    exists: true,
    id,
    title:
      safeString(post?.title, "") ||
      "🎥 Replay de pescaria – ConnectFish",

    description:
      safeString(post?.note, "") ||
      `${username} compartilhou um replay de pescaria no ConnectFish.`,

    image: pickImage(post),

    username,
    dateText: formatDateBR(createdAt),
    statsText,

    regionLabel:
      safeString(post?.location?.regionLabel, "") ||
      safeString(post?.regionLabel, "") ||
      safeString(post?.waterBodyContext?.name, ""),
  };
}

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const d = await getReplayData(params.id);

  const canonical = `https://connectfish.app/r/${encodeURIComponent(
    params.id
  )}`;

  return {
    title: d.title,
    description: d.description,

    alternates: {
      canonical,
    },

    openGraph: {
      title: d.title,
      description: d.description,
      url: canonical,
      type: "website",
      siteName: "ConnectFish",

      images: d.image
        ? [
            {
              url: d.image,
              width: 1200,
              height: 630,
              alt: d.title,
            },
          ]
        : [],
    },

    twitter: {
      card: "summary_large_image",
      title: d.title,
      description: d.description,
      images: d.image ? [d.image] : [],
    },
  };
}

export default async function ReplayPage({
  params,
}: PageProps) {
  const d = await getReplayData(params.id);

  const deepLink = `connectfish://replay?id=${encodeURIComponent(
    params.id
  )}`;

  return (
    <main style={styles.page}>
      <div style={styles.bgGlow} />

      <a href="/" style={styles.homeLink}>
        ConnectFish
      </a>

      <section style={styles.wrap}>
        <div style={styles.card}>
          <div style={styles.header}>
            <div style={styles.logo}>CF</div>

            <div>
              <div style={styles.brand}>
                ConnectFish
              </div>

              <div style={styles.sub}>
                Replay compartilhado
              </div>
            </div>
          </div>

          <div style={styles.imageWrap}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={d.image || DEFAULT_IMAGE}
              alt="Replay ConnectFish"
              style={styles.image}
            />

            <div style={styles.replayBadge}>
              ▶ Replay
            </div>
          </div>

          <div style={styles.content}>
            <h1 style={styles.title}>
              {d.title}
            </h1>

            {d.exists ? (
              <>
                <div style={styles.meta}>
                  {d.username && (
                    <span>{d.username}</span>
                  )}

                  {d.username && d.dateText && (
                    <span>•</span>
                  )}

                  {d.dateText && (
                    <span>{d.dateText}</span>
                  )}
                </div>

                {d.regionLabel ? (
                  <div style={styles.location}>
                    📍 {d.regionLabel}
                  </div>
                ) : null}

                <div style={styles.stats}>
                  {d.statsText}
                </div>

                <p style={styles.description}>
                  {d.description}
                </p>
              </>
            ) : (
              <p style={styles.description}>
                {d.description}
              </p>
            )}
          </div>

          <div style={styles.actions}>
            {d.exists ? (
              <a
                href={deepLink}
                style={styles.primaryBtn}
              >
                Assistir replay no app
              </a>
            ) : null}

            <a
              href="/"
              style={
                d.exists
                  ? styles.secondaryBtn
                  : styles.primaryBtn
              }
            >
              Conhecer o ConnectFish
            </a>
          </div>

          <div style={styles.footer}>
            {d.exists
              ? "Os replays do ConnectFish permitem reviver trajetos, capturas e momentos importantes da pescaria."
              : "Esse replay pode ter sido removido, estar privado ou indisponível."}
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

  header: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: 18,
  },

  logo: {
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

  brand: {
    fontSize: 17,
    fontWeight: 950,
    letterSpacing: -0.2,
  },

  sub: {
    marginTop: 2,

    fontSize: 12,
    fontWeight: 800,

    color: "rgba(230,246,247,0.62)",
  },

  imageWrap: {
    position: "relative",

    width: "100%",
    aspectRatio: "1.25 / 1",

    overflow: "hidden",
    background: "rgba(0,0,0,0.25)",
  },

  image: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },

  replayBadge: {
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

  meta: {
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

  stats: {
    marginTop: 14,

    padding: 13,
    borderRadius: 16,

    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.10)",

    fontSize: 14,
    fontWeight: 900,

    color: "rgba(230,246,247,0.88)",
  },

  description: {
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

  secondaryBtn: {
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

    color: "rgba(230,246,247,0.88)",

    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
  },

  footer: {
    padding: "14px 18px 18px",

    borderTop: "1px solid rgba(255,255,255,0.09)",

    fontSize: 12,
    lineHeight: 1.55,

    color: "rgba(230,246,247,0.55)",
  },
};