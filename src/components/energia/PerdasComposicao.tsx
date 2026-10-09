"use client";

import { useEffect, useMemo, useState } from "react";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useSelecaoPerdas } from "@/components/energia/PerdasSelecao";
import { num } from "@/lib/energia/formato";
import type { ColunaTabela } from "@/lib/energia/tabela";
import { ROTULO_DECOMPOSICAO, carregarJson, historicoDistribuidora, type LinhaComposicao } from "@/lib/energia/perdas";
import type { SerieAnualPerdas } from "@/lib/energia/tipos-perdas";

/**
 * Composição das perdas por distribuidora no ano de referência (P056): barras empilhadas
 * de técnicas e não técnicas sobre a MESMA energia injetada de referência, só onde a
 * decomposição fecha (só então as duas somam a taxa total). A distribuidora escolhida
 * (?d=, a mesma do mapa) acende nas barras e na tabela e ganha o histórico por
 * componente, lido da série anual sob demanda; não técnica sobre a baixa tensão fica em
 * gráfico próprio, porque tem outro denominador e não se soma às outras.
 */

const COLUNAS: ColunaTabela[] = [
  { id: "rotulo", rotulo: "Distribuidora", tipo: "texto" },
  { id: "tecnica", rotulo: "Técnicas", tipo: "percentual", casas: 2 },
  { id: "nao_tecnica", rotulo: "Não técnicas sobre a injetada", tipo: "percentual", casas: 2 },
  { id: "total", rotulo: "Perdas totais", tipo: "percentual", casas: 2 },
  { id: "pnt_bt", rotulo: "Não técnicas sobre a baixa tensão", tipo: "percentual", casas: 2 },
  { id: "residuo_mwh", rotulo: "Total − técnica − não técnica", tipo: "numero", unidade: "MWh", casas: 0 },
  { id: "decomposicao", rotulo: "Decomposição", tipo: "texto", categorica: true },
];

export type PerdasComposicaoProps = {
  linhas: LinhaComposicao[];
  /** Todas as distribuidoras (para ler o ?d= comum) e por que cada uma não está no gráfico. */
  ids: string[];
  rotulos: Record<string, string>;
  motivos: Record<string, string>;
  anoRef: number;
  taxaNacional: number | null;
  urlAnual: string;
  versao: string;
};

