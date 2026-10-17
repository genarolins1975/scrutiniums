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
import { Nome } from "@/components/i18n/Nome";
import type { Idioma } from "@/lib/idioma";
import { porIdioma } from "@/lib/energia/idioma";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";

/**
 * Contexto territorial (P058): renda média domiciliar per capita dos municípios da área
 * (Censo) contra a taxa de perdas totais ou a não técnica sobre a baixa tensão das
 * concessionárias no ano do Censo, com o ρ de Spearman e o n publicados pelo pipeline. A medida do
 * eixo vertical fica na URL (?rel=). Sem reta: a associação é descrita, não modelada, e
 * nunca vira causa nem responsabilidade das famílias da área (seção 10.4).
 */

const ESQUEMA = { rel: campo(tiposUrl.opcao(["taxa", "pnt_bt"] as const), "taxa" as "taxa" | "pnt_bt", { param: "rel" }) };

// o ano do Censo vem da gold (proveniência do contexto), não do código
const colunas = (censo: string, idioma: Idioma): ColunaTabela[] =>
  porIdioma(idioma, {
    pt: [
      { id: "rotulo", rotulo: "Distribuidora", tipo: "texto" },
      { id: "ufs", rotulo: "UF", tipo: "texto", categorica: true },
      { id: "municipios", rotulo: "Municípios na área", tipo: "numero", casas: 0 },
      { id: "confirmados", rotulo: "Municípios confirmados", tipo: "numero", casas: 0 },
      { id: "exclusivos", rotulo: "Municípios só dela", tipo: "numero", casas: 0 },
      { id: "populacao", rotulo: `População dos confirmados (${censo})`, tipo: "numero", unidade: "pessoas", casas: 0 },
      { id: "area_km2", rotulo: "Área dos confirmados", tipo: "numero", unidade: "km²", casas: 0 },
      { id: "renda", rotulo: "Renda média per capita dos confirmados", tipo: "numero", unidade: `R$ de ${censo} por mês`, casas: 2 },
      { id: "cobertura_exclusivos", rotulo: "População em municípios só dela", tipo: "percentual", casas: 1 },
    ],
    en: [
      { id: "rotulo", rotulo: "Distribution utility", tipo: "texto" },
      { id: "ufs", rotulo: "State", tipo: "texto", categorica: true },
      { id: "municipios", rotulo: "Municipalities in the area", tipo: "numero", casas: 0 },
      { id: "confirmados", rotulo: "Confirmed municipalities", tipo: "numero", casas: 0 },
      { id: "exclusivos", rotulo: "Municipalities served only by it", tipo: "numero", casas: 0 },
      { id: "populacao", rotulo: `Population of the confirmed ones (${censo})`, tipo: "numero", unidade: "people", casas: 0 },
      { id: "area_km2", rotulo: "Area of the confirmed ones", tipo: "numero", unidade: "km²", casas: 0 },
      { id: "renda", rotulo: "Average income per capita of the confirmed ones", tipo: "numero", unidade: `${censo} R$ per month`, casas: 2 },
      { id: "cobertura_exclusivos", rotulo: "Population in municipalities served only by it", tipo: "percentual", casas: 1 },
    ],
  });

export type PerdasContextoProps = {
  pontos: { id: string; rotulo: string; renda: number | null; taxa: number | null; pnt_bt: number | null }[];
  linhas: LinhaTabela[];
  ids: string[];
  rotulos: Record<string, string>;
  /** Ano das perdas da associação (o do Censo). */
  ano: number;
  /** Relação conjunto × município que define o território da associação. */
  anoRelacao: number;
  /** Relação usada na tabela de território (a mais recente, a mesma do mapa). */
  anoRelacaoTabela: number | null;
  /** Ano do Censo da renda e da população. */
  censo: string;
  rho: { taxa: number | null; n_taxa: number; pnt_bt: number | null; n_pnt_bt: number };
  versao: string;
};

