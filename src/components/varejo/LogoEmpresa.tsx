import { logoDe } from "@/lib/varejo/logos";

/**
 * Símbolo de uma empresa da coleção Varejo (componente de servidor): o arquivo oficial baixado do site da própria companhia, sem
 * alteração, numa placa de tamanho fixo e discreto. A placa tem o tom do fundo para o qual a companhia desenhou o arquivo
 * (`fundo` no manifesto): superfície clara para os logos de fundo claro, carvão para os publicados só em branco. A imagem leva
 * largura e altura calculadas para caber na placa, de modo que nada se desloca quando ela carrega. Sem logo oficial com vínculo
 * provado, devolve o nome em texto; o motivo da ausência fica no manifesto (public/varejo/logos/manifesto.json). `decorativo`
 * serve para quando o nome já está escrito ao lado: o alt fica vazio e, sem logo, nada é desenhado.
 */

type Tamanho = "p" | "m" | "g";

/** Placa (largura x altura, em px) e a área útil dentro dela; as classes repetem as mesmas medidas. */
const PLACA: Record<Tamanho, { classe: string; util: [number, number] }> = {
  p: { classe: "h-7 w-[84px]", util: [70, 18] },
  m: { classe: "h-10 w-[120px]", util: [102, 28] },
  g: { classe: "h-14 w-[168px]", util: [144, 40] },
};

/** Medidas da imagem que cabem na área útil, preservando a proporção do arquivo. */
export function medidasNaPlaca(largura: number, altura: number, tamanho: Tamanho): { width: number; height: number } {
  const [w, h] = PLACA[tamanho].util;
  const escala = Math.min(w / largura, h / altura);
  return { width: Math.max(1, Math.round(largura * escala)), height: Math.max(1, Math.round(altura * escala)) };
}

export function LogoEmpresa({
  slug,
  nome,
  tamanho = "m",
  decorativo = false,
}: {
  slug: string;
  nome: string;
  tamanho?: Tamanho;
  decorativo?: boolean;
}) {
  const logo = logoDe(slug);
  if (!logo) return decorativo ? null : <span data-logo-ausente={slug}>{nome}</span>;
  const { width, height } = medidasNaPlaca(logo.largura, logo.altura, tamanho);
  return (
    <span
      data-logo={slug}
      className={`inline-flex shrink-0 items-center justify-center rounded-sm ${PLACA[tamanho].classe} ${
        logo.fundo === "escuro" ? "bg-carvao" : "border border-linha bg-superficie"
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logo.arquivo} alt={decorativo ? "" : `Símbolo de ${nome}`} width={width} height={height} decoding="async" />
    </span>
  );
}
