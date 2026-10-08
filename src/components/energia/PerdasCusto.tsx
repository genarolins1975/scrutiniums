"use client";

import { useMemo } from "react";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEvidenciaPerdas, useSelecaoPerdas } from "@/components/energia/PerdasSelecao";
import { ComproveNumero } from "@/components/energia/ComproveNumero";
import { dataBR, num } from "@/lib/energia/formato";
import type { ColunaTabela } from "@/lib/energia/tabela";
import { divergenciaArredondamentoCusto, pctOu, rotuloResolucao, type LinhaCusto } from "@/lib/energia/perdas";

/**
 * Custo unitário das perdas na tarifa residencial B1 (P058): as três componentes de perdas
 * (técnicas, não técnicas e na Rede Básica) em R$/MWh por distribuidora, empilhadas porque
 * somam a componente de perdas da tarifa (composição aditiva publicada pela fonte). O
 * gráfico só traz processos vigentes na data da consulta; o processo com vigência
 * encerrada fica na tabela com a situação escrita, nunca como a tarifa em vigor. Nada é
 * multiplicado por mercado ou por tarifa cheia: é o nível reconhecido por MWh, não o
 * custo total em reais (bloqueado: a fonte não publica o valor por processo em base aberta).
 */

const COLUNAS: ColunaTabela[] = [
  { id: "rotulo", rotulo: "Distribuidora", tipo: "texto" },
  { id: "situacao", rotulo: "Situação na data da consulta", tipo: "texto", categorica: true },
  { id: "reh", rotulo: "Resolução", tipo: "texto" },
  { id: "inicio", rotulo: "Início da vigência", tipo: "data" },
  { id: "fim", rotulo: "Fim da vigência", tipo: "data" },
  { id: "pt", rotulo: "Perdas técnicas", tipo: "numero", unidade: "R$/MWh", casas: 2 },
  { id: "pnt", rotulo: "Perdas não técnicas", tipo: "numero", unidade: "R$/MWh", casas: 2 },
  { id: "rede_basica", rotulo: "Perdas na Rede Básica", tipo: "numero", unidade: "R$/MWh", casas: 2 },
  { id: "perdas", rotulo: "Perdas (soma das componentes)", tipo: "numero", unidade: "R$/MWh", casas: 2 },
  { id: "total", rotulo: "Tarifa B1 (TUSD + TE)", tipo: "numero", unidade: "R$/MWh", casas: 2 },
  { id: "participacao_perdas_pct", rotulo: "Perdas na tarifa", tipo: "percentual", casas: 2 },
  { id: "participacao_pnt_pct", rotulo: "Não técnicas na tarifa", tipo: "percentual", casas: 2 },
];

export type PerdasCustoProps = {
  linhas: LinhaCusto[];
  /** perdas_evidencias_tarifa.json, lido só quando há distribuidora escolhida. */
  urlEvidencias: string;
  ids: string[];
  rotulos: Record<string, string>;
  consultadaEm: string;
  /** Anos dos arquivos de componentes tarifárias lidos (proveniência da gold), ex.: "2012 a 2026". */
  anosArquivos: string;
  versao: string;
};

