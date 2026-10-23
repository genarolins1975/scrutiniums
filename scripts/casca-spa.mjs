// Gera public/obs/casca.min.js (gitignorado) a partir de src/lib/observatorios/cascaPura.ts: a casca da plataforma na aplicação
// do Crédito (navegação da coleção, rótulo de contexto, "Para ir além" e rodapé da coleção), a mesma que o servidor usa para
// montar o HTML de cada endereço. O módulo só importa tipos, então basta transpilar (TypeScript) e envolver num script clássico,
// que expõe window.CascaCredito; o app.js o usa a cada troca de página. Chamado por scripts/minify-obs.mjs, e por isso em todo
// caminho que gera o app.min.js (CI, npm run preparar); o ?v= do index.html sobe com a versão da aplicação (avaliacao-set26).
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const raiz = fileURLToPath(new URL("..", import.meta.url));
const ORIGEM = raiz + "src/lib/observatorios/cascaPura.ts";
const DESTINO = raiz + "public/obs/casca.min.js";

export async function gerarCasca() {
  const fonte = readFileSync(ORIGEM, "utf8");
  const { outputText, diagnostics } = ts.transpileModule(fonte, {
    fileName: "cascaPura.ts",
    reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, isolatedModules: true, removeComments: true },
  });
  if (diagnostics?.length) throw new Error(`cascaPura.ts não transpila: ${diagnostics.map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n")).join("; ")}`);
  const script = `(function(){var exports={};${outputText}\nwindow.CascaCredito=exports;})();`;
  const { minify } = await import("terser");
  const res = await minify(script, { compress: { passes: 2 }, mangle: true, format: { comments: false } });
  if (!res.code) throw new Error("terser não produziu saída para casca.min.js");
  writeFileSync(DESTINO, res.code + "\n");
  return res.code.length;
}

const n = await gerarCasca();
console.log(`obs: casca.min.js ${Math.round(n / 1024)} KB (de src/lib/observatorios/cascaPura.ts)`);
