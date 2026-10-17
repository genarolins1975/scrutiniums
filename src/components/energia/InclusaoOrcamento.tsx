"use client";

import { useMemo, type ReactNode } from "react";
import { Comparador } from "@/components/energia/Comparador";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { InclusaoOpcoes } from "@/components/energia/InclusaoOpcoes";
import { MapaCoropletico } from "@/components/energia/MapaCoropletico";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { quebrasQuantis } from "@/lib/energia/escalas";
import { URL_GEO } from "@/lib/energia/geo";
import { dadoNo, txEm } from "@/lib/energia/i18n/conta-inclusao";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";
import type { Idioma } from "@/lib/idioma";
import {
  ESQUEMA_ORCAMENTO,
  TERRITORIOS_POF,
  codigoUf,
  colunasLimiares,
  colunasTabelaPof,
  colunasUfsPof,
  dadosClassesPof,
  dadosComparacaoPof,
  linhasLimiaresPof,
  linhasTabelaPof,
  linhasUfsPof,
  medidasBase,
  nomePof,
  nomeTerritorio as nomeTerritorioEm,
  siglaDoCodigo,
  textoPrecisaoPof,
  valoresMapaPof,
  type BasePof,
  type LimiarPof,
  type MedidaMapaPof,
  type OrcamentoBase,
} from "@/lib/energia/inclusao";
import type { MedidaPof } from "@/lib/energia/tipos-inclusao";

/**
 * P061, peso no orçamento (POF 2017-2018). O painel é repartido em figuras com pergunta própria, e todas leem o mesmo estado da
 * URL (useEstadoUrl avisa as instâncias entre si). InclusaoOrcamentoPainel reúne as figuras num só componente de cliente: os dados
 * da pesquisa (Brasil e regiões por classe, e as UF) chegam uma vez só ao cliente, e não uma vez por figura.
 *  - A figura principal é a despesa com energia por classe de rendimento (a razão de médias, que é a "distribuição" do IBGE, ao lado
 *    da média das participações família a família e da mediana, porque uma não substitui a outra), com a base da participação
 *    (despesa total ou renda). Recebe a resposta, o recorte e as notas já prontos, para a figura vir primeiro e a ressalva ficar
 *    junto dela;
 *  - até quatro territórios (Brasil e grandes regiões, os domínios que a amostra sustenta por classe) na mesma escala: o primeiro
 *    território escolhido detalha a figura principal;
 *  - famílias acima de 3%, 5% ou 10% da renda e da despesa, como sensibilidade;
 *  - as UF só no total (mapa em Entender, tabela em Analisar), com a precisão de cada estimativa;
 *  - todas as medidas do território principal, com o coeficiente de variação de cada uma (Analisar).
 *
 * Valor suprimido pela precisão (CV acima de 30%) chega nulo e é desenhado como ausência, nunca como zero. Nada municipal: a POF
 * não permite.
 */

const CORES_MEDIDAS = ["var(--cor-energia)", "var(--serie-comp-2)", "var(--serie-referencia)"]; // i18n: dado
const CORES_TER = ["var(--serie-comp-1)", "var(--serie-comp-2)", "var(--serie-comp-3)", "var(--serie-comp-4)"];
function opcoesBase(tx: <T>(pt: T, en: T) => T): readonly (readonly [BasePof, string])[] {
  return [
    ["despesa", tx("Na despesa total", "In total expense")],
    ["renda", tx("Na renda", "In income")],
  ];
}
// i18n: dado (o rótulo é o próprio percentual)
const OPCOES_LIM: readonly (readonly [LimiarPof, string])[] = [
  ["3", "3%"],
  ["5", "5%"],
  ["10", "10%"],
];

/** Nome do território (Brasil e grandes regiões) no idioma da página. */
function useNomeTerritorio(): (t: string) => string {
  const idioma = useIdioma();
  return (t: string) => nomeTerritorioEm(t, idioma);
}

/** "na despesa total" / "na renda" no idioma. */
function naBase(base: BasePof, tx: <T>(pt: T, en: T) => T): string {
  return base === "despesa" ? tx("na despesa total", "in total expense") : tx("na renda", "in income");
}

