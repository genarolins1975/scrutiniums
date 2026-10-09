import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoEntrada } from "@/components/eficiencia/CabecalhoEntrada";
import { Siglas } from "@/components/eficiencia/Siglas";
import { goldSaude } from "@/lib/eficiencia/saude/dados";
import { metaEducacao } from "@/lib/eficiencia/dados";
import { dataBr } from "@/lib/eficiencia/formato";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Observatório Brasileiro de Eficiência Estatal",
  description: "Indicadores públicos sobre recursos, atendimento e resultados do Estado brasileiro, por tema, com definição, fonte, período e limitações em cada número. Hoje: Educação e Saúde nas 26 capitais estaduais.",
  alternates: { canonical: "/eficiencia-estatal" },
};

type Tema = { id: string; titulo: string; pergunta: string; escopo: string; naoInclui: string; fontes: string; entradas: { href: string; rotulo: string }[]; atualizacao: string | null };

export default function PaginaEntradaEficiencia() {
  const edu = metaEducacao();
  const g = goldSaude();
  const temas: Tema[] = [
    {
      id: "educacao",
      titulo: "Educação nas capitais",
      pergunta: "Quanto se gasta, quem é atendido e quais resultados são observados na rede municipal de ensino?",
      escopo: "Rede municipal das 26 capitais estaduais: despesa na função Educação (total, por habitante e razão por matrícula de aplicação direta), matrículas, alunos por turma, aprovação, Ideb e Saeb.",
      naoInclui: "Redes estaduais, federais e privadas na capital; custo por aluno; causa do resultado.",
      fontes: "Tesouro Nacional (Siconfi), INEP (Censo Escolar, Ideb e Saeb) e IBGE (população e IPCA).",
      entradas: [
        { href: "/eficiencia-estatal/educacao-municipal-capitais", rotulo: "Panorama" },
        { href: "/eficiencia-estatal/educacao-municipal-capitais/gastos", rotulo: "Gastos" },
        { href: "/eficiencia-estatal/educacao-municipal-capitais/atendimento", rotulo: "Atendimento" },
        { href: "/eficiencia-estatal/educacao-municipal-capitais/resultados", rotulo: "Resultados" },
        { href: "/eficiencia-estatal/educacao-municipal-capitais/comparar", rotulo: "Comparar capitais" },
        { href: "/eficiencia-estatal/educacao-municipal-capitais/metodos", rotulo: "Dados e métodos" },
      ],
      atualizacao: edu?.dados_capturados_ate ? dataBr(edu.dados_capturados_ate) : null,
    },
    {
      id: "saude",
      titulo: "Saúde nas capitais",
      pergunta: "Quanto as capitais aplicam em Saúde, que estrutura e atendimento são registrados e quais resultados são observados entre seus moradores?",
      escopo: "Três perímetros separados nas 26 capitais: recursos executados pelo município (despesa, aplicação em ações e serviços públicos de saúde, fonte de recursos), serviços localizados no território (unidades básicas de saúde, equipes e cobertura da atenção primária) e resultados por residência (internações por condições sensíveis à atenção primária, ICSAP).",
      naoInclui: "Gasto de União e estado no território; rede privada e filantrópica; produção da atenção primária, profissionais e custo por atendimento (avaliados e não publicados, com o motivo); filas e tempo de espera (não pesquisados nesta rodada).",
      fontes: "Tesouro Nacional (Siconfi), Ministério da Saúde (SIOPS, CNES, Relatório APS e RIPSA) e IBGE (população e IPCA).",
      entradas: [
        { href: "/eficiencia-estatal/saude-capitais", rotulo: "Panorama" },
        { href: "/eficiencia-estatal/saude-capitais/gastos", rotulo: "Gastos" },
        { href: "/eficiencia-estatal/saude-capitais/rede-e-atencao-primaria", rotulo: "Rede e atenção primária" },
        { href: "/eficiencia-estatal/saude-capitais/atendimento-e-resultados", rotulo: "Atendimento e resultados" },
        { href: "/eficiencia-estatal/saude-capitais/comparar", rotulo: "Comparar capitais" },
        { href: "/eficiencia-estatal/saude-capitais/metodos", rotulo: "Dados e métodos" },
      ],
      atualizacao: g ? dataBr(g.meta.dados_capturados_ate) : null,
    },
  ];
  return (
    <div>
      <CabecalhoEntrada />
      <main id="conteudo" className="mx-auto max-w-page px-4 pb-20 pt-8 sm:px-6 md:pt-12">
        <section aria-labelledby="titulo-eficiencia">
          <h1 id="titulo-eficiencia" className="font-serif text-[2.4rem] leading-[1.05] tracking-tight text-obee-tinta md:text-[3.2rem]">
            Eficiência Estatal
          </h1>
          <p className="mt-3 max-w-[46rem] font-serif text-[1.25rem] leading-snug text-obee-tinta md:text-[1.5rem]">
            Quanto o Estado aplica, que atendimento oferece e que resultados as fontes oficiais registram, com a mesma definição para cada capital.
          </p>
          <p className="mt-3 max-w-[46rem] text-[0.9375rem] leading-relaxed text-carvao-muted">
            Cada número traz definição, fonte, período, perímetro e limitação. O observatório mostra valores e referências; o leitor tira as conclusões. Não há nota, classificação das capitais, semáforo ou recomendação.
          </p>
        </section>

        <div className="mt-10 grid gap-x-12 gap-y-12 border-t border-linha pt-10 lg:grid-cols-2">
          {temas.map((t) => (
            <section key={t.id} aria-labelledby={`tema-${t.id}`}>
              <p className="rotulo text-mineral">Tema publicado</p>
              <h2 id={`tema-${t.id}`} className="mt-1 font-serif text-[1.75rem] leading-snug text-obee-tinta">{t.titulo}</h2>
              <p className="mt-2 max-w-prose2 text-[1.0625rem] leading-snug text-obee-tinta">{t.pergunta}</p>
              <dl className="mt-4 space-y-3 text-sm leading-snug">
                <div><dt className="rotulo text-carvao-muted">O que mostra</dt><dd className="mt-0.5 max-w-prose2 text-obee-tinta">{t.escopo}</dd></div>
                <div><dt className="rotulo text-carvao-muted">O que não inclui</dt><dd className="mt-0.5 max-w-prose2 text-obee-tinta">{t.naoInclui}</dd></div>
                <div><dt className="rotulo text-carvao-muted">Fontes</dt><dd className="mt-0.5 max-w-prose2 text-obee-tinta"><Siglas texto={t.fontes} /></dd></div>
                <div><dt className="rotulo text-carvao-muted">Última captura de dados</dt><dd className="mt-0.5 text-obee-tinta">{t.atualizacao ?? "não informada"}; os anos de referência estão em cada medida.</dd></div>
              </dl>
              <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1">
                {t.entradas.map((e, i) => (
                  <li key={e.href}>
                    <Link href={e.href} className={`inline-flex min-h-[44px] items-center underline-offset-4 ${i === 0 ? "font-semibold text-obee-tinta underline" : "text-obee-dark hover:underline"}`}>
                      {e.rotulo}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <section aria-labelledby="roteiro" className="mt-14 border-t border-linha pt-10">
          <h2 id="roteiro" className="font-serif text-[1.45rem] leading-snug text-obee-tinta">O que ainda não existe aqui</h2>
          <p className="mt-2 max-w-prose2 text-sm leading-relaxed text-obee-tinta">
            Os temas acima são os únicos com dados publicados. Estrutura administrativa geral, Legislativo e Judiciário, outras áreas de políticas públicas e a comparação entre os três poderes estão no roteiro do observatório e não têm número nesta página. O Distrito Federal fica fora da comparação municipal inicial.
          </p>
        </section>
      </main>
    </div>
  );
}
