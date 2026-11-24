import type { Metadata } from "next";
import Link from "next/link";
import { FaixaFrescor } from "@/components/frescor/FaixaFrescor";
import { Controles, FiguraAnalitica, LeituraGuiada, PaginaPainel, TabelaDados } from "@/components/painel";
import { Recolhido } from "@/components/observatorios/Recolhido";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { CabecalhoVarejo, FechoDoMetodo, FONTE_PAC, FONTE_PMC, LINK, LinhaFonte, numeroDeVariacao } from "@/components/varejo/comum";
import { ExportarRecorte } from "@/components/varejo/ExportarRecorte";
import { BarrasRotuladas } from "@/components/varejo/figuras/BarrasRotuladas";
import { COR_RECEITA, COR_VOLUME, corDoPasso, limiteSimetrico, passoDivergente } from "@/components/varejo/figuras/escala";
import { Halteres } from "@/components/varejo/figuras/Halteres";
import { MapaBlocos } from "@/components/varejo/figuras/MapaBlocos";
import { Prateleira } from "@/components/varejo/figuras/Prateleira";
import { BarraDePartes } from "@/components/varejo/figuras/Proporcoes";
import { Tesoura } from "@/components/varejo/figuras/Tesoura";
import { MapaEstados } from "@/components/varejo/MapaEstados";
import { MiniTrajetoria } from "@/components/varejo/MiniTrajetoria";
import { SegmentoCurado, SegmentoEmApuracao } from "@/components/varejo/SegmentoCurado";
import { SelectUrl } from "@/components/varejo/SelectUrl";
import { SeletorUrl } from "@/components/varejo/SeletorUrl";
import { FRESCOR_DAS_COLECOES } from "@/lib/frescor/entradas";
import { tituloNaColecao } from "@/lib/observatorios/contexto";
import { hrefComRecorte, parametro, parametroEntre, type ParametrosPagina } from "@/lib/painel/recorte";
import type { NumeroProps } from "@/lib/painel/tipos";
import {
  atividadesDaUf,
  contraBrasil,
  curadoria,
  goldEmpresas,
  leituraBrasil,
  DEF_MEDIDA,
  etiquetasDeSegmento,
  fimDaTesoura,
  formasDeComercializacao,
  goldSetor,
  halteres,
  indicadorDoSegmento,
  INDICADORES,
  inicioDoPeriodo,
  linhasAtividades,
  linhasUf,
  MEDIDAS,
  NOME_INDICADOR,
  NOME_PERIODO,
  NOME_UNIVERSO,
  ordenarPor,
  PERIODOS,
  segmentosDaAtividade,
  selecaoDeSegmento,
  serieBrasil,
  serieDoBloco,
  taxaDeMargemDoSegmento,
  tesoura,
  trajetoria,
  ufValida,
  ultimoIndice,
  UNIVERSOS,
  type Medida,
  type Periodo,
} from "@/lib/varejo/dados";
import { bilhoes, direcao, mesCurto, mesExtenso, num, pct, plural, pontos, reais, variacao } from "@/lib/varejo/formato";
import { emUf, hrefDownload, NOME_CURTO_ATIVIDADE, paginaVarejo, ROTA_BRASIL, ROTA_SEGMENTOS, UFS } from "@/lib/varejo/paginas";
import { provVarejo } from "@/lib/varejo/proveniencia";
import { hrefComRecorte as hrefCom } from "@/lib/painel/recorte";
import { hrefFicha, ROTA_COMPARADOR, ROTA_GRUPOS } from "@/lib/varejo/grupos";
import type { Indicador, Universo } from "@/lib/varejo/tipos";

/**
 * "Onde a média esconde diferenças?" (coleção Varejo, com conta): as atividades da Pesquisa Mensal de Comércio em halteres (real
 * contra nominal, com o Brasil como referência), a prateleira de segmentos da curadoria e a ficha visual do segmento aberto
 * (`?segmento=`), os estados num mapa de blocos e em lista ordenada, a trajetória de um estado contra a do Brasil com a área de
 * diferença (`?uf=`) e o comércio eletrônico como parte das formas de venda. Figuras em src/components/varejo/figuras. O recorte vive na URL e o servidor desenha a página nele.
 * A curadoria chega por public/varejo/gold/curadoria.json; enquanto um segmento não chega, a página diz "em apuração".
 */
export const dynamic = "force-dynamic";

const pagina = paginaVarejo("segmentos");
const indicadorVolume = "volume" as const;
const PADRAO = { medida: "m12", universo: "restrito", indicador: "volume", periodo: "5a" } as const;

type Busca = { searchParams: ParametrosPagina };

export function generateMetadata(): Metadata {
  return {
    title: tituloNaColecao(pagina.pergunta, ROTA_SEGMENTOS),
    description: "As atividades do varejo na pesquisa mensal do IBGE, com crescimento real e nominal e a trajetória recente, os 27 estados no mapa e em lista, e o comércio eletrônico entre as formas de venda.",
    alternates: { canonical: ROTA_SEGMENTOS },
  };
}