function InclusaoClassesPof({
  orc,
  resposta,
  medidas: destaques,
  recorte,
  notas,
}: {
  orc: OrcamentoBase;
  resposta?: ReactNode;
  /** Medidas que o gráfico desenha na segunda série (média das participações), com a ficha de prova de cada uma. */
  medidas?: ReactNode;
  recorte?: ReactNode;
  notas?: ReactNode;
}) {
  const idioma = useIdioma();
  const tx = useTx();
  const nomeTerritorio = useNomeTerritorio();
  const [v, definir] = useEstadoUrl(ESQUEMA_ORCAMENTO);
  const ters = useMemo(() => (v.ter.length ? v.ter : ["BR"]), [v.ter]);
  const principal = ters[0];
  const medidas = medidasBase(idioma)[v.base];
  const dados = useMemo(() => dadosClassesPof(orc, principal, v.base, idioma), [orc, principal, v.base, idioma]);
  const total = medidas.map((m) => orc.linhas.find((l) => l.territorio === principal && l.classe === "7999")?.microdados[m.id]?.[0] ?? null);
  const refTotal = total[0];

  return (
    <div className="space-y-6">
      <div className="grid gap-x-10 gap-y-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        {resposta}
        <InclusaoOpcoes rotulo={tx("Participação", "Share")} nome="inclusao-pof-base" opcoes={opcoesBase(tx)} valor={v.base} onMudar={(base) => definir({ base })} />
      </div>
      <GraficoBarras
        titulo={tx(
          `Energia elétrica ${naBase(v.base, tx)} por classe de rendimento, ${nomeTerritorio(principal)} (${nomePof(orc)})`,
          `Electricity ${naBase(v.base, tx)} by income class, ${nomeTerritorio(principal)} (${nomePof(orc)})`,
        )}
        dados={dados}
        chaveCategoria="id"
        chaveRotulo="rotulo"
        series={medidas.map((m, i) => ({ id: m.id, rotulo: m.rotulo, cor: CORES_MEDIDAS[i] }))}
        unidade="%"
        casas={2}
        referencias={
          refTotal !== null
            ? [
                {
                  valor: refTotal,
                  rotulo: tx(`${medidas[0].rotulo}, todas as famílias (${nomeTerritorio(principal)})`, `${medidas[0].rotulo}, all families (${nomeTerritorio(principal)})`),
                },
              ]
            : []
        }
        orientacao="horizontal"
        rotulosValor
        alturaMaxima={900}
      />
      {destaques}
      {recorte}
      {notas}
    </div>
  );
}

function InclusaoTerritoriosPof({ orc }: { orc: OrcamentoBase }) {
  const idioma = useIdioma();
  const tx = useTx();
  const nomeTerritorio = useNomeTerritorio();
  const [v, definir] = useEstadoUrl(ESQUEMA_ORCAMENTO);
  const ters = useMemo(() => (v.ter.length ? v.ter : ["BR"]), [v.ter]);
  const medidas = medidasBase(idioma)[v.base];
  const medidaComp: MedidaPof = medidas[0].id;
  const comp = useMemo(() => dadosComparacaoPof(orc, ters, medidaComp, idioma), [orc, ters, medidaComp, idioma]);
  const entidades = TERRITORIOS_POF.map((t) => ({ id: t, rotulo: nomeTerritorio(t) }));
  return (
    <div className="space-y-5">
      <Comparador
        rotulo={tx("Territórios (até 4; o primeiro detalha as medidas)", "Territories (up to 4; the first one details the measures)")}
        entidades={entidades}
        selecionadas={ters}
        onMudar={(ids) => definir({ ter: ids.length ? ids : ["BR"] })}
        dicaBusca={tx("Brasil ou região", "Brazil or region")}
        vazio={tx("Sem território escolhido: vale o Brasil.", "No territory chosen: Brazil applies.")}
      >
        {() => null}
      </Comparador>
      {ters.length > 1 ? (
        <GraficoBarras
          titulo={tx(
            `${medidas[0].rotulo} ${naBase(v.base, tx)} por classe: ${ters.map(nomeTerritorio).join(", ")}`,
            `${medidas[0].rotulo} ${naBase(v.base, tx)} by class: ${ters.map(nomeTerritorio).join(", ")}`,
          )}
          dados={comp}
          chaveCategoria="id"
          chaveRotulo="rotulo"
          series={ters.map((t, i) => ({ id: t, rotulo: nomeTerritorio(t), cor: CORES_TER[i % CORES_TER.length] }))}
          unidade="%"
          casas={2}
          orientacao="horizontal"
          rotulosValor
          alturaMaxima={900}
        />
      ) : (
        <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
          {tx(
            "Escolha mais um território para ver as classes de rendimento lado a lado, na mesma escala. A figura principal, acima, segue o primeiro território escolhido.",
            "Choose one more territory to see the income classes side by side, on the same scale. The main figure, above, follows the first territory chosen.",
          )}
        </p>
      )}
    </div>
  );
}

