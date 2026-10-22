/**
 * Classifica os arquivos alterados de um pull request para o CI decidir quais jobs rodam.
 *
 * Uso: node scripts/ci/classificar-mudancas.mjs [--base <ref>] [--head <ref>] [--evento <nome>]
 *
 * Até 22/10/2026 o CI era um único job serial de 20 a 21 minutos, com os testes Python
 * (3 min 46 s) e a verificação do Judiciário (3 min 46 s) rodando em todo PR, mesmo nos
 * que só mexiam numa página de outro tema. Este script publica saídas booleanas que ligam
 * esses jobs só quando a mudança os alcança. Em qualquer evento que não seja
 * `pull_request` (push no main, workflow_run do pipeline de dados, cron, dispatch) todas
 * as saídas são verdadeiras: o main segue integral.
 *
 * Como decide, sem lista manual de componentes:
 * - `judiciario` e `agro`: fecho de importações a partir das rotas que cada script de
 *   verificação realmente percorre (scripts/obee/judiciario-verificacao.mjs e
 *   scripts/agro/verificacao.mjs abrem também a home, o seletor de observatórios, a
 *   barra comum e a política de acesso das raízes). Um componente novo importado pelo
 *   cabeçalho entra no fecho sozinho; uma lista escrita à mão ficaria velha em silêncio.
 * - `python`: pipeline, pesquisa, dados, config, docs/obee e qualquer `.py`; dados em
 *   public/ (os testes Python conferem a gold publicada); e os caminhos de src/, config/
 *   e docs/ citados literalmente pelos próprios testes Python (test_vigilancia_frescor lê
 *   src/lib/frescor/limiares.json, test_eficiencia lê src/lib/eficiencia/indice-v4.ts).
 * - `interface` e `i18n`: informativas por enquanto (os jobs estático e Vitest sempre
 *   rodam); ficam no resumo do job para leitura e para uso futuro.
 * - Mudança no próprio workflow, em scripts/ci ou nos arquivos de que o build depende
 *   (package.json, lockfile, next.config.mjs, tailwind, postcss, tsconfig, fontes) liga
 *   tudo: é a única forma de validar a mudança de CI antes do merge.
 *
 * Em dúvida (diff indisponível, base não encontrada), tudo verdadeiro. O filtro só pode
 * errar para o lado de rodar a mais.
 */
import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync, readdirSync, statSync } from "node:fs";
import { posix } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = fileURLToPath(new URL("../../", import.meta.url));

/** Mudança aqui liga todos os jobs. */
export const INFRA_GERAL = [".github/workflows/ci.yml", "scripts/ci/"];

/** Mudança aqui altera o build do Next: liga as verificações de navegador (Judiciário, Agro). */
export const INFRA_BUILD = [
  "package.json", "package-lock.json", "next.config.mjs", "tailwind.config.ts",
  "postcss.config.mjs", "tsconfig.json", "src/fonts/", "src/app/globals.css",
];

/**
 * Raízes do fecho de importações e caminhos fora de src/ de cada verificação de navegador.
 * As raízes são as rotas, handlers e o middleware que o script correspondente exercita.
 */
export const VERIFICACOES = {
  judiciario: {
    raizes: [
      "src/app/eficiencia-estatal/judiciario", "src/app/eficiencia-estatal/acesso-justica",
      "src/app/eficiencia-estatal/page.tsx", "src/app/eficiencia-estatal/layout.tsx",
      "src/app/page.tsx", "src/app/sitemap.ts", "src/app/app", "src/app/api/auth", "src/app/entrar",
      "src/middleware.ts",
    ],
    caminhos: [
      "public/eficiencia/judiciario/", "public/home/judiciario-por-dentro.webp",
      "scripts/obee/judiciario-verificacao.mjs",
    ],
  },
  agro: {
    raizes: [
      "src/app/agronegocio", "src/app/api/agro", "src/app/api/telemetria",
      "src/app/page.tsx", "src/app/en/page.tsx", "src/app/app", "src/app/api/auth", "src/app/entrar",
      "src/middleware.ts",
    ],
    caminhos: [
      "public/agro/", "pipeline/agro/", "scripts/agro/", "docs/agro/",
      ".github/workflows/agro-interface.yml",
    ],
  },
};

/** Arquivos que o Next trata como parte do segmento, sem import explícito. */
const SEGMENTO_NEXT = ["layout", "template", "loading", "error", "not-found", "default", "global-error"];
const EXTENSOES_CODIGO = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".css"];
/** Em public/, o que não é dado é apresentação: não entra nos testes Python. */
const EXTENSOES_APRESENTACAO = new Set([
  ".html", ".css", ".js", ".svg", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".ico",
  ".woff", ".woff2", ".ttf", ".otf", ".avif", ".mp4", ".webm", ".pdf", ".xml", ".txt",
]);
const PASTAS_PYTHON = ["pipeline/", "pesquisa/", "docs/obee/", "scripts/"];

