import inventario from "../../config/i18n-inventario.json";
import { analisarUrlPagina, urlDaPagina } from "./i18n-url";

export type ParDeIdioma = Readonly<{
  pt: string;
  en: string;
  conteudo: "portugues_marcado" | "parcialmente_traduzido";
}>;

const porCaminhoPt = new Map<string, ParDeIdioma>();

if (inventario.rotas.schema_version !== 1) {
  throw new Error("Versão não suportada do registro de rotas por idioma.");
}

/** Irmãs declaradas; presença no registro nunca concede acesso à página. */
export const PARES_DE_IDIOMA: readonly ParDeIdioma[] = Object.freeze(
  inventario.rotas.literais.map((item) => {
    const pagina = analisarUrlPagina(item.pt);
    const en = urlDaPagina(item.pt, "en");
    if (!pagina || pagina.idioma !== "pt" || pagina.sufixo || !en
      || (item.pt !== "/" && item.pt.endsWith("/"))
      || (item.conteudo !== "portugues_marcado" && item.conteudo !== "parcialmente_traduzido")
      || porCaminhoPt.has(item.pt)) {
      throw new Error(`Par de idiomas inválido ou duplicado: ${item.pt}`);
    }
    const par: ParDeIdioma = Object.freeze({ pt: item.pt, en, conteudo: item.conteudo });
    porCaminhoPt.set(item.pt, par);
    return par;
  }),
);

/** Consulta pelo href interno; o resultado contém URLs canônicas, sem query ou fragmento. */
export function parDeIdioma(href: string): ParDeIdioma | null {
  const pagina = analisarUrlPagina(href);
  if (!pagina) return null;
  const caminho = pagina.caminhoPt === "/" ? "/" : pagina.caminhoPt.replace(/\/$/, "");
  return porCaminhoPt.get(caminho) ?? null;
}

/** Uma irmã que apenas reproduz o português não é uma tradução publicada. */
export function traducaoPublicada(href: string): boolean {
  const par = parDeIdioma(href);
  return !!par && par.conteudo !== "portugues_marcado";
}
