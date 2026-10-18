/** Inventário lexical via AST TypeScript: comentários não são referências a dados. */
import ts from 'typescript';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
const root = process.cwd();
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory()
    ? walk(join(dir, e.name)) : /\.(ts|tsx)$/.test(e.name) ? [join(dir, e.name)] : []);
}
const inventory = {};
for (const file of [...walk(join(root, 'src/tests')), ...walk(join(root, 'src/lib'))]) {
  const source = readFileSync(file, 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const strings = [], imports = [];
  function visit(n) {
    if (ts.isStringLiteralLike(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) {
      const p = n.parent;
      const nomeGold = (ts.isCallExpression(p) && /(?:ler|read|gold|load)/i.test(p.expression.getText(ast)))
        || (ts.isArrayLiteralExpression(p) && ts.isForOfStatement(p.parent)
          && /\b(?:gold|lerGold|readFileSync|read|ler|load)\s*\(/i.test(p.parent.statement.getText(ast)));
      let assertion = false;
      for (let a = n.parent; a && !ts.isStatement(a); a = a.parent) {
        if (ts.isCallExpression(a) && /^(?:expect|.*\.to[A-Z])/.test(a.expression.getText(ast))) assertion = true;
      }
      strings.push({ texto: n.text, nome_gold: nomeGold, assertion: assertion && !nomeGold, linha: ast.getLineAndCharacterOfPosition(n.getStart(ast)).line + 1 });
    }
    if (ts.isImportDeclaration(n) && !n.importClause?.isTypeOnly) imports.push(n.moduleSpecifier.text);
    ts.forEachChild(n, visit);
  }
  visit(ast);
  inventory[relative(root, file)] = { strings, imports, le_fs: /\b(readFileSync|readdirSync|existsSync)\s*\(/.test(source) };
}
writeFileSync(process.argv[2], JSON.stringify(inventory));
