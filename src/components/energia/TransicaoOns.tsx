"use client";

import { useMemo } from "react";
import { CursorSincronizado } from "@/components/energia/CursorSincronizado";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { TransicaoOpcoes } from "@/components/energia/TransicaoOpcoes";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { COLUNAS_ONS_MENSAL, ESQUEMA_ONS, dadosOnsMensal, linhasOnsMensal, type MedidaOns } from "@/lib/energia/transicao";
import type { OnsMmgdMes } from "@/lib/energia/tipos-transicao";

/**
 * Estimativa de MMGD do ONS (energia, MWmed, só SIN): a série mensal com a medida
 * (MWmed ou participação na carga global) e o intervalo na URL (ons.med, ons.de e
 * ons.ate), e a tabela equivalente, com os mesmos meses. Cada mês fica numa só das
 * séries do SIN (completo ou incompleto), sem emenda entre elas.
 *
 * Os números vêm prontos da gold (pipeline/energia/modulos/transicao.py): a
 * interface não converte nem soma nada. A capacidade cadastrada da ANEEL aparece
 * só na tabela, em coluna própria, ao lado da razão rotulada; nunca somada.
 */

const OPCOES: readonly (readonly [MedidaOns, string])[] = [
  ["mwmed", "Energia estimada (MWmed)"],
  ["part", "Participação na carga global (%)"],
];

export function TransicaoOnsMensal({ mensal, fonte, versao }: { mensal: OnsMmgdMes[]; fonte: string; versao: string }) {
  const [v, definir] = useEstadoUrl(ESQUEMA_ONS);
  const dados = useMemo(() => dadosOnsMensal(mensal, v.med), [mensal, v.med]);
  const linhas = useMemo(() => linhasOnsMensal(mensal), [mensal]);
  const intervalo = v.de && v.ate && v.de <= v.ate ? { inicio: v.de, fim: v.ate } : null;
  const temIncompleto = mensal.some((m) => !m.completo);
  const series =
    v.med === "mwmed"
      ? [
          { id: "sin", rotulo: "SIN, mês completo", sigla: "SIN", cor: "var(--cor-carvao)", espessura: 3 },
          ...(temIncompleto ? [{ id: "sin_incompleto", rotulo: "SIN, mês incompleto", sigla: "Incompleto", cor: "var(--serie-referencia)", tracejada: true }] : []),
          { id: "SE", rotulo: "Sudeste/Centro-Oeste", sigla: "SE/CO", cor: "var(--serie-sm-se)" },
          { id: "S", rotulo: "Sul", sigla: "S", cor: "var(--serie-sm-s)" },
          { id: "NE", rotulo: "Nordeste", sigla: "NE", cor: "var(--serie-sm-ne)" },
          { id: "N", rotulo: "Norte", sigla: "N", cor: "var(--serie-sm-n)" },
        ]
      : [
          { id: "sin", rotulo: "SIN, mês completo", sigla: "SIN", cor: "var(--cor-carvao)", espessura: 3 },
          ...(temIncompleto ? [{ id: "sin_incompleto", rotulo: "SIN, mês incompleto", sigla: "Incompleto", cor: "var(--serie-referencia)", tracejada: true }] : []),
        ];
  return (
    <div className="space-y-5">
      <TransicaoOpcoes rotulo="Medida" nome="transicao-ons-med" opcoes={OPCOES} valor={v.med} onMudar={(med) => definir({ med })} />
      <GraficoLinhas
        titulo={v.med === "mwmed" ? "MMGD estimada pelo ONS por mês, SIN e submercados" : "MMGD estimada na carga global do SIN, por mês"}
        dados={dados}
        chaveX="m"
        formatoX="mes"
        series={series}
        unidade={v.med === "mwmed" ? "MWmed" : "%"}
        casas={v.med === "mwmed" ? 0 : 2}
        zeroNoEixo
        zoom
        intervalo={intervalo}
        onIntervalo={(i) => definir({ de: i?.inicio ?? "", ate: i?.fim ?? "" })}
        legendaInterativa={v.med === "mwmed"}
        altura={300}
      />
      <TabelaInterativa
        titulo="MMGD estimada pelo ONS e capacidade cadastrada, por mês"
        colunas={COLUNAS_ONS_MENSAL}
        linhas={linhas}
        chaveLinha="id"
        colunaRotulo="m"
        fonte={fonte}
        versao={versao}
        nomeArquivo="transicao-ons-mmgd-mensal"
        chaveUrl="ons.tab"
        ordemInicial={{ coluna: "m", direcao: "desc" }}
        dicaBusca="Mês (2025-08)"
        nota="MWmed do mês = energia do mês ÷ horas cobertas. SIN só nos dias com as 24 horas dos quatro submercados. A razão com a capacidade compara perímetros diferentes (SIN e Brasil) e fica vazia em mês incompleto ou com cadastro provisório."
      />
    </div>
  );
}

/** Achado A11: solar e carga do Balanço de Energia do SIN e MMGD estimada, dia a dia, em torno de 29/04/2023. */
export function TransicaoConferencia2023({
  dias,
  marco,
}: {
  dias: { d: string; solar: number | null; carga: number | null; mmgd: number | null }[];
  marco: { x: string; rotulo: string } | null;
}) {
  const marcos = marco ? [marco] : [];
  return (
    <CursorSincronizado>
      <div className="space-y-5">
        <GraficoLinhas
          titulo="Solar no Balanço de Energia do SIN e MMGD estimada pelo ONS, por dia"
          dados={dias}
          chaveX="d"
          formatoX="data"
          series={[
            { id: "solar", rotulo: "Solar no balanço do SIN", sigla: "Solar", cor: "var(--serie-solar)" },
            { id: "mmgd", rotulo: "MMGD estimada (carga verificada, como publicada hoje)", sigla: "MMGD", cor: "var(--cor-carvao)", tracejada: true },
          ]}
          unidade="MWmed"
          casas={0}
          zeroNoEixo
          marcos={marcos}
          altura={260}
        />
        <GraficoLinhas
          titulo="Carga no Balanço de Energia do SIN, por dia"
          dados={dias}
          chaveX="d"
          formatoX="data"
          series={[{ id: "carga", rotulo: "Carga no balanço do SIN", sigla: "Carga", cor: "var(--cor-energia)" }]}
          unidade="MWmed"
          casas={0}
          marcos={marcos}
          altura={220}
        />
      </div>
    </CursorSincronizado>
  );
}
