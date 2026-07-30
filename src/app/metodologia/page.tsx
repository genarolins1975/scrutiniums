import type { Metadata } from "next";
import Link from "next/link";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Footer } from "@/components/layout/Footer";
import { PageTitle, SectionHeading } from "@/components/ui/SectionHeading";

export const metadata: Metadata = {
  title: "Metodologia",
  description:
    "Como a Scrutiniums coleta, trata e publica dados: critérios declarados, validação de modelos e transparência sobre limitações.",
};

export default function MetodologiaPage() {
  return (
    <div className="flex min-h-screen flex-col bg-marfim">
      <PublicHeader />
      <main className="mx-auto w-full max-w-page flex-1 px-6 py-14">
        <PageTitle
          label="Método"
          title="Metodologia"
          description="O valor da plataforma não está em ter dados, mas em tratá-los com critérios declarados. Esta página descreve as quatro etapas entre a fonte original e o que você vê nos painéis."
        />

        <div className="mt-14 space-y-16">
          <section aria-labelledby="metodo-coleta" className="max-w-prose2">
            <SectionHeading number="01" label="Coleta" title="Coleta e organização" />
            <div id="metodo-coleta" className="space-y-4 text-carvao-muted">
              <p>
                Cada fonte é coletada por rotinas automatizadas com verificação de integridade:
                conferimos completude, formato e consistência com as divulgações anteriores antes
                de aceitar qualquer atualização. Falhas de coleta são registradas e a série fica
                marcada como desatualizada em vez de exibir dados parciais.
              </p>
              <p>
                Na organização, identificadores são padronizados — empresas por CNPJ, setores por
                classificação econômica, períodos pelo calendário de referência da fonte — para que
                bases diferentes possam ser combinadas sem ambiguidade. Toda observação guarda a
                origem e a data de captura.
              </p>
            </div>
          </section>

          <section aria-labelledby="metodo-tratamento" className="max-w-prose2">
            <SectionHeading number="02" label="Tratamento" title="Tratamento estatístico" />
            <div id="metodo-tratamento" className="space-y-4 text-carvao-muted">
              <p>
                Séries passam por deflacionamento, ajuste sazonal e detecção de valores atípicos
                quando a natureza do dado exige. Cada transformação aplicada é documentada na
                definição do indicador: o mesmo conceito tem sempre o mesmo tratamento em toda a
                plataforma.
              </p>
              <p>
                Quando as fontes primárias revisam dados passados, as nossas séries são revisadas
                junto — e o período sujeito a revisão é declarado nas limitações de cada indicador.
                Não suavizamos nem escondemos revisões.
              </p>
            </div>
          </section>

          <section aria-labelledby="metodo-modelos" className="max-w-prose2">
            <SectionHeading
              number="03"
              label="Modelos"
              title="Modelos analíticos e machine learning"
            />
            <div id="metodo-modelos" className="space-y-4 text-carvao-muted">
              <p>
                Alguns indicadores usam modelos estatísticos e de machine learning — por exemplo,
                para classificar o teor de normativos ou combinar séries em um índice composto.
                Esses modelos complementam a análise; não a substituem e não são apresentados como
                mágica.
              </p>
              <p>
                Antes de entrar em produção, todo modelo passa por validação com amostras revisadas
                por analistas humanos. Publicamos a margem de erro estimada e as limitações
                conhecidas de cada modelo junto ao indicador que ele alimenta. Quando um modelo não
                atinge o desempenho mínimo, o indicador não é publicado.
              </p>
            </div>
          </section>

          <section aria-labelledby="metodo-publicacao" className="max-w-prose2">
            <SectionHeading
              number="04"
              label="Publicação"
              title="Publicação com transparência"
            />
            <div id="metodo-publicacao" className="space-y-4 text-carvao-muted">
              <p>
                Todo resultado publicado na plataforma vem acompanhado de quatro elementos: as
                fontes utilizadas, os critérios de cálculo, o período de referência e as
                limitações conhecidas. Se algum desses elementos não puder ser declarado, o
                resultado não é publicado.
              </p>
              <p>
                As definições completas — fórmula, cobertura, frequência e data da última revisão
                metodológica de cada indicador — estão reunidas no{" "}
                <Link
                  href="/glossario"
                  className="text-bronze underline underline-offset-4 hover:text-bronze-dark"
                >
                  glossário
                </Link>
                , que é a fonte única de nomes e definições da plataforma.
              </p>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
