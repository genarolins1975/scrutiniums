import type { Metadata } from "next";
import Link from "next/link";
import { FaixaFrescor } from "@/components/frescor/FaixaFrescor";
import { Controles, FiguraAnalitica, GraficoBarras, GraficoLinhas, LeituraGuiada, PaginaPainel, TabelaDados } from "@/components/painel";
import { Recolhido } from "@/components/observatorios/Recolhido";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { CabecalhoVarejo, FechoDoMetodo, FONTE_PAC, FONTE_PMC, LINK, LinhaFonte, numeroDeVariacao } from "@/components/varejo/comum";
import { ExportarRecorte } from "@/components/varejo/ExportarRecorte";
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
  curadoria,
  goldEmpresas,
  DEF_MEDIDA,
  formasDeComercializacao,
  goldSetor,
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
  trajetoria,
  ufValida,
  ultimoIndice,
  UNIVERSOS,
  type Medida,
  type Periodo,
} from "@/lib/varejo/dados";
import { bilhoes, direcao, mesCurto, mesExtenso, num, pct, plural, variacao } from "@/lib/varejo/formato";
import { emUf, hrefDownload, NOME_CURTO_ATIVIDADE, paginaVarejo, ROTA_BRASIL, ROTA_SEGMENTOS, UFS } from "@/lib/varejo/paginas";
import { provVarejo } from "@/lib/varejo/proveniencia";
import { hrefComRecorte as hrefCom } from "@/lib/painel/recorte";
import { hrefFicha, ROTA_COMPARADOR, ROTA_GRUPOS } from "@/lib/varejo/grupos";
import type { Indicador, Universo } from "@/lib/varejo/tipos";

/**
 * "Onde a média esconde diferenças?" (coleção Varejo, com conta): as atividades da Pesquisa Mensal de Comércio lado a lado,
 * a abertura de um segmento com a curadoria (`?segmento=`), os estados no mapa e em lista ordenada, a trajetória de um estado
 * contra a do Brasil (`?uf=`) e o comércio eletrônico como canal. O recorte vive na URL e o servidor desenha a página nele.
 * A curadoria chega por public/varejo/gold/curadoria.json; enquanto um segmento não chega, a página diz "em apuração".
 */
export const dynamic = "force-dynamic";