export function PerdasComposicao({ linhas, ids, rotulos, motivos, anoRef, taxaNacional, urlAnual, versao }: PerdasComposicaoProps) {
  const [sel, selecionar] = useSelecaoPerdas(ids);
  const naGrafico = sel ? linhas.find((l) => l.id === sel) ?? null : null;

  const [anual, setAnual] = useState<SerieAnualPerdas | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  useEffect(() => {
    if (!sel) return;
    let vivo = true;
    // nova escolha ou nova tentativa: o erro anterior não fica preso na tela
    setErro(null);
    carregarJson<SerieAnualPerdas>(urlAnual).then(
      (a) => vivo && setAnual(a),
      (e: unknown) => vivo && setErro(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      vivo = false;
    };
  }, [sel, urlAnual, tentativa]);
  const historico = useMemo(() => (sel && anual ? historicoDistribuidora(anual.distribuidoras[sel] ?? []) : null), [sel, anual]);

  // as barras recebem os valores exatos (ver LinhaComposicao): o total no fim da barra, na dica e na tabela do gráfico é o mesmo número da tabela da página
  const dados = useMemo(() => linhas.map((l) => ({ id: l.id, rotulo: l.rotulo, tecnica: l.tecnica_barra, nao_tecnica: l.nao_tecnica_barra })), [linhas]);
  const linhasTabela = useMemo(
    () => linhas.map((l) => ({ id: l.id, rotulo: l.rotulo, tecnica: l.tecnica, nao_tecnica: l.nao_tecnica, total: l.total, pnt_bt: l.pnt_bt, residuo_mwh: l.residuo_mwh, decomposicao: ROTULO_DECOMPOSICAO[l.decomposicao] })),
    [linhas],
  );

  return (
    <div className="space-y-5">
      <GraficoBarras
        titulo={`Perdas técnicas e não técnicas por distribuidora, ${anoRef}`}
        dados={dados}
        chaveCategoria="id"
        chaveRotulo="rotulo"
        series={[
          { id: "tecnica", rotulo: "Técnicas", cor: "var(--escala-seq-4)" },
          { id: "nao_tecnica", rotulo: "Não técnicas", cor: "var(--serie-termica)" },
        ]}
        unidade="% da energia injetada"
        casas={2}
        orientacao="horizontal"
        empilhado
        rotulosValor
        referencias={taxaNacional !== null ? [{ valor: taxaNacional, rotulo: `Perdas totais das concessionárias em ${anoRef}` }] : []}
        selecionado={naGrafico ? naGrafico.id : null}
        onSelecionar={selecionar}
      />

      <div className="border border-linha bg-papel px-4 py-3 text-sm text-carvao" data-selecao={sel ?? ""}>
        {!sel ? (
          <p className="text-carvao-muted">Escolha uma barra ou uma linha da tabela para ver a composição de uma distribuidora ao longo dos anos.</p>
        ) : (
          <>
            <p data-resposta="composicao-distribuidora">
              {naGrafico
                ? `${naGrafico.rotulo}, ${anoRef}: técnicas ${num(naGrafico.tecnica, 2)}% e não técnicas ${num(naGrafico.nao_tecnica, 2)}% da energia injetada; perdas totais de ${num(naGrafico.total, 2)}% sobre a mesma base (decomposição ${ROTULO_DECOMPOSICAO[naGrafico.decomposicao]}${naGrafico.residuo_mwh ? `, diferença de ${num(naGrafico.residuo_mwh, 0)} MWh no ano` : ""}).`
                : `${rotulos[sel] ?? sel} não está no gráfico de ${anoRef}: ${motivos[sel] ?? "sem dado"}.`}
            </p>
            {historico ? (
              <div className="mt-3 grid gap-4 lg:grid-cols-2">
                <GraficoLinhas
                  titulo={`${rotulos[sel] ?? sel}: perdas totais e técnicas por ano`}
                  dados={historico.pontos}
                  chaveX="ano"
                  formatoX="texto"
                  series={[
                    { id: "taxa", rotulo: "Perdas totais", cor: "var(--cor-energia)" },
                    { id: "tecnica", rotulo: "Técnicas", cor: "var(--escala-seq-4)", tracejada: true },
                  ]}
                  unidade="% da energia injetada"
                  casas={2}
                  zeroNoEixo
                  altura={240}
                />
                <GraficoLinhas
                  titulo={`${rotulos[sel] ?? sel}: não técnicas sobre a baixa tensão por ano`}
                  dados={historico.pontos}
                  chaveX="ano"
                  formatoX="texto"
                  series={[{ id: "pnt_bt", rotulo: "Não técnicas", cor: "var(--serie-termica)" }]}
                  unidade="% do mercado de baixa tensão"
                  casas={2}
                  zeroNoEixo
                  altura={240}
                />
              </div>
            ) : erro ? (
              <p className="mt-2 text-carvao">
                A série anual não carregou ({erro}).{" "}
                <button
                  type="button"
                  className="rotulo inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-energia"
                  onClick={() => setTentativa((t) => t + 1)}
                >
                  Tentar de novo
                </button>
              </p>
            ) : (
              <p role="status" className="mt-2 text-xs text-carvao-muted">
                Carregando a série anual.
              </p>
            )}
            {historico && (
              <p className="mt-2 text-xs leading-relaxed text-carvao-muted">
                Cada componente só aparece no ano em que entra na comparação: técnica publicada nos 12 meses sem a decomposição quebrada; não técnica com a decomposição fechando. Lacuna
                é ano sem o componente ou fora da comparação, nunca zero.
              </p>
            )}
          </>
        )}
      </div>

      <TabelaInterativa
        titulo={`Composição das perdas por distribuidora, ${anoRef}`}
        colunas={COLUNAS}
        linhas={linhasTabela}
        chaveLinha="id"
        colunaRotulo="rotulo"
        fonte="ANEEL, SAMP Balanço (linhas de valor medido; a técnica é a perda técnica informada no balanço de energia, estimativa da fonte, e a não técnica herda essa estimativa)"
        versao={versao}
        nomeArquivo={`perdas-composicao-${anoRef}`}
        chaveUrl="comp"
        selecionado={naGrafico ? naGrafico.id : null}
        onSelecionar={selecionar}
        ordemInicial={{ coluna: "total", direcao: "desc" }}
        dicaBusca="Sigla ou nome"
        nota={<>Técnicas e não técnicas sobre a energia injetada de referência; a soma delas reproduz a taxa total quando a decomposição fecha. A coluna &quot;Total − técnica − não técnica&quot; mostra a diferença em MWh no ano, e a coluna &quot;Decomposição&quot;, a regra de fechamento atendida.</>}
      />
    </div>
  );
}
