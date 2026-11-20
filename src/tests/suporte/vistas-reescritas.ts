import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * O que a aplicação do Crédito (public/obs/app.js) ainda guarda de uma vista reescrita como página própria.
 *
 * Em 10/11/2026 o código que desenhava as nove vistas das Famílias saiu do arquivo: a função de render, o verbete do GUIA, a
 * lista de golds (VIEW_DATA), o pedaço (CHUNK_OF_VIEW), o despacho (RENDER) e o contêiner no index.html. Ficaram só o endereço
 * antigo em ROUTES, que é a chave do mapa `substituidas` e o destino quando o índice falta, e o título em VIEW_TITLES. Os testes
 * de dado de cada tema (bets-data, cobranca-data e os demais) conferiam o registro da vista em todos esses mapas; passam a
 * conferir, por aqui, que o registro saiu por inteiro e que o endereço antigo continua conhecido.
 */
const raiz = process.cwd();
const app = readFileSync(join(raiz, "public/obs/app.js"), "utf-8");
const html = readFileSync(join(raiz, "public/obs/index.html"), "utf-8");
const embed = readFileSync(join(raiz, "public/obs/embed.html"), "utf-8");

function bloco(nome: string): string {
  const m = app.match(new RegExp(`const ${nome} = \\{([\\s\\S]*?)\\n?\\};`));
  if (!m) throw new Error(`mapa ${nome} não encontrado em public/obs/app.js`);
  return m[1];
}
const temChave = (nome: string, view: string) => new RegExp(`(?:^|[\\s,{])${view}: `).test(bloco(nome));

export interface RegistroDaVista {
  /** endereço antigo em ROUTES, sem o prefixo /observatorio; null quando a chave saiu */
  rota: string | null;
  /** título em VIEW_TITLES */
  titulo: string | null;
  render: boolean;
  dados: boolean;
  pedaco: boolean;
  guia: boolean;
  /** contêiner `<section id="view-...">` no index.html ou no embed.html */
  secao: boolean;
}

export function registroNaAplicacao(view: string): RegistroDaVista {
  const par = (nome: string) => bloco(nome).match(new RegExp(`(?:^|[\\s,{])${view}: "([^"]*)"`))?.[1] ?? null;
  return {
    rota: par("ROUTES"),
    titulo: par("VIEW_TITLES"),
    render: temChave("RENDER", view),
    dados: temChave("VIEW_DATA", view),
    pedaco: temChave("CHUNK_OF_VIEW", view),
    guia: temChave("GUIA", view),
    secao: html.includes(`id="view-${view}"`) || embed.includes(`id="view-${view}"`),
  };
}

/** o registro esperado de uma vista reescrita: endereço e título, e mais nada */
export function soEnderecoETitulo(rota: string, titulo: string): RegistroDaVista {
  return { rota, titulo, render: false, dados: false, pedaco: false, guia: false, secao: false };
}

/** texto da página nova (ou do módulo dela), para as garantias de conteúdo que antes eram lidas no app.js */
export const fonteDaPagina = (caminho: string) => readFileSync(join(raiz, caminho), "utf-8");
