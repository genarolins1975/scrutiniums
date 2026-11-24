import Link from "next/link";
import { LogoEmpresa } from "@/components/varejo/LogoEmpresa";
import { num, ordinal, plural } from "@/lib/varejo/formato";
import type { Movimento } from "@/lib/varejo/grupos";
import { COR_DESCEU, COR_PARADO, COR_SUBIU } from "./escala";

const corDe = (ganho: number | null) => (ganho === null || ganho === 0 ? COR_PARADO : ganho > 0 ? COR_SUBIU : COR_DESCEU);

/** "subiu 6 posições", "desceu 8 posições", "manteve a posição", "sem posição no ano anterior". */
export function textoDoMovimento(m: Pick<Movimento, "ganho">): string {
  if (m.ganho === null) return "sem posição publicada no ano anterior";
  if (m.ganho === 0) return "manteve a posição";
  return `${m.ganho > 0 ? "subiu" : "desceu"} ${num(Math.abs(m.ganho))} ${plural(Math.abs(m.ganho), "posição", "posições")}`;
}

/** O deslocamento em poucos caracteres, com sinal tipográfico: "+6", "−8", "=". Subir de posição é número menor: o sinal é o do ganho. */
const curto = (ganho: number | null) => (ganho === null ? "novo" : ganho === 0 ? "=" : `${ganho > 0 ? "+" : "−"}${num(Math.abs(ganho))}`);

/**
 * "Quem subiu e quem desceu": gráfico de inclinação entre a posição do ano anterior (à esquerda) e a do exercício do ranking (à
 * direita). Uma linha por grupo; a inclinação é a troca de lugar. Quem mais se moveu (`destaque`, o limiar em posições) ganha traço
 * grosso e cor (azul para quem subiu, sépia para quem desceu, a mesma convenção da escala de variação da coleção); os demais ficam em
 * neutro. Posição menor é venda maior: não é nota. Grupo sem posição anterior publicada não tem linha e diz isso na ponta direita.
 *
 * As linhas são SVG esticado; nomes, posições e logos são HTML nas duas colunas. No celular não há espaço para duas colunas de nomes:
 * a figura vira lista na ordem do ranking, com a posição anterior escrita e uma barra que sai do centro para o lado do movimento.
 */
