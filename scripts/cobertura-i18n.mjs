/** Inventário inicial: candidatos textuais não são traduções nem chaves catalogadas.
 * Uso: node scripts/cobertura-i18n.mjs [--check | --stdout | --gold | --comparar <arquivo>]
 *   sem argumento  grava o relatório de código em docs/i18n/cobertura.json (local, gitignorado)
 *   --check        gera o relatório em memória e aplica todas as validações; não lê nem grava arquivo
 *   --stdout       imprime o relatório de código
 *   --comparar     falha se o relatório atual diferir, byte a byte, do arquivo informado
 *   --gold         diagnóstico dos dados, sem gravar nada
 *
 * Até 22/10/2026 o relatório era versionado e o --check comparava os bytes com ele. Toda mudança
 * de texto em src/ exigia regenerá-lo, e todo merge entre branches conflitava nele: 34 dos 300
 * últimos commits do main eram só "Inventário de tradução regenerado". As validações (fonte nova
 * sem domínio, sintaxe não analisável, catálogo, glossário, rotas, terminologia e uso declarados)
 * moram na geração e continuam no CI pelo --check; o relatório para leitura sai como artefato do
 * CI e pelo --stdout.
 */
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { analisarCodigo, analisarHtml, analisarJson } from "./i18n/analise.mjs";
import { descobrirFontes } from "./i18n/fontes.mjs";
import { lerGlossario } from "./i18n/glossario.mjs";
import { lerCatalogo } from "./i18n/catalogo.mjs";
import { lerTerminologia } from "./i18n/terminologia.mjs";
import { criarContextoProdutos, REGISTRO_PRODUTOS } from "./i18n/produtos.mjs";
import { caminhoDaPaginaLiteral, validarRotasLiterais } from "./i18n/rotas.mjs";
import { validarUsoInterface } from "./i18n/usos.mjs";

const RAIZ = fileURLToPath(new URL("../", import.meta.url));
const INVENTARIO = "config/i18n-inventario.json";
const RELATORIO = "docs/i18n/cobertura.json";
const GLOSSARIO = "config/glossario-en.json";
const TERMINOLOGIA = "config/i18n-terminologia.json";
const DICIONARIOS = { pt: "src/i18n/pt.ts", en: "src/i18n/en.ts" };
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
    rotas: { paginas_pt: 0, paginas_en: 0, handlers: 0, templates_com_parametros: 0,
      paginas_pt_literais: 0, paginas_pt_fora_do_adaptador: 0, paginas_pt_literais_sem_irma: 0,
      pares_estruturais: 0, fallbacks_declarados: 0, paridade_verificada: false },
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
        if (!inglesa) {
          if (caminhoDaPaginaLiteral(fonte.path) !== null) {
            d.rotas.paginas_pt_literais++;
            d.rotas.paginas_pt_literais_sem_irma++;
          } else d.rotas.paginas_pt_fora_do_adaptador++;
        }
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
  for (const path of ["public/obs/i18n/en.json", "public/i18n/en", "src/app/[lang]"]) {
    if (existsSync(join(raiz, path))) throw new Error(`A cobertura inicial precisa integrar o catálogo e as rotas antes de medir ${path}`);
  }
  const manifesto = JSON.parse(readFileSync(join(raiz, INVENTARIO), "utf8"));
  const leituraGlossario = resumirGlossario(raiz, manifesto);
  const glossario = leituraGlossario?.resumo;
  const leituraCatalogo = resumirCatalogo(raiz, manifesto);
  const catalogo = leituraCatalogo?.resumo;
  const terminologia = resumirTerminologia(raiz, manifesto, leituraCatalogo, leituraGlossario);
  const fontes = descobrirFontes(raiz, manifesto, { apenasCodigo: true });
  if (leituraGlossario?.exigeRegistroProdutos && !fontes.ui.some((fonte) => fonte.path === REGISTRO_PRODUTOS)) {
    throw new Error(`A origem dos nomes de produtos deve estar classificada como interface: ${REGISTRO_PRODUTOS}.`);
  }
  if (catalogo) {
    // O par validado tem hashes e métricas próprios, sem inflar candidatos de UI.
    for (const grupo of ["ui", "gold", "conteudo", "naoClassificadas", "excluidas"]) {
      fontes[grupo] = fontes[grupo].filter((fonte) => !Object.values(DICIONARIOS).includes(fonte.path));
    }
  }
  const irmas = validarRotasLiterais(raiz, manifesto, fontes);
  const uso = validarUsoInterface(manifesto, irmas, leituraCatalogo?.en ?? {});
  if (irmas) {
    const dominiosEn = new Map(irmas.pares.map((par) => [par.fontes.en, par.dominio]));
    fontes.ui = fontes.ui.map((fonte) => ({ ...fonte, dominio: dominiosEn.get(fonte.path) ?? fonte.dominio }));
  }
  const relatorio = somenteCodigo(construirRelatorio(manifesto, fontes, (path) => readFileSync(join(raiz, path))));
  if (catalogo) {
    relatorio.etapa = "inventario_com_catalogo_de_infraestrutura";
    relatorio.interpretacao.zeros = "Zeros de interface e gold indicam ausência de tradução comprovada no consumidor; mensagens disponíveis no catálogo são contadas separadamente.";
  }
  if (irmas) {
    relatorio.etapa = "inventario_com_irmas_literais_declaradas";
    relatorio.interpretacao.rotas = "Arquivos e pares literais presentes no código. Fallbacks são declarações, sem prova de HTML, autorização ou implantação; parâmetros, grupos e handlers continuam fora do adaptador.";
    for (const par of irmas.pares) {
      const rotas = relatorio.dominios[par.dominio].rotas;
      rotas.pares_estruturais++;
      if (par.conteudo_declarado === "portugues_marcado") rotas.fallbacks_declarados++;
      rotas.paginas_pt_literais_sem_irma--;
    }
  }
  if (uso) {
    relatorio.etapa = "inventario_com_uso_de_interface_declarado";
    relatorio.interpretacao.zeros = "Catálogo disponível, uso declarado e HTML verificado são fatos distintos. No domínio com uso declarado, contadores de comprovação são null; os demais zeros preservam a ausência de comprovação no inventário.";
    relatorio.interpretacao.uso_interface = "Chaves e regiões declaradas por rota, com catálogo validado. O inventário não renderiza HTML: a prova DOM deve conferir cada ID e uso declarado. Regiões portuguesas não catalogadas permanecem pendências, sem percentual de tradução.";
    for (const dominio of new Set(uso.rotas.map((rota) => rota.dominio))) {
      const d = relatorio.dominios[dominio];
      d.interface.chaves_catalogadas = Object.fromEntries(Object.keys(d.interface.chaves_catalogadas).map((chave) => [chave, null]));
      d.rotas.parciais_declarados = uso.rotas.filter((rota) => rota.dominio === dominio).length;
    }
  }
  return { ...relatorio, ...(glossario ? { glossario } : {}), ...(catalogo ? { catalogo } : {}),
    ...(terminologia ? { terminologia_catalogo: terminologia } : {}),
    ...(irmas ? { irmas_declaradas: irmas } : {}), ...(uso ? { uso_interface_declarado: uso } : {}) };
}

