import ts from "typescript";
import { parse } from "parse5";

/** Inventário sintático, não tradução: nenhuma função do aplicativo é executada. */
const ATRIBUTOS_TECNICOS = new Set([
  "id", "key", "ref", "class", "className", "style", "href", "src", "srcSet",
  "type", "role", "lang", "dir", "name", "htmlFor", "for", "target", "rel",
  "width", "height", "tabIndex", "tabindex", "colSpan", "rowSpan", "datetime",
  "dateTime", "method", "action", "encType", "encoding", "accept", "pattern",
  "autoComplete", "autocomplete", "inputMode", "inputmode", "loading", "decoding",
  "integrity", "crossOrigin", "crossorigin", "nonce", "http-equiv", "charset",
  "aria-hidden", "aria-live", "aria-atomic", "aria-busy", "aria-checked",
  "aria-controls", "aria-current", "aria-describedby", "aria-details",
  "aria-disabled", "aria-expanded", "aria-haspopup", "aria-labelledby",
  "aria-level", "aria-modal", "aria-owns", "aria-pressed", "aria-selected",
  "aria-valuemin", "aria-valuemax", "aria-valuenow",
]);

const criarCodigo = () => ({
  candidatos: {
    jsx_text: 0, atributos: 0, props: 0, outros_literais: 0,
    templates: 0, expressoes_nao_resolvidas: 0, chaves_objetos: 0,
  },
  exclusoes: { importacoes: 0, atributos_tecnicos: 0, tipos: 0 },
  totalCandidatos: 0,
  errosSintaxe: 0,
});

const total = (contadores) => Object.values(contadores).reduce((a, b) => a + b, 0);
const literalTexto = (no) => ts.isStringLiteral(no) || ts.isNoSubstitutionTemplateLiteral(no);
const template = (no) => ts.isTemplateExpression(no) || ts.isNoSubstitutionTemplateLiteral(no);

function desembrulhar(no) {
  while (ts.isParenthesizedExpression(no) || ts.isAsExpression(no)
    || ts.isSatisfiesExpression(no) || ts.isNonNullExpression(no)) no = no.expression;
  return no;
}

function resolvivel(no) {
  no = desembrulhar(no);
  return literalTexto(no) || ts.isNumericLiteral(no)
    || [ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword, ts.SyntaxKind.NullKeyword].includes(no.kind);
}

/** Conta unidades textuais em sintaxe excluída, sem contar fragmentos de template duas vezes. */
function unidadesTextuais(no) {
  if (literalTexto(no) || ts.isTemplateExpression(no) || ts.isTemplateLiteralTypeNode(no)) return 1;
  let n = 0;
  ts.forEachChild(no, (filho) => { n += unidadesTextuais(filho); });
  return n;
}

export function analisarCodigo(conteudo, caminho = "arquivo.tsx") {
  const resultado = criarCodigo();
  const kind = /\.tsx$/i.test(caminho) ? ts.ScriptKind.TSX
    : /\.jsx$/i.test(caminho) ? ts.ScriptKind.JSX
      : /\.[cm]?js$/i.test(caminho) ? ts.ScriptKind.JS : ts.ScriptKind.TS;
  const fonte = ts.createSourceFile(caminho, conteudo, ts.ScriptTarget.Latest, true, kind);
  resultado.errosSintaxe = fonte.parseDiagnostics.length;
  const pendencia = (no) => {
    if (!resolvivel(no)) resultado.candidatos.expressoes_nao_resolvidas += 1;
  };

  function visitar(no, contexto = "outros_literais") {
    if (ts.isImportDeclaration(no) || ts.isExportDeclaration(no) || ts.isImportEqualsDeclaration(no)) {
      resultado.exclusoes.importacoes += unidadesTextuais(no);
      return;
    }
    if (ts.isTypeNode(no)) {
      resultado.exclusoes.tipos += unidadesTextuais(no);
      return;
    }
    if (ts.isCallExpression(no)
      && (no.expression.kind === ts.SyntaxKind.ImportKeyword
        || (ts.isIdentifier(no.expression) && no.expression.text === "require"))) {
      no.arguments.forEach((arg, i) => {
        if (i === 0 && literalTexto(arg)) resultado.exclusoes.importacoes += 1;
        else visitar(arg, contexto);
      });
      return;
    }
    if (ts.isJsxAttribute(no)) {
      const tag = no.parent.parent.tagName;
      const nativo = ts.isIdentifier(tag) && /^[a-z]/.test(tag.text);
      const nome = no.name.getText(fonte);
      const tecnico = nativo && ATRIBUTOS_TECNICOS.has(nome);
      const valor = no.initializer;
      if (!valor) return;
      if (ts.isStringLiteral(valor)) {
        if (tecnico) resultado.exclusoes.atributos_tecnicos += 1;
        else resultado.candidatos[nativo ? "atributos" : "props"] += 1;
        return;
      }
      if (ts.isJsxExpression(valor) && valor.expression) {
        const expr = desembrulhar(valor.expression);
        if (tecnico && (literalTexto(expr) || ts.isTemplateExpression(expr))) {
          resultado.exclusoes.atributos_tecnicos += 1;
          if (ts.isTemplateExpression(expr)) {
            for (const span of expr.templateSpans) { pendencia(span.expression); visitar(span.expression); }
          }
        } else {
          pendencia(expr);
          visitar(valor.expression, tecnico ? "outros_literais" : nativo ? "atributos" : "props");
        }
      }
      return;
    }
    if (ts.isJsxSpreadAttribute(no)) {
      resultado.candidatos.expressoes_nao_resolvidas += 1;
      visitar(no.expression);
      return;
    }
    if (ts.isJsxText(no)) {
      if (no.text.trim()) resultado.candidatos.jsx_text += 1;
      return;
    }
    if (ts.isJsxExpression(no)) {
      if (no.expression) { pendencia(no.expression); visitar(no.expression, contexto); }
      return;
    }
    if (ts.isObjectLiteralExpression(no)) {
      for (const propriedade of no.properties) {
        if (ts.isSpreadAssignment(propriedade)) {
          resultado.candidatos.expressoes_nao_resolvidas += 1;
          visitar(propriedade.expression, contexto);
          continue;
        }
        resultado.candidatos.chaves_objetos += 1;
        if (ts.isComputedPropertyName(propriedade.name)) {
          pendencia(propriedade.name.expression);
          // Uma chave literal computada já foi contada como chave, não como valor.
          if (!resolvivel(propriedade.name.expression)) visitar(propriedade.name.expression, contexto);
        }
        ts.forEachChild(propriedade, (filho) => {
          if (filho !== propriedade.name) visitar(filho, contexto);
        });
      }
      return;
    }
    if (template(no)) {
      resultado.candidatos.templates += 1;
      if (ts.isTemplateExpression(no)) {
        for (const span of no.templateSpans) { pendencia(span.expression); visitar(span.expression, contexto); }
      }
      return;
    }
    if (ts.isStringLiteral(no)) {
      resultado.candidatos[contexto] += 1;
      return;
    }
    ts.forEachChild(no, (filho) => visitar(filho, contexto));
  }

  visitar(fonte);
  resultado.totalCandidatos = total(resultado.candidatos);
  return resultado;
}

