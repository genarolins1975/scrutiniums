"use client";

import { useId, useState, type MouseEvent } from "react";
import type { ContaDoCupom, PerfilCem } from "@/lib/varejo/dados";
import { EXPLICA, NOME_CURTO } from "./cupom-comum";
import { COR_DA_PARTE } from "./escala";

export type PerfilDoCupom = PerfilCem & { conta: ContaDoCupom };

const reais = (v: number) => `R$ ${Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const DEVOLVEU: Partial<Record<PerfilCem["partes"][number]["id"], string>> = {
  impostos: "Crédito de imposto sobre o lucro",
  financeiro: "Resultado financeiro positivo",
  outros: "Operações encerradas e outros",
};

/** Zigue-zague do picote, na cor do fundo da seção, sobre a borda de baixo do papel. */
const PICOTE = {
  backgroundImage: "linear-gradient(-45deg, var(--cor-marfim) 5px, transparent 0), linear-gradient(45deg, var(--cor-marfim) 5px, transparent 0)",
  backgroundSize: "10px 10px",
  backgroundRepeat: "repeat-x",
  backgroundPosition: "left bottom",
} as const;

/**
 * A barra de R$ 1 em R$ 1 de uma loja: cada parte na largura exata do seu valor, riscada a cada R$ 1 e com a marca dos R$ 100.
 * Todas as lojas usam a mesma escala (`escala`), para as barras se compararem de relance. O que passa dos R$ 100 mais o que voltou
 * (crédito de imposto) é prejuízo e sai hachurado; o lucro é o último trecho, no azul da coleção.
 */
export function BarraDoCupom({ p, escala, alta = false }: Readonly<{ p: PerfilDoCupom; escala: number; alta?: boolean }>) {
  const c = p.conta;
  const entrou = c.entradas.reduce((s, x) => s + x.valor, 0);
  const partes = [...c.saidas.map((x) => ({ id: x.id, valor: x.valor })), ...(c.resultado > 0 ? [{ id: "lucro" as const, valor: c.resultado }] : [])];
  const descricao = `${p.perfil}, ${p.empresa}, ${p.exercicio}: ${partes.map((x) => `${NOME_CURTO[x.id].toLowerCase()} ${reais(x.valor)}`).join("; ")}${c.resultado < 0 ? `; prejuízo de ${reais(c.resultado)}` : ""}`;
  return (
    <span role="img" aria-label={descricao} className={`relative block w-full ${alta ? "h-10" : "h-5"}`} data-barra-cupom={p.slug}>
      <span className="absolute inset-0 flex">
        {partes.map((x) => (
          <span key={x.id} className="block h-full" style={{ width: `${(100 * x.valor) / escala}%`, background: COR_DA_PARTE[x.id] }} />
        ))}
      </span>
      {/* riscos sobre a parte preenchida, para a barra ler-se como régua: de R$ 1 em R$ 1 no cupom, de R$ 10 em R$ 10 na lista */}
      <span aria-hidden="true" className="absolute inset-y-0 left-0" style={{ width: `${(100 * c.total) / escala}%`, backgroundImage: "linear-gradient(90deg, var(--cor-papel) 1px, transparent 1px)", backgroundSize: `${(alta ? 100 : 1000) / c.total}% 100%`, opacity: alta ? 0.5 : 0.85 }} />
      {c.resultado < 0 && (
        <span aria-hidden="true" className="absolute inset-y-0" style={{ left: `${(100 * entrou) / escala}%`, width: `${(100 * (c.total - entrou)) / escala}%`, backgroundImage: "repeating-linear-gradient(135deg, var(--cor-papel) 0 2px, transparent 2px 5px)" }} />
      )}
      <span aria-hidden="true" className="absolute -inset-y-1 w-px bg-carvao" style={{ left: `${(100 * 100) / escala}%` }} />
    </span>
  );
}

/**
 * "O cupom de R$ 100": um cupom de loja desenhado, que mostra R$ 100 de venda líquida virando mercadoria, operação, juros, imposto e
 * o que sobra, com os números que a companhia entregou à CVM. O leitor troca a loja entre tipos de negócio reais; o cupom se
 * reimprime (opacidade e deslocamento curtos, só em ação de ponteiro e sem movimento para quem o reduz) e a barra de R$ 1 em R$ 1
 * acompanha. As barras de todas as lojas ficam à vista na mesma escala: a comparação entre negócios é a figura.
 *
 * A primeira loja sai pronta do servidor, então o cupom se lê sem JavaScript. A conta fecha: saídas mais lucro é igual às entradas;
 * com prejuízo, as saídas passam das entradas no valor dele, e o cupom diz "faltam" em vez de "sobram". Os valores chegam prontos de
 * `contaDoCupom` (src/lib/varejo/dados.ts); nada é calculado aqui.
 */
export function Cupom({ perfis, titulo, descricao }: Readonly<{
  perfis: readonly PerfilDoCupom[];
  /** Título e frase da lista de barras, quando as "lojas" não são os perfis do modelo da entrada (a ficha de um grupo e os pares dele). */
  titulo?: string;
  descricao?: string;
}>) {
  const id = useId();
  const [atual, setAtual] = useState(perfis[0]?.slug ?? "");
  const [imprime, setImprime] = useState(false);
  const p = perfis.find((x) => x.slug === atual) ?? perfis[0];
  if (!p) return <p className="text-sm text-carvao-muted" data-ponte-cem="">As demonstrações das companhias não puderam ser lidas nesta publicação.</p>;
  const escala = Math.max(100, ...perfis.map((x) => x.conta.total));
  const c = p.conta;
  const escolher = (slug: string) => (ev: MouseEvent<HTMLButtonElement>) => {
    // ação de teclado (detail 0) troca sem movimento; ponteiro reimprime
    setImprime(ev.detail > 0);
    setAtual(slug);
  };
  const pontilhado = <span aria-hidden="true" className="mx-2 min-w-[1rem] flex-1 -translate-y-1 border-b border-dotted border-mineral-soft" />;
  return (
    <div data-ponte-cem="" data-cupom="" className="grid gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,23rem)_minmax(0,1fr)]">
      {/* as lojas: no celular vêm antes do cupom, porque é nelas que se escolhe */}
      <div className="lg:order-2">
        <h3 className="t-h3 text-carvao">{titulo ?? `${perfis.length} lojas na mesma régua`}</h3>
        <p className="t-meta mt-1 max-w-prose2 text-carvao-muted">{descricao ?? "Cada barra são os R$ 100 de uma loja, riscados de R$ 10 em R$ 10; o traço escuro marca os R$ 100. Escolha uma para imprimir o cupom."}</p>
        <ul className="mt-4 border-t border-linha" aria-label="Lojas do modelo">
          {perfis.map((x) => {
            const ativo = x.slug === p.slug;
            return (
              <li key={x.slug} className="border-b border-linha">
                <button
                  type="button"
                  aria-pressed={ativo}
                  aria-controls={`${id}-cupom`}
                  onClick={escolher(x.slug)}
                  className={`relative block w-full py-3 pl-4 pr-1 text-left transition-colors duration-150 ease-out motion-safe:active:scale-[0.99] ${ativo ? "bg-papel" : "[@media(hover:hover)]:hover:bg-papel"}`}
                >
                  <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-[3px] ${ativo ? "bg-gas" : "bg-transparent"}`} />
                  <span className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                    <span className="font-serif text-lg leading-snug text-carvao">
                      {x.perfil} <span className="font-sans text-sm text-carvao-muted">{x.empresa}, {x.exercicio}</span>
                    </span>
                    <span className="text-sm tabular-nums text-carvao">{x.conta.resultado >= 0 ? `sobram ${reais(x.conta.resultado)}` : `faltam ${reais(x.conta.resultado)}`}</span>
                  </span>
                  <span className="mt-2 block pr-3">
                    <BarraDoCupom p={x} escala={escala} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <ul className="t-meta mt-4 flex flex-wrap gap-x-5 gap-y-1 text-carvao-muted" aria-label="Legenda das partes">
          {(["custo", "despesas", "financeiro", "impostos", "outros", "lucro"] as const)
            .filter((k) => k !== "outros" || perfis.some((x) => x.conta.saidas.some((s) => s.id === "outros")))
            .map((k) => (
              <li key={k} className="flex items-center gap-2">
                <span aria-hidden="true" className="h-3 w-3 shrink-0" style={{ background: COR_DA_PARTE[k] }} />
                {NOME_CURTO[k]}
              </li>
            ))}
          {perfis.some((x) => x.conta.resultado < 0) && (
            <li className="flex items-center gap-2">
              <span aria-hidden="true" className="h-3 w-3 shrink-0 bg-mineral" style={{ backgroundImage: "repeating-linear-gradient(135deg, var(--cor-papel) 0 2px, transparent 2px 5px)" }} />
              Passou dos R$ 100: prejuízo
            </li>
          )}
        </ul>
      </div>

      {/* o cupom da loja escolhida */}
      <div id={`${id}-cupom`} aria-live="polite" className="lg:order-1">
        <div className="relative mx-auto max-w-[23rem] border-x border-t border-linha bg-superficie px-5 pb-9 pt-6 sm:px-6" style={PICOTE} data-cupom-papel={p.slug}>
          <p className="rotulo text-center text-mineral">Cupom didático · não é documento fiscal</p>
          <div key={p.slug} className={imprime ? "cupom-imprime" : undefined}>
            <p className="mt-3 text-center font-serif text-xl leading-snug text-carvao">{p.empresa}</p>
            <p className="t-meta mt-0.5 text-center text-carvao-muted">
              {p.perfil} · exercício de {p.exercicio}
            </p>

            <dl className="mt-4 border-t border-dashed border-mineral-soft pt-3 text-sm text-carvao">
              {c.entradas.map((x) => (
                <div key={x.id} className="flex items-baseline py-1">
                  <dt className={x.id === "venda" ? "font-medium" : ""}>{x.id === "venda" ? "Venda líquida" : `Entrou: ${(DEVOLVEU[x.id] ?? x.rotulo).toLowerCase()}`}</dt>
                  {pontilhado}
                  <dd className={`shrink-0 tabular-nums ${x.id === "venda" ? "font-medium" : ""}`}>{x.id === "venda" ? "" : "+ "}{reais(x.valor)}</dd>
                </div>
              ))}
            </dl>

            <dl className="mt-2 border-t border-dashed border-mineral-soft pt-2 text-sm text-carvao">
              {c.saidas.map((x) => (
                <div key={x.id} className="flex flex-wrap items-baseline py-1.5">
                  <dt className="flex items-baseline gap-2">
                    <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0" style={{ background: COR_DA_PARTE[x.id] }} />
                    {NOME_CURTO[x.id]}
                  </dt>
                  {pontilhado}
                  <dd className="shrink-0 tabular-nums">− {reais(x.valor)}</dd>
                  <dd className="basis-full pl-[1.125rem] text-xs leading-snug text-carvao-muted">{EXPLICA[x.id]}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-2 flex items-end justify-between gap-4 border-t border-dashed border-mineral-soft pt-3">
              <p className="text-sm font-medium text-carvao">
                <span className="flex items-baseline gap-2">
                  {c.resultado >= 0 && <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0" style={{ background: COR_DA_PARTE.lucro }} />}
                  {c.resultado >= 0 ? "Sobra: lucro" : "Falta: prejuízo"}
                </span>
                <span className="block pl-[1.125rem] text-xs font-normal leading-snug text-carvao-muted">{c.resultado >= 0 ? EXPLICA.lucro : "As saídas passaram do que entrou: a companhia fechou o ano com prejuízo deste valor."}</span>
              </p>
              <p className="numero-m shrink-0 tabular-nums text-carvao" data-resultado-cupom="">
                {c.resultado < 0 ? "− " : ""}
                {reais(c.resultado)}
              </p>
            </div>

            <div className="mt-5">
              <BarraDoCupom p={p} escala={Math.max(100, c.total)} alta />
              <p className="mt-2 text-center text-xs text-mineral">Cada risco, R$ 1. O traço marca os R$ 100.</p>
            </div>
          </div>
        </div>
        <p className="t-meta mx-auto mt-3 max-w-[23rem] text-mineral">
          Fonte: CVM, Demonstrações Financeiras Padronizadas de {p.exercicio}, {p.empresa}. Cada linha é a rubrica da demonstração de resultado dividida pela receita líquida, vezes 100: cálculo da Scrutiniums.{" "}
          {p.documento && (
            <a href={p.documento} rel="noopener noreferrer" target="_blank" className="underline decoration-linha underline-offset-4 hover:decoration-carvao">
              Documento entregue à CVM
            </a>
          )}
        </p>
      </div>
    </div>
  );
}
