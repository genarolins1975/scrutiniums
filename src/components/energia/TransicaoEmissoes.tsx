"use client";

import { useMemo } from "react";
import { Comparador } from "@/components/energia/Comparador";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { ESQUEMA_EMISSOES, dadosPerfilAnos } from "@/lib/energia/transicao";
import type { FatorMes } from "@/lib/energia/tipos-transicao";

/**
 * P064, emissões: a série mensal do fator médio do MCTI com o intervalo na URL
 * (em.de e em.ate) e a marca da quebra declarada pela fonte, e a comparação mês a
 * mês de até quatro anos (em.anos), na mesma escala. Os valores são os publicados
 * pelo MCTI, sem cálculo da plataforma; mês não publicado fica ausente, nunca zero.
 */

const CORES_COMP = ["var(--serie-comp-1)", "var(--serie-comp-2)", "var(--serie-comp-3)", "var(--serie-comp-4)"];

export function TransicaoFatorMensal({ dados, marcos }: { dados: { m: string; medio: number }[]; marcos: { x: string; rotulo: string }[] }) {
  const [v, definir] = useEstadoUrl(ESQUEMA_EMISSOES);
  const intervalo = v.de && v.ate && v.de <= v.ate ? { inicio: v.de, fim: v.ate } : null;
  return (
    <GraficoLinhas
      titulo="Fator médio de emissão de CO2 do SIN por mês (inventários)"
      dados={dados}
      chaveX="m"
      formatoX="mes"
      series={[{ id: "medio", rotulo: "Fator médio mensal", sigla: "Fator médio", cor: "var(--serie-termica)" }]}
      unidade="tCO2/MWh"
      casas={4}
      zeroNoEixo
      marcos={marcos}
      zoom
      intervalo={intervalo}
      onIntervalo={(i) => definir({ de: i?.inicio ?? "", ate: i?.fim ?? "" })}
      altura={300}
    />
  );
}

export function TransicaoCompararAnos({ medioMensal, anos, padrao }: { medioMensal: FatorMes[]; anos: string[]; padrao: string[] }) {
  const [v, definir] = useEstadoUrl(ESQUEMA_EMISSOES);
  const escolhidos = useMemo(() => v.anos.filter((a) => anos.includes(a)), [v.anos, anos]);
  const efetivos = escolhidos.length ? escolhidos : padrao;
  const dados = useMemo(() => dadosPerfilAnos({ medio_mensal: medioMensal }, efetivos), [medioMensal, efetivos]);
  const entidades = useMemo(() => [...anos].reverse().map((a) => ({ id: a, rotulo: a })), [anos]);
  return (
    <div className="space-y-4">
      <Comparador
        rotulo="Anos para comparar mês a mês (até 4)"
        entidades={entidades}
        selecionadas={escolhidos}
        onMudar={(ids) => definir({ anos: ids })}
        dicaBusca="Ano (2021)"
        vazio={`Nenhum ano escolhido: o gráfico mostra ${padrao.join(", ")}, os mais recentes publicados.`}
      >
        {() => null}
      </Comparador>
      <GraficoLinhas
        titulo={`Fator médio mês a mês: ${efetivos.join(", ")}`}
        dados={dados}
        chaveX="mes"
        formatoX="texto"
        series={efetivos.map((a, i) => ({ id: a, rotulo: a, sigla: a, cor: CORES_COMP[i % CORES_COMP.length] }))}
        unidade="tCO2/MWh"
        casas={4}
        zeroNoEixo
        altura={280}
        sincronizarCursor={false}
      />
    </div>
  );
}
