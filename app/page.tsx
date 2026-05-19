import type { CSSProperties } from "react";
import { adminDb } from "@/lib/firebaseAdmin";

export const dynamic = "force-dynamic";

type Activity = {
  id: string;
  title: string;
  image: string;
  username: string;
  dateText: string;
  statsText: string;
  regionLabel?: string;
  note?: string;
  canReplay: boolean;
};

const DEFAULT_IMAGE = "https://connectfish.app/og-default.png";

const APP_STORE_URL = "";
const GOOGLE_PLAY_URL = "";

function safeString(v: any, fallback = "") {
  const s = typeof v === "string" ? v.trim() : "";
  return s || fallback;
}

function isPublicPost(post: any) {
  if (post?.activityVisibility === "private") return false;
  if (post?.visibility === "private") return false;
  if (post?.status === "draft") return false;
  if (post?.status === "private") return false;
  return true;
}

function formatDateBR(date: Date) {
  try {
    return date.toLocaleDateString("pt-BR");
  } catch {
    return "";
  }
}

function formatTimeShort(sec: any) {
  const s = Number(sec || 0);
  if (!Number.isFinite(s) || s <= 0) return "0 min";

  const m = s / 60;
  if (m < 60) return `${Math.round(m)} min`;

  const h = Math.floor(m / 60);
  const rm = Math.round(m % 60);
  return `${h}h ${rm}min`;
}

function formatDistanceKm(km: any) {
  const v = Number(km || 0);
  if (!Number.isFinite(v) || v < 0) return "0,00 km";
  return `${v.toFixed(2)} km`;
}

function pickImage(post: any) {
  return (
    safeString(post?.mediaUrl) ||
    safeString(post?.feedPreview?.mapThumbnailUrl) ||
    safeString(post?.mapThumbnailUrl) ||
    safeString(post?.thumbnailUrl) ||
    safeString(post?.mediaGallery?.[0]?.url) ||
    DEFAULT_IMAGE
  );
}

function pickHandle(post: any) {
  const raw =
    post?.userHandle ||
    post?.username ||
    post?.handle ||
    post?.displayName ||
    post?.userDisplayName ||
    "pescador";

  return `@${String(raw).replace(/^@/, "")}`;
}

function pickDate(post: any) {
  try {
    if (post?.createdAt?.toDate) return post.createdAt.toDate();
    if (post?.createdAtLocal) return new Date(post.createdAtLocal);
    if (post?.createdAtMs) return new Date(Number(post.createdAtMs));
  } catch {}

  return new Date();
}

function mapPostToActivity(id: string, post: any): Activity {
  const date = pickDate(post);
  const fishCount = Number(post?.fishCount ?? 0) || 0;

  return {
    id,
    title:
      safeString(post?.title) ||
      safeString(post?.activityTitle) ||
      "Toda pescaria conta uma história.",
    image: pickImage(post),
    username: pickHandle(post),
    dateText: formatDateBR(date),
    statsText: `Tempo: ${formatTimeShort(post?.time)} • Distância: ${formatDistanceKm(
      post?.distance
    )} • Peixes: ${fishCount}`,
    regionLabel:
      safeString(post?.location?.regionLabel) ||
      safeString(post?.regionLabel) ||
      safeString(post?.waterBodyContext?.name) ||
      "Pescaria",
    note: safeString(post?.note) || safeString(post?.description),
    canReplay: post?.allowReplayNavigation !== false,
  };
}

async function getPublicActivities(): Promise<Activity[]> {
  try {
    const db = adminDb();

    const snap = await db
      .collection("posts")
      .orderBy("createdAt", "desc")
      .limit(30)
      .get();

    return snap.docs
      .filter((doc) => isPublicPost(doc.data()))
      .slice(0, 18)
      .map((doc) => mapPostToActivity(doc.id, doc.data()));
  } catch {
    return [];
  }
}

