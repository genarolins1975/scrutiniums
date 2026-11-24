import type { ReactNode } from "react";
import { LogoEmpresa } from "@/components/varejo/LogoEmpresa";
import type { LinhaDoCupom } from "@/lib/varejo/comparador";
import { por100 } from "@/lib/varejo/formato";
import { COR_DA_PARTE, HACHURA } from "./escala";
import { BarraDoCupom, type PerfilDoCupom } from "./Cupom";
import { NOME_CURTO } from "./cupom-comum";

/** Zigue-zague do picote na cor do fundo da página (papel), sobre a borda de baixo do cupom. */
const PICOTE = {
  backgroundImage: "linear-gradient(-45deg, var(--cor-papel) 5px, transparent 0), linear-gradient(45deg, var(--cor-papel) 5px, transparent 0)",
  backgroundSize: "10px 10px",
  backgroundRepeat: "repeat-x",
  backgroundPosition: "left bottom",
} as const;

export type CupomDaEmpresa = {
  slug: string;
  nome: string;
  /** "Exercício de 2025, demonstração consolidada". */
  legenda: string;
  /** Perfil com a conta do cupom; null quando a companhia não tem demonstração do exercício. */
  perfil: PerfilDoCupom | null;
  /** O corpo do cupom: as linhas da conta, a reconciliação e o link do documento (ou o estado de ausência), montados pela página. */
  corpo: ReactNode;
};

/**
 * Cupons lado a lado: um cupom por companhia (de duas a quatro), com o logo no cabeçalho, as linhas da conta de R$ 100 e, no pé,
 * a barra riscada de R$ 1 em R$ 1, todas na mesma régua, para o olho comparar os cupons de relance. Companhia sem demonstração do
 * exercício mantém o lugar e diz o que falta. A grade vai a quatro colunas só quando cabem; no celular os cupons se empilham.
 */
