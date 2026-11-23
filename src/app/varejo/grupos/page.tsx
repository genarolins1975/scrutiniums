import type { Metadata } from "next";
import Link from "next/link";
import { FaixaFrescor } from "@/components/frescor/FaixaFrescor";
import { Recolhido } from "@/components/observatorios/Recolhido";
import { Controles, FiguraAnalitica, GraficoBarras, LeituraGuiada, PaginaPainel, TabelaDados } from "@/components/painel";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { BuscaGrupos } from "@/components/varejo/BuscaGrupos";
import { CabecalhoVarejo, LINK } from "@/components/varejo/comum";
import { ExportarRecorte } from "@/components/varejo/ExportarRecorte";
import { Campo, FonteDocumento, LegendaNatureza, MarcaNatureza } from "@/components/varejo/grupos-comum";
import { SelectUrl } from "@/components/varejo/SelectUrl";
import { SeletorUrl } from "@/components/varejo/SeletorUrl";
import { FRESCOR_DAS_COLECOES } from "@/lib/frescor/entradas";
import { tituloNaColecao } from "@/lib/observatorios/contexto";
import { hrefComRecorte, parametro, parametroEntre, type ParametrosPagina } from "@/lib/painel/recorte";
import type { NumeroProps } from "@/lib/painel/tipos";
import { curadoria, goldEmpresas } from "@/lib/varejo/dados";
import { diaBr, num, ordinal, plural, reaisDeMilhoes, textoCurado, variacao } from "@/lib/varejo/formato";
import {
  amostraDoRanking,
  buscarGrupos,
  crescimentoDe,
  exercicioDoRanking,
  fonteDoRanking,
  hrefFicha,
  linhasDoRanking,
  naturezaCurada,
  naturezaDoKit,
  NOME_ORDEM,
  nomeDoSegmento,
  ordenarRanking,
  ORDENS,
  PADRAO_GRUPOS,
  recorteParaLevar,
  ROTA_COMPARADOR,
  ROTA_GRUPOS,
  ROTA_GRUPOS_CSV,
  ROTULO_NATUREZA,
  segmentosDoRanking,
  urlSegura,
  type Ordem,
} from "@/lib/varejo/grupos";
import { paginaVarejo, ROTA_METODO, ROTA_SEGMENTOS } from "@/lib/varejo/paginas";
import { provRanking } from "@/lib/varejo/proveniencia";

/**
 * "Quem lidera e como ganha dinheiro?" (coleção Varejo, com conta): o ranking dos 20 maiores grupos como a fonte o publica
 * (IRTT, Top 300), a busca que devolve o grupo dono de uma marca, o filtro por segmento, os líderes de cada segmento, os
 * operadores digitais que o método da fonte deixa fora e o que outras duas listas confirmam ou contradizem. O recorte vive na
 * URL (`?q=`, `?segmento=`, `?ordem=`) e viaja para a ficha, que o devolve no link de volta.
 */
export const dynamic = "force-dynamic";

const pagina = paginaVarejo("grupos");

type Busca = { searchParams: ParametrosPagina };

export function generateMetadata(): Metadata {
  return {
    title: tituloNaColecao(pagina.pergunta, ROTA_GRUPOS),
    description: "Os 20 maiores grupos do varejo brasileiro pelo ranking do IRTT, com as marcas de cada um, a natureza de cada número, os líderes por segmento, os marketplaces fora do ranking e a ficha de cada grupo.",
    alternates: { canonical: ROTA_GRUPOS },
  };
}

const EXEMPLOS_DE_BUSCA = ["Atacadão", "Drogasil", "Extra", "Netshoes"];

