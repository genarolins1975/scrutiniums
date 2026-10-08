/**
 * Contrato do HTML pré-renderizado, verificado de forma estrutural (árvore DOM do parse5), não
 * por regex sobre o HTML sem tags:
 *
 *  - PROSA (texto visível ao leitor, rótulos acessíveis como aria-label/title/alt): nenhuma data,
 *    competência ou instante ISO sem tratamento, válido ou não, e nenhum "undefined" ou "NaN";
 *  - ATRIBUTOS e dados de máquina (datetime, href, data-*, ids): livres;
 *  - LITERAIS (`data-literal-fonte`): evidência preservada, aceita só se obedecer ao registro
 *    de classes (src/lib/literais-fonte.ts): classe conhecida, origem recuperável, rótulo
 *    visível, conteúdo no padrão e no tamanho da classe, sem estrutura interna além do valor.
 *    O literal não autoriza ignorar o texto ao redor.
 *
 * Usado por src/tests/html-gerado.test.ts (build real) e por scripts/inventario-datas.mjs.
 */
import { parse } from "parse5";
import { LITERAIS, ORIGEM_VALIDA, ROTULO_PAPEL, defLiteral } from "../../lib/literais-fonte.ts";
import { encontraDatas } from "../../lib/texto-datas.ts";

export type Violacao = {
  rota: string;
  regra:
    | "data-iso-em-prosa"
    | "undefined-nan"
    | "literal-classe-desconhecida"
    | "literal-sem-origem"
    | "literal-sem-rotulo-visivel"
    | "literal-estrutura"
    | "literal-fora-do-padrao"
    | "literal-aninhado"
    | "literal-sem-explicacao";
  trecho: string;
  detalhe: string;
};

export type LiteralAchado = { rota: string; classe: string; origem: string; valor: string };

export type Ocorrencia = {
  rota: string;
  /** Texto exato da expressão e seu tipo, para o inventário. */
  bruto: string;
  tipo: "competencia" | "data" | "instante";
  valida: boolean;
  motivo: string | null;
  onde: "prosa" | "atributo-lido" | "literal";
  contexto: string;
  cadeia: string;
};

export type Analise = { violacoes: Violacao[]; literais: LiteralAchado[]; ocorrenciasProsa: Ocorrencia[]; textoVisivel: number };

type No = {
  nodeName: string;
  tagName?: string;
  attrs?: { name: string; value: string }[];
  childNodes?: No[];
  content?: No;
  value?: string;
};

const IGNORADOS = new Set(["script", "style", "template", "noscript"]);
/** Atributos que o leitor ou a tecnologia assistiva percebem como texto. */
const ATRIBUTOS_LIDOS = ["aria-label", "aria-description", "title", "alt", "placeholder"];
/** Padrão antigo do teste (inclui AAAA/MM com barra); mantido além da gramática de texto-datas. */
const LEGADO = /(^|[\s(])20\d\d[-/]\d\d([-/]\d\d)?(T[\d:]+Z?)?(?=[\s).,;]|$)/;
const TOKENS_QUEBRADOS = /\bundefined\b|\bNaN\b/;

const attr = (n: No, nome: string) => n.attrs?.find((a) => a.name === nome)?.value;
const filhos = (n: No): No[] => [...(n.childNodes ?? []), ...(n.content?.childNodes ?? [])];
const marca = (n: No) => `${n.tagName ?? n.nodeName}${attr(n, "id") ? `#${attr(n, "id")}` : ""}`;

function textoDe(n: No): string {
  if (n.nodeName === "#text") return n.value ?? "";
  return filhos(n).map(textoDe).join("");
}

function oculto(n: No): boolean {
  const cls = attr(n, "class") ?? "";
  return attr(n, "hidden") !== undefined || attr(n, "aria-hidden") === "true" || /(^|\s)(sr-only|hidden)(\s|$)/.test(cls);
}

function resume(t: string, i: number, fim: number): string {
  return t.slice(Math.max(0, i - 60), fim + 50).replace(/\s+/g, " ").trim();
}

