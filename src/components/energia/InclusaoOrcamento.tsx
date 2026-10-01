"use client";

import { useMemo } from "react";
import { Comparador } from "@/components/energia/Comparador";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { InclusaoOpcoes } from "@/components/energia/InclusaoOpcoes";
import { MapaCoropletico } from "@/components/energia/MapaCoropletico";
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
 * P061, peso no orçamento (POF 2017-2018): distribuição por classe de rendimento
 * com a razão de médias (a "distribuição" do IBGE) ao lado da média das
 * participações família a família e da mediana, porque uma não substitui a outra;
 * comparação de até quatro territórios (Brasil e grandes regiões, os domínios que
 * a amostra sustenta por classe); limiares de 3%, 5% e 10% como sensibilidade; e
 * as UF só no total, com a precisão de cada estimativa.
 *
 * Valor suprimido pela precisão (CV acima de 30%) chega nulo e é desenhado como
 * ausência, nunca como zero. Nada municipal: a POF não permite.
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

export function InclusaoClassesPof({ orc, fonte }: { orc: OrcamentoBase; fonte: string }) {
  const [v, definir] = useEstadoUrl(ESQUEMA_ORCAMENTO);
  const ters = useMemo(() => (v.ter.length ? v.ter : ["BR"]), [v.ter]);
  const principal = ters[0];
  const medidas = MEDIDAS_BASE[v.base];
  const medidaComp: MedidaPof = medidas[0].id;
  const dados = useMemo(() => dadosClassesPof(orc, principal, v.base), [orc, principal, v.base]);
  const comp = useMemo(() => dadosComparacaoPof(orc, ters, medidaComp), [orc, ters, medidaComp]);
  const limiares = useMemo(() => linhasLimiaresPof(orc, principal, v.lim), [orc, principal, v.lim]);
  const tabela = useMemo(() => linhasTabelaPof(orc, principal), [orc, principal]);
  const colunas = useMemo(() => colunasTabelaPof(orc), [orc]);
  const entidades = TERRITORIOS_POF.map((t) => ({ id: t, rotulo: NOME_TERRITORIO[t] }));
  const nome = (t: string) => NOME_TERRITORIO[t] ?? t;
  const total = medidas.map((m) => orc.linhas.find((l) => l.territorio === principal && l.classe === "7999")?.microdados[m.id]?.[0] ?? null);
  const refTotal = total[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <InclusaoOpcoes rotulo="Participação" nome="inclusao-pof-base" opcoes={OPCOES_BASE} valor={v.base} onMudar={(base) => definir({ base })} />
      </div>
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
      <GraficoBarras
        titulo={`Energia elétrica ${v.base === "despesa" ? "na despesa total" : "na renda"} por classe de rendimento, ${nome(principal)} (${nomePof(orc)})`}
        dados={dados}
        chaveCategoria="id"
        chaveRotulo="rotulo"
        series={medidas.map((m, i) => ({ id: m.id, rotulo: m.rotulo, cor: CORES_MEDIDAS[i] }))}
        unidade="%"
        casas={2}
        referencias={refTotal !== null ? [{ valor: refTotal, rotulo: `${medidas[0].rotulo}, todas as famílias (${nome(principal)})` }] : []}
        altura={320}
      />
      {ters.length > 1 && (
        <GraficoBarras
          titulo={`${medidas[0].rotulo} ${v.base === "despesa" ? "na despesa total" : "na renda"} por classe: ${ters.map(nome).join(", ")}`}
          dados={comp}
          chaveCategoria="id"
          chaveRotulo="rotulo"
          series={ters.map((t, i) => ({ id: t, rotulo: nome(t), cor: CORES_TER[i % CORES_TER.length] }))}
          unidade="%"
          casas={2}
          altura={320}
        />
      )}

      <div className="space-y-3 border-t border-linha pt-5">
        <h3 className="font-serif text-lg text-carvao">Quantas famílias passam de um limiar de comprometimento?</h3>
        <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
          Limiares de {orc.limiares_pct.map((x) => `${x.toLocaleString("pt-BR")}%`).join(", ")} da renda e da despesa total como análise de sensibilidade, não como definição de pobreza
          energética: a leitura muda com o limiar, e a tabela mostra quanto. {nome(principal)}, famílias de cada classe acima do limiar escolhido.
        </p>
        <InclusaoOpcoes rotulo="Limiar" nome="inclusao-pof-lim" opcoes={OPCOES_LIM} valor={v.lim} onMudar={(lim) => definir({ lim })} />
        <GraficoBarras
          titulo={`Famílias com energia acima de ${v.lim}% da renda e da despesa total, ${nome(principal)}`}
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
          titulo={`Sensibilidade ao limiar de ${v.lim}%, ${nome(principal)}`}
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

      <div data-nivel="analisar" className="space-y-3 border-t border-linha pt-5">
        <h3 className="font-serif text-lg text-carvao">Todas as medidas de {nome(principal)}, com a precisão de cada uma</h3>
        <TabelaInterativa
          titulo={`${nomePof(orc)}: energia no orçamento, ${nome(principal)}, por classe de rendimento`}
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
      </div>
    </div>
  );
}

const OPCOES_MAPA: readonly (readonly [MedidaMapaPof, string])[] = [
  ["razao_medias_pct", "Razão de médias (despesa)"],
  ["media_razoes_desp_pct", "Média das participações (despesa)"],
  ["media_razoes_renda_pct", "Média das participações (renda)"],
  ["energia_media", "Despesa média com energia"],
];
const CORES_MAPA = ["var(--escala-seq-1)", "var(--escala-seq-2)", "var(--escala-seq-3)", "var(--escala-seq-4)", "var(--escala-seq-5)"];

export function InclusaoUfsPof({ orc, fonte, periodo, unidadeReais }: { orc: OrcamentoBase; fonte: string; periodo: string; unidadeReais: string }) {
  const [v, definir] = useEstadoUrl(ESQUEMA_ORCAMENTO);
  const valores = useMemo(() => valoresMapaPof(orc, v.mapa), [orc, v.mapa]);
  const ehReais = v.mapa === "energia_media";
  const classes = useMemo(() => quebrasQuantis(Object.values(valores), CORES_MAPA.length, { casas: ehReais ? 0 : 1 }), [valores, ehReais]);
  const linhas = useMemo(() => linhasUfsPof(orc), [orc]);
  const colunas = useMemo(() => colunasUfsPof(orc), [orc]);
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
    </div>
  );
}
