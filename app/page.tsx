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

function pickImage(post: any) {
  return (
    safeString(post?.mediaUrl) ||
    safeString(post?.feedPreview?.mapThumbnailUrl) ||
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

async function getFeaturedActivity(): Promise<Activity | null> {
  try {
    const db = adminDb();

    const snap = await db
      .collection("posts")
      .orderBy("createdAt", "desc")
      .limit(12)
      .get();

    const doc = snap.docs.find((d) => isPublicPost(d.data()));

    if (!doc) return null;

    const post = doc.data();

    let date = new Date();

    try {
      if (post?.createdAt?.toDate) date = post.createdAt.toDate();
      else if (post?.createdAtLocal) date = new Date(post.createdAtLocal);
      else if (post?.createdAtMs) date = new Date(Number(post.createdAtMs));
    } catch {}

    const fishCount = Number(post?.fishCount ?? 0) || 0;

    return {
      id: doc.id,
      title:
        safeString(post?.title) ||
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
        safeString(post?.waterBodyContext?.name),
      note: safeString(post?.note),
      canReplay: post?.allowReplayNavigation !== false,
    };
  } catch {
    return null;
  }
}

export default async function Home() {
  const year = new Date().getFullYear();
  const activity = await getFeaturedActivity();

  const featured = activity || {
    id: "",
    title: "Toda pescaria conta uma história.",
    image: DEFAULT_IMAGE,
    username: "@connectfish",
    dateText: "Em breve",
    statsText: "Rota • Capturas • Replay",
    regionLabel: "Brasil",
    note:
      "O ConnectFish transforma cada pescaria em um registro vivo — com rota, capturas, replay e comunidade.",
    canReplay: false,
  };

  return (
    <main style={styles.page}>
      <div style={styles.bgGlow} />

      <a href="/seller" style={styles.portalLink}>
        Portal
      </a>

      <div style={styles.container}>
        <section style={styles.hero}>
          <div style={styles.brandRow}>
            <div style={styles.logo}>CF</div>
            <div>
              <h1 style={styles.brand}>ConnectFish</h1>
              <p style={styles.brandSub}>A rede social da pesca esportiva</p>
            </div>
          </div>

          <div style={styles.heroGrid}>
            <div>
              <p style={styles.eyebrow}>Compartilhe. Reviva. Descubra.</p>

              <h2 style={styles.title}>
                Toda pescaria conta uma história. Agora ela pode ser revivida.
              </h2>

              <p style={styles.text}>
                Antes de qualquer aplicativo, a pesca já era uma rede social:
                histórias no barco, conhecimento entre amigos e experiências
                guardadas na memória. O ConnectFish transforma cada pescaria em
                rota, replay, capturas e comunidade.
              </p>

              <div style={styles.ctaRow}>
                {activity ? (
                  <a href={`/a/${activity.id}`} style={styles.primaryCta}>
                    Abrir pescaria compartilhada
                  </a>
                ) : (
                  <a href="#como-funciona" style={styles.primaryCta}>
                    Ver como funciona
                  </a>
                )}

                <a href="#como-funciona" style={styles.secondaryCta}>
                  Conhecer o app
                </a>
              </div>
            </div>

            <div style={styles.activityCard}>
              <div style={styles.cardTop}>
                <div style={styles.avatar}>🎣</div>
                <div>
                  <p style={styles.cardName}>{featured.username}</p>
                  <p style={styles.cardMeta}>
                    {featured.regionLabel || "Pescaria"} • {featured.dateText}
                  </p>
                </div>
              </div>

              <a
                href={activity ? `/a/${activity.id}` : "#como-funciona"}
                style={styles.imageLink}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={featured.image} alt={featured.title} style={styles.image} />
                <div style={styles.imageBadge}>Atividade compartilhada</div>
              </a>

              <div style={styles.cardBody}>
                <h3 style={styles.cardTitle}>{featured.title}</h3>

                <div style={styles.stats}>{featured.statsText}</div>

                {featured.note ? <p style={styles.note}>{featured.note}</p> : null}

                <div style={styles.cardActions}>
                  {activity ? (
                    <a href={`/a/${activity.id}`} style={styles.smallPrimary}>
                      Ver atividade
                    </a>
                  ) : null}

                  {activity && featured.canReplay ? (
                    <a href={`/r/${activity.id}`} style={styles.smallGhost}>
                      Ver replay
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="como-funciona" style={styles.manifest}>
          <p style={styles.eyebrow}>O manifesto</p>

          <h2 style={styles.sectionTitle}>
            A comunidade que sempre existiu agora encontra tecnologia para crescer.
          </h2>

          <p style={styles.sectionText}>
            Cada trajeto, captura, ponto marcado e replay ajuda a transformar a
            experiência individual em aprendizado coletivo. O ConnectFish nasce
            para valorizar a tradição da pesca e dar vida às histórias que antes
            ficavam apenas na memória.
          </p>
        </section>

        <section style={styles.grid}>
          <Feature icon="📍" title="Registre" text="Grave rota, tempo, distância e momentos da pescaria." />
          <Feature icon="🐟" title="Capture" text="Salve peixes, fotos, medidas e pontos importantes." />
          <Feature icon="▶️" title="Reviva" text="Assista ao replay e veja a pescaria acontecer de novo." />
          <Feature icon="↗️" title="Compartilhe" text="Envie atividades públicas para amigos e redes sociais." />
        </section>

        <section style={styles.shareBox}>
          <div>
            <p style={styles.eyebrow}>Crescimento orgânico</p>
            <h2 style={styles.sectionTitle}>
              Quem recebe o link vê a pescaria primeiro.
            </h2>
            <p style={styles.sectionText}>
              A atividade compartilhada vira uma página pública bonita, com
              imagem, pescador, estatísticas e chamada para conhecer o app.
            </p>
          </div>

          <div style={styles.linkBox}>
            <strong>connectfish.app/a/atividade</strong>
            <span>connectfish.app/r/replay</span>
          </div>
        </section>

        <section style={styles.legalBox}>
          <span>
            © {year} ConnectFish • Toda pescaria conta uma história.
          </span>

          <div style={styles.legalLinks}>
            <a href="/terms" style={styles.footerLink}>
              Termos
            </a>
            <a href="/privacy" style={styles.footerLink}>
              Privacidade
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}

function Feature({
  icon,
  title,
  text,
}: {
  icon: string;
  title: string;
  text: string;
}) {
  return (
    <div style={styles.feature}>
      <div style={styles.featureIcon}>{icon}</div>
      <h3 style={styles.featureTitle}>{title}</h3>
      <p style={styles.featureText}>{text}</p>
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
  },

  bgGlow: {
    position: "absolute",
    inset: -220,
    background:
      "radial-gradient(circle at 50% 50%, rgba(16,185,129,0.10), transparent 55%)",
    filter: "blur(30px)",
    pointerEvents: "none",
  },

  portalLink: {
    position: "fixed",
    top: 18,
    right: 18,
    zIndex: 30,
    padding: "9px 12px",
    borderRadius: 999,
    textDecoration: "none",
    fontSize: 12,
    fontWeight: 900,
    color: "rgba(230,246,247,0.82)",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    backdropFilter: "blur(10px)",
  },

  container: {
    position: "relative",
    zIndex: 1,
    maxWidth: 1180,
    margin: "0 auto",
    padding: 32,
  },

  hero: {
    minHeight: "82vh",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: 34,
  },

  brandRow: {
    display: "flex",
    alignItems: "center",
    gap: 14,
  },

  logo: {
    width: 54,
    height: 54,
    borderRadius: 18,
    display: "grid",
    placeItems: "center",
    fontWeight: 950,
    color: "#001114",
    background:
      "linear-gradient(135deg, rgba(45,212,191,1), rgba(56,189,248,1))",
    boxShadow: "0 18px 46px rgba(0,0,0,0.36)",
  },

  brand: {
    margin: 0,
    fontSize: 34,
    fontWeight: 950,
    letterSpacing: -0.8,
  },

  brandSub: {
    margin: "3px 0 0",
    fontSize: 13,
    fontWeight: 850,
    color: "rgba(230,246,247,0.64)",
  },

  heroGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.05fr) minmax(340px, 0.95fr)",
    gap: 34,
    alignItems: "center",
  },

  eyebrow: {
    margin: 0,
    color: "#bff7ee",
    fontSize: 13,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  title: {
    margin: "14px 0 0",
    fontSize: 58,
    lineHeight: 1,
    letterSpacing: -1.8,
    fontWeight: 950,
  },

  text: {
    margin: "18px 0 0",
    fontSize: 17,
    lineHeight: 1.75,
    color: "rgba(230,246,247,0.78)",
    maxWidth: 660,
  },

  ctaRow: {
    display: "flex",
    gap: 12,
    marginTop: 24,
    flexWrap: "wrap",
  },

  primaryCta: {
    display: "inline-flex",
    padding: "14px 18px",
    borderRadius: 15,
    textDecoration: "none",
    fontWeight: 950,
    color: "#001114",
    background:
      "linear-gradient(135deg, rgba(45,212,191,1), rgba(56,189,248,1))",
    boxShadow: "0 18px 44px rgba(0,0,0,0.35)",
  },

  secondaryCta: {
    display: "inline-flex",
    padding: "14px 18px",
    borderRadius: 15,
    textDecoration: "none",
    fontWeight: 950,
    color: "rgba(230,246,247,0.88)",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
  },

  activityCard: {
    borderRadius: 28,
    overflow: "hidden",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.075), rgba(255,255,255,0.035))",
    border: "1px solid rgba(255,255,255,0.13)",
    boxShadow: "0 34px 90px rgba(0,0,0,0.46)",
    backdropFilter: "blur(12px)",
  },

  cardTop: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: 18,
  },

  avatar: {
    width: 46,
    height: 46,
    borderRadius: 999,
    display: "grid",
    placeItems: "center",
    background: "rgba(255,255,255,0.08)",
  },

  cardName: {
    margin: 0,
    fontSize: 15,
    fontWeight: 950,
  },

  cardMeta: {
    margin: "3px 0 0",
    fontSize: 12,
    fontWeight: 800,
    color: "rgba(230,246,247,0.58)",
  },

  imageLink: {
    position: "relative",
    display: "block",
    height: 290,
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
    right: 14,
    bottom: 14,
    padding: "8px 11px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 950,
    color: "#001114",
    background:
      "linear-gradient(135deg, rgba(94,252,161,0.96), rgba(0,191,223,0.96))",
  },

  cardBody: {
    padding: 18,
  },

  cardTitle: {
    margin: 0,
    fontSize: 22,
    lineHeight: 1.15,
    fontWeight: 950,
  },

  stats: {
    marginTop: 14,
    padding: 13,
    borderRadius: 16,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.10)",
    fontSize: 14,
    fontWeight: 900,
  },

  note: {
    margin: "14px 0 0",
    fontSize: 14,
    lineHeight: 1.65,
    color: "rgba(230,246,247,0.74)",
  },

  cardActions: {
    display: "flex",
    gap: 10,
    marginTop: 16,
    flexWrap: "wrap",
  },

  smallPrimary: {
    flex: 1,
    minWidth: 130,
    textAlign: "center",
    padding: "12px 14px",
    borderRadius: 14,
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 950,
    color: "#001114",
    background:
      "linear-gradient(135deg, rgba(45,212,191,1), rgba(56,189,248,1))",
  },

  smallGhost: {
    flex: 1,
    minWidth: 130,
    textAlign: "center",
    padding: "12px 14px",
    borderRadius: 14,
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 950,
    color: "rgba(230,246,247,0.88)",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
  },

  manifest: {
    marginTop: 24,
    padding: 28,
    borderRadius: 24,
    background:
      "linear-gradient(135deg, rgba(0,191,223,0.13), rgba(94,252,161,0.075))",
    border: "1px solid rgba(0,191,223,0.26)",
    boxShadow: "0 20px 60px rgba(0,191,223,0.12)",
  },

  sectionTitle: {
    margin: "10px 0 0",
    fontSize: 34,
    lineHeight: 1.12,
    letterSpacing: -0.8,
    fontWeight: 950,
  },

  sectionText: {
    margin: "12px 0 0",
    fontSize: 16,
    lineHeight: 1.75,
    color: "rgba(230,246,247,0.76)",
  },

  grid: {
    marginTop: 18,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
    gap: 14,
  },

  feature: {
    padding: 18,
    borderRadius: 20,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.10)",
  },

  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    display: "grid",
    placeItems: "center",
    background: "rgba(255,255,255,0.06)",
    marginBottom: 12,
  },

  featureTitle: {
    margin: 0,
    fontSize: 17,
    fontWeight: 950,
  },

  featureText: {
    margin: "8px 0 0",
    fontSize: 14,
    lineHeight: 1.6,
    color: "rgba(230,246,247,0.72)",
  },

  shareBox: {
    marginTop: 18,
    padding: 24,
    borderRadius: 22,
    background: "rgba(255,255,255,0.045)",
    border: "1px solid rgba(255,255,255,0.10)",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 280px",
    gap: 18,
    alignItems: "center",
  },

  linkBox: {
    padding: 18,
    borderRadius: 20,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    color: "rgba(230,246,247,0.72)",
    fontSize: 13,
  },

  legalBox: {
    marginTop: 24,
    paddingTop: 18,
    borderTop: "1px solid rgba(255,255,255,0.08)",
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
    fontSize: 13,
    color: "rgba(230,246,247,0.50)",
  },

  legalLinks: {
    display: "flex",
    gap: 12,
  },

  footerLink: {
    fontSize: 13,
    fontWeight: 850,
    color: "rgba(230,246,247,0.66)",
    textDecoration: "none",
  },
};