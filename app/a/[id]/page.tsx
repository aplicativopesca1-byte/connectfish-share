// app/page.tsx
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <main className="page">
      {/* Top bar */}
      <header className="topbar">
        <div className="brand">
          <div className="logo" aria-hidden>
            🎣
          </div>
          <div className="brandText">
            <div className="brandName">ConnectFish</div>
            <div className="brandTag">Registre • Reviva • Compartilhe</div>
          </div>
        </div>

        <nav className="nav">
          <a className="navLink" href="#app">
            O App
          </a>
          <a className="navLink" href="#marketplace">
            Marketplace
          </a>
          <a className="navLink" href="#para-quem">
            Para quem
          </a>
        </nav>

        <div className="navCtas">
          <Link className="btn btnGhost" href="/admin">
            Área do vendedor
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="hero">
        <div className="heroGrid">
          <div className="heroLeft">
            <div className="badge">⚡ Replay + Rota + Compartilhamento</div>

            <h1 className="h1">
              A plataforma definitiva para{" "}
              <span className="grad">registrar</span>,{" "}
              <span className="grad2">reviver</span> e{" "}
              <span className="grad3">compartilhar</span> suas pescarias.
            </h1>

            <p className="p">
              Grave sua rota, marque capturas, acompanhe replay em 3ª pessoa e
              navegue como no Waze. Tudo feito por pescadores — para pescadores.
            </p>

            <div className="heroCtas">
              <a className="btn btnPrimary" href="#app">
                Ver recursos do app
              </a>

              <Link className="btn btnSecondary" href="/admin">
                Acessar área do vendedor
              </Link>
            </div>

            <div className="heroMeta">
              <div className="metaItem">
                <div className="metaNum">📍</div>
                <div className="metaText">
                  <b>Rota + Replay</b>
                  <span>reviva cada ponto</span>
                </div>
              </div>
              <div className="metaItem">
                <div className="metaNum">🏆</div>
                <div className="metaText">
                  <b>Ranking & Torneios</b>
                  <span>competição saudável</span>
                </div>
              </div>
              <div className="metaItem">
                <div className="metaNum">🔗</div>
                <div className="metaText">
                  <b>Compartilhamento</b>
                  <span>link, story, preview</span>
                </div>
              </div>
            </div>
          </div>

          <div className="heroRight" aria-hidden>
            <div className="phone">
              <div className="phoneTop">
                <div className="dot" />
                <div className="dot" />
                <div className="dot" />
              </div>

              <div className="screen">
                <div className="card big">
                  <div className="cardTitle">🎣 Minha pescaria</div>
                  <div className="cardSub">Replay • 3ª pessoa • Satélite</div>
                  <div className="mapMock" />
                  <div className="row">
                    <div className="pill">⏱ 42 min</div>
                    <div className="pill">👣 3.2 km</div>
                    <div className="pill">🐟 4 peixes</div>
                  </div>
                </div>

                <div className="grid2">
                  <div className="card">
                    <div className="cardTitle">🧠 IA</div>
                    <div className="cardSub">
                      reconhece espécie + sugestão manual
                    </div>
                  </div>
                  <div className="card">
                    <div className="cardTitle">📌 Pins</div>
                    <div className="cardSub">pontos privados e públicos</div>
                  </div>
                </div>

                <div className="card share">
                  <div className="cardTitle">🔗 Compartilhar</div>
                  <div className="cardSub">
                    link com preview (WhatsApp/Telegram)
                  </div>
                  <div className="shareBar">
                    <div className="shareTag">connectfish.app/a/…</div>
                    <div className="shareBtn">Enviar</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="glow g1" />
            <div className="glow g2" />
          </div>
        </div>
      </section>

      {/* Sections */}
      <section id="app" className="section">
        <div className="sectionHead">
          <h2 className="h2">O App</h2>
          <p className="p2">
            Tudo que você precisa para registrar e reviver suas pescarias com
            qualidade.
          </p>
        </div>

        <div className="cards3">
          <FeatureCard
            icon="🗺️"
            title="Mapa + rota"
            text="Grave seu trajeto e visualize com satélite/standard."
          />
          <FeatureCard
            icon="🎬"
            title="Replay"
            text="Assista em 3ª pessoa e use o Guia (tipo Waze) na rota."
          />
          <FeatureCard
            icon="📸"
            title="Capturas"
            text="Fotos, notas, medida, pins e galeria por pescaria."
          />
          <FeatureCard
            icon="🏆"
            title="Ranking & torneios"
            text="Evolua com XP, suba no ranking e participe de disputas."
          />
          <FeatureCard
            icon="🔒"
            title="Pins privados"
            text="Marque pontos secretos e controle o que aparece no share."
          />
          <FeatureCard
            icon="🔗"
            title="Compartilhamento inteligente"
            text="Link abre o app, e no web mostra preview com OG."
          />
        </div>
      </section>

      <section id="marketplace" className="section alt">
        <div className="split">
          <div>
            <h2 className="h2">Marketplace</h2>
            <p className="p2">
              Guias, pousadas, produtos e experiências — tudo conectado à sua
              pescaria.
            </p>

            <ul className="list">
              <li>
                <span className="tick">✓</span> Portal do vendedor (login, gestão
                e vitrine)
              </li>
              <li>
                <span className="tick">✓</span> Produtos e serviços por região
              </li>
              <li>
                <span className="tick">✓</span> Integração com conteúdo do app
                (pesqueiros, rios, represas)
              </li>
            </ul>

            <div className="rowCtas">
              <Link className="btn btnPrimary" href="/admin">
                Acessar área do vendedor
              </Link>
              <a className="btn btnSecondary" href="#para-quem">
                Ver para quem é
              </a>
            </div>
          </div>

          <div className="panel">
            <div className="panelTop">
              <div className="panelTitle">📦 Vendedor</div>
              <div className="panelSub">
                Dashboard pronto pra crescer com o ConnectFish
              </div>
            </div>

            <div className="panelGrid">
              <MiniStat label="Produtos" value="+" />
              <MiniStat label="Reservas" value="+" />
              <MiniStat label="Avaliações" value="+" />
              <MiniStat label="Vendas" value="+" />
            </div>

            <div className="panelFooter">
              <div className="hint">
                Comece simples. Evoluímos junto: marketplace → booking →
                pacotes.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="para-quem" className="section">
        <div className="sectionHead">
          <h2 className="h2">Para quem é</h2>
          <p className="p2">Feito pra servir bem os dois lados do ecossistema.</p>
        </div>

        <div className="cards2">
          <div className="bigCard">
            <div className="bigTitle">🎣 Pescadores</div>
            <p className="bigText">
              Registrar roteiros, guardar pontos, comparar performance e
              compartilhar pescarias com um link que funciona.
            </p>
            <div className="bigRow">
              <span className="chip">Replay</span>
              <span className="chip">Guia</span>
              <span className="chip">Pins</span>
              <span className="chip">Ranking</span>
            </div>
          </div>

          <div className="bigCard">
            <div className="bigTitle">🏪 Vendedores / Guias</div>
            <p className="bigText">
              Vitrine para serviços e produtos, com login e área administrativa
              para gerir tudo.
            </p>
            <div className="bigRow">
              <span className="chip">Admin</span>
              <span className="chip">Catálogo</span>
              <span className="chip">Leads</span>
              <span className="chip">Booking</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footerInner">
          <div className="footerBrand">
            <div className="logo sm" aria-hidden>
              🎣
            </div>
            <div>
              <div className="brandName">ConnectFish</div>
              <div className="brandTag">© {new Date().getFullYear()}</div>
            </div>
          </div>

          <div className="footerLinks">
            <Link className="fLink" href="/admin">
              Área do vendedor
            </Link>
            <a className="fLink" href="#app">
              App
            </a>
            <a className="fLink" href="#marketplace">
              Marketplace
            </a>
          </div>
        </div>
      </footer>

      <style jsx>{`
        :global(html, body) {
          padding: 0;
          margin: 0;
          background: #070b12;
          color: #e6edf7;
          font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto,
            Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
        }

        .page {
          min-height: 100vh;
          background: radial-gradient(
              1200px 500px at 20% -10%,
              rgba(46, 139, 87, 0.35),
              transparent 60%
            ),
            radial-gradient(
              1000px 600px at 80% 10%,
              rgba(11, 60, 93, 0.4),
              transparent 60%
            ),
            linear-gradient(180deg, #070b12 0%, #070b12 40%, #05070c 100%);
        }

        .topbar {
          max-width: 1100px;
          margin: 0 auto;
          padding: 18px 18px 10px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 220px;
        }
        .logo {
          width: 44px;
          height: 44px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.08);
          display: grid;
          place-items: center;
          font-size: 20px;
        }
        .logo.sm {
          width: 36px;
          height: 36px;
          border-radius: 12px;
          font-size: 18px;
        }
        .brandName {
          font-weight: 900;
          letter-spacing: 0.2px;
          color: #ffffff;
          line-height: 1.1;
        }
        .brandTag {
          color: rgba(230, 237, 247, 0.65);
          font-weight: 700;
          font-size: 12px;
          margin-top: 2px;
        }

        .nav {
          display: flex;
          gap: 14px;
          align-items: center;
        }
        .navLink {
          color: rgba(230, 237, 247, 0.75);
          text-decoration: none;
          font-weight: 800;
          font-size: 13px;
          padding: 10px 10px;
          border-radius: 12px;
        }
        .navLink:hover {
          background: rgba(255, 255, 255, 0.06);
          color: #fff;
        }
        .navCtas {
          display: flex;
          gap: 10px;
          align-items: center;
        }

        .hero {
          max-width: 1100px;
          margin: 0 auto;
          padding: 26px 18px 18px;
        }
        .heroGrid {
          display: grid;
          grid-template-columns: 1.15fr 0.85fr;
          gap: 22px;
          align-items: center;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.05);
          color: rgba(230, 237, 247, 0.85);
          font-weight: 800;
          font-size: 12px;
          margin-bottom: 12px;
        }

        .h1 {
          font-size: 40px;
          line-height: 1.05;
          margin: 0;
          font-weight: 950;
          letter-spacing: -0.6px;
        }
        .grad {
          background: linear-gradient(90deg, #2e8b57, #69d08c);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .grad2 {
          background: linear-gradient(90deg, #0b3c5d, #4aa3d8);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .grad3 {
          background: linear-gradient(90deg, #f59e0b, #f97316);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .p {
          margin: 14px 0 0;
          color: rgba(230, 237, 247, 0.75);
          font-weight: 700;
          line-height: 1.5;
          font-size: 14px;
          max-width: 52ch;
        }

        .heroCtas {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 16px;
        }

        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 12px 16px;
          border-radius: 14px;
          text-decoration: none;
          font-weight: 900;
          font-size: 13px;
          border: 1px solid transparent;
          transition: transform 0.12s ease, background 0.12s ease,
            border 0.12s ease;
          user-select: none;
          cursor: pointer;
        }
        .btn:active {
          transform: translateY(1px);
        }
        .btnPrimary {
          background: linear-gradient(180deg, #2e8b57 0%, #1f7a5a 100%);
          color: #061018;
          border-color: rgba(255, 255, 255, 0.12);
          box-shadow: 0 12px 30px rgba(31, 122, 90, 0.25);
        }
        .btnPrimary:hover {
          filter: brightness(1.03);
        }
        .btnSecondary {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.1);
          color: #fff;
        }
        .btnSecondary:hover {
          background: rgba(255, 255, 255, 0.09);
        }
        .btnGhost {
          background: rgba(255, 255, 255, 0.04);
          border-color: rgba(255, 255, 255, 0.1);
          color: #fff;
          padding: 10px 14px;
          border-radius: 12px;
        }
        .btnGhost:hover {
          background: rgba(255, 255, 255, 0.08);
        }

        .heroMeta {
          margin-top: 18px;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }
        .metaItem {
          display: flex;
          gap: 10px;
          align-items: center;
          padding: 12px;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }
        .metaNum {
          width: 34px;
          height: 34px;
          border-radius: 12px;
          display: grid;
          place-items: center;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }
        .metaText b {
          display: block;
          color: #fff;
          font-weight: 950;
          font-size: 12px;
        }
        .metaText span {
          display: block;
          margin-top: 2px;
          color: rgba(230, 237, 247, 0.7);
          font-weight: 800;
          font-size: 11px;
        }

        .heroRight {
          position: relative;
          display: grid;
          place-items: center;
        }

        .phone {
          width: min(360px, 100%);
          border-radius: 26px;
          padding: 12px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 30px 80px rgba(0, 0, 0, 0.45);
          backdrop-filter: blur(10px);
          z-index: 2;
        }
        .phoneTop {
          display: flex;
          gap: 6px;
          padding: 8px 6px 10px;
        }
        .dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.22);
        }

        .screen {
          display: grid;
          gap: 10px;
        }
        .card {
          padding: 12px;
          border-radius: 18px;
          background: rgba(7, 11, 18, 0.65);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }
        .card.big {
          padding: 14px;
        }
        .cardTitle {
          font-weight: 950;
          color: #fff;
          font-size: 13px;
        }
        .cardSub {
          color: rgba(230, 237, 247, 0.7);
          font-weight: 800;
          font-size: 11px;
          margin-top: 4px;
        }
        .mapMock {
          height: 150px;
          border-radius: 16px;
          margin-top: 10px;
          background: radial-gradient(
              300px 150px at 30% 30%,
              rgba(46, 139, 87, 0.28),
              transparent 60%
            ),
            radial-gradient(
              280px 170px at 70% 30%,
              rgba(11, 60, 93, 0.35),
              transparent 65%
            ),
            linear-gradient(180deg, rgba(255, 255, 255, 0.07), rgba(255, 255, 255, 0.03));
          border: 1px solid rgba(255, 255, 255, 0.08);
        }
        .row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 10px;
        }
        .pill {
          padding: 8px 10px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.08);
          font-weight: 900;
          font-size: 11px;
          color: rgba(230, 237, 247, 0.85);
        }
        .grid2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .card.share {
          padding: 12px;
        }
        .shareBar {
          display: flex;
          gap: 8px;
          margin-top: 10px;
          align-items: center;
        }
        .shareTag {
          flex: 1;
          padding: 10px 12px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.08);
          font-weight: 900;
          font-size: 11px;
          color: rgba(230, 237, 247, 0.8);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .shareBtn {
          padding: 10px 12px;
          border-radius: 14px;
          background: rgba(46, 139, 87, 0.9);
          color: #061018;
          font-weight: 950;
          font-size: 11px;
        }

        .glow {
          position: absolute;
          inset: -30px;
          filter: blur(28px);
          opacity: 0.55;
          z-index: 1;
        }
        .g1 {
          background: radial-gradient(
            300px 240px at 40% 40%,
            rgba(46, 139, 87, 0.55),
            transparent 70%
          );
        }
        .g2 {
          background: radial-gradient(
            300px 240px at 60% 70%,
            rgba(11, 60, 93, 0.55),
            transparent 70%
          );
        }

        .section {
          max-width: 1100px;
          margin: 0 auto;
          padding: 26px 18px;
        }
        .section.alt {
          margin-top: 10px;
          padding-top: 34px;
          padding-bottom: 34px;
          background: rgba(255, 255, 255, 0.03);
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }
        .sectionHead {
          margin-bottom: 14px;
        }
        .h2 {
          margin: 0;
          font-size: 22px;
          font-weight: 950;
          letter-spacing: -0.2px;
          color: #fff;
        }
        .p2 {
          margin: 8px 0 0;
          color: rgba(230, 237, 247, 0.72);
          font-weight: 700;
          line-height: 1.5;
          font-size: 14px;
          max-width: 70ch;
        }

        .cards3 {
          margin-top: 16px;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }
        .fCard {
          padding: 14px;
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }
        .fTop {
          display: flex;
          gap: 10px;
          align-items: center;
        }
        .fIcon {
          width: 38px;
          height: 38px;
          border-radius: 14px;
          display: grid;
          place-items: center;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.08);
          font-size: 18px;
        }
        .fTitle {
          font-weight: 950;
          color: #fff;
          font-size: 13px;
        }
        .fText {
          margin-top: 10px;
          color: rgba(230, 237, 247, 0.72);
          font-weight: 700;
          line-height: 1.45;
          font-size: 13px;
        }

        .split {
          display: grid;
          grid-template-columns: 1.1fr 0.9fr;
          gap: 16px;
          align-items: start;
        }

        .list {
          margin: 14px 0 0;
          padding: 0;
          list-style: none;
          display: grid;
          gap: 10px;
        }
        .list li {
          display: flex;
          gap: 10px;
          align-items: start;
          color: rgba(230, 237, 247, 0.78);
          font-weight: 800;
        }
        .tick {
          width: 22px;
          height: 22px;
          border-radius: 8px;
          display: grid;
          place-items: center;
          background: rgba(46, 139, 87, 0.22);
          border: 1px solid rgba(46, 139, 87, 0.35);
          color: #69d08c;
          font-weight: 950;
          flex: 0 0 auto;
        }
        .rowCtas {
          margin-top: 16px;
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .panel {
          border-radius: 18px;
          padding: 14px;
          background: rgba(7, 11, 18, 0.55);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }
        .panelTitle {
          font-weight: 950;
          color: #fff;
          font-size: 14px;
        }
        .panelSub {
          margin-top: 6px;
          color: rgba(230, 237, 247, 0.72);
          font-weight: 800;
          font-size: 12px;
        }
        .panelGrid {
          margin-top: 12px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .mini {
          padding: 12px;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }
        .miniLabel {
          color: rgba(230, 237, 247, 0.7);
          font-weight: 800;
          font-size: 12px;
        }
        .miniValue {
          margin-top: 8px;
          font-weight: 950;
          font-size: 20px;
          color: #fff;
        }
        .panelFooter {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }
        .hint {
          color: rgba(230, 237, 247, 0.7);
          font-weight: 750;
          font-size: 12px;
          line-height: 1.4;
        }

        .cards2 {
          margin-top: 16px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .bigCard {
          padding: 16px;
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }
        .bigTitle {
          font-weight: 950;
          color: #fff;
          font-size: 14px;
        }
        .bigText {
          margin-top: 10px;
          color: rgba(230, 237, 247, 0.72);
          font-weight: 750;
          line-height: 1.5;
          font-size: 13px;
        }
        .bigRow {
          margin-top: 12px;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .chip {
          padding: 8px 10px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.08);
          font-weight: 900;
          font-size: 11px;
          color: rgba(230, 237, 247, 0.85);
        }

        .footer {
          margin-top: 18px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          padding: 18px 18px 30px;
        }
        .footerInner {
          max-width: 1100px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .footerBrand {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .footerLinks {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }
        .fLink {
          color: rgba(230, 237, 247, 0.72);
          text-decoration: none;
          font-weight: 850;
          font-size: 12px;
          padding: 10px 10px;
          border-radius: 12px;
        }
        .fLink:hover {
          background: rgba(255, 255, 255, 0.06);
          color: #fff;
        }

        /* Responsive */
        @media (max-width: 980px) {
          .heroGrid {
            grid-template-columns: 1fr;
          }
          .heroRight {
            order: -1;
          }
          .cards3 {
            grid-template-columns: repeat(2, 1fr);
          }
          .split {
            grid-template-columns: 1fr;
          }
          .nav {
            display: none;
          }
        }

        @media (max-width: 560px) {
          .h1 {
            font-size: 32px;
          }
          .heroMeta {
            grid-template-columns: 1fr;
          }
          .cards3 {
            grid-template-columns: 1fr;
          }
          .cards2 {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  text,
}: {
  icon: string;
  title: string;
  text: string;
}) {
  return (
    <div className="fCard">
      <div className="fTop">
        <div className="fIcon" aria-hidden>
          {icon}
        </div>
        <div className="fTitle">{title}</div>
      </div>
      <div className="fText">{text}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="mini">
      <div className="miniLabel">{label}</div>
      <div className="miniValue">{value}</div>
    </div>
  );
}
