import { LINKEDIN_URL } from "@/lib/contato";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  abaPorCaminho,
  PREFIXOS_DINAMICOS,
} from "@/lib/data/observatorioAbas";

/**
 * Metadados por rota do Observatório: resolve título, description,
 * canônico e dataset de cada caminho da SPA e injeta tudo no <head> de
 * public/obs/index.html. Vive fora do route handler para ser testável —
 * arquivos route.ts do App Router só podem exportar os campos do contrato.
 */

const BASE = "https://scrutiniums.com";
const NOME_PLATAFORMA = "Observatório Brasileiro de Crédito";

let shellCache: string | null = null;
function shell(): string {
  if (!shellCache) {
    shellCache = readFileSync(join(process.cwd(), "public", "obs", "index.html"), "utf-8");
  }
  return shellCache;
}

type InstIndex = { instituicoes: { cod: string; nome: string }[] };
let instCache: Map<string, string> | null = null;
function nomeInstituicao(cod: string): string | null {
  if (!instCache) {
    try {
      const idx = JSON.parse(
        readFileSync(join(process.cwd(), "public", "obs", "data", "gold", "inst_index.json"), "utf-8"),
      ) as InstIndex;
      instCache = new Map(idx.instituicoes.map((i) => [i.cod, i.nome]));
    } catch {
      instCache = new Map();
    }
  }
  return instCache.get(cod) ?? null;
}

type MunPresenca = {
  cod: string; nome: string; uf: string; classe: string;
  agencia: number; posto: number; pae: number; corresp: number;
  ifs_dep: number; ifs_corresp: number;
};
let munCache: Map<string, MunPresenca> | null = null;
function municipioPresenca(cod: string): MunPresenca | null {
  if (!munCache) {
    try {
      const g = JSON.parse(
        readFileSync(join(process.cwd(), "public", "obs", "data", "gold", "presenca_mun.json"), "utf-8"),
      ) as { municipios: MunPresenca[] };
      munCache = new Map(g.municipios.map((m) => [m.cod, m]));
    } catch {
      munCache = new Map();
    }
  }
  return munCache.get(cod) ?? null;
}

/**
 * Description da página municipal: a frase muda com a classe porque o que
 * NÃO existe no município é dito com todas as letras — a mesma regra
 * editorial da SPA (ausência nunca vira zero silencioso).
 */
function descricaoPresenca(m: MunPresenca): string {
  const n = (v: number, um: string, muitos: string) => `${v} ${v === 1 ? um : muitos}`;
  if (m.classe === "agencia") {
    return `${m.nome} (${m.uf}) tem ${n(m.agencia, "agência bancária", "agências bancárias")}, ` +
      `${n(m.posto, "posto de atendimento", "postos de atendimento")}, ` +
      `${n(m.pae, "posto eletrônico", "postos eletrônicos")} e ` +
      `${n(m.corresp, "ponto de correspondente", "pontos de correspondente")}, ` +
      `segundo os cadastros do Banco Central — presença física de ${m.ifs_dep} instituições financeiras.`;
  }
  if (m.classe === "posto") {
    return `${m.nome} (${m.uf}) não tem agência bancária: o atendimento presencial é feito por ` +
      `${n(m.posto, "posto de atendimento", "postos de atendimento")}, ` +
      `${n(m.pae, "posto eletrônico", "postos eletrônicos")} e ` +
      `${n(m.corresp, "ponto de correspondente", "pontos de correspondente")}, segundo os cadastros do Banco Central.`;
  }
  if (m.classe === "correspondente") {
    return `${m.nome} (${m.uf}) não tem agência nem posto bancário: o atendimento presencial existe apenas ` +
      `pelos ${n(m.corresp, "ponto de correspondente", "pontos de correspondente")} cadastrados no Banco Central.`;
  }
  return `${m.nome} (${m.uf}) não tem nenhum ponto físico de atendimento bancário cadastrado no Banco Central — ` +
    `nem agência, nem posto, nem correspondente.`;
}

type UfGold = { uf: string; nome: string; prep: string; regiao: string; sintese: string; scr: { data_base: string; saldo: number; inad: number } | null };
let ufCache: Map<string, UfGold> | null = null;
function unidadeFederacao(sigla: string): UfGold | null {
  if (!ufCache) {
    try {
      const g = JSON.parse(
        readFileSync(join(process.cwd(), "public", "obs", "data", "gold", "ufs.json"), "utf-8"),
      ) as { ufs: UfGold[] };
      ufCache = new Map((g.ufs || []).map((u) => [u.uf, u]));
    } catch {
      ufCache = new Map();
    }
  }
  return ufCache.get(sigla.toUpperCase()) ?? null;
}

let geradoEmCache: string | null | undefined;
function geradoEm(): string | null {
  if (geradoEmCache === undefined) {
    try {
      const meta = JSON.parse(
        readFileSync(join(process.cwd(), "public", "obs", "data", "gold", "meta.json"), "utf-8"),
      );
      geradoEmCache = typeof meta.gerado_em === "string" ? (meta.gerado_em as string) : null;
    } catch {
      geradoEmCache = null;
    }
  }
  return geradoEmCache ?? null;
}

