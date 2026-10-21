"use client";

import { useMemo } from "react";
import { Comparador } from "@/components/energia/Comparador";
import { ExpansaoOpcoes } from "@/components/energia/ExpansaoOpcoes";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { MapaCoropletico } from "@/components/energia/MapaCoropletico";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { quebrasQuantis } from "@/lib/energia/escalas";
import {
  ESQUEMA_TRANSMISSAO,
  MEDIDAS_REDE,
  MEDIDA_REDE,
  codigoUf,
  colunasGeracaoRedeUf,
  entidadesUf,
  inteiro,
  kmTexto,
  medidaRede,
  mvaTexto,
  mwTexto,
  siglaDoCodigo,
  valoresMapaRede,
  type LinhaGeracaoRedeUf,
} from "@/lib/energia/expansao";
import { URL_GEO } from "@/lib/energia/geo";
import { Nome } from "@/components/i18n/Nome";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";

/**
 * P042, geração e rede por UF lado a lado. O mapa, a tabela e a comparação de até
 * quatro UF compartilham a UF e a medida pela URL (tra.uf, tra.med, tra.cmp).
 *
 * Cada medida tem a sua unidade e o seu painel: MW de geração (RALIE), km de circuito e
 * MVA de transformação em obra (SIGET), km de traçado da rede da EPE. Nenhuma é somada
 * ou dividida por outra; a comparação entre UF desenha um painel por unidade, com escala
 * comum só dentro da mesma unidade.
 */

const CORES = ["var(--escala-seq-1)", "var(--escala-seq-2)", "var(--escala-seq-3)", "var(--escala-seq-4)", "var(--escala-seq-5)"];

