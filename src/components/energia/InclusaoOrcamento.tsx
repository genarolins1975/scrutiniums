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
import {
  COLUNAS_LIMIARES,
  ESQUEMA_ORCAMENTO,
  MEDIDAS_BASE,
  NOME_TERRITORIO,
  TERRITORIOS_POF,
  codigoUf,
  colunasTabelaPof,
  colunasUfsPof,
  dadosClassesPof,
  dadosComparacaoPof,
  linhasLimiaresPof,
  linhasTabelaPof,
  linhasUfsPof,
  nomePof,
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

const CORES_MEDIDAS = ["var(--cor-energia)", "var(--serie-comp-2)", "var(--serie-referencia)"];
const CORES_TER = ["var(--serie-comp-1)", "var(--serie-comp-2)", "var(--serie-comp-3)", "var(--serie-comp-4)"];
const OPCOES_BASE: readonly (readonly [BasePof, string])[] = [
  ["despesa", "Na despesa total"],
  ["renda", "Na renda"],
];
const OPCOES_LIM: readonly (readonly [LimiarPof, string])[] = [
  ["3", "3%"],
  ["5", "5%"],
  ["10", "10%"],
];

const nomeTerritorio = (t: string) => NOME_TERRITORIO[t] ?? t;

function InclusaoClassesPof({ orc, resposta, recorte, notas }: { orc: OrcamentoBase; resposta?: ReactNode; recorte?: ReactNode; notas?: ReactNode }) {
  const [v, definir] = useEstadoUrl(ESQUEMA_ORCAMENTO);
  const ters = useMemo(() => (v.ter.length ? v.ter : ["BR"]), [v.ter]);
  const principal = ters[0];
  const medidas = MEDIDAS_BASE[v.base];
  const dados = useMemo(() => dadosClassesPof(orc, principal, v.base), [orc, principal, v.base]);
  const total = medidas.map((m) => orc.linhas.find((l) => l.territorio === principal && l.classe === "7999")?.microdados[m.id]?.[0] ?? null);
  const refTotal = total[0];

  return (
    <div className="space-y-6">
      <div className="grid gap-x-10 gap-y-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        {resposta}
        <InclusaoOpcoes rotulo="Participação" nome="inclusao-pof-base" opcoes={OPCOES_BASE} valor={v.base} onMudar={(base) => definir({ base })} />
      </div>
      <GraficoBarras
        titulo={`Energia elétrica ${v.base === "despesa" ? "na despesa total" : "na renda"} por classe de rendimento, ${nomeTerritorio(principal)} (${nomePof(orc)})`}
        dados={dados}
        chaveCategoria="id"
        chaveRotulo="rotulo"
        series={medidas.map((m, i) => ({ id: m.id, rotulo: m.rotulo, cor: CORES_MEDIDAS[i] }))}
        unidade="%"
        casas={2}
        referencias={refTotal !== null ? [{ valor: refTotal, rotulo: `${medidas[0].rotulo}, todas as famílias (${nomeTerritorio(principal)})` }] : []}
        altura={320}
      />
      {recorte}
      {notas}
    </div>
  );
}

function InclusaoTerritoriosPof({ orc }: { orc: OrcamentoBase }) {
  const [v, definir] = useEstadoUrl(ESQUEMA_ORCAMENTO);
  const ters = useMemo(() => (v.ter.length ? v.ter : ["BR"]), [v.ter]);
  const medidas = MEDIDAS_BASE[v.base];
  const medidaComp: MedidaPof = medidas[0].id;
  const comp = useMemo(() => dadosComparacaoPof(orc, ters, medidaComp), [orc, ters, medidaComp]);
  const entidades = TERRITORIOS_POF.map((t) => ({ id: t, rotulo: NOME_TERRITORIO[t] }));
  return (
    <div className="space-y-5">
      <Comparador
        rotulo="Territórios (até 4; o primeiro detalha as medidas)"
        entidades={entidades}
        selecionadas={ters}
        onMudar={(ids) => definir({ ter: ids.length ? ids : ["BR"] })}
        dicaBusca="Brasil ou região"
        vazio="Sem território escolhido: vale o Brasil."
      >
        {() => null}
      </Comparador>
      {ters.length > 1 ? (
        <GraficoBarras
          titulo={`${medidas[0].rotulo} ${v.base === "despesa" ? "na despesa total" : "na renda"} por classe: ${ters.map(nomeTerritorio).join(", ")}`}
          dados={comp}
          chaveCategoria="id"
          chaveRotulo="rotulo"
          series={ters.map((t, i) => ({ id: t, rotulo: nomeTerritorio(t), cor: CORES_TER[i % CORES_TER.length] }))}
          unidade="%"
          casas={2}
          altura={320}
        />
      ) : (
        <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
          Escolha mais um território para ver as classes de rendimento lado a lado, na mesma escala. A figura principal, acima, segue o primeiro território escolhido.
        </p>
      )}
    </div>
  );
}

function InclusaoLimiaresPof({ orc, fonte }: { orc: OrcamentoBase; fonte: string }) {
  const [v, definir] = useEstadoUrl(ESQUEMA_ORCAMENTO);
  const ters = useMemo(() => (v.ter.length ? v.ter : ["BR"]), [v.ter]);
  const principal = ters[0];
  const limiares = useMemo(() => linhasLimiaresPof(orc, principal, v.lim), [orc, principal, v.lim]);
  return (
    <div className="space-y-4">
      <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
        Limiares de {orc.limiares_pct.map((x) => `${x.toLocaleString("pt-BR")}%`).join(", ")} da renda e da despesa total como análise de sensibilidade, não como definição de pobreza
        energética: a leitura muda com o limiar, e a tabela mostra quanto. {nomeTerritorio(principal)}, famílias de cada classe acima do limiar escolhido.
      </p>
      <InclusaoOpcoes rotulo="Limiar" nome="inclusao-pof-lim" opcoes={OPCOES_LIM} valor={v.lim} onMudar={(lim) => definir({ lim })} />
      <GraficoBarras
        titulo={`Famílias com energia acima de ${v.lim}% da renda e da despesa total, ${nomeTerritorio(principal)}`}
        dados={limiares.map((l) => ({ id: l.id, rotulo: l.classe, renda: l.renda, despesa: l.despesa }))}
        chaveCategoria="id"
        chaveRotulo="rotulo"
        series={[
          { id: "renda", rotulo: `Acima de ${v.lim}% da renda`, cor: "var(--serie-comp-1)" },
          { id: "despesa", rotulo: `Acima de ${v.lim}% da despesa`, cor: "var(--serie-comp-3)" },
        ]}
        unidade="% das famílias"
        casas={1}
        altura={300}
      />
      <TabelaInterativa
        titulo={`Sensibilidade ao limiar de ${v.lim}%, ${nomeTerritorio(principal)}`}
        colunas={COLUNAS_LIMIARES}
        linhas={limiares}
        chaveLinha="id"
        colunaRotulo="classe"
        fonte={fonte}
        versao={orc.referencia}
        nomeArquivo={`inclusao-pof-limiar-${v.lim}-${principal}`}
        chaveUrl="pof.limt"
        nota={`${textoPrecisaoPof(orc.regra_precisao)} Zero na amostra não prova zero na população.`}
      />
    </div>
  );
}

function InclusaoTabelaPof({ orc, fonte }: { orc: OrcamentoBase; fonte: string }) {
  const [v] = useEstadoUrl(ESQUEMA_ORCAMENTO);
  const ters = useMemo(() => (v.ter.length ? v.ter : ["BR"]), [v.ter]);
  const principal = ters[0];
  const tabela = useMemo(() => linhasTabelaPof(orc, principal), [orc, principal]);
  const colunas = useMemo(() => colunasTabelaPof(orc), [orc]);
  return (
    <TabelaInterativa
      titulo={`${nomePof(orc)}: energia no orçamento, ${nomeTerritorio(principal)}, por classe de rendimento`}
      colunas={colunas}
      linhas={tabela}
      chaveLinha="id"
      colunaRotulo="classe"
      fonte={fonte}
      versao={orc.referencia}
      nomeArquivo={`inclusao-pof-${principal}`}
      chaveUrl="pof.med"
      nota={orc.formato_microdados}
    />
  );
}

const OPCOES_MAPA: readonly (readonly [MedidaMapaPof, string])[] = [
  ["razao_medias_pct", "Razão de médias (despesa)"],
  ["media_razoes_desp_pct", "Média das participações (despesa)"],
  ["media_razoes_renda_pct", "Média das participações (renda)"],
  ["energia_media", "Despesa média com energia"],
];
const CORES_MAPA = ["var(--escala-seq-1)", "var(--escala-seq-2)", "var(--escala-seq-3)", "var(--escala-seq-4)", "var(--escala-seq-5)"];

function InclusaoMapaUfsPof({ orc, periodo, unidadeReais }: { orc: OrcamentoBase; periodo: string; unidadeReais: string }) {
  const [v, definir] = useEstadoUrl(ESQUEMA_ORCAMENTO);
  const valores = useMemo(() => valoresMapaPof(orc, v.mapa), [orc, v.mapa]);
  const ehReais = v.mapa === "energia_media";
  const classes = useMemo(() => quebrasQuantis(Object.values(valores), CORES_MAPA.length, { casas: ehReais ? 0 : 1 }), [valores, ehReais]);
  const linhas = useMemo(() => linhasUfsPof(orc), [orc]);
  const sel = linhas.some((l) => l.uf === v.uf) ? v.uf : null;
  const rotulo = OPCOES_MAPA.find(([id]) => id === v.mapa)?.[1] ?? v.mapa;
  return (
    <div className="space-y-5">
      <InclusaoOpcoes rotulo="Mapa" nome="inclusao-pof-mapa" opcoes={OPCOES_MAPA} valor={v.mapa} onMudar={(mapa) => definir({ mapa })} />
      <MapaCoropletico
        titulo={`${rotulo} por UF, todas as classes de rendimento (${nomePof(orc)})`}
        fonteGeometria={URL_GEO.uf}
        valores={valores}
        cores={CORES_MAPA}
        classificacao={classes}
        unidade={ehReais ? unidadeReais : "%"}
        casas={2}
        rotuloRegiao={{ singular: "UF", plural: "UF" }}
        selecionado={sel ? codigoUf(sel) : null}
        onSelecionar={(id) => definir({ uf: siglaDoCodigo(id) ?? "" })}
        rotulos
        periodo={periodo}
        nota="Estimativa amostral por UF, só no total (a amostra por classe nas UF é pequena demais). Sem mapa municipal: a POF não permite."
      />
    </div>
  );
}

function InclusaoTabelaUfsPof({ orc, fonte }: { orc: OrcamentoBase; fonte: string }) {
  const [v, definir] = useEstadoUrl(ESQUEMA_ORCAMENTO);
  const linhas = useMemo(() => linhasUfsPof(orc), [orc]);
  const colunas = useMemo(() => colunasUfsPof(orc), [orc]);
  const sel = linhas.some((l) => l.uf === v.uf) ? v.uf : null;
  return (
    <TabelaInterativa
      titulo={`${nomePof(orc)} por UF (todas as classes), com coeficiente de variação`}
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
      dicaBusca="Nome ou sigla da UF"
      nota={`${textoPrecisaoPof(orc.regra_precisao)} A coluna de precisão diz o estado de cada valor.`}
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
  recorte?: ReactNode;
  notas?: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <InclusaoClassesPof orc={classes} resposta={resposta} recorte={recorte} notas={notas} />

      <SecaoDoPainel id="territorios" titulo="Brasil e grandes regiões, na mesma escala">
        <InclusaoTerritoriosPof orc={classes} />
      </SecaoDoPainel>

      <SecaoDoPainel id="limiares" titulo="Quantas famílias passam de um limiar de comprometimento?">
        <InclusaoLimiaresPof orc={classes} fonte={fonte} />
      </SecaoDoPainel>

      <SecaoDoPainel id="ufs" titulo="E por UF, no total das famílias?" lead="O peso da energia em cada UF, sem separar por faixa de renda: a amostra por classe nas UF é pequena demais.">
        <InclusaoMapaUfsPof orc={ufs} periodo={periodo} unidadeReais={unidadeReais} />
      </SecaoDoPainel>

      <SecaoDoPainel id="todas-medidas" nivel="analisar" titulo="Todas as medidas do território, com a precisão de cada uma">
        <InclusaoTabelaPof orc={classes} fonte={fonte} />
      </SecaoDoPainel>

      <SecaoDoPainel id="tabela-ufs" nivel="analisar" titulo="Por UF, só no total das famílias">
        <InclusaoTabelaUfsPof orc={ufs} fonte={fonte} />
      </SecaoDoPainel>
    </div>
  );
}