export function CuponsLadoALado({ cupons }: Readonly<{ cupons: readonly CupomDaEmpresa[] }>) {
  const escala = Math.max(100, ...cupons.map((c) => c.perfil?.conta.total ?? 0));
  // o cupom é estreito como um cupom: no máximo 26 rem por coluna, e o conjunto fica centrado na largura da figura
  const colunas = cupons.length >= 4 ? "md:grid-cols-[repeat(2,minmax(0,26rem))] xl:grid-cols-4" : cupons.length === 3 ? "md:grid-cols-3" : "md:grid-cols-[repeat(2,minmax(0,26rem))]";
  return (
    <div className={`grid items-start justify-center gap-x-8 gap-y-8 ${colunas}`} data-pontes="" data-cupons-lado-a-lado={cupons.length}>
      {cupons.map((c) => (
        <article key={c.slug} className="relative min-w-0 border-x border-t border-linha bg-superficie px-4 pb-8 pt-5 sm:px-5" style={PICOTE} data-ponte-empresa={c.slug}>
          <header className="text-center">
            <LogoEmpresa slug={c.slug} nome={c.nome} tamanho="m" decorativo semLogo="placa" />
            <h3 className="mt-2 font-serif text-xl leading-snug text-carvao">{c.nome}</h3>
            <p className="t-meta text-carvao-muted">{c.legenda}</p>
          </header>
          <div className="mt-3 border-t border-dashed border-mineral-soft pt-2">{c.corpo}</div>
          {c.perfil && (
            <div className="mt-4">
              <BarraDoCupom p={c.perfil} escala={escala} alta />
              <p className="mt-1.5 text-center text-xs text-mineral">Mesma régua nos {cupons.length} cupons. O traço marca os R$ 100.</p>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}

/**
 * Os cupons linha a linha: para cada parcela, uma barra por companhia a partir do zero, na mesma escala, com o valor escrito, e a
 * distância entre a que mais e a que menos gasta com aquilo anotada ao lado. É a comparação que o texto não fazia: de onde vem a
 * diferença no lucro. O lucro fecha a lista; prejuízo desce do zero, hachurado. Nada aqui ordena as companhias: a ordem é a da seleção.
 */
export function LinhaALinha({ linhas, nomes, slugs }: Readonly<{ linhas: readonly LinhaDoCupom[]; nomes: readonly string[]; slugs: readonly string[] }>) {
  const todos = linhas.flatMap((l) => l.valores).filter((v): v is number => v !== null);
  if (todos.length === 0) return null;
  const min = Math.min(0, ...todos);
  const max = Math.max(0, ...todos);
  const amplitude = max - min || 1;
  const zero = (100 * (0 - min)) / amplitude;
  const QUEM_GASTA: Record<LinhaDoCupom["id"], string> = { custo: "com mercadoria", despesas: "com a operação", financeiro: "com juros", impostos: "com imposto sobre o lucro", outros: "com operações encerradas e outros", lucro: "" };
  return (
    <div data-figura-varejo="linha-a-linha" data-linha-a-linha={linhas.length} className="min-w-0">
      <ol className="border-t border-carvao" aria-label={`Parcelas de R$ 100 de receita líquida, companhia a companhia: ${nomes.join(", ")}`}>
        {linhas.map((l) => {
          const lucro = l.id === "lucro";
          const anotacao =
            l.maior === null || l.menor === null || l.amplitude === null
              ? l.amplitude === 0 ? "sem diferença entre as companhias" : "sem duas companhias com o dado"
              : lucro
                ? `${nomes[l.maior]} fica com ${por100(l.amplitude)} a mais que ${nomes[l.menor]}`
                : `${nomes[l.maior]} gasta ${por100(l.amplitude)} a mais ${QUEM_GASTA[l.id]} que ${nomes[l.menor]}`;
          return (
            <li key={l.id} data-linha-do-cupom={l.id} className={`grid gap-x-6 gap-y-2 py-3 lg:grid-cols-[11rem_minmax(0,1fr)_15rem] ${lucro ? "border-t border-carvao" : "border-b border-linha"}`}>
              <p className="flex items-baseline gap-2 text-sm font-medium leading-snug text-carvao">
                <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0" style={{ background: COR_DA_PARTE[l.id] }} />
                {lucro ? "Lucro ou prejuízo" : NOME_CURTO[l.id]}
              </p>
              <ul className="min-w-0 space-y-1.5">
                {l.valores.map((v, i) => {
                  const largura = v === null ? 0 : (100 * Math.abs(v)) / amplitude;
                  const neg = v !== null && v < 0;
                  return (
                    <li key={slugs[i]} className="grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)_5.25rem] items-center gap-x-3 text-xs leading-tight text-carvao sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_5.25rem]">
                      <span className={`truncate ${l.maior === i && !lucro ? "font-medium" : ""}`}>{nomes[i]}</span>
                      <span aria-hidden="true" className="relative block h-3">
                        {min < 0 && <span className="absolute inset-y-[-2px] w-px bg-mineral" style={{ left: `${zero}%` }} />}
                        {v !== null && <span className="absolute inset-y-0 min-w-[2px]" style={{ left: `${neg ? zero - largura : zero}%`, width: `${largura}%`, background: COR_DA_PARTE[l.id], ...(neg ? { backgroundImage: HACHURA } : {}) }} />}
                      </span>
                      <span className="text-right text-sm tabular-nums">{v === null ? <span className="text-xs italic text-mineral">sem dado</span> : por100(v)}</span>
                    </li>
                  );
                })}
              </ul>
              <p className="text-sm leading-snug text-carvao lg:border-l lg:border-linha lg:pl-4" data-diferenca-da-linha={l.amplitude === null ? "sem-dado" : l.amplitude.toFixed(2)}>
                {anotacao}
              </p>
            </li>
          );
        })}
      </ol>
      <p className="t-meta mt-2 max-w-prose2 text-carvao-muted">
        R$ por R$ 100 de receita líquida; barras a partir do zero, na mesma escala em todas as linhas. Valor negativo numa parcela quer dizer que ela devolveu dinheiro no exercício (crédito de imposto, resultado financeiro positivo); no lucro, é prejuízo. Gastar mais numa linha não é operar pior: as companhias vendem coisas diferentes.
      </p>
    </div>
  );
}