/** Catálogo disponível não comprova tradução ou marcador no HTML. */
function resumirCatalogo(raiz, manifesto) {
  const declaracao = manifesto.catalogo;
  if (!declaracao && !Object.values(DICIONARIOS).some((path) => existsSync(join(raiz, path)))) return null;
  if (!declaracao || declaracao.schema_version !== 1 || declaracao.dominio !== "plataforma"
    || declaracao.pt !== DICIONARIOS.pt || declaracao.en !== DICIONARIOS.en
    || Object.keys(declaracao).sort().join(",") !== "dominio,en,pt,schema_version"
    || !manifesto.dominios.some((d) => d.id === declaracao.dominio)) {
    throw new Error("O inventário deve declarar o catálogo único de infraestrutura em src/i18n/pt.ts e src/i18n/en.ts.");
  }
  const base = realpathSync(raiz);
  const bytes = {};
  /** @type {Record<string, { path: string, sha256: string }>} */
  const arquivos = {};
  for (const [idioma, path] of Object.entries(DICIONARIOS)) {
    if (!realpathSync(join(raiz, path)).startsWith(base + sep)) throw new Error("Dicionário fora do repositório.");
    bytes[idioma] = readFileSync(join(raiz, path));
    arquivos[idioma] = { path, sha256: sha(bytes[idioma]) };
  }
  const { pt, en } = lerCatalogo(bytes.pt.toString("utf8"), bytes.en.toString("utf8"));
  const entradas = Object.values(en);
  const resumo = {
    schema_version: 1,
    leitor_version: 1,
    dominio: declaracao.dominio,
    arquivos,
    chaves: Object.keys(pt).length,
    traducoes_disponiveis: entradas.filter((e) => e.estado === "traduzido").length,
    portugues_marcado_declarado: entradas.filter((e) => e.estado === "portugues_marcado").length,
    uso_na_interface_verificado: false,
  };
  return { resumo, pt, en };
}

/** Termos documentados não equivalem a chaves traduzidas ou uso já comprovado. */
function resumirGlossario(raiz, manifesto) {
  const path = join(raiz, GLOSSARIO);
  if (!manifesto.glossario && !existsSync(path)) return null;
  if (manifesto.glossario !== GLOSSARIO) throw new Error(`O inventário deve declarar o glossário único em ${GLOSSARIO}.`);
  const base = realpathSync(raiz);
  if (!realpathSync(path).startsWith(base + sep)) throw new Error("Glossário fora do repositório.");
  const bytes = readFileSync(path);
  const g = lerGlossario(bytes.toString("utf8"), criarContextoProdutos(raiz));
  const entradas = Object.values(g.entradas);
  const resumo = {
    path: GLOSSARIO,
    sha256: sha(bytes),
    fontes: Object.keys(g.fontes).length,
    termos: entradas.filter((e) => e.tipo === "termo").length,
    nomes_preservados: entradas.filter((e) => e.tipo === "nome_proprio" || e.tipo === "nome_proprio_produto").length,
    pendencias: g.pendencias.map(({ id, pt, depende_de }) => ({ id, pt, depende_de }))
      .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    uso_na_interface_verificado: false,
    uso_no_pipeline_verificado: false,
  };
  return { resumo, g, exigeRegistroProdutos: entradas.some((e) => e.tipo === "nome_proprio_produto") };
}