export default function PaginaGrupos({ searchParams }: Busca) {
  const c = curadoria();
  const e = goldEmpresas();
  const ranking = c.ranking;
  const todas = linhasDoRanking(c);
  const a = amostraDoRanking(c);
  const ano = exercicioDoRanking(c);
  const fonte = fonteDoRanking(c);
  const segmentos = segmentosDoRanking(c);

  const q = (parametro(searchParams, "q") ?? "").slice(0, 60);
  const segmento = parametroEntre<string>(searchParams, "segmento", segmentos, "");
  const ordem = parametroEntre<Ordem>(searchParams, "ordem", ORDENS, PADRAO_GRUPOS.ordem);
  const recorte = { q: q || null, segmento: segmento || null, ordem };
  const h = (mudanca: Partial<Record<keyof typeof recorte, string | null>>) => hrefComRecorte(ROTA_GRUPOS, { ...recorte, ...mudanca }, PADRAO_GRUPOS);
  const de = recorteParaLevar(recorte);
  const ficha = (slug: string) => hrefFicha(slug, de);
  const foraDoPadrao = h({}) !== ROTA_GRUPOS;

  const busca = buscarGrupos(c, e, q || null);
  const achados = new Set((busca?.grupos ?? []).map((x) => x.slug));
  const linhas = ordenarRanking(todas.filter((l) => !segmento || l.segmento === segmento), ordem);
  const maior = todas[0] ?? null;
  const comCvm = todas.filter((l) => l.empresa_gold && e.empresas[l.empresa_gold]).length;
  const exerciciosCvm = e.fontes.dfp.exercicios;
  const nBandeiras = new Set(Object.keys(c.fichas).flatMap((s) => (c.fichas[s].bandeiras ?? []).map((b) => b.nome))).size;

  const provaRanking = { fonte, periodo: ano };
  const numeroTexto = (rotulo: string, valor: string, unidade: string, extra: Partial<NumeroProps> = {}): NumeroProps =>
    ({ rotulo, formato: "texto", valorTexto: valor, unidade, ...provaRanking, natureza: "CALCULADO", tamanho: "g", ...extra }) as NumeroProps;

  const lideres = ranking?.lideres_por_segmento ?? [];
  const mk = ranking?.marketplaces;
  const conferencias = ranking?.conferencias ?? [];
  const abras = conferencias.find((x) => x.valores_abras_reais);
  const linhasAbras = abras
    ? todas
        .filter((l) => typeof abras.valores_abras_reais?.[l.slug] === "number")
        .map((l) => {
          const outra = (abras.valores_abras_reais![l.slug] as number) / 1e6;
          return { l, outra, dif: typeof l.vendas_milhoes === "number" ? outra - l.vendas_milhoes : null };
        })
    : [];

  if (!ranking || todas.length === 0) {
    return (
      <>
        <MarcaVisita secao={pagina.secao} />
        <CabecalhoVarejo rota={ROTA_GRUPOS} />
        <PaginaPainel
          rota={ROTA_GRUPOS}
          abertura={{
            grupo: "Grupos", acento: "gas", titulo: pagina.pergunta,
            lead: "O ranking dos maiores grupos do varejo está em apuração e ainda não foi publicado nesta edição. As páginas de vendas do setor não dependem dele.",
            recorte: { periodo: "em apuração", universo: "maiores grupos do varejo", fonte: "curadoria da Scrutiniums" },
            limite: "qualquer coisa sobre os grupos enquanto a lista não estiver publicada: nenhum número é mostrado por estimativa ou por memória.",
          }}
          metodo={
            <p data-em-apuracao="">
              A curadoria do ranking chega por pipeline/varejo/curadoria/ranking.json.{" "}
              <Link href={ROTA_METODO} prefetch={false} className={LINK}>
                Fontes, fórmulas e lacunas
              </Link>
            </p>
          }
        />
      </>
    );
  }

  return (
    <>
      <MarcaVisita secao={pagina.secao} />
      <CabecalhoVarejo rota={ROTA_GRUPOS} />
      <PaginaPainel
        rota={ROTA_GRUPOS}
        abertura={{
          grupo: "Grupos",
          acento: "gas",
          titulo: pagina.pergunta,
          lead: `Os ${num(a.n)} maiores grupos do varejo pelas vendas de ${ano}, as marcas que cada um opera e a ficha de cada grupo. A mesma loja pode ter um dono que o letreiro não mostra.`,
          recorte: { periodo: `vendas de ${ano}`, universo: `${num(a.n)} maiores grupos do ranking de 300`, unidade: "venda bruta ao consumidor, em reais correntes", fonte },
          limite: "qual grupo é melhor, nem a participação de cada um no mercado: o ranking ordena por venda, com definição própria, e deixa de fora a venda de terceiros nos marketplaces.",
          acao: (
            <BuscaGrupos
              acao={ROTA_GRUPOS}
              atual={q}
              outros={Object.fromEntries(Object.entries({ segmento, ordem: ordem === PADRAO_GRUPOS.ordem ? "" : ordem }).filter(([, v]) => v))}
              exemplos={EXEMPLOS_DE_BUSCA.map((x) => ({ rotulo: x, href: `${h({ q: x })}#busca` }))}
            />
          ),
        }}
        aviso={
          busca ? (
            <section id="busca" aria-labelledby="busca-titulo" className="mt-6 scroll-mt-24 border-y border-linha py-5" data-resultado-busca={busca.grupos.length + busca.companhias.length}>
              <h2 id="busca-titulo" className="t-h3 text-carvao" role="status">
                {busca.grupos.length + busca.companhias.length === 0
                  ? `Nenhuma marca ou grupo encontrado para “${busca.termo}”`
                  : `“${busca.termo}”: ${num(busca.grupos.length + busca.companhias.length)} ${plural(busca.grupos.length + busca.companhias.length, "resultado", "resultados")}`}
              </h2>
              {busca.grupos.length + busca.companhias.length === 0 ? (
                <p className="mt-2 max-w-prose2 text-sm leading-relaxed text-carvao-muted" data-busca-vazia="">
                  A busca cobre {num(nBandeiras)} marcas de {num(Object.keys(c.fichas).length)} grupos com ficha e as {num(Object.keys(e.empresas).length)} companhias abertas da base. Marca de grupo fora dessa lista não aparece aqui, o que
                  não quer dizer que ela não exista. Confira a grafia ou percorra o ranking abaixo.
                </p>
              ) : (
                <ul className="mt-3 grid gap-x-10 gap-y-4 md:grid-cols-2">
                  {busca.grupos.map((x) => (
                    <li key={x.slug} className="min-w-0 border-t border-linha pt-3" data-achado={x.slug}>
                      <p className="text-base leading-snug text-carvao">
                        {x.bandeiras.length > 0 ? (
                          <>
                            <span className="font-medium">{x.bandeiras.join(", ")}</span> {plural(x.bandeiras.length, "é marca de", "são marcas de")}{" "}
                          </>
                        ) : null}
                        <Link href={ficha(x.slug)} prefetch={false} className={`font-medium ${LINK}`}>
                          {x.grupo}
                        </Link>
                      </p>
                      <p className="t-meta mt-1 text-carvao-muted">
                        {x.posicao !== null ? `${ordinal(x.posicao)} no ranking de vendas de ${ano}` : `Fora do ranking de ${ano}: o método da fonte não conta a venda de terceiros na plataforma`}. Controlador registrado na ficha:{" "}
                        {x.controlador ? textoCurado(x.controlador) : <span className="italic">não verificado</span>}.
                      </p>
                      <Link href={ficha(x.slug)} prefetch={false} className={`mt-1 inline-flex min-h-[44px] items-center text-sm ${LINK}`}>
                        Abrir a ficha de {x.grupo}
                      </Link>
                    </li>
                  ))}
                  {busca.companhias.map((x) => (
                    <li key={x.slug} className="min-w-0 border-t border-linha pt-3" data-achado-companhia={x.slug}>
                      <p className="text-base leading-snug text-carvao">
                        <span className="font-medium">{x.nome}</span>
                      </p>
                      <p className="t-meta mt-1 text-carvao-muted">Companhia aberta fora dos {num(a.n)} maiores grupos: não tem ficha, mas tem demonstrações na CVM e entra no comparador.</p>
                      <Link href={hrefComRecorte(ROTA_COMPARADOR, { e: x.slug })} prefetch={false} className={`mt-1 inline-flex min-h-[44px] items-center text-sm ${LINK}`}>
                        Comparar {x.nome} com outra companhia
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <p className="t-meta mt-3">
                <Link href={h({ q: null })} prefetch={false} scroll={false} className={`inline-flex min-h-[44px] items-center text-carvao ${LINK}`}>
                  Limpar a busca
                </Link>
              </p>
            </section>
          ) : undefined
        }
        rotuloNumeros={`Os ${num(a.n)} maiores grupos, vendas de ${ano}`}
        numeros={[
          numeroTexto(`Vendas somadas dos ${num(a.n)} grupos listados`, reaisDeMilhoes(a.total_milhoes), "venda bruta ao consumidor", {
            nota: a.estimados > 0 ? `Inclui ${num(a.estimados)} ${plural(a.estimados, "estimativa", "estimativas")} da fonte, que ${plural(a.estimados, "soma", "somam")} ${reaisDeMilhoes(a.estimado_milhoes)}.` : undefined,
          }),
          maior && typeof maior.vendas_milhoes === "number"
            ? numeroTexto("Maior grupo em vendas", reaisDeMilhoes(maior.vendas_milhoes), "venda bruta ao consumidor", { recorte: maior.grupo, natureza: naturezaDoKit(maior.natureza_dado), href: undefined })
            : ({ rotulo: "Maior grupo em vendas", unidade: "venda bruta ao consumidor", ...provaRanking, natureza: "OBSERVADO", valor: null, motivoAusencia: "A fonte não publicou o valor de vendas do primeiro colocado." } as NumeroProps),
          numeroTexto("Grupos com venda divulgada", `${num(a.divulgados)} de ${num(a.n)}`, "grupos", {
            nota: a.estimados > 0 ? `${plural(a.estimados, "O outro é estimativa", `Os outros ${num(a.estimados)} são estimativas`)} do instituto, marcadas na tabela.` : undefined,
          }),
          numeroTexto("Grupos com demonstrações na CVM", `${num(comCvm)} de ${num(a.n)}`, "grupos", {
            fonte: "CVM, Demonstrações Financeiras Padronizadas", periodo: `${exerciciosCvm[0]} a ${exerciciosCvm[exerciciosCvm.length - 1]}`,
            nota: "Os demais são de capital fechado ou listados no exterior: a ficha traz a evidência operacional.",
          }),
        ]}
        notaNumeros={`Venda na definição da fonte: bruta, ao consumidor final, com impostos. Não é receita líquida, e a soma dos ${num(a.n)} não é o mercado.`}
        figuras={
          <>
            <Controles
              rotulo="Recorte do ranking"
              idioma="pt"
              resumo={
                <>
                  Mostrando {num(linhas.length)} de {num(a.n)} grupos{segmento ? `, segmento ${nomeDoSegmento(segmento).toLowerCase()}` : ""}, por {NOME_ORDEM[ordem].toLowerCase()}.
                </>
              }
              limpar={foraDoPadrao ? { href: ROTA_GRUPOS } : undefined}
            >
              <SelectUrl
                id="sel-segmento"
                rotulo="Segmento"
                nome="segmento"
                base={`${ROTA_GRUPOS}#ranking`}
                outros={Object.fromEntries(Object.entries({ q, ordem: ordem === PADRAO_GRUPOS.ordem ? "" : ordem }).filter(([, v]) => v))}
                atual={segmento}
                opcoes={[{ valor: "", rotulo: "Todos os segmentos", href: h({ segmento: null }) }, ...segmentos.map((s) => ({ valor: s, rotulo: nomeDoSegmento(s), href: h({ segmento: s }) }))]}
              />
              <SeletorUrl id="sel-ordem" rotulo="Ordenar por" atual={ordem} opcoes={ORDENS.map((o) => ({ valor: o, rotulo: NOME_ORDEM[o], href: h({ ordem: o }) }))} />
            </Controles>

            <FiguraAnalitica
              id="ranking"
              pergunta="Quais são os maiores grupos e quanto venderam?"
              subtitulo={`Venda bruta ao consumidor · R$ bilhões correntes · ${num(linhas.length)} de ${num(a.n)} grupos${segmento ? `, ${nomeDoSegmento(segmento).toLowerCase()}` : ""} · ${ano}`}
              natureza="OBSERVADO"
              proveniencia={provRanking(c, {
                indicador: "Vendas dos maiores grupos do varejo", natureza: "OBSERVADO", unidade: "R$ milhões correntes", download: ROTA_GRUPOS_CSV,
                transformacoes: ["Participação na amostra: venda do grupo ÷ soma das vendas dos grupos listados × 100", "Crescimento: venda do exercício ÷ venda do exercício anterior − 1, com uma casa"],
                limitacoes: [textoCurado(ranking.fonte.conceito_venda), `${num(a.estimados)} dos ${num(a.n)} valores são estimativas da própria fonte e estão marcados.`],
              })}
              complementares={[{ rotulo: "Sobre as estimativas da fonte", p: provRanking(c, { indicador: "Vendas estimadas pelo IRTT", natureza: "ESTIMADO", unidade: "R$ milhões correntes", limitacoes: [textoCurado(ranking.fonte.metodologia)] }) }]}
              leitura={
                <LeituraGuiada>
                  {maior ? (
                    <>
                      Em {ano}, {maior.grupo} liderou com {reaisDeMilhoes(maior.vendas_milhoes)} de venda bruta ao consumidor. Os {num(a.n)} grupos somaram {reaisDeMilhoes(a.total_milhoes)}
                      {a.estimados > 0 ? `, dos quais ${reaisDeMilhoes(a.estimado_milhoes)} são estimativas da fonte para ${num(a.estimados)} ${plural(a.estimados, "grupo", "grupos")}` : ""}.
                    </>
                  ) : (
                    <>A fonte não publicou valores para este recorte.</>
                  )}
                </LeituraGuiada>
              }
              ressalva={
                <>
                  <span className="font-medium">O que a fonte chama de venda.</span> {textoCurado(ranking.fonte.conceito_venda)}
                </>
              }
              comoInterpretar="A posição é a que a fonte publicou; ordenar por outra coluna não a altera. A participação na amostra divide a venda de cada grupo pela soma dos grupos listados, estimativas incluídas: mostra o peso dentro desta lista, não no mercado."
              naoConcluir="a participação de mercado de cada grupo, nem que venda maior é resultado melhor: a lista tem só os 20 primeiros de 300, mistura valores divulgados e estimados e mede venda bruta, não lucro."
              tabela={{ naFigura: "A tabela do ranking vem logo abaixo do gráfico, com os mesmos valores, as marcas de cada grupo, a natureza de cada número e o link da ficha." }}
              complemento={
                <>
                  <LegendaNatureza naturezas={["divulgado", "estimado_pela_fonte"]} />
                  <TabelaDados
                    recolhida={false}
                    idioma="pt"
                    titulo={`Maiores grupos do varejo, vendas de ${ano}`}
                    colunas={["Grupo", "Marcas", "Segmento", `Vendas em ${ano}, R$ milhões`, "Natureza do dado", `Crescimento sobre ${Number(ano) - 1 || "o ano anterior"}, %`, "Lojas", "Participação na amostra, %", "Demonstrações", "Fonte"]}
                    linhas={linhas.map((l) => [
                      `${ordinal(l.posicao)} ${l.grupo}`,
                      (l.bandeiras ?? []).join(", ") || null,
                      nomeDoSegmento(l.segmento),
                      l.vendas_milhoes,
                      <MarcaNatureza key={l.slug} natureza={l.natureza_dado} />,
                      crescimentoDe(l),
                      l.lojas ?? null,
                      l.participacao_na_amostra,
                      l.empresa_gold && e.empresas[l.empresa_gold] ? "na CVM" : (c.fichas[l.slug]?.capital ?? l.capital) === "aberto no exterior" ? "listado no exterior" : l.capital === "fechado" ? "capital fechado" : "sem demonstração na CVM",
                      `IRTT, p. ${l.pagina ?? "não informada"}`,
                    ])}
                    casas={[null, null, null, 0, null, 1, 0, 1, null, null]}
                    limite={linhas.length}
                    ausencia={{ Marcas: "não informadas", Lojas: "não divulgado", [`Vendas em ${ano}, R$ milhões`]: "não divulgado", [`Crescimento sobre ${Number(ano) - 1 || "o ano anterior"}, %`]: "sem base de comparação" }}
                    links={{ Grupo: linhas.map((l) => (l.tem_ficha ? ficha(l.slug) : null)) }}
                    linhasDestacadas={linhas.map((l, i) => (achados.has(l.slug) ? i : -1)).filter((i) => i >= 0)}
                    fixarPrimeiraColuna
                    csv={ROTA_GRUPOS_CSV}
                    nota={`Toque no nome de um grupo para abrir a ficha. Participação na amostra: venda do grupo dividida pela soma dos ${num(a.n)} grupos listados (${reaisDeMilhoes(a.total_milhoes)}${a.estimados > 0 ? `, com ${num(a.estimados)} estimativas da fonte` : ""}); não é participação de mercado.${busca && achados.size > 0 ? " As linhas destacadas são os grupos da busca." : ""}`}
                  />
                  <ExportarRecorte
                    nome={`varejo-grupos-${ano}${segmento ? `-${segmento}` : ""}`}
                    colunas={["posicao", "slug", "grupo", "marcas", "segmento", "vendas_milhoes_reais", "natureza_do_dado", "crescimento_pct", "lojas", "participacao_na_amostra_pct", "pagina_na_fonte"]}
                    linhas={linhas.map((l) => [l.posicao, l.slug, l.grupo, (l.bandeiras ?? []).join(", "), nomeDoSegmento(l.segmento), l.vendas_milhoes, ROTULO_NATUREZA[l.natureza_dado], crescimentoDe(l), l.lojas ?? null, l.participacao_na_amostra === null ? null : Number(l.participacao_na_amostra.toFixed(2)), l.pagina ?? null])}
                    recorte={`${segmento ? `Segmento ${nomeDoSegmento(segmento).toLowerCase()}` : "Todos os segmentos"}, vendas de ${ano}, venda bruta ao consumidor`}
                    fonte={fonte}
                  />
                </>
              }
            >
              <GraficoBarras
                semTabela
                titulo={`Vendas dos maiores grupos do varejo, ${ano}`}
                dados={linhas.map((l) => ({ slug: l.slug, nome: `${ordinal(l.posicao)} ${l.grupo}${l.natureza_dado === "estimado_pela_fonte" ? " (estimado)" : ""}`, vendas: typeof l.vendas_milhoes === "number" ? l.vendas_milhoes / 1000 : null }))}
                chaveCategoria="slug"
                chaveRotulo="nome"
                series={[{ id: "vendas", rotulo: "Venda bruta ao consumidor", cor: "var(--cor-gas)" }]}
                unidade="R$ bilhões"
                casas={1}
                orientacao="horizontal"
                alturaCategoria={36}
                alturaMaxima={1200}
                rotulosValor
                rotulosSaoNomes
              />
            </FiguraAnalitica>

            {lideres.length > 0 && (
              <Recolhido id="lideres" aberto nivelTitulo={2} titulo="Quem lidera cada segmento?" resumo={`Os ${num(lideres.length)} segmentos do ranking de 300, com o líder de cada um, esteja ou não entre os ${num(a.n)} maiores.`}>
                <TabelaDados
                  recolhida={false}
                  idioma="pt"
                  titulo={`Líder de cada segmento do ranking, vendas de ${ano}`}
                  colunas={["Segmento na fonte", "Líder", "Posição geral", "Vendas do líder, R$ milhões", "Natureza do dado", "Vendas do segmento, R$ bilhões", "Empresas no segmento", "Parte do segmento nas 300, %"]}
                  linhas={lideres.map((l) => [
                    l.segmento_irtt,
                    l.lider,
                    typeof l.posicao_geral === "number" ? ordinal(l.posicao_geral) : null,
                    l.vendas_milhoes ?? null,
                    <MarcaNatureza key={l.segmento_irtt} natureza={naturezaCurada(l.natureza)} />,
                    l.vendas_segmento_bilhoes ?? null,
                    l.empresas_no_segmento ?? null,
                    l.participacao_no_top300_pct ?? null,
                  ])}
                  casas={[null, null, null, 0, null, 1, 0, 1]}
                  limite={lideres.length}
                  links={{ Líder: lideres.map((l) => (l.slug && c.fichas[l.slug] ? ficha(l.slug) : null)) }}
                  fixarPrimeiraColuna
                  nota={`Fonte: ${fonte}, tabelas por segmento. A parte de cada segmento é sobre a soma das 300 empresas do ranking, não sobre o mercado. Líder sem link está fora dos ${num(a.n)} maiores e não tem ficha.`}
                />
                <p className="t-meta mt-4 max-w-prose2 text-carvao-muted">
                  Os segmentos da fonte não são as atividades do IBGE. A correspondência entre os dois, e as vendas de cada atividade mês a mês, estão em{" "}
                  <Link href={`${ROTA_SEGMENTOS}#atividades`} prefetch={false} className={LINK}>
                    Onde a média esconde diferenças?
                  </Link>
                </p>
              </Recolhido>
            )}

            {mk && (
              <Recolhido
                id="digitais"
                aberto
                nivelTitulo={2}
                titulo="Operadores digitais fora do ranking"
                resumo="Por que Mercado Livre e Shopee não têm linha na lista, e o que a fonte publica sobre eles à parte."
              >
                <p className="max-w-prose2 text-base leading-relaxed text-carvao">{textoCurado(mk.tratamento)}</p>
                <div className="mt-6 border-t border-linha pt-5" data-quadro-conceitos="">
                  <h3 className="t-h3 text-carvao">Quatro medidas que não se somam</h3>
                  <dl className="mt-4 grid gap-x-10 gap-y-5 md:grid-cols-2">
                    <Campo rotulo="Venda de mercadoria própria (1P)">A empresa compra o produto, guarda no estoque e vende em seu nome. É o que o ranking conta, com os impostos.</Campo>
                    <Campo rotulo="Valor negociado por terceiros (3P)">Lojistas vendem dentro da plataforma de outra empresa. O dinheiro da venda é do lojista; o ranking não o soma à plataforma.</Campo>
                    <Campo rotulo="Comissões da plataforma">O que a plataforma cobra do lojista por venda, frete e anúncio. É a receita dela com o 3P, uma fração do valor negociado.</Campo>
                    <Campo rotulo="Venda ao consumidor de redes franqueadas">Nas franquias, o ranking soma o que as lojas próprias e as franqueadas venderam ao consumidor, valor maior que a receita da franqueadora.</Campo>
                  </dl>
                </div>
                {(mk.lista ?? []).length > 0 && (
                  <div className="mt-8">
                    <TabelaDados
                      recolhida={false}
                      idioma="pt"
                      tituloVisivel="O que a fonte publica à parte: valor negociado nas plataformas"
                      lead={`Valor bruto de tudo o que passou pela plataforma em ${ano}, somando venda própria e de terceiros (GMV digital). Não é venda da empresa e não se compara com a coluna de vendas do ranking.`}
                      titulo={`Valor negociado nos principais marketplaces em operação no Brasil, ${ano}`}
                      colunas={["Plataforma", `Valor negociado em ${ano}, R$ milhões`, "Natureza do dado", `Parte vendida por terceiros em ${ano}, R$ milhões`, "Fonte"]}
                      linhas={(mk.lista ?? []).map((m) => [
                        m.nome,
                        m.gmv_digital_2025_milhoes ?? null,
                        <MarcaNatureza key={m.nome} natureza={naturezaCurada(m.natureza)} />,
                        m.venda_de_sellers_2025_milhoes ?? null,
                        `IRTT, p. ${m.pagina ?? mk.pagina ?? "não informada"}`,
                      ])}
                      casas={[null, 0, null, 0, null]}
                      limite={(mk.lista ?? []).length}
                      ausencia={{ [`Parte vendida por terceiros em ${ano}, R$ milhões`]: "não publicado", [`Valor negociado em ${ano}, R$ milhões`]: "não publicado" }}
                      links={{ Plataforma: (mk.lista ?? []).map((m) => { const s = Object.keys(c.fichas).find((k) => c.fichas[k].grupo === m.nome || (ranking.grupos.find((g) => g.slug === k)?.grupo ?? "") === m.nome); return s ? ficha(s) : null; }) }}
                      fixarPrimeiraColuna
                      nota={mk.observacao_da_fonte ? textoCurado(mk.observacao_da_fonte) : undefined}
                    />
                    <div className="mt-3">
                      <LegendaNatureza naturezas={["divulgado", "estimado_pela_fonte"]} />
                    </div>
                  </div>
                )}
                {c.fichas["mercado-livre"] && (
                  <p className="mt-5 max-w-prose2 text-sm leading-relaxed text-carvao">
                    O Mercado Livre tem ficha própria, com o que a companhia divulga do Brasil nos documentos entregues ao regulador dos Estados Unidos e a diferença entre valor negociado, receita de comércio e receita financeira:{" "}
                    <Link href={ficha("mercado-livre")} prefetch={false} className={LINK}>
                      abrir a ficha do Mercado Livre
                    </Link>
                    .
                  </p>
                )}
              </Recolhido>
            )}

            {conferencias.length > 0 && (
              <Recolhido id="conferencias" aberto nivelTitulo={2} titulo="O que outras listas confirmam" resumo="O ranking comparado com o da associação de supermercados e com o do instituto de varejo: onde coincidem, onde divergem e o que não foi possível ler.">
                <div className="space-y-8">
                  {conferencias.map((x) => (
                    <article key={x.fonte} className="border-t border-linha pt-5" data-conferencia={x.fonte}>
                      <h3 className="t-h3 text-carvao">
                        {x.fonte}
                        {x.edicao ? <span className="t-meta block font-sans text-carvao-muted">{textoCurado(x.edicao)}</span> : null}
                      </h3>
                      <dl className="mt-4 grid gap-x-10 gap-y-5 md:grid-cols-2">
                        {x.o_que_confere && <Campo rotulo="O que confere">{textoCurado(x.o_que_confere)}</Campo>}
                        {(x.divergencias ?? []).length > 0 && (
                          <Campo rotulo="Onde diverge">
                            <ul className="space-y-2">
                              {(x.divergencias ?? []).map((d, i) => {
                                const nome = todas.find((l) => l.slug === d.grupo)?.grupo ?? d.grupo ?? "Grupo não identificado";
                                return (
                                  <li key={i}>
                                    <span className="font-medium">
                                      {d.grupo && c.fichas[d.grupo] ? (
                                        <Link href={ficha(d.grupo)} prefetch={false} className={LINK}>
                                          {nome}
                                        </Link>
                                      ) : (
                                        nome
                                      )}
                                      .
                                    </span>{" "}
                                    {textoCurado(d.motivo)}
                                  </li>
                                );
                              })}
                            </ul>
                          </Campo>
                        )}
                        {x.conceito_faturamento && <Campo rotulo="Como a outra lista define o valor">{textoCurado(x.conceito_faturamento)}</Campo>}
                        {x.nao_acessado && <Campo rotulo="O que não foi possível ler">{textoCurado(x.nao_acessado)}</Campo>}
                      </dl>
                      {x === abras && linhasAbras.length > 0 && (
                        <div className="mt-6">
                          <TabelaDados
                            recolhida={false}
                            idioma="pt"
                            titulo={`Grupos alimentares: valor no ranking do IRTT e na lista da ABRAS, ${ano}`}
                            colunas={["Grupo", "IRTT, R$ milhões", "ABRAS, R$ milhões", "ABRAS menos IRTT, R$ milhões"]}
                            linhas={linhasAbras.map((r) => [r.l.grupo, r.l.vendas_milhoes, r.outra, r.dif])}
                            casas={[null, 0, 1, 1]}
                            limite={linhasAbras.length}
                            links={{ Grupo: linhasAbras.map((r) => (r.l.tem_ficha ? ficha(r.l.slug) : null)) }}
                            fixarPrimeiraColuna
                            nota="Diferença de até R$ 1 milhão é arredondamento: o IRTT publica em milhões, a ABRAS em reais. No Grupo Mateus a ABRAS lista duas razões sociais em linhas separadas; a coluna traz só a primeira, e o texto acima explica."
                          />
                        </div>
                      )}
                      <p className="t-meta mt-4 text-carvao-muted">
                        {urlSegura(x.url) ? (
                          <a href={urlSegura(x.url)!} rel="noopener noreferrer" target="_blank" className={LINK}>
                            Abrir o documento de {x.fonte}
                          </a>
                        ) : (
                          `Documento de ${x.fonte} sem endereço registrado`
                        )}
                        {x.pagina ? `, p. ${x.pagina}` : ""}
                        {x.consultado_em ? `. Consultado em ${diaBr(x.consultado_em)}` : ""}.
                      </p>
                    </article>
                  ))}
                </div>
              </Recolhido>
            )}
          </>
        }
        notas={{
          id: "para-ler",
          itens: [
            { termo: "Grupo e marca", definicao: "Grupo é a empresa que controla uma ou mais redes. Marca (ou bandeira) é o nome no letreiro. Um grupo pode ter várias marcas, e uma marca pode mudar de dono." },
            { termo: "Venda bruta ao consumidor", definicao: "O valor pago pelo consumidor, com os impostos. É maior que a receita líquida das demonstrações financeiras, que desconta impostos, devoluções e, no ranking, parte das vendas no atacado.", exemplo: maior ? `${maior.grupo}: ${reaisDeMilhoes(maior.vendas_milhoes)} no ranking de ${ano}.` : undefined },
            { termo: "Estimado pela fonte", definicao: "Quando a empresa não divulga a venda, o instituto estima o valor por método próprio e avisa. A página marca essas linhas e diz quanto elas pesam em toda soma." },
            { termo: "Participação na amostra", definicao: `A venda do grupo dividida pela soma dos ${num(a.n)} grupos listados. Serve para comparar tamanhos dentro da lista. Não é participação de mercado: o varejo tem centenas de milhares de empresas fora dela.` },
            { termo: "Marketplace, 1P e 3P", definicao: "Marketplace é a loja virtual que abriga outros vendedores. 1P é a venda da própria dona da plataforma; 3P é a venda de terceiros dentro dela." },
            { termo: "GMV", definicao: "Sigla em inglês para o valor bruto de tudo o que foi negociado numa plataforma, somando 1P e 3P. É volume de negócios, não receita da empresa." },
          ],
          nota: (
            <>
              Para ver como duas companhias do mesmo ramo transformam venda em lucro e em caixa:{" "}
              <Link href={ROTA_COMPARADOR} prefetch={false} className={LINK}>
                {paginaVarejo("comparador").pergunta}
              </Link>
            </>
          ),
        }}
        metodo={
          <>
            <p>
              <FonteDocumento f={{ titulo: `${ranking.fonte.nome ?? "IRTT"}, edição ${ranking.fonte.edicao ?? ""}`, url: ranking.fonte.url, pagina: ranking.fonte.paginas ? `páginas ${ranking.fonte.paginas}` : undefined, periodo: `vendas de ${ano}`, consultado_em: ranking.fonte.consultado_em }} />
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
            {ranking.soma_top300_nota?.texto && <p>{textoCurado(ranking.soma_top300_nota.texto)}</p>}
            {ranking.soma_top300_nota?.comparacao_ibge_citada_pela_fonte && <p>{textoCurado(ranking.soma_top300_nota.comparacao_ibge_citada_pela_fonte)}</p>}
            {ranking.fonte.nota_crescimento && <p>Crescimento: {variacao(crescimentoDe(todas[0]))} no primeiro colocado é a conta desta página (venda de {ano} dividida pela do ano anterior, com uma casa); a fonte imprime o percentual sem casa decimal.</p>}
            <p>
              A lista, as marcas e as conferências são curadoria da Scrutiniums sobre os documentos citados, lidos em {diaBr(ranking.fonte.consultado_em)}; nenhum valor foi estimado por nós. O arquivo{" "}
              <a href={ROTA_GRUPOS_CSV} download className={LINK}>
                ranking dos grupos (CSV)
              </a>{" "}
              traz todas as linhas com a natureza, a página e a data de consulta.{" "}
              <Link href={ROTA_METODO} prefetch={false} className={LINK}>
                Fontes, fórmulas, correspondência com o IBGE e lacunas
              </Link>
              .
            </p>
          </>
        }
        frescorMetodo={<FaixaFrescor dominios={FRESCOR_DAS_COLECOES["/varejo"]} variante="metodo" />}
      />
    </>
  );
}