export default async function Home() {
  const year = new Date().getFullYear();
  const activities = await getPublicActivities();

  const hasActivities = activities.length > 0;

  const fallbackActivities: Activity[] = [
    {
      id: "",
      title: "Grave sua pescaria e compartilhe com a comunidade.",
      image: DEFAULT_IMAGE,
      username: "@connectfish",
      dateText: "Em breve",
      statsText: "Rota • Capturas • Replay",
      regionLabel: "Brasil",
      note:
        "O ConnectFish transforma cada pescaria em uma atividade viva, com mapa, fotos, estatísticas e replay.",
      canReplay: false,
    },
  ];

  const feed = hasActivities ? activities : fallbackActivities;
  const featured = feed[0];

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <a href="/" style={styles.brandLink}>
          <div style={styles.logo}>CF</div>
          <div style={styles.brandTextBlock}>
            <strong style={styles.brand}>ConnectFish</strong>
            <span style={styles.brandSub}>A rede social da pesca</span>
          </div>
        </a>

        <nav style={styles.nav}>
          <a href="#feed" style={styles.navLink}>
            Feed
          </a>
          <a href="#baixar-app" style={styles.navButton}>
            Baixar app
          </a>
        </nav>
      </header>

      <section style={styles.hero}>
        <div style={styles.heroCopy}>
          <p style={styles.eyebrow}>Pesque. Registre. Compartilhe.</p>

          <h1 style={styles.title}>
            A pesca agora tem feed, mapa, replay e comunidade.
          </h1>

          <p style={styles.text}>
            Veja atividades reais de pescadores, descubra lugares, acompanhe
            capturas e compartilhe suas melhores pescarias como um post público.
          </p>

          <div style={styles.ctaRow}>
            <a href="#feed" style={styles.primaryCta}>
              Explorar atividades
            </a>

            <a href="#baixar-app" style={styles.secondaryCta}>
              Baixar o app
            </a>
          </div>
        </div>

        <div style={styles.phonePreview}>
          <ActivityCard activity={featured} featured />
        </div>
      </section>

      <section id="feed" style={styles.feedSection}>
        <div style={styles.sectionHeader}>
          <div>
            <p style={styles.eyebrow}>Feed público</p>
            <h2 style={styles.sectionTitle}>Atividades da comunidade</h2>
          </div>

          <span style={styles.feedCounter}>
            {hasActivities
              ? `${activities.length} atividades recentes`
              : "Primeiras atividades em breve"}
          </span>
        </div>

        <div style={styles.feedGrid}>
          {feed.map((activity, index) => (
            <ActivityCard
              key={activity.id || `fallback-${index}`}
              activity={activity}
            />
          ))}
        </div>
      </section>

      <section id="baixar-app" style={styles.downloadBox}>
        <div>
          <p style={styles.eyebrow}>Leve sua pescaria para o mapa</p>

          <h2 style={styles.downloadTitle}>
            Grave sua rota, salve capturas e compartilhe sua atividade.
          </h2>

          <p style={styles.downloadText}>
            Depois de salvar uma pescaria no app, ela pode virar uma página
            pública bonita para enviar no WhatsApp, Instagram, grupos e redes
            sociais.
          </p>
        </div>

        <div style={styles.storeButtons}>
          {APP_STORE_URL ? (
            <a href={APP_STORE_URL} style={styles.storeButton}>
              App Store
            </a>
          ) : (
            <span style={styles.storeButtonMuted}>App Store em breve</span>
          )}

          {GOOGLE_PLAY_URL ? (
            <a href={GOOGLE_PLAY_URL} style={styles.storeButton}>
              Google Play
            </a>
          ) : (
            <span style={styles.storeButtonMuted}>Google Play em breve</span>
          )}
        </div>
      </section>

      <section style={styles.shareBox}>
        <div style={styles.shareItem}>
          <strong>Post público</strong>
          <span>connectfish.app/a/atividade</span>
        </div>

        <div style={styles.shareItem}>
          <strong>Replay da pescaria</strong>
          <span>connectfish.app/r/replay</span>
        </div>

        <div style={styles.shareItem}>
          <strong>Compartilhamento social</strong>
          <span>Mapa + estatísticas + logo ConnectFish</span>
        </div>
      </section>

      <footer style={styles.footer}>
        <span>© {year} ConnectFish</span>

        <div style={styles.footerLinks}>
          <a href="/terms" style={styles.footerLink}>
            Termos
          </a>
          <a href="/privacy" style={styles.footerLink}>
            Privacidade
          </a>
          <a href="/seller" style={styles.footerLink}>
            Portal
          </a>
        </div>
      </footer>
    </main>
  );
}