/**
 * Excluímos somente atributos técnicos explicitamente conhecidos em elementos DOM.
 * Props de componentes, data-* e atributos desconhecidos continuam candidatos.
 * Expressões em atributos técnicos são percorridas: um callback pode conter prosa.
 */
export function analisarHtml(conteudo, caminho = "arquivo.html") {
  void caminho;
  const resultado = {
    candidatos: { textos: 0, atributos: 0, expressoes_nao_resolvidas: 0 },
    exclusoes: { atributos_tecnicos: 0, estilos: 0, comentarios: 0 },
    scripts: { inlinePendentes: 0, externos: 0, dadosPendentes: 0 },
    totalCandidatos: 0,
  };
  const tecnicosHtml = new Set([...ATRIBUTOS_TECNICOS].map((nome) => nome.toLowerCase()));

  function visitar(no) {
    if (no.nodeName === "#comment") { resultado.exclusoes.comentarios += 1; return; }
    if (no.nodeName === "#text") {
      if (no.value.trim()) resultado.candidatos.textos += 1;
      return;
    }
    const tag = no.tagName;
    for (const atributo of no.attrs ?? []) {
      if (/^on[a-z]+$/.test(atributo.name)) {
        resultado.scripts.inlinePendentes += 1;
        resultado.candidatos.expressoes_nao_resolvidas += 1;
      } else if (tecnicosHtml.has(atributo.name)) resultado.exclusoes.atributos_tecnicos += 1;
      else resultado.candidatos.atributos += 1;
    }
    if (tag === "style") { resultado.exclusoes.estilos += 1; return; }
    if (tag === "script") {
      const atributo = (nome) => no.attrs?.find((a) => a.name === nome)?.value;
      if (atributo("src") !== undefined) resultado.scripts.externos += 1;
      const temCorpo = no.childNodes?.some((filho) => filho.value?.trim());
      if (temCorpo) {
        const tipo = (atributo("type") ?? "").trim().toLowerCase();
        if (["", "module", "text/javascript", "application/javascript", "text/ecmascript", "application/ecmascript"].includes(tipo)) resultado.scripts.inlinePendentes += 1;
        else resultado.scripts.dadosPendentes += 1;
        resultado.candidatos.expressoes_nao_resolvidas += 1;
      }
      return;
    }
    for (const filho of no.childNodes ?? []) visitar(filho);
    // Conteúdo de template e noscript pode aparecer em execução; não é descartado.
    if (no.content) visitar(no.content);
  }

  visitar(parse(conteudo, { scriptingEnabled: false }));
  resultado.totalCandidatos = total(resultado.candidatos);
  return resultado;
}

/** JSON Pointer com índices de arrays agrupados; chaves de objetos nunca são agrupadas. */
export function analisarJson(objeto) {
  const campos = new Set();
  const resultado = {
    ocorrenciasStrings: 0, camposCandidatos: [], stringsVazias: 0,
    numeros: 0, booleanos: 0, nulos: 0,
  };
  const escapar = (chave) => chave.replace(/~/g, "~0").replace(/\//g, "~1");
  function visitar(valor, ponteiro) {
    if (typeof valor === "string") {
      resultado.ocorrenciasStrings += 1;
      if (valor.length === 0) resultado.stringsVazias += 1;
      campos.add(ponteiro);
    } else if (typeof valor === "number") resultado.numeros += 1;
    else if (typeof valor === "boolean") resultado.booleanos += 1;
    else if (valor === null) resultado.nulos += 1;
    else if (Array.isArray(valor)) {
      for (const item of valor) visitar(item, `${ponteiro}/*`);
    } else if (typeof valor === "object") {
      for (const chave of Object.keys(valor)) visitar(valor[chave], `${ponteiro}/${escapar(chave)}`);
    }
  }
  visitar(objeto, "");
  resultado.camposCandidatos = [...campos].sort();
  return resultado;
}