export function PerdasCusto({ linhas, urlEvidencias, ids, rotulos, consultadaEm, anosArquivos, versao }: PerdasCustoProps) {
  const [sel, selecionar] = useSelecaoPerdas(ids);
  const vigentes = useMemo(() => linhas.filter((l) => l.situacao === "vigente"), [linhas]);
  const dados = useMemo(() => vigentes.map((l) => ({ id: l.id, rotulo: l.rotulo, pt: l.pt, pnt: l.pnt, rede_basica: l.rede_basica })), [vigentes]);
  const linhasTabela = useMemo(
    () =>
      linhas.map((l) => ({
        id: l.id,
        rotulo: l.rotulo,
        situacao: l.situacao === "vigente" ? "vigente" : l.ativa ? "vigência encerrada, distribuidora ativa" : "vigência encerrada, série encerrada no SAMP",
        reh: rotuloResolucao(l.resolucao),
        inicio: l.inicio,
        fim: l.fim,
        pt: l.pt,
        pnt: l.pnt,
        rede_basica: l.rede_basica,
        perdas: l.perdas,
        total: l.total,
        participacao_perdas_pct: l.participacao_perdas_pct,
        participacao_pnt_pct: l.participacao_pnt_pct,
      })),
    [linhas],
  );
  const linhaSel = sel ? linhas.find((l) => l.id === sel) ?? null : null;
  const arredondamento = useMemo(() => divergenciaArredondamentoCusto(linhas), [linhas]);
  const [prova, tentarProva] = useEvidenciaPerdas(urlEvidencias, linhaSel ? linhaSel.id : null);
  return (
    <div className="space-y-5">
      <GraficoBarras
        titulo={`Componentes de perdas na tarifa residencial B1 vigente em ${dataBR(consultadaEm)}`}
        dados={dados}
        chaveCategoria="id"
        chaveRotulo="rotulo"
        series={[
          { id: "pt", rotulo: "Técnicas", cor: "var(--escala-seq-4)" },
          { id: "pnt", rotulo: "Não técnicas", cor: "var(--serie-termica)" },
          { id: "rede_basica", rotulo: "Rede Básica", cor: "var(--serie-referencia)" },
        ]}
        unidade="R$/MWh"
        casas={2}
        orientacao="horizontal"
        empilhado
        rotulosValor
        selecionado={linhaSel && linhaSel.situacao === "vigente" ? linhaSel.id : null}
        onSelecionar={selecionar}
      />
      {arredondamento.exemplo && (
        <p className="max-w-prose2 text-xs leading-relaxed text-carvao-muted" data-arredondamento="custo">
          O total na ponta de cada barra soma as três componentes já arredondadas em duas casas; a coluna Perdas da tabela soma antes de arredondar. A diferença é de no máximo 0,01 R$/MWh e aparece em{" "}
          {num(arredondamento.n, 0)} das {num(arredondamento.de, 0)} distribuidoras (por exemplo, {arredondamento.exemplo.rotulo}: {num(arredondamento.exemplo.barra, 2)} na barra e {num(arredondamento.exemplo.tabela, 2)} na tabela).
        </p>
      )}
      <div className="border border-linha bg-papel px-4 py-3 text-sm text-carvao" data-selecao={sel ?? ""}>
        {!sel ? (
          <p className="text-carvao-muted">Escolha uma barra ou uma linha da tabela para ler a componente de perdas da tarifa de uma distribuidora.</p>
        ) : !linhaSel ? (
          <p>{rotulos[sel] ?? sel}: sem processo tarifário com tarifa residencial B1 convencional nos arquivos de componentes tarifárias de {anosArquivos}.</p>
        ) : (
          <>
          <p data-resposta="custo-distribuidora">
            {`${linhaSel.rotulo}, ${rotuloResolucao(linhaSel.resolucao) ?? "resolução não informada"} (${dataBR(linhaSel.inicio)} a ${dataBR(linhaSel.fim)}): `}
            {linhaSel.situacao === "vigente" ? "vigente na data da consulta. " : `vigência encerrada em ${dataBR(linhaSel.fim)}, sem processo seguinte no arquivo da fonte em ${dataBR(consultadaEm)}; não é a tarifa em vigor. `}
            {`Técnicas ${num(linhaSel.pt, 2)}, não técnicas ${num(linhaSel.pnt, 2)} e Rede Básica ${num(linhaSel.rede_basica, 2)} R$/MWh: perdas de ${num(linhaSel.perdas, 2)} R$/MWh, ${pctOu(linhaSel.participacao_perdas_pct, 2)} da tarifa B1 sem tributos (${num(linhaSel.total, 2)} R$/MWh).`}
          </p>
          <div className="mt-1">
            {prova.estado === "pronta" ? (
              <ComproveNumero evidencia={prova.evidencia} rotulo="Comprove este valor" endereco={`https://scrutiniums.com/setor-eletrico/perdas/custo-e-contexto?d=${linhaSel.id}#custo`} />
            ) : prova.estado === "carregando" ? (
              <span role="status" className="text-xs text-carvao-muted">
                Carregando a evidência do processo tarifário.
              </span>
            ) : prova.estado === "erro" ? (
              <button type="button" className="rotulo inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4" onClick={tentarProva}>
                A evidência não carregou ({prova.erro}); tentar de novo
              </button>
            ) : null}
          </div>
          </>
        )}
      </div>
      <TabelaInterativa
        titulo="Componentes de perdas na tarifa residencial B1, por distribuidora"
        colunas={COLUNAS}
        linhas={linhasTabela}
        chaveLinha="id"
        colunaRotulo="rotulo"
        fonte="ANEEL, Componentes Tarifárias (TUSD_PT, TUSD_PNT, TUSD_Per_RB_D e TE_Per_RB da subclasse residencial B1 convencional)"
        versao={versao}
        nomeArquivo="perdas-custo-tarifa-b1"
        chaveUrl="custo"
        selecionado={linhaSel ? linhaSel.id : null}
        onSelecionar={selecionar}
        ordemInicial={{ coluna: "perdas", direcao: "desc" }}
        dicaBusca="Sigla ou nome"
        nota={<>Valores nominais, sem tributos, do último processo tarifário de cada distribuidora no arquivo da fonte. Processo vigente: início ≤ {dataBR(consultadaEm)} ≤ fim.</>}
      />
    </div>
  );
}