export function ExpansaoGeracaoRedeUf({ linhas, datas, fonte }: { linhas: LinhaGeracaoRedeUf[]; datas: { ralie: string; siget: string; epe: string }; fonte: string }) {
  const idioma = useIdioma();
  const tx = useTx();
  const OPCOES = MEDIDAS_REDE.map((m) => [m, medidaRede(m, idioma).rotulo] as const);
  const [v, definir] = useEstadoUrl(ESQUEMA_TRANSMISSAO);
  const med = medidaRede(v.med, idioma);
  const fontePt = MEDIDA_REDE[v.med].fonte;
  const valores = useMemo(() => valoresMapaRede(linhas, v.med), [linhas, v.med]);
  const classes = useMemo(() => quebrasQuantis(Object.values(valores), 5, { casas: 0 }), [valores]);
  const sel = linhas.find((l) => l.id === v.uf) ?? null;
  const selecionar = (uf: string | null) => definir({ uf: uf ?? "" });
  const escolhidas = v.cmp.filter((u) => linhas.some((l) => l.id === u));
  const comparadas = escolhidas.map((u) => linhas.find((l) => l.id === u)!).map((l) => ({ ...l, rotulo: `${l.nome} (${l.id})` }));
  const periodo = fontePt.includes("RALIE")
    ? tx(`RALIE de ${datas.ralie}`, `RALIE of ${datas.ralie}`)
    : fontePt.includes("SIGET")
      ? tx(`SIGET de ${datas.siget}`, `SIGET of ${datas.siget}`)
      : tx(`EPE, capturada em ${datas.epe}`, `EPE, captured on ${datas.epe}`);

  return (
    <div className="space-y-6">
      <ExpansaoOpcoes rotulo={tx("Medida do mapa", "Map measure")} nome="expansao-tra-med" opcoes={OPCOES} valor={v.med} onMudar={(m) => definir({ med: m })} />
      <MapaCoropletico
        titulo={tx(`${med.rotulo} por UF, ${periodo}`, `${med.rotulo} by state, ${periodo}`)}
        fonteGeometria={URL_GEO.uf}
        valores={valores}
        cores={CORES}
        classificacao={classes}
        unidade={med.unidade}
        casas={med.casas}
        rotuloRegiao={tx({ singular: "UF", plural: "UF" }, { singular: "state", plural: "states" })}
        selecionado={codigoUf(v.uf)}
        onSelecionar={(id) => selecionar(siglaDoCodigo(id))}
        rotulos
        periodo={periodo}
        nota={tx(
          `${med.fonte}. Linha interestadual entra em todas as UF que toca: a soma das UF supera o total nacional. Zero é zero observado.`,
          `${med.fonte}. An interstate line counts in every state it touches: the sum of the states exceeds the national total. Zero is an observed zero.`,
        )}
      />
      {sel && (
        <p aria-live="polite" className="max-w-prose2 text-sm leading-relaxed text-carvao">
          <strong className="font-medium">
            <Nome>{sel.nome}</Nome>
          </strong>
          {tx(
            <>
              , lado a lado e sem soma: {mwTexto(sel.mw_impl, 1, idioma)} de geração em implantação ({mwTexto(sel.mw_24m, 1, idioma)} previstos para 24 meses);{" "}
              {kmTexto(sel.km_obra, 1, idioma)} de linhas em obra que tocam a UF e {mvaTexto(sel.mva_obra, 0, idioma)} de transformação em obra, em {inteiro(sel.empreendimentos, idioma)} empreendimentos; rede da EPE com{" "}
              {kmTexto(sel.km_epe, 1, idioma)} existentes e {kmTexto(sel.km_epe_plan, 1, idioma)} planejados de traçado.
            </>,
            <>
              , side by side and not added: {mwTexto(sel.mw_impl, 1, idioma)} of generation under implementation ({mwTexto(sel.mw_24m, 1, idioma)} forecast for 24 months);{" "}
              {kmTexto(sel.km_obra, 1, idioma)} of lines under construction that touch the state and {mvaTexto(sel.mva_obra, 0, idioma)} of transformation under construction, in {inteiro(sel.empreendimentos, idioma)} projects; EPE grid with{" "}
              {kmTexto(sel.km_epe, 1, idioma)} existing and {kmTexto(sel.km_epe_plan, 1, idioma)} planned of route length.
            </>,
          )}
        </p>
      )}
      <TabelaInterativa
        titulo={tx(
          `Geração e rede por UF, lado a lado (RALIE de ${datas.ralie}; SIGET de ${datas.siget}; EPE capturada em ${datas.epe})`,
          `Generation and grid by state, side by side (RALIE of ${datas.ralie}; SIGET of ${datas.siget}; EPE captured on ${datas.epe})`,
        )}
        colunas={colunasGeracaoRedeUf(idioma)}
        linhas={linhas}
        chaveLinha="id"
        colunaRotulo="nome"
        fonte={fonte}
        versao={datas.siget}
        nomeArquivo="expansao-geracao-e-rede-uf"
        chaveUrl="tra.tab"
        ordemInicial={{ coluna: "mw_impl", direcao: "desc" }}
        selecionado={sel?.id ?? null}
        onSelecionar={selecionar}
        dicaBusca={tx("Nome ou sigla da UF", "State name or code")}
        nota={tx(
          "Grandezas diferentes em colunas próprias, nunca somadas nem divididas: MW é potência de geração, km de circuito conta cada circuito de linha dupla, km de traçado da EPE mede a geometria, MVA é transformação.",
          "Different quantities in their own columns, never added or divided: MW is generation capacity, circuit km counts each circuit of a double line, EPE route km measures the geometry, MVA is transformation.",
        )}
      />
      <div className="space-y-3">
        <Comparador
          rotulo={tx("UF para comparar (até 4)", "States to compare (up to 4)")}
          entidades={entidadesUf()}
          selecionadas={escolhidas}
          onMudar={(ids) => definir({ cmp: ids })}
          dicaBusca={tx("Nome ou sigla da UF", "State name or code")}
          vazio={tx(
            "Nenhuma UF escolhida. A comparação desenha um painel por grandeza (MW, km de circuito, MVA e km de traçado), cada um com a sua escala.",
            "No state chosen. The comparison draws one panel per quantity (MW, circuit km, MVA and route km), each with its own scale.",
          )}
        >
          {() => null}
        </Comparador>
        {comparadas.length > 0 && (
          <div className="grid gap-6 lg:grid-cols-2">
            <GraficoBarras
              titulo={tx("Geração em implantação (MW)", "Generation under implementation (MW)")}
              dados={comparadas}
              chaveCategoria="id"
              chaveRotulo="rotulo"
              rotulosSaoNomes
              series={[
                { id: "mw_impl", rotulo: tx("Em implantação", "Under implementation"), cor: "var(--cor-energia)" }, // i18n: dado
                { id: "mw_24m", rotulo: tx("Prevista em 24 meses", "Forecast in 24 months"), cor: "var(--escala-seq-2)" },
              ]}
              unidade="MW"
              casas={1}
              orientacao="horizontal"
              alturaCategoria={56}
              selecionado={sel?.id ?? null}
              onSelecionar={selecionar}
            />
            <GraficoBarras
              titulo={tx("Linhas em obra que tocam a UF (km de circuito, SIGET)", "Lines under construction that touch the state (circuit km, SIGET)")}
              dados={comparadas}
              chaveCategoria="id"
              chaveRotulo="rotulo"
              rotulosSaoNomes
              series={[{ id: "km_obra", rotulo: tx("Em obra", "Under construction"), cor: "var(--serie-comp-3)" }]}
              unidade="km" // i18n: dado
              casas={1}
              orientacao="horizontal"
              alturaCategoria={44}
              selecionado={sel?.id ?? null}
              onSelecionar={selecionar}
            />
            <GraficoBarras
              titulo={tx("Transformação em obra (MVA)", "Transformation under construction (MVA)")}
              dados={comparadas}
              chaveCategoria="id"
              chaveRotulo="rotulo"
              rotulosSaoNomes
              series={[{ id: "mva_obra", rotulo: tx("Em obra", "Under construction"), cor: "var(--serie-comp-2)" }]}
              unidade="MVA"
              casas={0}
              orientacao="horizontal"
              alturaCategoria={44}
              selecionado={sel?.id ?? null}
              onSelecionar={selecionar}
            />
            <GraficoBarras
              titulo={tx("Rede da EPE dentro da UF (km de traçado)", "EPE grid within the state (route km)")}
              dados={comparadas}
              chaveCategoria="id"
              chaveRotulo="rotulo"
              rotulosSaoNomes
              series={[
                { id: "km_epe", rotulo: tx("Existente", "Existing"), cor: "var(--cor-mineral)" },
                { id: "km_epe_plan", rotulo: tx("Planejada", "Planned"), cor: "var(--escala-seq-3)" },
              ]}
              unidade="km" // i18n: dado
              casas={1}
              orientacao="horizontal"
              alturaCategoria={56}
              selecionado={sel?.id ?? null}
              onSelecionar={selecionar}
            />
          </div>
        )}
        {comparadas.length > 0 && (
          <p className="text-xs text-carvao-muted">
            {tx(
              "Um painel por grandeza; dentro de cada painel, a mesma escala para as UF escolhidas. km de circuito (SIGET) e km de traçado (EPE) ficam em painéis separados porque medem coisas diferentes e não se somam.",
              "One panel per quantity; within each panel, the same scale for the chosen states. Circuit km (SIGET) and route km (EPE) are in separate panels because they measure different things and are not added.",
            )}
          </p>
        )}
      </div>
    </div>
  );
}
