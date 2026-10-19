/**
 * Conteúdo da página estática de metodologia do Crédito (/observatorio-do-credito/metodologia), a mesma da vista
 * "Metodologia e fontes" da aplicação de página única (renderMethod em public/obs/app.js).
 *
 * Nada é reescrito à mão. Duas origens:
 * 1. As golds do pipeline que a vista da SPA lê (method, quality, pulse, lineage, ibcc e meta), com os mesmos campos.
 * 2. Os poucos textos fixos que a SPA escreve no próprio código (classificação dos selos, regras metodológicas,
 *    nomes das inadimplências, nota das réguas de carteira e o glossário), extraídos do app.js no build por expressões
 *    estritas. Se a SPA mudar a forma desses trechos, o extrator devolve null e o teste credito-consultas falha, em
 *    vez de a página divergir em silêncio.
 *
 * Só no servidor, no build (a página é estática).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

/* eslint-disable @typescript-eslint/no-explicit-any -- golds sem tipos gerados; os campos usados são os da vista da SPA */
function lerGold(nome: string): any {
  try {
    return JSON.parse(readFileSync(join(process.cwd(), "public", "obs", "data", "gold", `${nome}.json`), "utf-8"));
  } catch {
    return null;
  }
}

function lerApp(): string {
  try {
    return readFileSync(join(process.cwd(), "public", "obs", "app.js"), "utf-8");
  } catch {
    return "";
  }
}

/** Decodifica um literal de string JS entre aspas duplas (o subconjunto que coincide com JSON). */
function literal(s: string): string | null {
  try {
    return JSON.parse(s) as string;
  } catch {
    return null;
  }
}

/** Corpo da função renderMethod da SPA, de onde saem os textos fixos da vista. */
export function corpoRenderMethod(app: string): string | null {
  const ini = app.indexOf("function renderMethod() {");
  if (ini < 0) return null;
  const fim = app.indexOf("\n}\n", ini);
  return fim < 0 ? null : app.slice(ini, fim);
}