function InclusaoLimiaresPof({ orc, fonte }: { orc: OrcamentoBase; fonte: string }) {
  const idioma = useIdioma();
  const tx = useTx();
  const nomeTerritorio = useNomeTerritorio();
  const [v, definir] = useEstadoUrl(ESQUEMA_ORCAMENTO);
  const ters = useMemo(() => (v.ter.length ? v.ter : ["BR"]), [v.ter]);
  const principal = ters[0];
  const limiares = useMemo(() => linhasLimiaresPof(orc, principal, v.lim, idioma), [orc, principal, v.lim, idioma]);
  const limiaresTexto = orc.limiares_pct.map((x) => `${x.toLocaleString(tx("pt-BR", "en-US"))}%`).join(", ");
  return (
    <div className="space-y-4">
      <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
        {tx(
          <>
            Limiares de {limiaresTexto} da renda e da despesa total como análise de sensibilidade, não como definição de pobreza
            energética: a leitura muda com o limiar, e a tabela mostra quanto. {nomeTerritorio(principal)}, famílias de cada classe acima do limiar escolhido.
          </>,
          <>
            Thresholds of {limiaresTexto} of income and of total expense as a sensitivity analysis, not as a definition of energy poverty: the reading changes with the threshold,
            and the table shows by how much. {nomeTerritorio(principal)}, families of each class above the chosen threshold.
          </>,
        )}
      </p>
      <InclusaoOpcoes rotulo={tx("Limiar", "Threshold")} nome="inclusao-pof-lim" opcoes={OPCOES_LIM} valor={v.lim} onMudar={(lim) => definir({ lim })} />
      <GraficoBarras
        titulo={tx(
          `Famílias com energia acima de ${v.lim}% da renda e da despesa total, ${nomeTerritorio(principal)}`,
          `Families with energy above ${v.lim}% of income and of total expense, ${nomeTerritorio(principal)}`,
        )}
        dados={limiares.map((l) => ({ id: l.id, rotulo: l.classe, renda: l.renda, despesa: l.despesa }))}
        chaveCategoria="id"
        chaveRotulo="rotulo"
        series={[
          { id: "renda", rotulo: tx(`Acima de ${v.lim}% da renda`, `Above ${v.lim}% of income`), cor: "var(--serie-comp-1)" },
          { id: "despesa", rotulo: tx(`Acima de ${v.lim}% da despesa`, `Above ${v.lim}% of expense`), cor: "var(--serie-comp-3)" },
        ]}
        unidade={tx("% das famílias", "% of families")}
        casas={1}
        orientacao="horizontal"
        rotulosValor
        alturaMaxima={900}
      />
      <TabelaInterativa
        titulo={tx(`Sensibilidade ao limiar de ${v.lim}%, ${nomeTerritorio(principal)}`, `Sensitivity to the ${v.lim}% threshold, ${nomeTerritorio(principal)}`)}
        colunas={colunasLimiares(idioma)}
        linhas={limiares}
        chaveLinha="id"
        colunaRotulo="classe"
        fonte={fonte}
        versao={orc.referencia}
        nomeArquivo={`inclusao-pof-limiar-${v.lim}-${principal}`}
        chaveUrl="pof.limt"
        nota={tx(
          `${textoPrecisaoPof(orc.regra_precisao, idioma)} Zero na amostra não prova zero na população.`,
          `${textoPrecisaoPof(orc.regra_precisao, idioma)} Zero in the sample does not prove zero in the population.`,
        )}
      />
    </div>
  );
}