function escapeHtml(v: string): string {
  return v
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const SLUG_SEGURO = /^[A-Za-z0-9_-]{1,80}$/;
function humanizarSlug(slug: string): string {
  return slug.replaceAll("-", " ").replaceAll("_", " ");
}

export type MetaObservatorio = {
  titulo: string;
  descricao: string;
  canonico: string;
  gold?: string;
  indexavel: boolean;
  status: number;
};

export function resolverMeta(caminho: string): MetaObservatorio {
  const padrao = {
    titulo: NOME_PLATAFORMA,
    descricao:
      "O crédito brasileiro explicado com rigor: carteira, inadimplência, produtos, instituições, mapa por UF e sinais antecedentes — fontes oficiais, metodologia aberta, acesso gratuito sem cadastro.",
    canonico: `${BASE}/observatorio`,
  };
  if (caminho === "/" || caminho === "") {
    return { ...padrao, indexavel: true, status: 200 };
  }

  const aba = abaPorCaminho(caminho);
  if (aba) {
    return {
      titulo: `${aba.titulo} · ${NOME_PLATAFORMA}`,
      descricao: aba.descricao,
      canonico: `${BASE}/observatorio${aba.caminho}`,
      gold: aba.gold,
      indexavel: true,
      status: 200,
    };
  }

  for (const d of PREFIXOS_DINAMICOS) {
    if (!caminho.startsWith(d.prefixo)) continue;
    const slug = caminho.slice(d.prefixo.length);
    if (!SLUG_SEGURO.test(slug)) break;
    if (d.view === "inst") {
      const nome = nomeInstituicao(slug);
      if (!nome) break;
      return {
        titulo: `${nome} — ${d.rotulo} · ${NOME_PLATAFORMA}`,
        descricao: `Capital, inadimplência, rentabilidade e carteira de crédito de ${nome}, com dados oficiais do IF.data/Banco Central e comparação com pares.`,
        canonico: `${BASE}/observatorio${d.prefixo}${slug}`,
        indexavel: true,
        status: 200,
      };
    }
    if (d.view === "presmun") {
      // código IBGE desconhecido = 404/noindex: só municípios do gold viram página
      const m = municipioPresenca(slug);
      if (!m) break;
      return {
        titulo: `Presença bancária em ${m.nome} (${m.uf}) — agências, postos e correspondentes · ${NOME_PLATAFORMA}`,
        descricao: descricaoPresenca(m),
        canonico: `${BASE}/observatorio${d.prefixo}${slug}`,
        gold: "presenca_mun.json",
        indexavel: true,
        status: 200,
      };
    }
    if (d.view === "estado") {
      // só as 27 siglas do gold viram página; qualquer outra coisa é 404/noindex
      const u = unidadeFederacao(slug);
      if (!u || slug !== u.uf) break;
      return {
        titulo: `Crédito ${u.prep} (${u.uf}) — carteira, inadimplência, penetração e presença bancária · ${NOME_PLATAFORMA}`,
        descricao: u.sintese || `O crédito ${u.prep}: carteira e inadimplência do SCR, penetração, presença bancária, Pix, moradia, consignado, crédito rural, BNDES e dívida ativa, com dados oficiais.`,
        canonico: `${BASE}/observatorio${d.prefixo}${slug}`,
        gold: "ufs.json",
        indexavel: true,
        status: 200,
      };
    }
    return {
      titulo: `${humanizarSlug(slug)} — ${d.rotulo} · ${NOME_PLATAFORMA}`,
      descricao: `Análise de ${humanizarSlug(slug)} na área ${d.rotulo} do ${NOME_PLATAFORMA}, com dados oficiais e metodologia aberta.`,
      canonico: `${BASE}/observatorio${d.prefixo}${slug}`,
      indexavel: true,
      status: 200,
    };
  }

  // Rota desconhecida: a SPA ainda renderiza (cai na visão geral), mas a
  // resposta declara 404 e noindex para não poluir o índice dos buscadores.
  return { ...padrao, indexavel: false, status: 404 };
}

function jsonLd(meta: MetaObservatorio): string {
  if (!meta.gold) return "";
  const dataset: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: meta.titulo,
    description: meta.descricao,
    url: meta.canonico,
    isAccessibleForFree: true,
    inLanguage: "pt-BR",
    creator: { "@type": "Organization", name: "Scrutiniums", url: BASE },
    distribution: [
      {
        "@type": "DataDownload",
        encodingFormat: "application/json",
        contentUrl: `${BASE}/obs/data/gold/${meta.gold}`,
      },
    ],
  };
  const quando = geradoEm();
  if (quando) dataset.dateModified = quando;
  // "<" escapado impede fechamento prematuro da tag <script> pelo conteúdo.
  const json = JSON.stringify(dataset).replaceAll("<", "\\u003c");
  return `<script type="application/ld+json">${json}</script>`;
}

export function montarHtml(meta: MetaObservatorio, html = shell()): string {
  const t = escapeHtml(meta.titulo);
  const d = escapeHtml(meta.descricao);
  const c = escapeHtml(meta.canonico);
  let out = html
    .replace(/<title>[^<]*<\/title>/, `<title>${t}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${d}">`)
    .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${t}">`)
    .replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${d}">`)
    .replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${c}">`)
    .replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${c}">`);
  const extras = [
    meta.indexavel ? "" : `<meta name="robots" content="noindex">`,
    meta.indexavel ? jsonLd(meta) : "",
    // contato do responsável (fonte única em src/lib/contato.ts), lido pela SPA na aba Sobre
    `<meta name="obs:linkedin" content="${escapeHtml(LINKEDIN_URL)}">`,
  ]
    .filter(Boolean)
    .join("\n");
  if (extras) out = out.replace("</head>", `${extras}\n</head>`);
  return out;
}
