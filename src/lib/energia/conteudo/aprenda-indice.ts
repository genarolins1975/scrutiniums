/**
 * Seletores do índice do Aprenda: tudo que a página de índice mostra (a lista por tema, a linha de cada verbete, o painel onde ele
 * aparece, as contagens e as frases de estado) sai daqui, do mesmo acervo (`CONCEITOS`) que alimenta o verbete, a busca e o sitemap.
 * Nada é escrito à parte nem recalculado: mudar o estado de conferência de um verbete muda a linha, a contagem e a frase juntos.
 *
 * Não altera texto, estado, fonte nem definição de verbete: lê o acervo e a pergunta prática (perguntas-praticas.ts).
 */
import { normalizaBusca } from "../aprenda-busca";
import { dataBR, plural } from "../formato";
import { DESTINOS_NAVEGACAO } from "../navegacao";
import { CONCEITOS, GRUPOS, type Conceito, type GrupoConceito } from "./conceitos";
import { perguntaPratica } from "./perguntas-praticas";
import { provaDoVerbete } from "./provas";
import { comVolta } from "./trilhas";

/** conferido na fonte primária; conferido com ressalva declarada no verbete; em preparação (sem definição publicada). */
export type EstadoDoVerbete = "conferido" | "ressalva" | "preparacao";

export type DestinoNoPainel = { rotulo: string; href: string };

export type ItemDoIndice = {
  slug: string;
  /** Pergunta prática, só de verbete conferido. */
  pergunta: string | null;
  /** Sigla, ou o nome quando o verbete não tem sigla. */
  titulo: string;
  /** Nome por extenso, quando há sigla e ela difere do nome. */
  subtitulo?: string;
  grupo: GrupoConceito;
  estado: EstadoDoVerbete;
  /** Painel onde o conceito aparece; o endereço de verbete conferido já leva ?volta= para o botão de retorno. */
  painel: DestinoNoPainel | null;
  /** Texto pesquisável (pergunta, sigla, nome, tema, definição), sem acento e em minúsculas. */
  busca: string;
};

export type GrupoDoIndice = { id: string; nome: GrupoConceito; itens: ItemDoIndice[] };

/** Identificador de âncora do tema: sem acento, espaço nem maiúscula (#g-preco, #g-qualidade-e-perdas). */
export function idDoGrupo(g: string): string {
  return `g-${normalizaBusca(g).replace(/[^a-z0-9]+/g, "-")}`;
}

/** Nome da página de destino pelo primeiro trecho do caminho ("/setor-eletrico/pld#cmo" → "Preço de curto prazo (PLD)"). */
function rotuloDoModulo(href: string): string | null {
  const caminho = href.split("#")[0].split("?")[0];
  const segmento = caminho.replace(/^\/setor-eletrico\/?/, "").split("/")[0];
  return DESTINOS_NAVEGACAO.find((d) => d.href === `/setor-eletrico/${segmento}`)?.rotulo ?? null;
}

/**
 * Nome do painel para o link do índice: o rótulo que o verbete ou a ficha dá, quando já tem a forma "Módulo: painel" ("Carga: perfil
 * horário"); rótulo solto ("Como estamos gerando", "Simulador da conta") deixa de ser nome de painel, e vale o nome da página de destino.
 */
function rotuloDoPainel(rotulo: string | undefined, href: string): string {
  if (rotulo?.includes(":")) return rotulo;
  return rotuloDoModulo(href) ?? rotulo ?? "Painel";
}

/**
 * Painel onde o conceito aparece, para o link direto do índice. É o mesmo painel do exemplo do verbete (ficha publicada ou texto lido
 * da base); sem exemplo, o primeiro painel que o verbete aponta. O rótulo vem do painel (ficha), do verbete ou da página de destino.
 * Verbete conferido leva ?volta=verbete:<slug>; em preparação não, porque o botão de retorno só existe para verbete conferido.
 */
export function destinoNoPainel(c: Conceito): DestinoNoPainel | null {
  const conferido = c.estado === "CONFERIDO";
  const prova = conferido ? provaDoVerbete(c.slug) : null;
  let destino: DestinoNoPainel | null = null;
  if (prova?.tipo === "evidencia") {
    destino = { rotulo: prova.dado.painel.rotulo, href: prova.dado.painel.href };
  } else if (prova?.tipo === "texto") {
    const href = prova.href;
    destino = { rotulo: rotuloDoPainel(c.vejaNoPortal.find((v) => v.href === href)?.rotulo, href), href };
  } else if (c.vejaNoPortal[0]) {
    destino = { rotulo: rotuloDoPainel(c.vejaNoPortal[0].rotulo, c.vejaNoPortal[0].href), href: c.vejaNoPortal[0].href };
  }
  if (!destino) return null;
  return conferido ? { rotulo: destino.rotulo, href: comVolta(destino.href, `verbete:${c.slug}`) } : destino;
}

