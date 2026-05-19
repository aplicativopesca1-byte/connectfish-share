"use client";

export default function PrivacyPage() {
  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <h1 style={styles.title}>
          Política de Privacidade – ConnectFish
        </h1>

        <p style={styles.meta}>
          Última atualização: 18 de maio de 2026 • Versão 1.0
        </p>

        <Section title="1. Introdução">
          Esta Política de Privacidade descreve como o ConnectFish coleta,
          utiliza, armazena, compartilha, protege e trata dados pessoais e
          informações relacionadas ao uso da plataforma, em conformidade com a
          Lei Geral de Proteção de Dados (Lei nº 13.709/2018 – LGPD) e demais
          legislações aplicáveis.
          <br />
          <br />
          Ao acessar, instalar, criar conta ou utilizar o ConnectFish, o
          usuário declara estar ciente e de acordo com os termos desta Política
          de Privacidade.
        </Section>

        <Section title="2. Sobre o ConnectFish">
          O ConnectFish é uma plataforma digital voltada ao registro de
          pescarias, replay de trajetos, mapas interativos, interação social,
          compartilhamento de capturas, relatórios de atividades, torneios,
          reservas, experiências relacionadas à pesca esportiva e funcionalidades
          conectadas à geolocalização.
        </Section>

        <Section title="3. Dados coletados">
          Podemos coletar diferentes categorias de informações:
          <ul style={styles.list}>
            <li>Nome, email, username e foto de perfil</li>
            <li>Informações de login e autenticação</li>
            <li>Dados de dispositivo e sistema operacional</li>
            <li>Endereço IP e logs técnicos</li>
            <li>Informações de uso e navegação</li>
            <li>Dados de GPS e geolocalização</li>
            <li>Trajetos e replay de atividades</li>
            <li>Pontos marcados e capturas registradas</li>
            <li>Fotos, vídeos e conteúdos publicados</li>
            <li>Interações sociais e comentários</li>
            <li>Dados relacionados a torneios e reservas</li>
            <li>Informações relacionadas à assinatura e pagamentos</li>
          </ul>
        </Section>

        <Section title="4. Dados de localização e rastreamento">
          O ConnectFish utiliza dados de localização em tempo real e, quando
          autorizado pelo usuário, também em segundo plano.
          <br />
          <br />
          Esses dados podem ser utilizados para:
          <ul style={styles.list}>
            <li>Registrar trajetos de pescaria</li>
            <li>Gerar replay de atividades</li>
            <li>Exibir rotas no mapa</li>
            <li>Calcular distância e tempo</li>
            <li>Registrar pontos e capturas</li>
            <li>Gerar relatórios de atividade</li>
            <li>Permitir recursos sociais baseados em localização</li>
            <li>Validar atividades e reduzir fraudes</li>
          </ul>
          A precisão do GPS pode variar conforme:
          <ul style={styles.list}>
            <li>Condições climáticas</li>
            <li>Ambiente e relevo</li>
            <li>Qualidade do sinal</li>
            <li>Modelo do dispositivo</li>
            <li>Configurações do sistema operacional</li>
            <li>Permissões concedidas</li>
          </ul>
          O ConnectFish não garante precisão absoluta dos dados de localização.
        </Section>

        <Section title="5. Rastreamento em segundo plano">
          Algumas funcionalidades exigem rastreamento contínuo mesmo quando o
          aplicativo estiver minimizado ou em segundo plano.
          <br />
          <br />
          O usuário pode controlar essas permissões diretamente nas configurações
          do dispositivo e do sistema operacional.
        </Section>

        <Section title="6. Replay, rotas e compartilhamento">
          O ConnectFish pode permitir a visualização de replay de trajetos,
          deslocamentos, rotas, capturas e eventos registrados durante uma
          atividade.
          <br />
          <br />
          Dependendo das configurações escolhidas pelo usuário, determinadas
          informações poderão ficar visíveis para outros usuários da plataforma.
          <br />
          <br />
          O usuário é responsável pelas configurações de privacidade utilizadas
          em cada atividade.
        </Section>

        <Section title="7. Pontos privados e áreas de pesca">
          O ConnectFish disponibiliza controles de privacidade relacionados a
          pontos de pesca, marcadores, replay e compartilhamento de localização.
          <br />
          <br />
          Ainda assim, o ConnectFish não garante sigilo absoluto das informações
          compartilhadas pelo usuário, especialmente em conteúdos públicos,
          capturas de tela, gravações externas ou compartilhamentos realizados
          por terceiros.
        </Section>

        <Section title="8. Conteúdo enviado pelo usuário">
          O usuário poderá publicar conteúdos como:
          <ul style={styles.list}>
            <li>Fotos</li>
            <li>Vídeos</li>
            <li>Comentários</li>
            <li>Capturas</li>
            <li>Relatórios</li>
            <li>Dados de pescaria</li>
          </ul>
          O usuário declara possuir os direitos necessários sobre os conteúdos
          publicados e assume responsabilidade integral pelas informações
          compartilhadas.
        </Section>

        <Section title="9. Interações sociais">
          O ConnectFish possui funcionalidades sociais e comunitárias.
          <br />
          <br />
          Usuários podem visualizar, comentar, curtir, compartilhar ou interagir
          com conteúdos públicos conforme as permissões disponíveis na
          plataforma.
        </Section>

        <Section title="10. Moderação e segurança da comunidade">
          O ConnectFish poderá analisar, moderar, restringir, remover ou bloquear
          conteúdos e contas que violem:
          <ul style={styles.list}>
            <li>Legislação aplicável</li>
            <li>Direitos de terceiros</li>
            <li>Diretrizes da comunidade</li>
            <li>Segurança da plataforma</li>
            <li>Políticas internas</li>
          </ul>
        </Section>

        <Section title="11. Torneios e competições">
          A plataforma poderá oferecer recursos relacionados a torneios e
          competições.
          <br />
          <br />
          O ConnectFish atua como plataforma tecnológica intermediadora e não se
          responsabiliza diretamente pelas regras específicas definidas por
          organizadores terceiros.
          <br />
          <br />
          Atividades, imagens, GPS, trajetos e registros poderão ser analisados
          para prevenção de fraude, validação de resultados e segurança da
          competição.
        </Section>

        <Section title="12. Reservas, marketplace e terceiros">
          O ConnectFish poderá integrar funcionalidades relacionadas a reservas,
          pesqueiros, guias, marketplace, pagamentos, experiências e serviços
          oferecidos por terceiros.
          <br />
          <br />
          Nessas hipóteses, o ConnectFish atua como plataforma intermediadora
          tecnológica.
        </Section>

        <Section title="13. Dados técnicos e analytics">
          Poderemos coletar dados técnicos e estatísticos relacionados à
          estabilidade, desempenho, uso e funcionamento da plataforma, incluindo:
          <ul style={styles.list}>
            <li>Logs de erro</li>
            <li>Crashes</li>
            <li>Eventos internos</li>
            <li>Tempo de uso</li>
            <li>Informações técnicas do dispositivo</li>
          </ul>
        </Section>

        <Section title="14. Inteligência artificial e automações">
          O ConnectFish poderá utilizar sistemas automatizados, inteligência
          artificial, reconhecimento de padrões e análises automáticas para gerar
          funcionalidades, recomendações, relatórios e validações.
          <br />
          <br />
          Tais recursos podem apresentar inconsistências, limitações técnicas ou
          interpretações incorretas.
        </Section>

        <Section title="15. Finalidade do tratamento">
          Os dados coletados podem ser utilizados para:
          <ul style={styles.list}>
            <li>Operar e melhorar o aplicativo</li>
            <li>Executar funcionalidades da plataforma</li>
            <li>Registrar atividades</li>
            <li>Exibir replay e mapas</li>
            <li>Validar pescarias</li>
            <li>Permitir interações sociais</li>
            <li>Prevenir fraude</li>
            <li>Garantir segurança</li>
            <li>Cumprir obrigações legais</li>
          </ul>
        </Section>

        <Section title="16. Base legal (LGPD)">
          O tratamento de dados poderá ocorrer com base em:
          <ul style={styles.list}>
            <li>Consentimento do usuário</li>
            <li>Execução de contrato</li>
            <li>Legítimo interesse</li>
            <li>Cumprimento de obrigação legal</li>
            <li>Exercício regular de direitos</li>
            <li>Prevenção à fraude e segurança</li>
          </ul>
        </Section>

        <Section title="17. Compartilhamento de dados">
          O ConnectFish poderá compartilhar dados com serviços necessários para o
          funcionamento da plataforma, incluindo:
          <ul style={styles.list}>
            <li>Firebase</li>
            <li>Google Maps</li>
            <li>Serviços de hospedagem</li>
            <li>Serviços de analytics</li>
            <li>Serviços de monitoramento</li>
            <li>Serviços de pagamento</li>
            <li>Infraestrutura em nuvem</li>
          </ul>
          O ConnectFish não vende dados pessoais a terceiros.
        </Section>

        <Section title="18. Transferência internacional">
          Alguns dados poderão ser processados ou armazenados fora do Brasil por
          provedores internacionais de infraestrutura e tecnologia.
        </Section>

        <Section title="19. Segurança da informação">
          O ConnectFish adota medidas técnicas e organizacionais razoáveis para
          proteger os dados pessoais contra:
          <ul style={styles.list}>
            <li>Acesso não autorizado</li>
            <li>Uso indevido</li>
            <li>Alteração indevida</li>
            <li>Perda ou destruição</li>
            <li>Divulgação não autorizada</li>
          </ul>
          Ainda assim, nenhum sistema é completamente invulnerável.
        </Section>

        <Section title="20. Segurança física e navegação">
          O ConnectFish não substitui:
          <ul style={styles.list}>
            <li>Equipamentos de segurança</li>
            <li>Navegação profissional</li>
            <li>Orientação náutica</li>
            <li>Mapas oficiais</li>
            <li>Equipamentos de emergência</li>
            <li>Conhecimento técnico especializado</li>
          </ul>
          O uso do aplicativo durante pescarias, deslocamentos, embarcações,
          rios, lagos ou represas é de responsabilidade do usuário.
        </Section>

        <Section title="21. Retenção de dados">
          Os dados poderão ser armazenados pelo período necessário para:
          <ul style={styles.list}>
            <li>Execução do serviço</li>
            <li>Segurança da plataforma</li>
            <li>Prevenção de fraude</li>
            <li>Auditoria</li>
            <li>Defesa de direitos</li>
            <li>Cumprimento de obrigações legais</li>
          </ul>
        </Section>

        <Section title="22. Exclusão de conta">
          O usuário poderá solicitar a exclusão da conta.
          <br />
          <br />
          Dependendo da natureza das informações, determinados dados poderão ser:
          <ul style={styles.list}>
            <li>Removidos</li>
            <li>Anonimizados</li>
            <li>Retidos temporariamente</li>
            <li>Preservados para obrigações legais</li>
            <li>Preservados para prevenção de fraude</li>
          </ul>
        </Section>

        <Section title="23. Direitos do usuário">
          O usuário poderá solicitar:
          <ul style={styles.list}>
            <li>Confirmação de tratamento</li>
            <li>Acesso aos dados</li>
            <li>Correção de dados</li>
            <li>Anonimização</li>
            <li>Bloqueio</li>
            <li>Portabilidade</li>
            <li>Revogação de consentimento</li>
            <li>Informações sobre compartilhamento</li>
          </ul>
        </Section>

        <Section title="24. Uso por menores">
          O uso do aplicativo por menores deve ocorrer sob supervisão e
          responsabilidade dos responsáveis legais, conforme legislação aplicável.
        </Section>

        <Section title="25. Alterações desta política">
          Esta Política poderá ser alterada periodicamente para refletir mudanças
          legais, operacionais, técnicas ou de produto.
          <br />
          <br />
          A versão vigente será sempre a publicada nesta página.
        </Section>

        <Section title="26. Contato">
          ConnectFish Serviços e Comércios Ltda
          <br />
          CNPJ: 64.913.989/0001-07
          <br />
          Araçoiaba da Serra – SP
          <br />
          <br />
          Contato:
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
    <section style={{ marginTop: 34 }}>
      <h2 style={styles.sectionTitle}>{title}</h2>
      <div style={styles.text}>{children}</div>
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#050a0f",
    color: "#EAFBFF",
    padding: 32,
  },

  container: {
    maxWidth: 980,
    margin: "0 auto",
  },

  title: {
    fontSize: 40,
    fontWeight: 900,
    lineHeight: 1.1,
    margin: 0,
  },

  meta: {
    marginTop: 14,
    opacity: 0.72,
    fontSize: 15,
  },

  sectionTitle: {
    fontSize: 23,
    fontWeight: 800,
    margin: 0,
    color: "#5EFCA1",
  },

  text: {
    marginTop: 12,
    lineHeight: 1.9,
    fontSize: 16,
    opacity: 0.9,
  },

  list: {
    marginTop: 12,
    paddingLeft: 24,
    lineHeight: 2,
  },
};