/** Acesso ao repositório injetável para testar com uma árvore sintética. */
export function sistemaDeArquivos(raiz = RAIZ) {
  const abs = (p) => posix.join(raiz, p);
  return {
    existe: (p) => { try { return statSync(abs(p)).isFile(); } catch { return false; } },
    ehPasta: (p) => { try { return statSync(abs(p)).isDirectory(); } catch { return false; } },
    ler: (p) => readFileSync(abs(p), "utf8"),
    listar: (p) => readdirSync(abs(p), { withFileTypes: true })
      .map((e) => ({ nome: e.name, pasta: e.isDirectory() })),
  };
}

export function extrairImports(texto) {
  const padroes = [
    /\bimport\s+(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g,
    /\bexport\s+(?:\*|\{[^}]*\})\s+from\s+['"]([^'"]+)['"]/g,
    /\b(?:import|require)\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  const vistos = new Set();
  for (const re of padroes) for (const m of texto.matchAll(re)) vistos.add(m[1]);
  return [...vistos];
}

/**
 * Resolve `@/x` e `./x` para um arquivo do repositório; pacotes externos devolvem null.
 * Importação com extensão explícita para fora de src/ (o Judiciário lê
 * public/eficiencia/judiciario/snapshot.json, o i18n-rotas lê config/i18n-inventario.json)
 * entra no fecho mesmo que o arquivo não esteja no checkout esparso do job de classificação:
 * o caminho basta para casar com a lista de alterados.
 */
export function resolver(especificador, arquivo, fs) {
  let base;
  if (especificador.startsWith("@/")) base = posix.join("src", especificador.slice(2));
  else if (especificador.startsWith(".")) base = posix.join(posix.dirname(arquivo), especificador);
  else return null;
  base = posix.normalize(base);
  const candidatos = [base, ...EXTENSOES_CODIGO.map((e) => base + e), ...EXTENSOES_CODIGO.map((e) => base + "/index" + e)];
  const achado = candidatos.find((c) => fs.existe(c));
  if (achado) return achado;
  if (!base.startsWith("src/") && !base.startsWith("..") && posix.extname(base)) return base;
  return null;
}

function arquivosDaPasta(pasta, fs) {
  const saida = [];
  for (const e of fs.listar(pasta)) {
    const p = posix.join(pasta, e.nome);
    if (e.pasta) saida.push(...arquivosDaPasta(p, fs));
    else saida.push(p);
  }
  return saida;
}

/** Layouts e arquivos de segmento dos ancestrais de uma rota em src/app. */
function segmentosNext(arquivo, fs) {
  const saida = [];
  if (!arquivo.startsWith("src/app/")) return saida;
  let dir = posix.dirname(arquivo);
  while (dir.startsWith("src/app")) {
    for (const nome of SEGMENTO_NEXT) for (const ext of [".tsx", ".ts", ".jsx", ".js"]) {
      const p = posix.join(dir, nome + ext);
      if (fs.existe(p)) saida.push(p);
    }
    if (dir === "src/app") break;
    dir = posix.dirname(dir);
  }
  return saida;
}

/** Fecho transitivo de importações a partir das raízes (arquivos ou pastas). */
export function fechoDeImportacoes(raizes, fs) {
  const fila = [];
  for (const r of raizes) {
    if (fs.ehPasta(r)) fila.push(...arquivosDaPasta(r, fs));
    else if (fs.existe(r)) fila.push(r);
  }
  const fecho = new Set();
  while (fila.length) {
    const arquivo = fila.pop();
    if (fecho.has(arquivo)) continue;
    fecho.add(arquivo);
    fila.push(...segmentosNext(arquivo, fs));
    if (!/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(arquivo) || !fs.existe(arquivo)) continue;
    for (const esp of extrairImports(fs.ler(arquivo))) {
      const alvo = resolver(esp, arquivo, fs);
      if (alvo && !fecho.has(alvo)) fila.push(alvo);
    }
  }
  return fecho;
}

/**
 * Caminhos de src/, config/ e docs/ citados literalmente pelos arquivos Python do repositório.
 * Nomes em src/tests/ ficam de fora: nos testes Python eles são fixtures sintéticas
 * (test_publicar_gold, test_testes_reprovados), e o job Python não executa o Vitest.
 */
export function literaisPython(fs) {
  const literais = new Set();
  const re = /['"]((?:src|config|docs)\/[A-Za-z0-9_][A-Za-z0-9_./-]*)/g;
  for (const pasta of PASTAS_PYTHON) {
    if (!fs.ehPasta(pasta)) continue;
    for (const arquivo of arquivosDaPasta(pasta, fs)) {
      if (!arquivo.endsWith(".py")) continue;
      for (const m of fs.ler(arquivo).matchAll(re)) {
        if (!m[1].includes("...") && !m[1].startsWith("src/tests/")) literais.add(m[1]);
      }
    }
  }
  return [...literais].sort();
}

const comecaCom = (arquivo, prefixos) => prefixos.some((p) => (p.endsWith("/") ? arquivo.startsWith(p) : arquivo === p));
const ehDadoPublico = (arquivo) => arquivo.startsWith("public/") && !EXTENSOES_APRESENTACAO.has(posix.extname(arquivo).toLowerCase());

/**
 * Decide as saídas a partir da lista de arquivos alterados.
 * `contexto`: { fechos: {judiciario: Set, agro: Set}, literais: string[] }.
 * Devolve { saidas: {nome: boolean}, motivos: {nome: string[]} } com até três arquivos por motivo.
 */
export function classificar(alterados, contexto) {
  const nomes = ["interface", "python", "judiciario", "agro", "i18n"];
  const motivos = Object.fromEntries(nomes.map((n) => [n, []]));
  const liga = (nome, arquivo) => { if (motivos[nome].length < 3) motivos[nome].push(arquivo); else if (!motivos[nome].includes("…")) motivos[nome].push("…"); };
  for (const arquivo of alterados) {
    if (comecaCom(arquivo, INFRA_GERAL)) { for (const n of nomes) liga(n, arquivo); continue; }
    if (comecaCom(arquivo, INFRA_BUILD)) { for (const n of ["interface", "judiciario", "agro"]) liga(n, arquivo); }
    if (arquivo.startsWith("src/") || /^scripts\/[^/]+\.mjs$/.test(arquivo) || (arquivo.startsWith("public/") && !ehDadoPublico(arquivo))) liga("interface", arquivo);
    if (arquivo.startsWith("src/") || arquivo.startsWith("config/i18n") || arquivo.startsWith("config/glossario")
      || arquivo.startsWith("docs/i18n/") || arquivo.startsWith("scripts/i18n/") || arquivo === "scripts/cobertura-i18n.mjs") liga("i18n", arquivo);
    if (arquivo.endsWith(".py") || arquivo.startsWith("pipeline/") || arquivo.startsWith("pesquisa/") || arquivo.startsWith("data/")
      || arquivo.startsWith("docs/obee/") || arquivo.startsWith("config/") || ehDadoPublico(arquivo)
      || contexto.literais.some((l) => arquivo.startsWith(l))) liga("python", arquivo);
    for (const nome of ["judiciario", "agro"]) {
      if (contexto.fechos[nome].has(arquivo) || comecaCom(arquivo, VERIFICACOES[nome].caminhos)) liga(nome, arquivo);
    }
  }
  const saidas = Object.fromEntries(nomes.map((n) => [n, motivos[n].length > 0]));
  return { saidas, motivos };
}

export function tudoVerdadeiro(motivo) {
  const nomes = ["interface", "python", "judiciario", "agro", "i18n"];
  return { saidas: Object.fromEntries(nomes.map((n) => [n, true])), motivos: Object.fromEntries(nomes.map((n) => [n, [motivo]])) };
}

export function arquivosAlterados(base, head, raiz = RAIZ) {
  const saida = execFileSync("git", ["diff", "--name-only", "--no-renames", base, head], { cwd: raiz, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return saida.split("\n").filter(Boolean);
}

function resumo(resultado, alterados) {
  const linhas = ["| Saída | Liga | Por quê |", "|---|---|---|"];
  for (const [nome, valor] of Object.entries(resultado.saidas)) {
    linhas.push(`| ${nome} | ${valor ? "sim" : "não"} | ${resultado.motivos[nome].map((m) => `\`${m}\``).join(", ") || "nenhum arquivo alcança este job"} |`);
  }
  return `### Classificação das mudanças (${alterados === null ? "sem diff" : `${alterados.length} arquivos`})\n\n${linhas.join("\n")}\n`;
}

export function executar(argv, env = process.env, raiz = RAIZ) {
  const opcao = (nome) => { const i = argv.indexOf(nome); return i >= 0 ? argv[i + 1] : undefined; };
  const evento = opcao("--evento") ?? env.GITHUB_EVENT_NAME ?? "local";
  const base = opcao("--base") ?? env.BASE_SHA;
  const head = opcao("--head") ?? "HEAD";
  let resultado, alterados = null;
  if (evento !== "pull_request" && evento !== "local") {
    resultado = tudoVerdadeiro(`evento ${evento}: suíte integral`);
  } else if (!base) {
    resultado = tudoVerdadeiro("base do diff não informada");
  } else {
    try { alterados = arquivosAlterados(base, head, raiz); }
    catch (erro) { resultado = tudoVerdadeiro(`diff indisponível (${String(erro.message).split("\n")[0].slice(0, 120)})`); }
    if (alterados) {
      const fs = sistemaDeArquivos(raiz);
      const fechos = Object.fromEntries(Object.entries(VERIFICACOES).map(([n, v]) => [n, fechoDeImportacoes(v.raizes, fs)]));
      resultado = classificar(alterados, { fechos, literais: literaisPython(fs) });
    }
  }
  const texto = resumo(resultado, alterados);
  if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, Object.entries(resultado.saidas).map(([n, v]) => `${n}=${v}\n`).join(""));
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, texto);
  return texto;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === posix.resolve(process.argv[1])) {
  try { process.stdout.write(executar(process.argv.slice(2))); }
  catch (erro) { console.error(erro.message); process.exitCode = 1; }
}