export function PerdasContexto({ pontos, linhas, ids, rotulos, ano, anoRelacao, anoRelacaoTabela, censo, rho, versao }: PerdasContextoProps) {
  const [sel, selecionar] = useSelecaoPerdas(ids);
  const idioma = useIdioma();
  const tx = useTx();
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const y = v.rel;
  const pts = useMemo<PontoDispersao[]>(() => pontos.map((p) => ({ id: p.id, rotulo: p.rotulo, x: p.renda, y: y === "taxa" ? p.taxa : p.pnt_bt })), [pontos, y]);
  const r = y === "taxa" ? rho.taxa : rho.pnt_bt;
  const n = y === "taxa" ? rho.n_taxa : rho.n_pnt_bt;
  const naDispersao = sel ? pontos.some((p) => p.id === sel) : false;
  const cols = useMemo(() => colunas(censo, idioma), [censo, idioma]);
  return (
    <div className="space-y-5">
      <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-carvao">
        <legend className="rotulo mb-1 text-mineral">{tx("Eixo vertical", "Vertical axis")}</legend>
        {(
          [
            ["taxa", tx("Taxa de perdas totais (% da energia injetada)", "Total loss rate (% of injected energy)")],
            ["pnt_bt", tx("Não técnicas (% do mercado de baixa tensão)", "Non-technical (% of the low-voltage market)")],
          ] as const
        ).map(([id, rot]) => (
          <label key={id} className="inline-flex min-h-[44px] cursor-pointer items-center gap-2">
            <input type="radio" name="perdas-rel" value={id} checked={y === id} onChange={() => definir({ rel: id })} className="h-4 w-4 accent-[var(--cor-energia)]" />
            {rot}
          </label>
        ))}
      </fieldset>
      <GraficoDispersao
        titulo={tx(
          `Renda média da área e ${y === "taxa" ? "taxa de perdas totais" : "perdas não técnicas"}, concessionárias, ${ano}`,
          `Average income of the area and ${y === "taxa" ? "total loss rate" : "non-technical losses"}, concession holders, ${ano}`,
        )}
        pontos={pts}
        eixoX={{
          rotulo: tx("Renda média domiciliar per capita dos municípios da área", "Average household income per capita of the area's municipalities"),
          unidade: tx(`R$ de ${censo} por mês`, `${censo} R$ per month`),
          casas: 0,
        }}
        eixoY={{
          rotulo: y === "taxa" ? tx("Perdas totais", "Total losses") : tx("Perdas não técnicas", "Non-technical losses"),
          unidade: y === "taxa" ? tx("% da energia injetada", "% of injected energy") : tx("% do mercado de baixa tensão", "% of the low-voltage market"),
          casas: 2,
        }}
        rodape={{
          periodo: tx(`${ano} (perdas do ano do Censo e território da relação de ${anoRelacao})`, `${ano} (losses of the Census year and territory of the ${anoRelacao} relation)`),
          avisoCausalidade: tx(
            "Associação entre áreas não é causalidade nem descreve cada família; perdas não técnicas não são atribuídas à população da área.",
            "An association across areas is not causation and does not describe each household; non-technical losses are not attributed to the population of the area.",
          ),
          nota:
            r !== null
              ? tx(
                  `ρ de Spearman = ${num(r, 3)} com ${plural(n, "concessionária", "concessionárias")}, calculado pelo observatório sobre os valores sem arredondamento.`,
                  `Spearman's ρ = ${num(r, 3, idioma)} with ${plural(n, "concession holder", "concession holders", idioma)}, calculated by the observatory on the unrounded values.`,
                )
              : tx("Sem pares suficientes para a correlação.", "Not enough pairs for the correlation."),
        }}
        entidade={tx({ singular: "concessionária", plural: "concessionárias" }, { singular: "concession holder", plural: "concession holders" })}
        destacados={naDispersao && sel ? [sel] : []}
      />
      {sel && !naDispersao && (
        <p className="text-sm text-carvao-muted" data-selecao={sel}>
          {tx(
            <>
              {rotulos[sel] ?? sel} não está na dispersão: só entram concessionárias com {ano} completo, sem alerta e com território na relação de {anoRelacao}.
            </>,
            <>
              <Nome>{rotulos[sel] ?? sel}</Nome> is not in the scatter plot: it only includes concession holders with a complete {ano}, no alert and with territory in the {anoRelacao} relation.
            </>,
          )}
        </p>
      )}
      <TabelaInterativa
        titulo={tx("Território e contexto social da área de cada distribuidora", "Territory and social context of each distribution utility's area")}
        colunas={cols}
        linhas={linhas}
        chaveLinha="id"
        colunaRotulo="rotulo"
        fonte={tx(
          `IBGE, Censo ${censo} (tabelas 4714 e 10295); ANEEL, IndQual Município e limites de continuidade (relação conjunto × município); ANEEL, cadastro de MMGD (confirmação dos vínculos)`,
          `IBGE, ${censo} Census (tables 4714 and 10295); ANEEL, IndQual Município and continuity limits (consumer cluster × municipality relation); ANEEL, MMGD register (confirmation of the links)`,
        )}
        versao={versao}
        nomeArquivo="perdas-contexto-territorial"
        chaveUrl="ctx"
        selecionado={sel}
        onSelecionar={selecionar}
        ordemInicial={{ coluna: "populacao", direcao: "desc" }}
        dicaBusca={tx("Sigla, nome ou UF", "Acronym, name or state")}
        nota={tx(
          <>
            Somas sobre os municípios inteiros com vínculo confirmado na relação de {anoRelacaoTabela ?? "ano não informado"} (a mesma do mapa; a dispersão usa a de {anoRelacao}); renda média ponderada
            pelos moradores, nunca média simples de médias.
          </>,
          <>
            Sums over the whole municipalities with a confirmed link in the {anoRelacaoTabela ?? "unreported year"} relation (the same as the map; the scatter plot uses the {anoRelacao} one); average income weighted by
            residents, never a simple average of averages.
          </>,
        )}
      />
    </div>
  );
}
