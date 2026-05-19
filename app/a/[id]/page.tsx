// app/a/[id]/page.tsx
import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { adminDb } from "@/lib/firebaseAdmin";

type PageProps = {
  params: Promise<{ id: string }>;
};

type ShareData = {
  id: string;
  exists: boolean;
  isPublic: boolean;
  title: string;
  description: string;
  image: string;
  username?: string;
  dateText?: string;
  timeText?: string;
  distanceText?: string;
  fishCount?: number;
  note?: string;
  regionLabel?: string;
  canReplay?: boolean;
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
  return (
    safeString(post?.mediaUrl) ||
    safeString(post?.feedPreview?.mapThumbnailUrl) ||
    safeString(post?.mediaGallery?.[0]?.url) ||
    safeString(post?.thumbnailUrl) ||
    DEFAULT_IMAGE
  );
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
  const safeId = safeString(id, "");

  if (!safeId) {
    return {
      id: "",
      exists: false,
      isPublic: false,
      title: "Atividade não encontrada – ConnectFish",
      description: "O link da atividade está inválido.",
      image: DEFAULT_IMAGE,
    };
  }

  const db = adminDb();
  const postSnap = await db.collection("posts").doc(safeId).get();

  if (!postSnap.exists) {
    return {
      id: safeId,
      exists: false,
      isPublic: false,
      title: "Atividade não encontrada – ConnectFish",
      description: "Esse link não existe ou a atividade foi removida.",
      image: DEFAULT_IMAGE,
    };
  }

  const post = postSnap.data() || {};

  if (!isPostPublic(post)) {
    return {
      id: safeId,
      exists: true,
      isPublic: false,
      title: "Atividade privada – ConnectFish",
      description: "Essa atividade não está disponível publicamente.",
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
      if (u.exists) userDoc = u.data() || null;
    } catch {
      userDoc = null;
    }
  }

  let dateObj = new Date();

  try {
    if (post?.createdAt?.toDate) dateObj = post.createdAt.toDate();
    else if (typeof post?.createdAtLocal === "string") {
      dateObj = new Date(post.createdAtLocal);
    } else if (Number.isFinite(Number(post?.createdAtMs))) {
      dateObj = new Date(Number(post.createdAtMs));
    }
  } catch {}

  const username = pickHandle(post, userDoc);
  const timeText = formatTimeShort(post?.time);
  const distanceText = formatDistanceKm(post?.distance);
  const fishCount = Number(post?.fishCount ?? 0) || 0;

  const title =
    safeString(post?.title) || "Toda pescaria conta uma história.";

  const note = safeString(post?.note);
  const regionLabel =
    safeString(post?.location?.regionLabel) ||
    safeString(post?.regionLabel) ||
    safeString(post?.waterBodyContext?.name);

  return {
    id: safeId,
    exists: true,
    isPublic: true,
    title,
    description:
      note ||
      `${username} compartilhou uma pescaria no ConnectFish com rota, capturas e replay.`,
    image: pickImageFromPost(post),
    username,
    dateText: formatDateBR(dateObj),
    timeText,
    distanceText,
    fishCount,
    note,
    regionLabel,
    canReplay: post?.allowReplayNavigation !== false,
  };
}

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const safeId = safeString(id, "");
  const d = await getShareData(safeId);

  const canonicalUrl = `https://connectfish.app/a/${encodeURIComponent(
    safeId
  )}`;

  const description =
    d.username && d.dateText
      ? `${d.username} — ${d.dateText}. Tempo: ${d.timeText || "0 min"} • Distância: ${d.distanceText || "0,00 km"} • Peixes: ${d.fishCount || 0}`
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
      images: [{ url: d.image || DEFAULT_IMAGE, width: 1200, height: 630, alt: d.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: d.title,
      description,
      images: [d.image || DEFAULT_IMAGE],
    },
  };
}

