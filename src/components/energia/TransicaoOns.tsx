"use client";

import { useMemo } from "react";
import { CursorSincronizado } from "@/components/energia/CursorSincronizado";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { TransicaoOpcoes } from "@/components/energia/TransicaoOpcoes";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { ESQUEMA_ONS, SERIES_ONS, colunasOnsMensal, dadosOnsMensal, linhasOnsMensal, type MedidaOns, type SerieOns } from "@/lib/energia/transicao";
import type { OnsMmgdMes } from "@/lib/energia/tipos-transicao";
import { nomeSubmercado } from "@/lib/energia/formato";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";

/**
 * Estimativa de MMGD do ONS (energia, MWmed, só SIN): a série mensal com a medida
 * (MWmed ou participação na carga global), o intervalo e as séries ocultas pela
 * legenda na URL (ons.med, ons.de, ons.ate e ons.ocultas), e a tabela equivalente,
 * com os mesmos meses. Cada mês fica numa só das
 * séries do SIN (completo ou incompleto), sem emenda entre elas.
 *
 * Os números vêm prontos da gold (pipeline/energia/modulos/transicao.py): a
 * interface não converte nem soma nada. A capacidade cadastrada da ANEEL aparece
 * só na tabela, em coluna própria, ao lado da razão rotulada; nunca somada.
 */

export function TransicaoOnsMensal({ mensal, fonte, versao }: { mensal: OnsMmgdMes[]; fonte: string; versao: string }) {
  const idioma = useIdioma();
  const tx = useTx();
  const OPCOES: readonly (readonly [MedidaOns, string])[] = [
    ["mwmed", tx("Energia estimada (MWmed)", "Estimated energy (MWavg)")],
    ["part", tx("Participação na carga global (%)", "Share of the gross load (%)")],
  ];
  const [v, definir] = useEstadoUrl(ESQUEMA_ONS);
  const dados = useMemo(() => dadosOnsMensal(mensal, v.med), [mensal, v.med]);
  const linhas = useMemo(() => linhasOnsMensal(mensal, idioma), [mensal, idioma]);
  const intervalo = v.de && v.ate && v.de <= v.ate ? { inicio: v.de, fim: v.ate } : null;
  const temIncompleto = mensal.some((m) => !m.completo);
  const sinCompleto = { id: "sin", rotulo: tx("SIN, mês completo", "SIN, full month"), sigla: "SIN", cor: "var(--cor-carvao)", espessura: 3 };
  const sinIncompleto = temIncompleto
    ? [{ id: "sin_incompleto", rotulo: tx("SIN, mês incompleto", "SIN, incomplete month"), sigla: tx("Incompleto", "Incomplete"), cor: "var(--serie-referencia)", tracejada: true }]
    : [];
  const series =
    v.med === "mwmed"
      ? [
          sinCompleto,
          ...sinIncompleto,
          { id: "SE", rotulo: nomeSubmercado("SE", idioma), sigla: nomeSubmercado("SE", idioma, true), cor: "var(--serie-sm-se)" },
          { id: "S", rotulo: nomeSubmercado("S", idioma), sigla: "S", cor: "var(--serie-sm-s)" },
          { id: "NE", rotulo: nomeSubmercado("NE", idioma), sigla: "NE", cor: "var(--serie-sm-ne)" },
          { id: "N", rotulo: nomeSubmercado("N", idioma), sigla: "N", cor: "var(--serie-sm-n)" },
        ]
      : [sinCompleto, ...sinIncompleto];
  return (
    <div className="space-y-5">
      <TransicaoOpcoes rotulo={tx("Medida", "Measure")} nome="transicao-ons-med" opcoes={OPCOES} valor={v.med} onMudar={(med) => definir({ med })} />
      <GraficoLinhas
        titulo={
          v.med === "mwmed"
            ? tx("MMGD estimada pelo ONS por mês, SIN e submercados", "MMGD estimated by the ONS by month, SIN and submarkets")
            : tx("MMGD estimada na carga global do SIN, por mês", "Estimated MMGD in the SIN gross load, by month")
        }
        dados={dados}
        chaveX="m"
        formatoX="mes"
        series={series}
        unidade={v.med === "mwmed" ? tx("MWmed", "MWavg") : "%"}
        casas={v.med === "mwmed" ? 0 : 2}
        zeroNoEixo
        zoom
        intervalo={intervalo}
        onIntervalo={(i) => definir({ de: i?.inicio ?? "", ate: i?.fim ?? "" })}
        legendaInterativa={v.med === "mwmed"}
        ocultas={v.ocultas}
        onOcultas={(ids) => definir({ ocultas: ids.filter((id): id is SerieOns => (SERIES_ONS as readonly string[]).includes(id)) })}
        altura={300}
      />
      <TabelaInterativa
        titulo={tx("MMGD estimada pelo ONS e capacidade cadastrada, por mês", "MMGD estimated by the ONS and registered capacity, by month")}
        colunas={colunasOnsMensal(idioma)}
        linhas={linhas}
        chaveLinha="id"
        colunaRotulo="m"
        fonte={fonte}
        versao={versao}
        nomeArquivo="transicao-ons-mmgd-mensal"
        chaveUrl="ons.tab"
        ordemInicial={{ coluna: "m", direcao: "desc" }}
        dicaBusca={tx("Mês (08/2025)", "Month (08/2025)")}
        nota={tx(
          "MWmed do mês = energia do mês ÷ horas cobertas. SIN só nos dias com as 24 horas dos quatro submercados. A razão com a capacidade compara perímetros diferentes (SIN e Brasil) e fica vazia em mês incompleto ou com cadastro provisório.",
          "Monthly MWavg = energy of the month ÷ hours covered. SIN only on days with all 24 hours of the four submarkets. The ratio with capacity compares different perimeters (SIN and Brazil) and is empty in an incomplete month or with a provisional register.",
        )}
      />
    </div>
  );
}

