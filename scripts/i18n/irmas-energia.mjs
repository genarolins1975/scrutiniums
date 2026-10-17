#!/usr/bin/env node
/**
 * Irmãs inglesas do Setor Elétrico: para cada src/app/setor-eletrico/**\/page.tsx, escreve
 * src/app/en/setor-eletrico/**\/page.tsx, que reexporta a página portuguesa. O idioma vem do
 * endereço (idiomaEnergia em src/lib/energia/idioma.ts). Nenhum cálculo é duplicado: a irmã só
 * copia as configurações de segmento como literais (o Next exige) e reexporta os parâmetros.
 *
 * Uso: node scripts/i18n/irmas-energia.mjs            grava as irmãs e a declaração no inventário
 *      node scripts/i18n/irmas-energia.mjs --check    falha se algo estiver diferente do gerado
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PT = join(RAIZ, "src/app/setor-eletrico");
const EN = join(RAIZ, "src/app/en/setor-eletrico");
const INVENTARIO = join(RAIZ, "config/i18n-inventario.json");
const conferir = process.argv.includes("--check");

function paginas(dir) {
  const saida = [];
  for (const nome of readdirSync(dir).sort()) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) saida.push(...paginas(p));
    else if (nome === "page.tsx") saida.push(p);
  }
  return saida;
}

const CONFIG = ["dynamic", "dynamicParams", "revalidate", "fetchCache", "runtime", "preferredRegion"];

function irma(arquivoPt) {
  const fonte = readFileSync(arquivoPt, "utf8");
  const rel = relative(join(RAIZ, "src/app"), arquivoPt).replace(/\/page\.tsx$/, "");
  const caminho = `/${rel}`;
  const modulo = `@/app/${rel}/page`;
  const config = [];
  for (const nome of CONFIG) {
    const m = new RegExp(`^export const ${nome}\\s*=\\s*([^;\\n]+);`, "m").exec(fonte);
    if (m) config.push(`export const ${nome} = ${m[1].trim()};`);
  }
  if (!/^export (async )?function generateMetadata\b/m.test(fonte)) {
    throw new Error(`${caminho}: a página portuguesa precisa exportar generateMetadata com metadadosEnergia (ver docs/i18n/ENERGIA.md).`);
  }
  if (!/metadadosEnergia\(/.test(fonte)) throw new Error(`${caminho}: generateMetadata não passa por metadadosEnergia.`);
  const parametros = /^export (async )?function generateStaticParams\b/m.test(fonte);
  const linhas = [
    `// Gerado por scripts/i18n/irmas-energia.mjs a partir de src/app/${rel}/page.tsx. Não editar à mão.`,
    `// A página e os metadados são os portugueses; o idioma vem do endereço (/en), lido por idiomaEnergia().`,
    `export { default, generateMetadata${parametros ? ", generateStaticParams" : ""} } from "${modulo}";`,
    ``,
    ...config,
    ``,
  ];
  return { caminho, destino: join(EN, relative(PT, arquivoPt)), conteudo: linhas.join("\n"), padrao: caminho.includes("[") };
}

const irmas = paginas(PT).map(irma);
const divergentes = [];
for (const i of irmas) {
  const atual = existsSync(i.destino) ? readFileSync(i.destino, "utf8") : null;
  if (atual === i.conteudo) continue;
  if (conferir) divergentes.push(relative(RAIZ, i.destino));
  else {
    mkdirSync(dirname(i.destino), { recursive: true });
    writeFileSync(i.destino, i.conteudo);
  }
}
// irmã sem página portuguesa correspondente
const esperadas = new Set(irmas.map((i) => i.destino));
const sobras = existsSync(EN) ? paginas(EN).filter((p) => !esperadas.has(p)) : [];
for (const p of sobras) divergentes.push(`${relative(RAIZ, p)} (sem página portuguesa)`);

// declaração no inventário: literais e padrões do Setor Elétrico como "traduzido"
const inventario = JSON.parse(readFileSync(INVENTARIO, "utf8"));
const outrosLiterais = inventario.rotas.literais.filter((r) => !r.pt.startsWith("/setor-eletrico"));
const outrosPadroes = (inventario.rotas.padroes ?? []).filter((r) => !r.pt.startsWith("/setor-eletrico"));
const ordem = (a, b) => (a.pt < b.pt ? -1 : a.pt > b.pt ? 1 : 0);
const rotas = {
  schema_version: inventario.rotas.schema_version,
  literais: [...outrosLiterais, ...irmas.filter((i) => !i.padrao).map((i) => ({ pt: i.caminho, conteudo: "traduzido" }))].sort(ordem),
  padroes: [...outrosPadroes, ...irmas.filter((i) => i.padrao).map((i) => ({ pt: i.caminho, conteudo: "traduzido" }))].sort(ordem),
};
// reescreve só o bloco "rotas", no formato do arquivo (uma rota por linha); o resto fica intacto
const texto = readFileSync(INVENTARIO, "utf8");
const linha = (r) => `      { "pt": ${JSON.stringify(r.pt)}, "conteudo": ${JSON.stringify(r.conteudo)} }`;
const bloco = [
  `  "rotas": {`,
  `    "schema_version": ${rotas.schema_version},`,
  `    "literais": [`,
  rotas.literais.map(linha).join(",\n"),
  `    ],`,
  `    "padroes": [`,
  rotas.padroes.map(linha).join(",\n"),
  `    ]`,
  `  },`,
].join("\n");
const inicio = texto.indexOf(`  "rotas": {`);
const fim = texto.indexOf(`\n  },\n`, inicio) + `\n  },`.length;
if (inicio < 0 || fim < inicio) throw new Error("Bloco rotas não encontrado no inventário.");
const serializado = texto.slice(0, inicio) + bloco + texto.slice(fim);
JSON.parse(serializado);
if (texto !== serializado) {
  if (conferir) divergentes.push("config/i18n-inventario.json (rotas do Setor Elétrico)");
  else writeFileSync(INVENTARIO, serializado);
}

if (conferir) {
  if (divergentes.length) {
    console.error(`Irmãs do Setor Elétrico desatualizadas; rode node scripts/i18n/irmas-energia.mjs:\n${divergentes.join("\n")}`);
    process.exit(1);
  }
  console.log(`${irmas.length} irmãs inglesas do Setor Elétrico conferem com as páginas portuguesas.`);
} else console.log(`${irmas.length} irmãs inglesas do Setor Elétrico gravadas.`);
