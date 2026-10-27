import { ETAPAS_ENERGIA } from "@/lib/energia/percurso-visual";
import styles from "./GravuraEnergia.module.css";

/** A mesma cena da prancha 2 × 2, recortada no build de ativos e carregada só perto da tela. */
export function GravuraEnergia({ etapa, className = "", sizes = "(max-width: 640px) 50vw, (max-width: 1000px) 45vw, 300px" }: {
  etapa: typeof ETAPAS_ENERGIA[number]["id"];
  className?: string;
  sizes?: string;
}) {
  return <span aria-hidden="true" className={`${styles.gravura} ${className}`}>
    {/* Arquivos estáticos já dimensionados: sem custo de otimização na primeira requisição. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img
      src={`/energia/arte/etapa-${etapa}-600-v1.webp`}
      srcSet={`/energia/arte/etapa-${etapa}-300-v1.webp 300w, /energia/arte/etapa-${etapa}-600-v1.webp 600w`}
      sizes={sizes}
      width={600}
      height={600}
      alt=""
      loading="lazy"
      decoding="async"
    />
  </span>;
}
