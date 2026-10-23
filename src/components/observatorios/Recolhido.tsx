import type { ReactNode } from "react";

/**
 * Peças comuns dos blocos recolhidos da home (achado A9 da banca de 19/10/2026) e das entradas (Iniciativa 4 do parecer de UX
 * de 21/10/2026, que trouxe este arquivo de src/components/home para cá):
 * o índice das coleções, os capítulos de cada coleção, o método e os recursos
 * ficam em <details>, no HTML e acessíveis por teclado, para que a primeira
 * leitura tenha uma só taxonomia à vista, a das seis perguntas.
 *
 * Cada <details> recolhido leva a classe `group/recolhido`; o indicador lê o
 * estado aberto dela. É um só span decorativo, sem filhos (o contrato da home
 * em inglês só admite decoração folha dentro do índice traduzido).
 */
export const DETALHE_RECOLHIDO = "group/recolhido";

/** Classe do <summary>: sem o marcador nativo, alvo de toque de 44 px e foco visível herdado do tema. */
export const RESUMO_RECOLHIDO =
  "flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-6 [&::-webkit-details-marker]:hidden";

/** Sinal de mais que vira menos quando o bloco abre. */
export function IndicadorRecolhido({ claro = false }: Readonly<{ claro?: boolean }>) {
  return (
    <span
      aria-hidden="true"
      className={`relative h-5 w-5 shrink-0 ${claro ? "text-marfim" : "text-carvao"} before:absolute before:inset-x-0 before:top-1/2 before:h-[1.5px] before:-translate-y-1/2 before:bg-current after:absolute after:inset-y-0 after:left-1/2 after:w-[1.5px] after:-translate-x-1/2 after:bg-current motion-safe:after:transition-transform group-open/recolhido:after:rotate-90`}
    />
  );
}

/**
 * O único jeito de recolher uma seção longa numa entrada: um <details> com o título em serifa e o resumo de uma linha no
 * <summary>, e o conteúdo inteiro no HTML (auditável, indexável e acessível por teclado). É como as entradas cumprem o
 * orçamento de comprimento sem apagar nada.
 */
export function Recolhido({
  id,
  titulo,
  resumo,
  children,
  aberto = false,
  className = "",
}: Readonly<{
  id: string;
  titulo: ReactNode;
  /** O que há dentro, em uma linha. */
  resumo: ReactNode;
  children: ReactNode;
  aberto?: boolean;
  className?: string;
}>) {
  return (
    <details id={id} open={aberto || undefined} data-recolhido="" className={`${DETALHE_RECOLHIDO} border-t border-linha ${className}`}>
      <summary className={`${RESUMO_RECOLHIDO} py-4 md:py-6`}>
        <span className="block">
          <span className="block font-serif text-[clamp(1.25rem,2.4vw,1.6rem)] leading-snug text-carvao">{titulo}</span>
          <span className="mt-1 block text-sm leading-relaxed text-carvao-muted">{resumo}</span>
        </span>
        <IndicadorRecolhido />
      </summary>
      <div className="pb-10">{children}</div>
    </details>
  );
}