function InclusaoTabelaPof({ orc, fonte }: { orc: OrcamentoBase; fonte: string }) {
  const idioma = useIdioma();
  const tx = useTx();
  const nomeTerritorio = useNomeTerritorio();
  const [v] = useEstadoUrl(ESQUEMA_ORCAMENTO);
  const ters = useMemo(() => (v.ter.length ? v.ter : ["BR"]), [v.ter]);
  const principal = ters[0];
  const tabela = useMemo(() => linhasTabelaPof(orc, principal, idioma), [orc, principal, idioma]);
  const colunas = useMemo(() => colunasTabelaPof(orc, idioma), [orc, idioma]);
  return (
    <TabelaInterativa
      titulo={tx(
        `${nomePof(orc)}: energia no orçamento, ${nomeTerritorio(principal)}, por classe de rendimento`,
        `${nomePof(orc)}: energy in the budget, ${nomeTerritorio(principal)}, by income class`,
      )}
      colunas={colunas}
      linhas={tabela}
      chaveLinha="id"
      colunaRotulo="classe"
      fonte={fonte}
      versao={orc.referencia}
      nomeArquivo={`inclusao-pof-${principal}`}
      chaveUrl="pof.med"
      nota={dadoNo(orc.formato_microdados, "formato-microdados-pof", idioma)}
    />
  );
}

function opcoesMapa(idioma: Idioma): readonly (readonly [MedidaMapaPof, string])[] {
  const tx = txEm(idioma);
  return [
    ["razao_medias_pct", tx("Razão de médias (despesa)", "Ratio of averages (expense)")],
    ["media_razoes_desp_pct", tx("Média das participações (despesa)", "Average of shares (expense)")],
    ["media_razoes_renda_pct", tx("Média das participações (renda)", "Average of shares (income)")],
    ["energia_media", tx("Despesa média com energia", "Average electricity expense")],
  ];
}
const CORES_MAPA = ["var(--escala-seq-1)", "var(--escala-seq-2)", "var(--escala-seq-3)", "var(--escala-seq-4)", "var(--escala-seq-5)"];

function InclusaoMapaUfsPof({ orc, periodo, unidadeReais }: { orc: OrcamentoBase; periodo: string; unidadeReais: string }) {
  const idioma = useIdioma();
  const tx = useTx();
  const [v, definir] = useEstadoUrl(ESQUEMA_ORCAMENTO);
  const valores = useMemo(() => valoresMapaPof(orc, v.mapa), [orc, v.mapa]);
  const ehReais = v.mapa === "energia_media"; // i18n: dado
  const classes = useMemo(() => quebrasQuantis(Object.values(valores), CORES_MAPA.length, { casas: ehReais ? 0 : 1 }), [valores, ehReais]);
  const linhas = useMemo(() => linhasUfsPof(orc, idioma), [orc, idioma]);
  const sel = linhas.some((l) => l.uf === v.uf) ? v.uf : null;
  const opcoes = opcoesMapa(idioma);
  const rotulo = opcoes.find(([id]) => id === v.mapa)?.[1] ?? v.mapa;
  return (
    <div className="space-y-5">
      <InclusaoOpcoes rotulo={tx("Mapa", "Map")} nome="inclusao-pof-mapa" opcoes={opcoes} valor={v.mapa} onMudar={(mapa) => definir({ mapa })} />
      <MapaCoropletico
        titulo={tx(`${rotulo} por UF, todas as classes de rendimento (${nomePof(orc)})`, `${rotulo} by state, all income classes (${nomePof(orc)})`)}
        fonteGeometria={URL_GEO.uf}
        valores={valores}
        cores={CORES_MAPA}
        classificacao={classes}
        unidade={ehReais ? unidadeReais : "%"}
        casas={2}
        rotuloRegiao={tx({ singular: "UF", plural: "UF" }, { singular: "state", plural: "states" })}
        selecionado={sel ? codigoUf(sel) : null}
        onSelecionar={(id) => definir({ uf: siglaDoCodigo(id) ?? "" })}
        rotulos
        periodo={periodo}
        nota={tx(
          "Estimativa amostral por UF, só no total (a amostra por classe nas UF é pequena demais). Sem mapa municipal: a POF não permite.",
          "Sample estimate by state, total only (the sample by class in the states is too small). No municipal map: the POF does not allow it.",
        )}
      />
    </div>
  );
}