export function Inclinacao({ movimentos, destaque, anoAnterior, ano, href, titulo }: Readonly<{
  movimentos: readonly Movimento[];
  /** A partir de quantas posições de deslocamento a linha é destacada. */
  destaque: number;
  anoAnterior: string;
  ano: string;
  href: (slug: string) => string | null;
  titulo: string;
}>) {
  const n = Math.max(1, ...movimentos.map((m) => Math.max(m.atual, m.anterior ?? 0)));
  const PASSO = 34;
  const altura = n * PASSO;
  const y = (pos: number) => (pos - 0.5) * PASSO;
  const forte = (m: Movimento) => m.ganho !== null && destaque > 0 && Math.abs(m.ganho) >= destaque;
  const porAnterior = [...movimentos].filter((m) => m.anterior !== null).sort((a, b) => (a.anterior as number) - (b.anterior as number));
  const maior = Math.max(1, ...movimentos.map((m) => Math.abs(m.ganho ?? 0)));
  const nome = (m: Movimento) => {
    const destino = m.tem_ficha ? href(m.slug) : null;
    return destino ? (
      <Link href={destino} prefetch={false} className="underline decoration-linha underline-offset-4 [@media(hover:hover)]:hover:decoration-carvao">
        {m.grupo}
      </Link>
    ) : (
      m.grupo
    );
  };
  return (
    <div data-grafico="inclinacao" data-figura-varejo="inclinacao" className="min-w-0">
      <ul className="t-meta flex flex-wrap gap-x-6 gap-y-1 text-carvao-muted" aria-label="Como ler">
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="h-[3px] w-6 shrink-0" style={{ background: COR_SUBIU }} />
          subiu {num(destaque)} posições ou mais
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="h-[3px] w-6 shrink-0" style={{ background: COR_DESCEU }} />
          desceu {num(destaque)} ou mais
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="h-px w-6 shrink-0" style={{ background: COR_PARADO }} />
          demais grupos
        </li>
      </ul>

      {/* duas colunas e as linhas entre elas: a partir de 768 px */}
      <div className="mt-4 hidden md:grid md:grid-cols-[minmax(0,15rem)_minmax(6rem,1fr)_minmax(0,19rem)] lg:grid-cols-[minmax(0,19rem)_minmax(8rem,1fr)_minmax(0,24rem)]" role="group" aria-label={titulo}>
        <p className="rotulo border-b border-carvao pb-1 text-right text-mineral">Posição em {anoAnterior}</p>
        <p className="border-b border-carvao" aria-hidden="true" />
        <p className="rotulo border-b border-carvao pb-1 text-mineral">Posição em {ano}</p>

        <ol className="relative" style={{ height: altura }} aria-label={`Posições em ${anoAnterior}`}>
          {porAnterior.map((m) => (
            <li key={m.slug} className="absolute inset-x-0 flex -translate-y-1/2 items-center justify-end gap-2.5 pr-3" style={{ top: y(m.anterior as number) }}>
              <span className={`min-w-0 truncate text-right text-sm leading-tight ${forte(m) ? "font-medium text-carvao" : "text-carvao-muted"}`}>{m.grupo}</span>
              <span className="hidden lg:inline-flex">
                <LogoEmpresa slug={m.slug} nome={m.grupo} tamanho="p" decorativo semLogo="placa" />
              </span>
              <span className="w-7 shrink-0 text-right text-sm tabular-nums text-carvao">{ordinal(m.anterior as number)}</span>
            </li>
          ))}
        </ol>

        <div className="relative" style={{ height: altura }} aria-hidden="true">
          <svg viewBox={`0 0 100 ${altura}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" focusable="false">
            {[...movimentos].sort((a, b) => Number(forte(a)) - Number(forte(b))).map((m) =>
              m.anterior === null ? null : (
                <line key={m.slug} x1={0} x2={100} y1={y(m.anterior)} y2={y(m.atual)} stroke={forte(m) ? corDe(m.ganho) : COR_PARADO} strokeWidth={forte(m) ? 3 : 1.25} strokeLinecap="round" vectorEffect="non-scaling-stroke" data-linha-movimento={m.slug} />
              ),
            )}
          </svg>
          {movimentos.map((m) => (
            <span key={m.slug}>
              {m.anterior !== null && <span className="absolute left-0 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ top: y(m.anterior), background: forte(m) ? corDe(m.ganho) : COR_PARADO }} />}
              <span className="absolute right-0 h-2 w-2 -translate-y-1/2 translate-x-1/2 rounded-full" style={{ top: y(m.atual), background: forte(m) ? corDe(m.ganho) : COR_PARADO }} />
            </span>
          ))}
        </div>

        <ol className="relative" style={{ height: altura }} aria-label={`Posições em ${ano}, com o movimento de cada grupo`}>
          {movimentos.map((m) => (
            <li key={m.slug} className="absolute inset-x-0 flex -translate-y-1/2 items-center gap-2.5 pl-3" style={{ top: y(m.atual) }} data-movimento={m.slug} data-ganho={m.ganho ?? "sem-base"}>
              <span className="w-7 shrink-0 text-sm tabular-nums text-carvao">{ordinal(m.atual)}</span>
              <LogoEmpresa slug={m.slug} nome={m.grupo} tamanho="p" decorativo semLogo="placa" />
              <span className={`min-w-0 flex-1 truncate text-sm leading-tight text-carvao ${forte(m) ? "font-medium" : ""}`}>{nome(m)}</span>
              <span className={`shrink-0 whitespace-nowrap pr-1 text-right text-xs tabular-nums ${forte(m) ? "font-medium text-carvao" : "text-carvao-muted"}`}>
                <span aria-hidden="true">{curto(m.ganho)}</span>
                <span className="sr-only">{textoDoMovimento(m)}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>

      {/* celular: lista na ordem do ranking; a barra sai do centro, para a direita quem subiu, para a esquerda quem desceu */}
      <p className="t-meta mt-3 text-carvao-muted md:hidden">Na ordem de {ano}. A barra sai do traço central: para a direita, posições ganhas desde {anoAnterior}; para a esquerda, perdidas.</p>
      <ol className="mt-2 border-t border-carvao md:hidden" aria-label={titulo} data-inclinacao-em-lista="">
        {movimentos.map((m) => {
          const largura = m.ganho === null ? 0 : (50 * Math.abs(m.ganho)) / maior;
          return (
            <li key={m.slug} className="grid grid-cols-[1.75rem_84px_minmax(0,1fr)_4.5rem] items-center gap-x-2.5 border-b border-linha py-2">
              <span className="text-sm tabular-nums text-carvao">{ordinal(m.atual)}</span>
              <LogoEmpresa slug={m.slug} nome={m.grupo} tamanho="p" decorativo semLogo="placa" />
              <span className="min-w-0 text-sm leading-snug text-carvao">
                <span className="block truncate">{nome(m)}</span>
                <span className="block text-xs text-carvao-muted">
                  {m.anterior === null ? "sem posição no ano anterior" : m.ganho === 0 ? `${ordinal(m.anterior)} também antes` : `era ${ordinal(m.anterior)}: ${m.ganho! > 0 ? "subiu" : "desceu"} ${num(Math.abs(m.ganho!))}`}
                </span>
              </span>
              <span aria-hidden="true" className="relative block h-2.5">
                <span className="absolute inset-y-[-4px] left-1/2 w-px bg-mineral" />
                {m.ganho !== null && m.ganho !== 0 && <span className="absolute inset-y-0" style={{ width: `${largura}%`, left: m.ganho > 0 ? "50%" : `${50 - largura}%`, background: corDe(m.ganho) }} />}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
