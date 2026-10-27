// Resumos da publicação: gerados em preparar/prebuild, nunca com dados de sessão.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import createJiti from "jiti";
import ts from "typescript";
const raiz = fileURLToPath(new URL("..", import.meta.url));
const jiti = createJiti(import.meta.url, {
  alias: { "@": raiz + "src" }, interopDefault: true, cache: false,
  extensions: [".js", ".mjs", ".cjs", ".ts", ".tsx", ".json"],
  transform: o => ({ code: ts.transpileModule(o.source.replaceAll('"@/', '"' + raiz + 'src/'), { fileName: o.filename, compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText }),
});
const ler = p => jiti(raiz + "src/lib/" + p);
const { IDS_DOMINIOS } = ler("frescor/regras.ts");
const frescor = ler("frescor/dominios.ts").dadosFrescor(IDS_DOMINIOS);
const mapa = ler("observatorios/mapaConta.ts").diretorioDoMapa(new Date(0));
// Só datas-base são persistidas; atraso é recalculado na requisição.
for (const secao of mapa.secoes) for (const colecao of secao.colecoes) colecao.atraso = null;
const { DOMINIOS } = ler("dominios.ts");
const atualizacao = ler("atualizacaoObservatorios.ts").atualizacaoObservatorio;
const dados = {
  versao: 1,
  portas: ler("perguntas/portas.ts").portas(),
  vitrines: ler("vitrine.ts").vitrines(),
  atualizacoes: Object.fromEntries([...DOMINIOS.map(d => d.id), "judiciario"].map(id => [id, atualizacao(id)])),
  mapa, frescor,
};
const destino = raiz + "src/lib/publicacao/entradas.json";
const texto = JSON.stringify(dados) + "\n";
let anterior; try { anterior = readFileSync(destino, "utf8"); } catch { /* primeiro build */ }
if (anterior !== texto) writeFileSync(destino, texto);
console.log(`entradas: manifesto da publicação (${Buffer.byteLength(texto)} bytes)`);
