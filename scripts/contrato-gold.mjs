/**
 * Contrato da API pública de leitura (/obs/data/gold): catálogo de arquivos e
 * chaves de primeiro nível, gravado em docs/api/contrato-gold.json.
 *
 *   node scripts/contrato-gold.mjs           # mostra a diferença entre o gold e o contrato
 *   node scripts/contrato-gold.mjs --gravar  # regrava o contrato (subir a versão à mão antes)
 *
 * O teste src/tests/api-publica.test.ts exige que todo arquivo do catálogo exista
 * e seja JSON válido; a diferença de chaves é mostrada por este script e
 * registrada na página /dados/api quando o contrato é regravado.
 */
import { readFileSync, readdirSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";

const raiz = new URL("../", import.meta.url).pathname;
const GOLD = join(raiz, "public/obs/data/gold");
const CONTRATO = join(raiz, "docs/api/contrato-gold.json");
const DIRETORIOS = { inst: "Ficha por instituição (código IF.data)", cmp: "Comparador por instituição", pano: "Panorama por recorte", prod: "Produto de crédito" };

const chaves = (p) => {
  const j = JSON.parse(readFileSync(p, "utf-8"));
  return j && typeof j === "object" && !Array.isArray(j) ? Object.keys(j).sort() : [];
};

export function lerGoldAtual() {
  const arquivos = readdirSync(GOLD)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => ({ arquivo: f, bytes: statSync(join(GOLD, f)).size, chaves: chaves(join(GOLD, f)) }));
  const diretorios = Object.entries(DIRETORIOS).map(([dir, descricao]) => {
    const fs = readdirSync(join(GOLD, dir)).filter((f) => f.endsWith(".json")).sort();
    let comuns = null;
    for (const f of fs.slice(0, 200)) {
      const k = new Set(chaves(join(GOLD, dir, f)));
      comuns = comuns ? new Set([...comuns].filter((x) => k.has(x))) : k;
    }
    return { diretorio: dir, padrao: `${dir}/{codigo}.json`, descricao, quantidade: fs.length, chaves: [...(comuns ?? [])].sort() };
  });
  const outros = readdirSync(GOLD).filter((f) => !f.endsWith(".json") && !statSync(join(GOLD, f)).isDirectory()).sort();
  return { arquivos, diretorios, outros };
}

function main() {
  const atual = lerGoldAtual();
  const contrato = JSON.parse(readFileSync(CONTRATO, "utf-8"));
  if (process.argv.includes("--gravar")) {
    writeFileSync(CONTRATO, JSON.stringify({ ...contrato, ...atual, arquivos: atual.arquivos.map(({ arquivo, chaves }) => ({ arquivo, chaves })) }, null, 1) + "\n");
    console.log(`contrato regravado: ${atual.arquivos.length} arquivos, ${atual.diretorios.length} diretórios (versão ${contrato.versao})`);
    return;
  }
  const porNome = new Map(atual.arquivos.map((a) => [a.arquivo, a]));
  let diferencas = 0;
  for (const c of contrato.arquivos) {
    const a = porNome.get(c.arquivo);
    if (!a) { console.log(`- ${c.arquivo}: SUMIU (quebra)`); diferencas++; continue; }
    const saiu = c.chaves.filter((k) => !a.chaves.includes(k));
    const entrou = a.chaves.filter((k) => !c.chaves.includes(k));
    if (saiu.length) { console.log(`- ${c.arquivo}: chaves removidas (quebra): ${saiu.join(", ")}`); diferencas++; }
    if (entrou.length) console.log(`+ ${c.arquivo}: chaves novas: ${entrou.join(", ")}`);
  }
  for (const a of atual.arquivos) if (!contrato.arquivos.some((c) => c.arquivo === a.arquivo)) console.log(`+ ${a.arquivo}: arquivo novo`);
  console.log(diferencas ? `${diferencas} quebra(s) em relação à versão ${contrato.versao}` : `sem quebra em relação à versão ${contrato.versao}`);
}

if (process.argv[1] && process.argv[1].endsWith("contrato-gold.mjs")) main();
