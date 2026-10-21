/** Origem literal dos nomes de produto; nunca executa o módulo da aplicação. */
import { readFileSync, realpathSync, statSync } from "node:fs";
import { join, sep } from "node:path";
import ts from "typescript";

export const REGISTRO_PRODUTOS = "src/lib/dominios.ts";

/** @typedef {{ arquivo: string, nomes: Map<string, string> }} RegistroProdutos */
/** @typedef {{ carregarProdutos: () => RegistroProdutos }} ContextoProdutos */

function literal(no) {
  while (no && (ts.isParenthesizedExpression(no) || ts.isAsExpression(no) || ts.isSatisfiesExpression(no))) {
    no = no.expression;
  }
  return no;
}

/** @returns {RegistroProdutos} */
function carregarProdutos(raiz) {
  const base = realpathSync(raiz);
  const path = realpathSync(join(base, REGISTRO_PRODUTOS));
  if (!path.startsWith(base + sep) || !statSync(path).isFile()) {
    throw new Error("Registro de produtos deve ser arquivo dentro do repositório.");
  }
  const arvore = ts.createSourceFile(REGISTRO_PRODUTOS, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  if (arvore.parseDiagnostics.length) throw new Error("Registro de produtos contém sintaxe inválida.");
  const declaracoes = arvore.statements.flatMap((no) => ts.isVariableStatement(no)
    ? no.declarationList.declarations.filter((d) => ts.isIdentifier(d.name) && d.name.text === "DOMINIOS")
      .map((declaracao) => ({ no, declaracao })) : []);
  if (declaracoes.length !== 1) throw new Error("Registro exige uma única declaração literal de DOMINIOS.");
  const { no, declaracao } = declaracoes[0];
  if (!(no.declarationList.flags & ts.NodeFlags.Const)
    || !no.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    || no.modifiers.some((m) => m.kind === ts.SyntaxKind.DeclareKeyword)) {
    throw new Error("Registro exige export const DOMINIOS.");
  }
  const itens = literal(declaracao.initializer);
  if (!itens || !ts.isArrayLiteralExpression(itens) || !itens.elements.length) {
    throw new Error("DOMINIOS deve ser um array literal não vazio.");
  }
  const nomes = new Map();
  for (const item of itens.elements) {
    if (!ts.isObjectLiteralExpression(item)) throw new Error("Produto deve ser objeto literal, sem spread ou expressão dinâmica.");
    const campos = new Map();
    for (const campo of item.properties) {
      if (!ts.isPropertyAssignment(campo)
        || !(ts.isIdentifier(campo.name) || ts.isStringLiteral(campo.name))) {
        throw new Error("Produto admite somente propriedades explícitas, sem nomes computados.");
      }
      const chave = campo.name.text;
      if (campos.has(chave)) throw new Error(`Propriedade de produto duplicada: ${chave}.`);
      campos.set(chave, campo.initializer);
    }
    const valores = ["id", "nomeCurto"].map((campo) => {
      const valor = campos.get(campo);
      if (!valor || !ts.isStringLiteral(valor) || !valor.text.trim()) {
        throw new Error(`Produto exige ${campo} como string literal não vazia.`);
      }
      return valor.text;
    });
    if (nomes.has(valores[0])) throw new Error(`ID de produto duplicado: ${valores[0]}.`);
    nomes.set(valores[0], valores[1]);
  }
  return { arquivo: REGISTRO_PRODUTOS, nomes };
}

/** Captura só a raiz; glossários antigos não precisam ler o registro.
 * @param {string} raiz
 * @returns {ContextoProdutos}
 */
export function criarContextoProdutos(raiz) {
  return { carregarProdutos: () => carregarProdutos(raiz) };
}
