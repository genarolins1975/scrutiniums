import Image from "next/image";
import { GRAVURAS, NOTA_GRAVURA } from "@/lib/observatorios/gravuras";
import type { ObservatorioId } from "@/lib/observatorios/lista";

/**
 * Gravura de um observatório como figura (decisão do dono de 10/11/2026: imagens uniformizadas e um elemento visual em
 * toda página). Uma só família de estilo, um só formato; a nota diz que é ilustração conceitual, sem dado nem lugar real.
 * `faixa` é a versão baixa (3:1 no celular, 4:1 de 768 px em diante), para onde a altura da página tem orçamento apertado.
 */
export function GravuraObservatorio({ id, faixa = false, className = "" }: Readonly<{ id: ObservatorioId; faixa?: boolean; className?: string }>) {
  const g = GRAVURAS[id];
  return (
    <figure className={`min-w-0 ${className}`} data-gravura={id}>
      <div className={`relative w-full overflow-hidden bg-carvao ${faixa ? "aspect-[3/1] md:aspect-[4/1]" : "aspect-[2/1]"}`}>
        <Image src={g.src} alt={g.alt} fill sizes="(max-width: 1240px) 100vw, 1240px" className="object-cover" />
      </div>
      <figcaption className="mt-2 text-xs leading-relaxed text-mineral">{NOTA_GRAVURA}</figcaption>
    </figure>
  );
}