export function analisaHtml(html: string, rota: string): Analise {
  const doc = parse(html) as unknown as No;
  const violacoes: Violacao[] = [];
  const literais: LiteralAchado[] = [];
  const ocorrenciasProsa: Ocorrencia[] = [];
  let textoVisivel = 0;

  const prosa = (texto: string, cadeia: string[], onde: "prosa" | "atributo-lido") => {
    if (!texto.trim()) return;
    textoVisivel += texto.length;
    for (const o of encontraDatas(texto)) {
      const contexto = resume(texto, o.inicio, o.fim);
      ocorrenciasProsa.push({ rota, bruto: o.bruto, tipo: o.tipo, valida: o.valida, motivo: o.motivo, onde, contexto, cadeia: cadeia.slice(-4).join(" > ") });
      violacoes.push({ rota, regra: "data-iso-em-prosa", trecho: contexto, detalhe: `${o.tipo}${o.valida ? "" : ` inválida (${o.motivo})`} em ${onde}` });
    }
    if (!encontraDatas(texto).length) {
      const m = LEGADO.exec(texto);
      if (m) violacoes.push({ rota, regra: "data-iso-em-prosa", trecho: resume(texto, m.index, m.index + m[0].length), detalhe: "padrão legado (AAAA-MM ou AAAA/MM)" });
    }
    const t = TOKENS_QUEBRADOS.exec(texto);
    if (t) violacoes.push({ rota, regra: "undefined-nan", trecho: resume(texto, t.index, t.index + t[0].length), detalhe: t[0] });
  };

  const valida = (n: No, cadeia: string[]) => {
    const classe = attr(n, "data-literal-fonte") ?? "";
    const origem = attr(n, "data-origem") ?? "";
    const def = defLiteral(classe);
    const fail = (regra: Violacao["regra"], detalhe: string, trecho = resume(textoDe(n), 0, textoDe(n).length)) => violacoes.push({ rota, regra, trecho, detalhe: `${classe || "(sem classe)"}: ${detalhe}` });
    if (!def) {
      fail("literal-classe-desconhecida", `classe não registrada em src/lib/literais-fonte.ts (registradas: ${Object.keys(LITERAIS).join(", ")})`);
      return;
    }
    if (n.tagName !== "span") fail("literal-estrutura", `o contêiner deve ser <span>, não <${n.tagName}>`);
    if (!ORIGEM_VALIDA.test(origem)) fail("literal-sem-origem", `data-origem ausente ou fora do formato (https ou caminho do site): "${origem}"`);
    const elementos = filhos(n).filter((c) => c.nodeName !== "#text" && c.nodeName !== "#comment");
    const soltos = filhos(n).filter((c) => c.nodeName === "#text" && (c.value ?? "").trim() !== "");
    const rotulos = elementos.filter((c) => attr(c, "data-literal-rotulo") !== undefined);
    const valores = elementos.filter((c) => attr(c, "data-literal-valor") !== undefined);
    const explicacoes = elementos.filter((c) => attr(c, "data-literal-explicacao") !== undefined);
    if (rotulos.length !== 1 || valores.length !== 1 || elementos.length !== rotulos.length + valores.length + explicacoes.length || soltos.length) {
      fail("literal-estrutura", "esperado exatamente um rótulo, um valor e, se a classe pedir, uma explicação, sem texto solto nem outros elementos");
      return;
    }
    const [rot] = rotulos;
    const [val] = valores;
    const rotuloTexto = textoDe(rot).replace(/\s+/g, " ").trim();
    const esperado = `${ROTULO_PAPEL[def.papel]} · ${def.fonteCurta}`;
    if (oculto(rot) || rotuloTexto !== esperado) fail("literal-sem-rotulo-visivel", `rótulo visível esperado "${esperado}", encontrado "${oculto(rot) ? "(oculto) " : ""}${rotuloTexto}"`);
    const conteudo = textoDe(val);
    if (!["code", "q"].includes(val.tagName ?? "") || filhos(val).some((c) => c.nodeName !== "#text")) fail("literal-estrutura", "o valor deve ser <code> ou <q> só com texto");
    if (conteudo.length > def.maxCaracteres) fail("literal-fora-do-padrao", `${conteudo.length} caracteres, máximo ${def.maxCaracteres} (um contêiner amplo não é um literal)`, conteudo.slice(0, 80));
    else if (!def.padrao.test(conteudo)) fail("literal-fora-do-padrao", `conteúdo não casa com o padrão da classe (${def.padrao})`, conteudo.slice(0, 120));
    if (def.explicacao === "inline" && !explicacoes.some((e) => textoDe(e).trim() !== "")) fail("literal-sem-explicacao", "a classe exige explicação visível dentro do literal");
    if (!def.permiteUndefinedNaN) {
      const t = TOKENS_QUEBRADOS.exec(conteudo);
      if (t) fail("undefined-nan", `token ${t[0]} no literal; a classe não declara permiteUndefinedNaN`, conteudo.slice(0, 80));
    }
    literais.push({ rota, classe, origem, valor: conteudo });
    void cadeia;
  };

  const anda = (n: No, cadeia: string[], dentroDeLiteral: boolean) => {
    if (n.nodeName === "#comment") return;
    if (n.nodeName === "#text") return;
    const nome = n.tagName ?? n.nodeName;
    if (IGNORADOS.has(nome)) return;
    const nova = n.tagName ? [...cadeia, marca(n)] : cadeia;
    const ehLiteral = attr(n, "data-literal-fonte") !== undefined;
    if (ehLiteral) {
      if (dentroDeLiteral) violacoes.push({ rota, regra: "literal-aninhado", trecho: resume(textoDe(n), 0, textoDe(n).length), detalhe: "literal dentro de literal" });
      else valida(n, nova);
      return; // o conteúdo do literal não é prosa; sua validade foi verificada acima
    }
    if (n.tagName) for (const a of ATRIBUTOS_LIDOS) { const v = attr(n, a); if (v) prosa(v, [...nova, `@${a}`], "atributo-lido"); }
    let buffer = "";
    for (const c of filhos(n)) {
      if (c.nodeName === "#text") buffer += c.value ?? "";
      else if (c.nodeName === "#comment") continue;
      else {
        prosa(buffer, nova, "prosa");
        buffer = "";
        anda(c, nova, dentroDeLiteral);
      }
    }
    prosa(buffer, nova, "prosa");
  };

  anda(doc, [], false);
  return { violacoes, literais, ocorrenciasProsa, textoVisivel };
}