export default function PaginaSegmentos({ searchParams }: Busca) {
  const g = goldSetor();
  const c = curadoria();
  const medida = parametroEntre<Medida>(searchParams, "medida", MEDIDAS, PADRAO.medida);
  const universo = parametroEntre<Universo>(searchParams, "universo", UNIVERSOS, PADRAO.universo);
  const indicador = parametroEntre<Indicador>(searchParams, "indicador", INDICADORES, PADRAO.indicador);
  const periodo = parametroEntre<Periodo>(searchParams, "periodo", PERIODOS, PADRAO.periodo);
  const uf = ufValida(parametro(searchParams, "uf"), g);
  const sel = selecaoDeSegmento(g, c, parametro(searchParams, "segmento"));
  const segmentoNaUrl = sel.segmento?.slug ?? sel.atividade;
  const recorte = { medida, universo, indicador, periodo, segmento: segmentoNaUrl, uf };
  const h = (mudanca: Partial<Record<keyof typeof recorte, string | null>>) => hrefComRecorte(ROTA_SEGMENTOS, { ...recorte, ...mudanca }, PADRAO);
  const foraDoPadrao = h({}) !== ROTA_SEGMENTOS;

  const def = DEF_MEDIDA[medida];
  const ult = ultimoIndice(g);
  const mes = g.pmc.meses[ult];
  const quando = medida === "m12" ? `até ${mesExtenso(mes)}` : mesExtenso(mes);
  const nomeU = NOME_UNIVERSO[universo];
  const nomeInd = NOME_INDICADOR[indicador];
  const inicio = g.pmc.meses[inicioDoPeriodo(g, periodo)];
  const periodoTexto = `${mesCurto(inicio)} a ${mesCurto(mes)}`;

  // ---------------------------------------------------------------- atividades
  const linhas = linhasAtividades(g, medida);
  const principais = linhas.filter((l) => l.universo !== "detalhe");
  const ordenadas = ordenarPor(principais.map((l) => ({ ...l, nome: l.nomeCurto })), (l) => l.volume);
  const comVolume = ordenadas.filter((l) => l.volume !== null);
  const emAlta = principais.filter((l) => direcao(l.volume) === "alta").length;
  const maior = comVolume[0] ?? null;
  const menor = comVolume[comVolume.length - 1] ?? null;
  const universoDe = (l: (typeof linhas)[number]) =>
    l.universo === "detalhe" ? `parte de ${(NOME_CURTO_ATIVIDADE[l.parteDe ?? ""] ?? l.parteDe ?? "").toLowerCase()}` : l.universo === "restrito" ? "restrito e ampliado" : "só ampliado";
  // a diferença de cada atividade contra o varejo do Brasil, na mesma medida e no mesmo mês, pelo mesmo seletor da tabela e do CSV
  const contra = linhas.map((l) => contraBrasil(g, l, medida));
  const brRestrito = leituraBrasil(g, "restrito")[indicadorVolume][medida];
  const brAmpliado = leituraBrasil(g, "ampliado")[indicadorVolume][medida];
  const maisDistante = linhas
    .map((l, k) => ({ l, d: contra[k] }))
    .filter((x) => x.l.universo !== "detalhe" && x.d.volume !== null)
    .sort((a, b) => Math.abs(b.d.volume as number) - Math.abs(a.d.volume as number))[0] ?? null;

  // ---------------------------------------------------------------- segmento escolhido
  const atividade = sel.atividade ? g.pmc.atividades[sel.atividade] : null;
  const nomeAtividade = sel.atividade ? NOME_CURTO_ATIVIDADE[sel.atividade] ?? atividade?.nome ?? "" : "";
  const curados = sel.segmento ? [sel.segmento] : sel.atividade ? segmentosDaAtividade(c, sel.atividade) : [];
  const serieAtividade = atividade ? serieDoBloco(g, atividade, medida, periodo) : [];
  const ultAtividade = serieAtividade[serieAtividade.length - 1];

  // ---------------------------------------------------------------- estados
  const ufs = ordenarPor(linhasUf(g, universo, medida), (l) => l[indicador]);
  const ufsComValor = ufs.filter((l) => l[indicador] !== null);
  const ufsEmAlta = ufs.filter((l) => direcao(l[indicador]) === "alta").length;
  const primeira = ufsComValor[0] ?? null;
  const ultima = ufsComValor[ufsComValor.length - 1] ?? null;
  const brasil = serieBrasil(g, universo, medida, periodo);
  const ultBrasil = brasil[brasil.length - 1];
  const serieUf = uf ? serieDoBloco(g, g.pmc.ufs[uf][universo], medida, periodo) : [];
  const ultUf = serieUf[serieUf.length - 1];
  const pacUf = uf ? g.pac.ufs_varejo[uf] : null;
  // o total do estado no mês em que a pesquisa traz as atividades por UF, contra o mesmo mês do ano anterior: a referência dos halteres do estado
  const totalUfAa = uf ? serieDoBloco(g, g.pmc.ufs[uf][universo], "aa", "24m").find((p) => p.mes === g.pmc.ufs_atividades.mes) ?? null : null;
  const fonteU = universo === "restrito" ? "pmc_restrito" : "pmc_ampliado";

  // ---------------------------------------------------------------- figuras do redesenho
  const hs = halteres(g, medida);
  const gruposHaltere = (["restrito", "ampliado"] as const)
    .map((u) => ({ u, linhas: hs.filter((x) => x.referencia === u) }))
    .filter((x) => x.linhas.length > 0)
    .map(({ u, linhas: ls }) => ({
      titulo: u === "restrito" ? "Atividades do varejo restrito" : "Só no varejo ampliado",
      referencia: { nome: `${NOME_UNIVERSO[u]} no Brasil`, volume: ls[0].brasilVolume },
      linhas: ls.map((x) => ({ id: x.slug, nome: x.nomeCurto, volume: x.volume, receita: x.receita, contra: x.contraVolume, href: `${h({ segmento: x.slug })}#segmento`, selecionado: sel.atividade === x.slug })),
    }));
  const etiquetas = etiquetasDeSegmento(g, c, medida);
  const limiteUf = limiteSimetrico(ufs.map((l) => l[indicador]));
  // a tesoura do segmento: em índice quando o IBGE publica a série com ajuste sazonal da atividade; senão, as duas variações
  const tesouraAtividade = atividade ? tesoura(g, atividade, periodo) : [];
  const fimTesouraAtividade = fimDaTesoura(tesouraAtividade);
  const e = goldEmpresas();

  // ---------------------------------------------------------------- comércio eletrônico
  const formas = formasDeComercializacao(g);
  const internet = formas.find((f) => f.forma === "Internet") ?? null;
  const lojas = formas[0] ?? null;
  const totalFormas = formas.reduce((s, f) => s + (f.valor ?? 0), 0);
  const ano = String(g.pac.ano);

  // vínculo setor ↔ empresa: o concorrente com ficha leva à ficha; a companhia aberta sem ficha, ao comparador
  const empresas = e.empresas;
  const hrefConcorrente = (slug: string | null | undefined): string | null =>
    !slug ? null : c.fichas[slug] ? hrefFicha(slug) : empresas[slug] ? hrefCom(ROTA_COMPARADOR, { e: slug }) : null;

  const numeroTexto = (rotulo: string, valor: string, unidade: string, periodoN: string, recorteN?: string): NumeroProps => ({
    rotulo, formato: "texto", valorTexto: valor, unidade, periodo: periodoN, recorte: recorteN, fonte: FONTE_PMC, natureza: "CALCULADO", tamanho: "g",
  });

  return (
    <>
      <MarcaVisita secao={pagina.secao} />
      <CabecalhoVarejo rota={ROTA_SEGMENTOS} />
      <PaginaPainel
        rota={ROTA_SEGMENTOS}
        abertura={{
          grupo: "Segmentos e estados",
          acento: "gas",
          titulo: pagina.pergunta,
          lead: "O resultado do varejo é uma média. Por baixo dela, farmácias, supermercados, lojas de móveis e postos andam em ritmos diferentes, e os estados também. Escolha uma atividade ou um estado para abrir o detalhe.",
          recorte: { periodo: `até ${mesExtenso(mes)}`, universo: `Brasil e 27 unidades da federação, ${num(principais.length)} atividades`, unidade: "variação em %", fonte: `${FONTE_PMC} e Pesquisa Anual de Comércio` },
          limite: "qual atividade ou estado puxou o resultado do país. O IBGE não publica no SIDRA o peso de cada um, e variação maior não quer dizer contribuição maior.",
        }}
        rotuloNumeros={`Atividades e estados, variação ${def.curto}, ${quando}`}
        numeros={[
          numeroTexto("Atividades com volume em alta", `${num(emAlta)} de ${num(principais.length)}`, "atividades", quando, `variação ${def.curto}`),
          maior
            ? numeroDeVariacao({ rotulo: "Maior variação do volume entre as atividades", unidade: def.curto, periodo: quando, recorte: maior.nomeCurto, fonte: FONTE_PMC, tamanho: "g" }, maior.volume)
            : numeroDeVariacao({ rotulo: "Maior variação do volume entre as atividades", unidade: def.curto, periodo: quando, fonte: FONTE_PMC }, null),
          menor
            ? numeroDeVariacao({ rotulo: "Menor variação do volume entre as atividades", unidade: def.curto, periodo: quando, recorte: menor.nomeCurto, fonte: FONTE_PMC, tamanho: "g" }, menor.volume)
            : numeroDeVariacao({ rotulo: "Menor variação do volume entre as atividades", unidade: def.curto, periodo: quando, fonte: FONTE_PMC }, null),
          numeroTexto(`Estados com ${indicador === "volume" ? "volume" : "receita"} em alta`, `${num(ufsEmAlta)} de ${num(ufsComValor.length)}`, "estados", quando, `${nomeU.toLowerCase()}, ${def.curto}`),
        ]}
        notaNumeros={`Variação ${def.base}. Maior e menor variação não são maior e menor contribuição: os pesos das atividades não são publicados.`}
        figuras={
          <>
            <Controles rotulo="Medida das atividades e dos estados" idioma="pt" resumo={<>Mostrando: variação {def.base}, {quando}.</>} limpar={foraDoPadrao ? { href: ROTA_SEGMENTOS } : undefined}>
              <SeletorUrl id="sel-medida" rotulo="Variação" atual={medida} opcoes={MEDIDAS.map((m) => ({ valor: m, rotulo: DEF_MEDIDA[m].rotulo, href: h({ medida: m }) }))} />
            </Controles>

            <FiguraAnalitica
              id="atividades"
              pergunta="Quais atividades cresceram, e em quais foi só preço?"
              subtitulo={`${num(principais.length)} atividades da pesquisa mensal · volume e receita nominal · variação em %, ${def.base} · Brasil · ${quando}`}
              natureza="OBSERVADO"
              proveniencia={provVarejo(g, "pmc_atividades", {
                indicador: "Volume de vendas e receita nominal por atividade do varejo", natureza: "OBSERVADO", unidade: `variação em %, ${def.base}`, frequencia: "mensal", inicio: mes, fim: mes,
                limitacoes: [g.notas.pmc_pesos, g.notas.pmc_base], download: hrefDownload("atividades.csv"),
              })}
              leitura={
                <LeituraGuiada>
                  {maior && menor ? (
                    <>
                      {quando.charAt(0).toUpperCase() + quando.slice(1)}, o volume foi de {variacao(maior.volume)} em {maior.nomeCurto.toLowerCase()} a {variacao(menor.volume)} em {menor.nomeCurto.toLowerCase()}, {def.base}. Das{" "}
                      {num(principais.length)} atividades, {num(emAlta)} {plural(emAlta, "teve", "tiveram")} alta no volume.
                      {maisDistante && (
                        <>
                          {" "}
                          A que mais se afastou do Brasil foi {maisDistante.l.nomeCurto.toLowerCase()}: {pontos(maisDistante.d.volume)} em relação ao {NOME_UNIVERSO[maisDistante.d.universo].toLowerCase()}.
                        </>
                      )}
                    </>
                  ) : (
                    <>O IBGE não publicou as variações por atividade para este mês.</>
                  )}
                </LeituraGuiada>
              }
              comoInterpretar="Crescimento real é o do volume, já descontados os preços. Crescimento nominal é o da receita em reais. Quando o losango da receita fica longe do círculo do volume, a diferença veio sobretudo de preço. A linha vertical é o varejo do Brasil."
              naoConcluir="quanto cada atividade pesou no resultado do varejo: a pesquisa não publica os pesos no SIDRA, e uma atividade pequena pode variar muito sem mover a média."
              tabela={{ naFigura: "A tabela das atividades vem logo abaixo, recolhida, com os mesmos valores, as subdivisões, a trajetória recente de cada uma e o link que abre o segmento." }}
              complemento={
                <>
                  <TabelaDados
                    idioma="pt"
                    titulo={`Atividades do varejo: crescimento real e nominal, variação ${def.curto}, ${quando}`}
                    colunas={["Atividade", "Crescimento real (volume), %", "Volume: diferença contra o Brasil, p.p.", "Comparada com", "Crescimento nominal (receita), %", "Receita menos volume, p.p.", "Volume nos últimos 24 meses", "Universo", "Peso ou contribuição"]}
                    linhas={linhas.map((l, k) => [
                      l.nomeCurto,
                      l.volume,
                      contra[k].volume,
                      NOME_UNIVERSO[contra[k].universo].toLowerCase(),
                      l.receita,
                      l.diferenca,
                      <MiniTrajetoria key={l.slug} nome={l.nomeCurto} pontos={trajetoria(g, g.pmc.atividades[l.slug], "volume")} />,
                      universoDe(l),
                      "não publicado no SIDRA",
                    ])}
                    casas={[null, 1, 1, null, 1, 1, null, null, null]}
                    limite={linhas.length}
                    links={{ Atividade: linhas.map((l) => `${h({ segmento: l.slug })}#segmento`) }}
                    linhasDestacadas={sel.atividade ? [linhas.findIndex((l) => l.slug === sel.atividade)] : []}
                    fixarPrimeiraColuna
                    csv={hrefDownload("atividades.csv")}
                    nota={`Diferença contra o Brasil: variação do volume da atividade menos a do varejo a que ela pertence, na mesma medida e no mesmo mês (varejo restrito: ${variacao(brRestrito)}; varejo ampliado: ${variacao(brAmpliado)}, para as atividades que só entram nele). Toque no nome de uma atividade para abrir o segmento. A trajetória é o índice de volume com ajuste sazonal, cada linha na própria escala: mostra a forma do movimento, não compara níveis entre atividades.`}
                  />
                  <ExportarRecorte
                    nome={`varejo-atividades-${medida}-${mes}`}
                    colunas={["atividade", "nome", "universo", "volume_pct", "receita_nominal_pct", "receita_menos_volume_pp", "comparada_com", "volume_menos_brasil_pp", "receita_menos_brasil_pp", "peso_ou_contribuicao"]}
                    linhas={linhas.map((l, k) => [l.slug, l.nomeCurto, universoDe(l), l.volume, l.receita, l.diferenca, NOME_UNIVERSO[contra[k].universo].toLowerCase(), contra[k].volume, contra[k].receita, "não publicado no SIDRA"])}
                    recorte={`Brasil, variação ${def.base}, ${quando}`}
                    fonte={`${g.fontes.pmc_atividades.orgao}, ${g.fontes.pmc_atividades.tabela}`}
                  />
                </>
              }
              depois={
                etiquetas.length > 0 ? (
                  <div data-prateleira-de-segmentos="">
                    <h3 className="t-h3 text-carvao">A prateleira de segmentos</h3>
                    <p className="t-meta mt-1 max-w-prose2 text-carvao-muted">
                      Os segmentos como o mercado os agrupa, cada um com a variação do volume da atividade do IBGE mais próxima ({def.curto}, {quando}) e a trajetória dos últimos 24 meses. Toque numa etiqueta para abrir a ficha do segmento.
                    </p>
                    <div className="mt-4">
                      <Prateleira
                        rotulo="Segmentos do varejo"
                        etiquetas={etiquetas.map((x) => ({
                          id: x.slug,
                          nome: x.nome.split(":")[0],
                          descricao: x.vende,
                          valor: x.volume,
                          medida: `volume, ${def.curto}`,
                          estado: x.atividade ? "sem valor publicado para o período" : "sem atividade equivalente na pesquisa mensal",
                          serie: x.trajetoria.map((p) => p.valor),
                          href: `${h({ segmento: x.slug })}#segmento`,
                          selecionado: sel.segmento?.slug === x.slug || (!sel.segmento && x.atividade !== null && x.atividade === sel.atividade),
                        }))}
                      />
                    </div>
                  </div>
                ) : undefined
              }
            >
              <Halteres grupos={gruposHaltere} medida={def.curto} />
            </FiguraAnalitica>

            {atividade && (
              <FiguraAnalitica
                id="segmento"
                pergunta={`${nomeAtividade}: como evoluíram as vendas?`}
                subtitulo={fimTesouraAtividade ? `${atividade.nome} · receita nominal e volume · índice com ajuste sazonal, ${mesCurto(inicio)} = 100 · Brasil · ${periodoTexto}` : `${atividade.nome} · volume e receita nominal · variação em %, ${def.base} · Brasil · ${periodoTexto}`}
                natureza={fimTesouraAtividade ? "CALCULADO" : "OBSERVADO"}
                proveniencia={provVarejo(g, "pmc_atividades", {
                  indicador: `Volume de vendas e receita nominal, ${atividade.nome}`, natureza: "OBSERVADO", unidade: `variação em %, ${def.base}`, frequencia: "mensal", inicio, fim: mes,
                  limitacoes: [g.notas.pmc_pesos], download: hrefDownload("atividades.csv"),
                })}
                leitura={
                  ultAtividade ? (
                    <LeituraGuiada>
                      {fimTesouraAtividade && (
                        <>
                          De {mesExtenso(inicio)} a {mesExtenso(fimTesouraAtividade.mes)}, a receita em reais de {nomeAtividade.toLowerCase()} variou {variacao((fimTesouraAtividade.receita as number) - 100)} e o volume vendido,{" "}
                          {variacao((fimTesouraAtividade.volume as number) - 100)}.{" "}
                        </>
                      )}
                      Em {mesExtenso(ultAtividade.mes)}, o volume de {nomeAtividade.toLowerCase()} variou {variacao(ultAtividade.volume)} e a receita nominal, {variacao(ultAtividade.receita)}, {def.base}.
                      {atividade.universo === "ampliado" && " Esta atividade só entra no varejo ampliado."}
                      {atividade.universo === "detalhe" && ` Esta atividade é parte de ${(NOME_CURTO_ATIVIDADE[atividade.parte_de ?? ""] ?? "").toLowerCase()}.`}
                    </LeituraGuiada>
                  ) : undefined
                }
                naoConcluir="que as companhias do segmento tiveram esse desempenho: a pesquisa mede todas as empresas da atividade, grandes e pequenas, e a correspondência entre a atividade do IBGE e o segmento empresarial quase nunca é exata."
                tabela={{
                  titulo: `${nomeAtividade}: volume e receita nominal, variação ${def.curto}${fimTesouraAtividade ? ` e índice com ${mesCurto(inicio)} = 100` : ""}`,
                  colunas: ["Mês", "Volume, %", "Receita nominal, %", "Receita menos volume, p.p.", ...(fimTesouraAtividade ? ["Receita nominal, índice", "Volume, índice"] : [])],
                  linhas: serieAtividade.map((p, k) => [mesCurto(p.mes), p.volume, p.receita, p.diferenca, ...(fimTesouraAtividade ? [tesouraAtividade[k]?.receita ?? null, tesouraAtividade[k]?.volume ?? null] : [])]),
                  casas: [null, 1, 1, 1, 1, 1],
                  limite: 24,
                  csv: hrefDownload("atividades.csv"),
                }}
                depois={
                  <>
                    <div className="space-y-8" data-curadoria-segmento="">
                      <h3 className="t-h3 text-carvao">Como funciona este negócio</h3>
                      {curados.length > 0 ? curados.map((s) => <SegmentoCurado key={s.slug} s={s} hrefDe={hrefConcorrente} indicador={indicadorDoSegmento(s, g, e, c)} margem={taxaDeMargemDoSegmento(s, g)} />) : <SegmentoEmApuracao atividade={nomeAtividade} />}
                    </div>
                    <p className="t-meta text-carvao-muted">
                      <Link href={`${h({ segmento: null })}#atividades`} prefetch={false} className={LINK}>
                        Fechar o segmento e voltar às atividades
                      </Link>
                    </p>
                  </>
                }
              >
                <div className="mb-4">
                  <SeletorUrl id="sel-periodo-seg" rotulo="Período" atual={periodo} opcoes={PERIODOS.map((p) => ({ valor: p, rotulo: NOME_PERIODO[p], href: h({ periodo: p }) }))} />
                </div>
                {fimTesouraAtividade ? (
                  <Tesoura
                    titulo={`${nomeAtividade}: receita nominal e volume de vendas em índice, ${mesCurto(inicio)} = 100`}
                    meses={tesouraAtividade.map((p) => p.mes)}
                    a={{ rotulo: "Receita nominal", valores: tesouraAtividade.map((p) => p.receita), cor: COR_RECEITA, espessura: 2 }}
                    b={{ rotulo: "Volume de vendas", valores: tesouraAtividade.map((p) => p.volume), cor: COR_VOLUME, espessura: 2.5 }}
                    formato="indice"
                    base={100}
                    rotuloBase={`${mesCurto(inicio)} = 100`}
                    rotuloArea="Diferença: aproxima o efeito dos preços"
                    rotuloAreaAbaixo="Volume acima da receita"
                    corArea="var(--escala-varejo-neg-1)"
                    corAreaAbaixo="var(--escala-varejo-pos-1)"
                    altura={320}
                  />
                ) : (
                  <Tesoura
                    titulo={`${nomeAtividade}: volume de vendas e receita nominal, variação ${def.curto}`}
                    meses={serieAtividade.map((p) => p.mes)}
                    a={{ rotulo: "Receita nominal", valores: serieAtividade.map((p) => p.receita), cor: COR_RECEITA, espessura: 2 }}
                    b={{ rotulo: "Volume de vendas", valores: serieAtividade.map((p) => p.volume), cor: COR_VOLUME, espessura: 2.5 }}
                    formato="variacao"
                    base={0}
                    rotuloArea="Receita acima do volume"
                    rotuloAreaAbaixo="Volume acima da receita"
                    corArea="var(--escala-varejo-neg-1)"
                    corAreaAbaixo="var(--escala-varejo-pos-1)"
                    altura={320}
                  />
                )}
              </FiguraAnalitica>
            )}

            {!atividade && sel.segmento && (
              <Recolhido id="segmento" aberto nivelTitulo={2} titulo={sel.segmento.nome} resumo="Segmento empresarial sem atividade equivalente na pesquisa mensal: descrição da curadoria, sem série do IBGE.">
                <SegmentoCurado s={sel.segmento} hrefDe={hrefConcorrente} indicador={indicadorDoSegmento(sel.segmento, g, e, c)} margem={taxaDeMargemDoSegmento(sel.segmento, g)} />
                <p className="t-meta mt-6 text-carvao-muted">
                  <Link href={`${h({ segmento: null })}#atividades`} prefetch={false} className={LINK}>
                    Fechar o segmento e voltar às atividades
                  </Link>
                </p>
              </Recolhido>
            )}

            <Controles
              rotulo="Recorte dos estados"
              idioma="pt"
              resumo={<>Mostrando: {nomeInd.toLowerCase()} do {nomeU.toLowerCase()}, variação {def.curto}, {quando}{uf ? `; estado aberto: ${UFS[uf].nome}` : ""}.</>}
            >
              <SeletorUrl id="sel-universo" rotulo="Universo" atual={universo} opcoes={UNIVERSOS.map((u) => ({ valor: u, rotulo: NOME_UNIVERSO[u], href: h({ universo: u }) }))} />
              <SeletorUrl id="sel-indicador" rotulo="Indicador" atual={indicador} opcoes={INDICADORES.map((i) => ({ valor: i, rotulo: NOME_INDICADOR[i], href: h({ indicador: i }) }))} />
              <SelectUrl
                id="sel-uf"
                rotulo="Abrir um estado"
                nome="uf"
                base={ROTA_SEGMENTOS}
                outros={Object.fromEntries(Object.entries({ medida, universo, indicador, periodo, segmento: segmentoNaUrl ?? "" }).filter(([k, x]) => x && x !== (PADRAO as Record<string, string>)[k]))}
                atual={uf ?? ""}
                opcoes={[{ valor: "", rotulo: "Nenhum estado", href: h({ uf: null }) }, ...Object.entries(UFS).sort((a, b) => a[1].nome.localeCompare(b[1].nome, "pt-BR")).map(([sg, u]) => ({ valor: sg, rotulo: u.nome, href: h({ uf: sg }) }))]}
              />
            </Controles>

            <FiguraAnalitica
              id="estados"
              pergunta="Em que estados as vendas cresceram mais?"
              subtitulo={`${nomeU} · ${nomeInd.toLowerCase()} · variação em %, ${def.base} · 27 unidades da federação · ${quando}`}
              natureza="OBSERVADO"
              proveniencia={provVarejo(g, fonteU, {
                indicador: `${nomeInd} do ${nomeU.toLowerCase()} por unidade da federação`, natureza: "OBSERVADO", unidade: `variação em %, ${def.base}`, frequencia: "mensal", inicio: mes, fim: mes,
                limitacoes: ["Por estado, a pesquisa divulga a série inteira só para o total do varejo restrito e do ampliado; as atividades por estado saem apenas com as variações do mês mais recente."], download: hrefDownload("ufs.csv"),
              })}
              leitura={
                <LeituraGuiada>
                  {primeira && ultima ? (
                    <>
                      {quando.charAt(0).toUpperCase() + quando.slice(1)}, {indicador === "volume" ? "o volume" : "a receita nominal"} do {nomeU.toLowerCase()} foi de {variacao(primeira[indicador])} {emUf(primeira.uf)} a{" "}
                      {variacao(ultima[indicador])} {emUf(ultima.uf)}; no Brasil, {variacao(ultBrasil?.[indicador])}. {num(ufsEmAlta)} de {num(ufsComValor.length)} estados tiveram alta.
                    </>
                  ) : (
                    <>O IBGE não publicou as variações por estado para este recorte.</>
                  )}
                </LeituraGuiada>
              }
              comoInterpretar="A cor de cada bloco parte do zero: azul para alta, sépia para queda, mais escura quanto maior a variação. Mostra tamanho e sentido da variação, não um limite entre bom e ruim. A lista ao lado traz os mesmos valores em ordem."
              naoConcluir="que um estado com variação maior vende mais: a variação parte da base de cada estado, e estados com comércio pequeno oscilam mais de um mês para o outro."
              tabela={{
                titulo: `${nomeU} por estado, variação ${def.curto}, ${quando}`,
                colunas: ["Estado", "Volume, %", "Receita nominal, %", "Receita menos volume, p.p.", `Receita bruta de revenda em ${ano}, R$ bilhões`, `Empresas em ${ano}`],
                linhas: ufs.map((l) => [`${l.nome} (${l.uf})`, l.volume, l.receita, l.diferenca, g.pac.ufs_varejo[l.uf]?.receita_bruta_revenda == null ? null : g.pac.ufs_varejo[l.uf].receita_bruta_revenda! / 1e6, g.pac.ufs_varejo[l.uf]?.empresas ?? null]),
                casas: [null, 1, 1, 1, 1, 0],
                limite: ufs.length,
                csv: hrefDownload("ufs.csv"),
              }}
            >
              <div className="grid gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,30rem)_minmax(0,1fr)]">
                <div className="min-w-0">
                  <MapaBlocos
                    titulo={`${nomeInd} do ${nomeU.toLowerCase()} por unidade da federação, variação ${def.curto}, ${quando}`}
                    blocos={ufs.map((l) => ({ uf: l.uf, nome: l.nome, valor: l[indicador], href: `${h({ uf: l.uf })}#estado` }))}
                    limite={limiteUf}
                    selecionado={uf}
                  />
                  <p className="t-meta mt-3 max-w-[30rem] text-carvao-muted">Cada bloco é um estado, na posição aproximada dele no país e todos do mesmo tamanho. Toque num bloco para abrir a trajetória do estado contra a do Brasil.</p>
                </div>
                <div className="min-w-0">
                  <h3 className="rotulo text-mineral">Da maior para a menor variação</h3>
                  <div className="mt-2">
                    <BarrasRotuladas
                      titulo={`${nomeInd} do ${nomeU.toLowerCase()} por estado, da maior para a menor variação`}
                      larguraDoNome="10.5rem"
                      limiteInicial={14}
                      rotuloMais={`Ver os ${num(ufs.length)} estados`}
                      linhas={[
                        ...ufs.map((l) => {
                          const passo = passoDivergente(l[indicador], limiteUf);
                          return { id: l.uf, nome: `${l.nome} (${l.uf})`, valor: l[indicador], texto: variacao(l[indicador]), cor: passo ? corDoPasso(passo === "centro" ? "pos-1" : passo) : undefined, href: `${h({ uf: l.uf })}#estado`, selecionado: uf === l.uf };
                        }),
                      ]}
                    />
                  </div>
                  <p className="t-meta mt-2 text-carvao-muted">
                    Brasil: <span className="tabular-nums text-carvao">{variacao(ultBrasil?.[indicador])}</span>.
                  </p>
                </div>
              </div>
              <details className="group/malha mt-6 border-t border-linha" data-mapa-legado="">
                <summary className="flex min-h-[44px] cursor-pointer items-center text-sm text-carvao-muted hover:text-carvao">
                  <span className="group-open/malha:hidden">Ver no mapa com a malha do IBGE</span>
                  <span className="hidden group-open/malha:inline">Fechar o mapa com a malha do IBGE</span>
                </summary>
                <div className="max-w-2xl pb-4">
                  <MapaEstados
                    titulo={`${nomeInd} do ${nomeU.toLowerCase()} por unidade da federação`}
                    valores={Object.fromEntries(ufs.map((l) => [l.cod, l[indicador]]))}
                    unidade="%"
                    periodo={quando}
                    nota={`Variação ${def.base}. Neste mapa as cores dividem os estados em cinco grupos de tamanho parecido, do menor ao maior valor; no mapa de blocos, a cor parte do zero. Toque num estado para abrir a trajetória dele.`}
                    selecionado={uf ? UFS[uf].cod : null}
                    hrefs={{ "": h({ uf: null }), ...Object.fromEntries(Object.entries(UFS).map(([sg, u]) => [u.cod, h({ uf: sg })])) }}
                  />
                </div>
              </details>
              <div className="mt-4">
                <ExportarRecorte
                  nome={`varejo-estados-${universo}-${medida}-${mes}`}
                  colunas={["uf", "nome", "volume_pct", "receita_nominal_pct", "receita_menos_volume_pp"]}
                  linhas={ufs.map((l) => [l.uf, l.nome, l.volume, l.receita, l.diferenca])}
                  recorte={`${nomeU}, variação ${def.base}, ${quando}`}
                  fonte={`${g.fontes[fonteU].orgao}, ${g.fontes[fonteU].tabela}`}
                />
              </div>
            </FiguraAnalitica>

            {uf && (
              <FiguraAnalitica
                id="estado"
                pergunta={`${UFS[uf].nome}: acima ou abaixo do Brasil?`}
                subtitulo={`${nomeU} · ${nomeInd.toLowerCase()} · variação em %, ${def.base} · ${UFS[uf].nome} e Brasil · ${periodoTexto}`}
                natureza="OBSERVADO"
                proveniencia={provVarejo(g, fonteU, { indicador: `${nomeInd} do ${nomeU.toLowerCase()}, ${UFS[uf].nome} e Brasil`, natureza: "OBSERVADO", unidade: `variação em %, ${def.base}`, frequencia: "mensal", inicio, fim: mes, download: hrefDownload("ufs.csv") })}
                complementares={[{ rotulo: "Sobre a pesquisa anual por estado", p: provVarejo(g, "pac_uf", { indicador: "Comércio varejista por unidade da federação", natureza: "OBSERVADO", unidade: "mil reais correntes, empresas e pessoas", frequencia: "anual", inicio: ano, fim: ano, limitacoes: [g.notas.pac] }) }]}
                leitura={
                  <LeituraGuiada>
                    Em {mesExtenso(mes)}, {indicador === "volume" ? "o volume" : "a receita nominal"} do {nomeU.toLowerCase()} variou {variacao(ultUf?.[indicador])} {emUf(uf)} e {variacao(ultBrasil?.[indicador])} no Brasil, {def.base}.
                    {pacUf?.receita_bruta_revenda != null && (
                      <> Na pesquisa anual de {ano}, o comércio varejista {UFS[uf].de} teve R$ {bilhoes(pacUf.receita_bruta_revenda)} bilhões de receita bruta de revenda, em {num(pacUf.empresas)} empresas com {num(pacUf.pessoal_ocupado)} pessoas ocupadas.</>
                    )}
                  </LeituraGuiada>
                }
                naoConcluir="por que o estado andou diferente do país. A comparação mostra o afastamento entre as duas linhas no mesmo período, não a causa dele."
                tabela={{
                  titulo: `${UFS[uf].nome} e Brasil: ${nomeInd.toLowerCase()}, variação ${def.curto}`,
                  colunas: ["Mês", `${UFS[uf].nome}, %`, "Brasil, %", "Diferença, p.p."],
                  linhas: serieUf.map((p, i) => {
                    const a = p[indicador];
                    const b = brasil[i]?.[indicador] ?? null;
                    return [mesCurto(p.mes), a, b, a === null || b === null ? null : Number((a - b).toFixed(1))];
                  }),
                  casas: [null, 1, 1, 1],
                  limite: 24,
                  csv: hrefDownload("ufs.csv"),
                }}
                complemento={
                  <div className="border-t border-linha pt-5" data-atividades-do-estado="">
                    <h3 className="t-h3 text-carvao">
                      Atividades em {UFS[uf].nome}, {mesExtenso(g.pmc.ufs_atividades.mes)}
                    </h3>
                    <p className="t-meta mt-1 max-w-prose2 text-carvao-muted">
                      Por estado, o IBGE divulga as atividades só com as variações do mês mais recente: não há série para desenhar. Aqui, a variação contra o mesmo mês do ano anterior; a linha vertical é o {nomeU.toLowerCase()} do estado.
                    </p>
                    <div className="mt-4">
                      <Halteres
                        medida="contra o mesmo mês do ano anterior"
                        rotuloReferencia={`Volume do ${nomeU.toLowerCase()} ${emUf(uf)}`}
                        rotuloContra="Volume contra o estado"
                        grupos={[
                          {
                            titulo: "Atividade",
                            referencia: { nome: `${nomeU} ${emUf(uf)}`, volume: totalUfAa?.volume ?? null },
                            linhas: ordenarPor(atividadesDaUf(g, uf).map((a) => ({ ...a, nome: a.nomeCurto })), (a) => a.volumeAa).map((a) => ({
                              id: `${uf}-${a.slug}`,
                              nome: a.nomeCurto,
                              volume: a.volumeAa,
                              receita: a.receitaAa,
                              contra: a.volumeAa === null || totalUfAa?.volume == null ? null : Number((a.volumeAa - totalUfAa.volume).toFixed(1)),
                            })),
                          },
                        ]}
                      />
                    </div>
                    <div className="mt-3">
                      <TabelaDados
                        idioma="pt"
                        id="estado-atividades"
                        titulo={`Atividades do varejo em ${UFS[uf].nome}, ${mesExtenso(g.pmc.ufs_atividades.mes)}`}
                        colunas={["Atividade", "Volume, interanual, %", "Volume, 12 meses, %", "Receita, interanual, %", "Receita, 12 meses, %"]}
                        linhas={atividadesDaUf(g, uf).map((a) => [a.nomeCurto, a.volumeAa, a.volumeM12, a.receitaAa, a.receitaM12])}
                        casas={[null, 1, 1, 1, 1]}
                        limite={20}
                        ausencia={Object.fromEntries(["Volume, interanual, %", "Volume, 12 meses, %", "Receita, interanual, %", "Receita, 12 meses, %"].map((k) => [k, "não publicado"]))}
                        fixarPrimeiraColuna
                      />
                    </div>
                  </div>
                }
                depois={
                  <p className="t-meta text-carvao-muted">
                    <Link href={`${h({ uf: null })}#estados`} prefetch={false} className={LINK}>
                      Fechar o estado e voltar ao mapa
                    </Link>
                  </p>
                }
              >
                <div className="mb-4">
                  <SeletorUrl id="sel-periodo" rotulo="Período" atual={periodo} opcoes={PERIODOS.map((p) => ({ valor: p, rotulo: NOME_PERIODO[p], href: h({ periodo: p }) }))} />
                </div>
                <Tesoura
                  titulo={`${nomeInd} do ${nomeU.toLowerCase()}, variação ${def.curto}: ${UFS[uf].nome} e Brasil`}
                  meses={serieUf.map((p) => p.mes)}
                  a={{ rotulo: UFS[uf].nome, valores: serieUf.map((p) => p[indicador]), cor: COR_VOLUME, espessura: 2.5 }}
                  b={{ rotulo: "Brasil", valores: serieUf.map((_, i) => brasil[i]?.[indicador] ?? null), cor: COR_RECEITA, espessura: 2 }}
                  formato="variacao"
                  base={0}
                  rotuloArea={`${UFS[uf].nome} acima do Brasil`}
                  rotuloAreaAbaixo={`${UFS[uf].nome} abaixo do Brasil`}
                  altura={320}
                />
              </FiguraAnalitica>
            )}

            <FiguraAnalitica
              id="ecommerce"
              pergunta="Quanto das vendas passa pela internet?"
              subtitulo={`Formas de comercialização do comércio varejista · receita bruta de revenda, R$ bilhões correntes de ${ano} · empresas com 20 ou mais pessoas ocupadas · Brasil · ${ano}`}
              natureza="OBSERVADO"
              proveniencia={provVarejo(g, "pac_formas", {
                indicador: "Receita bruta de revenda por forma de comercialização, comércio varejista", natureza: "OBSERVADO", unidade: `R$ bilhões correntes de ${ano}`, frequencia: "anual", inicio: ano, fim: ano,
                transformacoes: ["Parte de cada forma: valor da forma ÷ soma de todas as formas × 100"],
                limitacoes: ["Universo: empresas varejistas com 20 ou mais pessoas ocupadas; os pequenos lojistas ficam fora.", g.notas.pac],
              })}
              leitura={
                <LeituraGuiada>
                  Em {ano}, entre as varejistas com 20 ou mais pessoas ocupadas, a internet respondeu por R$ {bilhoes(internet?.valor)} bilhões de R$ {num(totalFormas / 1e6, 1)} bilhões de receita bruta de revenda:{" "}
                  {pct(internet?.parte)}. {lojas ? `${lojas.curto} ficaram com ${pct(lojas.parte)}.` : ""}
                </LeituraGuiada>
              }
              comoInterpretar="O comércio eletrônico não é um segmento, é um canal: a venda pela internet de uma farmácia conta em farmácia, a de uma rede de moda conta em vestuário. Por isso ele aparece aqui, entre as formas de venda, e não na tabela de atividades."
              ressalva="A medida vale para empresas com 20 ou mais pessoas ocupadas e para a revenda de mercadorias da própria empresa. Venda de terceiros intermediada por uma plataforma não entra como revenda dela, e o total inclui combustíveis, vendidos em postos."
              naoConcluir="que essa é a parte da internet em todo o varejo: os pequenos lojistas ficam fora do universo, e o ano é o da pesquisa anual, não o da conjuntura mais recente."
              tabela={{
                titulo: `Formas de comercialização do comércio varejista, ${ano}`,
                colunas: ["Forma de comercialização", "Receita bruta de revenda, R$ bilhões", "Parte do total, %"],
                linhas: formas.map((f) => [f.forma, f.valor === null ? null : f.valor / 1e6, f.parte]),
                casas: [null, 2, 2],
                limite: formas.length,
              }}
              depois={
                c.segmentos?.ecommerce?.texto ? (
                  <details className="max-w-prose2 border-t border-linha" data-curadoria-ecommerce="">
                    <summary className="rotulo flex min-h-[44px] cursor-pointer items-center text-carvao-muted hover:text-carvao">Nota da curadoria sobre o canal</summary>
                    <p className="t-meta pb-2 text-carvao-muted">{c.segmentos.ecommerce.texto}</p>
                  </details>
                ) : undefined
              }
            >
              <BarraDePartes
                titulo={`Receita bruta de revenda por forma de comercialização, ${ano}`}
                destaque="Internet"
                casas={2}
                partes={formas.map((f) => ({ id: f.forma, rotulo: f.curto, parte: f.parte, valor: f.valor === null ? undefined : reais(f.valor * 1e3, 1) }))}
              />
            </FiguraAnalitica>
          </>
        }
        notas={{
          id: "para-ler",
          itens: [
            { termo: "Atividade da pesquisa", definicao: "O grupo em que o IBGE classifica a empresa pelo que ela mais vende. Uma rede que vende de tudo entra numa atividade só." },
            { termo: "Crescimento real e nominal", definicao: "Real é o do volume, descontados os preços. Nominal é o da receita em reais, que sobe também quando os preços sobem." },
            { termo: "Peso ou contribuição", definicao: "Quanto cada atividade pesa no índice geral. O IBGE não publica esse peso no SIDRA; a página o mostra como não publicado, nunca como zero nem estimado." },
            { termo: "Segmento empresarial", definicao: "O recorte que o mercado usa para agrupar as redes (alimentar, farmácia, moda). Quase nunca coincide exatamente com a atividade do IBGE; a correspondência vem escrita em cada segmento." },
            { termo: "Varejo restrito e ampliado", definicao: "O ampliado soma ao restrito veículos e peças, material de construção e, desde janeiro de 2023, o atacado de alimentos, bebidas e fumo." },
          ],
          nota: (
            <>
              A série do Brasil, a diferença entre receita e volume e o tamanho do mercado estão em{" "}
              <Link href={ROTA_BRASIL} prefetch={false} className={LINK}>
                O que mudou nas vendas?
              </Link>{" "}
              Os maiores grupos de cada segmento, com as marcas e a ficha de cada um, estão em{" "}
              <Link href={ROTA_GRUPOS} prefetch={false} className={LINK}>
                {paginaVarejo("grupos").pergunta}
              </Link>
            </>
          ),
        }}
        metodo={
          <>
            <LinhaFonte f={g.fontes.pmc_atividades} periodo={`${mesCurto(g.pmc.meses[0])} a ${mesCurto(mes)}; por estado, só ${mesCurto(g.pmc.ufs_atividades.mes)}`} />
            <LinhaFonte f={g.fontes.pmc_restrito} periodo={`${mesCurto(g.pmc.meses[0])} a ${mesCurto(mes)}`} />
            <LinhaFonte f={g.fontes.pmc_ampliado} periodo={`${mesCurto(g.pmc.meses[0])} a ${mesCurto(mes)}`} />
            <LinhaFonte f={g.fontes.pac_formas} periodo={ano} />
            <LinhaFonte f={g.fontes.pac_uf} periodo={ano} />
            <p>
              A descrição de cada segmento empresarial é curadoria da Scrutiniums, escrita a partir de documentos públicos citados em cada texto; as explicações de causa dadas por empresas são atribuídas a elas. O mapa de blocos é um esquema, com
              os estados do mesmo tamanho e em posição aproximada; a malha do mapa alternativo é a oficial do IBGE, já usada na plataforma. Fonte das formas de comercialização: {FONTE_PAC} {ano}.
            </p>
            <FechoDoMetodo g={g} />
          </>
        }
        frescorMetodo={<FaixaFrescor dominios={FRESCOR_DAS_COLECOES["/varejo"]} variante="metodo" />}
      />
    </>
  );
}