export default async function SharePage({ params }: PageProps) {
  const { id } = await params;
  const safeId = safeString(id, "");
  const d = await getShareData(safeId);

  const openAppLink = `connectfish://activity?id=${encodeURIComponent(safeId)}`;
  const replayUrl = `/r/${encodeURIComponent(safeId)}`;
  const showActivity = d.exists && d.isPublic;

  return (
    <main style={styles.page}>
      <div style={styles.bgGlow} aria-hidden="true" />

      <a href="/" style={styles.homeLink}>ConnectFish</a>

      <section style={styles.shell}>
        <div style={styles.heroCard}>
          <div style={styles.imageStage}>
            <img
              src={d.image || DEFAULT_IMAGE}
              alt={showActivity ? "Foto da pescaria" : "ConnectFish"}
              style={styles.heroImage}
            />

            <div style={styles.imageOverlay} />

            <div style={styles.topBrand}>
              <div style={styles.logo}>CF</div>
              <div>
                <div style={styles.brandName}>ConnectFish</div>
                <div style={styles.brandSub}>
                  {showActivity ? "Pescaria compartilhada" : "Link compartilhado"}
                </div>
              </div>
            </div>

            <div style={styles.heroTextBlock}>
              <div style={styles.badge}>🎣 Toda pescaria conta uma história</div>
              <h1 style={styles.title}>{d.title}</h1>

              {showActivity ? (
                <div style={styles.meta}>
                  {d.username ? <span>{d.username}</span> : null}
                  {d.username && d.dateText ? <span>•</span> : null}
                  {d.dateText ? <span>{d.dateText}</span> : null}
                  {d.regionLabel ? <span>• 📍 {d.regionLabel}</span> : null}
                </div>
              ) : (
                <p style={styles.description}>{d.description}</p>
              )}
            </div>
          </div>

          <div style={styles.content}>
            {showActivity ? (
              <>
                <div style={styles.statsGrid}>
                  <Stat label="Tempo" value={d.timeText || "0 min"} />
                  <Stat label="Distância" value={d.distanceText || "0,00 km"} />
                  <Stat label="Peixes" value={String(d.fishCount || 0)} />
                </div>

                <section style={styles.storyBox}>
                  <p style={styles.storyEyebrow}>A história da pescaria</p>
                  <p style={styles.storyText}>
                    {d.note ||
                      "Essa atividade foi registrada no ConnectFish com dados de trajeto, capturas e momentos importantes da pescaria."}
                  </p>
                </section>

                <section style={styles.replayBox}>
                  <div>
                    <p style={styles.replayEyebrow}>Reviva o momento</p>
                    <h2 style={styles.replayTitle}>Veja essa pescaria ganhar vida no replay.</h2>
                    <p style={styles.replayText}>
                      O replay mostra a rota, os pontos e os eventos da atividade dentro do ConnectFish.
                    </p>
                  </div>

                  {d.canReplay ? (
                    <a href={replayUrl} style={styles.replayBtn}>▶ Ver replay</a>
                  ) : null}
                </section>
              </>
            ) : (
              <section style={styles.storyBox}>
                <p style={styles.storyText}>{d.description}</p>
              </section>
            )}

            <div style={styles.actions}>
              {showActivity ? (
                <a href={openAppLink} style={styles.primaryBtn}>Abrir no app</a>
              ) : null}

              <a href="/" style={showActivity ? styles.secondaryBtn : styles.primaryBtn}>
                Conhecer o ConnectFish
              </a>
            </div>

            <section style={styles.manifestBox}>
              <p style={styles.manifestTitle}>
                Antes de qualquer aplicativo, a pesca já era uma rede social.
              </p>
              <p style={styles.manifestText}>
                Histórias no barco, conhecimento entre amigos e experiências guardadas na memória.
                O ConnectFish transforma cada pescaria em rota, replay, capturas e comunidade.
              </p>
            </section>
          </div>
        </div>

        <footer style={styles.footer}>
          <span>© ConnectFish</span>
          <span>•</span>
          <a href="/terms" style={styles.footerLink}>Termos</a>
          <span>•</span>
          <a href="/privacy" style={styles.footerLink}>Privacidade</a>
        </footer>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.statCard}>
      <span style={styles.statLabel}>{label}</span>
      <strong style={styles.statValue}>{value}</strong>
    </div>
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
    padding: 20,
  },

  bgGlow: {
    position: "absolute",
    inset: -220,
    background:
      "radial-gradient(circle at 50% 50%, rgba(16,185,129,0.10), transparent 55%)",
    filter: "blur(30px)",
    pointerEvents: "none",
  },

  homeLink: {
    position: "fixed",
    top: 18,
    right: 18,
    zIndex: 20,
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

  shell: {
    position: "relative",
    zIndex: 1,
    maxWidth: 760,
    margin: "0 auto",
    paddingTop: 26,
    paddingBottom: 26,
  },

  heroCard: {
    overflow: "hidden",
    borderRadius: 30,
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.075), rgba(255,255,255,0.035))",
    border: "1px solid rgba(255,255,255,0.13)",
    boxShadow: "0 34px 90px rgba(0,0,0,0.46)",
    backdropFilter: "blur(12px)",
  },

  imageStage: {
    position: "relative",
    minHeight: 500,
    background: "rgba(0,0,0,0.25)",
  },

  heroImage: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },

  imageOverlay: {
    position: "absolute",
    inset: 0,
    background:
      "linear-gradient(180deg, rgba(0,0,0,0.40) 0%, rgba(0,0,0,0.05) 35%, rgba(0,0,0,0.82) 100%)",
  },

  topBrand: {
    position: "absolute",
    top: 18,
    left: 18,
    right: 72,
    display: "flex",
    alignItems: "center",
    gap: 12,
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
      "linear-gradient(135deg, rgba(45,212,191,1), rgba(56,189,248,1))",
  },

  brandName: {
    fontSize: 17,
    fontWeight: 950,
  },

  brandSub: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: 800,
    color: "rgba(230,246,247,0.72)",
  },

  heroTextBlock: {
    position: "absolute",
    left: 22,
    right: 22,
    bottom: 24,
  },

  badge: {
    display: "inline-flex",
    width: "fit-content",
    padding: "8px 11px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 950,
    color: "#001114",
    background:
      "linear-gradient(135deg, rgba(94,252,161,0.96), rgba(0,191,223,0.96))",
  },

  title: {
    margin: "14px 0 0",
    fontSize: 42,
    lineHeight: 1.04,
    letterSpacing: -1,
    fontWeight: 950,
    textShadow: "0 16px 42px rgba(0,0,0,0.6)",
  },

  meta: {
    marginTop: 12,
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    fontSize: 14,
    fontWeight: 850,
    color: "rgba(230,246,247,0.82)",
  },

  description: {
    marginTop: 12,
    fontSize: 15,
    lineHeight: 1.6,
    color: "rgba(230,246,247,0.78)",
  },

  content: {
    padding: 20,
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 10,
  },

  statCard: {
    padding: 14,
    borderRadius: 18,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.10)",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },

  statLabel: {
    fontSize: 12,
    fontWeight: 850,
    color: "rgba(230,246,247,0.60)",
  },

  statValue: {
    fontSize: 18,
    fontWeight: 950,
    color: "#bff7ee",
  },

  storyBox: {
    marginTop: 16,
    padding: 18,
    borderRadius: 20,
    background: "rgba(255,255,255,0.045)",
    border: "1px solid rgba(255,255,255,0.10)",
  },

  storyEyebrow: {
    margin: 0,
    fontSize: 12,
    fontWeight: 950,
    color: "#bff7ee",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  storyText: {
    margin: "9px 0 0",
    fontSize: 15,
    lineHeight: 1.7,
    color: "rgba(230,246,247,0.78)",
  },

  replayBox: {
    marginTop: 16,
    padding: 18,
    borderRadius: 20,
    background:
      "linear-gradient(135deg, rgba(0,191,223,0.14), rgba(94,252,161,0.08))",
    border: "1px solid rgba(0,191,223,0.26)",
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: 16,
    alignItems: "center",
  },

  replayEyebrow: {
    margin: 0,
    fontSize: 12,
    fontWeight: 950,
    color: "#bff7ee",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  replayTitle: {
    margin: "8px 0 0",
    fontSize: 22,
    lineHeight: 1.15,
    fontWeight: 950,
  },

  replayText: {
    margin: "8px 0 0",
    fontSize: 14,
    lineHeight: 1.6,
    color: "rgba(230,246,247,0.72)",
  },

  replayBtn: {
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
      "linear-gradient(135deg, rgba(45,212,191,1), rgba(56,189,248,1))",
    whiteSpace: "nowrap",
  },

  actions: {
    marginTop: 16,
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
    padding: "14px 16px",
    borderRadius: 15,
    textDecoration: "none",
    fontSize: 14,
    fontWeight: 950,
    color: "#001114",
    background:
      "linear-gradient(135deg, rgba(45,212,191,1), rgba(56,189,248,1))",
  },

  secondaryBtn: {
    flex: 1,
    minWidth: 160,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "14px 16px",
    borderRadius: 15,
    textDecoration: "none",
    fontSize: 14,
    fontWeight: 950,
    color: "rgba(230,246,247,0.88)",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
  },

  manifestBox: {
    marginTop: 16,
    padding: 18,
    borderRadius: 20,
    background: "rgba(255,255,255,0.035)",
    border: "1px solid rgba(255,255,255,0.09)",
  },

  manifestTitle: {
    margin: 0,
    fontSize: 18,
    lineHeight: 1.25,
    fontWeight: 950,
  },

  manifestText: {
    margin: "8px 0 0",
    fontSize: 14,
    lineHeight: 1.65,
    color: "rgba(230,246,247,0.70)",
  },

  footer: {
    marginTop: 18,
    display: "flex",
    justifyContent: "center",
    gap: 8,
    flexWrap: "wrap",
    fontSize: 12,
    color: "rgba(230,246,247,0.45)",
  },

  footerLink: {
    color: "rgba(230,246,247,0.62)",
    textDecoration: "none",
    fontWeight: 800,
  },
};