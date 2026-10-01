/**
 * Lógica pura da página inicial (mapa didático): o quadro de atualidade da seção G,
 * o índice da busca da seção A e as opções de distribuidora da seção D. Nada aqui
 * calcula indicador: a atualidade vem de publicacao.json (módulo Dados), os destinos
 * do conteúdo editorial (mapa.ts e navegacao.ts), os verbetes conferidos de
 * conteudo/conceitos.ts e as distribuidoras do índice de empresas.json.
 */
import type { ItemBusca } from "./busca";
import type { OpcaoDistribuidora } from "@/components/energia/EscolhaDistribuidora";
import { CARTOES, FONTES_PRINCIPAIS, PERGUNTAS_COTIDIANAS } from "./mapa";
import type { DestinoNavegacao } from "./navegacao";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Recorte mínimo de um conjunto em publicacao.json que a home lê. */
export type ConjuntoAtualidade = {
  id: string;
  slug?: string;
  orgao: string;
  titulo: string;
  atualidade?: {
    situacao?: string | null;
    cadencia?: string | null;
    ultimo_periodo?: string | null;
    fim_ultimo_periodo?: string | null;
  } | null;
};

export type PublicacaoAtualidade = { referencia: { hoje: string }; conjuntos: ConjuntoAtualidade[] };

/**
 * Último período de referência em linguagem simples, no grão em que a fonte o publica:
 * "28/09/2026 23h", "28/09/2026", "ago/2026" ou "2026". A data de captura nunca entra aqui.
 */
export function periodoLegivel(p: string | null | undefined): string | null {
  if (!p) return null;
  let m = p.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]} ${m[4]}h${m[5] === "00" ? "" : m[5]}`;
  m = p.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  m = p.match(/^(\d{4})-(\d{2})$/);
  if (m) return `${MESES[Number(m[2]) - 1]}/${m[1]}`;
  if (/^\d{4}$/.test(p)) return p;
  return null;
}

const CADENCIA: Record<string, string> = {
  diaria: "diária",
  semanal: "semanal",
  quinzenal: "quinzenal",
  mensal: "mensal",
  trimestral: "trimestral",
  anual: "anual",
};

const SITUACAO: Record<string, string> = {
  "EM DIA": "em dia",
  ATRASADO: "atrasada",
  "SEM SLA": "sem calendário declarado",
  "SEM DADO": "sem período de referência",
};

export type LinhaAtualidade = {
  tema: string;
  href: string;
  rotulo: string;
  orgao: string | null;
  /** Último período de referência legível, ou null quando a publicação não tem o conjunto ou o período. */
  ultimo: string | null;
  /** O período ainda não terminou na data da publicação (mês ou ano em curso). */
  emCurso: boolean;
  cadencia: string | null;
  situacao: string | null;
  atrasado: boolean;
  /** Ficha do conjunto em /setor-eletrico/dados/[slug], quando a página existe. */
  ficha: string | null;
};

export function linhasAtualidade(pub: PublicacaoAtualidade | null, fichas: ReadonlySet<string>): LinhaAtualidade[] {
  const porId = new Map((pub?.conjuntos ?? []).map((c) => [c.id, c]));
  const hoje = pub?.referencia.hoje ?? null;
  return FONTES_PRINCIPAIS.flatMap((f) =>
    f.conjuntos.map((fc) => {
      const c = porId.get(fc.id) ?? null;
      const a = c?.atualidade ?? null;
      const fim = a?.fim_ultimo_periodo ?? null;
      return {
        tema: f.tema,
        href: f.href,
        rotulo: fc.rotulo,
        orgao: c?.orgao ?? null,
        ultimo: periodoLegivel(a?.ultimo_periodo),
        emCurso: Boolean(fim && hoje && fim > hoje),
        cadencia: a?.cadencia ? (CADENCIA[a.cadencia] ?? a.cadencia) : null,
        situacao: a?.situacao ? (SITUACAO[a.situacao] ?? a.situacao.toLowerCase()) : null,
        atrasado: a?.situacao === "ATRASADO",
        ficha: c?.slug && fichas.has(c.slug) ? `/setor-eletrico/dados/${c.slug}` : null,
      };
    }),
  );
}

/** Verbete no formato que a busca lê (só conferidos entram no índice). */
export type VerbeteBusca = { slug: string; nome: string; sigla?: string; emUmaFrase?: string; estado: string };

/** Distribuidora com ficha no módulo Empresas. */
export type DistribuidoraBusca = { slug: string; sigla: string; nome: string | null; cnpj: string; ufs: string[] };

const cnpjFormatado = (c: string) => `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`;

export function indiceBusca(destinos: readonly DestinoNavegacao[], verbetes: readonly VerbeteBusca[], distribuidoras: readonly DistribuidoraBusca[]): ItemBusca[] {
  const itens: ItemBusca[] = [];
  for (const d of destinos) {
    if (!d.publicado || d.slug === "mapa") continue;
    itens.push({ tipo: "Página", titulo: d.rotulo, detalhe: d.pergunta, href: d.href });
  }
  for (const p of PERGUNTAS_COTIDIANAS) itens.push({ tipo: "Pergunta", titulo: p.pergunta, detalhe: p.destinos.map((x) => x.rotulo).join(" · "), href: p.destinos[0].href });
  for (const d of destinos) {
    const c = CARTOES[d.slug];
    // módulo em integração não promete painel na busca: só a página entra
    if (!c || !d.publicado || !d.integrado) continue;
    for (const e of c.encontra) {
      // um mesmo endereço sem âncora já é a própria página: não repete
      if (e.href === d.href) continue;
      itens.push({ tipo: "Painel", titulo: e.texto, detalhe: d.rotulo, href: e.href });
    }
  }
  for (const v of verbetes) {
    if (v.estado !== "CONFERIDO") continue;
    itens.push({ tipo: "Conceito", titulo: v.sigla ? `${v.sigla} · ${v.nome}` : v.nome, detalhe: v.emUmaFrase, href: `/setor-eletrico/aprenda/${v.slug}` });
  }
  for (const d of distribuidoras) {
    itens.push({
      tipo: "Distribuidora",
      titulo: d.nome && d.nome !== d.sigla ? `${d.sigla} · ${d.nome}` : d.sigla,
      detalhe: `${d.ufs.join(", ")}${d.ufs.length ? " · " : ""}CNPJ ${cnpjFormatado(d.cnpj)}`,
      href: `/setor-eletrico/empresas/${d.slug}`,
    });
  }
  return itens;
}

/** Opções do seletor "sua distribuidora": só quem tem dado na página de destino, em ordem de sigla. */
export function opcoesDistribuidora<T extends { cnpj: string; sigla: string; nome: string | null }>(lista: readonly T[], tem: (d: T) => boolean): OpcaoDistribuidora[] {
  return lista
    .filter(tem)
    .map((d) => ({ cnpj: d.cnpj, sigla: d.sigla, nome: d.nome }))
    .sort((a, b) => a.sigla.localeCompare(b.sigla, "pt-BR"));
}
