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
  ESQUEMA_CARTEIRA,
  MEDIDAS_CARTEIRA,
  NOME_UF,
  codigoUf,
  colunasCarteiraUf,
  entidadesUf,
  inteiro,
  medidaCarteira,
  mwTexto,
  siglaDoCodigo,
  valoresMapaCarteira,
  type LinhaCarteiraUf,
} from "@/lib/energia/expansao";
import { URL_GEO } from "@/lib/energia/geo";
import { Nome } from "@/components/i18n/Nome";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";

/**
 * P040, carteira por UF: o mapa (malha oficial do IBGE), a tabela equivalente e a
 * comparação de até quatro UF compartilham a UF selecionada e a medida pela URL
 * (car.uf, car.med, car.cmp), então o link copiado e o voltar do navegador trazem o
 * mesmo recorte.
 *
 * As medidas nunca se misturam: as três fases do SIGA em MW outorgado (a mesma medida
 * para as três, para que as etapas se comparem) e a carteira do RALIE em MW das unidades
 * em implantação. Usina multiestadual fica na UF principal (a potência não é dividida),
 * como diz a nota do mapa.
 */

const CORES = ["var(--escala-seq-1)", "var(--escala-seq-2)", "var(--escala-seq-3)", "var(--escala-seq-4)", "var(--escala-seq-5)"];

