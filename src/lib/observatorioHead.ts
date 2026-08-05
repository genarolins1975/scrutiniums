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
  ]
    .filter(Boolean)
    .join("\n");
  if (extras) out = out.replace("</head>", `${extras}\n</head>`);
  return out;
}