/** Linha legível de uma violação, para a mensagem do teste. */
export function descreve(v: Violacao): string {
  return `${v.rota}: [${v.regra}] ${v.detalhe}: «${v.trecho}»`;
}

/** Cobertura mínima do build: o diretório existe, as rotas esperadas existem e há páginas a inspecionar. */
export function coberturaDoBuild(app: string, rotasObrigatorias: string[], minimoSetorEletrico: number, fs: { existsSync: (p: string) => boolean; readdirSync: (p: string, o: { withFileTypes: true }) => { name: string; isDirectory(): boolean }[] }, join: (...p: string[]) => string) {
  const existe = fs.existsSync(app);
  const faltando = existe ? rotasObrigatorias.filter((r) => !fs.existsSync(join(app, r))) : rotasObrigatorias;
  const paginas = (dir: string): string[] => {
    const out: string[] = [];
    const varre = (d: string) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = join(d, e.name);
        if (e.isDirectory()) varre(p);
        else if (e.name.endsWith(".html")) out.push(p);
      }
    };
    if (fs.existsSync(dir)) varre(dir);
    return out;
  };
  const setor = paginas(join(app, "setor-eletrico"));
  if (fs.existsSync(join(app, "setor-eletrico.html"))) setor.push(join(app, "setor-eletrico.html"));
  const obee = join(app, "eficiencia-estatal", "educacao-municipal-capitais.html");
  // o painel tem uma rota por visão (panorama, gastos, atendimento, resultados, comparar, métodos): todas obedecem ao contrato
  const obeePaginas = paginas(join(app, "eficiencia-estatal", "educacao-municipal-capitais"));
  if (fs.existsSync(obee)) obeePaginas.unshift(obee);
  const erros: string[] = [];
  if (!existe) erros.push(`${app} não existe: o CI precisa gerar o build (npm run build) antes dos testes`);
  else {
    if (faltando.length) erros.push(`rotas esperadas ausentes do build: ${faltando.join(", ")}`);
    if (setor.length < minimoSetorEletrico) erros.push(`poucas páginas do setor elétrico no build (${setor.length}); mínimo ${minimoSetorEletrico}`);
  }
  return { existe, faltando, setor, obee: fs.existsSync(obee) ? obee : null, obeePaginas, erros };
}
