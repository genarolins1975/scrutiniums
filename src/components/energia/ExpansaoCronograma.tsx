"use client";

import { useMemo, type ReactNode } from "react";
import { CursorSincronizado } from "@/components/energia/CursorSincronizado";
import { ExpansaoMarcas, ExpansaoOpcoes } from "@/components/energia/ExpansaoOpcoes";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import {
  COR_VIABILIDADE,
  ESQUEMA_CRONOGRAMA,
  IDS_VIABILIDADE,
  VIABILIDADE_DO_ID,
  colunasConfiabilidade,
  colunasDeslizamento,
  colunasPrevisoesAno,
  dataTexto,
  listaTexto,
  rotuloViabilidade,
  type IdViabilidade,
} from "@/lib/energia/expansao";
import type { LinhaTabela } from "@/lib/energia/tabela";
import type { Idioma } from "@/lib/idioma";
import { tx } from "@/lib/energia/idioma";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";

/**
 * P041, cronograma e revisões.
 *
 * Previsões atuais: a escolha de viabilidade (cro.via na URL) muda as séries das barras
 * empilhadas por mês e por ano; a pilha continua aditiva, porque as viabilidades são
 * partes disjuntas da mesma potência. A data-base (fotografia do RALIE) está em todo
 * título: previsão sem a data em que foi feita não é publicada.
 *
 * Cronograma da fiscalização separado das datas convencionais: o gráfico dos próximos 24
 * meses não toca as datas em bloco (elas caem anos depois da fotografia); o gráfico por ano
 * deixa de fora o ano que contém essas datas, que sai à parte, com o total publicado do ano
 * e a potência das datas em bloco; a tabela por ano mantém todos os anos e marca esse ano.
 *
 * Revisões: confiabilidade (o que cada fotografia previa para 12 meses e o que foi
 * liberado) e deslizamento (como a previsão da mesma unidade mudou em 12 meses)
 * compartilham o eixo das fotografias e o cursor; o intervalo de zoom (cro.de, cro.ate)
 * e a escolha com ou sem as datas em bloco (cro.bloco) ficam na URL.
 */

const AMOSTRA = (cor: string) => <span aria-hidden="true" className="inline-block h-3 w-3 shrink-0 border border-carvao" style={{ background: cor }} />;
/** "Viabilidade alta" ("High feasibility" em inglês), a partir do rótulo da fonte. */
function rotuloVia(id: IdViabilidade, idioma: Idioma): string {
  return tx(`Viabilidade ${VIABILIDADE_DO_ID[id].toLocaleLowerCase("pt-BR")}`, `${rotuloViabilidade(VIABILIDADE_DO_ID[id], idioma)} feasibility`, idioma);
}
function opcoesBloco(idioma: Idioma) {
  return [
    ["com", tx("Todas as unidades", "All units", idioma)], // i18n: dado
    ["sem", tx("Sem as datas em bloco", "Without the bulk-assigned dates", idioma)], // i18n: dado
  ] as const;
}

type LinhaPrev = LinhaTabela & { id: string };

