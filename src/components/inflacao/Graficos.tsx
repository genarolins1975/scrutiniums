"use client";

import { useId, useState } from "react";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { useSelecaoGas } from "@/components/gas/useSelecaoGas";
import { mesAno, mesExtenso, pct, pctSinal, pp } from "@/lib/inflacao/formato";
import { BRASIL, type AreaNaTela, type DestaquesArea, type Grupo, type TipoArea } from "@/lib/inflacao/tipos";
import { BarraDivergente, COR_AREA, COR_BRASIL, SeletorArea, dominio, useArea } from "./comum";

type AreaBasica = { id: string; nome: string; uf: string | null; tipo: TipoArea; rotulo: string };

/**
 * Série do índice geral desde o início da tabela 7060: em 12 meses (desde dezembro de 2020, o primeiro mês cuja janela cai
 * inteira na tabela) ou no mês (desde janeiro de 2020), a área escolhida contra o Brasil. Lacuna na fonte é lacuna na linha.
 */
export function SerieArea({ meses, porArea, areas, primeiroDoze }: {
  meses: string[];
  porArea: Record<string, { mensal: (number | null)[]; doze: (number | null)[] }>;
  areas: AreaBasica[];
  primeiroDoze: string;
}) {
  const escolha = useArea(areas);
  const [modo, setModo] = useState<"doze" | "mensal">("doze");
  const nomeRadio = `${useId()}-modo`;
  const a = areas.find((x) => x.id === escolha.valor) ?? areas.find((x) => x.id === BRASIL)!;
  const ehBrasil = a.id === BRASIL;
  const i0 = modo === "doze" ? Math.max(0, meses.indexOf(primeiroDoze)) : 0;
  const dados = meses.slice(i0).map((m, k) => ({
    mes: m,
    area: ehBrasil ? null : porArea[a.id][modo][i0 + k],
    brasil: porArea[BRASIL][modo][i0 + k],
  }));
  const titulo = modo === "doze" ? "IPCA, variação acumulada em 12 meses" : "IPCA, variação no mês";
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
        <SeletorArea areas={areas} valor={a.id} onChange={escolha.selecionar} rotulo="Área" />
        <fieldset className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <legend className="mb-1 text-sm text-carvao">Variação</legend>
          {(["doze", "mensal"] as const).map((m) => (
            <label key={m} className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 text-sm text-carvao">
              <input type="radio" name={nomeRadio} value={m} checked={modo === m} onChange={() => setModo(m)} className="h-4 w-4 accent-[var(--cor-bronze-dark)]" />
              {m === "doze" ? "Em 12 meses" : "No mês"}
            </label>
          ))}
        </fieldset>
      </div>
      {ehBrasil && <p className="text-sm text-carvao-muted">Escolha uma área para ver a linha dela ao lado da do Brasil.</p>}
      <GraficoLinhas
        titulo={ehBrasil ? `${titulo}: Brasil` : `${titulo}: ${a.nome} e Brasil`}
        dados={dados}
        chaveX="mes"
        formatoX="mes"
        unidade="%"
        casas={2}
        zeroNoEixo
        zoom
        chaveUrl="serie"
        series={[
          ...(ehBrasil ? [] : [{ id: "area", rotulo: a.nome, sigla: a.uf ?? undefined, cor: COR_AREA, espessura: 2.5 }]),
          { id: "brasil", rotulo: "Brasil", sigla: "BR", cor: COR_BRASIL, tracejada: !ehBrasil, espessura: ehBrasil ? 2.5 : 2 },
        ]}
      />
      <p className="max-w-prose2 text-xs leading-relaxed text-mineral">
        {modo === "doze"
          ? `Começa em ${mesExtenso(primeiroDoze)}: os 12 meses terminados antes disso incluem meses de 2019, de outra estrutura de pesos do IPCA, e não são emendados a esta série.`
          : `Começa em ${mesExtenso(meses[0])}, o primeiro mês da tabela 7060.`}
      </p>
    </div>
  );
}

/**
 * As 16 áreas no último mês, da maior para a menor variação em 12 meses, no índice geral ou num dos nove grupos, com o
 * Brasil como referência. A área escolhida no resto da página fica selecionada. A ordem não diz se a inflação de uma área é
 * alta ou baixa para quem mora nela.
 */
