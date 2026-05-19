"use client";

export default function TermsPage() {
  return (
    <main style={styles.page}>
      <div style={styles.bgGlow} aria-hidden="true" />

      <div style={styles.container}>
        <header style={styles.header}>
          <h1 style={styles.title}>Termos de Uso – ConnectFish</h1>
          <p style={styles.meta}>
            Última atualização: 18 de maio de 2026 • Versão 1.1
          </p>
          <p style={styles.intro}>
            Estes Termos de Uso regulam o acesso e a utilização do ConnectFish,
            plataforma digital voltada ao registro de pescarias, mapas, replay
            de trajetos, compartilhamento de conteúdo, torneios, reservas,
            recursos sociais e funcionalidades relacionadas à pesca esportiva.
            Ao acessar, cadastrar-se ou utilizar o aplicativo, o usuário declara
            ter lido, compreendido e aceitado integralmente as condições abaixo.
          </p>
        </header>

        <Section title="1. Aceitação dos termos">
          Ao acessar ou utilizar o ConnectFish, o usuário concorda de forma
          expressa e integral com estes Termos de Uso e com a Política de
          Privacidade da plataforma. Caso não concorde, total ou parcialmente,
          deverá interromper imediatamente o uso do aplicativo, do site e de
          quaisquer serviços relacionados.
        </Section>

        <Section title="2. Quem somos e escopo da plataforma">
          O ConnectFish é uma plataforma digital voltada à experiência de pesca,
          permitindo, entre outras funcionalidades, registro de pescarias,
          captação de trajetos por geolocalização, replay de atividades,
          armazenamento de capturas, uso de mapas, compartilhamento de conteúdo,
          interação social, relatórios, torneios, reservas, rankings e operações
          relacionadas ao ecossistema do produto.
          <br />
          <br />
          O serviço poderá ser expandido, reduzido, modificado, reorganizado ou
          descontinuado parcialmente a qualquer tempo, conforme critérios
          técnicos, estratégicos, comerciais ou legais.
        </Section>

        <Section title="3. Elegibilidade e capacidade para uso">
          O usuário declara possuir capacidade legal para aceitar estes Termos.
          Caso seja menor de idade, o uso do aplicativo deverá ocorrer sob
          supervisão e responsabilidade de seus pais ou responsáveis legais, que
          responderão pelos atos praticados no âmbito da plataforma, na forma da
          legislação aplicável.
        </Section>

        <Section title="4. Cadastro, conta e segurança de acesso">
          Para acessar determinadas funcionalidades, o usuário deverá criar uma
          conta e fornecer informações corretas, completas e atualizadas.
          <br />
          <br />
          O usuário é o único responsável pela guarda de seu login, senha,
          dispositivo, autenticação e demais credenciais de acesso, bem como por
          toda atividade realizada em sua conta.
          <br />
          <br />
          O ConnectFish não se responsabiliza por acessos indevidos decorrentes
          de negligência, compartilhamento de credenciais, uso inseguro do
          dispositivo ou falhas atribuíveis ao próprio usuário.
        </Section>

        <Section title="5. Informações fornecidas pelo usuário">
          O usuário declara que todas as informações fornecidas ao ConnectFish
          são verdadeiras, atuais e legítimas, responsabilizando-se pela exatidão
          dos dados inseridos, incluindo identificação, perfil, mídia, conteúdo
          publicado, localização compartilhada, atividades registradas,
          documentos, dados de pagamento, dados de torneio e demais informações
          disponibilizadas no aplicativo ou no site.
        </Section>

        <Section title="6. Uso permitido da plataforma">
          O usuário concorda em utilizar o ConnectFish de forma lícita,
          responsável, segura e compatível com estes Termos, com a legislação
          vigente, com os direitos de terceiros e com a finalidade da plataforma.
        </Section>

        <Section title="7. Geolocalização, mapa e replay">
          O ConnectFish utiliza dados de localização para permitir
          funcionalidades como registro de trajetos, mapas, cálculo de
          distância, tempo de atividade, pontos de pesca, replay de percursos,
          marcadores, relatórios, ranking e recursos correlatos.
          <br />
          <br />
          O usuário reconhece que tais funcionalidades dependem da precisão dos
          sensores, permissões do dispositivo, sinal de GPS, conectividade,
          hardware, sistema operacional, serviços de terceiros e condições
          ambientais, podendo apresentar limitações, atrasos, imprecisões,
          interrupções ou falhas.
        </Section>

        <Section title="8. Localização em segundo plano">
          Em determinadas funcionalidades, o aplicativo poderá utilizar
          localização em segundo plano, desde que o usuário tenha concedido a
          autorização correspondente no dispositivo.
          <br />
          <br />
          O usuário reconhece que o rastreamento em segundo plano pode ser
          necessário para registrar atividades com tela bloqueada ou quando o
          aplicativo não estiver em primeiro plano, e que a ausência dessa
          permissão pode limitar ou comprometer a experiência.
        </Section>

        <Section title="9. Atividades, trajetos e validação mínima">
          As atividades registradas podem conter trajetos, pontos, capturas,
          fotos, vídeos, tempo, distância, localização, clima, relatórios e
          outras informações associadas.
          <br />
          <br />
          O ConnectFish poderá aplicar regras mínimas de validação, como
          distância mínima, pontos de GPS, qualidade do sinal, duração,
          consistência de deslocamento e outros critérios técnicos para reduzir
          registros falsos, incompletos ou fraudulentos.
        </Section>

        <Section title="10. Privacidade de pontos e rotas">
          O ConnectFish poderá oferecer controles de privacidade para pontos,
          rotas, replay, atividades, capturas e marcadores.
          <br />
          <br />
          O usuário é responsável pelas configurações escolhidas. Conteúdos
          públicos poderão ser visualizados por outros usuários e eventualmente
          compartilhados, copiados, fotografados, gravados ou registrados por
          terceiros.
          <br />
          <br />
          O ConnectFish não garante sigilo absoluto de informações que o próprio
          usuário torne públicas ou compartilhe voluntariamente.
        </Section>

        <Section title="11. Conteúdo gerado pelo usuário">
          O usuário é o único responsável por todo conteúdo que publicar,
          enviar, registrar, compartilhar, armazenar ou tornar disponível no
          ConnectFish, incluindo textos, comentários, fotos, vídeos, capturas,
          rotas, replays, localizações, descrições, interações, avaliações e
          demais informações.
          <br />
          <br />
          O usuário declara possuir todos os direitos, permissões e autorizações
          necessários para utilizar e compartilhar esse conteúdo, respondendo por
          eventual violação de direitos de terceiros.
        </Section>

        <Section title="12. Licença de uso do conteúdo pelo ConnectFish">
          Ao publicar conteúdo na plataforma, o usuário concede ao ConnectFish
          uma licença não exclusiva, gratuita, mundial e revogável nos limites
          da exclusão de conteúdo e da conta, para hospedar, armazenar,
          processar, reproduzir, adaptar tecnicamente, exibir e disponibilizar
          esse conteúdo dentro das funcionalidades do aplicativo, sempre
          respeitadas as configurações de visibilidade aplicáveis e a Política
          de Privacidade.
        </Section>

        <Section title="13. Interação social e comunidade">
          O usuário concorda em manter conduta respeitosa, ética e compatível
          com a legislação vigente em todas as interações realizadas no
          ConnectFish.
          <br />
          <br />
          Não será tolerado conteúdo ofensivo, discriminatório, ameaçador,
          abusivo, ilegal, difamatório, fraudulento, enganoso ou que viole
          direitos de terceiros, a integridade da comunidade ou a finalidade da
          plataforma.
        </Section>

        <Section title="14. Condutas proibidas">
          <ul style={styles.list}>
            <li>utilizar a plataforma para fins ilícitos ou fraudulentos;</li>
            <li>manipular registros de GPS, capturas, torneios ou rankings;</li>
            <li>tentar acessar contas, sistemas ou dados sem autorização;</li>
            <li>realizar engenharia reversa ou explorar vulnerabilidades;</li>
            <li>inserir malware, scripts maliciosos, spam ou automações abusivas;</li>
            <li>publicar conteúdo que viole direitos autorais, imagem ou privacidade;</li>
            <li>simular identidade, falsear informações ou manipular registros;</li>
            <li>usar o app para coletar dados de outros usuários sem autorização;</li>
            <li>comprometer desempenho, disponibilidade ou segurança da plataforma;</li>
            <li>divulgar pontos privados de terceiros sem autorização;</li>
            <li>incentivar práticas ilegais, predatórias ou ambientais irregulares.</li>
          </ul>
        </Section>

        <Section title="15. Moderação e remoção de conteúdo">
          O ConnectFish poderá analisar, restringir, suspender, ocultar, remover
          ou bloquear conteúdos, funcionalidades, contas e acessos que possam
          representar risco jurídico, técnico, operacional, reputacional ou de
          segurança, bem como conteúdos potencialmente irregulares, abusivos,
          ilícitos ou incompatíveis com estes Termos.
        </Section>

        <Section title="16. Suspensão, bloqueio e encerramento de conta">
          O ConnectFish poderá suspender temporária ou definitivamente a conta do
          usuário, restringir funcionalidades, cancelar acessos ou encerrar a
          relação de uso quando houver indícios de violação destes Termos,
          fraude, abuso, risco à comunidade, uso indevido da plataforma,
          determinação legal, exigência regulatória, incidente de segurança ou
          qualquer situação que justifique medidas protetivas.
        </Section>

        <Section title="17. Torneios e competições">
          O ConnectFish poderá oferecer recursos para criação, divulgação,
          participação e gerenciamento de torneios de pesca.
          <br />
          <br />
          As regras específicas de cada torneio poderão ser definidas por seus
          organizadores. O usuário é responsável por ler, compreender e cumprir
          as regras aplicáveis antes de participar.
          <br />
          <br />
          O ConnectFish poderá atuar como ferramenta tecnológica, não sendo
          necessariamente o organizador, juiz, patrocinador ou responsável direto
          por todos os torneios criados por terceiros.
        </Section>

        <Section title="18. Validação antifraude em torneios">
          Para preservar a integridade das competições, o ConnectFish e/ou os
          organizadores poderão analisar registros de GPS, fotos, vídeos,
          horários, trajetos, capturas, metadados, medidas declaradas,
          localização, padrões de uso e outras informações relacionadas à
          atividade.
          <br />
          <br />
          Suspeitas de fraude, manipulação, falsificação, uso indevido ou
          violação de regras poderão resultar em revisão, desclassificação,
          bloqueio, suspensão da conta ou outras medidas cabíveis.
        </Section>

        <Section title="19. Responsabilidade dos organizadores de torneios">
          Organizadores de torneios são responsáveis por definir regras,
          critérios de participação, validação, premiação, comunicação,
          cancelamento, reembolso, julgamento e condução do evento.
          <br />
          <br />
          O ConnectFish não garante a regularidade, execução, premiação ou
          resultado de torneios organizados por terceiros, salvo quando
          expressamente indicado.
        </Section>

        <Section title="20. Reservas, pesqueiros e marketplace">
          O ConnectFish poderá disponibilizar recursos relacionados a reservas,
          pesqueiros, guias, experiências, marketplace, serviços, produtos,
          anúncios e parceiros terceiros.
          <br />
          <br />
          Nesses casos, o ConnectFish atua como plataforma tecnológica
          intermediadora, não sendo responsável direto pela execução dos serviços
          prestados por terceiros, salvo quando expressamente indicado.
        </Section>

        <Section title="21. Pagamentos, taxas e reembolsos">
          Determinadas funcionalidades poderão envolver pagamentos, assinaturas,
          inscrições, reservas ou transações processadas por provedores
          terceiros.
          <br />
          <br />
          Taxas, prazos, reembolsos, cancelamentos, chargebacks e condições
          comerciais poderão variar conforme o serviço contratado, o organizador,
          o parceiro ou o processador de pagamento utilizado.
        </Section>

        <Section title="22. Planos, assinaturas e recursos pagos">
          O ConnectFish poderá oferecer planos gratuitos e pagos, com limites,
          funcionalidades, benefícios, regras próprias e recursos exclusivos.
          <br />
          <br />
          Recursos pagos poderão ser alterados, adicionados, removidos ou
          ajustados conforme evolução da plataforma, respeitadas as condições
          legais aplicáveis.
        </Section>

        <Section title="23. Inteligência artificial e automações">
          O ConnectFish poderá utilizar recursos automatizados, inteligência
          artificial, reconhecimento de padrões, geração de relatórios,
          validações, recomendações e sugestões.
          <br />
          <br />
          Esses recursos podem apresentar erros, imprecisões, limitações
          técnicas ou interpretações incorretas, não devendo ser utilizados como
          única base para decisões importantes.
        </Section>

        <Section title="24. Clima, mapas e informações externas">
          O ConnectFish poderá exibir informações de clima, mapas, localização,
          distância, regiões, rotas, águas e dados provenientes de terceiros.
          <br />
          <br />
          Essas informações podem conter atrasos, falhas ou imprecisões. O
          ConnectFish não garante disponibilidade, atualização ou exatidão
          absoluta desses dados.
        </Section>

        <Section title="25. Segurança física e navegação">
          O ConnectFish não constitui ferramenta oficial de navegação,
          salvamento, monitoramento de risco, controle ambiental, previsão
          climática crítica, prevenção de acidentes ou suporte emergencial.
          <br />
          <br />
          O aplicativo não substitui equipamentos de segurança, colete
          salva-vidas, navegação profissional, mapas oficiais, orientação
          náutica, comunicação de emergência, previsão meteorológica oficial ou
          conhecimento técnico especializado.
        </Section>

        <Section title="26. Riscos da atividade de pesca">
          A prática de pesca e deslocamento em rios, lagos, represas, mar,
          barcos, margens, áreas remotas ou terrenos irregulares envolve riscos
          inerentes, incluindo quedas, afogamento, colisões, lesões, ataques de
          animais, intempéries, falhas de navegação, problemas mecânicos, perda
          de sinal, acidentes com equipamentos, isolamento geográfico e danos
          materiais.
          <br />
          <br />
          O usuário reconhece que utiliza o ConnectFish por sua conta e risco.
        </Section>

        <Section title="27. Propriedade intelectual">
          Todos os direitos de propriedade intelectual relacionados ao
          ConnectFish, incluindo software, marca, nome, identidade visual,
          layout, design, interface, fluxos, banco de dados, textos,
          tecnologias e demais elementos protegidos pertencem ao ConnectFish ou
          a terceiros licenciantes.
          <br />
          <br />
          É proibida a reprodução, distribuição, adaptação, extração, engenharia
          reversa, comercialização ou uso não autorizado desses elementos.
        </Section>

        <Section title="28. Serviços de terceiros">
          O funcionamento do ConnectFish pode depender de serviços, APIs, SDKs,
          bibliotecas, ferramentas de autenticação, mapas, geolocalização,
          armazenamento, monitoramento, pagamentos, infraestrutura e outros
          recursos de terceiros.
          <br />
          <br />
          O ConnectFish não se responsabiliza por falhas, indisponibilidades,
          imprecisões, alterações, limitações ou danos decorrentes desses
          serviços.
        </Section>

        <Section title="29. Disponibilidade e continuidade do serviço">
          O ConnectFish não garante disponibilidade contínua, ininterrupta ou
          livre de erros.
          <br />
          <br />
          O aplicativo poderá passar por manutenção, atualizações, interrupções,
          falhas, lentidão, instabilidades, limitações temporárias ou
          descontinuidade parcial ou total de funcionalidades.
        </Section>

        <Section title="30. Limitação de responsabilidade">
          Na máxima extensão permitida pela legislação aplicável, o ConnectFish
          não será responsável por danos diretos, indiretos, incidentais,
          especiais, consequenciais, lucros cessantes, perda de oportunidade,
          perda de dados, danos morais, danos materiais, prejuízos operacionais
          ou quaisquer perdas decorrentes de:
          <ul style={styles.list}>
            <li>uso ou impossibilidade de uso da plataforma;</li>
            <li>falhas de GPS, internet, dispositivo, mapas ou clima;</li>
            <li>erros em replay, distância, localização ou relatórios;</li>
            <li>condutas de usuários, organizadores ou terceiros;</li>
            <li>interrupções, indisponibilidades ou falhas técnicas;</li>
            <li>decisões tomadas com base em informações da plataforma;</li>
            <li>eventos ocorridos durante pescarias ou deslocamentos;</li>
            <li>uso inadequado do aplicativo, dispositivo ou permissões.</li>
          </ul>
        </Section>

        <Section title="31. Indenização">
          O usuário concorda em defender, indenizar e manter indene o
          ConnectFish, seus representantes, sócios, colaboradores e parceiros em
          relação a reclamações, demandas, perdas, responsabilidades, custos e
          despesas decorrentes de violação destes Termos, uso indevido da
          plataforma, conteúdo publicado, infração a direitos de terceiros,
          conduta ilícita ou descumprimento da legislação aplicável.
        </Section>

        <Section title="32. Privacidade e proteção de dados">
          O tratamento de dados pessoais realizado pelo ConnectFish é regido por
          sua Política de Privacidade, que integra estes Termos para todos os
          fins.
          <br />
          <br />
          Ao utilizar a plataforma, o usuário reconhece que determinados dados
          serão tratados para viabilizar funcionalidades, segurança, operação do
          serviço, prevenção de fraude e melhorias da experiência.
        </Section>

        <Section title="33. Exclusão de conta">
          O usuário poderá solicitar a exclusão de sua conta por meio dos canais
          ou recursos disponibilizados pela plataforma.
          <br />
          <br />
          A exclusão poderá resultar em remoção, anonimização ou retenção
          limitada de certos dados e conteúdos, conforme a natureza da
          informação, obrigações legais, interesses legítimos, segurança da
          plataforma, prevenção de fraudes e regras descritas na Política de
          Privacidade.
        </Section>

        <Section title="34. Alterações destes Termos">
          Estes Termos poderão ser alterados, atualizados ou substituídos a
          qualquer momento para refletir ajustes legais, regulatórios, técnicos,
          operacionais, comerciais ou de produto.
          <br />
          <br />
          A versão vigente será aquela disponibilizada na plataforma ou no site
          oficial, com a respectiva data de atualização.
        </Section>

        <Section title="35. Legislação aplicável e foro">
          Estes Termos são regidos pelas leis da República Federativa do Brasil.
          <br />
          <br />
          Fica eleito o foro da comarca de domicílio da empresa responsável pela
          plataforma, salvo hipótese legal de competência específica ou proteção
          mais favorável ao consumidor quando obrigatoriamente aplicável.
        </Section>

        <Section title="36. Contato">
          ConnectFish Serviços e Comércios Ltda
          <br />
          CNPJ: 64.913.989/0001-07
          <br />
          Araçoiaba da Serra – SP
          <br />
          <br />
          Em caso de dúvidas, solicitações ou comunicações relacionadas a estes
          Termos de Uso:
          <br />
          📧 aplicativo.pesca1@gmail.com
        </Section>
      </div>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={styles.section}>
      <h2 style={styles.sectionTitle}>{title}</h2>
      <div style={styles.text}>{children}</div>
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(1200px 800px at 20% 10%, rgba(45,212,191,0.12), transparent 60%)," +
      "radial-gradient(900px 600px at 85% 30%, rgba(56,189,248,0.12), transparent 60%)," +
      "linear-gradient(180deg, #06141a 0%, #050a0f 100%)",
    color: "#e6f6f7",
    position: "relative",
    overflow: "hidden",
    padding: 28,
  },

  bgGlow: {
    position: "absolute",
    inset: -200,
    background:
      "radial-gradient(circle at 50% 50%, rgba(16,185,129,0.08), transparent 55%)",
    filter: "blur(30px)",
    pointerEvents: "none",
  },

  container: {
    position: "relative",
    maxWidth: 980,
    margin: "0 auto",
    paddingBottom: 48,
  },

  header: {
    padding: 24,
    borderRadius: 20,
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))",
    border: "1px solid rgba(255,255,255,0.10)",
    boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
    backdropFilter: "blur(10px)",
  },

  title: {
    margin: 0,
    fontSize: 34,
    fontWeight: 950,
    lineHeight: 1.08,
    letterSpacing: -0.6,
  },

  meta: {
    marginTop: 10,
    marginBottom: 0,
    opacity: 0.72,
    fontSize: 14,
    fontWeight: 700,
  },

  intro: {
    marginTop: 16,
    marginBottom: 0,
    fontSize: 16,
    lineHeight: 1.75,
    color: "rgba(230,246,247,0.84)",
  },

  section: {
    marginTop: 18,
    padding: 22,
    borderRadius: 18,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.10)",
    boxShadow: "0 16px 40px rgba(0,0,0,0.25)",
  },

  sectionTitle: {
    margin: 0,
    fontSize: 20,
    fontWeight: 900,
    letterSpacing: -0.2,
  },

  text: {
    marginTop: 10,
    lineHeight: 1.8,
    fontSize: 15,
    color: "rgba(230,246,247,0.84)",
  },

  list: {
    marginTop: 10,
    paddingLeft: 22,
    lineHeight: 1.8,
  },
};