function InclusaoTabelaUfsPof({ orc, fonte }: { orc: OrcamentoBase; fonte: string }) {
  const idioma = useIdioma();
  const tx = useTx();
  const [v, definir] = useEstadoUrl(ESQUEMA_ORCAMENTO);
  const linhas = useMemo(() => linhasUfsPof(orc, idioma), [orc, idioma]);
  const colunas = useMemo(() => colunasUfsPof(orc, idioma), [orc, idioma]);
  const sel = linhas.some((l) => l.uf === v.uf) ? v.uf : null;
  return (
    <TabelaInterativa
      titulo={tx(`${nomePof(orc)} por UF (todas as classes), com coeficiente de variação`, `${nomePof(orc)} by state (all classes), with coefficient of variation`)}
      colunas={colunas}
      linhas={linhas}
      chaveLinha="id"
      colunaRotulo="nome"
      fonte={fonte}
      versao={orc.referencia}
      nomeArquivo="inclusao-pof-uf"
      chaveUrl="pof.tab"
      ordemInicial={{ coluna: "razao_medias_pct", direcao: "desc" }}
      selecionado={sel}
      onSelecionar={(id) => definir({ uf: id ?? "" })}
      dicaBusca={tx("Nome ou sigla da UF", "State name or abbreviation")}
      nota={tx(
        `${textoPrecisaoPof(orc.regra_precisao, idioma)} A coluna de precisão diz o estado de cada valor.`,
        `${textoPrecisaoPof(orc.regra_precisao, idioma)} The precision column gives the status of each value.`,
      )}
    />
  );
}

export function InclusaoOrcamentoPainel({
  classes,
  ufs,
  fonte,
  periodo,
  unidadeReais,
  resposta,
  medidas,
  recorte,
  notas,
}: {
  /** Brasil e grandes regiões por classe de rendimento. */
  classes: OrcamentoBase;
  /** As UF, só no total das famílias. */
  ufs: OrcamentoBase;
  fonte: string;
  periodo: string;
  unidadeReais: string;
  resposta?: ReactNode;
  medidas?: ReactNode;
  recorte?: ReactNode;
  notas?: ReactNode;
}) {
  const tx = useTx();
  return (
    <div className="space-y-6">
      <InclusaoClassesPof orc={classes} resposta={resposta} medidas={medidas} recorte={recorte} notas={notas} />

      <SecaoDoPainel id="territorios" titulo={tx("Brasil e grandes regiões, na mesma escala", "Brazil and major regions, on the same scale")}>
        <InclusaoTerritoriosPof orc={classes} />
      </SecaoDoPainel>

      <SecaoDoPainel id="limiares" titulo={tx("Quantas famílias passam de um limiar de comprometimento?", "How many families exceed a burden threshold?")}>
        <InclusaoLimiaresPof orc={classes} fonte={fonte} />
      </SecaoDoPainel>

      <SecaoDoPainel
        id="ufs"
        titulo={tx("E por UF, no total das famílias?", "And by state, for all families?")}
        lead={tx(
          "O peso da energia em cada UF, sem separar por faixa de renda: a amostra por classe nas UF é pequena demais.",
          "The weight of energy in each state, without splitting by income bracket: the sample by class in the states is too small.",
        )}
      >
        <InclusaoMapaUfsPof orc={ufs} periodo={periodo} unidadeReais={unidadeReais} />
      </SecaoDoPainel>

      <SecaoDoPainel id="todas-medidas" nivel="analisar" titulo={tx("Todas as medidas do território, com a precisão de cada uma", "All measures for the territory, with the precision of each")}>
        <InclusaoTabelaPof orc={classes} fonte={fonte} />
      </SecaoDoPainel>

      <SecaoDoPainel id="tabela-ufs" nivel="analisar" titulo={tx("Por UF, só no total das famílias", "By state, for all families only")}>
        <InclusaoTabelaUfsPof orc={ufs} fonte={fonte} />
      </SecaoDoPainel>
    </div>
  );
}