const pagina = paginaVarejo("segmentos");
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
  const semEquivalencia = (c.segmentos?.segmentos ?? []).filter((s) => !(s.atividades_pmc ?? []).some((a) => g.pmc.atividades[a]));

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
  const fonteU = universo === "restrito" ? "pmc_restrito" : "pmc_ampliado";

  // ---------------------------------------------------------------- comércio eletrônico
  const formas = formasDeComercializacao(g);
  const internet = formas.find((f) => f.forma === "Internet") ?? null;
  const lojas = formas[0] ?? null;
  const totalFormas = formas.reduce((s, f) => s + (f.valor ?? 0), 0);
  const ano = String(g.pac.ano);

  // vínculo setor ↔ empresa: o concorrente com ficha leva à ficha; a companhia aberta sem ficha, ao comparador
  const empresas = goldEmpresas().empresas;
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
                    </>
                  ) : (
                    <>O IBGE não publicou as variações por atividade para este mês.</>
                  )}
                </LeituraGuiada>
              }
              comoInterpretar="Crescimento real é o do volume, já descontados os preços. Crescimento nominal é o da receita em reais. Quando a barra da receita é bem maior que a do volume, a diferença veio sobretudo de preço."
              naoConcluir="quanto cada atividade pesou no resultado do varejo: a pesquisa não publica os pesos no SIDRA, e uma atividade pequena pode variar muito sem mover a média."
              tabela={{ naFigura: "A tabela das atividades vem logo abaixo do gráfico, com os mesmos valores, a trajetória recente de cada uma e o link que abre o segmento." }}
              complemento={
                <>
                  <TabelaDados
                    recolhida={false}
                    idioma="pt"
                    titulo={`Atividades do varejo: crescimento real e nominal, variação ${def.curto}, ${quando}`}
                    colunas={["Atividade", "Crescimento real (volume), %", "Crescimento nominal (receita), %", "Receita menos volume, p.p.", "Volume nos últimos 24 meses", "Universo", "Peso ou contribuição"]}
                    linhas={linhas.map((l) => [
                      l.nomeCurto,
                      l.volume,
                      l.receita,
                      l.diferenca,
                      <MiniTrajetoria key={l.slug} nome={l.nomeCurto} pontos={trajetoria(g, g.pmc.atividades[l.slug], "volume")} />,
                      universoDe(l),
                      "não publicado no SIDRA",
                    ])}
                    casas={[null, 1, 1, 1, null, null, null]}
                    limite={linhas.length}
                    links={{ Atividade: linhas.map((l) => `${h({ segmento: l.slug })}#segmento`) }}
                    linhasDestacadas={sel.atividade ? [linhas.findIndex((l) => l.slug === sel.atividade)] : []}
                    fixarPrimeiraColuna
                    csv={hrefDownload("atividades.csv")}
                    nota="Toque no nome de uma atividade para abrir o segmento. A trajetória é o índice de volume com ajuste sazonal, cada linha na própria escala: mostra a forma do movimento, não compara níveis entre atividades."
                  />
                  <ExportarRecorte
                    nome={`varejo-atividades-${medida}-${mes}`}
                    colunas={["atividade", "nome", "universo", "volume_pct", "receita_nominal_pct", "receita_menos_volume_pp", "peso_ou_contribuicao"]}
                    linhas={linhas.map((l) => [l.slug, l.nomeCurto, universoDe(l), l.volume, l.receita, l.diferenca, "não publicado no SIDRA"])}
                    recorte={`Brasil, variação ${def.base}, ${quando}`}
                    fonte={`${g.fontes.pmc_atividades.orgao}, ${g.fontes.pmc_atividades.tabela}`}
                  />
                  {semEquivalencia.length > 0 && (
                    <p className="t-meta max-w-prose2 text-carvao-muted" data-sem-equivalencia="">
                      Segmentos empresariais sem atividade equivalente na pesquisa mensal:{" "}
                      {semEquivalencia.map((s, i) => (
                        <span key={s.slug}>
                          {i > 0 && "; "}
                          <Link href={`${h({ segmento: s.slug })}#segmento`} prefetch={false} scroll className={LINK}>
                            {s.nome}
                          </Link>
                        </span>
                      ))}
                      .
                    </p>
                  )}
                </>
              }
            >
              <GraficoBarras
                semTabela
                titulo={`Volume e receita nominal por atividade, variação ${def.curto}, ${quando}`}
                dados={ordenadas.map((l) => ({ slug: l.slug, nome: l.nomeCurto, volume: l.volume, receita: l.receita }))}
                chaveCategoria="slug"
                chaveRotulo="nome"
                series={[
                  { id: "volume", rotulo: "Volume (crescimento real)", cor: "var(--cor-gas)" },
                  { id: "receita", rotulo: "Receita nominal", cor: "var(--serie-referencia)" },
                ]}
                unidade="%"
                casas={1}
                orientacao="horizontal"
                alturaCategoria={48}
                rotulosValor
              />
            </FiguraAnalitica>

            {atividade && (
              <FiguraAnalitica
                id="segmento"
                pergunta={`${nomeAtividade}: como evoluíram as vendas?`}
                subtitulo={`${atividade.nome} · volume e receita nominal · variação em %, ${def.base} · Brasil · ${periodoTexto}`}
                natureza="OBSERVADO"
                proveniencia={provVarejo(g, "pmc_atividades", {
                  indicador: `Volume de vendas e receita nominal, ${atividade.nome}`, natureza: "OBSERVADO", unidade: `variação em %, ${def.base}`, frequencia: "mensal", inicio, fim: mes,
                  limitacoes: [g.notas.pmc_pesos], download: hrefDownload("atividades.csv"),
                })}
                leitura={
                  ultAtividade ? (
                    <LeituraGuiada>
                      Em {mesExtenso(ultAtividade.mes)}, o volume de {nomeAtividade.toLowerCase()} variou {variacao(ultAtividade.volume)} e a receita nominal, {variacao(ultAtividade.receita)}, {def.base}.
                      {atividade.universo === "ampliado" && " Esta atividade só entra no varejo ampliado."}
                      {atividade.universo === "detalhe" && ` Esta atividade é parte de ${(NOME_CURTO_ATIVIDADE[atividade.parte_de ?? ""] ?? "").toLowerCase()}.`}
                    </LeituraGuiada>
                  ) : undefined
                }
                naoConcluir="que as companhias do segmento tiveram esse desempenho: a pesquisa mede todas as empresas da atividade, grandes e pequenas, e a correspondência entre a atividade do IBGE e o segmento empresarial quase nunca é exata."
                tabela={{
                  titulo: `${nomeAtividade}: volume e receita nominal, variação ${def.curto}`,
                  colunas: ["Mês", "Volume, %", "Receita nominal, %", "Receita menos volume, p.p."],
                  linhas: serieAtividade.map((p) => [mesCurto(p.mes), p.volume, p.receita, p.diferenca]),
                  casas: [null, 1, 1, 1],
                  limite: 24,
                  csv: hrefDownload("atividades.csv"),
                }}
                depois={
                  <>
                    <div className="space-y-8" data-curadoria-segmento="">
                      <h3 className="t-h3 text-carvao">Como funciona este negócio</h3>
                      {curados.length > 0 ? curados.map((s) => <SegmentoCurado key={s.slug} s={s} hrefDe={hrefConcorrente} />) : <SegmentoEmApuracao atividade={nomeAtividade} />}
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
                <GraficoLinhas
                  semTabela
                  titulo={`${nomeAtividade}: volume de vendas e receita nominal`}
                  dados={serieAtividade.map((p) => ({ mes: p.mes, volume: p.volume, receita: p.receita }))}
                  chaveX="mes"
                  formatoX="mes"
                  series={[
                    { id: "volume", rotulo: "Volume de vendas", cor: "var(--cor-gas)", espessura: 2.2 },
                    { id: "receita", rotulo: "Receita nominal", cor: "var(--serie-referencia)" },
                  ]}
                  unidade="%"
                  casas={1}
                  zeroNoEixo
                  altura={320}
                />
              </FiguraAnalitica>
            )}

            {!atividade && sel.segmento && (
              <Recolhido id="segmento" aberto nivelTitulo={2} titulo={sel.segmento.nome} resumo="Segmento empresarial sem atividade equivalente na pesquisa mensal: descrição da curadoria, sem série do IBGE.">
                <SegmentoCurado s={sel.segmento} hrefDe={hrefConcorrente} />
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
              comoInterpretar="As cores do mapa dividem os 27 estados em cinco grupos de tamanho parecido, do menor ao maior valor: mostram posição relativa, não um limite entre bom e ruim. A lista ao lado traz os mesmos valores em ordem."
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
              <div className="grid gap-x-10 gap-y-8 lg:grid-cols-2">
                <div className="min-w-0" data-mapa-legado="">
                  <MapaEstados
                    titulo={`${nomeInd} do ${nomeU.toLowerCase()} por unidade da federação`}
                    valores={Object.fromEntries(ufs.map((l) => [l.cod, l[indicador]]))}
                    unidade="%"
                    periodo={quando}
                    nota={`Variação ${def.base}. Toque num estado para abrir a trajetória dele.`}
                    selecionado={uf ? UFS[uf].cod : null}
                    hrefs={{ "": h({ uf: null }), ...Object.fromEntries(Object.entries(UFS).map(([sg, u]) => [u.cod, h({ uf: sg })])) }}
                  />
                </div>
                <div className="min-w-0">
                  <GraficoBarras
                    semTabela
                    titulo={`${nomeInd} do ${nomeU.toLowerCase()} por estado, da maior para a menor variação`}
                    dados={ufs.map((l) => ({ uf: l.uf, nome: `${l.nome} (${l.uf})`, valor: l[indicador] }))}
                    chaveCategoria="uf"
                    chaveRotulo="nome"
                    series={[{ id: "valor", rotulo: nomeInd, cor: "var(--cor-gas)" }]}
                    unidade="%"
                    casas={1}
                    orientacao="horizontal"
                    alturaCategoria={32}
                    limiteInicial={12}
                    rotulosValor
                    selecionado={uf}
                  />
                </div>
              </div>
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
                  <TabelaDados
                    recolhida={false}
                    idioma="pt"
                    tituloVisivel={`Atividades em ${UFS[uf].nome}, ${mesExtenso(g.pmc.ufs_atividades.mes)}`}
                    id="estado-atividades"
                    lead="Por estado, o IBGE divulga as atividades só com as variações do mês mais recente: não há série para desenhar. Onde a pesquisa não publica a atividade no estado, a célula diz isso."
                    titulo={`Atividades do varejo em ${UFS[uf].nome}, ${mesExtenso(g.pmc.ufs_atividades.mes)}`}
                    colunas={["Atividade", "Volume, interanual, %", "Volume, 12 meses, %", "Receita, interanual, %", "Receita, 12 meses, %"]}
                    linhas={atividadesDaUf(g, uf).map((a) => [a.nomeCurto, a.volumeAa, a.volumeM12, a.receitaAa, a.receitaM12])}
                    casas={[null, 1, 1, 1, 1]}
                    limite={20}
                    ausencia={Object.fromEntries(["Volume, interanual, %", "Volume, 12 meses, %", "Receita, interanual, %", "Receita, 12 meses, %"].map((k) => [k, "não publicado"]))}
                    fixarPrimeiraColuna
                  />
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
                <GraficoLinhas
                  semTabela
                  titulo={`${nomeInd} do ${nomeU.toLowerCase()}: ${UFS[uf].nome} e Brasil`}
                  dados={serieUf.map((p, i) => ({ mes: p.mes, uf: p[indicador], brasil: brasil[i]?.[indicador] ?? null }))}
                  chaveX="mes"
                  formatoX="mes"
                  series={[
                    { id: "uf", rotulo: UFS[uf].nome, cor: "var(--cor-gas)", espessura: 2.2 },
                    { id: "brasil", rotulo: "Brasil", cor: "var(--serie-referencia)" },
                  ]}
                  unidade="%"
                  casas={1}
                  zeroNoEixo
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
                  <div className="max-w-prose2 border-t border-linha pt-4" data-curadoria-ecommerce="">
                    <h3 className="rotulo text-mineral">Nota da curadoria sobre o canal</h3>
                    <p className="t-meta mt-2 text-carvao-muted">{c.segmentos.ecommerce.texto}</p>
                  </div>
                ) : undefined
              }
            >
              <GraficoBarras
                semTabela
                titulo={`Receita bruta de revenda por forma de comercialização, ${ano}`}
                dados={formas.map((f) => ({ forma: f.forma, nome: f.curto, valor: f.valor === null ? null : f.valor / 1e6 }))}
                chaveCategoria="forma"
                chaveRotulo="nome"
                series={[{ id: "valor", rotulo: "Receita bruta de revenda", cor: "var(--cor-gas)" }]}
                unidade="R$ bilhões"
                casas={1}
                orientacao="horizontal"
                alturaCategoria={40}
                rotulosValor
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
              A descrição de cada segmento empresarial é curadoria da Scrutiniums, escrita a partir de documentos públicos citados em cada texto; as explicações de causa dadas por empresas são atribuídas a elas. A malha do mapa é a
              oficial do IBGE, já usada na plataforma. Fonte das formas de comercialização: {FONTE_PAC} {ano}.
            </p>
            <FechoDoMetodo g={g} />
          </>
        }
        frescorMetodo={<FaixaFrescor dominios={FRESCOR_DAS_COLECOES["/varejo"]} variante="metodo" />}
      />
    </>
  );
}
