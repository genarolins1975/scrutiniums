/** Inventário inicial: candidatos textuais não são traduções nem chaves catalogadas.
 * Uso: node scripts/cobertura-i18n.mjs [--check | --stdout]
 * --check só lê; saídas dos materializadores precisam existir previamente.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { analisarCodigo, analisarHtml, analisarJson } from "./i18n/analise.mjs";
import { descobrirFontes } from "./i18n/fontes.mjs";

const RAIZ = fileURLToPath(new URL("../", import.meta.url));
const INVENTARIO = "config/i18n-inventario.json";
const RELATORIO = "docs/i18n/cobertura.json";
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const porCaminho = (fontes) => [...fontes].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);

function somar(destino, valores) {
  for (const [chave, valor] of Object.entries(valores ?? {})) {
    if (!Number.isSafeInteger(valor) || valor < 0) throw new Error(`Contagem inválida: ${chave}`);
    destino[chave] = (destino[chave] ?? 0) + valor;
  }
}

function dominioVazio(nome) {
  return {
    nome,
    interface: {
      arquivos: 0,
      candidatos: {},
      exclusoes: {},
      scripts_embutidos: {},
      chaves_catalogadas: { traduzidas: 0, portugues_marcado: 0, sem_traducao: 0, nomes_preservados: 0 },
      candidatos_nao_catalogados: 0,
      percentual_traduzido: null,
    },
    rotas: { paginas_pt: 0, paginas_en: 0, handlers: 0, templates_com_parametros: 0, paridade_verificada: false },
    gold: {
      arquivos: 0,
      ocorrencias_textuais: 0,
      campos_candidatos_nao_catalogados: 0,
      strings_vazias: 0,
      campos_catalogados: { com_ingles: 0, sem_ingles: 0, hash_incompativel: 0 },
    },
    conteudo_adicional: { arquivos: 0, linhas_nao_vazias: 0, candidatos_nao_catalogados: 0, scripts_embutidos: {} },
    cobertura_completa: false,
  };
}

/** Recebe fontes descobertas e leitura injetável para testar sem executar a aplicação. */
export function construirRelatorio(manifesto, fontes, ler) {
  const dominios = Object.fromEntries(manifesto.dominios.map((d) => [d.id, dominioVazio(d.nome)]));
  const assinaturas = [];
  const assinaturasPendentes = [];
  const vistos = new Set();
  function carregar(fonte) {
    if (!dominios[fonte.dominio]) throw new Error(`Domínio desconhecido em ${fonte.path}`);
    if (vistos.has(fonte.path)) throw new Error(`Fonte contada duas vezes: ${fonte.path}`);
    vistos.add(fonte.path);
    const bytes = ler(fonte.path);
    assinaturas.push([fonte.path, fonte.dominio, sha(bytes)]);
    return bytes.toString("utf8");
  }
  for (const fonte of porCaminho(fontes.ui)) {
    const texto = carregar(fonte);
    const d = dominios[fonte.dominio];
    const a = fonte.formato === "html" ? analisarHtml(texto, fonte.path) : analisarCodigo(texto, fonte.path);
    if (a.errosSintaxe) throw new Error(`Sintaxe não analisada: ${fonte.path}`);
    d.interface.arquivos++;
    somar(d.interface.candidatos, a.candidatos);
    somar(d.interface.exclusoes, a.exclusoes);
    somar(d.interface.scripts_embutidos, a.scripts);
    d.interface.candidatos_nao_catalogados += a.totalCandidatos;
    if (fonte.path.startsWith("src/app/")) {
      const pagina = /\/page\.tsx?$/.test(fonte.path);
      const handler = /\/route\.tsx?$/.test(fonte.path);
      if (pagina) {
        const inglesa = /^src\/app\/(en|\[lang\])\//.test(fonte.path);
        d.rotas[inglesa ? "paginas_en" : "paginas_pt"]++;
      }
      if (handler) d.rotas.handlers++;
      if ((pagina || handler) && /\[[^\]]+\]/.test(fonte.path)) d.rotas.templates_com_parametros++;
    }
  }
  for (const fonte of porCaminho(fontes.gold)) {
    const a = analisarJson(JSON.parse(carregar(fonte)));
    const d = dominios[fonte.dominio].gold;
    d.arquivos++;
    d.ocorrencias_textuais += a.ocorrenciasStrings;
    d.campos_candidatos_nao_catalogados += a.camposCandidatos.length;
    d.strings_vazias += a.stringsVazias;
  }
  for (const fonte of porCaminho(fontes.conteudo)) {
    const texto = carregar(fonte);
    const d = dominios[fonte.dominio].conteudo_adicional;
    d.arquivos++;
    if (fonte.formato === "html") {
      const a = analisarHtml(texto, fonte.path);
      d.candidatos_nao_catalogados += a.totalCandidatos;
      somar(d.scripts_embutidos, a.scripts);
    }
    else if (fonte.formato === "json") d.candidatos_nao_catalogados += analisarJson(JSON.parse(texto)).camposCandidatos.length;
    else {
      const linhas = texto.split(/\r?\n/).filter((s) => s.trim()).length;
      d.linhas_nao_vazias += linhas;
      d.candidatos_nao_catalogados += linhas;
    }
  }
  // Ausência de extrator não equivale a ausência de mudança: também assinar
  // CSVs e outros arquivos pendentes, sem chamá-los de conteúdo catalogado.
  for (const fonte of porCaminho(fontes.naoClassificadas)) {
    assinaturasPendentes.push([fonte.path, sha(ler(fonte.path))]);
  }
  assinaturas.sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
  return {
    schema_version: 1,
    etapa: "inventario_inicial_sem_catalogacao",
    interpretacao: {
      candidatos: "Ocorrências mecânicas, incluindo nomes, códigos e texto técnico ainda sem classificação. Não equivalem a chaves de tradução.",
      campos_gold: "JSON Pointers por arquivo, com índices de arrays agrupados; chaves de objetos preservadas. Nenhuma string é declarada traduzível por heurística.",
      zeros: "Nenhuma chave ou campo foi catalogado neste estágio; zeros não significam ausência de pendências.",
      percentual: "Indisponível enquanto o inventário semântico e a comprovação dos marcadores não estiverem implementados.",
      rotas: "Contagem de arquivos e templates, não enumeração das URLs dinâmicas nem verificação da política de acesso.",
    },
    escopo: {
      inventario_sha256: sha(JSON.stringify(manifesto)),
      arquivos_analisados: assinaturas.length,
      fontes_sha256: sha(JSON.stringify(assinaturas)),
      pendencias_sha256: sha(JSON.stringify(assinaturasPendentes)),
      nao_classificadas: porCaminho(fontes.naoClassificadas),
      exclusoes: porCaminho(fontes.excluidas),
      materializados: fontes.materializados,
    },
    dominios,
  };
}

