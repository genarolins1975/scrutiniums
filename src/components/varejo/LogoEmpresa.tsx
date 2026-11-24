import { nomeCurtoDoGrupo } from "@/lib/varejo/grupos";
import { logoDe } from "@/lib/varejo/logos";

/**
 * Símbolo de uma empresa da coleção Varejo (componente de servidor): o arquivo oficial baixado do site da própria companhia, sem
 * alteração, numa placa de tamanho fixo e discreto. A placa tem o tom do fundo para o qual a companhia desenhou o arquivo
 * (`fundo` no manifesto): superfície clara para os logos de fundo claro, carvão para os publicados só em branco. A imagem leva
 * largura e altura calculadas para caber na placa, de modo que nada se desloca quando ela carrega. Sem logo oficial com vínculo
 * provado, devolve o nome em texto; o motivo da ausência fica no manifesto (public/varejo/logos/manifesto.json). `decorativo`
 * serve para quando o nome já está escrito ao lado: o alt fica vazio e, sem logo, nada é desenhado.
 *
 * `semLogo="placa"` (ranking, fichas, comparador): a companhia sem logo oficial ganha uma placa do mesmo tamanho, com o nome curto
 * dela composto na serifa da plataforma. Não é logo nem imitação de um: é o nome, na mesma letra para todas, e por isso a placa
 * leva `data-logo-ausente`. As colunas, os cabeçalhos e os blocos ficam alinhados com ou sem arquivo.
 */

type Tamanho = "p" | "m" | "g";

/** Placa (largura x altura, em px) e a área útil dentro dela; as classes repetem as mesmas medidas. */
const PLACA: Record<Tamanho, { classe: string; util: [number, number] }> = {
  // na placa pequena o logo muito largo (Renner, Natura, Havan) usa 76 dos 84 px: a altura dele passa de 13 para 14 px ou mais
  p: { classe: "h-7 w-[84px]", util: [76, 18] },
  m: { classe: "h-10 w-[120px]", util: [102, 28] },
  g: { classe: "h-14 w-[168px]", util: [144, 40] },
};

/** Letra do nome na placa tipográfica: 12 px é o piso da plataforma; o nome curto mais longo ("Leroy Merlin") cabe nos 84 px. */
const LETRA: Record<Tamanho, string> = { p: "text-xs tracking-[-0.01em]", m: "text-base", g: "text-[1.375rem]" };

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
  semLogo = "nome",
}: {
  slug: string;
  nome: string;
  tamanho?: Tamanho;
  decorativo?: boolean;
  /** Sem logo oficial: "nome" devolve o nome em texto (ou nada, se decorativo); "placa" desenha a placa tipográfica do mesmo tamanho. */
  semLogo?: "nome" | "placa";
}) {
  const logo = logoDe(slug);
  if (!logo && semLogo === "placa") {
    return (
      <span data-logo-ausente={slug} data-placa-tipografica="" aria-hidden={decorativo || undefined} className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-sm border border-linha bg-papel px-1 ${PLACA[tamanho].classe}`}>
        <span aria-hidden={decorativo ? undefined : true} className={`whitespace-nowrap font-serif leading-none text-carvao ${LETRA[tamanho]}`}>
          {nomeCurtoDoGrupo(nome)}
        </span>
        {!decorativo && <span className="sr-only">{nome}</span>}
      </span>
    );
  }
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
