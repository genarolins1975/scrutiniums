"use client";

import { useState } from "react";
import { TabelaDados } from "@/components/painel/TabelaDados";

export type CredorDesenrola = {
  cod: string;
  nome: string;
  consolidado: boolean;
  operacoes: number;
  partOp: number;
  /** Volume após desconto, em R$ milhões. */
  volume: number;
  partVol: number;
  valorMedio: number;
  /** Operações por faixa; null quando o grupo não tem linha na faixa. */
  faixa1: number | null;
  faixa2: number | null;
  ufs: number;
};

const LIMITE = 5;

/**
 * Comparação de até cinco grupos credores, escolhidos entre os vinte com mais operações (a mesma regra da vista antiga). Sem seleção,
 * a tabela mostra os cinco maiores. Cada botão é um alternador com estado anunciado (aria-pressed); ao chegar a cinco, os demais
 * ficam indisponíveis até que um seja retirado, e a linha de estado diz isso.
 */
export function CompararCredores({ credores, periodo }: Readonly<{ credores: CredorDesenrola[]; periodo: string }>) {
  const [escolhidos, setEscolhidos] = useState<string[]>([]);
  const cheio = escolhidos.length >= LIMITE;
  const alternar = (cod: string) => setEscolhidos((atual) => (atual.includes(cod) ? atual.filter((c) => c !== cod) : atual.length < LIMITE ? [...atual, cod] : atual));
  const linhas = escolhidos.length ? credores.filter((c) => escolhidos.includes(c.cod)) : credores.slice(0, LIMITE);
  return (
    <section aria-labelledby="comparar-credores-titulo" data-comparar-credores={escolhidos.length} className="border-t border-linha pt-6">
      <h3 id="comparar-credores-titulo" className="t-h3 text-carvao">
        Comparar até cinco grupos credores
      </h3>
      <div role="group" aria-label="Grupos credores para comparar" data-fatia="controles" className="mt-3 border-y border-linha py-3">
        <ul className="flex flex-wrap gap-2">
          {credores.map((c) => {
            const ativo = escolhidos.includes(c.cod);
            const travado = cheio && !ativo;
            return (
              <li key={c.cod}>
                <button
                  type="button"
                  aria-pressed={ativo}
                  aria-disabled={travado || undefined}
                  onClick={() => alternar(c.cod)}
                  className={`inline-flex min-h-[44px] items-center border px-3 text-sm transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze/50 active:scale-[0.98] ${
                    ativo ? "border-carvao bg-carvao text-marfim" : travado ? "border-linha bg-superficie text-carvao-muted opacity-60" : "border-linha bg-superficie text-carvao hover:border-carvao"
                  }`}
                >
                  {c.nome}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
          <p role="status" className="t-meta text-carvao-muted">
            {escolhidos.length === 0
              ? "Sem seleção: a tabela mostra os cinco grupos com mais operações."
              : cheio
                ? "Cinco grupos selecionados, o limite. Retire um para escolher outro."
                : `${escolhidos.length} de ${LIMITE} grupos selecionados.`}
          </p>
          {escolhidos.length > 0 && (
            <button type="button" onClick={() => setEscolhidos([])} className="inline-flex min-h-[44px] items-center text-sm text-carvao underline decoration-linha underline-offset-4 hover:decoration-carvao">
              Limpar a seleção
            </button>
          )}
        </div>
      </div>
      <TabelaDados
        idioma="pt"
        recolhida={false}
        titulo={`Grupos credores comparados, faixas 1 e 2, ${periodo}`}
        colunas={["Grupo credor", "Operações", "% das operações", "Volume após desconto (R$ milhões)", "% do volume", "Valor médio (R$)", "Operações na Faixa 1", "Operações na Faixa 2", "UFs"]}
        linhas={linhas.map((c) => [c.consolidado ? `${c.nome} (consolidado)` : c.nome, c.operacoes, c.partOp, c.volume, c.partVol, c.valorMedio, c.faixa1, c.faixa2, c.ufs])}
        casas={[null, 0, 2, 1, 2, 0, 0, 0, 0]}
        ausencia={{ "Operações na Faixa 1": "sem linha na base", "Operações na Faixa 2": "sem linha na base" }}
        fixarPrimeiraColuna
        nota="Reportado pela fonte, com participações e valor médio calculados. Os botões listam os vinte grupos com mais operações; os demais estão na tabela completa desta figura."
      />
    </section>
  );
}
