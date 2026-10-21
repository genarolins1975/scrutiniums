import ts from "typescript";

/** @typedef {{ estado: "traduzido", texto: string } | { estado: "portugues_marcado", motivo: string }} EntradaEn */

/** Extrai apenas dados literais; não executa nem importa módulos da aplicação. */
function extrair(conteudo, idioma) {
  if (typeof conteudo !== "string") throw new Error(`Fonte ${idioma} deve ser texto TypeScript.`);
  const fonte = ts.createSourceFile(`${idioma}.ts`, conteudo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  function erro(no, mensagem) {
    const { line, character } = fonte.getLineAndCharacterOfPosition(no.getStart(fonte));
    throw new Error(`Catálogo ${idioma}: ${mensagem} (${line + 1}:${character + 1}).`);
  }
  if (fonte.parseDiagnostics.length) throw new Error(`Sintaxe inválida no catálogo ${idioma}.`);

  function literal(no) {
    while (ts.isAsExpression(no) || ts.isSatisfiesExpression(no)) {
      if (ts.isAsExpression(no) && !(ts.isTypeReferenceNode(no.type)
        && ts.isIdentifier(no.type.typeName) && no.type.typeName.text === "const" && !no.type.typeArguments)) {
        erro(no, "somente as const é admitido como asserção");
      }
      no = no.expression;
    }
    if (ts.isStringLiteral(no)) return no.text;
    if (!ts.isObjectLiteralExpression(no)) erro(no, "valor deve ser string ou objeto literal");
    const objeto = Object.create(null);
    for (const propriedade of no.properties) {
      if (!ts.isPropertyAssignment(propriedade)) erro(propriedade, "propriedade deve ter nome e valor literais, sem spread ou acessor");
      const nome = propriedade.name;
      if (!(ts.isIdentifier(nome) || ts.isStringLiteral(nome))) erro(nome, "chave deve ser literal, sem expressão calculada");
      const chave = nome.text;
      if (!chave.trim()) erro(nome, "chave vazia");
      // Em JavaScript esta chave altera o protótipo em vez de declarar uma entrada.
      if (chave === "__proto__") erro(nome, "chave __proto__ não é permitida");
      if (Object.hasOwn(objeto, chave)) erro(nome, `chave duplicada ${JSON.stringify(chave)}`);
      objeto[chave] = literal(propriedade.initializer);
    }
    return objeto;
  }

  let objeto;
  for (const declaracao of fonte.statements) {
    if (ts.isImportDeclaration(declaracao) && declaracao.importClause?.isTypeOnly) continue;
    if (ts.isTypeAliasDeclaration(declaracao) || ts.isInterfaceDeclaration(declaracao)) continue;
    if (!ts.isVariableStatement(declaracao)
      || declaracao.modifiers?.length !== 1 || declaracao.modifiers[0].kind !== ts.SyntaxKind.ExportKeyword
      || declaracao.declarationList.flags !== ts.NodeFlags.Const
      || declaracao.declarationList.declarations.length !== 1) {
      erro(declaracao, "somente imports de tipo, tipos e o objeto export const são admitidos");
    }
    const item = declaracao.declarationList.declarations[0];
    if (!ts.isIdentifier(item.name) || item.name.text !== idioma || !item.initializer) {
      erro(item, `esperado export const ${idioma} com objeto literal`);
    }
    if (objeto !== undefined) erro(item, `exportação ${idioma} duplicada`);
    objeto = literal(item.initializer);
    if (typeof objeto !== "object") erro(item, "o dicionário deve ser objeto literal");
  }
  if (!objeto || !Object.keys(objeto).length) throw new Error(`Catálogo ${idioma} ausente ou vazio.`);
  return objeto;
}

function exigirTexto(valor, campo) {
  if (typeof valor !== "string" || !valor.trim()) throw new Error(`${campo} deve ser texto não vazio.`);
}

/**
 * Valida somente o catálogo literal de infraestrutura, sem caminhos, hashes ou cobertura de uso.
 * @param {string} ptSource
 * @param {string} enSource
 * @returns {{ pt: Record<string, string>, en: Record<string, EntradaEn> }}
 */
export function lerCatalogo(ptSource, enSource) {
  const pt = extrair(ptSource, "pt");
  const en = extrair(enSource, "en");
  const chavesPt = Object.keys(pt).sort();
  const chavesEn = Object.keys(en).sort();
  if (chavesPt.length !== chavesEn.length || chavesPt.some((chave, i) => chave !== chavesEn[i])) {
    throw new Error("Os catálogos pt e en devem ter as mesmas chaves.");
  }
  for (const chave of chavesPt) {
    exigirTexto(pt[chave], `pt[${JSON.stringify(chave)}]`);
    const entrada = en[chave];
    if (!entrada || typeof entrada !== "object") throw new Error(`en[${JSON.stringify(chave)}] deve declarar estado explícito.`);
    const campo = entrada.estado === "traduzido" ? "texto" : entrada.estado === "portugues_marcado" ? "motivo" : null;
    if (!campo) throw new Error(`Estado inválido em en[${JSON.stringify(chave)}].`);
    const campos = Object.keys(entrada);
    if (campos.length !== 2 || !Object.hasOwn(entrada, campo)) {
      throw new Error(`en[${JSON.stringify(chave)}] admite somente estado e ${campo}.`);
    }
    exigirTexto(entrada[campo], `en[${JSON.stringify(chave)}].${campo}`);
    if (campo === "texto" && /[\u2013\u2014]/u.test(entrada.texto)) {
      throw new Error(`Texto inglês em ${JSON.stringify(chave)} contém en dash ou em dash.`);
    }
  }
  return { pt, en };
}