function ActivityCard({
  activity,
  featured = false,
}: {
  activity: Activity;
  featured?: boolean;
}) {
  const activityHref = activity.id ? `/a/${activity.id}` : "#baixar-app";
  const replayHref = activity.id ? `/r/${activity.id}` : "#baixar-app";

  return (
    <article style={featured ? styles.featuredCard : styles.card}>
      <div style={styles.cardTop}>
        <div style={styles.avatar}>🎣</div>

        <div style={styles.cardUserBlock}>
          <strong style={styles.cardUser}>{activity.username}</strong>
          <span style={styles.cardMeta}>
            {activity.regionLabel} • {activity.dateText}
          </span>
        </div>
      </div>

      <a href={activityHref} style={styles.imageWrap}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={activity.image} alt={activity.title} style={styles.image} />

        <span style={styles.imageBadge}>Ver atividade</span>
      </a>

      <div style={styles.cardBody}>
        <h3 style={styles.cardTitle}>{activity.title}</h3>

        <p style={styles.stats}>{activity.statsText}</p>

        {activity.note ? <p style={styles.note}>{activity.note}</p> : null}

        <div style={styles.actions}>
          <a href={activityHref} style={styles.actionPrimary}>
            Abrir
          </a>

          {activity.canReplay ? (
            <a href={replayHref} style={styles.actionGhost}>
              Replay
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(800px 500px at 20% 0%, rgba(45,212,191,0.18), transparent 60%), radial-gradient(700px 500px at 90% 20%, rgba(56,189,248,0.14), transparent 55%), #061116",
    color: "#E6F6F7",
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    overflowX: "hidden",
  },

  header: {
    position: "sticky",
    top: 0,
    zIndex: 50,
    height: 72,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    padding: "12px clamp(14px, 4vw, 42px)",
    background: "rgba(6,17,22,0.78)",
    backdropFilter: "blur(16px)",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    boxSizing: "border-box",
  },

  brandLink: {
    display: "flex",
    alignItems: "center",
    gap: 11,
    minWidth: 0,
    textDecoration: "none",
    color: "inherit",
  },

  logo: {
    width: 42,
    height: 42,
    minWidth: 42,
    borderRadius: 14,
    display: "grid",
    placeItems: "center",
    fontWeight: 950,
    color: "#001114",
    background: "linear-gradient(135deg, #2DD4BF, #38BDF8)",
  },

  brandTextBlock: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },

  brand: {
    fontSize: 17,
    lineHeight: 1,
    fontWeight: 950,
  },

  brandSub: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: 800,
    color: "rgba(230,246,247,0.58)",
    whiteSpace: "nowrap",
  },

  nav: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },

  navLink: {
    color: "rgba(230,246,247,0.72)",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 850,
  },

  navButton: {
    padding: "10px 13px",
    borderRadius: 999,
    color: "#001114",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 950,
    background: "linear-gradient(135deg, #2DD4BF, #38BDF8)",
  },

  hero: {
    maxWidth: 1180,
    margin: "0 auto",
    padding: "42px clamp(14px, 4vw, 42px) 24px",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))",
    gap: 28,
    alignItems: "center",
    boxSizing: "border-box",
  },

  heroCopy: {
    minWidth: 0,
  },

  eyebrow: {
    margin: 0,
    color: "#BFF7EE",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  title: {
    margin: "12px 0 0",
    maxWidth: 720,
    fontSize: "clamp(38px, 9vw, 72px)",
    lineHeight: 0.96,
    letterSpacing: -2,
    fontWeight: 950,
  },

  text: {
    margin: "18px 0 0",
    maxWidth: 640,
    fontSize: "clamp(15px, 4vw, 18px)",
    lineHeight: 1.7,
    color: "rgba(230,246,247,0.76)",
  },

  ctaRow: {
    marginTop: 24,
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
  },

  primaryCta: {
    padding: "15px 18px",
    borderRadius: 16,
    color: "#001114",
    textDecoration: "none",
    fontWeight: 950,
    background: "linear-gradient(135deg, #2DD4BF, #38BDF8)",
    boxShadow: "0 18px 42px rgba(0,0,0,0.32)",
  },

  secondaryCta: {
    padding: "15px 18px",
    borderRadius: 16,
    color: "rgba(230,246,247,0.9)",
    textDecoration: "none",
    fontWeight: 950,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
  },

  phonePreview: {
    width: "100%",
    maxWidth: 480,
    justifySelf: "center",
  },

  feedSection: {
    maxWidth: 1180,
    margin: "0 auto",
    padding: "24px clamp(14px, 4vw, 42px)",
    boxSizing: "border-box",
  },

  sectionHeader: {
    display: "flex",
    alignItems: "end",
    justifyContent: "space-between",
    gap: 14,
    flexWrap: "wrap",
    marginBottom: 16,
  },

  sectionTitle: {
    margin: "7px 0 0",
    fontSize: "clamp(26px, 7vw, 38px)",
    letterSpacing: -0.8,
    lineHeight: 1.1,
    fontWeight: 950,
  },

  feedCounter: {
    padding: "9px 12px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    color: "rgba(230,246,247,0.72)",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.10)",
  },

  feedGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
    gap: 18,
    alignItems: "start",
  },

  featuredCard: {
    width: "100%",
    borderRadius: 28,
    overflow: "hidden",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.09), rgba(255,255,255,0.045))",
    border: "1px solid rgba(255,255,255,0.14)",
    boxShadow: "0 28px 80px rgba(0,0,0,0.42)",
  },

  card: {
    width: "100%",
    borderRadius: 24,
    overflow: "hidden",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.075), rgba(255,255,255,0.035))",
    border: "1px solid rgba(255,255,255,0.12)",
    boxShadow: "0 18px 44px rgba(0,0,0,0.26)",
  },

  cardTop: {
    display: "flex",
    alignItems: "center",
    gap: 11,
    padding: 14,
  },

  avatar: {
    width: 42,
    height: 42,
    minWidth: 42,
    borderRadius: 999,
    display: "grid",
    placeItems: "center",
    background: "rgba(255,255,255,0.08)",
  },

  cardUserBlock: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
  },

  cardUser: {
    fontSize: 14,
    fontWeight: 950,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  cardMeta: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: 800,
    color: "rgba(230,246,247,0.56)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  imageWrap: {
    position: "relative",
    display: "block",
    width: "100%",
    aspectRatio: "1 / 1",
    overflow: "hidden",
    background: "rgba(0,0,0,0.28)",
  },

  image: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },

  imageBadge: {
    position: "absolute",
    right: 12,
    bottom: 12,
    padding: "8px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 950,
    color: "#001114",
    background: "linear-gradient(135deg, #5EFCA1, #00BFDF)",
  },

  cardBody: {
    padding: 15,
  },

  cardTitle: {
    margin: 0,
    fontSize: 18,
    lineHeight: 1.2,
    fontWeight: 950,
  },

  stats: {
    margin: "11px 0 0",
    padding: 11,
    borderRadius: 15,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.09)",
    fontSize: 13,
    lineHeight: 1.45,
    fontWeight: 850,
  },

  note: {
    margin: "11px 0 0",
    fontSize: 14,
    lineHeight: 1.55,
    color: "rgba(230,246,247,0.72)",
  },

  actions: {
    marginTop: 14,
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },

  actionPrimary: {
    flex: "1 1 120px",
    textAlign: "center",
    padding: "12px 13px",
    borderRadius: 14,
    textDecoration: "none",
    color: "#001114",
    fontSize: 13,
    fontWeight: 950,
    background: "linear-gradient(135deg, #2DD4BF, #38BDF8)",
  },

  actionGhost: {
    flex: "1 1 120px",
    textAlign: "center",
    padding: "12px 13px",
    borderRadius: 14,
    textDecoration: "none",
    color: "rgba(230,246,247,0.88)",
    fontSize: 13,
    fontWeight: 950,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
  },

  downloadBox: {
    maxWidth: 1180,
    margin: "10px auto 0",
    padding: "26px clamp(18px, 4vw, 34px)",
    borderRadius: 28,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
    gap: 20,
    alignItems: "center",
    background:
      "linear-gradient(135deg, rgba(45,212,191,0.16), rgba(56,189,248,0.09))",
    border: "1px solid rgba(45,212,191,0.28)",
    boxSizing: "border-box",
  },

  downloadTitle: {
    margin: "10px 0 0",
    fontSize: "clamp(26px, 7vw, 40px)",
    lineHeight: 1.08,
    letterSpacing: -1,
    fontWeight: 950,
  },

  downloadText: {
    margin: "12px 0 0",
    fontSize: 15,
    lineHeight: 1.7,
    color: "rgba(230,246,247,0.76)",
  },

  storeButtons: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    justifyContent: "flex-start",
  },

  storeButton: {
    flex: "1 1 150px",
    padding: "15px 16px",
    borderRadius: 16,
    textAlign: "center",
    textDecoration: "none",
    color: "#001114",
    fontWeight: 950,
    background: "linear-gradient(135deg, #2DD4BF, #38BDF8)",
  },

  storeButtonMuted: {
    flex: "1 1 150px",
    padding: "15px 16px",
    borderRadius: 16,
    textAlign: "center",
    color: "rgba(230,246,247,0.72)",
    fontWeight: 950,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
  },

  shareBox: {
    maxWidth: 1180,
    margin: "18px auto 0",
    padding: "0 clamp(14px, 4vw, 42px)",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
    gap: 12,
    boxSizing: "border-box",
  },

  shareItem: {
    padding: 16,
    borderRadius: 20,
    background: "rgba(255,255,255,0.045)",
    border: "1px solid rgba(255,255,255,0.10)",
    display: "flex",
    flexDirection: "column",
    gap: 7,
    color: "rgba(230,246,247,0.66)",
    fontSize: 13,
    overflowWrap: "anywhere",
  },

  footer: {
    maxWidth: 1180,
    margin: "0 auto",
    padding: "26px clamp(14px, 4vw, 42px) 34px",
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    flexWrap: "wrap",
    color: "rgba(230,246,247,0.48)",
    fontSize: 12,
    boxSizing: "border-box",
  },

  footerLinks: {
    display: "flex",
    gap: 14,
    flexWrap: "wrap",
  },

  footerLink: {
    color: "rgba(230,246,247,0.62)",
    textDecoration: "none",
    fontWeight: 850,
  },
};