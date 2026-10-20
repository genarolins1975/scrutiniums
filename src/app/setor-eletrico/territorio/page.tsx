import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AtalhoLeitura } from "@/components/energia/LeiturasIntegradas";
import { LeituraGuiada, ParaLer } from "@/components/energia/Didatica";
import { TerritorioAreas } from "@/components/energia/TerritorioAreas";
import { exemplosTerritorio, type ExemploTerritorio } from "@/lib/energia/territorio-exemplos";
import type { MunicipiosTerritorio } from "@/lib/energia/tipos-territorio";
import type { Metadata, ResolvingMetadata } from "next";
import type { ReactNode } from "react";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { Numero } from "@/components/energia/Numero";
import { TerritorioExplorador } from "@/components/energia/TerritorioExplorador";
import { TerritorioAviso, TerritorioIndisponivel, TerritorioRecorte, TerritorioTabela } from "@/components/energia/TerritorioPagina";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { SeguirPainel } from "@/components/energia/SeguirPainel";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia, type ProvenienciaComplementar } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { textoNatureza } from "@/components/evidencia/SeloNatureza";
import { Nome } from "@/components/i18n/Nome";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import { carimbo, dataBR, num } from "@/lib/energia/formato";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";
import {
  CONDICAO_COMPATIBILIDADE_EN,
  CONJUNTO_TERRITORIO_EN,
  MODULO_ID_EN,
  DOWNLOAD_TERRITORIO_EN,
  GRAO_NO_MUNICIPIO_EN,
  GRAO_TERRITORIO_EN,
  ID_GRAO_EN,
  INDICADOR_TERRITORIO_EN,
  MODULO_TERRITORIO_EN,
  PERGUNTA_TERRITORIO_EN,
  RESULTADO_CONTROLE_EN,
  UNIDADE_TERRITORIO_EN,
  provenienciaNoIdioma,
  rotuloDado,
} from "@/lib/energia/i18n/expansao-transicao-territorio";
import { lerGold } from "@/lib/energia/gold";
import { hrefNoIdioma } from "@/lib/i18n-href";
import {
  motivoLegivel,
  ID_PAINEL,
  nomeSm,
  regraNoIdioma,
  rotulosEstadoSm,
  simNao,
  dadosExplorador,
  distribuidorasSemArea,
  evidenciaLegivel,
  inteiro,
  numTexto,
  proximaPergunta,
  quartisDistribuidoras,
  respostaTerritorio,
  textoBasesDePerdas,
  textoAtualidade,
  textoLegivel,
  textoPeriodoPainel,
  textoReferencia,
  textoTesteDeCarga,
  textoUniverso,
  vereditoTerritorio,
} from "@/lib/energia/territorio";
import type { GoldTerritorio } from "@/lib/energia/tipos-territorio";
import { lerPerdasDaFonte, lerUsinasDoServidor, situacaoDosInsumos } from "@/lib/energia/territorio-servidor";
import { datasLegiveis } from "@/lib/energia/visao";

export const dynamic = "force-static";
export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/territorio", {
    title: tx("Minha região: submercado, distribuidora, município e usinas no mapa", "My region: submarket, distribution utility, municipality and power plants on the map"),
    description: tx(
      "Mapa geográfico do setor elétrico: submercado de cada UF (EPE e ONS), área de cada distribuidora (relação oficial da ANEEL), indicadores por município e usinas do SIGA, cada número na área da sua fonte e com a fonte.",
      "Geographic map of the power sector: submarket of each state (EPE and ONS), area of each distribution utility (ANEEL's official list), indicators by municipality and SIGA plants, each figure in its source's area and with its source.",
    ),
    alternates: { canonical: "/setor-eletrico/territorio" },
  }, anterior);
}

function rotulosComplementares(): Record<string, string> {
  return {
    subsistema_uf: tx("UF e subsistema (EPE)", "State and subsystem (EPE)"),
    areas_carga: tx("Pertença das áreas de carga (ONS)", "Membership of the load areas (ONS)"),
    distribuidora_perdas: tx("Perdas da distribuidora", "Losses of the distribution utility"),
    distribuidora_qualidade: tx("DEC e FEC da distribuidora", "DEC and FEC of the distribution utility"),
    conjuntos: tx("DEC e FEC do conjunto", "DEC and FEC of the consumer set"),
    distribuidora_tarifa: tx("Tarifa B1 da distribuidora", "B1 tariff of the distribution utility"),
    mmgd: tx("MMGD por município", "MMGD by municipality"),
    mmgd_ons: tx("MMGD estimada pelo ONS", "MMGD estimated by the ONS"),
    populacao: tx("População estimada (IBGE)", "Estimated population (IBGE)"),
    tarifa_social: tx("Tarifa Social", "Tarifa Social"),
    luz_para_todos: tx("Luz para Todos", "Luz para Todos"),
    isolados: tx("Sistemas isolados (PASI)", "Isolated systems (PASI)"),
    usinas: tx("Usinas (SIGA)", "Plants (SIGA)"),
    pld_dia: tx("PLD do dia", "PLD of the day"),
    pld_mes: tx("PLD do mês", "PLD of the month"),
    ear: tx("Energia armazenada", "Stored energy"),
  };
}

/** Exemplos do artefato "Um endereço, várias áreas", lidos do índice municipal publicado (o mesmo arquivo do explorador); vazio se faltar. */
function lerExemplos(g: GoldTerritorio): ExemploTerritorio[] {
  try {
    const arq = JSON.parse(readFileSync(join(process.cwd(), "public", g.series.municipios.replace(/^\/+/, "")), "utf-8")) as MunicipiosTerritorio;
    return exemplosTerritorio(g, arq);
  } catch {
    return [];
  }
}

const curto = (sha: string | null | undefined) => (sha ? `${sha.slice(0, 12)}…` : tx("sem registro", "no record"));

/** Texto livre da gold (em português): na página inglesa, marcado como trecho só em português. */
const emPortugues = (texto: string, regiao: string): ReactNode => tx<ReactNode>(texto, <TrechoPortugues regiao={regiao}>{texto}</TrechoPortugues>);
/** Rótulo da gold com tabela de tradução: a entrada inglesa, ou o texto marcado como só em português. */
function daGold(texto: string, tabela: Readonly<Record<string, string>>, regiao: string): ReactNode {
  return idiomaEnergia() === "en" && tabela[texto] ? tabela[texto] : emPortugues(texto, regiao);
}
/** Nome próprio (município, distribuidora) numa célula: em português, o texto puro. */
const nome = (texto: string): ReactNode => tx<ReactNode>(texto, <Nome>{texto}</Nome>);

/**
 * P002, mapa geográfico transversal: "o que acontece na minha região?". Junta seis
 * grãos que não se trocam (submercado, UF, distribuidora, conjunto elétrico, município
 * e usina) sem atribuir nenhum número a um grão menor que o da fonte. A resposta, o
 * recorte e os números de destaque vêm da gold; o mapa, a ficha e as tabelas
 * interativas ficam no explorador (cliente), com estado na URL. Os modos Analisar e
 * Auditar trazem a regra de compatibilidade entre camadas, o catálogo de indicadores
 * por grão, a prova da pertença das áreas de carga, os controles e os bloqueios.
 * Complementa o mapa conceitual da página inicial (P001), sem substituí-lo.
 */