/** Confere o contrato revisado sem reler ou executar os catálogos e o glossário. */
function resumirTerminologia(raiz, manifesto, leituraCatalogo, leituraGlossario) {
  const declaracao = manifesto.terminologia_catalogo;
  const path = join(raiz, TERMINOLOGIA);
  // lstat também detecta symlink quebrado: presença sem declaração não é ausência.
  const presente = lstatSync(path, { throwIfNoEntry: false }) !== undefined;
  if (declaracao === undefined && !presente) return null;
  if (declaracao !== TERMINOLOGIA) {
    throw new Error(`O inventário deve declarar a terminologia do catálogo em ${TERMINOLOGIA}.`);
  }
  if (!leituraCatalogo || !leituraGlossario) {
    throw new Error("A terminologia do catálogo exige catálogo e glossário validados no inventário.");
  }
  const base = realpathSync(raiz);
  const real = realpathSync(path);
  if (!real.startsWith(base + sep) || !statSync(real).isFile()) {
    throw new Error("Terminologia do catálogo deve ser arquivo dentro do repositório.");
  }
  const bytes = readFileSync(real);
  const metricas = lerTerminologia(bytes.toString("utf8"),
    { pt: leituraCatalogo.pt, en: leituraCatalogo.en }, leituraGlossario.g);
  return { path: TERMINOLOGIA, sha256: sha(bytes), ...metricas };
}

/** Retira métricas de dados: zero seria uma declaração falsa de cobertura da gold. */
export function somenteCodigo(relatorio) {
  relatorio.schema_version = 2;
  relatorio.escopo.tipo = "fontes_de_codigo";
  delete relatorio.escopo.materializados;
  delete relatorio.interpretacao.campos_gold;
  relatorio.interpretacao.gold = "Dados não participam deste relatório nem do --check. Execute --gold para a situação atual, não versionada.";
  for (const dominio of Object.values(relatorio.dominios)) delete dominio.gold;
  return relatorio;
}

/** Diagnóstico pontual. Não é gravado em docs/i18n/cobertura.json e não bloqueia a publicação de dados. */
export function gerarCoberturaGold(raiz = RAIZ) {
  const manifesto = JSON.parse(readFileSync(join(raiz, INVENTARIO), "utf8"));
  const fontes = descobrirFontes(raiz, manifesto);
  const relatorio = construirRelatorio(manifesto, { ...fontes, ui: [], conteudo: [] }, (path) => readFileSync(join(raiz, path)));
  return {
    schema_version: 1,
    natureza: "diagnostico_gold_nao_versionado",
    interpretacao: "Campos não catalogados são pendências, não traduções. A ausência de catálogo não comprova inglês nem fallback no consumidor.",
    escopo: relatorio.escopo,
    dominios: Object.fromEntries(Object.entries(relatorio.dominios).map(([id, dominio]) => [id, dominio.gold])),
  };
}

export function serializarRelatorio(relatorio) {
  return JSON.stringify(relatorio, null, 2) + "\n";
}

const USO = "Uso: node scripts/cobertura-i18n.mjs [--check | --stdout | --gold | --comparar <arquivo>]";

export function executar(argumentos, raiz = RAIZ) {
  const [modo, ...resto] = argumentos;
  const simples = argumentos.length <= 1 && (modo === undefined || ["--check", "--stdout", "--gold"].includes(modo));
  const comparar = modo === "--comparar" && resto.length === 1 && !resto[0].startsWith("--");
  if (!simples && !comparar) throw new Error(USO);
  if (modo === "--gold") return serializarRelatorio(gerarCoberturaGold(raiz));
  const relatorio = gerarCobertura(raiz);
  const texto = serializarRelatorio(relatorio);
  if (modo === "--stdout") return texto;
  if (modo === "--check") {
    return `Cobertura i18n gerada e validada a partir de ${relatorio.escopo.arquivos_analisados} fontes de código.\n`;
  }
  if (comparar) {
    const alvo = resolve(raiz, resto[0]);
    if (!existsSync(alvo) || readFileSync(alvo, "utf8") !== texto) {
      throw new Error(`Cobertura desatualizada em relação a ${resto[0]}. Para regravar o relatório local: node scripts/cobertura-i18n.mjs.`);
    }
    return `Cobertura i18n confere com ${resto[0]}.\n`;
  }
  const destino = join(raiz, RELATORIO);
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, texto);
  return `Relatório gravado em ${RELATORIO} (local, fora do git).\n`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.stdout.write(executar(process.argv.slice(2))); }
  catch (erro) { console.error(erro.message); process.exitCode = 1; }
}
