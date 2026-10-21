/**
 * Método do Observatório do Território e Clima, lido no build de
 * docs/territorio/README.md (texto de método mantido junto do pipeline) e das golds
 * (fontes, datas de captura e sha256 dos originais). Nada aqui é escrito à mão: a
 * página aberta /territorio/metodologia e a entrada /territorio só reorganizam o que
 * estes dois lugares dizem.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { lerQueimadas, lerQueimadasMunicipios } from "./queimadas";
import { lerDesastres, serieReconhecida } from "./desastres";
import { lerEmissoes } from "./emissoes";

export type ItemReadme = { rotulo: string; texto: string };
export type SecaoReadme = { titulo: string; rota: string | null; itens: ItemReadme[] };

/** Rótulos que cada seção de fonte precisa ter no README. */
export const ROTULO_NAO_CONCLUIR = "Não permite concluir";
export const ROTULO_VALIDACOES = "Validações que bloqueiam a publicação";

let cache: SecaoReadme[] | null = null;

/** Seções "## Título (`/rota`)" do README com os itens "- **Rótulo:** texto". */
export function lerReadmeTerritorio(): SecaoReadme[] {
  if (cache) return cache;
  const texto = readFileSync(join(process.cwd(), "docs", "territorio", "README.md"), "utf-8");
  const secoes: SecaoReadme[] = [];
  let atual: SecaoReadme | null = null;
  for (const linha of texto.split("\n")) {
    const h = linha.match(/^## (.+?)(?: \(`(\/[^`]+)`\))?\s*$/);
    if (h) {
      atual = { titulo: h[1].trim(), rota: h[2] ?? null, itens: [] };
      secoes.push(atual);
      continue;
    }
    const b = linha.match(/^- \*\*(.+?):\*\* (.+)$/);
    if (b && atual) atual.itens.push({ rotulo: b[1].trim(), texto: b[2].trim() });
  }
  cache = secoes;
  return secoes;
}

export function secaoReadme(chave: string): SecaoReadme | undefined {
  return lerReadmeTerritorio().find((s) => s.rota === chave || s.titulo === chave);
}

export function itemReadme(secao: SecaoReadme | undefined, rotulo: string): string | null {
  return secao?.itens.find((i) => i.rotulo === rotulo)?.texto ?? null;
}

/** Primeira letra maiúscula, para itens que no README continuam a frase do rótulo. */
export function frase(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** data: última modificação do arquivo no servidor da fonte, ou o momento da captura quando a fonte não informa (tipoData). */
export type Original = { nome: string; url: string; sha256: string; bytes: number; data: string | null; tipoData: "fonte" | "captura" };

export type FonteMetodo = {
  id: "queimadas" | "desastres" | "emissoes";
  rota: string;
  titulo: string;
  fonte: string;
  links: { rotulo: string; href: string }[];
  licenca: string;
  unidade: string;
  /** Período coberto pelos números publicados, montado da gold. */
  cobertura: string;
  capturadoEm: string;
  gold: string;
  ressalvas: string[];
  originais: Original[];
  readme: SecaoReadme;
};

const nomeDoArquivo = (url: string) => decodeURIComponent(url.split("?")[0].split("/").filter(Boolean).at(-1) ?? url);
const dataIso = (v: string | null | undefined): string | null => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

function exigirSecao(rota: string): SecaoReadme {
  const s = secaoReadme(rota);
  if (!s) throw new Error(`README do Território sem a seção ${rota}`);
  return s;
}

/** As três fontes do observatório, com o que a gold e o README dizem de cada uma. */
export function fontesTerritorio(): FonteMetodo[] {
  const q = lerQueimadas();
  const qm = lerQueimadasMunicipios();
  const d = lerDesastres();
  const e = lerEmissoes();
  const anosQ = q.anual.filter((a) => a.focos !== null);
  const fechados = anosQ.filter((a) => !a.parcial);
  const parcial = anosQ.find((a) => a.parcial);
  const reconhecida = serieReconhecida(d);
  return [
    {
      id: "queimadas",
      rota: "/territorio/queimadas",
      titulo: "Focos de calor e área queimada",
      fonte: q.fonte.nome,
      links: [{ rotulo: "Portal de dados abertos", href: q.fonte.portal }, { rotulo: "Servidor de arquivos", href: q.fonte.url }],
      licenca: q.fonte.licenca,
      unidade: q.unidade,
      cobertura: `Série anual de ${fechados[0].ano} a ${fechados.at(-1)!.ano}${parcial ? `; ${parcial.ano} parcial, até ${parcial.ultimoDia ? parcial.ultimoDia.split("-").reverse().join("/") : "a captura"}` : ""}. Satélite de referência ${q.sateliteReferencia.id}.`,
      capturadoEm: q.capturadoEm,
      gold: "/territorio/gold/queimadas.json",
      ressalvas: [...q.ressalvas, ...(q.areaQueimada?.ressalvas.map((r) => `Área queimada: ${r}`) ?? []), ...(qm?.ressalvas.map((r) => `Municípios: ${r}`) ?? [])],
      originais: [
        ...Object.entries(q.originais).map(([url, o]) => ({ nome: nomeDoArquivo(url), url, sha256: o.sha256, bytes: o.bytes, data: dataIso(o.lastModified), tipoData: "fonte" as const })),
        ...(q.areaQueimada ? [{ nome: nomeDoArquivo(q.areaQueimada.url), url: q.areaQueimada.url, ...originalAq(q) }] : []),
        ...(qm ? originaisIbge(qm) : []),
      ],
      readme: exigirSecao("/territorio/queimadas"),
    },
    {
      id: "desastres",
      rota: "/territorio/desastres",
      titulo: "Desastres reconhecidos",
      fonte: d.fonte.nome,
      links: [{ rotulo: "Página de downloads", href: d.fonte.pagina }, { rotulo: "Manual", href: d.fonte.manual }, { rotulo: "Painel oficial", href: d.fonte.painel_oficial }],
      licenca: d.fonte.licenca,
      unidade: d.unidade,
      cobertura: `Ocorrências de ${d.fonte.cobertura_eventos.inicio.slice(0, 4)} a ${d.fonte.cobertura_eventos.fim.slice(0, 4)}; reconhecimento federal de ${reconhecida[0].ano} a ${reconhecida.at(-1)!.ano}. ${d.fonte.cadencia}`,
      capturadoEm: d.capturadoEm,
      gold: "/territorio/gold/desastres.json",
      ressalvas: d.ressalvas,
      originais: Object.values(d.originais).map((o) => ({ nome: o.arquivo, url: o.url, sha256: o.sha256, bytes: o.bytes, data: dataIso(o.last_modified), tipoData: "fonte" as const })),
      readme: exigirSecao("/territorio/desastres"),
    },
    {
      id: "emissoes",
      rota: "/territorio/emissoes",
      titulo: "Emissões de gases de efeito estufa",
      fonte: e.fonte.nome,
      links: [{ rotulo: "Página do SIRENE", href: e.fonte.pagina }, { rotulo: "Relatórios bienais", href: e.fonte.relatorio }],
      licenca: e.fonte.licenca,
      unidade: `${e.unidade}, métrica ${e.metrica}`,
      cobertura: `${e.anoInicial} a ${e.anoFinal}, ${e.edicao}. ${e.fonte.natureza}`,
      capturadoEm: e.capturadoEm,
      gold: "/territorio/gold/emissoes.json",
      ressalvas: e.ressalvas,
      originais: e.originais.map((o) => ({ nome: nomeDoArquivo(o.url), url: o.url, sha256: o.sha256, bytes: o.bytes, data: null, tipoData: "fonte" as const })),
      readme: exigirSecao("/territorio/emissoes"),
    },
  ];
}

/* eslint-disable @typescript-eslint/no-explicit-any -- partes da gold sem tipo declarado no leitor */
function originalAq(q: ReturnType<typeof lerQueimadas>): Omit<Original, "nome" | "url"> {
  const o = (q.areaQueimada as any).original as { sha256: string; bytes: number; lastModified: string | null };
  return { sha256: o.sha256, bytes: o.bytes, data: dataIso(o.lastModified), tipoData: "fonte" };
}

function originaisIbge(qm: NonNullable<ReturnType<typeof lerQueimadasMunicipios>>): Original[] {
  const f = (qm as any).fonteArea as { url: string; sha256: string; bytes: number; capturadoEm: string; lista?: { url: string; sha256: string; bytes: number; capturadoEm: string } } | undefined;
  if (!f) return [];
  return [
    { nome: "IBGE, área territorial do Censo 2022 (SIDRA 4714)", url: f.url, sha256: f.sha256, bytes: f.bytes, data: dataIso(f.capturadoEm), tipoData: "captura" as const },
    ...(f.lista ? [{ nome: "IBGE, lista atual de municípios", url: f.lista.url, sha256: f.lista.sha256, bytes: f.lista.bytes, data: dataIso(f.lista.capturadoEm), tipoData: "captura" as const }] : []),
  ];
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Lacunas declaradas no README: o que o observatório não mede, e por quê. */
export function lacunasTerritorio(): ItemReadme[] {
  return secaoReadme("Lacunas conhecidas")?.itens ?? [];
}

/** Como e quando as golds são atualizadas. */
export function atualizacaoTerritorio(): ItemReadme[] {
  return secaoReadme("Atualização")?.itens ?? [];
}