export default function TerritorioPage() {
  const g = lerGold<GoldTerritorio>("territorio.json");
  if (!g || !g.disponivel || !g.proveniencia?.indice) return <TerritorioIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;

  // as usinas do arquivo publicado separam, por UF, os registros de até 10 kW (a regra da contagem municipal) e contam as usinas em mais de uma UF
  // e a energia sobre a qual cada distribuidora calcula a taxa de perdas (o arquivo anual de perdas por distribuidora)
  const dados = dadosExplorador(g, lerUsinasDoServidor(g.series.usinas, g.resumo.usinas.limite_registro_kw), lerPerdasDaFonte(g.referencias.perdas_ano));
  const r = g.resumo;
  const u = r.usinas;
  const prox = proximaPergunta("distribuidora");
  const siglaDe = new Map(g.distribuidoras.map((d) => [d.cnpj, d.sigla]));
  const sigla = (cnpj: string) => siglaDe.get(cnpj) ?? cnpj;
  const ROTULO_COMPLEMENTAR = rotulosComplementares();
  const idioma = idiomaEnergia();
  const sd = tx("sem dado", "no data");
  const nenhuma = tx("nenhuma", "none");
  const nenhum = tx("nenhum", "none");
  const semData = tx("sem data", "no date");
  const complementares: ProvenienciaComplementar[] = Object.entries(g.proveniencia)
    .filter(([k, p]) => k !== "indice" && p)
    .map(([k, p]) => ({ rotulo: ROTULO_COMPLEMENTAR[k] ?? k, p: provenienciaNoIdioma(p!, idioma) }));
  const semArea = distribuidorasSemArea(g);
  const ev = g.evidencias;
  // o sha256 de cada arquivo que o índice leu, recalculado sobre o arquivo servido na hora de montar a página
  const insumos = situacaoDosInsumos(g.insumos);
  const situacaoPorChave = new Map(insumos.map((x) => [x.chave, x]));
  const mudaram = insumos.filter((x) => x.confere === false).length;
  const naoLidos = insumos.filter((x) => x.confere === null).length;
  const quartis = quartisDistribuidoras(dados.distribuidoras);
  // resposta da abertura e artefato: a maior cidade de cada submercado, com o número de cada área (mesmos arquivos da ficha)
  const exemplos = lerExemplos(g);
  const ex = exemplos[0];
  const exDist = ex?.distribuidoras.find((d) => d.tarifa) ?? null;
  const ufsPorSm = g.submercados.map((s) => ({ sm: s.sm, n: s.ufs.length }));
  const foraDoSin = r.municipios_fora_do_sin.total;
  const comoInterpretarEn = (
    <>
      Choose a layer: submarket (state color), distribution utilities (whole municipalities from the official list), municipalities (one measure published by municipality) or plants
      (SIGA points, ANEEL&apos;s Generation Information System). The sheet says whose each value is. When you switch layers, the choice carries over only where there is a valid
      correspondence; where there is none, the page says why.
    </>
  );
  const naoConcluirEn = (
    <>
      That the tariff, losses, DEC or FEC belong to the municipality: they belong to the whole distribution utility (or the whole consumer set) and do not serve to compare municipalities of
      the same utility. That the PLD or stored energy describe a municipality or a state. That the concession area has these boundaries: it is drawn from whole municipalities, without the
      internal boundaries. Which submarket a plant is in: it depends on the connection point, which SIGA does not publish. Association between layers is not causation.
    </>
  );
  const comoInterpretar = tx(
    <>
      Escolha uma camada: submercado (cor da UF), distribuidoras (municípios inteiros da relação oficial), municípios (uma medida publicada por município) ou usinas
      (pontos do SIGA, o Sistema de Informações de Geração da ANEEL). A ficha diz de quem é cada valor. Ao trocar de camada, a escolha continua só onde há correspondência
      válida; onde não há, a página diz por quê.
    </>,
    comoInterpretarEn,
  );
  const naoConcluir = tx(
    <>
      Que a tarifa, as perdas, o DEC ou o FEC sejam do município: são da distribuidora inteira (ou do conjunto inteiro) e não servem para comparar municípios da mesma
      distribuidora. Que o PLD ou a energia armazenada descrevam um município ou uma UF. Que a área de concessão tenha esses limites: ela é desenhada por municípios
      inteiros, sem os limites internos. Em que submercado está uma usina: depende do ponto de conexão, que o SIGA não publica. Associação entre camadas não é causa.
    </>,
    naoConcluirEn,
  );
  const comoInterpretarNotas = tx(
    <>
      Escolha uma camada: submercado (cor da UF), distribuidoras (municípios inteiros da relação oficial), municípios (uma medida publicada por município) ou usinas (pontos do SIGA, o Sistema de Informações de Geração da ANEEL). A
      ficha diz de quem é cada valor. Ao trocar de camada, a escolha continua só onde há correspondência válida; onde não há, a página diz por quê.
    </>,
    comoInterpretarEn,
  );
  const naoConcluirNotas = tx(
    <>
      Que a tarifa, as perdas, o DEC ou o FEC sejam do município: são da distribuidora inteira (ou do conjunto inteiro) e não servem para comparar municípios da mesma distribuidora. Que o
      PLD ou a energia armazenada descrevam um município ou uma UF. Que a área de concessão tenha esses limites: ela é desenhada por municípios inteiros, sem os limites internos. Em que
      submercado está uma usina: depende do ponto de conexão, que o SIGA não publica. Associação entre camadas não é causa.
    </>,
    naoConcluirEn,
  );
  const ROTULO_ESTADO_SM = rotulosEstadoSm(idioma);
  const notaSubmercado = tx(
    `${inteiro(r.municipios_por_estado_submercado.provado ?? 0)} conferidos pela carga das áreas do ONS e ${inteiro(r.municipios_por_estado_submercado.provado_com_area_sem_carga ?? 0)} conferidos só por uma das áreas (a outra sem carga nos dias conferidos, em Tocantins). ${textoTesteDeCarga(g)} Fora deles: ${inteiro(r.municipios_por_estado_submercado.com_localidade_isolada ?? 0)} com localidade isolada dentro do SIN (submercado da UF, com aviso) e ${inteiro(r.municipios_fora_do_sin.total)} fora do SIN.`,
    `${inteiro(r.municipios_por_estado_submercado.provado ?? 0)} checked against the load of the ONS areas and ${inteiro(r.municipios_por_estado_submercado.provado_com_area_sem_carga ?? 0)} checked by only one of the areas (the other had no load on the days checked, in Tocantins). ${textoTesteDeCarga(g)} Outside them: ${inteiro(r.municipios_por_estado_submercado.com_localidade_isolada ?? 0)} with an isolated locality inside the SIN (state's submarket, with a warning) and ${inteiro(r.municipios_fora_do_sin.total)} outside the SIN.`,
  );
  const textoInsumos =
    mudaram === 0 && naoLidos === 0
      ? tx("Todos conferem: o índice foi calculado sobre estes mesmos arquivos.", "All match: the index was calculated on these same files.")
      : tx(
          `${inteiro(mudaram)} de ${inteiro(g.insumos.length)} arquivos mudaram depois do índice${naoLidos ? ` e ${inteiro(naoLidos)} não puderam ser lidos na montagem desta página` : ""}: o módulo de origem foi regerado e o índice ainda não. O índice só é regerado quando a rotina de geração dos dados roda de novo; até lá, o que ele tirou desses arquivos vem da versão anterior deles.`,
          `${inteiro(mudaram)} of ${inteiro(g.insumos.length)} files changed after the index${naoLidos ? ` and ${inteiro(naoLidos)} could not be read when building this page` : ""}: the source module was regenerated and the index not yet. The index is only regenerated when the data generation routine runs again; until then, what it took from these files comes from their previous version.`,
        );

  return (
    <>
      <CabecalhoEnergia atual="territorio" />
      <MarcaVisita secao="energia:territorio" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <CabecalhoModulo
          siglas={["SIN", "PLD", "DEC", "FEC", "MMGD", "SIGA"]}
          titulo={rotuloDado(g.pergunta, PERGUNTA_TERRITORIO_EN, idioma)}
          lead={
            ex && ex.pldDia && exDist?.tarifa
              ? tx(
                  <>
                    Depende da área de cada número. Em {ex.nome} ({ex.uf}), o preço de curto prazo do <Termo slug="submercado">submercado</Termo> {nomeSm(ex.sm, "pt")} foi de R${" "}
                    {num(ex.pldDia.valor, 2)}/MWh em {dataBR(ex.pldDia.dia)}, o mesmo para {ex.ufsDoSm} UFs; a tarifa residencial da {exDist.sigla} é de R$ {num(exDist.tarifa.valor, 2)}/MWh, a
                    mesma para os {num(exDist.municipiosNaArea, 0)} municípios da área dela. Busque o seu município para ver os números de cada área.
                  </>,
                  <>
                    It depends on each figure&apos;s area. In <Nome>{ex.nome}</Nome> ({ex.uf}), the short-term price of the <Termo slug="submercado">submarket</Termo> {nomeSm(ex.sm, "en")} was R${" "}
                    {num(ex.pldDia.valor, 2)}/MWh on {dataBR(ex.pldDia.dia)}, the same for {ex.ufsDoSm} states; the residential tariff of <Nome>{exDist.sigla}</Nome> is R${" "}
                    {num(exDist.tarifa.valor, 2)}/MWh, the same for the {num(exDist.municipiosNaArea, 0)} municipalities in its area. Search for your municipality to see the figures of each area.
                  </>,
                )
              : tx(
            <>
              Quem mora num município paga a tarifa da distribuidora da área e vive num <Termo slug="submercado">submercado</Termo>, com preço próprio, por isso cada número aqui é da área da sua fonte. Escolha uma região
              para ver preço, tarifa, perdas, continuidade e usinas.
            </>,
            <>
              Whoever lives in a municipality pays the tariff of the area&apos;s distribution utility and lives in a <Termo slug="submercado">submarket</Termo>, with its own price, so each figure here belongs
              to its source&apos;s area. Choose a region to see price, tariff, losses, continuity and plants.
            </>,
                )
          }
          limite={tx(
            "Tarifa, perdas, DEC e FEC são da distribuidora inteira e não distinguem os municípios dela; preço e energia armazenada são do submercado; a área da distribuidora é a união de municípios inteiros.",
            "Tariff, losses, DEC and FEC belong to the whole distribution utility and do not distinguish its municipalities; price and stored energy belong to the submarket; the utility's area is the union of whole municipalities.",
          )}
          recorte={tx(
            `${dataBR(g.data_referencia)} · ${inteiro(g.resumo.municipios)} municípios · cada medida com unidade e data próprias`,
            `${dataBR(g.data_referencia)} · ${inteiro(g.resumo.municipios)} municipalities · each measure with its own unit and date`,
          )}
          fonte={tx("ANEEL, ONS, CCEE, EPE e IBGE", "ANEEL, ONS, CCEE, EPE and IBGE")}
          referencia={tx(
            <>
              Publicação de {dataBR(g.data_referencia)}; processada em {carimbo(g.gerado_em)}. Malha territorial do IBGE{g.geometria.malha ? `, revisão de ${g.geometria.malha.revisao}` : ""}. Data de cada parte: PLD
              {g.referencias.pld_dia ? ` até ${dataBR(g.referencias.pld_dia)}` : " sem dado"}; energia armazenada{g.referencias.ear_dia ? ` até ${dataBR(g.referencias.ear_dia)}` : " sem dado"}; tarifa B1
              {g.referencias.tarifa_data ? ` vigente em ${dataBR(g.referencias.tarifa_data)}` : " sem dado"}; perdas e continuidade de {g.referencias.perdas_ano ?? "ano sem dado"} e{" "}
              {g.referencias.qualidade_ano ?? "ano sem dado"}; MMGD{g.referencias.mmgd_data_cadastro ? ` no cadastro de ${dataBR(g.referencias.mmgd_data_cadastro)}` : " sem dado"}; Tarifa Social do município em{" "}
              {textoReferencia(g.referencias.tsee_mes_cde)} (a da distribuidora tem o mês do SCS na ficha); usinas do SIGA de {g.referencias.siga_data ? dataBR(g.referencias.siga_data) : "data sem registro"}.
            </>,
            <>
              Release of {dataBR(g.data_referencia)}; processed on {carimbo(g.gerado_em)}. IBGE territorial map{g.geometria.malha ? `, revision of ${g.geometria.malha.revisao}` : ""}. Date of each part: PLD
              {g.referencias.pld_dia ? ` through ${dataBR(g.referencias.pld_dia)}` : " no data"}; stored energy{g.referencias.ear_dia ? ` through ${dataBR(g.referencias.ear_dia)}` : " no data"}; B1 tariff
              {g.referencias.tarifa_data ? ` in force on ${dataBR(g.referencias.tarifa_data)}` : " no data"}; losses and continuity of {g.referencias.perdas_ano ?? "year with no data"} and{" "}
              {g.referencias.qualidade_ano ?? "year with no data"}; MMGD{g.referencias.mmgd_data_cadastro ? ` in the register of ${dataBR(g.referencias.mmgd_data_cadastro)}` : " no data"}; the
              municipality&apos;s Tarifa Social in {textoReferencia(g.referencias.tsee_mes_cde)} (the utility&apos;s has the SCS month in the sheet); SIGA plants of{" "}
              {g.referencias.siga_data ? dataBR(g.referencias.siga_data) : "date not recorded"}.
            </>,
          )}
        />

        <AtalhoLeitura
          href="/setor-eletrico/territorio/atlas"
          titulo={tx("Onde estão a geração e os novos projetos?", "Where are generation and the new projects?")}
          texto={tx("Alterne quatro camadas por UF, com a mediana, o período e a unidade de cada medida.", "Switch between four layers by state, with the median, the period and the unit of each measure.")}
        />
        <ModoProfundidade>
            <PainelEvidencia
              id={ID_PAINEL}
              pergunta={tx("Qual número vale para qual área?", "Which figure holds for which area?")}
              subtitulo={tx(
                "Submercado, distribuidora, conjunto elétrico, município e usina: o tipo de área de cada número",
                "Submarket, distribution utility, consumer set, municipality and plant: the type of area of each figure",
              )}
              natureza={g.proveniencia.indice.natureza}
              porQueImporta={tx(
                <>
                  Quem mora num município paga a tarifa da sua distribuidora, está num submercado com o seu PLD, é atendido por um conjunto elétrico com a sua
                  continuidade e vive num lugar com a sua geração distribuída. Juntar essas peças mostra o que acontece na região sem atribuir a um lugar um número que pertence a uma
                  área maior.
                </>,
                <>
                  Whoever lives in a municipality pays their distribution utility&apos;s tariff, is in a submarket with its PLD, is served by a consumer set with its continuity and lives in
                  a place with its distributed generation. Putting these pieces together shows what happens in the region without attributing to a place a figure that belongs to a larger
                  area.
                </>,
              )}
              oQueMudou={textoAtualidade(g)}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
              proveniencia={provenienciaNoIdioma(g.proveniencia.indice, idioma)}
              complementares={complementares}
            >
              <div className="space-y-6">
                <TerritorioExplorador dados={dados} />

                <LeituraGuiada id="p002-mapa">
                  {tx(
                    `Na camada que abre, a cor de cada UF é o submercado dela: ${ufsPorSm.map((x) => `${x.n} UFs no ${nomeSm(x.sm, "pt")}`).join(", ")}. Os ${inteiro(foraDoSin)} municípios fora do SIN, atendidos por sistemas isolados, não pertencem a nenhum submercado. Troque a camada para ver distribuidoras, municípios ou usinas; ao escolher um lugar, a ficha diz de que área é cada número.`,
                    `In the layer that opens, each state's color is its submarket: ${ufsPorSm.map((x) => `${x.n} states in the ${nomeSm(x.sm, "en")}`).join(", ")}. The ${inteiro(foraDoSin)} municipalities outside the SIN, served by isolated systems, belong to no submarket. Switch the layer to see utilities, municipalities or plants; when you choose a place, the sheet says which area each figure belongs to.`,
                  )}
                </LeituraGuiada>

                <TerritorioAreas
                  exemplos={exemplos}
                  dataMmgd={g.referencias.mmgd_data_cadastro ?? null}
                  anoPop={g.referencias.populacao_ano ?? null}
                  fonte={tx(
                    `PLD da CCEE e energia armazenada do ONS por submercado; tarifa B1 (ANEEL) vigente em ${g.referencias.tarifa_data ? dataBR(g.referencias.tarifa_data) : "data sem registro"}; perdas (ANEEL, ${g.referencias.perdas_ano ?? "ano sem dado"}) e DEC e FEC (ANEEL, ${g.referencias.qualidade_ano ?? "ano sem dado"}) da distribuidora e dos conjuntos; população do IBGE; MMGD e usinas da ANEEL. Os mesmos arquivos da ficha do mapa.`,
                    `CCEE PLD and ONS stored energy by submarket; B1 tariff (ANEEL) in force on ${g.referencias.tarifa_data ? dataBR(g.referencias.tarifa_data) : "date not recorded"}; losses (ANEEL, ${g.referencias.perdas_ano ?? "year with no data"}) and DEC and FEC (ANEEL, ${g.referencias.qualidade_ano ?? "year with no data"}) of the utility and the consumer sets; IBGE population; ANEEL MMGD and plants. The same files as the map sheet.`,
                  )}
                />

                <ParaLer
                  id="para-ler-territorio"
                  nivelTitulo={3}
                  itens={[
                    {
                      termo: <Termo slug="sin">SIN</Termo>,
                      definicao: tx(
                        `O Sistema Interligado Nacional: a rede que liga quase todo o país. Ficam fora ${inteiro(foraDoSin)} municípios atendidos por sistemas isolados.`,
                        `The National Interconnected System: the grid that links almost the whole country. Left out are ${inteiro(foraDoSin)} municipalities served by isolated systems.`,
                      ),
                    },
                    {
                      termo: <Termo slug="submercado">{tx("Submercado", "Submarket")}</Termo>,
                      definicao: tx(
                        "Uma das quatro regiões elétricas do SIN (Sudeste/Centro-Oeste, Sul, Nordeste e Norte), cada uma com o seu preço de curto prazo (PLD) e os seus reservatórios. O ONS chama a mesma divisão de subsistema.",
                        "One of the four electrical regions of the SIN (Southeast/Center-West, South, Northeast and North), each with its own short-term price (PLD) and reservoirs. ONS calls the same division a subsystem.",
                      ),
                    },
                    {
                      termo: tx("Distribuidora", "Distribution utility"),
                      definicao: tx(
                        "A empresa que leva a energia até a casa e cobra a tarifa. A área dela é a lista oficial de municípios que ela atende; tarifa e perdas valem para a área inteira.",
                        "The company that brings power to the home and charges the tariff. Its area is the official list of municipalities it serves; tariff and losses hold for the whole area.",
                      ),
                    },
                    {
                      termo: <Termo slug="conjunto-eletrico">{tx("Conjunto elétrico", "Consumer set")}</Termo>,
                      definicao: tx(
                        "Grupo de consumidores definido pela ANEEL para medir as interrupções. Um município grande tem vários; um conjunto pode juntar municípios pequenos.",
                        "A group of consumers defined by ANEEL to measure interruptions. A large municipality has several; one set may group small municipalities.",
                      ),
                    },
                    {
                      termo: tx("DEC e FEC", "DEC and FEC"),
                      definicao: tx(
                        <>
                          <Termo slug="dec">DEC</Termo>: quantas horas, em média, cada consumidor ficou sem energia no ano. <Termo slug="fec">FEC</Termo>: quantas vezes a energia caiu, em
                          média, para cada consumidor.
                        </>,
                        <>
                          <Termo slug="dec">DEC</Termo>: how many hours, on average, each consumer was without power in the year. <Termo slug="fec">FEC</Termo>: how many times power went
                          out, on average, for each consumer.
                        </>,
                      ),
                    },
                    {
                      termo: tx("PLD e tarifa", "PLD and tariff"),
                      definicao: tx(
                        <>
                          Os dois vêm em R$/MWh, mas não se comparam: o <Termo slug="pld">PLD</Termo> é o preço da energia no mercado de curto prazo, por submercado; a tarifa é o que a
                          distribuidora cobra do consumidor residencial, antes dos impostos e da bandeira.
                        </>,
                        <>
                          Both come in R$/MWh, but they are not comparable: the <Termo slug="pld">PLD</Termo> is the price of energy in the short-term market, by submarket; the tariff is
                          what the utility charges the residential consumer, before taxes and the tariff flag.
                        </>,
                      ),
                    },
                  ]}
                />

                <div id="territorio-limites" className="scroll-mt-28">
                  <NotasDoPainel oQueMudou={textoAtualidade(g)} comoInterpretar={comoInterpretarNotas} naoConcluir={naoConcluirNotas} />
                </div>

                <RespostaCurta id={ID_PAINEL} veredito={vereditoTerritorio(g)} depois>
                  {respostaTerritorio(g)}
                </RespostaCurta>
                <TerritorioRecorte
                  periodo={textoPeriodoPainel(g)}
                  universo={textoUniverso(g)}
                  unidade={tx(
                    "R$/MWh (PLD e tarifa), % (perdas, EAR, Tarifa Social), horas e interrupções por unidade consumidora (DEC e FEC), unidades e kW (MMGD), MW (usinas), habitantes e domicílios.",
                    "R$/MWh (PLD and tariff), % (losses, EAR, Tarifa Social), hours and interruptions per consumer unit (DEC and FEC), units and kW (MMGD), MW (plants), inhabitants and households.",
                  )}
                />
                <div data-nivel="analisar" className="grid gap-4 md:grid-cols-3">
                  {ev.municipios_compartilhados && (
                    <Numero
                      rotulo={tx("Municípios atendidos por mais de uma distribuidora", "Municipalities served by more than one distribution utility")}
                      natureza="CALCULADO"
                      evidencia={ev.municipios_compartilhados}
                      casas={0}
                      unidade={tx("municípios", "municipalities")}
                      tamanho="medio"
                      nota={tx(
                        `De ${inteiro(r.municipios)} municípios; neles a página lista as distribuidoras e não escolhe uma.`,
                        `Of ${inteiro(r.municipios)} municipalities; in them the page lists the utilities and does not choose one.`,
                      )}
                      endereco={`/setor-eletrico/territorio#${ID_PAINEL}`}
                    />
                  )}
                  {ev.municipios_com_submercado && (
                    <Numero
                      rotulo={tx("Municípios com submercado conferido pela UF", "Municipalities with a submarket checked through their state")}
                      natureza="CALCULADO"
                      evidencia={{ ...ev.municipios_com_submercado, indicador: textoLegivel(ev.municipios_com_submercado.indicador) }}
                      casas={0}
                      unidade={tx("municípios", "municipalities")}
                      tamanho="medio"
                      nota={notaSubmercado}
                      endereco={`/setor-eletrico/territorio#${ID_PAINEL}`}
                    />
                  )}
                  {ev.usinas_municipio_reconhecido && (
                    <Numero
                      rotulo={tx("Usinas com o município declarado reconhecido", "Plants with the declared municipality recognized")}
                      natureza="CALCULADO"
                      evidencia={ev.usinas_municipio_reconhecido}
                      casas={0}
                      unidade={tx("usinas", "plants")}
                      tamanho="medio"
                      nota={tx(
                        `De ${inteiro(u.total)} usinas do SIGA; ${inteiro(u.multimunicipio)} declaradas em mais de um município, sem potência repartida.`,
                        `Of ${inteiro(u.total)} SIGA plants; ${inteiro(u.multimunicipio)} declared in more than one municipality, without splitting the capacity.`,
                      )}
                      endereco={`/setor-eletrico/territorio#${ID_PAINEL}`}
                    />
                  )}
                </div>
                <TerritorioAviso rotulo={tx("Regra de atribuição", "Attribution rule")} nivel="analisar">
                  {emPortugues(textoLegivel(g.regra_granularidade), "territorio-regra")}
                </TerritorioAviso>

                <SecaoDoPainel
                  nivel="analisar"
                  titulo={tx("Como os indicadores das distribuidoras se distribuem entre elas", "How the distribution utilities' indicators are distributed among them")}
                  id="territorio-quartis"
                >
                  <p className="max-w-prose2 text-sm text-carvao-muted">
                    {tx(
                      "Menor valor, quartis e maior valor de cada indicador do quadro de distribuidoras, só entre as que têm o dado. Cada valor é o da área inteira da distribuidora, e cada distribuidora conta uma vez, seja qual for o tamanho; as duas últimas colunas mostram o outro lado, com as unidades consumidoras (UC) de cada uma. A distribuição não diz nada sobre um município.",
                      "Lowest value, quartiles and highest value of each indicator in the utilities table, only among those with the data. Each value is for the utility's whole area, and each utility counts once, whatever its size; the last two columns show the other side, with each one's consumer units (CU). The distribution says nothing about a municipality.",
                    )}
                  </p>
                  <TerritorioTabela
                    titulo={tx(
                      `Indicadores de ${inteiro(dados.distribuidoras.length)} distribuidoras com município na relação`,
                      `Indicators of ${inteiro(dados.distribuidoras.length)} distribution utilities with a municipality in the list`,
                    )}
                    colunas={tx(
                      ["Indicador", "Unidade", "Com dado", "Menor", "1º quartil", "Mediana", "3º quartil", "Maior", "UC reunidas (% do quadro)", "Mediana pesada pelas UC"],
                      ["Indicator", "Unit", "With data", "Lowest", "1st quartile", "Median", "3rd quartile", "Highest", "CUs gathered (% of the table)", "Median weighted by CUs"],
                    )}
                    numericas={[2, 3, 4, 5, 6, 7, 8, 9]}
                    linhas={quartis.map((q) => [
                      q.rotulo,
                      q.unidade,
                      inteiro(q.n),
                      numTexto(q.min, q.casas),
                      numTexto(q.p25, q.casas),
                      numTexto(q.mediana, q.casas),
                      numTexto(q.p75, q.casas),
                      numTexto(q.max, q.casas),
                      q.cobertura_uc_pct === null ? sd : `${num(q.cobertura_uc_pct, 1)}%`,
                      numTexto(q.mediana_uc, q.casas),
                    ])}
                  />
                  <p className="max-w-prose2 text-sm text-carvao-muted" data-nota-perdas-base="">
                    {textoBasesDePerdas(dados.distribuidoras)}
                  </p>
                  <p className="max-w-prose2 text-xs text-carvao-muted">
                    {tx(
                      "A mediana pesada pelas UC e a parcela das UC usam as unidades consumidoras do cadastro de continuidade (as mesmas do DEC); a distribuidora sem esse número fica fora das duas colunas e dentro das demais.",
                      "The median weighted by CUs and the share of CUs use the consumer units of the continuity register (the same as the DEC's); a utility without this number is left out of those two columns and kept in the others.",
                    )}
                  </p>
                </SecaoDoPainel>

                <SecaoDoPainel
                  nivel="analisar"
                  titulo={tx("Quando a escolha passa de uma camada para outra?", "When does the choice carry over from one layer to another?")}
                  id="territorio-compatibilidade"
                >
                  <TerritorioTabela
                    titulo={tx("Correspondências entre tipos de área declaradas na base", "Correspondences between types of area declared in the dataset")}
                    colunas={tx(["De", "Para", "Passa", "Regra", "Condição"], ["From", "To", "Carries over", "Rule", "Condition"])}
                    linhas={g.compatibilidade.map((c) => [
                      rotuloDado(c.de, ID_GRAO_EN, idioma),
                      rotuloDado(c.para, ID_GRAO_EN, idioma),
                      simNao(c.valida, idioma),
                      idioma === "en" ? regraNoIdioma(c.regra, idioma) : textoLegivel(c.regra),
                      c.condicao
                        ? idioma === "en" && CONDICAO_COMPATIBILIDADE_EN[c.condicao]
                          ? CONDICAO_COMPATIBILIDADE_EN[c.condicao]
                          : emPortugues(textoLegivel(c.condicao), "territorio-condicao")
                        : tx("sem condição", "no condition"),
                    ])}
                  />
                  <p className="max-w-prose2 text-sm text-carvao-muted">
                    {tx(
                      "Par que não está na tabela não passa: a camada mostra só o contorno da UF quando ele ajuda a localizar a escolha, sem levar nenhum valor da UF para outro tipo de área.",
                      "A pair that is not in the table does not carry over: the layer shows only the state's outline when it helps locate the choice, without taking any state value to another type of area.",
                    )}
                  </p>
                </SecaoDoPainel>

                <SecaoDoPainel nivel="analisar" titulo={tx("Onde cada indicador mora (catálogo por tipo de área)", "Where each indicator lives (catalog by type of area)")} id="territorio-catalogo">
                  <TerritorioTabela
                    titulo={tx(`${inteiro(g.indicadores.length)} indicadores, cada um na tabela da sua área`, `${inteiro(g.indicadores.length)} indicators, each in its area's table`)}
                    colunas={tx(
                      ["Indicador", "Tipo de área", "Unidade", "Natureza", "Como aparece na ficha do município", "Origem"],
                      ["Indicator", "Type of area", "Unit", "Nature", "How it appears in the municipality's sheet", "Origin"],
                    )}
                    linhas={g.indicadores.map((i) => [
                      tx<ReactNode>(i.rotulo, daGold(i.rotulo, INDICADOR_TERRITORIO_EN, "territorio-indicador")),
                      daGold(i.rotulo_grao, GRAO_TERRITORIO_EN, "territorio-indicador"),
                      daGold(i.unidade, UNIDADE_TERRITORIO_EN, "territorio-indicador"),
                      idioma === "en" ? textoNatureza(i.natureza, idioma).rotulo.toLowerCase() : i.natureza.toLowerCase(),
                      daGold(i.rotulo_no_municipio, GRAO_NO_MUNICIPIO_EN, "territorio-indicador"),
                      <a key={i.id} href={hrefNoIdioma(i.pagina.href, idioma)} className="text-energia-dark underline underline-offset-4 hover:text-carvao">
                        {daGold(i.pagina.rotulo, MODULO_TERRITORIO_EN, "territorio-indicador")}
                      </a>,
                    ])}
                  />
                </SecaoDoPainel>

                <SecaoDoPainel nivel="analisar" titulo={tx("Distribuidoras sem município na relação vigente", "Distribution utilities with no municipality in the list in force")} id="territorio-sem-area">
                  <p className="max-w-prose2 text-sm text-carvao-muted">
                    {tx(
                      `${inteiro(semArea.length)} CNPJs aparecem nas bases publicadas de origem, mas nenhum município da relação de ${g.referencias.relacao_distribuidoras_ano ?? "sem data"} os liga a eles: ficam fora do mapa e das fichas, com o motivo de cada indicador.`,
                      `${inteiro(semArea.length)} CNPJs appear in the published source datasets, but no municipality in the list of ${g.referencias.relacao_distribuidoras_ano ?? semData} links them: they are left out of the map and the sheets, with the reason for each indicator.`,
                    )}
                  </p>
                  <TerritorioTabela
                    titulo={tx("Distribuidoras sem área na relação", "Distribution utilities without an area in the list")}
                    colunas={tx(["Distribuidora", "CNPJ", "Ativa", "Perdas", "Tarifa"], ["Distribution utility", "CNPJ", "Active", "Losses", "Tariff"])}
                    linhas={semArea.map((d) => [
                      nome(d.sigla),
                      d.cnpj_formatado ?? d.cnpj,
                      d.ativa === null ? sd : simNao(d.ativa, idioma),
                      d.indicadores.perdas.disponivel
                        ? `${numTexto(d.indicadores.perdas.taxa_total_pct, 2)}%`
                        : emPortugues(motivoLegivel(d.indicadores.perdas.motivo) ?? "", "territorio-motivo"),
                      d.indicadores.tarifa.disponivel ? `R$ ${numTexto(d.indicadores.tarifa.total_rs_mwh, 2)}/MWh` : emPortugues(d.indicadores.tarifa.motivo, "territorio-motivo"),
                    ])}
                  />
                </SecaoDoPainel>

                <SecaoDoPainel nivel="auditar" titulo={tx("Como o submercado de cada UF foi conferido", "How each state's submarket was checked")} id="territorio-areas-carga">
                  <p className="max-w-prose2 text-sm text-carvao-muted">
                    {tx(
                      <>
                        Hipótese: {g.areas_carga.hipotese_de}. {textoLegivel(g.areas_carga.regra)}
                      </>,
                      <>
                        Hypothesis: <Nome>{g.areas_carga.hipotese_de}</Nome>. <TrechoPortugues regiao="territorio-areas-carga">{textoLegivel(g.areas_carga.regra)}</TrechoPortugues>
                      </>,
                    )}
                  </p>
                  <p className="max-w-prose2 text-sm text-carvao-muted" data-teste-de-carga="">
                    {textoTesteDeCarga(g)}
                  </p>
                  <TerritorioTabela
                    titulo={tx(
                      `Fechamento por submercado nos dias conferidos (ONS, ${g.areas_carga.fonte.conjunto})`,
                      `Closure by submarket on the days checked (ONS, ${rotuloDado(g.areas_carga.fonte.conjunto, CONJUNTO_TERRITORIO_EN, idioma)})`,
                    )}
                    colunas={tx(
                      ["Submercado", "Dia", "Carga do submercado (MWmed)", "Soma das áreas (MWmed)", "Resíduo das médias (MWmed)", "Mediana do resíduo por meia hora (MWmed)", "Máximo (MWmed)", "Meias horas", "Tolerância (MWmed)"],
                      ["Submarket", "Day", "Submarket load (MWavg)", "Sum of the areas (MWavg)", "Residual of the averages (MWavg)", "Median residual per half hour (MWavg)", "Maximum (MWavg)", "Half hours", "Tolerance (MWavg)"],
                    )}
                    numericas={[2, 3, 4, 5, 6, 7, 8]}
                    linhas={g.submercados.flatMap((s) =>
                      s.conferencia.map((c) => [
                        `${nomeSm(s.sm, idioma)} (${c.area_perdas})`,
                        dataBR(c.dia),
                        num(c.submercado_mwmed, 2),
                        num(c.soma_areas_mwmed, 2),
                        num(c.residuo_mwmed, 3),
                        num(c.mediana_abs_mwmed, 3),
                        num(c.max_abs_mwmed, 3),
                        inteiro(c.meias_horas),
                        num(c.tolerancia_mwmed, 1),
                      ]),
                    )}
                  />
                  <TerritorioTabela
                    titulo={tx("Alternativas testadas em cada dia (mover uma área ou trocar duas)", "Alternatives tested on each day (move one area or swap two)")}
                    colunas={tx(
                      ["Dia", "Fecha", "Ruído da hipótese (MWmed)", "Menor alternativa por meia hora", "Menor alternativa pelas médias do dia", "Avaliadas", "Fechariam pelas médias do dia", "Áreas sem carga"],
                      ["Day", "Closes", "Noise of the hypothesis (MWavg)", "Smallest alternative per half hour", "Smallest alternative by the day's averages", "Evaluated", "Would close by the day's averages", "Areas without load"],
                    )}
                    numericas={[2, 5]}
                    linhas={g.areas_carga.conferencias.map((c) => [
                      dataBR(c.dia),
                      c.fecha === null ? tx("sem conferência", "not checked") : simNao(c.fecha, idioma),
                      numTexto(c.ruido_mwmed, 3),
                      c.menor_alternativa
                        ? tx<ReactNode>(
                            `${c.menor_alternativa.descricao}: ${numTexto(c.menor_alternativa.mediana_abs_mwmed, 1)} MWmed`,
                            <>
                              <TrechoPortugues regiao="territorio-alternativa">{c.menor_alternativa.descricao}</TrechoPortugues>: {numTexto(c.menor_alternativa.mediana_abs_mwmed, 1)} MWavg
                            </>,
                          )
                        : nenhuma,
                      c.menor_alternativa_pelas_medias
                        ? tx<ReactNode>(
                            `${c.menor_alternativa_pelas_medias.descricao}: ${numTexto(c.menor_alternativa_pelas_medias.residuo_medias_dia_mwmed, 1)} MWmed`,
                            <>
                              <TrechoPortugues regiao="territorio-alternativa">{c.menor_alternativa_pelas_medias.descricao}</TrechoPortugues>:{" "}
                              {numTexto(c.menor_alternativa_pelas_medias.residuo_medias_dia_mwmed, 1)} MWavg
                            </>,
                          )
                        : nenhuma,
                      inteiro(c.alternativas_avaliadas),
                      c.alternativas_que_fechariam_pelas_medias.length ? emPortugues(c.alternativas_que_fechariam_pelas_medias.join("; "), "territorio-alternativa") : nenhuma,
                      c.areas_indeterminadas.length ? nome(c.areas_indeterminadas.join(", ")) : nenhuma,
                    ])}
                  />
                  <TerritorioTabela
                    titulo={tx("Subsistema de cada UF: camada da EPE, módulo Água e módulo Carga", "Subsystem of each state: EPE layer, Water module and Load module")}
                    colunas={tx(["UF", "EPE (camada 24)", "Água e clima", "Carga", "Estado da prova"], ["State", "EPE (layer 24)", "Water and climate", "Load", "Status of the check"])}
                    linhas={g.ufs.map((x) => [
                      x.uf,
                      g.areas_carga.mapeamento_epe[x.uf] ?? curto(null),
                      g.areas_carga.mapeamento_agua[x.uf] ?? curto(null),
                      g.areas_carga.mapeamento_carga[x.uf] ?? curto(null),
                      ROTULO_ESTADO_SM[x.estado_subsistema],
                    ])}
                  />
                  {g.areas_carga.epe && (
                    <p className="text-xs text-carvao-muted">
                      {tx(
                        <>
                          Camada da EPE capturada em {carimbo(g.areas_carga.epe.capturado_em)}, sha256 {curto(g.areas_carga.epe.sha256)}. Dicionário do ONS versão {g.areas_carga.fonte.dicionario_versao}, sha256{" "}
                          {curto(g.areas_carga.fonte.dicionario_sha256)}.
                        </>,
                        <>
                          EPE layer captured on {carimbo(g.areas_carga.epe.capturado_em)}, sha256 {curto(g.areas_carga.epe.sha256)}. ONS dictionary version {g.areas_carga.fonte.dicionario_versao}, sha256{" "}
                          {curto(g.areas_carga.fonte.dicionario_sha256)}.
                        </>,
                      )}
                    </p>
                  )}
                </SecaoDoPainel>

                <SecaoDoPainel nivel="auditar" titulo={tx("Controles executados nesta publicação", "Checks run in this release")} id="territorio-controles">
                  <TerritorioTabela
                    titulo={tx(`${inteiro(g.controles.length)} controles (os críticos derrubam a publicação)`, `${inteiro(g.controles.length)} checks (the critical ones block the release)`)}
                    colunas={tx(["Controle", "Resultado", "Crítico", "Detalhe"], ["Check", "Result", "Critical", "Detail"])}
                    linhas={g.controles.map((c) => [
                      emPortugues(textoLegivel(c.nome), "territorio-controle"),
                      rotuloDado(c.resultado, RESULTADO_CONTROLE_EN, idioma),
                      simNao(c.critico, idioma),
                      emPortugues(textoLegivel(datasLegiveis(c.detalhe, "pt")), "territorio-controle"),
                    ])}
                  />
                  {g.ressalvas.length > 0 && (
                    <ul className="max-w-prose2 list-disc space-y-1 pl-5 text-sm text-carvao-muted">
                      {g.ressalvas.map((x) => (
                        <li key={x}>{emPortugues(textoLegivel(datasLegiveis(x, "pt")), "territorio-ressalva")}</li>
                      ))}
                    </ul>
                  )}
                </SecaoDoPainel>

                <SecaoDoPainel nivel="auditar" titulo={tx("Vínculos com ressalva", "Links with a caveat")} id="territorio-vinculos">
                  <TerritorioTabela
                    titulo={tx(
                      `Municípios em que a relação de Perdas (${g.referencias.relacao_distribuidoras_ano ?? "sem data"}) e os conjuntos de Qualidade (${g.referencias.qualidade_ano ?? "sem data"}) listam distribuidoras diferentes`,
                      `Municipalities where the Losses list (${g.referencias.relacao_distribuidoras_ano ?? semData}) and the Quality consumer sets (${g.referencias.qualidade_ano ?? semData}) list different distribution utilities`,
                    )}
                    colunas={tx(
                      ["Município", "UF", "Código IBGE", "Relação (Perdas)", "Conjuntos (Qualidade)"],
                      ["Municipality", "State", "IBGE code", "List (Losses)", "Consumer sets (Quality)"],
                    )}
                    linhas={r.distribuidoras_por_municipio_perdas_x_qualidade.map((x) => [
                      nome(x.nome),
                      x.uf,
                      x.codigo,
                      x.perdas.length ? nome(x.perdas.map(sigla).join(", ")) : nenhuma,
                      x.qualidade.length ? nome(x.qualidade.map(sigla).join(", ")) : nenhuma,
                    ])}
                  />
                  <p className="max-w-prose2 text-sm text-carvao-muted">
                    {tx(
                      <>
                        Sem vínculo: {r.municipios_sem_vinculo.map((x) => `${x.nome} (${x.uf}, ${x.codigo})`).join("; ") || "nenhum"}. Só com vínculo sem confirmação (códigos IBGE):{" "}
                        {r.municipios_so_vinculo_nao_confirmado.join(", ") || "nenhum"}. Códigos da relação fora da malha do IBGE:{" "}
                        {r.codigos_da_relacao_fora_da_malha.map((x) => `${x.codigo} (${x.distribuidoras.map(sigla).join(", ")})`).join("; ") || "nenhum"}.
                      </>,
                      <>
                        No link: {r.municipios_sem_vinculo.length ? <Nome>{r.municipios_sem_vinculo.map((x) => `${x.nome} (${x.uf}, ${x.codigo})`).join("; ")}</Nome> : nenhum}. Only with an
                        unconfirmed link (IBGE codes): {r.municipios_so_vinculo_nao_confirmado.join(", ") || nenhum}. List codes outside the IBGE map:{" "}
                        {r.codigos_da_relacao_fora_da_malha.length ? (
                          <Nome>{r.codigos_da_relacao_fora_da_malha.map((x) => `${x.codigo} (${x.distribuidoras.map(sigla).join(", ")})`).join("; ")}</Nome>
                        ) : (
                          nenhum
                        )}
                        .
                      </>,
                    )}
                  </p>
                </SecaoDoPainel>

                <SecaoDoPainel nivel="auditar" titulo={tx("Usinas: municípios declarados e coordenadas", "Plants: declared municipalities and coordinates")} id="territorio-usinas">
                  <TerritorioTabela
                    titulo={tx(`Conferência das ${inteiro(u.total)} usinas do SIGA`, `Check of the ${inteiro(u.total)} SIGA plants`)}
                    colunas={tx(["Conferência", "Usinas"], ["Check", "Plants"])}
                    numericas={[1]}
                    linhas={[
                      [tx("Todos os municípios reconhecidos no IBGE", "All municipalities recognized in the IBGE"), inteiro(u.todos_municipios_reconhecidos)],
                      [tx("Reconhecidas pela tabela de grafias antigas (DTB)", "Recognized through the table of old spellings (DTB)"), inteiro(u.via_grafia_antiga)],
                      [tx("Parcialmente reconhecidas", "Partly recognized"), inteiro(u.parcialmente_reconhecidos)],
                      [tx("Sem município reconhecido", "No recognized municipality"), inteiro(u.sem_municipio_reconhecido)],
                      [tx("Em mais de um município (potência não repartida)", "In more than one municipality (capacity not split)"), inteiro(u.multimunicipio)],
                      [tx("Com coordenada", "With a coordinate"), inteiro(u.com_coordenada)],
                      [
                        tx(
                          `Coordenada no município declarado (malha ${u.conferencia_coordenada.conferencia === "maxima" ? "de qualidade máxima" : "simplificada, aproximada"})`,
                          `Coordinate in the declared municipality (${u.conferencia_coordenada.conferencia === "maxima" ? "maximum-quality" : "simplified, approximate"} map)`,
                        ),
                        inteiro(u.coordenada_no_municipio_declarado),
                      ],
                      [tx("Coordenada fora do município declarado", "Coordinate outside the declared municipality"), inteiro(u.coordenada_fora_do_municipio_declarado)],
                      [tx("Coordenada fora de qualquer município", "Coordinate outside any municipality"), inteiro(u.coordenada_fora_da_malha)],
                      [
                        tx(`Registros de até ${num(u.limite_registro_kw, 0)} kW em operação (coluna própria)`, `Registrations of up to ${num(u.limite_registro_kw, 0)} kW in operation (own column)`),
                        inteiro(u.registros_ate_10kw),
                      ],
                    ]}
                  />
                  <TerritorioTabela
                    titulo={tx("Nomes de município que o SIGA declara e o IBGE não reconhece", "Municipality names that SIGA declares and the IBGE does not recognize")}
                    colunas={tx(["Nome na fonte", "UF", "Citações"], ["Name in the source", "State", "Citations"])}
                    numericas={[2]}
                    linhas={u.nomes_nao_reconhecidos.map((x) => [nome(x.nome), x.uf ?? tx("sem UF", "no state"), inteiro(x.citacoes)])}
                  />
                </SecaoDoPainel>

                <SecaoDoPainel nivel="auditar" titulo={tx("O que não foi possível obter", "What could not be obtained")} id="territorio-bloqueios">
                  {g.bloqueios.map((b) => {
                    const evidencia = evidenciaLegivel(b.evidencia);
                    return (
                      <div key={b.item} className="space-y-1 text-sm">
                        <p className="font-medium text-carvao">{emPortugues(b.item, "territorio-bloqueio")}</p>
                        <ul className="list-disc space-y-0.5 pl-5 text-carvao-muted">
                          {b.tentativas.map((t) => (
                            <li key={t}>{emPortugues(textoLegivel(t), "territorio-bloqueio")}</li>
                          ))}
                        </ul>
                        <p className="text-carvao-muted">
                          {tx("Evidência:", "Evidence:")}{" "}
                          {evidencia.href ? (
                            <a href={hrefNoIdioma(evidencia.href, idioma)} className="text-energia-dark underline underline-offset-4 hover:text-carvao">
                              {evidencia.texto}
                            </a>
                          ) : (
                            evidencia.texto
                          )}
                          {tx(". Dependência: ", ". Dependency: ")}
                          {emPortugues(textoLegivel(b.dependencia), "territorio-bloqueio")}.
                        </p>
                      </div>
                    );
                  })}
                  <div className="max-w-prose2 space-y-1 text-sm">
                    <p className="font-medium text-carvao">{tx("Conferência da camada de subsistemas da EPE por quem lê", "Checking the EPE subsystem layer yourself")}</p>
                    <p className="text-carvao-muted">
                      {tx(
                        <>
                          A tabela de UF e subsistema vem da camada 24 do serviço de mapas da EPE, capturada em {carimbo(g.referencias.subsistema_uf_epe_capturado_em)}, com data e sha256 registrados. A captura bruta fica no
                          repositório de dados do observatório e não é publicada no site. O serviço da EPE pode responder que exige credencial (&quot;Token Required&quot;) a quem consulta a camada, e a recoleta pode falhar: a
                          conferência por quem lê depende do acesso ao serviço, e a publicação mantém a última captura válida.
                        </>,
                        <>
                          The state and subsystem table comes from layer 24 of EPE&apos;s map service, captured on {carimbo(g.referencias.subsistema_uf_epe_capturado_em)}, with date and sha256 recorded. The raw
                          capture stays in the observatory&apos;s data repository and is not published on the site. The EPE service may reply that it requires a credential (&quot;Token Required&quot;) to whoever
                          queries the layer, and the recollection may fail: checking it yourself depends on access to the service, and the release keeps the last valid capture.
                        </>,
                      )}
                    </p>
                  </div>
                  <ul className="max-w-prose2 list-disc space-y-1 pl-5 text-sm text-carvao-muted">
                    {g.limitacoes.map((x) => (
                      <li key={x}>{emPortugues(textoLegivel(x), "territorio-limitacao")}</li>
                    ))}
                  </ul>
                </SecaoDoPainel>

                <SecaoDoPainel nivel="auditar" titulo={tx("Arquivos lidos dos módulos de origem", "Files read from the source modules")} id="territorio-insumos">
                  <p className="max-w-prose2 text-sm text-carvao-muted" data-insumos-resumo="">
                    {tx(
                      "O índice registrou o sha256 de cada arquivo que leu. A tabela compara esse valor com o sha256 do arquivo servido, recalculado na hora de montar esta página.",
                      "The index recorded the sha256 of each file it read. The table compares this value with the sha256 of the served file, recalculated when building this page.",
                    )}{" "}
                    {textoInsumos}
                  </p>
                  <TerritorioTabela
                    titulo={tx(
                      `${inteiro(g.insumos.length)} arquivos lidos: o sha256 do índice e a situação do arquivo servido`,
                      `${inteiro(g.insumos.length)} files read: the index's sha256 and the status of the served file`,
                    )}
                    colunas={tx(
                      ["Módulo", "Arquivo", "Gerado em (no índice)", "sha256 do índice", "Situação"],
                      ["Module", "File", "Generated on (in the index)", "Index sha256", "Status"],
                    )}
                    linhas={g.insumos.map((x) => {
                      const st = situacaoPorChave.get(x.chave);
                      const situacao =
                        !st || st.confere === null
                          ? tx("arquivo não lido na montagem da página", "file not read when building the page")
                          : st.confere
                            ? tx("confere", "matches")
                            : tx(
                                `o arquivo mudou depois do índice (${st.regeradoEm ? `regerado em ${carimbo(st.regeradoEm)}` : "sem data de geração no arquivo"}); sha256 do arquivo servido ${curto(st.sha256Atual)}`,
                                `the file changed after the index (${st.regeradoEm ? `regenerated on ${carimbo(st.regeradoEm)}` : "no generation date in the file"}); sha256 of the served file ${curto(st.sha256Atual)}`,
                              );
                      return [
                        rotuloDado(x.modulo, MODULO_ID_EN, idioma),
                        <span key={x.chave} className="break-all">
                          <Nome>{x.url}</Nome>
                        </span>, carimbo(x.gerado_em), curto(x.sha256), <span key={`${x.chave}-s`} data-situacao-insumo={st?.confere === true ? "confere" : st?.confere === false ? "mudou" : "sem-leitura"}>{situacao}</span>];
                    })}
                  />
                  <p className="text-xs text-carvao-muted">
                    {tx(
                      <>
                        Geometria: {g.geometria.fonte ?? "sem fonte registrada"}, capturada em {carimbo(g.geometria.capturado_em)}, sha256 {curto(g.geometria.sha256)}.
                      </>,
                      <>
                        Geometry: {g.geometria.fonte ? <Nome>{g.geometria.fonte}</Nome> : "no source recorded"}, captured on {carimbo(g.geometria.capturado_em)}, sha256 {curto(g.geometria.sha256)}.
                      </>,
                    )}
                  </p>
                </SecaoDoPainel>

                <SeguirPainel
                  ancora={ID_PAINEL}
                  proximo={{ href: prox.href, pergunta: prox.pergunta }}
                  downloads={g.downloads.map((d) => ({ ...d, rotulo: rotuloDado(d.rotulo, DOWNLOAD_TERRITORIO_EN, idioma) }))}
                />
              </div>
            </PainelEvidencia>
        </ModoProfundidade>
      </main>
    </>
  );
}
