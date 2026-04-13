"use client";

export default function TermsPage() {
  return (
    <main style={styles.page}>
      <div style={styles.bgGlow} aria-hidden="true" />

      <div style={styles.container}>
        <header style={styles.header}>
          <h1 style={styles.title}>Termos de Uso – ConnectFish</h1>
          <p style={styles.meta}>Última atualização: 11 de abril de 2026</p>
          <p style={styles.intro}>
            Estes Termos de Uso regulam o acesso e a utilização do ConnectFish,
            plataforma digital voltada ao registro de atividades de pesca,
            visualização de mapas, replay de trajetos, compartilhamento de
            conteúdo e interação entre usuários. Ao acessar, cadastrar-se ou
            utilizar o aplicativo, o usuário declara ter lido, compreendido e
            aceitado integralmente as condições abaixo.
          </p>
        </header>

        <Section title="1. Aceitação dos termos">
          Ao acessar ou utilizar o ConnectFish, o usuário concorda de forma
          expressa e integral com estes Termos de Uso e com a Política de
          Privacidade da plataforma. Caso não concorde, total ou parcialmente,
          com qualquer disposição aqui prevista, deverá interromper
          imediatamente o uso do aplicativo, do site e de quaisquer serviços
          relacionados.
        </Section>

        <Section title="2. Quem somos e escopo da plataforma">
          O ConnectFish é uma plataforma digital voltada à experiência de pesca,
          permitindo, entre outras funcionalidades, o registro de pescarias, a
          captação de trajetos por geolocalização, a geração de replay de
          atividades, o armazenamento de capturas, o uso de mapas, o
          compartilhamento de conteúdo, a interação entre usuários e a gestão de
          operações relacionadas ao ecossistema do produto. O serviço poderá ser
          expandido, reduzido, modificado ou reorganizado a qualquer tempo,
          conforme critérios técnicos, estratégicos, comerciais ou legais.
        </Section>

        <Section title="3. Elegibilidade e capacidade para uso">
          O usuário declara possuir capacidade legal para aceitar estes Termos
          de Uso. Caso seja menor de idade, o uso do aplicativo deverá ocorrer
          sob supervisão e responsabilidade de seus pais ou responsáveis legais,
          que responderão civilmente pelos atos praticados no âmbito da
          plataforma, na forma da legislação aplicável.
        </Section>

        <Section title="4. Cadastro, conta e segurança de acesso">
          Para acessar determinadas funcionalidades, o usuário deverá criar uma
          conta e fornecer informações corretas, completas e atualizadas. O
          usuário é o único responsável pela guarda de seu login, senha e
          demais credenciais de acesso, bem como por toda e qualquer atividade
          realizada em sua conta. O ConnectFish não se responsabiliza por
          acessos indevidos decorrentes de negligência, compartilhamento de
          credenciais, uso inseguro do dispositivo ou falhas atribuíveis ao
          próprio usuário.
        </Section>

        <Section title="5. Informações fornecidas pelo usuário">
          O usuário declara que todas as informações fornecidas ao ConnectFish
          são verdadeiras, atuais e legítimas, responsabilizando-se
          integralmente pela exatidão dos dados inseridos, incluindo
          identificação, perfil, mídia, conteúdo publicado, localização
          compartilhada, atividades registradas e demais informações
          disponibilizadas no aplicativo ou no site.
        </Section>

        <Section title="6. Funcionalidades de geolocalização, mapa e replay">
          O ConnectFish utiliza dados de localização para permitir
          funcionalidades como registro de trajetos, mapas, cálculo de
          distância, tempo de atividade, pontos de pesca, replay de percursos,
          marcadores e recursos correlatos. O usuário reconhece que tais
          funcionalidades dependem da precisão dos sensores, permissões do
          dispositivo, sinal de GPS, conectividade, hardware, sistema
          operacional, serviços de terceiros e condições ambientais, podendo
          apresentar limitações, atrasos, imprecisões, interrupções ou falhas.
        </Section>

        <Section title="7. Localização em segundo plano">
          Em determinadas funcionalidades, o aplicativo poderá utilizar
          localização em segundo plano, desde que o usuário tenha concedido a
          autorização correspondente no dispositivo. O usuário reconhece que o
          uso de rastreamento em segundo plano pode ser necessário para certos
          recursos, inclusive continuidade de registro com tela bloqueada ou
          quando o aplicativo não estiver em primeiro plano, e que a ausência
          dessa permissão pode limitar ou comprometer a experiência oferecida.
        </Section>

        <Section title="8. O ConnectFish não é ferramenta oficial de navegação ou segurança">
          O ConnectFish não constitui ferramenta oficial de navegação,
          salvamento, monitoramento de risco, controle ambiental, previsão
          climática crítica, prevenção de acidentes ou suporte emergencial. Os
          dados exibidos pela plataforma, incluindo mapas, localização, replay,
          clima, trajetos, estimativas, pontos e demais informações, possuem
          caráter auxiliar e informativo, não substituindo a análise humana, o
          bom senso, a experiência do usuário, equipamentos adequados e as
          orientações oficiais aplicáveis.
        </Section>

        <Section title="9. Atividade de pesca e riscos físicos">
          A prática de pesca, deslocamento em rios, lagos, represas, mar,
          barcos, margens, áreas remotas ou terrenos irregulares envolve riscos
          inerentes, incluindo, sem limitação, quedas, afogamento, colisões,
          lesões, ataques de animais, intempéries, falhas de navegação,
          problemas mecânicos, perda de sinal, acidentes com equipamentos,
          isolamento geográfico e danos materiais. O usuário reconhece e aceita
          que a utilização do ConnectFish ocorre por sua conta e risco, sendo
          integralmente responsável por sua segurança física, por seus atos e
          por suas decisões em campo.
        </Section>

        <Section title="10. Clima, rotas, trajetos e decisões do usuário">
          Informações relacionadas a clima, rota, replay, distância, tempo,
          posicionamento e demais dados operacionais podem conter atrasos,
          inconsistências, variações ou imprecisões. O usuário não deverá tomar
          decisões críticas com base exclusiva nessas informações. O ConnectFish
          não garante a exatidão absoluta desses dados e não se responsabiliza
          por prejuízos, danos, acidentes, perdas ou decisões tomadas a partir
          do uso da plataforma.
        </Section>

        <Section title="11. Conteúdo gerado pelo usuário">
          O usuário é o único responsável por todo conteúdo que publicar,
          enviar, registrar, compartilhar, armazenar ou tornar disponível no
          ConnectFish, incluindo textos, comentários, fotos, vídeos, capturas,
          rotas, replays, localizações, descrições, interações e demais
          informações. O usuário declara possuir todos os direitos, permissões e
          autorizações necessários para utilizar e compartilhar esse conteúdo,
          respondendo exclusivamente por eventual violação de direitos de
          terceiros.
        </Section>

        <Section title="12. Licença de uso do conteúdo pelo ConnectFish">
          Ao publicar conteúdo na plataforma, o usuário concede ao ConnectFish,
          de forma não exclusiva, gratuita, revogável nos limites da exclusão de
          conteúdo e da conta, uma licença para hospedar, armazenar, processar,
          reproduzir, adaptar tecnicamente, exibir e disponibilizar esse
          conteúdo dentro das funcionalidades do aplicativo, sempre respeitadas
          as configurações de visibilidade aplicáveis e a Política de
          Privacidade.
        </Section>

        <Section title="13. Interação social e convivência na plataforma">
          O usuário concorda em manter conduta respeitosa, ética e compatível
          com a legislação vigente em todas as interações realizadas no
          ConnectFish. Não será tolerado conteúdo ofensivo, discriminatório,
          ameaçador, abusivo, ilegal, difamatório, fraudulento, enganoso ou que
          viole direitos de terceiros, a integridade da comunidade ou a
          finalidade da plataforma.
        </Section>

        <Section title="14. Condutas estritamente proibidas">
          <ul style={styles.list}>
            <li>utilizar a plataforma para fins ilícitos ou fraudulentos;</li>
            <li>tentar acessar contas, sistemas ou dados sem autorização;</li>
            <li>
              realizar engenharia reversa, exploração de vulnerabilidades ou
              qualquer tentativa de comprometer a segurança do aplicativo;
            </li>
            <li>
              inserir malware, scripts maliciosos, spam, automações abusivas ou
              qualquer mecanismo prejudicial;
            </li>
            <li>
              publicar conteúdo que viole direitos autorais, privacidade,
              imagem, honra ou outros direitos de terceiros;
            </li>
            <li>
              simular identidade, falsear informações ou manipular registros da
              plataforma;
            </li>
            <li>
              usar o ConnectFish para coletar dados de outros usuários sem base
              legal ou autorização;
            </li>
            <li>
              utilizar a plataforma de forma a comprometer desempenho,
              disponibilidade, integridade ou reputação do serviço.
            </li>
          </ul>
        </Section>

        <Section title="15. Moderação, remoção de conteúdo e medidas de proteção">
          O ConnectFish poderá, a seu exclusivo critério e sem obrigação de
          aviso prévio, analisar, restringir, suspender, ocultar, remover ou
          bloquear conteúdos, funcionalidades, contas e acessos que possam
          representar risco jurídico, técnico, operacional, reputacional ou de
          segurança, bem como conteúdos potencialmente irregulares, abusivos,
          ilícitos ou incompatíveis com estes Termos.
        </Section>

        <Section title="16. Suspensão, bloqueio e encerramento de conta">
          O ConnectFish poderá suspender temporária ou definitivamente a conta
          do usuário, restringir funcionalidades, cancelar acessos ou encerrar a
          relação de uso quando houver indícios de violação destes Termos,
          fraude, abuso, risco à comunidade, uso indevido da plataforma,
          determinação legal, exigência regulatória, incidente de segurança ou
          qualquer situação que justifique a adoção de medidas protetivas.
        </Section>

        <Section title="17. Disponibilidade e continuidade do serviço">
          O ConnectFish não garante disponibilidade contínua, ininterrupta ou
          livre de erros. O aplicativo poderá passar por manutenção,
          atualizações, interrupções, falhas, lentidão, instabilidades,
          limitações temporárias ou descontinuidade parcial ou total de
          funcionalidades, sem que isso gere direito a indenização ou obrigação
          de continuidade integral do serviço.
        </Section>

        <Section title="18. Serviços de terceiros">
          O funcionamento do ConnectFish pode depender de serviços, APIs,
          provedores, SDKs, bibliotecas, ferramentas de autenticação, mapas,
          geolocalização, armazenamento, monitoramento, infraestrutura e outros
          recursos de terceiros. O ConnectFish não se responsabiliza por falhas,
          indisponibilidades, imprecisões, alterações, limitações ou danos
          decorrentes de serviços de terceiros integrados ou utilizados pela
          plataforma.
        </Section>

        <Section title="19. Propriedade intelectual">
          Todos os direitos de propriedade intelectual relacionados ao
          ConnectFish, incluindo software, marca, nome, identidade visual,
          layout, design, organização da interface, fluxos, banco de dados,
          textos institucionais, tecnologias e demais elementos protegidos,
          pertencem ao ConnectFish ou a terceiros licenciantes. É vedada a
          reprodução, distribuição, adaptação, extração, engenharia reversa,
          comercialização ou uso não autorizado desses elementos.
        </Section>

        <Section title="20. Privacidade e tratamento de dados">
          O tratamento de dados pessoais realizado pelo ConnectFish é regido por
          sua Política de Privacidade, que integra estes Termos para todos os
          fins. Ao utilizar a plataforma, o usuário reconhece que determinados
          dados serão tratados para viabilizar funcionalidades, segurança,
          operação do serviço, prevenção de fraude e melhorias da experiência.
        </Section>

        <Section title="21. Exclusão de conta">
          O usuário poderá solicitar a exclusão de sua conta por meio dos canais
          ou recursos disponibilizados pela plataforma. A exclusão poderá
          resultar em remoção, anonimização ou retenção limitada de certos dados
          e conteúdos, conforme a natureza da informação, obrigações legais,
          interesses legítimos, segurança da plataforma, prevenção de fraudes e
          regras descritas na Política de Privacidade.
        </Section>

        <Section title="22. Limitação de responsabilidade">
          Na máxima extensão permitida pela legislação aplicável, o ConnectFish,
          seus sócios, administradores, afiliados, colaboradores, parceiros,
          fornecedores e licenciantes não serão responsáveis por danos diretos,
          indiretos, incidentais, especiais, consequenciais, lucros cessantes,
          perda de oportunidade, perda de dados, danos morais, danos materiais,
          prejuízos operacionais ou quaisquer perdas decorrentes de:
          <ul style={styles.list}>
            <li>uso ou impossibilidade de uso da plataforma;</li>
            <li>
              falhas, atrasos, erros ou imprecisões em dados de localização,
              mapas, clima, trajetos, replay ou conteúdo;
            </li>
            <li>condutas de usuários ou terceiros;</li>
            <li>interrupções, indisponibilidades ou falhas técnicas;</li>
            <li>decisões tomadas com base em informações da plataforma;</li>
            <li>eventos ocorridos durante atividades de pesca ou deslocamento;</li>
            <li>uso inadequado do aplicativo, do dispositivo ou das permissões.</li>
          </ul>
        </Section>

        <Section title="23. Indenização">
          O usuário concorda em defender, indenizar e manter indene o
          ConnectFish, seus representantes e parceiros em relação a quaisquer
          reclamações, demandas, perdas, responsabilidades, custos e despesas,
          inclusive honorários advocatícios, decorrentes de: violação destes
          Termos, uso indevido da plataforma, conteúdo publicado, infração a
          direitos de terceiros, conduta ilícita ou descumprimento da legislação
          aplicável.
        </Section>

        <Section title="24. Alterações dos Termos de Uso">
          Estes Termos poderão ser alterados, atualizados ou substituídos a
          qualquer momento, a critério do ConnectFish, para refletir ajustes
          legais, regulatórios, técnicos, operacionais, comerciais ou de
          produto. A versão vigente será aquela disponibilizada na plataforma ou
          no site oficial, com a respectiva data de atualização. O uso contínuo
          da plataforma após a atualização poderá caracterizar ciência e aceite
          da nova versão, sem prejuízo de mecanismos adicionais de confirmação
          quando considerados necessários.
        </Section>

        <Section title="25. Legislação aplicável e foro">
          Estes Termos de Uso são regidos pelas leis da República Federativa do
          Brasil. Fica eleito o foro da comarca de domicílio da empresa
          responsável pela plataforma, salvo hipótese legal de competência
          específica ou proteção mais favorável ao consumidor quando
          obrigatoriamente aplicável.
        </Section>

        <Section title="26. Contato">
          Em caso de dúvidas, solicitações, notificações ou comunicações
          relacionadas a estes Termos de Uso, o usuário poderá entrar em contato
          pelo e-mail: aplicativo.pesca1@gmail.com.
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