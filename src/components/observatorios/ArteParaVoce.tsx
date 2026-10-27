import Image from "next/image";
import { GravuraEnergia } from "@/components/energia/GravuraEnergia";
import { ETAPAS_ENERGIA } from "@/lib/energia/percurso-visual";
import styles from "./ParaVoce.module.css";

/** Gravura única que cobre a faixa do cartão (ex.: a conta de luz do Setor Elétrico). */
export function ArteFoto({ src }: { src: string }) {
  return <Image src={src} alt="" width={720} height={720} sizes="(max-width: 768px) 100vw, 400px" className={styles.cobre} />;
}

/** Uma cena da prancha 2 × 2 do Setor Elétrico, centrada na faixa do cartão. */
export function ArtePrancha({ etapa }: { etapa: (typeof ETAPAS_ENERGIA)[number]["id"] }) {
  return <GravuraEnergia etapa={etapa} className={styles.prancha} sizes="(max-width: 640px) 100vw, (max-width: 1000px) 33vw, 400px" />;
}

/** Uma das três cenas do tríptico de um tema das contas públicas (/estado/arte/<tema>-gravura-v1.webp). */
export function ArteTriptico({ tema, cena }: { tema: "obee" | "federal" | "estadual"; cena: 0 | 1 | 2 }) {
  return (
    <Image
      src={`/estado/arte/${tema}-gravura-v1.webp`}
      alt=""
      width={2172}
      height={724}
      unoptimized
      loading="lazy"
      className={styles.triptico}
      style={{ left: `-${cena * 100}%` }}
    />
  );
}
