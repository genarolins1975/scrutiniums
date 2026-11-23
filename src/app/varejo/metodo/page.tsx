import type { Metadata } from "next";
import Link from "next/link";
import { SeloComConta } from "@/components/acesso/SeloComConta";
import { FaixaFrescor } from "@/components/frescor/FaixaFrescor";
import { RotuloContexto } from "@/components/layout/RotuloContexto";
import { TabelaDados } from "@/components/painel";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { CabecalhoVarejo, LINK } from "@/components/varejo/comum";
import { FRESCOR_DAS_COLECOES } from "@/lib/frescor/entradas";
import { tituloNaColecao } from "@/lib/observatorios/contexto";
import { curadoria, goldEmpresas, goldSetor, mesesSelecionaveis } from "@/lib/varejo/dados";
import { dataBr, mesCurto, num } from "@/lib/varejo/formato";
import { NOME_CURTO_ATIVIDADE, paginaVarejo, paineisPublicados, ROTA_METODO } from "@/lib/varejo/paginas";
import type { GoldSetor } from "@/lib/varejo/tipos";

/**
 * Método da coleção Varejo, aberto (rota pública em src/lib/rotasPublicas.ts): as fontes com o link da tabela efetivamente
 * usada, período, unidade, geografia e data da consulta, lidos das golds; as fórmulas das contas que a coleção faz; a
 * correspondência entre as atividades do IBGE e os segmentos empresariais; e as lacunas que afetam a leitura. Não traz série
 * nem recorte: os painéis e os arquivos seguem com conta e aparecem com o selo.
 */
export const dynamic = "force-static";

const pagina = paginaVarejo("metodo");

export const metadata: Metadata = {
  title: tituloNaColecao("Método, fontes e lacunas", ROTA_METODO),
  description:
    "Como a coleção Varejo mede as vendas do comércio: Pesquisa Mensal e Pesquisa Anual de Comércio do IBGE, PNAD Contínua, IPCA, Banco Central e demonstrações da CVM, com tabelas, períodos, fórmulas, correspondência com os segmentos empresariais e lacunas.",
  alternates: { canonical: ROTA_METODO },
  robots: { index: true },
};

/** O que cada fonte da gold setorial alimenta, na unidade e na geografia em que a coleção a usa. */
const USO: Record<keyof GoldSetor["fontes"], { uso: string; unidade: string; geografia: string; periodo: (g: GoldSetor) => string }> = {
  pmc_restrito: { uso: "Volume e receita nominal do varejo restrito", unidade: "Índice (2022 = 100) e variações em %", geografia: "Brasil e 27 unidades da federação", periodo: (g) => `${mesCurto(g.pmc.meses[0])} a ${mesCurto(g.referencia.pmc)}` },
  pmc_ampliado: { uso: "Volume e receita nominal do varejo ampliado", unidade: "Índice (2022 = 100) e variações em %", geografia: "Brasil e 27 unidades da federação", periodo: (g) => `${mesCurto(g.pmc.meses[0])} a ${mesCurto(g.referencia.pmc)}` },
  pmc_atividades: { uso: "Volume e receita nominal por atividade", unidade: "Índice (2022 = 100) e variações em %", geografia: "Brasil (série); unidades da federação só no mês mais recente", periodo: (g) => `${mesCurto(g.pmc.meses[0])} a ${mesCurto(g.referencia.pmc)}` },
  pac_geral: { uso: "Receita, empresas, pessoal ocupado e margem por tipo de comércio", unidade: "Mil reais correntes, empresas e pessoas", geografia: "Brasil", periodo: (g) => String(g.pac.ano) },
  pac_porte: { uso: "Empresas com 20 ou mais pessoas ocupadas e o pessoal nelas", unidade: "Empresas e pessoas", geografia: "Brasil", periodo: (g) => String(g.pac.ano) },
  pac_formas: { uso: "Receita bruta de revenda por forma de comercialização (inclui a internet)", unidade: "Mil reais correntes", geografia: "Brasil, empresas com 20 ou mais pessoas ocupadas", periodo: (g) => String(g.pac.ano) },
  pac_uf: { uso: "Comércio varejista por estado", unidade: "Mil reais correntes, empresas e pessoas", geografia: "27 unidades da federação", periodo: (g) => String(g.pac.ano) },
  pnadc_massa: { uso: "Massa de rendimento real habitual de todos os trabalhos", unidade: "Milhões de reais, a preços do último trimestre divulgado", geografia: "Brasil", periodo: (g) => `trimestres móveis de ${mesCurto(g.pmc.meses[0])} a ${mesCurto(g.referencia.pmc)}` },
  ipca: { uso: "Inflação da alimentação no domicílio e do índice geral", unidade: "% acumulado em 12 meses", geografia: "Brasil", periodo: (g) => `até ${mesCurto(g.referencia.pmc)}` },
  bcb_juros: { uso: "Juros médios do crédito com recursos livres a pessoas físicas", unidade: "% ao ano", geografia: "Brasil", periodo: (g) => `${mesCurto(g.pmc.meses[0])} a ${mesCurto(g.referencia.pmc)}` },
};

