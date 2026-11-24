import type { Metadata } from "next";
import Link from "next/link";
import { FaixaFrescor } from "@/components/frescor/FaixaFrescor";
import { Recolhido } from "@/components/observatorios/Recolhido";
import { Controles, FiguraAnalitica, LeituraGuiada, PaginaPainel, TabelaDados } from "@/components/painel";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { BuscaGrupos, CadeiaDaMarca } from "@/components/varejo/BuscaGrupos";
import { CabecalhoVarejo, LINK } from "@/components/varejo/comum";
import { ExportarRecorte } from "@/components/varejo/ExportarRecorte";
import { RESUMO_MAIS } from "@/components/varejo/FichaGrupo";
import { BlocosDeTamanho } from "@/components/varejo/figuras/BlocosDeTamanho";
import { DispersaoLojas } from "@/components/varejo/figuras/DispersaoLojas";
import { Inclinacao, textoDoMovimento } from "@/components/varejo/figuras/Inclinacao";
import { ConceitoEmEsquema, LideresDeSegmento, ParesDeListas, ReguaPlataformas } from "@/components/varejo/figuras/QuadrosDoRanking";
import { Campo, FonteDocumento, LegendaNatureza, MarcaNatureza } from "@/components/varejo/grupos-comum";
import { LogoEmpresa } from "@/components/varejo/LogoEmpresa";
import { SelectUrl } from "@/components/varejo/SelectUrl";
import { SeletorUrl } from "@/components/varejo/SeletorUrl";
import { FRESCOR_DAS_COLECOES } from "@/lib/frescor/entradas";
import { tituloNaColecao } from "@/lib/observatorios/contexto";
import { hrefComRecorte, parametro, parametroEntre, type ParametrosPagina } from "@/lib/painel/recorte";
import type { NumeroProps } from "@/lib/painel/tipos";
import { curadoria, goldEmpresas } from "@/lib/varejo/dados";
import { diaBr, num, ordinal, pct, plural, reaisDeMilhoes, textoCurado, variacao } from "@/lib/varejo/formato";
import {
  amostraDoRanking,
  buscarGrupos,
  crescimentoDe,
  exercicioDoRanking,
  fonteDoRanking,
  hrefFicha,
  lideresNosSegmentos,
  limiarDeDestaque,
  linhasDoRanking,
  modelosDeLoja,
  movimentosDoRanking,
  naturezaCurada,
  naturezaDoKit,
  NOME_ORDEM,
  nomeDoSegmento,
  ordenarRanking,
  ORDENS,
  paresDaAbras,
  PADRAO_GRUPOS,
  recorteParaLevar,
  reguaDasPlataformas,
  ROTA_COMPARADOR,
  ROTA_GRUPOS,
  ROTA_GRUPOS_CSV,
  ROTULO_NATUREZA,
  segmentosDoRanking,
  tamanhosPorSegmento,
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
  const linhasAbras = paresDaAbras(c);
  const tamanhos = tamanhosPorSegmento(c);
  const movimentos = movimentosDoRanking(c);
  const destaque = limiarDeDestaque(movimentos);
  const movidos = movimentos.filter((m) => m.ganho !== null && Math.abs(m.ganho) >= destaque).sort((x, y) => Math.abs(y.ganho!) - Math.abs(x.ganho!));
  const modelos = modelosDeLoja(c);
  const comLojas = modelos.filter((m) => m.venda_por_loja_milhoes !== null).sort((x, y) => y.venda_por_loja_milhoes! - x.venda_por_loja_milhoes!);
  const lideresFig = lideresNosSegmentos(c);
  const plataformas = reguaDasPlataformas(c);
  const anoAnterior = String(Number(ano) - 1 || "ano anterior");
  const maiorSegmento = tamanhos[0] ?? null;
  const fichaOuNada = (slug: string) => (c.fichas[slug] ? ficha(slug) : null);

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
                <ul className="mt-3">
                  {busca.grupos.map((x) => (
                    <CadeiaDaMarca
                      key={x.slug}
                      slug={x.slug}
                      grupo={x.grupo}
                      bandeiras={x.bandeiras}
                      href={ficha(x.slug)}
                      posicao={x.posicao !== null ? `${ordinal(x.posicao)} no ranking de vendas de ${ano}` : `Fora do ranking de ${ano}: o método da fonte não conta a venda de terceiros na plataforma`}
                      detalhe={<>Controlador registrado na ficha: {x.controlador ? textoCurado(x.controlador) : <span className="italic">não verificado</span>}.</>}
                    />
                  ))}
                  {busca.companhias.map((x) => (
                    <li key={x.slug} className="min-w-0 border-t border-linha py-4" data-achado-companhia={x.slug}>
                      <p className="flex items-center gap-4 font-serif text-xl leading-tight text-carvao">
                        <LogoEmpresa slug={x.slug} nome={x.nome} tamanho="m" decorativo semLogo="placa" />
                        {x.nome}
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
            <FiguraAnalitica
              id="ranking"
              pergunta="Qual é o tamanho de cada grupo?"
              subtitulo={`Venda bruta ao consumidor · R$ bilhões correntes · área proporcional à venda · ${num(a.n)} grupos listados · ${ano}`}
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
                      {maiorSegmento && ` O segmento ${maiorSegmento.nome.toLowerCase()} reúne ${num(maiorSegmento.blocos.length)} deles e ${pct(maiorSegmento.participacao)} da soma.`}
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
              comoInterpretar={`A área de cada bloco é a venda do grupo; os blocos de um mesmo segmento ficam juntos, sob o nome dele. O percentual é a participação na amostra: a venda do grupo dividida pela soma dos ${num(a.n)} listados (${reaisDeMilhoes(a.total_milhoes)}), estimativas incluídas. A posição na tabela é a que a fonte publicou; ordenar por outra coluna não a altera.`}
              naoConcluir="a participação de mercado de cada grupo, nem que venda maior é resultado melhor: a lista tem só os 20 primeiros de 300, mistura valores divulgados e estimados e mede venda bruta, não lucro."
              tabela={{
                titulo: `Vendas e participação na amostra, por segmento, ${ano}`,
                colunas: ["Grupo", "Segmento", `Vendas em ${ano}, R$ milhões`, "Participação na amostra, %", "Parte do segmento na amostra, %", "Venda do exercício"],
                linhas: tamanhos.flatMap((t) => t.blocos.map((b) => [`${ordinal(b.posicao)} ${b.grupo}`, t.nome, b.vendas_milhoes, b.participacao, t.participacao, b.natureza === "estimado_pela_fonte" ? "estimada pela fonte" : "divulgada"])),
                casas: [null, null, 0, 1, 1, null],
                limite: a.n,
                csv: ROTA_GRUPOS_CSV,
              }}
            >
              <BlocosDeTamanho titulo={`O tamanho de cada grupo: vendas de ${ano}, por segmento`} segmentos={tamanhos} href={fichaOuNada} marcados={[...achados]} segmentoAtivo={segmento || null} />
              <p className="t-meta mt-2 max-w-prose2 text-carvao" data-denominador="">
                <span className="font-medium">Participação na amostra:</span> o todo do mosaico é a soma dos {num(a.n)} grupos listados, {reaisDeMilhoes(a.total_milhoes)}, não o mercado.
                {a.sem_valor > 0 ? ` ${num(a.sem_valor)} ${plural(a.sem_valor, "grupo sem venda publicada fica", "grupos sem venda publicada ficam")} fora do desenho e ${plural(a.sem_valor, "aparece", "aparecem")} na tabela.` : ""}
              </p>
            </FiguraAnalitica>

            <FiguraAnalitica
              id="movimento"
              pergunta="Quem subiu e quem desceu?"
              subtitulo={`Posição no ranking de vendas · ${anoAnterior} e ${ano} · ${num(a.n)} grupos listados`}
              natureza="OBSERVADO"
              proveniencia={provRanking(c, { indicador: "Posição no ranking de vendas, no exercício e no anterior", natureza: "OBSERVADO", unidade: "posição", transformacoes: ["Posições ganhas: posição do ano anterior menos a posição do exercício"], limitacoes: ["A posição anterior é a que a fonte imprime ao lado da atual; a fonte pode ter revisado valores do ano anterior entre as edições."] })}
              leitura={
                <LeituraGuiada>
                  {movidos.length > 0 ? (
                    <>
                      De {anoAnterior} para {ano}, {movidos.slice(0, 4).map((m, i, l) => `${i > 0 ? (i === l.length - 1 ? " e " : ", ") : ""}${m.grupo} ${textoDoMovimento(m)} (do ${ordinal(m.anterior!)} para o ${ordinal(m.atual)})`).join("")}.{" "}
                      {num(movimentos.filter((m) => m.ganho === 0).length)} dos {num(movimentos.length)} mantiveram o lugar.
                    </>
                  ) : (
                    <>A fonte não publicou a posição anterior dos grupos desta lista.</>
                  )}
                </LeituraGuiada>
              }
              comoInterpretar={`Cada linha liga a posição de um grupo em ${anoAnterior}, à esquerda, à de ${ano}, à direita: linha que sobe é grupo que ganhou posições. Ficam em destaque os que se moveram ${num(destaque)} posições ou mais. Posição é ordem de venda bruta, não nota.`}
              naoConcluir="que quem subiu vendeu melhor por mérito próprio, nem que quem desceu encolheu: a posição muda também quando a fonte troca uma estimativa, quando um grupo compra ou vende um negócio e quando o vizinho de lista cresce."
              tabela={{
                titulo: `Posição no ranking em ${anoAnterior} e em ${ano}`,
                colunas: ["Grupo", `Posição em ${anoAnterior}`, `Posição em ${ano}`, "Posições ganhas (negativo: perdidas)", "Venda do exercício"],
                linhas: movimentos.map((m) => [m.grupo, m.anterior, m.atual, m.ganho, m.natureza === "estimado_pela_fonte" ? "estimada pela fonte" : "divulgada"]),
                casas: [null, 0, 0, 0, null],
                limite: movimentos.length,
              }}
            >
              <Inclinacao titulo={`Posição de cada grupo em ${anoAnterior} e em ${ano}`} movimentos={movimentos} destaque={destaque} anoAnterior={anoAnterior} ano={ano} href={fichaOuNada} />
            </FiguraAnalitica>

            <FiguraAnalitica
              id="modelos"
              pergunta="Poucas lojas enormes ou muitas lojas pequenas?"
              subtitulo={`Venda bruta ao consumidor × lojas no fim do exercício · ${num(comLojas.length)} de ${num(a.n)} grupos com os dois valores · ${ano}`}
              natureza="OBSERVADO"
              proveniencia={provRanking(c, { indicador: "Vendas e número de lojas dos maiores grupos do varejo", natureza: "OBSERVADO", unidade: "R$ milhões correntes; lojas", limitacoes: ["Loja é o que cada grupo conta como loja: um atacarejo de 5 mil m², uma farmácia de 150 m² e uma franquia entram como uma unidade cada.", "A venda inclui o comércio eletrônico do grupo, que não depende de loja."] })}
              complementares={[{ rotulo: "Sobre a venda por loja", p: provRanking(c, { indicador: "Venda por loja", natureza: "CALCULADO", unidade: "R$ milhões por loja", formula: "venda do exercício ÷ lojas no fim do exercício" }) }]}
              leitura={
                <LeituraGuiada>
                  {comLojas.length > 1 ? (
                    <>
                      Em {ano}, {comLojas[0].grupo} vendeu R$ {num(comLojas[0].venda_por_loja_milhoes, 0)} milhões por loja, com {num(comLojas[0].lojas)} lojas; {comLojas[comLojas.length - 1].grupo}, R$ {num(comLojas[comLojas.length - 1].venda_por_loja_milhoes, 1)} milhões por loja, com {num(comLojas[comLojas.length - 1].lojas)}.
                    </>
                  ) : (
                    <>A fonte não publicou o número de lojas dos grupos desta lista.</>
                  )}
                </LeituraGuiada>
              }
              comoInterpretar="Para a direita, mais lojas; para cima, mais venda. Dois grupos na mesma altura vendem o mesmo com redes de tamanhos diferentes: quem está mais à esquerda vende mais por loja. As diagonais tracejadas marcam a mesma venda por loja."
              naoConcluir="que vender mais por loja é operar melhor: a venda por loja depende do tamanho da loja, do preço do que se vende e de quanto da venda é pela internet, e a fonte não publica a área de venda."
              tabela={{
                titulo: `Vendas, lojas e venda por loja, ${ano}`,
                colunas: ["Grupo", "Segmento", `Vendas em ${ano}, R$ milhões`, "Lojas", "Venda por loja, R$ milhões", "Venda do exercício"],
                linhas: modelos.map((m) => [m.grupo, nomeDoSegmento(m.segmento), m.vendas_milhoes, m.lojas, m.venda_por_loja_milhoes, m.natureza === "estimado_pela_fonte" ? "estimada pela fonte" : "divulgada"]),
                casas: [null, null, 0, 0, 1, null],
                limite: modelos.length,
              }}
            >
              <DispersaoLojas titulo={`Vendas e lojas dos maiores grupos, ${ano}`} modelos={modelos} href={fichaOuNada} ano={ano} />
            </FiguraAnalitica>

            <Recolhido
              id="lista"
              aberto={foraDoPadrao}
              nivelTitulo={2}
              titulo="A lista completa, com as marcas de cada grupo"
              resumo={`${num(a.n)} grupos com marcas, segmento, venda, natureza do dado, crescimento, lojas e página da fonte; filtro por segmento, ordenação e arquivo do recorte.`}
            >
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
                base={`${ROTA_GRUPOS}#lista`}
                outros={Object.fromEntries(Object.entries({ q, ordem: ordem === PADRAO_GRUPOS.ordem ? "" : ordem }).filter(([, v]) => v))}
                atual={segmento}
                opcoes={[{ valor: "", rotulo: "Todos os segmentos", href: h({ segmento: null }) }, ...segmentos.map((s) => ({ valor: s, rotulo: nomeDoSegmento(s), href: h({ segmento: s }) }))]}
              />
              <SeletorUrl id="sel-ordem" rotulo="Ordenar por" atual={ordem} opcoes={ORDENS.map((o) => ({ valor: o, rotulo: NOME_ORDEM[o], href: h({ ordem: o }) }))} />
            </Controles>
              <div className="mt-5 space-y-3">
                  <LegendaNatureza naturezas={["divulgado", "estimado_pela_fonte"]} />
                  <TabelaDados
                    recolhida={false}
                    idioma="pt"
                    titulo={`Maiores grupos do varejo, vendas de ${ano}`}
                    colunas={["Grupo", "Marcas", "Segmento", `Vendas em ${ano}, R$ milhões`, "Natureza do dado", `Crescimento sobre ${Number(ano) - 1 || "o ano anterior"}, %`, "Lojas", "Participação na amostra, %", "Demonstrações", "Fonte"]}
                    linhas={linhas.map((l) => [
                      <span key={l.slug} className="flex items-center gap-2.5">
                        <span className="hidden sm:inline-flex">
                          <LogoEmpresa slug={l.slug} nome={l.grupo} tamanho="p" decorativo semLogo="placa" />
                        </span>
                        <span>
                          {ordinal(l.posicao)} {l.grupo}
                        </span>
                      </span>,
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
              </div>
            </Recolhido>

            {lideres.length > 0 && (
              <Recolhido id="lideres" aberto nivelTitulo={2} titulo="Quem lidera cada segmento?" resumo={`Os ${num(lideres.length)} segmentos do ranking de 300, com o líder de cada um, esteja ou não entre os ${num(a.n)} maiores.`}>
                <LideresDeSegmento titulo={`Vendas de cada segmento entre as 300 empresas do ranking e a parte do líder, ${ano}`} lideres={lideresFig} href={fichaOuNada} />
                <p className="t-meta mt-3 max-w-prose2 text-carvao-muted">
                  Venda bruta ao consumidor em {ano}, R$ bilhões. Barra inteira: soma das empresas do segmento entre as 300 do ranking. Trecho cheio: venda do líder; a parte dele é conta desta página (venda do líder dividida pela do segmento). Fonte: {fonte}, tabelas por segmento.
                </p>
                <details className="mt-2 border-t border-linha" data-tabela-dos-lideres="">
                  <summary className={RESUMO_MAIS}>Ver em tabela, com a natureza de cada valor e o número de empresas de cada segmento</summary>
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
                </details>
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
                <div className="mt-6" data-quadro-conceitos="">
                  <h3 className="t-h3 text-carvao">Quatro medidas que não se somam</h3>
                  <p className="t-meta mt-1 text-carvao-muted">Esquema, sem escala: a caixa da esquerda é o que a própria empresa vende; a da direita, o que outros vendem com a marca ou dentro da plataforma dela. Cheio é o que cada medida conta.</p>
                  <dl className="mt-4 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
                    <ConceitoEmEsquema rotulo="Venda de mercadoria própria (1P)" propria="cheia" terceiros="vazia">A empresa compra o produto, guarda no estoque e vende em seu nome. É o que o ranking conta, com os impostos.</ConceitoEmEsquema>
                    <ConceitoEmEsquema rotulo="Valor negociado por terceiros (3P)" propria="vazia" terceiros="cheia">Lojistas vendem dentro da plataforma de outra empresa. O dinheiro da venda é do lojista; o ranking não o soma à plataforma.</ConceitoEmEsquema>
                    <ConceitoEmEsquema rotulo="Comissões da plataforma" propria="vazia" terceiros="fatia">O que a plataforma cobra do lojista por venda, frete e anúncio. É a receita dela com o 3P, uma fração do valor negociado.</ConceitoEmEsquema>
                    <ConceitoEmEsquema rotulo="Venda ao consumidor de redes franqueadas" propria="cheia" terceiros="cheia">Nas franquias, o ranking soma o que as lojas próprias e as franqueadas venderam ao consumidor, valor maior que a receita da franqueadora.</ConceitoEmEsquema>
                  </dl>
                </div>
                {(mk.lista ?? []).length > 0 && (
                  <div className="mt-8 border-t border-linha pt-6">
                    <h3 className="t-h3 text-carvao">O que a fonte publica à parte: valor negociado nas plataformas</h3>
                    <p className="t-meta mb-4 mt-1 max-w-prose2 text-carvao-muted">
                      Valor bruto de tudo o que passou pela plataforma em {ano}, somando venda própria e de terceiros (GMV digital), em R$ bilhões. Não é venda da empresa e não se compara com as vendas do ranking.
                    </p>
                    <ReguaPlataformas titulo={`Valor negociado nos principais marketplaces em operação no Brasil, ${ano}`} linhas={plataformas} href={fichaOuNada} />
                    <details className="mt-2 border-t border-linha" data-tabela-das-plataformas="">
                      <summary className={RESUMO_MAIS}>Ver em tabela, com a natureza de cada valor e a página da fonte</summary>
                    <TabelaDados
                      recolhida={false}
                      idioma="pt"
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
                    <div className="mt-3 pb-2">
                      <LegendaNatureza naturezas={["divulgado", "estimado_pela_fonte"]} />
                    </div>
                    </details>
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
              <Recolhido id="conferencias" nivelTitulo={2} titulo="O que outras listas confirmam" resumo="O ranking comparado com o da associação de supermercados e com o do instituto de varejo: onde coincidem, onde divergem e o que não foi possível ler.">
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
                          <ParesDeListas titulo={`Grupos alimentares: valor no ranking do IRTT e na lista da ABRAS, ${ano}`} pares={linhasAbras} outra="ABRAS" href={fichaOuNada} />
                          <p className="t-meta mt-2 max-w-prose2 text-carvao-muted">Faturamento de {ano}, R$ bilhões, na mesma régua a partir do zero. Onde as duas marcas se sobrepõem, as listas publicam o mesmo valor.</p>
                          <details className="mt-1 border-t border-linha" data-tabela-da-conferencia="">
                          <summary className={RESUMO_MAIS}>Ver os dois valores em tabela, em R$ milhões</summary>
                          <TabelaDados
                            recolhida={false}
                            idioma="pt"
                            titulo={`Grupos alimentares: valor no ranking do IRTT e na lista da ABRAS, ${ano}`}
                            colunas={["Grupo", "IRTT, R$ milhões", "ABRAS, R$ milhões", "ABRAS menos IRTT, R$ milhões"]}
                            linhas={linhasAbras.map((r) => [r.grupo, r.irtt_milhoes, r.outra_milhoes, r.diferenca_milhoes])}
                            casas={[null, 0, 1, 1]}
                            limite={linhasAbras.length}
                            links={{ Grupo: linhasAbras.map((r) => (r.tem_ficha ? ficha(r.slug) : null)) }}
                            fixarPrimeiraColuna
                            nota="Diferença de até R$ 1 milhão é arredondamento: o IRTT publica em milhões, a ABRAS em reais. No Grupo Mateus a ABRAS lista duas razões sociais em linhas separadas; a coluna traz só a primeira, e o texto acima explica."
                          />
                          </details>
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
