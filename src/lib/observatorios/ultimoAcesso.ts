/**
 * Último acesso do leitor (Iniciativa M1 do parecer de UX de 23/10/2026): o cookie que o mapa da conta lê para o cartão
 * "Continuar em …". Desde 23/10/2026 quem grava é o middleware (src/middleware.ts), em toda navegação de página com sessão
 * cujo caminho é uma coleção ou a entrada de um observatório; antes era o POST /app/observatorios/entrar, só quando o
 * leitor saía pelo mapa.
 *
 * Valores, sem dado pessoal:
 *  - `c:<colecaoId>`: o caminho é o `href` de uma coleção de lista.ts ou fica abaixo dele (casamento mais longo:
 *    `/observatorio/pix` é Pagamentos, não Crédito; `/observatorio-do-credito` não é `/observatorio`);
 *  - `o:<observatorioId>`: o caminho é exatamente a `entrada` de um observatório.
 * O formato antigo (id de domínio, "judiciario", id de observatório sem prefixo) é ignorado na leitura, sem erro.
 *
 * Só importa lista.ts, que não lê disco: o arquivo roda no Edge, dentro do middleware.
 */
import { OBSERVATORIOS, type ObservatorioId } from "./lista";

export const COOKIE_OBSERVATORIO = "scrutiniums_observatorio";

/** Um ano, como o cookie que o POST gravava. */
export const VALIDADE_ULTIMO_ACESSO = 60 * 60 * 24 * 365;

export type UltimoAcesso =
  | { tipo: "colecao"; valor: string; observatorio: ObservatorioId; colecao: string; nome: string; href: string }
  | { tipo: "observatorio"; valor: string; observatorio: ObservatorioId; colecao: null; nome: string; href: string };

const COLECOES = OBSERVATORIOS.flatMap((o) => o.colecoes.map((c) => ({ observatorio: o.id, colecao: c.id, nome: c.nome, href: c.href })))
  // casamento mais longo primeiro
  .sort((a, b) => b.href.length - a.href.length);

/** Caminho sem consulta, âncora nem barra final. */
function limpar(caminho: string): string {
  const c = caminho.split(/[?#]/)[0];
  return c.length > 1 && c.endsWith("/") ? c.slice(0, -1) : c;
}

/** A coleção dona do caminho pelo endereço (href igual ou caminho abaixo dele), ou undefined. */
export function colecaoDoCaminho(caminho: string): (typeof COLECOES)[number] | undefined {
  const c = limpar(caminho);
  return COLECOES.find((x) => c === x.href || c.startsWith(`${x.href}/`));
}

/** O valor do cookie para um caminho de página, ou null quando o caminho não é coleção nem entrada de observatório. */
export function ultimoAcessoDoCaminho(caminho: string): string | null {
  const c = limpar(caminho);
  const colecao = colecaoDoCaminho(c);
  if (colecao) return `c:${colecao.colecao}`;
  const o = OBSERVATORIOS.find((x) => x.entrada === c);
  return o ? `o:${o.id}` : null;
}

/** Lê o cookie: os dois formatos novos; qualquer outro valor (inclusive o formato antigo) vira null. */
export function lerUltimoAcesso(valor: string | null | undefined): UltimoAcesso | null {
  if (typeof valor !== "string") return null;
  if (valor.startsWith("c:")) {
    const id = valor.slice(2);
    for (const o of OBSERVATORIOS) {
      const c = o.colecoes.find((x) => x.id === id);
      if (c) return { tipo: "colecao", valor, observatorio: o.id, colecao: c.id, nome: c.nome, href: c.href };
    }
    return null;
  }
  if (valor.startsWith("o:")) {
    const o = OBSERVATORIOS.find((x) => x.id === valor.slice(2));
    return o?.entrada ? { tipo: "observatorio", valor, observatorio: o.id, colecao: null, nome: o.nomeCurto, href: o.entrada } : null;
  }
  return null;
}
