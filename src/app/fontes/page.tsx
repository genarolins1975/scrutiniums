import type { Metadata } from "next";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Footer } from "@/components/layout/Footer";
import { PageTitle } from "@/components/ui/SectionHeading";

export const metadata: Metadata = {
  title: "Fontes de dados",
  description:
    "As categorias de fontes que alimentam a Scrutiniums: o que são, com que frequência são atualizadas e como entram na plataforma.",
};

type Fonte = {
  numero: string;
  nome: string;
  oQueE: string;
  atualizacao: string;
  comoEntra: string;
};

const FONTES: Fonte[] = [
  {
    numero: "01",
    nome: "Bases públicas",
    oQueE:
      "Estatísticas oficiais, séries econômicas, atos e decisões publicados por órgãos públicos: IBGE, Banco Central, CVM, CADE, SUSEP e Diário Oficial.",
    atualizacao:
      "Segue o calendário de cada órgão — do Diário Oficial, diário, às pesquisas anuais do IBGE.",
    comoEntra:
      "Coleta automatizada com verificação de integridade. Cada série registra a origem, a data de captura e o período de referência.",
  },
  {
    numero: "02",
    nome: "Registros oficiais",
    oQueE:
      "Cadastros públicos de empresas, juntas comerciais e registros administrativos que identificam quem opera em cada setor.",
    atualizacao: "Mensal ou por evento de registro, conforme a base de origem.",
    comoEntra:
      "Consolidação e padronização de identificadores (como o CNPJ) antes de compor painéis e indicadores.",
  },
  {
    numero: "03",
    nome: "Fontes especializadas",
    oQueE:
      "Publicações setoriais, associações de classe e relatórios técnicos de entidades reconhecidas em seus mercados.",
    atualizacao: "Variável, conforme o ciclo de divulgação de cada entidade.",
    comoEntra:
      "Passam por revisão editorial e entram sempre com citação explícita da origem e da data do documento.",
  },
  {
    numero: "04",
    nome: "Dados econômicos e setoriais",
    oQueE:
      "Séries de atividade, preços, crédito, emprego, comércio e serviços que descrevem a conjuntura de cada setor.",
    atualizacao: "Mensal ou trimestral, acompanhando a divulgação das fontes primárias.",
    comoEntra:
      "Alimentam os índices próprios da plataforma, calculados com metodologia publicada e revisável.",
  },
  {
    numero: "05",
    nome: "Documentos técnicos",
    oQueE:
      "Normativos, demonstrações financeiras, prospectos, atas e estudos publicados por reguladores e companhias.",
    atualizacao: "Por evento: cada documento entra quando é publicado pela fonte.",
    comoEntra:
      "Processados por leitura estruturada, com amostragem de validação humana antes de gerar indicadores.",
  },
  {
    numero: "06",
    nome: "Dados próprios",
    oQueE:
      "Indicadores calculados pela própria Scrutiniums a partir das categorias anteriores, como índices compostos e scores.",
    atualizacao: "Acompanha o ciclo das fontes primárias que compõem cada indicador.",
    comoEntra:
      "Publicados com fórmula, cobertura, margem de erro e limitações declaradas no glossário.",
  },
];

export default function FontesPage() {
  return (
    <div className="flex min-h-screen flex-col bg-marfim">
      <PublicHeader />
      <main className="mx-auto w-full max-w-page flex-1 px-6 py-14">
        <PageTitle
          label="Transparência"
          title="Fontes de dados"
          description="Tudo o que a plataforma publica nasce de fontes identificáveis. Estas são as categorias que alimentam os painéis, com a frequência de atualização e o caminho que cada uma percorre até chegar a você."
        />
        <section aria-label="Categorias de fontes" className="mt-10 grid gap-6 md:grid-cols-2">
          {FONTES.map((fonte) => (
            <article key={fonte.numero} className="border border-linha bg-papel p-8">
              <div className="mb-3 flex items-baseline gap-4">
                <span className="font-serif text-xl text-bronze" aria-hidden="true">
                  {fonte.numero}
                </span>
                <h2 className="font-serif text-2xl text-carvao">{fonte.nome}</h2>
              </div>
              <dl className="mt-5 space-y-4">
                <div>
                  <dt className="rotulo mb-1 text-mineral">O que é</dt>
                  <dd className="text-sm leading-relaxed text-carvao-muted">{fonte.oQueE}</dd>
                </div>
                <div>
                  <dt className="rotulo mb-1 text-mineral">Frequência de atualização</dt>
                  <dd className="text-sm leading-relaxed text-carvao-muted">{fonte.atualizacao}</dd>
                </div>
                <div>
                  <dt className="rotulo mb-1 text-mineral">Como entra na plataforma</dt>
                  <dd className="text-sm leading-relaxed text-carvao-muted">{fonte.comoEntra}</dd>
                </div>
              </dl>
            </article>
          ))}
        </section>
        <p className="mt-10 max-w-prose2 text-sm text-mineral">
          Os critérios de tratamento e combinação dessas fontes estão descritos na página de{" "}
          <a href="/metodologia" className="text-bronze underline underline-offset-4 hover:text-bronze-dark">
            metodologia
          </a>
          . As definições de cada indicador estão no{" "}
          <a href="/glossario" className="text-bronze underline underline-offset-4 hover:text-bronze-dark">
            glossário
          </a>
          .
        </p>
      </main>
      <Footer />
    </div>
  );
}
