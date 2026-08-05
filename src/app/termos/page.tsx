import type { Metadata } from "next";
import Link from "next/link";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Footer } from "@/components/layout/Footer";
import { PageTitle } from "@/components/ui/SectionHeading";
import { LINKEDIN_URL } from "@/lib/contato";

export const metadata: Metadata = {
  title: "Termos de uso",
  description:
    "Condições de uso da plataforma Scrutiniums: acesso gratuito mediante cadastro, caráter estritamente informativo, isenção de garantias e limitação de responsabilidade.",
};

const TERMOS: { numero: string; titulo: string; paragrafos: string[] }[] = [
  {
    numero: "01",
    titulo: "Objeto e acesso",
    paragrafos: [
      "A Scrutiniums é uma plataforma de informação e análise de acesso gratuito, de natureza acadêmica e analítica. A leitura do Observatório e das páginas públicas é aberta, sem cadastro. A área de conta e os painéis personalizados exigem cadastro, com e-mail e telefone confirmados. Não existem planos, assinaturas ou cobranças.",
      "A conta é pessoal e intransferível. Você é responsável por manter seus dados de acesso em sigilo, por todas as atividades realizadas com a sua conta e por atualizar seus dados quando mudarem.",
      "Ao criar a conta ou usar a plataforma, você declara ter lido, compreendido e aceito integralmente estes termos. Se não concordar com qualquer condição, não utilize a plataforma.",
    ],
  },
  {
    numero: "02",
    titulo: "Natureza das informações",
    paragrafos: [
      "A plataforma reúne e processa dados de fontes públicas oficiais (como Banco Central do Brasil, IBGE, CNJ e B3), sempre identificadas, e calcula indicadores próprios com metodologia aberta e declarada. A plataforma não produz os dados primários: reproduz e organiza o que as fontes publicam, herdando as respectivas defasagens, revisões, lacunas e eventuais erros.",
      "Todo o conteúdo tem caráter estritamente informativo e educacional. Nada na plataforma constitui recomendação de investimento, análise de valores mobiliários, rating ou classificação de risco regulatória, consultoria financeira, contábil, jurídica ou de qualquer outra natureza profissional, tampouco oferta de produto ou serviço financeiro.",
      "Escores, índices sintéticos, projeções e cenários são exercícios analíticos condicionais às hipóteses e limitações declaradas em cada página e na metodologia. Projeção não é promessa de resultado e pode divergir substancialmente da realidade observada.",
    ],
  },
  {
    numero: "03",
    titulo: "Responsabilidade do usuário pelas decisões",
    paragrafos: [
      "Qualquer decisão tomada com base na plataforma, incluindo decisões de crédito, investimento, negócio, política institucional ou regulatória, é de responsabilidade exclusiva de quem a toma. Antes de decisões relevantes, você se compromete a verificar a informação diretamente na fonte primária indicada e, quando apropriado, a buscar aconselhamento profissional habilitado.",
      "Você concorda em não utilizar a plataforma como insumo exclusivo de sistemas automatizados de decisão com efeitos sobre terceiros, como concessão de crédito, precificação ou avaliação individual de clientes.",
    ],
  },
  {
    numero: "04",
    titulo: "Uso adequado",
    paragrafos: [
      "Você concorda em usar a plataforma de forma lícita: sem tentar burlar controles de acesso, sem coleta automatizada massiva de conteúdo, sem sobrecarregar deliberadamente a infraestrutura, sem revender o acesso ou os dados como se fossem seus e sem atribuir à Scrutiniums afirmações que a plataforma não faz.",
      "Contas usadas em desacordo com estes termos podem ser suspensas ou encerradas, com aviso prévio sempre que possível.",
    ],
  },
  {
    numero: "05",
    titulo: "Propriedade intelectual",
    paragrafos: [
      "A marca, os textos, os índices próprios e a metodologia da Scrutiniums pertencem à Scrutiniums. Os dados de fontes públicas pertencem às respectivas fontes, sempre identificadas na plataforma.",
      "Você pode citar resultados da plataforma em trabalhos, relatórios e publicações, desde que com atribuição à Scrutiniums e à fonte primária indicada, preservando o contexto, a data de referência e as limitações declaradas junto ao número citado.",
    ],
  },
  {
    numero: "06",
    titulo: "Isenção de garantias",
    paragrafos: [
      "A plataforma é fornecida no estado em que se encontra e conforme a disponibilidade, sem garantias de qualquer natureza, expressas ou implícitas, incluindo garantias de exatidão, completude, atualidade, continuidade, adequação a uma finalidade específica ou ausência de erros.",
      "Trabalhamos com controles de qualidade declarados (selos de origem, períodos de referência, limitações publicadas), mas erros de coleta, de processamento, de cálculo ou de exibição podem ocorrer, assim como revisões retroativas das fontes primárias. Valores podem ser corrigidos, complementados ou removidos a qualquer momento, sem aviso prévio.",
      "A plataforma pode ficar indisponível, ter funcionalidades alteradas ou ser descontinuada, no todo ou em parte, a qualquer tempo, sem que disso decorra qualquer direito a indenização, dada a natureza gratuita do serviço.",
    ],
  },
  {
    numero: "07",
    titulo: "Limitação de responsabilidade",
    paragrafos: [
      "Na máxima extensão permitida pela legislação brasileira, a Scrutiniums e as pessoas físicas responsáveis pela sua operação não respondem por danos diretos, indiretos, incidentais ou consequenciais decorrentes do uso ou da impossibilidade de uso da plataforma, incluindo perdas financeiras, lucros cessantes, perda de oportunidade, decisões de crédito ou de investimento, dano reputacional ou perda de dados, ainda que originados de erro, imprecisão, defasagem ou indisponibilidade da informação.",
      "Essa limitação reflete o equilíbrio econômico destes termos: o serviço é gratuito, de natureza informativa, e as fontes primárias permanecem disponíveis para verificação direta. Nada nestes termos exclui responsabilidades que a lei não permita excluir, como as decorrentes de dolo.",
    ],
  },
  {
    numero: "08",
    titulo: "Indenização",
    paragrafos: [
      "Você concorda em manter a Scrutiniums e as pessoas responsáveis pela sua operação indenes de reclamações, perdas e despesas, incluindo honorários advocatícios razoáveis, decorrentes de uso da plataforma em violação a estes termos ou à legislação, incluindo uso indevido de dados, citação distorcida de resultados ou acesso não autorizado feito com as suas credenciais.",
    ],
  },
  {
    numero: "09",
    titulo: "Alterações",
    paragrafos: [
      "Estes termos podem ser alterados para refletir mudanças na plataforma ou na legislação. Alterações relevantes serão comunicadas por e-mail ou aviso na plataforma, e a versão vigente estará sempre publicada nesta página. O uso continuado após a publicação vale como aceite da versão vigente.",
    ],
  },
  {
    numero: "10",
    titulo: "Contato, legislação e foro",
    paragrafos: [
      "Dúvidas, correções e notificações sobre estes termos podem ser enviadas pela aba Sugestões da plataforma ou pelo contato profissional do responsável, indicado no rodapé do site.",
      "Estes termos são regidos pela legislação brasileira. Fica eleito o foro da comarca de São Paulo, SP, para resolver controvérsias, sem prejuízo das proteções legais do seu domicílio quando aplicáveis.",
    ],
  },
];