export function ExpansaoPrevisoes({
  porAno,
  porAnoSemBloco,
  anosEmBloco,
  proximos,
  dataRalie,
  fonte,
  avisoBloco,
}: {
  /** Todos os anos publicados (a tabela e a exportação). */
  porAno: LinhaPrev[];
  /** Os anos do gráfico: sem o ano que contém as datas em bloco. */
  porAnoSemBloco: LinhaPrev[];
  anosEmBloco: string[];
  proximos: LinhaPrev[];
  dataRalie: string;
  fonte: string;
  /** Frase que diz o que ficou fora do gráfico por ano e onde está. */
  avisoBloco?: ReactNode;
}) {
  const idioma = useIdioma();
  const tx = useTx();
  const OPCOES_VIA = IDS_VIABILIDADE.map((id) => ({ id, rotulo: rotuloVia(id, idioma), marcador: AMOSTRA(COR_VIABILIDADE[id]) }));
  const [v, definir] = useEstadoUrl(ESQUEMA_CRONOGRAMA);
  const series = useMemo(
    () => IDS_VIABILIDADE.filter((id) => (v.via as readonly string[]).includes(id)).map((id) => ({ id, rotulo: rotuloVia(id, idioma), cor: COR_VIABILIDADE[id] })),
    [v.via, idioma],
  );
  const todas = series.length === IDS_VIABILIDADE.length;
  const sufixo = todas
    ? ""
    : tx(` (só ${series.map((s) => s.rotulo.toLocaleLowerCase("pt-BR")).join(" e ")})`, ` (${series.map((s) => s.rotulo.toLowerCase()).join(" and ")} only)`);
  const um = anosEmBloco.length === 1;
  const semBloco = anosEmBloco.length
    ? tx(`, sem ${anosEmBloco.join(" e ")}, que ${um ? "contém" : "contêm"} as datas em bloco`, `, without ${listaTexto(anosEmBloco, idioma)}, which ${um ? "contains" : "contain"} the bulk-assigned dates`)
    : "";
  return (
    <div className="space-y-6">
      <ExpansaoMarcas rotulo={tx("Viabilidade (fiscalização)", "Feasibility (inspection)")} opcoes={OPCOES_VIA} valor={v.via as IdViabilidade[]} onMudar={(via) => definir({ via })} />
      <GraficoBarras
        titulo={tx(`Previsões dos próximos 24 meses, fotografia do RALIE de ${dataRalie}${sufixo} (MW)`, `Forecasts for the next 24 months, RALIE snapshot of ${dataRalie}${sufixo} (MW)`)}
        dados={proximos}
        chaveCategoria="id"
        chaveRotulo="mes"
        series={series}
        unidade="MW"
        casas={1}
        empilhado
        altura={300}
      />
      <GraficoBarras
        titulo={tx(
          `Potência com previsão de operação comercial por ano, fotografia do RALIE de ${dataRalie}${sufixo}${semBloco} (MW)`,
          `Capacity forecast to enter commercial operation by year, RALIE snapshot of ${dataRalie}${sufixo}${semBloco} (MW)`,
        )}
        dados={porAnoSemBloco}
        chaveCategoria="id"
        chaveRotulo="ano" // i18n: dado
        series={series}
        unidade="MW"
        casas={1}
        empilhado
        rotulosValor
        altura={320}
      />
      {avisoBloco}
      <TabelaInterativa
        titulo={tx(`Previsões por ano, fotografia de ${dataRalie}`, `Forecasts by year, snapshot of ${dataRalie}`)}
        colunas={colunasPrevisoesAno(idioma)}
        linhas={porAno}
        chaveLinha="id"
        colunaRotulo="ano" // i18n: dado
        fonte={fonte}
        versao={dataRalie}
        nomeArquivo="expansao-previsoes-ano"
        chaveUrl="cro.tab"
        nota={tx(
          "Data-base de todas as linhas: a fotografia indicada. As colunas de viabilidade somam a potência prevista do ano. A coluna de data em bloco marca o ano que contém datas convencionais, que o gráfico por ano deixa de fora.",
          "Base date of every row: the snapshot shown. The feasibility columns add up to the year's forecast capacity. The bulk-assigned date column marks the year that contains conventional dates, which the chart by year leaves out.",
        )}
      />
    </div>
  );
}

