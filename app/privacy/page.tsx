"use client";

export default function PrivacyPage() {
  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <h1 style={styles.title}>Política de Privacidade – ConnectFish</h1>

        <p style={styles.meta}>Última atualização: 11 de abril de 2026</p>

        <Section title="1. Introdução">
          Esta Política de Privacidade descreve como o ConnectFish coleta,
          utiliza, armazena, compartilha e protege os dados pessoais dos
          usuários, em conformidade com a Lei Geral de Proteção de Dados
          (Lei nº 13.709/2018 – LGPD). Ao utilizar o aplicativo, o usuário
          declara estar ciente e de acordo com as práticas aqui descritas.
        </Section>

        <Section title="2. Dados coletados">
          Podemos coletar diferentes categorias de dados:
          <ul style={styles.list}>
            <li>Dados cadastrais: nome, email, username, foto</li>
            <li>Dados de uso: interações, tempo de uso, navegação</li>
            <li>Dados técnicos: dispositivo, sistema, logs</li>
            <li>Dados de localização: GPS em tempo real e histórico</li>
            <li>Dados de atividade: trajetos, capturas, mapas e replay</li>
          </ul>
        </Section>

        <Section title="3. Localização e rastreamento contínuo">
          O ConnectFish utiliza dados de localização em tempo real e, quando
          autorizado, em segundo plano. Esses dados podem ser coletados de forma
          contínua durante atividades de pesca para registrar trajetos, gerar
          mapas, produzir replay de atividades, calcular distância e apoiar
          funcionalidades da plataforma. A precisão pode variar conforme GPS,
          ambiente, dispositivo e conectividade.
        </Section>

        <Section title="4. Finalidade do tratamento">
          Os dados são utilizados para:
          <ul style={styles.list}>
            <li>Funcionamento do aplicativo</li>
            <li>Registro de pescarias</li>
            <li>Recursos de mapa e replay</li>
            <li>Interações sociais</li>
            <li>Segurança e prevenção de fraudes</li>
            <li>Melhoria da experiência</li>
          </ul>
        </Section>

        <Section title="5. Base legal (LGPD)">
          O tratamento de dados pode ocorrer com base em:
          <ul style={styles.list}>
            <li>Execução de contrato ou de procedimentos preliminares</li>
            <li>Consentimento do usuário</li>
            <li>Legítimo interesse</li>
            <li>Cumprimento de obrigação legal ou regulatória</li>
          </ul>
        </Section>

        <Section title="6. Compartilhamento de dados">
          Utilizamos serviços de terceiros para operação do app, incluindo
          autenticação, banco de dados, mapas, infraestrutura, monitoramento e
          serviços correlatos. Esses parceiros podem tratar dados conforme
          necessário para viabilizar a plataforma, sempre observadas medidas
          adequadas de proteção.
        </Section>

        <Section title="7. Transferência internacional">
          Alguns dados poderão ser processados ou armazenados fora do Brasil,
          inclusive por provedores de tecnologia, infraestrutura e nuvem. Nesses
          casos, o ConnectFish busca adotar medidas compatíveis com a legislação
          aplicável e com padrões adequados de segurança.
        </Section>

        <Section title="8. Segurança">
          Adotamos medidas técnicas e organizacionais razoáveis para proteger os
          dados pessoais, incluindo controles de acesso, segregação de ambiente,
          proteção contra acesso não autorizado e boas práticas de segurança da
          informação. Ainda assim, nenhum sistema é absolutamente invulnerável.
        </Section>

        <Section title="9. Retenção de dados">
          Os dados são armazenados pelo tempo necessário para:
          <ul style={styles.list}>
            <li>Execução do serviço</li>
            <li>Cumprimento de obrigações legais e regulatórias</li>
            <li>Segurança, auditoria e prevenção de fraude</li>
            <li>Defesa de direitos em processos administrativos ou judiciais</li>
          </ul>
        </Section>

        <Section title="10. Direitos do usuário">
          O usuário poderá solicitar, nos termos da LGPD:
          <ul style={styles.list}>
            <li>Confirmação da existência de tratamento</li>
            <li>Acesso aos dados</li>
            <li>Correção de dados incompletos, inexatos ou desatualizados</li>
            <li>Exclusão, anonimização ou bloqueio quando cabível</li>
            <li>Portabilidade, quando aplicável</li>
            <li>Revogação de consentimento</li>
            <li>Informações sobre compartilhamento</li>
          </ul>
          Solicitações podem ser enviadas para: aplicativo.pesca1@gmail.com
        </Section>

        <Section title="11. Exclusão de conta">
          A exclusão da conta pode resultar na remoção, anonimização ou retenção
          limitada de determinados dados, conforme a natureza da informação,
          obrigações legais, prevenção de fraude, segurança da plataforma e
          defesa de direitos.
        </Section>

        <Section title="12. Uso por menores">
          O uso por menores deve ocorrer com supervisão dos responsáveis legais,
          conforme a legislação aplicável.
        </Section>

        <Section title="13. Alterações desta política">
          Esta Política de Privacidade poderá ser atualizada a qualquer momento
          para refletir alterações legais, regulatórias, operacionais ou de
          produto. A versão vigente será a publicada nesta página.
        </Section>

        <Section title="14. Contato">
          Em caso de dúvidas, solicitações ou exercício de direitos:
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
    <section style={{ marginTop: 28 }}>
      <h2 style={styles.sectionTitle}>{title}</h2>
      <div style={styles.text}>{children}</div>
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#050a0f",
    color: "#e6f6f7",
    padding: 28,
  },
  container: {
    maxWidth: 900,
    margin: "0 auto",
  },
  title: {
    fontSize: 34,
    fontWeight: 900,
    margin: 0,
  },
  meta: {
    marginTop: 10,
    opacity: 0.7,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 800,
    margin: 0,
  },
  text: {
    marginTop: 10,
    lineHeight: 1.7,
    opacity: 0.85,
  },
  list: {
    marginTop: 10,
    paddingLeft: 22,
    lineHeight: 1.8,
  },
};