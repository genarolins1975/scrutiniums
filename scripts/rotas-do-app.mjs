// Regrava src/lib/uso/rotas-do-app.json, a lista fechada de páginas aceitas pela medição de uso
// (src/lib/uso/rotas.ts), a partir das pastas de src/app. Rodar depois de criar, mover ou apagar uma página;
// o teste uso-paginas falha enquanto a lista versionada estiver diferente do sistema de arquivos.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import createJiti from "jiti";

const raiz = fileURLToPath(new URL("..", import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { "@": raiz + "src" }, interopDefault: true });
const { rotasDoSistemaDeArquivos } = jiti(raiz + "src/lib/uso/varredura.ts");

const ARQ = raiz + "src/lib/uso/rotas-do-app.json";
const novo = JSON.stringify(rotasDoSistemaDeArquivos(raiz + "src/app"), null, 2) + "\n";
let antigo = "";
try {
  antigo = readFileSync(ARQ, "utf8");
} catch {
  // primeira geração
}
if (novo === antigo) console.log("lista de rotas já igual ao sistema de arquivos");
else {
  writeFileSync(ARQ, novo);
  console.log(`lista de rotas regravada: ${JSON.parse(novo).length} páginas`);
}