export function ExpansaoRevisoes({
  confiabilidade,
  deslizamentoCom,
  deslizamentoSem,
  dataLiberacoes,
  fonte,
}: {
  confiabilidade: LinhaPrev[];
  deslizamentoCom: LinhaPrev[];
  deslizamentoSem: LinhaPrev[];
  dataLiberacoes: string;
  fonte: string;
}) {
  const idioma = useIdioma();
  const tx = useTx();
  const [v, definir] = useEstadoUrl(ESQUEMA_CRONOGRAMA);
  const intervalo = v.de && v.ate ? { inicio: v.de, fim: v.ate } : null;
  const aoIntervalo = (i: { inicio: string | number; fim: string | number } | null) => definir({ de: i ? String(i.inicio) : "", ate: i ? String(i.fim) : "" });
  const desl = v.bloco === "com" ? deslizamentoCom : deslizamentoSem;
  const primeira = confiabilidade[0]?.ralie as string | undefined;
  const ultima = confiabilidade.at(-1)?.ralie as string | undefined;
  return (
    <div className="space-y-6">
      <CursorSincronizado>
        <GraficoLinhas
          titulo={tx(
            `Do que cada fotografia previa para os 12 meses seguintes, quanto foi liberado para operação comercial, ${dataTexto(primeira, idioma)} a ${dataTexto(ultima, idioma)} (% da potência prevista)`,
            `Of what each snapshot forecast for the following 12 months, how much was released for commercial operation, ${dataTexto(primeira, idioma)} to ${dataTexto(ultima, idioma)} (% of forecast capacity)`,
          )}
          dados={confiabilidade}
          chaveX="ralie"
          formatoX="data"
          series={[
            { id: "pct_no_prazo", rotulo: tx("Liberado no prazo (até 12 meses)", "Released on time (within 12 months)"), sigla: tx("No prazo", "On time"), cor: "var(--cor-energia)" }, // i18n: dado
            { id: "pct_depois", rotulo: tx("Liberado depois", "Released later"), sigla: tx("Depois", "Later"), cor: "var(--serie-comp-3)", tracejada: true },
            { id: "pct_nao_liberado", rotulo: tx(`Não liberado até ${dataLiberacoes}`, `Not released by ${dataLiberacoes}`), sigla: tx("Não liberado", "Not released"), cor: "var(--escala-div-neg-1)" },
          ]}
          unidade="%"
          casas={1}
          zeroNoEixo
          zoom
          intervalo={intervalo}
          onIntervalo={aoIntervalo}
          legendaInterativa
          altura={300}
        />
        <ExpansaoOpcoes rotulo={tx("Revisão das previsões", "Revision of the forecasts")} nome="expansao-cro-bloco" opcoes={opcoesBloco(idioma)} valor={v.bloco} onMudar={(bloco) => definir({ bloco })} />
        <GraficoLinhas
          titulo={tx(
            `Como a previsão da mesma unidade mudou em 12 meses, por fotografia de partida${v.bloco === "sem" ? ", sem as unidades em data em bloco" : ""} (% da potência)`,
            `How the forecast for the same unit changed in 12 months, by starting snapshot${v.bloco === "sem" ? ", without the units on bulk-assigned dates" : ""} (% of capacity)`,
          )}
          dados={desl}
          chaveX="ralie"
          formatoX="data"
          series={[
            { id: "pct_adiada", rotulo: tx("Previsão adiada", "Forecast postponed"), sigla: tx("Adiada", "Postponed"), cor: "var(--escala-div-neg-1)" },
            { id: "pct_mantida", rotulo: tx("Previsão mantida", "Forecast kept"), sigla: tx("Mantida", "Kept"), cor: "var(--cor-mineral)", tracejada: true },
            { id: "pct_antecipada", rotulo: tx("Previsão antecipada", "Forecast brought forward"), sigla: tx("Antecipada", "Brought forward"), cor: "var(--cor-energia)" }, // i18n: dado
          ]}
          unidade="%"
          casas={1}
          zeroNoEixo
          zoom
          intervalo={intervalo}
          onIntervalo={aoIntervalo}
          legendaInterativa
          altura={280}
        />
      </CursorSincronizado>
      <TabelaInterativa
        titulo={tx("Confiabilidade das previsões por fotografia mensal", "Reliability of the forecasts by monthly snapshot")}
        colunas={colunasConfiabilidade(idioma)}
        linhas={confiabilidade}
        chaveLinha="id"
        colunaRotulo="ralie"
        fonte={fonte}
        versao={dataLiberacoes}
        nomeArquivo="expansao-confiabilidade-previsoes"
        chaveUrl="cro.conf"
        ordemInicial={{ coluna: "ralie", direcao: "desc" }}
        nota={tx(
          "Cada linha é uma previsão com data-base: a fotografia. Unidade já liberada antes da fotografia sai do denominador. Só janelas encerradas pelo menos 15 dias antes da data do arquivo de liberações.",
          "Each row is a forecast with a base date: the snapshot. A unit already released before the snapshot leaves the denominator. Only windows closed at least 15 days before the date of the releases file.",
        )}
      />
      <TabelaInterativa
        titulo={tx(
          `Revisão das previsões entre fotografias com 12 meses de distância${v.bloco === "sem" ? " (sem as datas em bloco)" : ""}`,
          `Revision of the forecasts between snapshots 12 months apart${v.bloco === "sem" ? " (without the bulk-assigned dates)" : ""}`,
        )}
        colunas={colunasDeslizamento(idioma)}
        linhas={desl}
        chaveLinha="id"
        colunaRotulo="ralie"
        fonte={fonte}
        versao={dataLiberacoes}
        nomeArquivo={v.bloco === "sem" ? "expansao-revisao-previsoes-sem-bloco" : "expansao-revisao-previsoes"}
        chaveUrl="cro.desl"
        ordemInicial={{ coluna: "ralie", direcao: "desc" }}
        nota={tx(
          "Só unidades que seguem em implantação nas duas fotografias e têm previsão nas duas (viés de sobrevivência). Mediana ponderada pela potência; positivo é adiamento.",
          "Only units still under implementation in both snapshots and with a forecast in both (survivorship bias). Capacity-weighted median; positive is postponement.",
        )}
      />
    </div>
  );
}