/** Rótulos dos selos (const BADGES da SPA): observado → "DADO OBSERVADO". */
export function extrairSelos(app: string): Record<string, string> | null {
  const m = app.match(/const BADGES = \{([\s\S]*?)\};/);
  if (!m) return null;
  const pares = Array.from(m[1].matchAll(/(\w+): \["\w+", ("[^"]+")\]/g)).map((x) => [x[1], literal(x[2])] as const);
  if (pares.length === 0 || pares.some(([, v]) => v === null)) return null;
  return Object.fromEntries(pares) as Record<string, string>;
}

export type ClasseEpistemologica = { selo: string; rotulo: string; texto: string };

/** "Classificação epistemológica": um parágrafo por selo, na ordem da SPA. */
export function extrairClassificacao(app: string): ClasseEpistemologica[] | null {
  const corpo = corpoRenderMethod(app);
  const selos = extrairSelos(app);
  if (!corpo || !selos) return null;
  const itens = Array.from(corpo.matchAll(/<p>\$\{badge\("(\w+)"\)\} ([^<$`]+)<\/p>/g)).map((x) => ({ selo: x[1], rotulo: selos[x[1]], texto: x[2].trim() }));
  if (itens.length === 0 || itens.some((i) => !i.rotulo)) return null;
  return itens;
}

/** "Regras metodológicas aplicadas", com o total de revisões registradas na linhagem no lugar da interpolação. */
export function extrairRegras(app: string, revisoes: number): string | null {
  const corpo = corpoRenderMethod(app);
  const m = corpo?.match(/<h4>Regras metodológicas aplicadas<\/h4>\s*<p class="src">([\s\S]*?)<\/p>/);
  if (!m) return null;
  const texto = m[1].replace("${lineage ? lineage.n_revisoes_total : 0}", revisoes.toLocaleString("pt-BR"));
  return /[$<>`{}]/.test(texto) ? null : texto.trim();
}

/** Nota que fecha o verbete das réguas de carteira (verbetesCarteiraIF). */
export function extrairNotaReguas(app: string): string | null {
  const ini = app.indexOf("function verbetesCarteiraIF(");
  if (ini < 0) return null;
  const m = app.slice(ini, app.indexOf("\n}\n", ini)).match(/<p class="src" style="margin-top:6px">([^<$`]+)<\/p>/);
  return m ? m[1].trim() : null;
}

export type Verbete = { termo: string; definicao: string };

/** Glossário da SPA (const GLOSSARIO): termo e definição, na ordem do código. */
export function extrairGlossario(app: string): Verbete[] | null {
  const ini = app.indexOf("const GLOSSARIO = [");
  if (ini < 0) return null;
  const bloco = app.slice(ini, app.indexOf("\n];", ini));
  const linhas = bloco.split("\n").filter((l) => /^\s*\{ t: /.test(l));
  const itens = linhas.map((l) => {
    const m = l.match(/^\s*\{ t: ("(?:[^"\\]|\\.)*"), re: "(?:[^"\\]|\\.)*", d: ("(?:[^"\\]|\\.)*") \},?\s*$/);
    const termo = m ? literal(m[1]) : null;
    const definicao = m ? literal(m[2]) : null;
    return termo && definicao ? { termo, definicao } : null;
  });
  if (itens.length === 0 || itens.some((i) => i === null)) return null;
  return itens as Verbete[];
}

export type Metodologia = {
  geradoEm: string | null;
  classificacao: ClasseEpistemologica[] | null;
  regras: string | null;
  ibcc: { metodo: string; limitacoes: string } | null;
  inadimplencias: { id: string; nome: string; definicao: string; valor: number | null; ref: string | null }[];
  carteiras: { id: string; nome: string; definicao: string; valorBi: number; ref: string | null }[];
  contagens: { id: string; definicao: string; n: number; ref: string | null }[];
  notaReguas: string | null;
  catalogo: {
    chave: string;
    nome: string;
    fonte: string;
    codigo: string | null;
    url: string | null;
    freq: string | null;
    unidade: string | null;
    ultimaRef: string | null;
    dias: number | null;
    obs: number | null;
    revisoes: number | null;
    score: number;
    componentes: Record<string, number>;
  }[];
  dicionario: Record<string, string>[];
  modelCards: any[];
  scoreCards: any[];
  versoes: { versao: string; data: string; mudancas: string[] }[];
  linhagemRecente: { gold_object: string; bronze_file: string; sha256: string; transform: string; created_at: string }[];
  mapa: { gerado_de: string; metodo: string; resumo: any; objetos: { gold: string; produtores: string[]; fontes: string[]; depende_de: string[]; consumido_em: string[]; notas: string[] }[] } | null;
  glossario: Verbete[] | null;
};

/** Nomes curtos das três inadimplências (const INAD_DEFS da SPA). */
export function extrairNomesInad(app: string): Record<string, string> | null {
  const m = app.match(/const INAD_DEFS = \{([\s\S]*?)\};/);
  if (!m) return null;
  const pares = Array.from(m[1].matchAll(/(\w+): ("(?:[^"\\]|\\.)*")/g)).map((x) => [x[1], literal(x[2])] as const);
  if (pares.length === 0 || pares.some(([, v]) => v === null)) return null;
  return Object.fromEntries(pares) as Record<string, string>;
}

/** As três réguas de inadimplência da vista, na ordem dela. */
const ORDEM_INAD = ["sgs", "scr", "atraso15"];
const ORDEM_CARTEIRAS = ["sgs", "scr", "ampliado", "estban"];
const ORDEM_CONTAGENS = ["ifdata_resumo", "ifdata_qualquer_relatorio", "cadastro_sedes"];

/** Lê tudo o que a vista de metodologia da SPA mostra. Campos ausentes na gold ficam vazios, nunca inventados. */
export function metodologiaCredito(): Metodologia {
  const app = lerApp();
  const meta = lerGold("meta") ?? {};
  const quality = lerGold("quality") ?? {};
  const pulse = lerGold("pulse");
  const method = lerGold("method") ?? {};
  const lineage = lerGold("lineage");
  const ibcc = lerGold("ibcc");
  const series = pulse?.series ?? {};

  const ic = meta.inad_conceitos ?? {};
  const nomesInad = extrairNomesInad(app) ?? {};
  const cc = meta.carteira_conceitos ?? {};
  const ifc = meta.if_contagens ?? {};

  return {
    geradoEm: meta.gerado_em ?? null,
    classificacao: extrairClassificacao(app),
    regras: extrairRegras(app, lineage?.n_revisoes_total ?? 0),
    ibcc: ibcc?.metodo ? { metodo: ibcc.metodo, limitacoes: ibcc.limitacoes ?? "" } : null,
    inadimplencias: ORDEM_INAD.filter((k) => ic[k]).map((k) => ({ id: k, nome: nomesInad[k] ?? k, definicao: ic[k].def ?? "", valor: typeof ic[k].v === "number" ? ic[k].v : null, ref: ic[k].ref ?? null })),
    carteiras: ORDEM_CARTEIRAS.filter((k) => cc[k] && typeof cc[k].v === "number").map((k) => ({ id: k, nome: cc[k].nome, definicao: cc[k].def ?? "", valorBi: cc[k].v, ref: cc[k].ref ?? null })),
    contagens: ORDEM_CONTAGENS.filter((k) => ifc[k] && typeof ifc[k].n === "number").map((k) => ({ id: k, definicao: ifc[k].def ?? "", n: ifc[k].n, ref: ifc[k].ref ?? null })),
    notaReguas: extrairNotaReguas(app),
    catalogo: Object.entries(quality as Record<string, any>)
      .sort((a, b) => a[1].score - b[1].score)
      .map(([chave, q]) => {
        const m = series[chave]?.meta ?? null;
        return {
          chave,
          nome: q.nome,
          fonte: q.fonte,
          codigo: m?.series_code ?? null,
          url: m?.url ?? null,
          freq: m?.freq ?? null,
          unidade: m?.unit ?? null,
          ultimaRef: q.ultima_ref ?? null,
          dias: typeof q.dias_sem_atualizar === "number" ? q.dias_sem_atualizar : null,
          obs: typeof q.n_obs === "number" ? q.n_obs : null,
          revisoes: typeof q.n_revisoes === "number" ? q.n_revisoes : null,
          score: q.score,
          componentes: q.componentes ?? {},
        };
      }),
    dicionario: method.dicionario_indicadores ?? [],
    modelCards: method.model_cards ?? [],
    scoreCards: method.score_cards ?? [],
    versoes: method.changelog ?? [],
    linhagemRecente: (lineage?.linhagem_recente ?? []).slice(0, 20),
    mapa: lineage?.mapa ?? null,
    glossario: extrairGlossario(app),
  };
}
