"use client";

import { useMemo } from "react";
import { CursorSincronizado } from "@/components/energia/CursorSincronizado";
import { ExpansaoMarcas, ExpansaoOpcoes } from "@/components/energia/ExpansaoOpcoes";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import {
  COLUNAS_CONFIABILIDADE,
  COLUNAS_DESLIZAMENTO,
  COLUNAS_PREVISOES_ANO,
  COR_VIABILIDADE,
  ESQUEMA_CRONOGRAMA,
  IDS_VIABILIDADE,
  VIABILIDADE_DO_ID,
  dataTexto,
  type IdViabilidade,
} from "@/lib/energia/expansao";
import type { LinhaTabela } from "@/lib/energia/tabela";

/**
 * P041, cronograma e revisões.
 *
 * Previsões atuais: a escolha de viabilidade (cro.via na URL) muda as séries das barras
 * empilhadas por ano e por mês; a pilha continua aditiva, porque as viabilidades são
 * partes disjuntas da mesma potência. A data-base (fotografia do RALIE) está em todo
 * título: previsão sem a data em que foi feita não é publicada.
 *
 * Revisões: confiabilidade (o que cada fotografia previa para 12 meses e o que foi
 * liberado) e deslizamento (como a previsão da mesma unidade mudou em 12 meses)
 * compartilham o eixo das fotografias e o cursor; o intervalo de zoom (cro.de, cro.ate)
 * e a escolha com ou sem as datas em bloco (cro.bloco) ficam na URL.
 */

const AMOSTRA = (cor: string) => <span aria-hidden="true" className="inline-block h-3 w-3 shrink-0 border border-carvao" style={{ background: cor }} />;
const OPCOES_VIA = IDS_VIABILIDADE.map((id) => ({ id, rotulo: `Viabilidade ${VIABILIDADE_DO_ID[id].toLocaleLowerCase("pt-BR")}`, marcador: AMOSTRA(COR_VIABILIDADE[id]) }));
const OPCOES_BLOCO = [
  ["com", "Todas as unidades"],
  ["sem", "Sem as datas em bloco"],
] as const;

type LinhaPrev = LinhaTabela & { id: string };

