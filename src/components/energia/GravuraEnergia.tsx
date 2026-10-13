import { ETAPAS_ENERGIA } from "@/lib/energia/percurso-visual";
import styles from "./GravuraEnergia.module.css";

/** Uma janela por cena da prancha 2 × 2; nunca um recorte arbitrário da paisagem. */
export function GravuraEnergia({ etapa, className = "" }: {
  etapa: typeof ETAPAS_ENERGIA[number]["id"];
  className?: string;
}) {
  const index = ETAPAS_ENERGIA.findIndex(item => item.id === etapa);
  return <span aria-hidden="true" className={`${styles.gravura} ${className}`}
    style={{ backgroundPosition: `${(index % 2) * 100}% ${index < 2 ? 0 : 100}%` }} />;
}
