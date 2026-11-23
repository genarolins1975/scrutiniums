"use client";

import { useId, useState } from "react";
import type { PerfilCem } from "@/lib/varejo/dados";

/** Cor de cada parte: neutros para os custos, o acento da coleção só no que sobra (o lucro). */
const COR: Record<PerfilCem["partes"][number]["id"], string> = {
  custo: "var(--serie-4)",
  despesas: "var(--serie-2)",
  financeiro: "var(--serie-3)",
  impostos: "var(--serie-5)",
  outros: "var(--serie-6)",
  lucro: "var(--cor-gas)",
};

const reais = (v: number) => `R$ ${Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** O que cada parte é, em palavras de quem nunca leu um balanço. */
const EXPLICA: Record<PerfilCem["partes"][number]["id"], string> = {
  custo: "O que a loja pagou ao fornecedor pelas mercadorias que vendeu.",
  despesas: "Salários, aluguel, energia, entrega, propaganda e a administração.",
  financeiro: "Juros da dívida e dos aluguéis de longo prazo, menos o que o caixa rendeu.",
  impostos: "Imposto de renda e contribuição social sobre o lucro do ano.",
  outros: "Negócios que a companhia encerrou ou vendeu, e arredondamentos.",
  lucro: "O que sobra para os donos depois de tudo.",
};

/**
 * "Do preço da prateleira ao lucro": como R$ 100 de venda líquida se dividem em custo da mercadoria, despesas de operação,
 * juros, imposto sobre o lucro e lucro, em três companhias abertas que ilustram três tipos de negócio. As três faixas usam a
 * mesma escala, para a diferença entre os negócios aparecer de relance; escolher uma abre a conta dela, parte por parte.
 *
 * Os valores chegam prontos do servidor (ponte_100 da gold das companhias, CVM). Quando uma parte devolve dinheiro em vez de
 * consumir (crédito de imposto, resultado financeiro positivo), ela entra como origem ao lado dos R$ 100 e a faixa fecha a
 * conta: o que entra é igual ao que sai. Prejuízo aparece em texto, nunca como faixa negativa.
 */
export function PonteCemReais({ perfis }: Readonly<{ perfis: readonly PerfilCem[] }>) {
  const id = useId();
  const [atual, setAtual] = useState(perfis[0]?.slug ?? "");
  const escolhido = perfis.find((p) => p.slug === atual) ?? perfis[0];
  if (!escolhido) return <p className="text-sm text-carvao-muted">As demonstrações das companhias não puderam ser lidas nesta publicação.</p>;
  // escala comum: a maior soma de usos entre os perfis (R$ 100 mais o que cada um recebeu de volta)
  const usos = (p: PerfilCem) => p.partes.filter((x) => x.valor > 0);
  const totalDe = (p: PerfilCem) => usos(p).reduce((s, x) => s + x.valor, 0);
  const escala = Math.max(100, ...perfis.map(totalDe));
  return (
    <div data-ponte-cem="">
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-carvao-muted" aria-label="Legenda das partes">
        {escolhido.partes
          .filter((x) => x.id !== "outros" || perfis.some((p) => p.partes.some((y) => y.id === "outros" && Math.abs(y.valor) >= 0.05)))
          .map((x) => (
            <li key={x.id} className="flex items-center gap-2">
              <span aria-hidden="true" className="h-3 w-3 shrink-0" style={{ background: COR[x.id] }} />
              {x.rotulo}
            </li>
          ))}
      </ul>

      <div className="mt-5 space-y-4">
        {perfis.map((p) => {
          const ativo = p.slug === escolhido.slug;
          const lucro = p.partes.find((x) => x.id === "lucro")?.valor ?? 0;
          return (
            <button
              key={p.slug}
              type="button"
              aria-pressed={ativo}
              aria-controls={`${id}-detalhe`}
              onClick={() => setAtual(p.slug)}
              className={`block w-full border-l-[3px] py-2 pl-4 text-left transition-[border-color,opacity] duration-150 ease-out motion-safe:active:scale-[0.995] ${
                ativo ? "border-gas" : "border-transparent opacity-80 [@media(hover:hover)]:hover:opacity-100"
              }`}
            >
              <span className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                <span className="font-serif text-lg leading-snug text-carvao">
                  {p.perfil} <span className="font-sans text-sm text-carvao-muted">{p.empresa}, {p.exercicio}</span>
                </span>
                <span className="text-sm tabular-nums text-carvao">{lucro >= 0 ? `sobram ${reais(lucro)}` : `faltam ${reais(lucro)}`}</span>
              </span>
              <span className="mt-2 flex h-9 w-full bg-linha" role="img" aria-label={`${p.perfil}, ${p.empresa}, ${p.exercicio}: ${usos(p).map((x) => `${x.rotulo.toLowerCase()} ${reais(x.valor)}`).join("; ")}`}>
                {usos(p).map((x) => (
                  <span key={x.id} className="block h-full border-r border-papel last:border-r-0" style={{ width: `${(100 * x.valor) / escala}%`, background: COR[x.id] }} />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      <div id={`${id}-detalhe`} aria-live="polite" className="mt-8 border-t border-linha pt-5">
        <h3 className="font-serif text-xl leading-snug text-carvao">
          De cada R$ 100 vendidos por {escolhido.empresa} em {escolhido.exercicio}
        </h3>
        <dl className="mt-4 grid gap-x-10 gap-y-3 sm:grid-cols-2">
          {escolhido.partes
            .filter((x) => x.id !== "outros" || Math.abs(x.valor) >= 0.05)
            .map((x) => {
              const devolve = x.id !== "lucro" && x.valor < 0;
              const prejuizo = x.id === "lucro" && x.valor < 0;
              return (
                <div key={x.id} className="border-t border-linha pt-3">
                    <dt className="flex items-baseline justify-between gap-4 text-sm text-carvao">
                      <span className="flex items-baseline gap-3">
                        <span aria-hidden="true" className="h-3 w-3 shrink-0 translate-y-0.5" style={{ background: COR[x.id] }} />
                        {prejuizo ? "Prejuízo" : x.id === "lucro" ? "Lucro" : x.rotulo}
                      </span>
                      <span className="shrink-0 font-serif text-lg tabular-nums">
                        {devolve ? "+ " : ""}
                        {reais(x.valor)}
                      </span>
                    </dt>
                    <dd className="mt-1 pl-6 text-sm leading-relaxed text-carvao-muted">
                      {devolve
                        ? x.id === "impostos"
                          ? "Neste ano o imposto sobre o lucro foi um crédito: em vez de sair, este valor entrou, somado aos R$ 100."
                          : "Neste ano esta linha foi positiva: em vez de sair, este valor entrou, somado aos R$ 100."
                        : prejuizo
                          ? "As saídas passaram dos R$ 100: a companhia fechou o ano com prejuízo deste valor."
                          : EXPLICA[x.id]}
                    </dd>
                </div>
              );
            })}
        </dl>
        <p className="mt-5 max-w-prose2 text-xs leading-relaxed text-mineral">
          Fonte: CVM, Demonstrações Financeiras Padronizadas de {escolhido.exercicio}, {escolhido.empresa}. Cada parte é a rubrica da demonstração de resultado dividida pela receita líquida e multiplicada por 100: cálculo da
          Scrutiniums.{" "}
          {escolhido.documento && (
            <a href={escolhido.documento} rel="noopener noreferrer" target="_blank" className="underline decoration-linha underline-offset-4 hover:decoration-carvao">
              Documento entregue à CVM
            </a>
          )}
        </p>
      </div>
    </div>
  );
}