export function ExpansaoCarteiraUf({ linhas, data, dataRalie, fonte, multiestaduais }: { linhas: LinhaCarteiraUf[]; data: string; dataRalie: string; fonte: string; multiestaduais: string }) {
  const idioma = useIdioma();
  const tx = useTx();
  const OPCOES = MEDIDAS_CARTEIRA.map((m) => [m, medidaCarteira(m, idioma).rotulo] as const);
  const SERIES_COMPARACAO = [
    { id: "nao_iniciada_mw", rotulo: tx("Outorgado, construção não iniciada (MW outorgado)", "Granted, construction not started (granted MW)"), cor: "var(--serie-comp-3)" },
    { id: "construcao_mw", rotulo: tx("Em construção (MW outorgado)", "Under construction (granted MW)"), cor: "var(--cor-energia)" }, // i18n: dado
    { id: "operacao_mw", rotulo: tx("Em operação (MW outorgado)", "In operation (granted MW)"), cor: "var(--cor-mineral)" },
  ];
  const [v, definir] = useEstadoUrl(ESQUEMA_CARTEIRA);
  const med = medidaCarteira(v.med, idioma);
  const valores = useMemo(() => valoresMapaCarteira(linhas, v.med), [linhas, v.med]);
  const classes = useMemo(() => quebrasQuantis(Object.values(valores), 5, { casas: 0 }), [valores]);
  const sel = linhas.find((l) => l.id === v.uf) ?? null;
  const selecionar = (uf: string | null) => definir({ uf: uf ?? "" });
  const escolhidas = v.cmp.filter((u) => linhas.some((l) => l.id === u));
  const comparadas = escolhidas.map((u) => linhas.find((l) => l.id === u)!).map((l) => ({ ...l, rotulo: `${l.nome} (${l.id})` }));
  const periodo = v.med === "ralie" ? tx(`fotografia do RALIE de ${dataRalie}`, `RALIE snapshot of ${dataRalie}`) : tx(`SIGA de ${data}`, `SIGA of ${data}`);

  return (
    <div className="space-y-6">
      <ExpansaoOpcoes rotulo={tx("Medida do mapa", "Map measure")} nome="expansao-car-med" opcoes={OPCOES} valor={v.med} onMudar={(m) => definir({ med: m })} />
      <MapaCoropletico
        titulo={tx(`${med.rotulo} por UF, ${periodo}`, `${med.rotulo} by state, ${periodo}`)}
        fonteGeometria={URL_GEO.uf}
        valores={valores}
        cores={CORES}
        classificacao={classes}
        unidade={med.unidade}
        casas={1}
        rotuloRegiao={tx({ singular: "UF", plural: "UF" }, { singular: "state", plural: "states" })}
        selecionado={codigoUf(v.uf)}
        onSelecionar={(id) => selecionar(siglaDoCodigo(id))}
        rotulos
        periodo={periodo}
        nota={tx(
          `${med.fonte}. Usina multiestadual fica na UF principal (${multiestaduais}); zero é zero observado, não falta de dado.`,
          `${med.fonte}. A plant spanning several states is assigned to its main state (${multiestaduais}); zero is an observed zero, not missing data.`,
        )}
      />
      {sel && (
        <p aria-live="polite" className="max-w-prose2 text-sm leading-relaxed text-carvao">
          <strong className="font-medium">
            <Nome>{sel.nome}</Nome>
          </strong>
          :{" "}
          {tx(
            <>
              {inteiro(sel.nao_iniciada_usinas, idioma)} usinas outorgadas sem obra ({mwTexto(sel.nao_iniciada_mw, 1, idioma)}), {inteiro(sel.construcao_usinas, idioma)} em construção ({mwTexto(sel.construcao_mw, 1, idioma)}) e{" "}
              {inteiro(sel.operacao_usinas, idioma)} em operação ({mwTexto(sel.operacao_mw, 1, idioma)}), em MW outorgado no SIGA de {data}; no RALIE de {dataRalie}, {mwTexto(sel.ralie_mw, 1, idioma)} em unidades em implantação.
            </>,
            <>
              {inteiro(sel.nao_iniciada_usinas, idioma)} granted plants with no construction ({mwTexto(sel.nao_iniciada_mw, 1, idioma)}), {inteiro(sel.construcao_usinas, idioma)} under construction ({mwTexto(sel.construcao_mw, 1, idioma)}) and{" "}
              {inteiro(sel.operacao_usinas, idioma)} in operation ({mwTexto(sel.operacao_mw, 1, idioma)}), in granted MW in the SIGA of {data}; in the RALIE of {dataRalie}, {mwTexto(sel.ralie_mw, 1, idioma)} in units under implementation.
            </>,
          )}
        </p>
      )}
      <TabelaInterativa
        titulo={tx(`Carteira e operação por UF (SIGA de ${data}; RALIE de ${dataRalie})`, `Portfolio and operation by state (SIGA of ${data}; RALIE of ${dataRalie})`)}
        colunas={colunasCarteiraUf(idioma)}
        linhas={linhas}
        chaveLinha="id"
        colunaRotulo="nome"
        fonte={fonte}
        versao={data}
        nomeArquivo="expansao-carteira-uf"
        chaveUrl="car.tab"
        ordemInicial={{ coluna: "nao_iniciada_mw", direcao: "desc" }}
        selecionado={sel?.id ?? null}
        onSelecionar={selecionar}
        dicaBusca={tx("Nome ou sigla da UF", "State name or code")}
        nota={tx(
          "MW outorgado nas três fases do SIGA, para que as etapas se comparem; o RALIE mede a potência das unidades geradoras em implantação na fotografia. As duas colunas de carteira não se somam: são o mesmo conjunto de usinas visto por cadastros diferentes.",
          "Granted MW in the three SIGA phases, so that the stages can be compared; the RALIE measures the capacity of the generating units under implementation in the snapshot. The two portfolio columns are not added: they are the same set of plants seen by different registers.",
        )}
      />
      <div className="space-y-3">
        <Comparador
          rotulo={tx("UF para comparar (até 4)", "States to compare (up to 4)")}
          entidades={entidadesUf()}
          selecionadas={escolhidas}
          onMudar={(ids) => definir({ cmp: ids })}
          dicaBusca={tx("Nome ou sigla da UF", "State name or code")}
          vazio={tx("Nenhuma UF escolhida. A comparação mostra as três fases do SIGA na mesma escala.", "No state chosen. The comparison shows the three SIGA phases on the same scale.")}
        >
          {() => null}
        </Comparador>
        {comparadas.length > 0 && (
          <GraficoBarras
            titulo={tx(`Fases do SIGA nas UF escolhidas, ${data} (MW outorgado, mesma escala)`, `SIGA phases in the chosen states, ${data} (granted MW, same scale)`)}
            dados={comparadas}
            chaveCategoria="id"
            chaveRotulo="rotulo"
            series={SERIES_COMPARACAO}
            unidade="MW"
            casas={1}
            orientacao="horizontal"
            alturaCategoria={Math.max(56, 22 * SERIES_COMPARACAO.length)}
            selecionado={sel?.id ?? null}
            onSelecionar={selecionar}
          />
        )}
        {comparadas.length > 0 && (
          <p className="text-xs text-carvao-muted">
            {tx("Escala comum às UF escolhidas: ", "Scale shared by the chosen states: ")}
            <Nome>{comparadas.map((c) => `${NOME_UF[c.id] ?? c.id}`).join(", ")}</Nome>
            {tx(
              ". A fase de operação costuma dominar a escala; a tabela acima traz os valores exatos de cada fase.",
              ". The operation phase usually dominates the scale; the table above has the exact values of each phase.",
            )}
          </p>
        )}
      </div>
    </div>
  );
}
