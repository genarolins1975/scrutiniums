/**
 * Lógica pura da página inicial: o quadro de atualidade das fontes e o resumo dele, o índice da
 * busca do alto da página, o estado de cada destino e as opções do seletor único de "sua distribuidora"
 * (conta de luz, qualidade e perdas). Nada aqui calcula indicador: a atualidade vem de
 * publicacao.json (módulo Dados), os destinos do conteúdo editorial (mapa.ts e navegacao.ts), os
 * verbetes conferidos de conteudo/conceitos.ts, o vocabulário leigo da busca (busca-sinonimos.ts) e
 * as distribuidoras do índice de empresas.json. Os números das seis perguntas prioritárias ficam
 * em home-sinais.ts.
 */
import type { ItemBusca } from "./busca";
import { sinonimosDe } from "./busca-sinonimos";
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
    /** O que a situação compara com o calendário da fonte: "periodo_de_referencia" (série regular) ou "publicacao_da_fonte" (arquivo anual, cadastro ou vigência). */
    base?: string | null;
    /** O último período disponível ainda não terminou (o ano corrente num arquivo anual). */
    periodo_parcial?: boolean | null;
  } | null;
  /** Como o conjunto é publicado: "vigencia" traz datas de início e fim de cada tarifa ("início|fim|ato"), e não um período de referência. */
  dado?: { formato?: string | null; ref_max?: string | null } | null;
  /** Data (UTC) em que a fonte informa ter publicado o arquivo; ausente quando ela não informa. */
  capturas?: { ultima_publicacao_fonte?: string | null } | null;
};

export type PublicacaoAtualidade = {
  referencia: { hoje: string };
  /** Tolerância, em dias, que cada cadência admite além do prazo (regras.sla de publicacao.json). */
  regras?: { sla?: Record<string, { tolerancia_dias?: number | null } | undefined> | null } | null;
  conjuntos: ConjuntoAtualidade[];
};

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

/**
 * Mês mais recente que o módulo de origem publica para uma fonte cujo arquivo é anual: a publicação (publicacao.json) só conhece o
 * ano, e o ano em curso aparece como "2026" mesmo quando o último mês com dado é outro. Só refina o mesmo ano; nunca troca um período por outro.
 */
export type RefinoDePeriodo = { periodo: string; rotulo: string };

export type LinhaAtualidade = {
  tema: string;
  href: string;
  rotulo: string;
  orgao: string | null;
  /** Último período de referência legível, ou null quando a publicação não tem o conjunto ou o período. */
  ultimo: string | null;
  /** O período ainda não terminou na data da publicação (mês ou ano em curso). */
  emCurso: boolean;
  /** Último mês com dado, quando o período de referência é um ano em curso e o módulo de origem publica o mês ("jun/2026"). */
  ultimoMes: string | null;
  /** O que o mês é ("último mês nacional completo"). */
  ultimoMesRotulo: string | null;
  cadencia: string | null;
  situacao: string | null;
  atrasado: boolean;
  /** O que a situação compara com o calendário: o último período ("periodo") ou a data em que a fonte publicou o arquivo ("publicacao"). */
  base: "periodo" | "publicacao" | null;
  /** Data (dd/mm/aaaa) em que a fonte informa ter publicado o arquivo; null quando ela não informa. */
  publicadoEm: string | null;
  /** Dias de tolerância da cadência declarada, depois do prazo (regras.sla de publicacao.json). */
  toleranciaDias: number | null;
  /** Ficha do conjunto em /setor-eletrico/dados/[slug], quando a página existe. */
  ficha: string | null;
};

export function linhasAtualidade(pub: PublicacaoAtualidade | null, fichas: ReadonlySet<string>, refinos: Readonly<Record<string, RefinoDePeriodo>> = {}): LinhaAtualidade[] {
  const porId = new Map((pub?.conjuntos ?? []).map((c) => [c.id, c]));
  const hoje = pub?.referencia.hoje ?? null;
  return FONTES_PRINCIPAIS.flatMap((f) =>
    f.conjuntos.map((fc) => {
      const c = porId.get(fc.id) ?? null;
      const a = c?.atualidade ?? null;
      const fim = a?.fim_ultimo_periodo ?? null;
      const ultimo = periodoLegivel(a?.ultimo_periodo) ?? vigenciaMaisRecente(c?.dado);
      const emCurso = Boolean(a?.periodo_parcial) || Boolean(fim && hoje && fim > hoje);
      const refino = refinos[fc.id];
      // o mês só vale para o ano em curso que a publicação já mostra: "jun/2026" refina "2026", e nada mais
      const mes = emCurso && refino && ultimo && /^\d{4}$/.test(ultimo) && refino.periodo.endsWith(`/${ultimo}`) ? refino : null;
      const cadencia = a?.cadencia ?? null;
      const publicado = c?.capturas?.ultima_publicacao_fonte?.slice(0, 10) ?? null;
      const tolerancia = cadencia ? pub?.regras?.sla?.[cadencia]?.tolerancia_dias : null;
      return {
        tema: f.tema,
        href: f.href,
        rotulo: fc.rotulo,
        orgao: c?.orgao ?? null,
        ultimo,
        emCurso,
        ultimoMes: mes?.periodo ?? null,
        ultimoMesRotulo: mes?.rotulo ?? null,
        cadencia: cadencia ? (CADENCIA[cadencia] ?? cadencia) : null,
        situacao: a?.situacao ? (SITUACAO[a.situacao] ?? a.situacao.toLowerCase()) : null,
        atrasado: a?.situacao === "ATRASADO",
        base: a?.base === "publicacao_da_fonte" ? "publicacao" : a?.base === "periodo_de_referencia" ? "periodo" : null,
        publicadoEm: periodoLegivel(publicado),
        toleranciaDias: typeof tolerancia === "number" && Number.isFinite(tolerancia) ? tolerancia : null,
        ficha: c?.slug && fichas.has(c.slug) ? `/setor-eletrico/dados/${c.slug}` : null,
      };
    }),
  );
}

