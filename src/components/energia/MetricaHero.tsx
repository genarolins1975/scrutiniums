import Link from "next/link";
import type { ReactNode } from "react";
import type { Natureza } from "@/lib/energia/tipos";
import { SeloNatureza } from "@/components/evidencia/SeloNatureza";
import { IconeSetor, type TipoIcone } from "@/components/energia/IconeSetor";
import { Sparkline } from "@/components/energia/Sparkline";

/**
 * O número que responde à pergunta da página: grande, com unidade, natureza,
 * a forma recente da série e uma linha de contexto histórico (nunca só o
 * número). Um por bloco; o resto da página aprofunda.
 */
export function MetricaHero({
  icone,
  rotulo,
  valor,
  unidade,
  natureza,
  contexto,
  variacao,
  sparkline,
  referencia,
  faixa,
  cor = "var(--cor-energia)",
  href,
  hrefRotulo,
  tamanho = "grande",
  children,
}: {
  icone?: TipoIcone;
  rotulo: string;
  valor: string;
  unidade?: string;
  natureza: Natureza;
  /** Posição histórica ou comparação: "percentil 53 desde 2021", "12,3 p.p. acima da mediana da data". */
  contexto?: ReactNode;
  /** Variação curta: "+33,45 (+46,6%) sobre o dia anterior". */
  variacao?: ReactNode;
  sparkline?: (number | null | undefined)[];
  referencia?: number | null;
  faixa?: { inferior: (number | null | undefined)[]; superior: (number | null | undefined)[] };
  cor?: string;
  href?: string;
  hrefRotulo?: string;
  tamanho?: "grande" | "medio" | "compacto";
  children?: ReactNode;
}) {
  const classeValor =
    tamanho === "grande"
      ? "text-[clamp(2.4rem,5vw,3.6rem)]"
      : tamanho === "medio"
        ? "text-[clamp(1.8rem,3.4vw,2.4rem)]"
        : "text-[1.5rem]";
  return (
    <div className="flex h-full flex-col">
      <p className="rotulo flex items-center gap-2 text-mineral">
        {icone && <IconeSetor tipo={icone} tamanho={15} className="text-carvao-muted" />}
        {rotulo}
      </p>
      <p className={`surge mt-2 font-serif leading-none tabular-nums text-carvao ${classeValor}`}>
        {valor}
        {unidade && <span className="ml-1.5 font-sans text-[0.4em] text-mineral">{unidade}</span>}
      </p>
      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-mineral">
        <SeloNatureza natureza={natureza} />
        {variacao && <span className="tabular-nums text-carvao-muted">{variacao}</span>}
      </p>
      {sparkline && sparkline.length > 1 && (
        <div className="mt-3">
          <Sparkline valores={sparkline} cor={cor} referencia={referencia} faixa={faixa} largura={160} altura={34} />
        </div>
      )}
      {contexto && <p className="mt-2 text-sm leading-snug text-carvao-muted">{contexto}</p>}
      {children}
      {href && (
        <Link href={href} className="rotulo mt-auto inline-flex min-h-[44px] items-center gap-1 self-start pt-2 text-energia-dark underline decoration-energia/40 underline-offset-4 hover:text-carvao">
          {hrefRotulo ?? "Ver mais"} <span aria-hidden="true">→</span>
        </Link>
      )}
    </div>
  );
}
