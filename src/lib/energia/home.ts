/**
 * Lógica pura da página inicial: o quadro de atualidade das fontes e o resumo dele, o índice da
 * busca do alto da página, o estado de cada destino e as opções de "sua distribuidora" das
 * perguntas de perdas e de qualidade. Nada aqui calcula indicador: a atualidade vem de
 * publicacao.json (módulo Dados), os destinos do conteúdo editorial (mapa.ts e navegacao.ts), os
 * verbetes conferidos de conteudo/conceitos.ts e as distribuidoras do índice de empresas.json.
 * Os números das seis perguntas prioritárias ficam em home-sinais.ts.
 */
import type { ItemBusca } from "./busca";
import type { OpcaoDistribuidora } from "@/components/energia/EscolhaDistribuidora";
import { CARTOES, FONTES_PRINCIPAIS, PERGUNTAS_COTIDIANAS, PERGUNTAS_PRIORITARIAS } from "./mapa";
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
  /** Como o conjunto é publicado: "vigencia" traz datas de início e fim de cada tarifa ("início|fim|ato"), e não um período de referência. */
  dado?: { formato?: string | null; ref_max?: string | null } | null;
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

/** Conjunto publicado por vigência (as tarifas): sem período de referência, vale o início da vigência mais recente. */
export function vigenciaMaisRecente(dado: ConjuntoAtualidade["dado"]): string | null {
  if (dado?.formato !== "vigencia" || !dado.ref_max) return null;
  const inicio = periodoLegivel(dado.ref_max.split("|")[0]);
  return inicio ? `vigência iniciada em ${inicio}` : null;
}

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
        ultimo: periodoLegivel(a?.ultimo_periodo) ?? vigenciaMaisRecente(c?.dado),
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
  // as seis perguntas do alto da página e as nove do dia a dia: o leitor pode procurar por qualquer uma delas
  for (const p of PERGUNTAS_PRIORITARIAS) itens.push({ tipo: "Pergunta", titulo: p.pergunta, detalhe: p.link.rotulo, href: p.link.href });
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
export function opcoesDistribuidora<T extends { cnpj: string; sigla: string; nome: string | null; ufs?: string[] }>(lista: readonly T[], tem: (d: T) => boolean): OpcaoDistribuidora[] {
  return lista
    .filter(tem)
    .map((d) => ({ cnpj: d.cnpj, sigla: d.sigla, nome: d.nome, ufs: d.ufs }))
    .sort((a, b) => a.sigla.localeCompare(b.sigla, "pt-BR"));
}

/** Resumo da atualidade das fontes principais: quantas estão em dia pelo calendário que a própria fonte declara, quais atrasaram e quantas não têm calendário ou avaliação. */
export type ResumoAtualidade = {
  total: number;
  emDia: number;
  atrasadas: LinhaAtualidade[];
  semCalendario: number;
  semAvaliacao: number;
};

export function resumoAtualidade(linhas: readonly LinhaAtualidade[]): ResumoAtualidade {
  const atrasadas = linhas.filter((l) => l.atrasado);
  const emDia = linhas.filter((l) => l.situacao === "em dia").length;
  const semCalendario = linhas.filter((l) => l.situacao === "sem calendário declarado").length;
  return { total: linhas.length, emDia, atrasadas, semCalendario, semAvaliacao: linhas.length - emDia - atrasadas.length - semCalendario };
}

/**
 * Estado de um destino no índice, lido de navegacao.ts: "preparacao" (a rota ainda não existe: nome sem link), "integracao" (a página
 * existe e mostra escopo e fontes catalogadas, ainda sem números) ou "integrado" (publica números). O texto do estado nunca é escrito
 * à parte: sai deste valor.
 */
export type EstadoDoDestino = "integrado" | "integracao" | "preparacao";

export function estadoDoDestino(d: Pick<DestinoNavegacao, "publicado" | "integrado">): EstadoDoDestino {
  if (!d.publicado) return "preparacao";
  return d.integrado ? "integrado" : "integracao";
}

/** Distribuidora do índice de empresas, com os anos de dado de cada módulo (só o que o seletor precisa). */
export type DistribuidoraDoIndice = {
  cnpj: string;
  sigla: string;
  nome: string | null;
  ufs?: string[];
  perdas?: { ano: number | null } | null;
  qualidade?: { ano: number | null } | null;
};

/**
 * Opções do seletor "sua distribuidora" de cada pergunta. O índice traz as distribuidoras de todo o histórico, entre elas as extintas
 * (a série de perdas de algumas termina em 2005): cada seletor só lista quem tem dado no ano de referência do módulo, e o rótulo diz qual
 * é o ano e quantas são. O ano de Perdas é o da gold de Perdas; o de Qualidade é o mais recente entre as distribuidoras do índice.
 */
export function escolhasDeDistribuidora(distribuidoras: readonly DistribuidoraDoIndice[], anoPerdas: number | null) {
  const anoQualidade = distribuidoras.reduce<number | null>((m, d) => (d.qualidade?.ano != null && (m === null || d.qualidade.ano > m) ? d.qualidade.ano : m), null);
  return {
    anoPerdas,
    anoQualidade,
    opcoesPerdas: opcoesDistribuidora(distribuidoras, (d) => d.perdas?.ano != null && d.perdas.ano === anoPerdas),
    opcoesQualidade: opcoesDistribuidora(distribuidoras, (d) => d.qualidade?.ano != null && d.qualidade.ano === anoQualidade),
  };
}