export function itemDoIndice(c: Conceito): ItemDoIndice {
  const conferido = c.estado === "CONFERIDO";
  const estado: EstadoDoVerbete = !conferido ? "preparacao" : c.ressalva ? "ressalva" : "conferido";
  const pergunta = conferido ? perguntaPratica(c.slug) : null;
  const mesmoNome = !!c.sigla && c.sigla.toLowerCase() === c.nome.toLowerCase();
  // o que a busca lê: a definição de verbete conferido, ou a fonte planejada de verbete em preparação (nunca uma definição escrita à parte)
  const texto = conferido ? (c.emPalavrasSimples ?? c.emUmaFrase ?? "") : (c.fontePlanejada ?? "");
  return {
    slug: c.slug,
    pergunta,
    titulo: c.sigla ?? c.nome,
    subtitulo: c.sigla && !mesmoNome ? c.nome : undefined,
    grupo: c.grupo,
    estado,
    painel: destinoNoPainel(c),
    busca: normalizaBusca(
      [pergunta, c.sigla, c.nome, c.slug.replace(/-/g, " "), c.grupo, estado === "preparacao" ? "em preparação" : "", estado === "ressalva" ? "com ressalva" : "", texto]
        .filter(Boolean)
        .join(" "),
    ),
  };
}

/** Os verbetes agrupados por tema, na ordem de `GRUPOS`; só entram os temas que têm verbete. */
export function gruposDoIndice(): GrupoDoIndice[] {
  return GRUPOS.map((g) => ({ id: idDoGrupo(g), nome: g, itens: CONCEITOS.filter((c) => c.grupo === g).map(itemDoIndice) }));
}

export type ResumoDoAcervo = {
  total: number;
  conferidos: number;
  /** Em preparação (estado PENDENTE do acervo). */
  pendentes: number;
  comRessalva: number;
  temas: number;
  /** Primeira e última data de conferência na fonte primária (AAAA-MM-DD). */
  de: string | null;
  ate: string | null;
};

export function resumoDoAcervo(): ResumoDoAcervo {
  const conferidos = CONCEITOS.filter((c) => c.estado === "CONFERIDO");
  const datas = conferidos.map((c) => c.conferidoEm).filter((d): d is string => !!d).sort();
  return {
    total: CONCEITOS.length,
    conferidos: conferidos.length,
    pendentes: CONCEITOS.length - conferidos.length,
    comRessalva: conferidos.filter((c) => c.ressalva).length,
    temas: GRUPOS.length,
    de: datas[0] ?? null,
    ate: datas[datas.length - 1] ?? null,
  };
}

/** Período das conferências, em uma expressão ("em 07/10/2026" ou "entre 28/09/2026 e 07/10/2026"); vazio sem data. */
function periodoDasConferencias(r: ResumoDoAcervo): string {
  if (!r.de || !r.ate) return "";
  return r.de === r.ate ? ` em ${dataBR(r.de)}` : ` entre ${dataBR(r.de)} e ${dataBR(r.ate)}`;
}

/** Recorte da abertura: quantos verbetes, em que estado e quando foram conferidos. */
export function recorteDoAcervo(r: ResumoDoAcervo): string {
  const quando = periodoDasConferencias(r);
  if (r.pendentes === 0) return `${plural(r.total, "verbete", "verbetes")}, ${r.total === 1 ? "conferido" : "todos conferidos"} na fonte primária${quando}`;
  return `${plural(r.total, "verbete", "verbetes")}: ${r.conferidos} conferidos na fonte primária${quando} e ${r.pendentes} em preparação`;
}

/**
 * Frase de estado da lista: quantos verbetes estão conferidos e o que cada marca ao lado do verbete quer dizer (◐ conferido com ressalva
 * declarada, ○ em preparação). Verbete sem marca é verbete conferido sem ressalva; a frase só cita a marca que existe na lista.
 */
export function estadosDoAcervo(r: ResumoDoAcervo): string {
  const partes: string[] = [];
  if (r.pendentes === 0) partes.push(r.total === 1 ? "O verbete está conferido na fonte primária." : `Os ${r.total} verbetes estão conferidos na fonte primária.`);
  else partes.push(`${r.conferidos} de ${r.total} verbetes estão conferidos na fonte primária.`);
  if (r.comRessalva > 0) {
    const sujeito = r.comRessalva === 1 ? "O verbete marcado" : `Os ${r.comRessalva} verbetes marcados`;
    partes.push(`${sujeito} com ◐ ${r.comRessalva === 1 ? "traz" : "trazem"} uma ressalva declarada no próprio verbete: a fonte que define o termo não foi lida ou não o define.`);
  }
  if (r.pendentes > 0) {
    const sujeito = r.pendentes === 1 ? "O verbete marcado" : `Os ${r.pendentes} verbetes marcados`;
    partes.push(`${sujeito} com ○ ${r.pendentes === 1 ? "está" : "estão"} em preparação, sem definição publicada, com o que já foi consultado e o que falta.`);
  }
  return partes.join(" ");
}
