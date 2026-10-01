"use client";

import { useMemo } from "react";
import { GraficoDispersao } from "@/components/energia/GraficoDispersao";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { useSelecaoPerdas } from "@/components/energia/PerdasSelecao";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { num, plural } from "@/lib/energia/formato";
import type { ColunaTabela, LinhaTabela } from "@/lib/energia/tabela";
import type { PontoDispersao } from "@/lib/energia/dispersao";

/**
 * Contexto territorial (P058): renda média domiciliar per capita dos municípios da área
 * (Censo 2022) contra a taxa de perdas totais ou a não técnica sobre a baixa tensão das
 * concessionárias em 2022, com o ρ de Spearman e o n publicados pelo pipeline. A medida do
 * eixo vertical fica na URL (?rel=). Sem reta: a associação é descrita, não modelada, e
 * nunca vira causa nem responsabilidade das famílias da área (seção 10.4).
 */

const ESQUEMA = { rel: campo(tiposUrl.opcao(["taxa", "pnt_bt"] as const), "taxa" as "taxa" | "pnt_bt", { param: "rel" }) };

const COLUNAS: ColunaTabela[] = [
  { id: "rotulo", rotulo: "Distribuidora", tipo: "texto" },
  { id: "ufs", rotulo: "UF", tipo: "texto", categorica: true },
  { id: "municipios", rotulo: "Municípios na área", tipo: "numero", casas: 0 },
  { id: "confirmados", rotulo: "Municípios confirmados", tipo: "numero", casas: 0 },
  { id: "exclusivos", rotulo: "Municípios só dela", tipo: "numero", casas: 0 },
  { id: "populacao", rotulo: "População dos confirmados (2022)", tipo: "numero", unidade: "pessoas", casas: 0 },
  { id: "area_km2", rotulo: "Área dos confirmados", tipo: "numero", unidade: "km²", casas: 0 },
  { id: "renda", rotulo: "Renda média per capita dos confirmados", tipo: "numero", unidade: "R$ de 2022 por mês", casas: 2 },
  { id: "cobertura_exclusivos", rotulo: "População em municípios só dela", tipo: "percentual", casas: 1 },
];

export type PerdasContextoProps = {
  pontos: { id: string; rotulo: string; renda: number | null; taxa: number | null; pnt_bt: number | null }[];
  linhas: LinhaTabela[];
  ids: string[];
  rotulos: Record<string, string>;
  ano: number;
  rho: { taxa: number | null; n_taxa: number; pnt_bt: number | null; n_pnt_bt: number };
  versao: string;
};

export function PerdasContexto({ pontos, linhas, ids, rotulos, ano, rho, versao }: PerdasContextoProps) {
  const [sel, selecionar] = useSelecaoPerdas(ids);
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const y = v.rel;
  const pts = useMemo<PontoDispersao[]>(() => pontos.map((p) => ({ id: p.id, rotulo: p.rotulo, x: p.renda, y: y === "taxa" ? p.taxa : p.pnt_bt })), [pontos, y]);
  const r = y === "taxa" ? rho.taxa : rho.pnt_bt;
  const n = y === "taxa" ? rho.n_taxa : rho.n_pnt_bt;
  const naDispersao = sel ? pontos.some((p) => p.id === sel) : false;
  return (
    <div className="space-y-5">
      <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-carvao">
        <legend className="rotulo mb-1 text-mineral">Eixo vertical</legend>
        {(
          [
            ["taxa", "Taxa de perdas totais (% da energia injetada)"],
            ["pnt_bt", "Não técnicas (% do mercado de baixa tensão)"],
          ] as const
        ).map(([id, rot]) => (
          <label key={id} className="inline-flex min-h-[44px] cursor-pointer items-center gap-2">
            <input type="radio" name="perdas-rel" value={id} checked={y === id} onChange={() => definir({ rel: id })} className="h-4 w-4 accent-[var(--cor-energia)]" />
            {rot}
          </label>
        ))}
      </fieldset>
      <GraficoDispersao
        titulo={`Renda média da área e ${y === "taxa" ? "taxa de perdas totais" : "perdas não técnicas"}, concessionárias, ${ano}`}
        pontos={pts}
        eixoX={{ rotulo: "Renda média domiciliar per capita dos municípios da área", unidade: "R$ de 2022 por mês", casas: 0 }}
        eixoY={{ rotulo: y === "taxa" ? "Perdas totais" : "Perdas não técnicas", unidade: y === "taxa" ? "% da energia injetada" : "% do mercado de baixa tensão", casas: 1 }}
        rodape={{
          periodo: `${ano} (perdas do ano do Censo e território da relação de ${ano})`,
          avisoCausalidade: "Associação entre áreas não é causalidade nem descreve cada família; perdas não técnicas não são atribuídas à população da área.",
          nota:
            r !== null
              ? `ρ de Spearman = ${num(r, 3)} com ${plural(n, "concessionária", "concessionárias")}, calculado no pipeline sobre os valores sem arredondamento.`
              : "Sem pares suficientes para a correlação.",
        }}
        entidade={{ singular: "concessionária", plural: "concessionárias" }}
        destacados={naDispersao && sel ? [sel] : []}
      />
      {sel && !naDispersao && (
        <p className="text-sm text-carvao-muted" data-selecao={sel}>
          {rotulos[sel] ?? sel} não está na dispersão: só entram concessionárias com {ano} completo, sem alerta e com território na relação de {ano}.
        </p>
      )}
      <TabelaInterativa
        titulo="Território e contexto social da área de cada distribuidora"
        colunas={COLUNAS}
        linhas={linhas}
        chaveLinha="id"
        colunaRotulo="rotulo"
        fonte="IBGE, Censo 2022 (tabelas 4714 e 10295); ANEEL, IndQual Município e limites de continuidade (relação conjunto × município); ANEEL, cadastro de MMGD (confirmação dos vínculos)"
        versao={versao}
        nomeArquivo="perdas-contexto-territorial"
        chaveUrl="ctx"
        selecionado={sel}
        onSelecionar={selecionar}
        ordemInicial={{ coluna: "populacao", direcao: "desc" }}
        dicaBusca="Sigla, nome ou UF"
        nota={<>Somas sobre os municípios inteiros com vínculo confirmado na relação de 2026; renda média ponderada pelos moradores, nunca média simples de médias.</>}
      />
    </div>
  );
}