export function ExpansaoPrevisoes({ porAno, proximos, dataRalie, fonte }: { porAno: LinhaPrev[]; proximos: LinhaPrev[]; dataRalie: string; fonte: string }) {
  const [v, definir] = useEstadoUrl(ESQUEMA_CRONOGRAMA);
  const series = useMemo(
    () => IDS_VIABILIDADE.filter((id) => (v.via as readonly string[]).includes(id)).map((id) => ({ id, rotulo: `Viabilidade ${VIABILIDADE_DO_ID[id].toLocaleLowerCase("pt-BR")}`, cor: COR_VIABILIDADE[id] })),
    [v.via],
  );
  const todas = series.length === IDS_VIABILIDADE.length;
  const sufixo = todas ? "" : ` (só ${series.map((s) => s.rotulo.toLocaleLowerCase("pt-BR")).join(" e ")})`;
  return (
    <div className="space-y-6">
      <ExpansaoMarcas rotulo="Viabilidade (fiscalização)" opcoes={OPCOES_VIA} valor={v.via as IdViabilidade[]} onMudar={(via) => definir({ via })} />
      <GraficoBarras
        titulo={`Potência com previsão de operação comercial por ano, fotografia do RALIE de ${dataRalie}${sufixo} (MW)`}
        dados={porAno}
        chaveCategoria="id"
        chaveRotulo="ano"
        series={series}
        unidade="MW"
        casas={1}
        empilhado
        rotulosValor
        altura={320}
      />
      <GraficoBarras
        titulo={`Previsões dos próximos 24 meses, fotografia do RALIE de ${dataRalie}${sufixo} (MW)`}
        dados={proximos}
        chaveCategoria="id"
        chaveRotulo="mes"
        series={series}
        unidade="MW"
        casas={1}
        empilhado
        altura={300}
      />
      <TabelaInterativa
        titulo={`Previsões por ano, fotografia de ${dataRalie}`}
        colunas={COLUNAS_PREVISOES_ANO}
        linhas={porAno}
        chaveLinha="id"
        colunaRotulo="ano"
        fonte={fonte}
        versao={dataRalie}
        nomeArquivo="expansao-previsoes-ano"
        chaveUrl="cro.tab"
        nota="Data-base de todas as linhas: a fotografia indicada. As colunas de viabilidade somam a potência prevista do ano."
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
          titulo={`Do que cada fotografia previa para os 12 meses seguintes, quanto foi liberado para operação comercial, ${dataTexto(primeira)} a ${dataTexto(ultima)} (% da potência prevista)`}
          dados={confiabilidade}
          chaveX="ralie"
          formatoX="data"
          series={[
            { id: "pct_no_prazo", rotulo: "Liberado no prazo (até 12 meses)", sigla: "No prazo", cor: "var(--cor-energia)" },
            { id: "pct_depois", rotulo: "Liberado depois", sigla: "Depois", cor: "var(--serie-comp-3)", tracejada: true },
            { id: "pct_nao_liberado", rotulo: `Não liberado até ${dataLiberacoes}`, sigla: "Não liberado", cor: "var(--escala-div-neg-1)" },
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
        <ExpansaoOpcoes rotulo="Revisão das previsões" nome="expansao-cro-bloco" opcoes={OPCOES_BLOCO} valor={v.bloco} onMudar={(bloco) => definir({ bloco })} />
        <GraficoLinhas
          titulo={`Como a previsão da mesma unidade mudou em 12 meses, por fotografia de partida${v.bloco === "sem" ? ", sem as unidades em data em bloco" : ""} (% da potência)`}
          dados={desl}
          chaveX="ralie"
          formatoX="data"
          series={[
            { id: "pct_adiada", rotulo: "Previsão adiada", sigla: "Adiada", cor: "var(--escala-div-neg-1)" },
            { id: "pct_mantida", rotulo: "Previsão mantida", sigla: "Mantida", cor: "var(--cor-mineral)", tracejada: true },
            { id: "pct_antecipada", rotulo: "Previsão antecipada", sigla: "Antecipada", cor: "var(--cor-energia)" },
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
        titulo="Confiabilidade das previsões por fotografia mensal"
        colunas={COLUNAS_CONFIABILIDADE}
        linhas={confiabilidade}
        chaveLinha="id"
        colunaRotulo="ralie"
        fonte={fonte}
        versao={dataLiberacoes}
        nomeArquivo="expansao-confiabilidade-previsoes"
        chaveUrl="cro.conf"
        ordemInicial={{ coluna: "ralie", direcao: "desc" }}
        nota="Cada linha é uma previsão com data-base: a fotografia. Unidade já liberada antes da fotografia sai do denominador. Só janelas encerradas pelo menos 15 dias antes da data do arquivo de liberações."
      />
      <TabelaInterativa
        titulo={`Revisão das previsões entre fotografias com 12 meses de distância${v.bloco === "sem" ? " (sem as datas em bloco)" : ""}`}
        colunas={COLUNAS_DESLIZAMENTO}
        linhas={desl}
        chaveLinha="id"
        colunaRotulo="ralie"
        fonte={fonte}
        versao={dataLiberacoes}
        nomeArquivo={v.bloco === "sem" ? "expansao-revisao-previsoes-sem-bloco" : "expansao-revisao-previsoes"}
        chaveUrl="cro.desl"
        ordemInicial={{ coluna: "ralie", direcao: "desc" }}
        nota="Só unidades que seguem em implantação nas duas fotografias e têm previsão nas duas (viés de sobrevivência). Mediana ponderada pela potência; positivo é adiamento."
      />
    </div>
  );
}
