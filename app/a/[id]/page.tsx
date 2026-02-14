// app/a/[id]/page.tsx
import type { Metadata } from "next";

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

// ✅ Troque aqui depois para buscar do seu backend/firestore.
// Por enquanto: mock seguro pra build.
async function getShareData(id: string): Promise<ShareData> {
  return {
    id,
    title: "🎣 ConnectFish — minha pescaria",
    description: "Abra no ConnectFish para ver rota, replay e capturas.",
    image:
      "https://firebasestorage.googleapis.com/v0/b/connectfish.firebasestorage.app/o/uploads%2FiG2NE5Gv8cZ6iqT1AvcV6lvWwbp2%2Fphoto%2F2026%2F02%2F12%2F1770906842466_rnam1h.jpg?alt=media",
    username: "@rafael_kain",
    dateText: "12/02/2026",
    statsText: "Tempo: 0.3 min • Distância: 0.01 km • Peixes: 1",
  };
}

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const d = await getShareData(params.id);

  // ✅ Ajuste para seu domínio quando estiver apontando:
  // ex: https://connectfish.app/a/123
  const canonicalUrl = `https://connectfish.app/a/${encodeURIComponent(
    params.id
  )}`;

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
      images: [
        {
          url: d.image,
          width: 1200,
          height: 630,
          alt: "ConnectFish",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: d.title,
      description,
      images: [d.image],
    },
  };
}

export default async function SharePage({ params }: PageProps) {
  const d = await getShareData(params.id);

  // ✅ Deep link (você pode trocar depois pelo seu schema real)
  // Exemplo: connectfish://activity?id=XYZ
  const openAppLink = `connectfish://activity?id=${encodeURIComponent(
    params.id
  )}`;

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

          {d.statsText ? (
            <div className="cfShareStats">{d.statsText}</div>
          ) : null}
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