/**
 * O refino de período que cada módulo sabe dar. Hoje só a Qualidade: o arquivo de DEC e FEC da ANEEL é anual e a fonte o reescreve
 * todo mês, então a publicação mostra "2026"; o módulo sabe qual é o último mês nacional completo.
 */
export function refinosDePeriodo(qualidade: { disponivel?: boolean; ultimo_mes_completo?: string | null } | null): Record<string, RefinoDePeriodo> {
  const mes = qualidade && qualidade.disponivel === true ? periodoLegivel(qualidade.ultimo_mes_completo) : null;
  return mes ? { "aneel_qualidade/aneel_continuidade": { periodo: mes, rotulo: "último mês nacional completo" } } : {};
}

/** Em que palavras o período em curso se diz: o ano, o mês ou, no grão que não se reconhece, o período. */
export function nomeDoPeriodoEmCurso(ultimo: string | null): string {
  if (ultimo && /^\d{4}$/.test(ultimo)) return "ano em curso";
  if (ultimo && /^[a-z]{3}\/\d{4}$/.test(ultimo)) return "mês em curso";
  return "período em curso";
}

/** A regra por trás da coluna "Situação": as tolerâncias de cada cadência que aparece no quadro e as fontes avaliadas pela data de publicação do arquivo. */
export type RegraDeAtualidade = {
  tolerancias: { cadencia: string; dias: number }[];
  pelaPublicacao: LinhaAtualidade[];
  /** Fontes em dia pela publicação do arquivo cujo último mês com dado é anterior: a regra, em exemplo. */
  comMesAtras: LinhaAtualidade[];
};

export function regraDeAtualidade(linhas: readonly LinhaAtualidade[]): RegraDeAtualidade {
  const vistas = new Map<string, number>();
  for (const l of linhas) if (l.cadencia && l.toleranciaDias !== null && !vistas.has(l.cadencia)) vistas.set(l.cadencia, l.toleranciaDias);
  const pelaPublicacao = linhas.filter((l) => l.base === "publicacao");
  return {
    tolerancias: Array.from(vistas, ([cadencia, dias]) => ({ cadencia, dias })).sort((a, b) => a.dias - b.dias),
    pelaPublicacao,
    comMesAtras: pelaPublicacao.filter((l) => l.situacao === "em dia" && l.ultimoMes !== null && l.publicadoEm !== null),
  };
}

/** Verbete no formato que a busca lê (só conferidos entram no índice). */
export type VerbeteBusca = { slug: string; nome: string; sigla?: string; emUmaFrase?: string; estado: string };

/**
 * Distribuidora com ficha no módulo Empresas. `grupo` é o nome do controlador no topo da cadeia (empresas.json, controle.topo_nome): o leitor
 * procura pela marca ("enel"), e a distribuidora ainda leva o nome antigo (ELETROPAULO).
 */
export type DistribuidoraBusca = { slug: string; sigla: string; nome: string | null; cnpj: string; ufs: string[]; grupo?: string | null };

const cnpjFormatado = (c: string) => `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`;

/** Controlador que é governo (estado, prefeitura, município, Distrito Federal): não é uma marca que o leitor digita. */
const GOVERNO = /^(estado|prefeitura|munic[ií]pio|distrito federal)\b/i;

/**
 * A marca de um grupo controlador, sem a forma societária: "ENEL BRASIL S.A" vira "Enel Brasil", "EDP - ENERGIAS DO BRASIL S.A." vira "EDP Energias
 * do Brasil". Null para quem não tem controlador no topo e para o controlador que é governo.
 */