export function ComparacaoAreas({ areas, grupos, ultimoMes }: { areas: AreaNaTela[]; grupos: Grupo[]; ultimoMes: string }) {
  const escolha = useArea(areas);
  const categorias = [{ id: "geral", nome: "Índice geral" }, ...grupos.map((g) => ({ id: g.id, nome: g.nome }))];
  const cat = useSelecaoGas("grupo", categorias.map((c) => c.id), "geral");
  const id = useId();
  const c = categorias.find((x) => x.id === cat.valor) ?? categorias[0];
  const valor = (a: AreaNaTela) => (c.id === "geral" ? a.geral.doze : a.grupos[c.id].doze);
  const br = areas.find((a) => a.id === BRASIL)!;
  const dados = areas
    .filter((a) => a.id !== BRASIL)
    .map((a) => ({ id: a.id, nome: a.nome, doze: valor(a) }))
    .sort((x, y) => y.doze - x.doze || x.nome.localeCompare(y.nome, "pt-BR"));
  return (
    <div className="space-y-3">
      <div>
        <label htmlFor={id} className="block text-sm text-carvao">O que comparar</label>
        <select id={id} value={c.id} onChange={(e) => cat.selecionar(e.target.value)} className="mt-1 min-h-[44px] max-w-full border border-mineral bg-superficie px-3 text-sm text-carvao">
          {categorias.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
        </select>
      </div>
      <GraficoBarras
        titulo={`${c.nome}: variação em 12 meses por área, até ${mesAno(ultimoMes)}`}
        dados={dados}
        chaveCategoria="id"
        chaveRotulo="nome"
        orientacao="horizontal"
        series={[{ id: "doze", rotulo: "Variação em 12 meses", cor: COR_AREA }]}
        unidade="%"
        casas={2}
        rotulosValor
        referencias={[{ valor: valor(br), rotulo: "Brasil" }]}
        selecionado={escolha.valor === BRASIL ? null : escolha.valor}
        onSelecionar={(v) => escolha.selecionar(v ?? BRASIL)}
        rotulosSaoNomes
      />
    </div>
  );
}

/**
 * Os produtos e serviços (subitens do IPCA) que mais subiram e mais caíram em 12 meses na área escolhida, só entre os que
 * pesam pelo menos o mínimo da regra da gold no orçamento da área, com peso e contribuição ao lado. Queda é só variação
 * negativa: se poucos caíram, a lista mostra só esses.
 */
export function Destaques({ porArea, areas, grupos, ultimoMes, pesoMinimo }: {
  porArea: Record<string, DestaquesArea>;
  areas: AreaBasica[];
  grupos: Grupo[];
  ultimoMes: string;
  pesoMinimo: number;
}) {
  const escolha = useArea(areas);
  const a = areas.find((x) => x.id === escolha.valor) ?? areas.find((x) => x.id === BRASIL)!;
  const d = porArea[a.id];
  const sobem = d.sobem.filter((x) => x.doze > 0);
  const caem = d.caem.filter((x) => x.doze < 0);
  const escala = dominio([...sobem, ...caem].map((x) => x.doze));
  const nomeGrupo = Object.fromEntries(grupos.map((g) => [g.id, g.nome]));
  const onde = a.id === BRASIL ? "no Brasil" : `em ${a.nome}`;
  const lista = (titulo: string, itens: typeof sobem, vazio: string) => (
    <div className="min-w-0">
      <h3 className="font-serif text-xl text-carvao">{titulo}</h3>
      {itens.length === 0 ? (
        <p className="mt-2 text-sm text-carvao-muted">{vazio}</p>
      ) : (
        <ol className="mt-3 divide-y divide-linha border-y border-linha">
          {itens.map((x) => (
            <li key={x.nome} className="py-2.5">
              <div className="flex items-baseline justify-between gap-3">
                <p className="min-w-0 text-[0.95rem] leading-snug text-carvao">{x.nome}</p>
                <p className="shrink-0 text-sm font-medium text-carvao [font-variant-numeric:tabular-nums]">{pctSinal(x.doze)}</p>
              </div>
              <BarraDivergente valor={x.doze} min={escala.min} max={escala.max} altura={6} />
              <p className="text-xs leading-relaxed text-mineral [font-variant-numeric:tabular-nums]">
                {nomeGrupo[x.grupo]} · peso {pct(x.peso)} do orçamento · contribuição {pp(x.contribuicao, 2, true)}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
  return (
    <div className="space-y-4">
      <SeletorArea areas={areas} valor={a.id} onChange={escolha.selecionar} rotulo="Área" />
      <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted" role="status" aria-live="polite">
        {d.elegiveis} dos {d.naCesta} produtos e serviços pesquisados {onde} pesam pelo menos {pct(pesoMinimo)} do orçamento e entram nas listas; juntos,
        somam {pct(d.pesoElegiveis, 1)} do orçamento. Variação em 12 meses até {mesAno(ultimoMes)}.
      </p>
      <div className="grid gap-x-10 gap-y-8 md:grid-cols-2">
        {lista(`Os que mais subiram ${onde}`, sobem, "Nenhum produto ou serviço com o peso mínimo subiu no período.")}
        {lista(`Os que mais caíram ${onde}`, caem, "Nenhum produto ou serviço com o peso mínimo ficou mais barato no período.")}
      </div>
    </div>
  );
}
