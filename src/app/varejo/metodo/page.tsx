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
import { FonteDocumento } from "@/components/varejo/grupos-comum";
import { MEDIDAS_COMPARADAS, TOLERANCIA_PONTE } from "@/lib/varejo/comparador";
import { dataBr, diaBr, mesCurto, mesDaData, num, plural, reaisDeMilhoes, textoCurado } from "@/lib/varejo/formato";
import { amostraDoRanking, exercicioDoRanking, linhasDoRanking, reapresentacoes, urlSegura } from "@/lib/varejo/grupos";
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

/** Nome de cada fórmula da gold das companhias (as chaves são as do arquivo; fórmula nova entra na página com a chave por extenso). */
const NOME_FORMULA: Record<string, string> = {
  margem_bruta_pct: "Margem bruta",
  margem_operacional_pct: "Margem operacional",
  margem_liquida_pct: "Margem líquida",
  divida_liquida_sem_arrendamento: "Dívida líquida sem arrendamento",
  ponte_100: "R$ 100 de receita líquida até o lucro",
  caixa_operacional_apos_convenio: "Caixa operacional depois do convênio de fornecedores",
  capex: "Investimentos",
  "var_estoques, var_fornecedores, var_recebiveis": "Variações de estoques, fornecedores e contas a receber",
};

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
  // grupos e companhias: tudo lido da curadoria (ranking e fichas) e da gold da CVM; sem a curadoria, a seção diz "em apuração"
  const ranking = c.ranking;
  const linhasRanking = linhasDoRanking(c);
  const amostra = amostraDoRanking(c);
  const anoRanking = exercicioDoRanking(c);
  const estimados = linhasRanking.filter((l) => l.natureza_dado === "estimado_pela_fonte");
  const fechados = linhasRanking.filter((l) => l.capital === "fechado" && !(l.empresa_gold && e.empresas[l.empresa_gold]));
  const foraDoRanking = Object.values(c.fichas).filter((f) => !linhasRanking.some((l) => l.slug === f.slug));
  const anosCvm = e.fontes.dfp.exercicios;
  const ultimoAnoCvm = anosCvm[anosCvm.length - 1];
  const individuais = Object.values(e.empresas).filter((x) => x.anuais.some((a) => a.base === "individual"));
  const comReapresentacao = Object.values(e.empresas).filter((x) => reapresentacoes(x).length > 0);
  // companhias com ficha cuja última demonstração anual é anterior ao último exercício da base, com o evento de fechamento de capital da ficha
  const semUltimoAno = Object.values(c.fichas)
    .map((f) => ({ f, emp: f.empresa_gold ? e.empresas[f.empresa_gold] : undefined }))
    .filter((x) => x.emp && !x.emp.anuais.some((a) => a.exercicio === ultimoAnoCvm))
    .map((x) => ({ ...x, emp: x.emp!, evento: (x.f.eventos ?? []).filter((ev) => ev.tipo === "fechamento_de_capital").sort((a, b) => (b.data ?? "").localeCompare(a.data ?? ""))[0] ?? null }));
  // companhias com ficha cujo último trimestre na base é anterior ao das demais, com o evento de recuperação judicial que cita o auditor
  const ultimaData = Object.values(e.empresas).map((x) => x.ultimo_trimestre?.data_base ?? "").sort().at(-1) ?? "";
  const trimestreAtrasado = Object.values(c.fichas)
    .map((f) => ({ f, emp: f.empresa_gold ? e.empresas[f.empresa_gold] : undefined }))
    .filter((x) => x.emp?.ultimo_trimestre?.data_base && x.emp.ultimo_trimestre.data_base < ultimaData && x.emp.anuais.some((a) => a.exercicio === ultimoAnoCvm))
    .map((x) => ({ ...x, emp: x.emp!, evento: (x.f.eventos ?? []).find((ev) => /auditor/i.test(ev.descricao ?? "")) ?? null }));
  const conferencias = ranking?.conferencias ?? [];
  const indice = [
    { id: "fontes", rotulo: "Fontes" },
    { id: "grupos", rotulo: "Grupos e companhias" },
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

        <section id="grupos" aria-labelledby="grupos-titulo" className={SECAO}>
          <div className={CORPO}>
            <h2 id="grupos-titulo" className={H2}>
              Grupos e companhias: ranking, fichas e demonstrações
            </h2>
            {ranking ? (
              <div className="mt-5 grid gap-x-12 gap-y-8 lg:grid-cols-2" data-metodo-grupos="">
                <div className="min-w-0 space-y-3 text-sm leading-relaxed text-carvao-muted">
                  <h3 className="text-base font-medium text-carvao">O ranking dos maiores grupos</h3>
                  <p>
                    <FonteDocumento f={{ titulo: `${ranking.fonte.nome ?? "IRTT"}, edição ${ranking.fonte.edicao ?? ""}`, url: ranking.fonte.url, pagina: ranking.fonte.paginas ? `páginas ${ranking.fonte.paginas}` : undefined, periodo: `vendas de ${anoRanking}`, consultado_em: ranking.fonte.consultado_em }} />
                  </p>
                  <p>
                    <span className="font-medium text-carvao">O que a fonte chama de venda.</span> {textoCurado(ranking.fonte.conceito_venda)}
                  </p>
                  {ranking.fonte.metodologia && <p>{textoCurado(ranking.fonte.metodologia)}</p>}
                  {ranking.fonte.hierarquia_fontes && (
                    <div>
                      <p>De onde a fonte tira cada valor, na ordem de preferência que ela declara:</p>
                      <ol className="mt-1 list-decimal space-y-0.5 pl-5">
                        {Object.entries(ranking.fonte.hierarquia_fontes).map(([k, v]) => (
                          <li key={k}>{textoCurado(v)}</li>
                        ))}
                      </ol>
                    </div>
                  )}
                  <p>
                    <span className="font-medium text-carvao">Marcação de estimativa.</span> A coleção mostra os {num(amostra.n)} primeiros grupos na ordem publicada. {num(amostra.divulgados)} vendas são divulgadas e {num(amostra.estimados)}{" "}
                    {plural(amostra.estimados, "é estimativa", "são estimativas")} da fonte ({reaisDeMilhoes(amostra.estimado_milhoes)} de {reaisDeMilhoes(amostra.total_milhoes)}), marcadas por extenso em cada linha e em toda soma. A participação
                    mostrada é sobre a soma desses grupos, nunca sobre o mercado.
                  </p>
                </div>
                <div className="min-w-0 space-y-3 text-sm leading-relaxed text-carvao-muted">
                  <h3 className="text-base font-medium text-carvao">Conferências com outras listas</h3>
                  {conferencias.map((x) => (
                    <div key={x.fonte} data-metodo-conferencia={x.fonte}>
                      <p>
                        <span className="font-medium text-carvao">
                          {urlSegura(x.url) ? <Externo href={urlSegura(x.url)!}>{x.fonte}</Externo> : x.fonte}
                          {x.edicao ? `, ${textoCurado(x.edicao)}` : ""}.
                        </span>{" "}
                        {textoCurado(x.o_que_confere)}
                        {(x.divergencias ?? []).length > 0 ? ` ${num((x.divergencias ?? []).length)} ${plural((x.divergencias ?? []).length, "divergência registrada", "divergências registradas")}, descritas no painel dos grupos.` : ""}
                        {x.consultado_em ? ` Consultado em ${diaBr(x.consultado_em)}.` : ""}
                      </p>
                    </div>
                  ))}
                  <h3 className="pt-2 text-base font-medium text-carvao">As fichas dos grupos</h3>
                  <p>
                    {num(Object.keys(c.fichas).length)} fichas escritas à mão a partir de documentos públicos (demonstrações e releases entregues à CVM ou ao regulador do país de listagem, o ranking e associações do setor). Cada número traz a
                    natureza (divulgado, estimado pela fonte ou calculado), o documento, a página e a data da consulta. O que não foi encontrado em documento público aparece como não divulgado; nada é estimado pela coleção.
                  </p>
                  <h3 className="pt-2 text-base font-medium text-carvao">As demonstrações das companhias abertas</h3>
                  <p>
                    Dados abertos da CVM: demonstrações anuais (DFP) dos exercícios de {anosCvm[0]} a {ultimoAnoCvm} e informações trimestrais (ITR), de {num(Object.keys(e.empresas).length)} companhias. A coleção usa a demonstração
                    consolidada, que soma a companhia e as controladas; quando a companhia não tem controladas, usa a individual e marca a base em cada exercício ({num(individuais.length)}{" "}
                    {plural(individuais.length, "companhia tem", "companhias têm")} ao menos um exercício em base individual: {individuais.map((x) => x.nome).join(", ") || "nenhuma"}).
                  </p>
                  <p>
                    <span className="font-medium text-carvao">Reapresentações.</span> Os gráficos e as comparações usam o valor publicado na demonstração do próprio exercício. Quando a demonstração do exercício seguinte republica a
                    receita ou o lucro com outro valor, a ficha mostra os dois e marca o exercício ({num(comReapresentacao.length)} {plural(comReapresentacao.length, "companhia", "companhias")} na base:{" "}
                    {comReapresentacao.map((x) => x.nome).join(", ") || "nenhuma"}). O resultado é o contábil, não o ajustado dos releases.
                  </p>
                </div>
              </div>
            ) : (
              <p className="mt-4 max-w-prose2 text-sm leading-relaxed text-carvao-muted" data-em-apuracao="">
                O ranking dos maiores grupos e as fichas estão em apuração e ainda não foram publicados. As demonstrações das companhias abertas vêm dos dados abertos da CVM (DFP de {anosCvm[0]} a {ultimoAnoCvm} e ITR).
              </p>
            )}
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
                ...Object.entries(e.formulas).map(([k, v]) => [NOME_FORMULA[k] ?? k.replace(/_/g, " "), `Conta da coleção sobre as demonstrações da CVM: ${v}.`]),
                ["A conta dos R$ 100 fecha", `R$ 100 mais as parcelas (com o sinal da demonstração) têm de dar o lucro por R$ 100, e este tem de ser o lucro líquido divulgado ÷ receita líquida × 100, com tolerância de R$ ${num(TOLERANCIA_PONTE, 2)}. A página diz quando não fecha.`],
                ["Dias de estoque e de fornecedores", "Conta da coleção: saldo de estoques (ou de fornecedores) no fim do exercício ÷ custo da mercadoria vendida no exercício × 365. O saldo de convênio de fornecedores, que fica em outra conta, não entra."],
                ["Diferença que se repete (comparador)", `Para duas companhias, cada uma de ${num(MEDIDAS_COMPARADAS.length)} medidas relativas (${MEDIDAS_COMPARADAS.map((m) => m.rotulo.toLowerCase()).join("; ")}) é calculada em todos os exercícios em que as duas têm demonstração. A diferença "se repete" quando tem o mesmo sinal em todos eles e há mais de um; a repetição não aponta causa nem ajusta perímetro.`],
                ["Participação na amostra", "Conta da coleção: venda do grupo ÷ soma das vendas dos grupos listados no ranking × 100, estimativas da fonte incluídas e ditas. Não é participação de mercado."],
                ["Crescimento da venda no ranking", "Conta da coleção: venda do exercício ÷ venda do exercício anterior − 1, com uma casa, sobre os dois valores publicados; sem um deles, o percentual impresso pela fonte."],
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
                <span className="font-medium">Pesos das atividades.</span> {g.notas.pmc_pesos} Por isso a coleção conta quantas atividades subiram e caíram e mostra a diferença de cada uma contra o Brasil, mas não calcula
                contribuições em pontos percentuais: não diz quanto cada atividade puxou o resultado.
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
              {semUltimoAno.map(({ f, emp, evento }) => (
                <li key={`sem-ano-${f.slug}`} data-lacuna="sem-demonstracao">
                  <span className="font-medium">{f.grupo} sem demonstrações recentes.</span> A última demonstração anual na base é a de {emp.anuais[emp.anuais.length - 1]?.exercicio ?? "nenhum exercício"}
                  {emp.ultimo_trimestre?.data_base ? `, e a última informação trimestral, a de ${mesDaData(emp.ultimo_trimestre.data_base)}` : ""}. {evento ? textoCurado(evento.descricao) : "A ficha do grupo não registra o motivo."} No
                  comparador, o exercício de {ultimoAnoCvm} aparece como sem demonstração.
                </li>
              ))}
              {estimados.length > 0 && (
                <li data-lacuna="estimados">
                  <span className="font-medium">Vendas estimadas pela fonte.</span> No ranking de {anoRanking}, a venda de {estimados.map((l) => l.grupo).join(", ")} é estimativa do instituto, não número da empresa (
                  {reaisDeMilhoes(amostra.estimado_milhoes)} somados). As linhas vêm marcadas e não entram em comparação de crescimento.
                </li>
              )}
              {ranking?.marketplaces && (
                <li data-lacuna="digitais">
                  <span className="font-medium">Operadores digitais sem venda comparável.</span> O ranking conta só a venda própria e deixa de fora a venda de terceiros nas plataformas. Por isso{" "}
                  {foraDoRanking.length > 0 ? foraDoRanking.map((f) => f.grupo).join(", ") : "os grandes marketplaces"} e outras plataformas não têm linha nem posição; o valor negociado que a fonte publica à parte é, na maior parte,
                  estimativa dela e não se compara com a venda dos grupos.
                </li>
              )}
              {fechados.length > 0 && (
                <li data-lacuna="fechados">
                  <span className="font-medium">Grupos de capital fechado sem demonstrações.</span> {fechados.map((l) => l.grupo).join(", ")} não entregam demonstrações à CVM: margem, lucro, caixa e dívida aparecem como não divulgados, e a
                  ficha se apoia em indicadores da operação.
                </li>
              )}
              {conferencias
                .filter((x) => x.nao_acessado)
                .map((x) => (
                  <li key={`conf-${x.fonte}`} data-lacuna="conferencia">
                    <span className="font-medium">{x.fonte} sem valores públicos.</span> {textoCurado(x.nao_acessado)}
                  </li>
                ))}
              {trimestreAtrasado.map(({ f, emp, evento }) => (
                <li key={`tri-${f.slug}`} data-lacuna="trimestre">
                  <span className="font-medium">{f.grupo} com último trimestre em {mesDaData(emp.ultimo_trimestre?.data_base)}.</span> As demais companhias da base vão até {mesDaData(ultimaData)}; os acumulados do ano não cobrem o mesmo
                  período. {evento ? textoCurado(evento.descricao) : ""}
                </li>
              ))}
              {c.segmentos?.nota_geral?.sustentacao_da_equivalencia && (
                <li data-lacuna="conceitos-pmc">
                  <span className="font-medium">Correspondência com o IBGE sustentada pelo relatório metodológico.</span> {textoCurado(c.segmentos.nota_geral.sustentacao_da_equivalencia).replace("neste ambiente (resposta 403)", "na data da consulta")}
                </li>
              )}
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
            <p className="mt-3 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
              A plataforma consulta de novo o IBGE, o Banco Central e a CVM nos dias 16 e 28 de cada mês, depois da divulgação mensal da pesquisa do comércio e do prazo de entrega das demonstrações trimestrais. A nova consulta só substitui a publicada se nenhum mês, estado, atividade ou companhia tiver sumido e se todos os testes passarem; se os números forem os mesmos, nada muda. O ranking, as fichas dos grupos e a correspondência dos segmentos são escritos à mão e revistos fora dessa rotina: o ranking uma vez por ano, as fichas a cada temporada de resultados.
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