export function marcaDoGrupo(topoNome: string | null | undefined): string | null {
  if (!topoNome) return null;
  let t = topoNome.replace(/\s+/g, " ").trim();
  if (!t || GOVERNO.test(t)) return null;
  t = t.replace(/\s*-\s*em recupera[çc][ãa]o judicial.*$/i, "");
  t = t.replace(/\s+(?:S\s*[./]\s*A\.?|LTDA\.?)$/i, "");
  t = t.replace(/\s+Participa[çc][õo]es$/i, "");
  t = t.replace(/\s+-\s+/g, " ").trim();
  if (!t) return null;
  const ligacao = new Set(["DO", "DA", "DE", "DOS", "DAS", "E"]);
  // o nome todo em caixa alta ganha caixa de título; as siglas curtas (EDP) ficam como estão
  return t === t.toUpperCase() ? t.split(" ").map((w) => (ligacao.has(w) ? w.toLowerCase() : w.length <= 3 ? w : w.charAt(0) + w.slice(1).toLowerCase())).join(" ") : t;
}

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
    itens.push({ tipo: "Conceito", titulo: v.sigla ? `${v.sigla} · ${v.nome}` : v.nome, detalhe: v.emUmaFrase, href: `/setor-eletrico/aprenda/${v.slug}`, ...(v.sigla ? { sigla: v.sigla } : {}) });
  }
  // a marca de um grupo só vale como nome a mais quando o grupo tem mais de uma distribuidora: é ela que o leitor procura sem saber o nome antigo
  const porMarca = new Map<string, number>();
  for (const d of distribuidoras) {
    const m = marcaDoGrupo(d.grupo);
    if (m) porMarca.set(m, (porMarca.get(m) ?? 0) + 1);
  }
  for (const d of distribuidoras) {
    const marca = marcaDoGrupo(d.grupo);
    itens.push({
      tipo: "Distribuidora",
      titulo: d.nome && d.nome !== d.sigla ? `${d.sigla} · ${d.nome}` : d.sigla,
      detalhe: `${d.ufs.join(", ")}${d.ufs.length ? " · " : ""}CNPJ ${cnpjFormatado(d.cnpj)}`,
      href: `/setor-eletrico/empresas/${d.slug}`,
      sigla: d.sigla,
      ...(marca && (porMarca.get(marca) ?? 0) > 1 ? { sinonimos: [`grupo ${marca}`] } : {}),
    });
  }
  // o vocabulário leigo entra por endereço: o mesmo nome vale para a página, o painel e a pergunta que levam ao mesmo lugar
  return itens.map((i) => {
    const s = sinonimosDe(i.href);
    if (!s.length) return i;
    return { ...i, sinonimos: [...(i.sinonimos ?? []), ...s.filter((t) => !(i.sinonimos ?? []).includes(t))] };
  });
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
  /** `dec` nulo com ano preenchido: a distribuidora enviou parte do ano e não tem DEC anual. */
  qualidade?: { ano: number | null; dec?: number | null } | null;
  /** Tarifa B1 residencial: `vigente` é verdadeiro quando há vigência cobrindo a data da gold de Conta de luz. */
  tarifa?: { vigente?: boolean } | null;
};

/**
 * Opções do seletor "sua distribuidora", um só para as três perguntas que têm resposta por distribuidora. O índice traz as distribuidoras de
 * todo o histórico, entre elas as extintas (a série de perdas de algumas termina em 2005): a lista só tem quem tem dado em ao menos uma das
 * três páginas, e cada pergunta sabe de quem tem o dado dela:
 *  - Conta de luz: tarifa B1 residencial vigente na data da gold;
 *  - Qualidade: DEC anual no ano mais recente do índice, e à parte as que enviaram só parte desse ano (sem DEC anual, e por isso fora da
 *    contagem nacional do DEC);
 *  - Perdas: dado no ano de referência da gold de Perdas.
 * O ano de Perdas é o da gold de Perdas; o de Qualidade é o mais recente entre as distribuidoras do índice.
 */
export function escolhasDeDistribuidora(distribuidoras: readonly DistribuidoraDoIndice[], anoPerdas: number | null) {
  const anoQualidade = distribuidoras.reduce<number | null>((m, d) => (d.qualidade?.ano != null && (m === null || d.qualidade.ano > m) ? d.qualidade.ano : m), null);
  const temConta = (d: DistribuidoraDoIndice) => d.tarifa?.vigente === true;
  const temPerdas = (d: DistribuidoraDoIndice) => d.perdas?.ano != null && d.perdas.ano === anoPerdas;
  const temQualidade = (d: DistribuidoraDoIndice) => d.qualidade?.ano != null && d.qualidade.ano === anoQualidade;
  const temDecAnual = (d: DistribuidoraDoIndice) => temQualidade(d) && d.qualidade?.dec != null;
  const cnpjs = (tem: (d: DistribuidoraDoIndice) => boolean) => distribuidoras.filter(tem).map((d) => d.cnpj);
  return {
    anoPerdas,
    anoQualidade,
    opcoes: opcoesDistribuidora(distribuidoras, (d) => temConta(d) || temPerdas(d) || temQualidade(d)),
    opcoesPerdas: opcoesDistribuidora(distribuidoras, temPerdas),
    opcoesQualidade: opcoesDistribuidora(distribuidoras, temQualidade),
    opcoesConta: opcoesDistribuidora(distribuidoras, temConta),
    /** Quem tem o dado de cada pergunta, por CNPJ. */
    comDado: {
      conta: cnpjs(temConta),
      qualidade: cnpjs(temDecAnual),
      qualidadeParcial: cnpjs((d) => temQualidade(d) && !temDecAnual(d)),
      perdas: cnpjs(temPerdas),
    },
  };
}
