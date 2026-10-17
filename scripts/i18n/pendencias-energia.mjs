#!/usr/bin/env node
/**
 * Pendências de tradução no código do Setor Elétrico: texto português que chegaria ao leitor sem
 * passar por tx()/useTx()/porIdioma e sem marca de nome próprio (<Nome>) ou de trecho só em
 * português (<TrechoPortugues>). Lê o AST do TypeScript; não executa nada.
 *
 * É um auxílio de trabalho, não a prova: a prova é o teste do HTML gerado
 * (src/tests/energia-i18n-html.test.ts). O verificador é deliberadamente amplo e pode apontar
 * literal que não chega à tela (chave de dado, comparação); nesses casos, quem traduz decide e,
 * se for dado, deixa como está ou marca a linha com o comentário `// i18n: dado`.
 *
 * Uso: node scripts/i18n/pendencias-energia.mjs [arquivos ou pastas...] [--resumo] [--json]
 *      sem argumentos: src/app/setor-eletrico, src/components/energia e src/lib/energia
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";

const args = process.argv.slice(2);
const resumo = args.includes("--resumo");
const comoJson = args.includes("--json");
const alvos = args.filter((a) => !a.startsWith("--"));
const RAIZ = process.cwd();
const PADRAO = ["src/app/setor-eletrico", "src/components/energia", "src/lib/energia"];

function listar(p) {
  const st = statSync(p);
  if (st.isFile()) return /\.(tsx?)$/.test(p) && !/\.d\.ts$/.test(p) ? [p] : [];
  return readdirSync(p).sort().flatMap((n) => listar(join(p, n)));
}

const ACENTO = /[ãõçáéíóúâêôàÃÕÇÁÉÍÓÚÂÊÔÀ]/;
const FUNCIONAIS = /(?:^|[^\p{L}])(?:de|da|das|dos|em|na|nas|nos|para|pelo|pela|pelos|pelas|com|que|uma|não|são|é|à|às|ao|aos|ou|também|está|entre|sobre|seu|sua|quando|cada|mês|até|desde|após|sem|mais|menos|maior|menor|dia|dias|ano|anos|valor|fonte|total|média|preço|energia|usina|usinas|dado|dados|página|painel|ver|abrir|baixar|fechar|mostrar|todos|todas|nenhum|nenhuma)(?=$|[^\p{L}])/iu;
const SUFIXO = /\p{L}(?:ção|ções|ões|ência|ário|ária|ível|ável|mente)(?=$|[^\p{L}])/iu;
const CHAVES_ROTULO = /^(?:rotulo\w*|titulo\w*|subtitulo|texto\w*|descricao\w*|label|legenda\w*|unidade\w*|ajuda|nota\w*|notas|resumo\w*|pergunta\w*|resposta\w*|fonte\w*|ressalva\w*|aviso\w*|frase\w*|explicacao\w*|leitura\w*|chamada|link|linkTexto|acao|cta|vazio|mensagem\w*|alt|placeholder|title|description|definicao|significado|limite\w*|limitacao\w*|cuidado\w*|porque|como|oQue|paraQue|conclusao|destaque|intro\w*|eyebrow|sobre|faz|remuneracao|medida)$/;
const ATRIBUTOS_HUMANOS = new Set(["aria-label", "aria-description", "aria-valuetext", "aria-roledescription", "title", "alt", "placeholder", "label", "rotulo", "titulo", "subtitulo", "texto", "descricao", "legenda", "unidade", "fonte", "nota", "resumo", "pergunta", "ressalva", "aviso", "rotuloEixo", "rotuloX", "rotuloY", "vazio", "chamada", "link"]);
const ATRIBUTOS_TECNICOS = /^(?:className|class|id|key|href|src|type|role|htmlFor|name|value|method|rel|target|lang|d|viewBox|fill|stroke|style|as|ref|tabIndex|hrefLang|data-.*|aria-(?:controls|labelledby|describedby|hidden|current|expanded|live|haspopup|pressed|selected|level|owns|activedescendant|atomic|busy|sort)|width|height|x|y|cx|cy|r|transform|textAnchor|dominantBaseline|preserveAspectRatio|xmlns|points|strokeWidth|strokeDasharray|opacity|mode|variant|tamanho|tom|cor|atual|modulo|slug|ancora|chave|campo|coluna|ordem|tipo|natureza|estado|formato|grupo)$/;
const CHAMADAS_IGNORADAS = new Set(["tx", "porIdioma", "lerGold", "lerSerie", "lerJson", "require", "import", "join", "resolve", "readFileSync", "querySelector", "querySelectorAll", "getElementById", "addEventListener", "removeEventListener", "includes", "startsWith", "endsWith", "has", "get", "delete", "indexOf", "split", "replace", "replaceAll", "match", "test", "localeCompare", "padStart", "padEnd", "setAttribute", "getAttribute", "closest", "matches", "Error", "throw", "console", "warn", "log", "error", "createElement", "setProperty", "toLocaleString", "Intl", "Date", "RegExp", "encodeURIComponent", "decodeURIComponent", "fetch", "carregaJson", "useEstadoUrl", "useSearchParams", "searchParams", "set", "append", "redirect", "notFound", "rotuloRegra", "datasLegiveis", "normaLegivel"]);
const ELEMENTOS_ISENTOS = new Set(["Nome", "TrechoPortugues", "code", "kbd", "samp", "style", "script"]);

function nomeChamada(expr) {
  if (ts.isIdentifier(expr)) return expr.text;
  if (ts.isPropertyAccessExpression(expr)) return expr.name.text;
  return "";
}

function pareceTexto(s) {
  const t = s.replace(/\s+/g, " ").trim();
  if (!t || !/\p{L}/u.test(t)) return false;
  if (/^(?:https?:|mailto:|\/|#|\.|@)/.test(t)) return false;
  if (/^[\w.-]+\.(?:json|csv|xlsx|png|svg|zip|parquet|md|ts|tsx|js)$/i.test(t)) return false;
  // identificador sem espaço com _, :, / ou - ("energia_mwmed", "energia:leiloes", "pld-diario")
  if (!/\s/.test(t) && /[_:/]|^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(t)) return false;
  // classes utilitárias (Tailwind e CSS): todos os tokens com hífen, dois-pontos, colchete ou barra
  if (t.split(" ").length > 1 && t.split(" ").every((x) => /^[!\w-]*(?:[-:[\]/.%#]|^(?:flex|grid|block|hidden|inline|contents|relative|absolute|sticky|fixed|underline|italic|truncate|uppercase|lowercase|capitalize|group|peer|border|rounded|shadow|transition|sr-only|not-sr-only|container|rotulo|tabular-nums|whitespace-nowrap|grow|shrink|overflow-hidden|ed-\w+))[\w\-:[\]/.%#()]*$/.test(x))) return false;
  return true;
}

function portugues(s, contextoHumano) {
  const t = s.replace(/\s+/g, " ").trim();
  if (!pareceTexto(t)) return false;
  if (ACENTO.test(t) || SUFIXO.test(t) || FUNCIONAIS.test(t)) return true;
  // rótulo de uma palavra sem acento ("Fonte", "Norte") só conta quando está num lugar que o leitor vê
  if (contextoHumano && /^[A-ZÁ-Ú]?[a-zá-ú]{2,}(?: [a-zá-ú]{2,})*$/u.test(t) && !/^(?:[A-Z]{2,}|[a-z]+[A-Z]\w*)$/.test(t)) return true;
  return false;
}

function analisar(arquivo) {
  const fonte = readFileSync(arquivo, "utf8");
  const linhas = fonte.split("\n");
  const sf = ts.createSourceFile(arquivo, fonte, ts.ScriptTarget.Latest, true, arquivo.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const achados = [];
  const registrar = (no, texto, motivo) => {
    const { line } = sf.getLineAndCharacterOfPosition(no.getStart(sf));
    const l = linhas[line] ?? "";
    if (/\/\/\s*i18n:\s*dado/.test(l) || /\/\/\s*i18n:\s*dado/.test(linhas[line - 1] ?? "")) return;
    achados.push({ arquivo: relative(RAIZ, arquivo), linha: line + 1, texto: texto.replace(/\s+/g, " ").trim().slice(0, 110), motivo });
  };

  function isento(no) {
    for (let p = no.parent; p; p = p.parent) {
      if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isLiteralTypeNode(p) || ts.isTypeNode(p) && !ts.isTypeLiteralNode(p)) return true;
      if (ts.isCallExpression(p) || ts.isNewExpression(p)) {
        const n = nomeChamada(p.expression);
        if (CHAMADAS_IGNORADAS.has(n)) return true;
      }
      if (ts.isJsxElement(p) && ELEMENTOS_ISENTOS.has(p.openingElement.tagName.getText(sf))) return true;
      if (ts.isJsxAttribute(p)) {
        const nome = p.name.getText(sf);
        if (ATRIBUTOS_TECNICOS.test(nome)) return true;
      }
      if (ts.isBinaryExpression(p) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken, ts.SyntaxKind.InKeyword].includes(p.operatorToken.kind)) return true;
      if (ts.isCaseClause(p) && p.expression && (p.expression === no || p.expression.pos <= no.pos && no.end <= p.expression.end)) return true;
      if (ts.isElementAccessExpression(p) && p.argumentExpression === no) return true;
      if (ts.isPropertyAssignment(p) && p.name === no) return true;
      if (ts.isEnumMember(p)) return true;
      if (ts.isFunctionDeclaration(p) || ts.isArrowFunction(p) || ts.isFunctionExpression(p) || ts.isMethodDeclaration(p) || ts.isClassDeclaration(p) || ts.isSourceFile(p)) break;
    }
    return false;
  }

  function contextoHumano(no) {
    const p = no.parent;
    if (!p) return false;
    if (ts.isJsxAttribute(p)) return ATRIBUTOS_HUMANOS.has(p.name.getText(sf));
    if (ts.isJsxExpression(p) && p.parent && ts.isJsxAttribute(p.parent)) return ATRIBUTOS_HUMANOS.has(p.parent.name.getText(sf));
    if (ts.isPropertyAssignment(p) && p.initializer === no) return CHAVES_ROTULO.test(p.name.getText(sf).replace(/["']/g, ""));
    if (ts.isJsxExpression(p) && p.parent && (ts.isJsxElement(p.parent) || ts.isJsxFragment(p.parent))) return true;
    if (ts.isConditionalExpression(p) || ts.isBinaryExpression(p) || ts.isParenthesizedExpression(p)) return contextoHumano(p);
    return false;
  }

  function visitar(no) {
    if (ts.isJsxText(no)) {
      const t = no.getText(sf);
      if (pareceTexto(t) && !isento(no) && (portugues(t, true))) registrar(no, t, "texto JSX");
    } else if (ts.isStringLiteral(no) || ts.isNoSubstitutionTemplateLiteral(no)) {
      if (!isento(no) && portugues(no.text, contextoHumano(no))) registrar(no, no.text, "literal");
    } else if (ts.isTemplateExpression(no)) {
      const partes = [no.head.text, ...no.templateSpans.map((s) => s.literal.text)].join(" … ");
      if (!isento(no) && portugues(partes, contextoHumano(no))) registrar(no, partes, "modelo");
      for (const s of no.templateSpans) visitar(s.expression);
      return;
    }
    ts.forEachChild(no, visitar);
  }
  visitar(sf);
  return achados;
}

const arquivos = (alvos.length ? alvos : PADRAO).flatMap((a) => listar(join(RAIZ, a)));
const todos = arquivos.flatMap(analisar);
if (comoJson) console.log(JSON.stringify(todos, null, 1));
else if (resumo) {
  const por = new Map();
  for (const a of todos) por.set(a.arquivo, (por.get(a.arquivo) ?? 0) + 1);
  for (const [a, n] of [...por].sort((x, y) => y[1] - x[1])) console.log(`${String(n).padStart(5)}  ${a}`);
} else for (const a of todos) console.log(`${a.arquivo}:${a.linha}  [${a.motivo}]  ${a.texto}`);
console.error(`${todos.length} pendências em ${new Set(todos.map((a) => a.arquivo)).size} de ${arquivos.length} arquivos.`);