export function gerarCobertura(raiz = RAIZ) {
  // Este scanner inicial não pode continuar afirmando zero depois de surgirem traduções.
  for (const path of ["src/i18n/en.ts", "public/obs/i18n/en.json", "public/i18n/en", "src/app/en", "src/app/[lang]"]) {
    if (existsSync(join(raiz, path))) throw new Error(`A cobertura inicial precisa integrar o catálogo e as rotas antes de medir ${path}`);
  }
  const manifesto = JSON.parse(readFileSync(join(raiz, INVENTARIO), "utf8"));
  const fontes = descobrirFontes(raiz, manifesto);
  return construirRelatorio(manifesto, fontes, (path) => readFileSync(join(raiz, path)));
}

export function serializarRelatorio(relatorio) {
  return JSON.stringify(relatorio, null, 2) + "\n";
}

export function executar(argumentos, raiz = RAIZ) {
  if (argumentos.length > 1 || argumentos.some((a) => !["--check", "--stdout"].includes(a))) {
    throw new Error("Uso: node scripts/cobertura-i18n.mjs [--check | --stdout]");
  }
  const texto = serializarRelatorio(gerarCobertura(raiz));
  const destino = join(raiz, RELATORIO);
  if (argumentos.includes("--stdout")) return texto;
  if (argumentos.includes("--check")) {
    if (!existsSync(destino) || readFileSync(destino, "utf8") !== texto) {
      throw new Error("Cobertura desatualizada. Execute node scripts/cobertura-i18n.mjs e versione docs/i18n/cobertura.json.");
    }
    return "Cobertura i18n confere com o inventário atual.\n";
  }
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, texto);
  return `Relatório gravado em ${RELATORIO}.\n`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.stdout.write(executar(process.argv.slice(2))); }
  catch (erro) { console.error(erro.message); process.exitCode = 1; }
}
