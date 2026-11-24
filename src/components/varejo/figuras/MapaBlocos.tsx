import Link from "next/link";
import { num, SEM_DADO, variacao } from "@/lib/varejo/formato";
import { corDoPasso, cortesDaEscala, PASSOS, passoDivergente, tintaDoPasso } from "./escala";

/**
 * Posição de cada unidade da federação na grade de blocos: coluna e linha (a partir de 1), aproximando a geografia do país em seis
 * colunas por oito linhas. É um esquema, não um mapa: cada estado tem o mesmo tamanho, para a cor de Roraima ler-se tão bem quanto
 * a de Minas Gerais, e a vizinhança é aproximada.
 */
export const GRADE_UF: Record<string, readonly [number, number]> = {
  RR: [2, 1], AP: [3, 1],
  AC: [1, 2], AM: [2, 2], PA: [3, 2], MA: [4, 2], CE: [5, 2], RN: [6, 2],
  RO: [2, 3], TO: [3, 3], PI: [4, 3], PE: [5, 3], PB: [6, 3],
  MT: [2, 4], GO: [3, 4], BA: [4, 4], SE: [5, 4], AL: [6, 4],
  MS: [2, 5], DF: [3, 5], MG: [4, 5], ES: [5, 5],
  SP: [3, 6], RJ: [4, 6],
  PR: [3, 7], SC: [4, 7],
  RS: [3, 8],
};

export type BlocoUf = { uf: string; nome: string; valor: number | null; href?: string };

/** Legenda da escala divergente: os sete passos com os cortes escritos e o que cada lado significa. Usada pelo mapa e pelo mosaico. */
export function LegendaDivergente({ limite, negativo = "queda", positivo = "alta", unidade = "%", semValor = true, className = "" }: Readonly<{
  limite: number;
  negativo?: string;
  positivo?: string;
  unidade?: string;
  /** Mostra o estado "sem valor publicado" na legenda. */
  semValor?: boolean;
  className?: string;
}>) {
  const cortes = cortesDaEscala(limite);
  const casas = cortes.some((c) => !Number.isInteger(c)) ? 1 : 0;
  return (
    <div className={`flex flex-wrap items-start gap-x-6 gap-y-2 ${className}`} data-legenda-divergente="">
      <div className="w-full max-w-[22rem]">
        <div className="flex justify-between text-xs text-carvao">
          <span>{negativo}</span>
          <span>{positivo}</span>
        </div>
        <div className="mt-1 grid grid-cols-7 gap-px" aria-hidden="true">
          {PASSOS.map((p) => (
            <span key={p} className="block h-3" style={{ background: corDoPasso(p) }} />
          ))}
        </div>
        {/* cortes entre os passos: os de fora saturam ("ou menos", "ou mais"); o centro é o zero */}
        <div className="mt-1 grid grid-cols-7 text-xs tabular-nums text-mineral" aria-hidden="true">
          <span className="col-span-1 text-left">≤ {num(cortes[1], casas)}</span>
          <span className="col-span-1 text-right">{num(cortes[2], casas)}</span>
          <span className="col-span-3 text-center">0</span>
          <span className="col-span-1 text-left">+{num(cortes[3], casas)}</span>
          <span className="col-span-1 text-right">≥ +{num(cortes[4], casas)}</span>
        </div>
        <p className="sr-only">
          Escala de cor em {unidade}: sete passos, de {negativo} de {num(Math.abs(cortes[1]), casas)} ou mais, em sépia escuro, a {positivo} de {num(cortes[4], casas)} ou mais, em azul escuro; o zero fica no tom neutro do centro.
        </p>
      </div>
      {semValor && (
        <p className="flex items-center gap-2 text-xs text-carvao-muted">
          <span aria-hidden="true" className="block h-3 w-5" style={{ backgroundImage: "repeating-linear-gradient(135deg, var(--cor-mineral-soft) 0 1px, transparent 1px 4px)", boxShadow: "inset 0 0 0 1px var(--cor-linha)" }} />
          sem valor publicado
        </p>
      )}
    </div>
  );
}

/**
 * Mapa de blocos das 27 unidades da federação: um quadrado por estado, na posição aproximada dele, com a sigla e o valor escritos
 * dentro e a cor pela escala divergente do Varejo (centrada no zero). Dispensa a malha geográfica, cabe no celular e não some com
 * estado pequeno. Cada bloco é um link (leva ao recorte do estado); o escolhido ganha contorno. Estado sem valor aparece hachurado,
 * com "sem dado" escrito, nunca como zero. A lista ordenada e a tabela equivalente da figura trazem os mesmos valores.
 */
export function MapaBlocos({ titulo, blocos, limite, selecionado, unidade = "%", casas = 1 }: Readonly<{
  /** Nome acessível do mapa. */
  titulo: string;
  blocos: readonly BlocoUf[];
  /** Limite simétrico da escala de cor (limiteSimetrico ou o limite do mosaico). */
  limite: number;
  selecionado?: string | null;
  unidade?: string;
  casas?: number;
}>) {
  return (
    <div data-grafico="mapa-de-blocos" data-figura-varejo="mapa-de-blocos" className="min-w-0">
      <ul aria-label={titulo} className="grid max-w-[30rem] grid-cols-6 gap-1 sm:gap-1.5">
        {blocos
          .filter((b) => GRADE_UF[b.uf])
          .map((b) => {
            const [col, lin] = GRADE_UF[b.uf];
            const passo = passoDivergente(b.valor, limite);
            const ativo = selecionado === b.uf;
            const estilo = passo
              ? { background: corDoPasso(passo), color: tintaDoPasso(passo) }
              : { backgroundImage: "repeating-linear-gradient(135deg, var(--cor-mineral-soft) 0 1px, transparent 1px 4px)", boxShadow: "inset 0 0 0 1px var(--cor-linha)", color: "var(--cor-carvao)" };
            const corpo = (
              <>
                <span className="text-sm font-medium leading-none">{b.uf}</span>
                <span className="mt-1 text-xs leading-none tabular-nums">{b.valor === null ? SEM_DADO : variacao(b.valor, casas).replace("%", unidade === "%" ? "%" : "")}</span>
                <span className="sr-only">, {b.nome}</span>
              </>
            );
            const classe = `flex aspect-square min-h-[44px] flex-col items-center justify-center ${ativo ? "outline outline-[3px] outline-offset-1 outline-carvao" : ""}`;
            return (
              <li key={b.uf} style={{ gridColumn: col, gridRow: lin }} data-bloco-uf={b.uf} data-passo={passo ?? "sem-valor"}>
                {b.href ? (
                  <Link href={b.href} prefetch={false} scroll={false} aria-current={ativo ? "true" : undefined} title={b.nome} className={`${classe} transition-transform duration-150 ease-out motion-safe:active:scale-[0.96] [@media(hover:hover)]:hover:outline [@media(hover:hover)]:hover:outline-2 [@media(hover:hover)]:hover:outline-carvao`} style={estilo}>
                    {corpo}
                  </Link>
                ) : (
                  <span className={classe} style={estilo} title={b.nome}>
                    {corpo}
                  </span>
                )}
              </li>
            );
          })}
      </ul>
      <LegendaDivergente limite={limite} unidade={unidade} className="mt-4" semValor={blocos.some((b) => b.valor === null)} />
    </div>
  );
}