/**
 * Achado A11: solar e carga do Balanço de Energia do SIN e MMGD estimada, dia a dia,
 * em torno da incorporação declarada pelo ONS. A MMGD vem da captura indicada: o ONS
 * revisa o histórico, então a série leva a data da captura no rótulo.
 */
export function TransicaoConferencia2023({
  dias,
  marco,
  captura,
}: {
  dias: { d: string; solar: number | null; carga: number | null; mmgd: number | null }[];
  marco: { x: string; rotulo: string } | null;
  /** Data e hora da captura da carga verificada, já formatadas (horário de Brasília). */
  captura: string;
}) {
  const tx = useTx();
  const marcos = marco ? [marco] : [];
  return (
    <CursorSincronizado>
      <div className="space-y-5">
        <GraficoLinhas
          titulo={tx("Solar no Balanço de Energia do SIN e MMGD estimada pelo ONS, por dia", "Solar in the SIN Energy Balance and MMGD estimated by the ONS, by day")}
          dados={dias}
          chaveX="d"
          formatoX="data"
          series={[
            { id: "solar", rotulo: tx("Solar no balanço do SIN", "Solar in the SIN balance"), sigla: "Solar", cor: "var(--serie-solar)" },
            {
              id: "mmgd",
              rotulo: tx(`MMGD estimada (carga verificada, captura de ${captura})`, `Estimated MMGD (verified load, capture of ${captura})`),
              sigla: "MMGD",
              cor: "var(--cor-carvao)",
              tracejada: true,
            },
          ]}
          unidade={tx("MWmed", "MWavg")}
          casas={0}
          zeroNoEixo
          marcos={marcos}
          altura={260}
        />
        <GraficoLinhas
          titulo={tx("Carga no Balanço de Energia do SIN, por dia", "Load in the SIN Energy Balance, by day")}
          dados={dias}
          chaveX="d"
          formatoX="data"
          series={[{ id: "carga", rotulo: tx("Carga no balanço do SIN", "Load in the SIN balance"), sigla: tx("Carga", "Load"), cor: "var(--cor-energia)" }]} // i18n: dado
          unidade={tx("MWmed", "MWavg")}
          casas={0}
          marcos={marcos}
          altura={220}
        />
      </div>
    </CursorSincronizado>
  );
}
