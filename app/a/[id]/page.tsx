// app/a/[id]/page.tsx
import type { Metadata } from "next";
import { adminDb } from "@/lib/firebaseAdmin";
type PageProps = { params: { id: string } };

type ShareData = {
  id: string;
  title: string;
  description: string;
  image: string;
  username?: string;
  dateText?: string;
  statsText?: string;
};

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
  // prioridade: mediaUrl -> mediaGallery[0].url -> fallback vazio
  const mediaUrl = safeString(post?.mediaUrl, "");
  if (mediaUrl) return mediaUrl;

  const g0 = Array.isArray(post?.mediaGallery) ? post.mediaGallery[0] : null;
  const g0url = safeString(g0?.url, "");
  if (g0url) return g0url;

  return "";
}

function pickHandle(post: any, userDoc: any | null) {
  const raw =
    post?.userHandle ||
    post?.username ||
    post?.handle ||
    userDoc?.username ||
    userDoc?.handle ||
    userDoc?.displayName ||
    (userDoc?.email ? String(userDoc.email).split("@")[0] : null);

  const v = safeString(raw, "usuario").replace(/^@/, "");
  return `@${v}`;
}

async function getShareData(id: string): Promise<ShareData> {
  const db = adminDb();

  const postSnap = await db.collection("posts").doc(id).get();
  if (!postSnap.exists) {
    // fallback “bonito” pra link inválido
    return {
      id,
      title: "🎣 ConnectFish — atividade não encontrada",
      description: "Esse link não existe (ou a atividade foi removida).",
      image: "https://connectfish.app/og-default.png", // opcional: coloque um default seu
    };
  }

  const post = postSnap.data() || {};

  // tenta puxar usuário se o post não trouxer handle
  let userDoc: any | null = null;
  const userId = safeString(post?.userId, "");
  if (userId) {
    try {
      const u = await db.collection("users").doc(userId).get();
      if (u.exists) userDoc = u.data() || null;
    } catch {
      userDoc = null;
    }
  }

  const image = pickImageFromPost(post) || "https://connectfish.app/og-default.png";

  // data: tenta createdAt (Timestamp) -> createdAtLocal (string)
  let dateObj = new Date();
  try {
    if (post?.createdAt?.toDate) dateObj = post.createdAt.toDate();
    else if (typeof post?.createdAtLocal === "string") dateObj = new Date(post.createdAtLocal);
  } catch {}

  const dateText = formatDateBR(dateObj);

  const timeStr = formatTimeShort(post?.time);
  const distStr = formatDistanceKm(post?.distance);
  const fishCount = Number(post?.fishCount ?? 0) || 0;

  const username = pickHandle(post, userDoc);

  const statsText = `Tempo: ${timeStr} • Distância: ${distStr} • Peixes: ${fishCount}`;

  return {
    id,
    title: "🎣 ConnectFish — minha pescaria",
    description: "Abra no ConnectFish para ver rota, replay e capturas.",
    image,
    username,
    dateText,
    statsText,
  };
}

// para sempre buscar do Firestore (sem cache)
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const d = await getShareData(params.id);

  const canonicalUrl = `https://connectfish.app/a/${encodeURIComponent(params.id)}`;

  const description =
    d.username && d.dateText
      ? `${d.username} — ${d.dateText}\n${d.statsText ?? ""}`.trim()
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
      images: d.image
        ? [{ url: d.image, width: 1200, height: 630, alt: "ConnectFish" }]
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

  // deep link pro app
  const openAppLink = `connectfish://activity?id=${encodeURIComponent(params.id)}`;

  return (
    <main className="cfShareWrap">
      <div className="cfShareCard">
        <div className="cfShareBrand">
          <div className="cfShareLogo" aria-hidden>
            🎣
          </div>
          <div>
            <div className="cfShareName">ConnectFish</div>
            <div className="cfShareSub">Atividade compartilhada</div>
          </div>
        </div>

        <div className="cfShareImgWrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="cfShareImg" src={d.image} alt="Foto da pescaria" />
        </div>

        <div className="cfShareInfo">
          <div className="cfShareTitle">{d.title}</div>

          {(d.username || d.dateText) && (
            <div className="cfShareMeta">
              {d.username ? <span>{d.username}</span> : null}
              {d.username && d.dateText ? <span>—</span> : null}
              {d.dateText ? <span>{d.dateText}</span> : null}
            </div>
          )}

          {d.statsText ? <div className="cfShareStats">{d.statsText}</div> : null}
        </div>

        <div className="cfShareActions">
          <a className="cfBtn cfBtnPrimary" href={openAppLink}>
            Abrir no app
          </a>
          <a className="cfBtn cfBtnGhost" href="/">
            Conhecer o ConnectFish
          </a>
        </div>

        <div className="cfShareHint">
          Dica: esse link existe para gerar preview no Instagram/WhatsApp.
        </div>
      </div>
    </main>
  );
}