/**
 * Curadoria do Varejo: reúne os arquivos escritos à mão em pipeline/varejo/curadoria (contrato em ESQUEMA.md) num arquivo
 * só, public/varejo/gold/curadoria.json, que as páginas da coleção leem no servidor: { ranking, segmentos, fichas por slug }.
 *
 * A curadoria chega aos poucos. Arquivo ausente vira null (ou nenhuma ficha) e a página diz "em apuração"; arquivo que não
 * passa na conferência mínima fica de fora, com o motivo em `recusados`, e não derruba o build. Com `--check`, qualquer
 * arquivo recusado encerra com erro (para o CI, quando a curadoria estiver completa).
 *
 * Conferências: JSON válido; ranking com a lista `grupos` e `slug` em cada grupo; segmentos com a lista `segmentos`, cada um
 * com `slug`, `nome` e `atividades_pmc` que existem na gold setorial; ficha com `slug` igual ao nome do arquivo e `grupo`.
 * O derivado não é versionado (.gitignore); `scripts/preparar.mjs` o gera antes de dev, build e testes.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from "node:fs";

const raiz = new URL("../", import.meta.url);
const pasta = new URL("pipeline/varejo/curadoria/", raiz);
const destino = new URL("public/varejo/gold/curadoria.json", raiz);
const recusados = [];
let maisRecente = 0;

function ler(nome) {
  const u = new URL(nome, pasta);
  if (!existsSync(u)) return null;
  try {
    const bruto = readFileSync(u, "utf8");
    if (!bruto.trim()) throw new Error("arquivo vazio");
    maisRecente = Math.max(maisRecente, statSync(u).mtimeMs);
    return JSON.parse(bruto);
  } catch (e) {
    recusados.push({ arquivo: nome, motivo: `JSON ilegível: ${e.message}` });
    return null;
  }
}

function conferir(nome, dado, regra) {
  if (dado === null) return null;
  const motivo = regra(dado);
  if (!motivo) return dado;
  recusados.push({ arquivo: nome, motivo });
  return null;
}

const setor = JSON.parse(readFileSync(new URL("public/varejo/gold/setor.json", raiz), "utf8"));
const atividades = new Set(Object.keys(setor.pmc.atividades));
const ehTexto = (v) => typeof v === "string" && v.trim() !== "";

const ranking = conferir("ranking.json", ler("ranking.json"), (r) =>
  !Array.isArray(r.grupos) ? "sem a lista `grupos`" : r.grupos.some((g) => !ehTexto(g.slug) || !ehTexto(g.grupo)) ? "grupo sem `slug` ou sem `grupo`" : null,
);

const segmentos = conferir("segmentos.json", ler("segmentos.json"), (s) => {
  if (!Array.isArray(s.segmentos)) return "sem a lista `segmentos`";
  for (const x of s.segmentos) {
    if (!ehTexto(x.slug) || !ehTexto(x.nome)) return "segmento sem `slug` ou sem `nome`";
    if (!Array.isArray(x.atividades_pmc)) return `segmento ${x.slug} sem a lista \`atividades_pmc\``;
    const fora = x.atividades_pmc.filter((a) => !atividades.has(a));
    if (fora.length) return `segmento ${x.slug} cita atividade que a gold setorial não tem: ${fora.join(", ")}`;
  }
  return null;
});

const fichas = {};
const pastaFichas = new URL("fichas/", pasta);
if (existsSync(pastaFichas)) {
  for (const nome of readdirSync(pastaFichas).filter((n) => n.endsWith(".json")).sort()) {
    const slug = nome.replace(/\.json$/, "");
    const f = conferir(`fichas/${nome}`, ler(`fichas/${nome}`), (x) => (x.slug !== slug ? `\`slug\` (${x.slug}) diferente do nome do arquivo` : !ehTexto(x.grupo) ? "sem `grupo`" : null));
    if (f) fichas[slug] = f;
  }
}

const saida = {
  gerado_em: maisRecente ? new Date(maisRecente).toISOString().replace(/\.\d+Z$/, "Z") : null,
  ranking,
  segmentos,
  fichas,
  recusados,
};
const conteudo = JSON.stringify(saida) + "\n";

if (process.argv.includes("--check") && recusados.length) {
  for (const r of recusados) console.error(`Curadoria do Varejo recusada: ${r.arquivo}: ${r.motivo}`);
  process.exit(1);
}
mkdirSync(new URL("./", destino), { recursive: true });
const tmp = new URL("curadoria.json.tmp", destino);
writeFileSync(tmp, conteudo);
renameSync(tmp, destino);
for (const r of recusados) console.warn(`Curadoria do Varejo: ${r.arquivo} ficou de fora (${r.motivo}).`);
console.log(`Curadoria do Varejo: ranking ${ranking ? `com ${ranking.grupos.length} grupos` : "em apuração"}, segmentos ${segmentos ? `${segmentos.segmentos.length}` : "em apuração"}, ${Object.keys(fichas).length} fichas.`);
