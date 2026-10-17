import inventario from "../../config/i18n-inventario.json";
import { analisarUrlPagina, urlDaPagina } from "./i18n-url";

export type ParDeIdioma = Readonly<{
  pt: string;
  en: string;
  conteudo: "portugues_marcado" | "parcialmente_traduzido" | "traduzido";
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
      || !["portugues_marcado", "parcialmente_traduzido", "traduzido"].includes(item.conteudo)
      || porCaminhoPt.has(item.pt)) {
      throw new Error(`Par de idiomas inválido ou duplicado: ${item.pt}`);
    }
    const par: ParDeIdioma = Object.freeze({ pt: item.pt, en, conteudo: item.conteudo as ParDeIdioma["conteudo"] });
    porCaminhoPt.set(item.pt, par);
    return par;
  }),
);

/**
 * Padrões com parâmetro ("/setor-eletrico/empresas/listadas/[papel]"): a irmã existe para todo valor
 * que a página portuguesa gera. Casam segmento a segmento; o parâmetro aceita um segmento não vazio.
 * Valor sem página continua dando 404 nos dois idiomas: o padrão não cria página.
 */
type Padrao = Readonly<{ pt: string; segmentos: readonly string[]; conteudo: ParDeIdioma["conteudo"] }>;
const declaracaoPadroes = (inventario.rotas as { padroes?: { pt: string; conteudo: string }[] }).padroes ?? [];
export const PADROES_DE_IDIOMA: readonly Padrao[] = Object.freeze(
  declaracaoPadroes.map((item) => {
    const segmentos = item.pt.slice(1).split("/");
    if (!item.pt.startsWith("/") || !segmentos.some((s) => /^\[[a-z][a-zA-Z0-9_]*\]$/.test(s))
      || !["portugues_marcado", "parcialmente_traduzido", "traduzido"].includes(item.conteudo)) {
      throw new Error(`Padrão de idiomas inválido: ${item.pt}`);
    }
    return Object.freeze({ pt: item.pt, segmentos, conteudo: item.conteudo as ParDeIdioma["conteudo"] });
  }),
);

function porPadrao(caminho: string): ParDeIdioma | null {
  const partes = caminho.slice(1).split("/");
  for (const p of PADROES_DE_IDIOMA) {
    if (p.segmentos.length !== partes.length) continue;
    if (p.segmentos.every((s, i) => (s.startsWith("[") ? partes[i] !== "" : s === partes[i]))) {
      return Object.freeze({ pt: caminho, en: `/en${caminho}`, conteudo: p.conteudo });
    }
  }
  return null;
}

/** Consulta pelo href interno; o resultado contém URLs canônicas, sem query ou fragmento. */
export function parDeIdioma(href: string): ParDeIdioma | null {
  const pagina = analisarUrlPagina(href);
  if (!pagina) return null;
  const caminho = pagina.caminhoPt === "/" ? "/" : pagina.caminhoPt.replace(/\/$/, "");
  return porCaminhoPt.get(caminho) ?? porPadrao(caminho);
}

/** Uma irmã que apenas reproduz o português não é uma tradução publicada. */
export function traducaoPublicada(href: string): boolean {
  const par = parDeIdioma(href);
  return !!par && par.conteudo !== "portugues_marcado";
}