const EQUIVALENCIA = { direta: "direta", parcial: "parcial", sem_equivalencia: "sem equivalência" } as const;

const H2 = "font-serif text-[clamp(1.5rem,2.8vw,2rem)] leading-tight text-carvao";
const SECAO = "scroll-mt-24 border-t border-linha";
const CORPO = "mx-auto max-w-page px-6 py-10 md:py-12";

function Externo({ href, children }: Readonly<{ href: string; children: React.ReactNode }>) {
  return (
    <a href={href} rel="noopener noreferrer" target="_blank" className={LINK}>
      {children}
    </a>
  );
}

export default function MetodoVarejo() {
  const g = goldSetor();
  const e = goldEmpresas();
  const c = curadoria();
  const meses = mesesSelecionaveis(g);
  const ano = String(g.pac.ano);
  const segmentos = c.segmentos?.segmentos ?? [];
  const indice = [
    { id: "fontes", rotulo: "Fontes" },
    { id: "formulas", rotulo: "Fórmulas" },
    { id: "correspondencia", rotulo: "IBGE e segmentos" },
    { id: "lacunas", rotulo: "Lacunas" },
    { id: "atualizacao", rotulo: "Atualização" },
  ];
  const chaves = Object.keys(g.fontes) as (keyof GoldSetor["fontes"])[];
  const primeiroAlim = Object.entries(g.macro.ipca_alimentacao_domicilio_12m.valores).find(([, x]) => typeof x === "number")?.[0] ?? null;
  return (
    <>
      <MarcaVisita secao={pagina.secao} />
      <CabecalhoVarejo rota={ROTA_METODO} />
      <main id="conteudo" className="bg-papel" data-metodo="varejo">
        <section aria-labelledby="metodo-titulo" className="border-b border-linha bg-marfim">
          <div className="mx-auto max-w-page px-6 pb-8 pt-8 md:pt-12">
            <RotuloContexto rota={ROTA_METODO} className="flex flex-wrap items-center gap-x-3 text-mineral" marca={<span aria-hidden="true" className="h-[3px] w-8 shrink-0 bg-gas" />} />
            <h1 id="metodo-titulo" className="mt-5 max-w-4xl font-serif text-[clamp(1.9rem,4vw,2.8rem)] leading-[1.12] text-carvao [text-wrap:balance]">
              Como a coleção Varejo mede cada número
            </h1>
            <p className="mt-5 max-w-prose2 text-base leading-relaxed text-carvao-muted">
              De onde vem cada dado, em que tabela, de que período e em que unidade; as contas que a coleção faz por conta própria; como as atividades do IBGE se ligam aos segmentos das empresas; e o que falta, para a leitura não
              ir além do que a fonte permite.
            </p>
            <nav aria-label="Nesta página" className="mt-6">
              <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                {indice.map((i) => (
                  <li key={i.id}>
                    <a href={`#${i.id}`} className={`inline-flex min-h-[44px] items-center text-carvao ${LINK}`}>
                      {i.rotulo}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </section>

        <section id="fontes" aria-labelledby="fontes-titulo" className="scroll-mt-24">
          <div className={CORPO}>
            <h2 id="fontes-titulo" className={H2}>
              Fontes, tabela por tabela
            </h2>
            <p className="mt-3 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
              Todas as fontes são oficiais. O link leva à tabela efetivamente consultada, não à página geral da pesquisa. A data é a da consulta; as fontes podem revisar valores já publicados, e a coleção mostra o que estava
              publicado naquele dia.
            </p>
            <div className="mt-5">
              <TabelaDados
                recolhida={false}
                idioma="pt"
                titulo="Fontes da coleção Varejo"
                colunas={["O que alimenta", "Órgão e pesquisa", "Tabela consultada", "Período usado", "Unidade", "Geografia", "Consultado em"]}
                linhas={[
                  ...chaves.map((k) => {
                    const f = g.fontes[k];
                    const u = USO[k];
                    return [u.uso, `${f.orgao}, ${f.nome}`, <Externo key={k} href={f.url}>{f.tabela}</Externo>, u.periodo(g), u.unidade, u.geografia, dataBr(f.capturado_em)];
                  }),
                  ...(["dfp", "itr"] as const).map((k) => {
                    const f = e.fontes[k];
                    return [
                      k === "dfp" ? "Demonstrações anuais das companhias abertas (modelo dos R$ 100)" : "Demonstrações trimestrais das companhias abertas",
                      `${f.orgao}, ${f.nome}`,
                      <Externo key={k} href={f.url}>Portal de dados abertos da CVM</Externo>,
                      `exercícios de ${f.exercicios[0]} a ${f.exercicios[f.exercicios.length - 1]}`,
                      "Reais correntes; demonstrações consolidadas, ou individuais quando a companhia não tem controladas",
                      `${num(Object.keys(e.empresas).length)} companhias com registro na CVM`,
                      dataBr(f.capturado_em),
                    ];
                  }),
                ]}
                limite={20}
                fixarPrimeiraColuna
              />
            </div>
            <p className="mt-4 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
              {g.notas.pmc_base} {g.notas.pac}
            </p>
          </div>
        </section>

        <section id="formulas" aria-labelledby="formulas-titulo" className={SECAO}>
          <div className={CORPO}>
            <h2 id="formulas-titulo" className={H2}>
              Fórmulas: o que é da fonte e o que é conta nossa
            </h2>
            <dl className="mt-6 grid gap-x-12 gap-y-6 md:grid-cols-2">
              {[
                ["Variação no mês, com ajuste sazonal", "Publicada pelo IBGE: índice com ajuste sazonal do mês ÷ índice com ajuste sazonal do mês anterior − 1, em %. A coleção não recalcula."],
                ["Variação contra o mesmo mês do ano anterior", "Publicada pelo IBGE: índice do mês ÷ índice do mesmo mês do ano anterior − 1, em %, sem ajuste sazonal."],
                ["Variação acumulada em 12 meses", "Publicada pelo IBGE: soma dos índices dos últimos 12 meses ÷ soma dos 12 meses anteriores − 1, em %."],
                ["Receita menos volume (pontos percentuais)", "Conta da Scrutiniums: variação da receita nominal − variação do volume, na mesma medida e no mesmo mês. É uma aproximação do efeito dos preços, não um índice de preços."],
                ["Contagem de atividades em alta e em queda", "Conta da Scrutiniums: número de atividades do universo escolhido com variação positiva, negativa ou nula, sobre o valor arredondado a uma casa. Não é contribuição ao resultado."],
                ["Partes em % na pesquisa anual", "Conta da Scrutiniums: valor do grupo ÷ valor do comércio varejista × 100; na internet, valor da forma ÷ soma das formas de comercialização × 100."],
                ["Porte", "Conta da Scrutiniums: empresas (ou pessoas) nas empresas com 20 ou mais pessoas ocupadas ÷ total do comércio varejista × 100."],
                ["R$ 100 de venda", `Conta da gold das companhias: ${e.formulas.ponte_100}.`],
              ].map(([t, d]) => (
                <div key={t} className="min-w-0 border-t border-linha pt-3">
                  <dt className="text-sm font-medium text-carvao">{t}</dt>
                  <dd className="mt-1 text-sm leading-relaxed text-carvao-muted">{d}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section id="correspondencia" aria-labelledby="correspondencia-titulo" className={SECAO}>
          <div className={CORPO}>
            <h2 id="correspondencia-titulo" className={H2}>
              Atividades do IBGE e segmentos das empresas
            </h2>
            <p className="mt-3 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
              A pesquisa mensal classifica cada empresa numa atividade, pelo que ela mais vende. O mercado agrupa as redes em segmentos (alimentar, farmácia, moda), que quase nunca coincidem exatamente com as atividades. As duas
              tabelas abaixo dizem o que entra em cada universo da pesquisa e como cada segmento se liga a ela.
            </p>
            <div className="mt-5">
              <TabelaDados
                recolhida={false}
                idioma="pt"
                titulo="Atividades da Pesquisa Mensal de Comércio usadas na coleção"
                colunas={["Atividade, como o IBGE a nomeia", "Nome curto na coleção", "Onde entra"]}
                linhas={Object.entries(g.pmc.atividades).map(([slug, a]) => [
                  a.nome,
                  NOME_CURTO_ATIVIDADE[slug] ?? a.nome,
                  a.universo === "restrito" ? "varejo restrito e ampliado" : a.universo === "ampliado" ? "só varejo ampliado" : `detalhe de ${(NOME_CURTO_ATIVIDADE[a.parte_de ?? ""] ?? a.parte_de ?? "").toLowerCase()}; não soma de novo`,
                ])}
                limite={30}
              />
            </div>
            <div className="mt-8" data-correspondencia-segmentos="">
              {segmentos.length > 0 ? (
                <TabelaDados
                  recolhida={false}
                  idioma="pt"
                  titulo="Segmentos empresariais e a correspondência com o IBGE"
                  colunas={["Segmento empresarial", "Atividades da pesquisa mensal", "Classes da pesquisa anual", "Equivalência", "Ressalva da correspondência"]}
                  linhas={segmentos.map((s) => [
                    s.nome,
                    (s.atividades_pmc ?? []).length ? (s.atividades_pmc ?? []).map((a) => NOME_CURTO_ATIVIDADE[a] ?? a).join("; ") : "nenhuma",
                    (s.classes_pac ?? []).length ? (s.classes_pac ?? []).join("; ") : "nenhuma",
                    EQUIVALENCIA[s.equivalencia] ?? "não informada",
                    s.nota_equivalencia ?? null,
                  ])}
                  ausencia={{ "Ressalva da correspondência": "sem ressalva registrada" }}
                  limite={30}
                />
              ) : (
                <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted" data-em-apuracao="">
                  A tabela de correspondência entre os segmentos empresariais e as atividades do IBGE está em apuração e ainda não foi publicada.
                </p>
              )}
            </div>
          </div>
        </section>

        <section id="lacunas" aria-labelledby="lacunas-titulo" className={SECAO}>
          <div className={CORPO}>
            <h2 id="lacunas-titulo" className={H2}>
              Lacunas que afetam a leitura
            </h2>
            <ul className="mt-5 max-w-prose2 list-disc space-y-3 pl-5 text-sm leading-relaxed text-carvao">
              <li>
                <span className="font-medium">Pesos das atividades.</span> {g.notas.pmc_pesos} Por isso a coleção conta quantas atividades subiram e caíram, mas não diz quanto cada uma puxou o resultado.
              </li>
              <li>
                <span className="font-medium">Tamanho do mercado com defasagem.</span> Os valores em reais são da pesquisa anual de {ano}, a mais recente publicada, e estão em reais daquele ano. A conjuntura vai até {mesCurto(g.referencia.pmc)}. Os
                dois não se somam nem se atualizam um pelo outro.
              </li>
              <li>
                <span className="font-medium">Série anual nova.</span> A pesquisa anual de {ano} inaugura uma série: não se compara diretamente com a que terminou em 2023, e por isso a coleção não mostra evolução anual do mercado em reais.
              </li>
              <li>
                <span className="font-medium">Cobertura do varejo ampliado.</span> O atacado de alimentos, bebidas e fumo entrou no ampliado em janeiro de 2023. Antes disso, o ampliado tinha outra composição.
              </li>
              <li>
                <span className="font-medium">Atividades por estado.</span> Por estado, a série inteira existe só para o total do varejo restrito e do ampliado. As atividades por estado têm apenas as variações do mês mais recente ({mesCurto(g.pmc.ufs_atividades.mes)}), e
                nem todas são divulgadas em todos os estados.
              </li>
              <li>
                <span className="font-medium">Porte.</span> O único recorte de porte divulgado para o varejo é o de empresas com 20 ou mais pessoas ocupadas contra o total. Não há faixas menores nem recorte por faturamento.
              </li>
              <li>
                <span className="font-medium">Comércio eletrônico.</span> A parte da internet vale para as empresas com 20 ou mais pessoas ocupadas e para a revenda de mercadorias da própria empresa. Pequenos lojistas e a venda de terceiros intermediada
                por plataformas ficam fora.
              </li>
              <li>
                <span className="font-medium">Inflação de alimentos.</span> Nesta base, a variação em 12 meses da alimentação no domicílio {primeiroAlim ? `só tem valor a partir de ${mesCurto(primeiroAlim)}` : "não tem valor"}; os meses anteriores aparecem como lacuna, não como zero.
              </li>
              <li>
                <span className="font-medium">Companhias.</span> O modelo dos R$ 100 usa só companhias com registro na CVM ({num(Object.keys(e.empresas).length)} na base). Varejistas de capital fechado não publicam demonstrações ali, e uma companhia
                não representa o seu segmento.
              </li>
              <li>
                <span className="font-medium">Curadoria.</span>{" "}
                {segmentos.length > 0
                  ? `A descrição dos ${num(segmentos.length)} segmentos empresariais é texto escrito a partir de documentos públicos citados em cada um; não é dado de pesquisa.`
                  : "A descrição dos segmentos empresariais está em apuração; os painéis mostram as séries do IBGE sem ela."}
              </li>
              <li>
                <span className="font-medium">Revisões.</span> O IBGE revisa os meses recentes a cada divulgação, e as companhias reapresentam demonstrações. A coleção guarda o valor publicado na data da consulta.
              </li>
            </ul>
          </div>
        </section>

        <section id="atualizacao" aria-labelledby="atualizacao-titulo" className={SECAO}>
          <div className={CORPO}>
            <h2 id="atualizacao-titulo" className={H2}>
              Atualização e onde ver os dados
            </h2>
            <p className="mt-3 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
              A série mensal usada nos painéis vai de {mesCurto(meses[0])} a {mesCurto(meses[meses.length - 1])}. Dados setoriais consultados em {dataBr(g.capturado_em)}; demonstrações das companhias, em {dataBr(e.capturado_em)}.
            </p>
            <ul className="mt-4 flex flex-wrap gap-x-8 gap-y-1 text-sm">
              {paineisPublicados().map((p) => (
                <li key={p.href}>
                  <Link href={p.href} prefetch={false} className={`inline-flex min-h-[44px] items-center text-carvao ${LINK}`}>
                    {p.pergunta}
                    <SeloComConta href={p.href} />
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <FaixaFrescor dominios={FRESCOR_DAS_COLECOES["/varejo"]} variante="metodo" />
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