export default function TermosPage() {
  return (
    <div className="flex min-h-screen flex-col bg-marfim">
      <PublicHeader />
      <main className="mx-auto w-full max-w-page flex-1 px-6 py-14">
        <PageTitle
          label="Institucional"
          title="Termos de uso"
          description="Condições objetivas para o uso da plataforma: acesso gratuito, caráter estritamente informativo, isenção de garantias e limitação de responsabilidade. Versão vigente desde agosto de 2026."
        />
        <div className="mt-10 max-w-prose2 space-y-10">
          {TERMOS.map((secao) => (
            <section key={secao.numero} aria-labelledby={`termos-${secao.numero}`}>
              <div className="mb-3 flex items-baseline gap-4">
                <span className="font-serif text-xl text-bronze" aria-hidden="true">
                  {secao.numero}
                </span>
                <h2 id={`termos-${secao.numero}`} className="font-serif text-2xl text-carvao">
                  {secao.titulo}
                </h2>
              </div>
              <div className="space-y-3 text-carvao-muted">
                {secao.paragrafos.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </section>
          ))}
          <p className="border-t border-linha pt-6 text-sm text-mineral">
            O tratamento dos seus dados pessoais está descrito na{" "}
            <Link
              href="/privacidade"
              className="text-bronze underline underline-offset-4 hover:text-bronze-dark"
            >
              política de privacidade
            </Link>
            . Contato profissional do responsável:{" "}
            <a
              href={LINKEDIN_URL}
              rel="noopener noreferrer"
              target="_blank"
              className="text-bronze underline underline-offset-4 hover:text-bronze-dark"
            >
              LinkedIn
            </a>
            .
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
