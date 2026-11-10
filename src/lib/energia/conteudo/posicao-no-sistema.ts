/**
 * Onde um verbete do Aprenda aparece no mapa do sistema elétrico (os sete elos de `NOS_MAPA`, da página inicial), para a figura do
 * verbete (`VerbeteNoSistema`). Nada é escrito por verbete: a posição sai de dois campos que o acervo já declara.
 *
 *  1. O próprio mapa lista o verbete num elo (`NOS_MAPA[].conceitos`): vale esse elo.
 *  2. Senão, valem os elos das páginas que o verbete aponta em "Veja no painel" (`vejaNoPortal`), pelo módulo do endereço
 *     (`NOS_MAPA[].destinos`). Página que não pertence a nenhum elo (Visão geral, Regulação, Expansão) não marca elo.
 *
 * Verbete sem elo por nenhuma das duas regras não é forçado a um: a figura mostra só os elos dos verbetes relacionados
 * (`relacoes`), achados pelas mesmas regras, e diz isso.
 */
import { LIGACOES, NOS_MAPA, type IdNo, type Ligacao } from "../mapa";
import type { Conceito } from "./conceitos";

/** "mapa": o mapa da página inicial lista o verbete no elo. "painel": uma página de "Veja no painel" do verbete pertence ao elo. */
export type MotivoDoElo = "mapa" | "painel";

export type EloDoVerbete = { no: IdNo; motivo: MotivoDoElo; paineis: { rotulo: string; href: string }[] };

/** Módulo de um endereço do portal: "/setor-eletrico/pld#cmo" → "pld"; "/setor-eletrico/pld/modelos" → "pld-modelos" quando o mapa o lista. */
export function moduloDoEndereco(href: string): string {
  const [primeiro = "", segundo = ""] = href.split("#")[0].split("?")[0].replace(/^\/setor-eletrico\/?/, "").split("/");
  const composto = `${primeiro}-${segundo}`;
  return segundo && NOS_MAPA.some((n) => n.destinos.includes(composto)) ? composto : primeiro;
}

export function elosDoVerbete(c: Pick<Conceito, "slug" | "vejaNoPortal">): EloDoVerbete[] {
  const doMapa = NOS_MAPA.filter((n) => n.conceitos.some((x) => x.slug === c.slug));
  if (doMapa.length) return doMapa.map((n) => ({ no: n.id, motivo: "mapa", paineis: [] }));
  const out: EloDoVerbete[] = [];
  for (const n of NOS_MAPA) {
    const paineis = c.vejaNoPortal.filter((v) => n.destinos.includes(moduloDoEndereco(v.href)));
    if (paineis.length) out.push({ no: n.id, motivo: "painel", paineis });
  }
  return out;
}

export type VizinhoNoMapa = { slug: string; elos: IdNo[] };

export type PosicaoNoSistema = {
  elos: EloDoVerbete[];
  /** Verbetes relacionados que têm elo, na ordem de `relacoes`. */
  vizinhos: VizinhoNoMapa[];
  /** Ligações do mapa que tocam um elo marcado, na ordem do mapa. */
  ligacoes: Ligacao[];
};

/** `acha` devolve o verbete de um endereço (o acervo no idioma da página); relação para verbete que não existe é ignorada. */
export function posicaoNoSistema(c: Pick<Conceito, "slug" | "vejaNoPortal" | "relacoes">, acha: (slug: string) => Pick<Conceito, "slug" | "vejaNoPortal"> | undefined): PosicaoNoSistema {
  const elos = elosDoVerbete(c);
  const marcados = new Set(elos.map((e) => e.no));
  const vizinhos = c.relacoes
    .filter((r, i, todas) => r !== c.slug && todas.indexOf(r) === i)
    .map((r) => acha(r))
    .filter((r): r is Pick<Conceito, "slug" | "vejaNoPortal"> => !!r)
    .map((r) => ({ slug: r.slug, elos: elosDoVerbete(r).map((e) => e.no) }))
    .filter((v) => v.elos.length > 0);
  return { elos, vizinhos, ligacoes: LIGACOES.filter((l) => marcados.has(l.de) || marcados.has(l.para)) };
}
