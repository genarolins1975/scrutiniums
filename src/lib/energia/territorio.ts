/**
 * Lógica pura da página Minha região (/setor-eletrico/territorio, painel P002, mapa
 * geográfico transversal), testada em node, sem navegador.
 *
 * O que vive aqui e por quê: a página junta seis grãos (submercado, UF, distribuidora,
 * conjunto elétrico, município e usina) que não se trocam um pelo outro. A regra do
 * critério de aceite ("nenhum indicador atribuído a uma granularidade inferior à de
 * origem") é decidida em funções pequenas e testáveis, nunca espalhada pelos
 * componentes:
 *
 *  - as linhas de cada tabela saem da tabela do seu grão na gold (ou do arquivo sob
 *    demanda) e são as mesmas que o mapa desenha e que a exportação grava;
 *  - a ficha de um município mostra o valor de outro grão só com o rótulo daquele
 *    grão ("da distribuidora que atende o município, valor da área inteira");
 *  - a seleção passa de uma camada para outra só quando a gold declara a
 *    correspondência válida (`compatibilidade`), e diz por quê quando não passa;
 *  - os textos que citam números são gerados por regra a partir dos dados.
 *
 * Nenhum indicador é recalculado aqui: contagens de classes e de legenda são feitas
 * sobre as linhas publicadas, e os testes as conferem contra o resumo da gold.
 */
import { campo, tiposUrl, type Leitor } from "./estadoUrl";
import { quebrasFixas, quebrasQuantis, type Classificacao, type ValorClassificavel } from "./escalas";
import { resumo } from "./distribuicao";
import { dataBR, num } from "./formato";
import { destino } from "./navegacao";
import { LIMITE_COMPARACAO, type ColunaTabela, type LinhaTabela } from "./tabela";
import type { Proveniencia, Submercado } from "./tipos";
import type {
  AreaCargaUf,
  Bloco,
  CompatibilidadeTerritorio,
  DistribuidoraTerritorio,
  EstadoSubmercadoMunicipio,
  EstadoVinculo,
  GoldTerritorio,
  IdGraoTerritorio,
  LinhaConjuntoTerritorio,
  LinkModulo,
  MunicipiosTerritorio,
  SubmercadoTerritorio,
  UfTerritorio,
  UsinasTerritorio,
} from "./tipos-territorio";

/* ================================================================ constantes */

export const ROTA_TERRITORIO = "/setor-eletrico/territorio";
export const ID_PAINEL = "p002";

export const CAMADAS = ["submercado", "distribuidora", "municipio", "usinas"] as const;
export type Camada = (typeof CAMADAS)[number];

export const ROTULO_CAMADA: Record<Camada, string> = {
  submercado: "Submercados",
  distribuidora: "Distribuidoras",
  municipio: "Municípios",
  usinas: "Usinas",
};

/** Grão que cada camada desenha (o da tabela equivalente). */
export const GRAO_DA_CAMADA: Record<Camada, IdGraoTerritorio> = {
  submercado: "submercado",
  distribuidora: "distribuidora",
  municipio: "municipio",
  usinas: "usina",
};

export const SUBMERCADOS: readonly Submercado[] = ["SE", "S", "NE", "N"];

export const NOME_SUBMERCADO: Record<Submercado, string> = {
  SE: "Sudeste/Centro-Oeste",
  S: "Sul",
  NE: "Nordeste",
  N: "Norte",
};

/** Cor de cada submercado: a mesma dos gráficos de PLD e de carga (tokens --serie-sm-*). */
export const COR_SM: Record<Submercado, string> = {
  SE: "var(--serie-sm-se)",
  S: "var(--serie-sm-s)",
  NE: "var(--serie-sm-ne)",
  N: "var(--serie-sm-n)",
};

/** Fundo de polígono do submercado: a cor do token clareada, para o contorno e o texto continuarem legíveis. */
export function fundoSubmercado(sm: Submercado): string {
  return `color-mix(in srgb, ${COR_SM[sm]} 40%, var(--cor-superficie))`;
}

/** Rampa sequencial do domínio (globals.css), da classe mais baixa à mais alta. */
export const CORES_SEQUENCIAIS = ["var(--escala-seq-1)", "var(--escala-seq-2)", "var(--escala-seq-3)", "var(--escala-seq-4)", "var(--escala-seq-5)"] as const;

export const ROTULO_ESTADO_SM: Record<EstadoSubmercadoMunicipio, string> = {
  provado: "provado pela carga das áreas do ONS",
  provado_com_area_sem_carga: "provado por uma das áreas (a outra sem carga nos dias conferidos)",
  nao_provado: "não provado",
  com_localidade_isolada: "submercado da UF, com localidade isolada fora do SIN",
  fora_do_sin: "fora do SIN (submercado não se aplica)",
};

/** Pertença nas tabelas: só a exceção é escrita por extenso; o caso comum (provado) vira "sem ressalva", para a coluna não repetir a mesma frase em quase toda linha. */
export function estadoSubmercadoNaTabela(e: EstadoSubmercadoMunicipio): string {
  return e === "provado" ? "sem ressalva" : ROTULO_ESTADO_SM[e];
}

export const ROTULO_VINCULO: Record<EstadoVinculo, string> = {
  1: "confirmado",
  0: "sem confirmação",
  2: "só pelo cadastro de MMGD",
};

/* ================================================================ estado na URL */

export type TipoSelecao = "mun" | "dist" | "sm" | "uf" | "usi";
export type Selecao = { tipo: TipoSelecao; id: string } | null;

const RE_ID: Record<TipoSelecao, RegExp> = {
  mun: /^\d{7}$/,
  dist: /^\d{14}$/,
  sm: /^(SE|S|NE|N)$/,
  uf: /^[A-Z]{2}$/,
  // CEG do SIGA (ex.: PCH.PH.MG.000008-6.1): letras, dígitos, pontos e hífen
  usi: /^[A-Z0-9][A-Z0-9.-]{4,39}$/,
};

/** `?sel=mun:3550308`, `dist:<CNPJ>`, `sm:SE`, `uf:BA`, `usi:<CEG>`: uma entidade escolhida, de qualquer grão. */
export const leitorSelecao: Leitor<Selecao> = {
  ler: (b) => {
    const i = b.indexOf(":");
    if (i < 0) return undefined;
    const tipo = b.slice(0, i) as TipoSelecao;
    const id = b.slice(i + 1);
    return tipo in RE_ID && RE_ID[tipo].test(id) ? { tipo, id } : undefined;
  },
  escrever: (v) => (v ? `${v.tipo}:${v.id}` : ""),
  igual: (a, b) => (a === null || b === null ? a === b : a.tipo === b.tipo && a.id === b.id),
};

const leitorIbge: Leitor<string> = { ler: (b) => (/^\d{7}$/.test(b) ? b : undefined), escrever: (v) => v };

export const MEDIDAS_MUNICIPIO = ["mmgd_w_hab", "mmgd_kw", "mmgd_un", "tsee_faturas", "tsee_proxy_pct", "lpt_dom", "usi_op_n", "usi_op_mw", "usi_reg_n", "isol_n"] as const;
export type MedidaMunicipio = (typeof MEDIDAS_MUNICIPIO)[number];

export const FONTES_USINA = ["solar", "eolica", "hidraulica", "termica", "nuclear"] as const;
export type FonteUsina = (typeof FONTES_USINA)[number];
export const ESTAGIOS_USINA = ["operacao", "construcao", "construcao_nao_iniciada"] as const;
export type EstagioUsina = (typeof ESTAGIOS_USINA)[number];

/**
 * Estado da página na URL. A seleção (`sel`) é uma entidade de qualquer grão; a camada
 * (`cam`) decide como ela aparece no mapa, pela regra de compatibilidade. Seleção, camada
 * e filtros criam entrada no histórico (o voltar desfaz).
 */
export const ESQUEMA_TERRITORIO = {
  cam: campo(tiposUrl.opcao(CAMADAS), "submercado" as Camada, { param: "cam" }),
  sel: campo(leitorSelecao, null as Selecao, { param: "sel" }),
  med: campo(tiposUrl.opcao(MEDIDAS_MUNICIPIO), "mmgd_w_hab" as MedidaMunicipio, { param: "med" }),
  fon: campo(tiposUrl.lista(tiposUrl.opcao(FONTES_USINA)), [...FONTES_USINA] as FonteUsina[], { param: "fon" }),
  est: campo(tiposUrl.lista(tiposUrl.opcao(ESTAGIOS_USINA)), [...ESTAGIOS_USINA] as EstagioUsina[], { param: "est" }),
  reg: campo(tiposUrl.booleano(), false, { param: "reg" }),
  cmp: campo(tiposUrl.lista(leitorIbge, { max: LIMITE_COMPARACAO }), [] as string[], { param: "cmp" }),
  /** Busca da tabela de usinas (a mesma chave que a tabela lê): "Ver as usinas deste município" abre a camada com ela preenchida. */
  usiq: campo(tiposUrl.texto({ max: 120 }), "", { param: "ter.usi.q", historico: "replace" }),
};

/* ================================================================ formatação */

export function inteiro(v: number | null | undefined): string {
  return v === null || v === undefined ? "sem dado" : num(v, 0);
}

export function numTexto(v: number | null | undefined, casas = 1): string {
  return v === null || v === undefined ? "sem dado" : num(v, casas);
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "2025" → "2025"; "2026-03" → "mar/2026"; "2026-09-30" → "30/09/2026". */
export function textoReferencia(ref: string | null | undefined): string {
  if (!ref) return "sem data";
  if (/^\d{4}$/.test(ref)) return ref;
  if (/^\d{4}-\d{2}$/.test(ref)) return `${MESES[Number(ref.slice(5, 7)) - 1]}/${ref.slice(0, 4)}`;
  return dataBR(ref);
}

/** Período de um bloco: um valor só quando início e fim coincidem. */
export function textoPeriodo(p: { inicio: string | null; fim: string | null } | null | undefined): string {
  if (!p || (!p.inicio && !p.fim)) return "sem data";
  if (!p.inicio || p.inicio === p.fim) return textoReferencia(p.fim);
  return `${textoReferencia(p.inicio)} a ${textoReferencia(p.fim)}`;
}

/**
 * Meses entre o fim de um período mensal ("AAAA-MM") e a data de referência da
 * publicação ("AAAA-MM-DD"). Null para períodos que não são mensais: a defasagem só é
 * escrita onde a fonte publica por mês e o último mês está atrás da publicação.
 */
export function mesesDeDefasagem(fim: string | null | undefined, referencia: string): number | null {
  if (!fim || !/^\d{4}-\d{2}$/.test(fim) || !/^\d{4}-\d{2}/.test(referencia)) return null;
  const a = Number(fim.slice(0, 4)) * 12 + Number(fim.slice(5, 7));
  const b = Number(referencia.slice(0, 4)) * 12 + Number(referencia.slice(5, 7));
  return b - a;
}

/** Aviso de fonte defasada (dois meses ou mais atrás da publicação), ou null. */
export function textoDefasagem(fim: string | null | undefined, referencia: string): string | null {
  const m = mesesDeDefasagem(fim, referencia);
  if (m === null || m < 2) return null;
  return `último mês publicado pela fonte: ${textoReferencia(fim)}, ${m} meses antes desta publicação`;
}

/* ================================================================ arquivos sob demanda */

export type MunicipioT = {
  ibge: string;
  nome: string;
  uf: string;
  sm: Submercado | null;
  sm_estado: EstadoSubmercadoMunicipio | null;
  dist: [number, EstadoVinculo][];
  conj: number[];
  usi_multi: string[];
  pop: number | null;
  mmgd_un: number | null;
  mmgd_kw: number | null;
  mmgd_w_hab: number | null;
  tsee_faturas: number | null;
  tsee_desconto: number | null;
  tsee_proxy_pct: number | null;
  tsee_base_pequena: number | null;
  lpt_dom: number | null;
  usi_op_n: number;
  usi_op_mw: number;
  usi_cart_n: number;
  usi_cart_mw: number;
  usi_reg_n: number;
  usi_reg_kw: number;
  isol_n: number;
  isol_pop: number | null;
  isol_sede: 0 | 1 | null;
};

const CAMPOS_EXIGIDOS: (keyof MunicipioT)[] = [
  "ibge", "nome", "uf", "sm", "sm_estado", "dist", "conj", "usi_multi", "pop", "mmgd_un", "mmgd_kw", "mmgd_w_hab",
  "tsee_faturas", "tsee_desconto", "tsee_proxy_pct", "tsee_base_pequena", "lpt_dom", "usi_op_n", "usi_op_mw",
  "usi_cart_n", "usi_cart_mw", "usi_reg_n", "usi_reg_kw", "isol_n", "isol_pop", "isol_sede",
];

/**
 * Linhas do índice municipal como objetos, lidas pelo nome de cada coluna em `campos`
 * (uma coluna nova no arquivo não desloca as outras; uma coluna que falta é erro, não
 * zero em silêncio).
 */
export function municipiosDoJson(arq: MunicipiosTerritorio): MunicipioT[] {
  const pos = new Map(arq.campos.map((c, i) => [c, i]));
  const faltam = CAMPOS_EXIGIDOS.filter((c) => !pos.has(c));
  if (faltam.length) throw new Error(`índice municipal sem as colunas: ${faltam.join(", ")}`);
  return arq.linhas.map((l) => {
    const o: Record<string, unknown> = {};
    for (const c of CAMPOS_EXIGIDOS) o[c] = (l as unknown[])[pos.get(c)!];
    return o as MunicipioT;
  });
}

export type UsinaT = {
  ceg: string;
  nome: string;
  tipo: string;
  estagio: string;
  uf: string | null;
  mw_fiscalizado: number | null;
  mw_outorgado: number | null;
  x: number | null;
  y: number | null;
  municipios: string[];
  n_declarados: number;
  coord_no_declarado: 0 | 1 | null;
  outorga: string | null;
  /** Registro do SIGA de até `limite_registro_kw` em operação (coluna própria no município). */
  registro_ate_10kw: boolean;
};

const CAMPOS_USINA = ["ceg", "nome", "tipo", "estagio", "uf", "mw_fiscalizado", "mw_outorgado", "x", "y", "municipios", "n_declarados", "coord_no_declarado", "outorga"] as const;

/**
 * Regra do módulo para o registro de até 10 kW: tipo de outorga "Registro", em
 * operação e com potência fiscalizada até o limite publicado na gold
 * (`resumo.usinas.limite_registro_kw`).
 */
export function ehRegistroPequeno(u: { outorga: string | null; estagio: string; mw_fiscalizado: number | null }, limiteKw: number): boolean {
  return u.outorga === "Registro" && u.estagio === "operacao" && u.mw_fiscalizado !== null && u.mw_fiscalizado * 1000 <= limiteKw + 1e-9;
}

export function usinasDoJson(arq: UsinasTerritorio, limiteKw: number): UsinaT[] {
  const pos = new Map(arq.campos.map((c, i) => [c, i]));
  const faltam = CAMPOS_USINA.filter((c) => !pos.has(c));
  if (faltam.length) throw new Error(`arquivo de usinas sem as colunas: ${faltam.join(", ")}`);
  return arq.linhas.map((l) => {
    const o: Record<string, unknown> = {};
    for (const c of CAMPOS_USINA) o[c] = (l as unknown[])[pos.get(c)!];
    const u = o as Omit<UsinaT, "registro_ate_10kw">;
    return { ...u, registro_ate_10kw: ehRegistroPequeno(u, limiteKw) };
  });
}

/**
 * Usinas em operação de cada UF, na UF principal da usina, com os registros de até 10 kW à parte: o município tem esses registros em coluna
 * própria e fora da contagem de usinas, e a UF passa a contar do mesmo jeito. `usinas` + `registros` é o total que a gold publica por UF; o
 * resto separa as usinas declaradas em um só município (as que a soma municipal conta), em mais de um e sem município reconhecido.
 */
export type UsinasDaUf = { usinas: number; registros: number; um_municipio: number; multimunicipio: number; sem_municipio: number };

export function usinasDaUf(usinas: readonly Pick<UsinaT, "uf" | "estagio" | "registro_ate_10kw" | "municipios" | "n_declarados">[]): Map<string, UsinasDaUf> {
  const por = new Map<string, UsinasDaUf>();
  for (const u of usinas) {
    if (u.estagio !== "operacao" || !u.uf) continue;
    const x = por.get(u.uf) ?? { usinas: 0, registros: 0, um_municipio: 0, multimunicipio: 0, sem_municipio: 0 };
    if (u.registro_ate_10kw) x.registros++;
    else {
      x.usinas++;
      if (u.municipios.length === 1 && u.n_declarados === 1) x.um_municipio++;
      else if (u.municipios.length > 1 || u.n_declarados > 1) x.multimunicipio++;
      else x.sem_municipio++;
    }
    por.set(u.uf, x);
  }
  return por;
}

/**
 * Usinas em operação declaradas em municípios de mais de uma UF: entram inteiras na UF principal, sem repartir a potência. O texto cita as
 * duas maiores. O código IBGE do município começa pelo código da UF; `ufPorCodigo` traduz esse código na sigla.
 */
export function notaMultiestadual(usinas: readonly UsinaT[], ufPorCodigo: ReadonlyMap<string, string>): string | null {
  const multi = usinas
    .filter((u) => u.estagio === "operacao" && !u.registro_ate_10kw)
    .map((u) => ({ u, ufs: Array.from(new Set(u.municipios.map((m) => ufPorCodigo.get(m.slice(0, 2))).filter((x): x is string => !!x))) }))
    .filter((x) => x.ufs.length > 1);
  if (!multi.length) return null;
  const maiores = [...multi].sort((a, b) => (b.u.mw_fiscalizado ?? 0) - (a.u.mw_fiscalizado ?? 0)).slice(0, 2);
  const exemplos = maiores.map((x) => `${x.u.nome} (${num(x.u.mw_fiscalizado ?? 0, 0)} MW, ${x.ufs.join(" e ")})`).join(" e ");
  return `${inteiro(multi.length)} ${multi.length === 1 ? "usina em operação está declarada" : "usinas em operação estão declaradas"} em municípios de mais de uma UF e entra${multi.length === 1 ? "" : "m"} inteira${multi.length === 1 ? "" : "s"} na UF principal, sem repartir a potência (as duas maiores: ${exemplos}).`;
}

/**
 * Desconto da Tarifa Social: o número que a fonte publica por UF e por município é o desconto líquido do mês, a soma dos descontos com os
 * cancelamentos e refaturamentos, que entram no desconto e não na contagem de faturas. Nunca é lido como a soma de descontos concedidos.
 */
export function textoDescontoLiquido(desconto: number | null | undefined): string | null {
  if (desconto === null || desconto === undefined) return null;
  const base = "Desconto líquido: soma dos descontos do mês com os cancelamentos e refaturamentos, que entram no desconto e não na contagem de faturas.";
  return desconto < 0 ? `${base} O valor é negativo porque, no mês, os cancelamentos e refaturamentos somaram mais que os descontos concedidos.` : base;
}

/** Grupo de fonte da usina pelo tipo do SIGA (cor no mapa e filtro). */
export function fonteDaUsina(tipo: string): FonteUsina {
  if (tipo === "UFV") return "solar";
  if (tipo === "EOL") return "eolica";
  if (tipo === "UHE" || tipo === "PCH" || tipo === "CGH") return "hidraulica";
  if (tipo === "UTN") return "nuclear";
  return "termica";
}

export const ROTULO_FONTE: Record<FonteUsina, string> = {
  solar: "Solar (UFV)",
  eolica: "Eólica (EOL)",
  hidraulica: "Hidráulica (UHE, PCH, CGH)",
  termica: "Térmica (UTE)",
  nuclear: "Nuclear (UTN)",
};

export const COR_FONTE: Record<FonteUsina, string> = {
  solar: "var(--serie-solar)",
  eolica: "var(--serie-eolica)",
  hidraulica: "var(--serie-hidraulica)",
  termica: "var(--serie-termica)",
  nuclear: "var(--serie-1)",
};

export const ROTULO_ESTAGIO: Record<EstagioUsina, string> = {
  operacao: "Em operação",
  construcao: "Em construção",
  construcao_nao_iniciada: "Construção não iniciada",
};

/** Potência que representa a usina: a fiscalizada em operação, a outorgada no que ainda não opera. */
export function potenciaUsina(u: Pick<UsinaT, "estagio" | "mw_fiscalizado" | "mw_outorgado">): number | null {
  return u.estagio === "operacao" ? u.mw_fiscalizado : u.mw_outorgado;
}

/** Filtro do mapa e da tabela de usinas: os mesmos critérios nos dois. */
export function filtrarUsinas(usinas: readonly UsinaT[], f: { fon: readonly FonteUsina[]; est: readonly EstagioUsina[]; reg: boolean }): UsinaT[] {
  const fon = new Set<string>(f.fon);
  const est = new Set<string>(f.est);
  return usinas.filter((u) => fon.has(fonteDaUsina(u.tipo)) && est.has(u.estagio) && (f.reg || !u.registro_ate_10kw));
}

/* ================================================================ dados do explorador (servidor → cliente) */

/** Distribuidora como linha de tabela e ficha: só o que a página mostra, valores da área inteira. */
export type LinhaDistribuidora = LinhaTabela & {
  id: string;
  i: number;
  sigla: string;
  nome: string | null;
  cnpj_formatado: string | null;
  ativa: string | null;
  municipios: number;
  confirmados: number;
  so_mmgd: number;
  nao_confirmados: number;
  exclusivos: number;
  compartilhados: number;
  ufs: string;
  fora_do_sin: number;
  com_localidade_isolada: number;
  submercados: string;
  submercado_unico: Submercado | null;
  parte_fora_do_sin: string;
  perdas_pct: number | null;
  perdas_ano: number | null;
  perdas_meses: number | null;
  perdas_situacao: string | null;
  perdas_ressalvas: string | null;
  perdas_motivo: string | null;
  dec_h: number | null;
  dec_lim_h: number | null;
  fec: number | null;
  fec_lim: number | null;
  qual_ano: number | null;
  qual_motivo: string | null;
  tarifa: number | null;
  te: number | null;
  tusd: number | null;
  tarifa_ato: string | null;
  tarifa_vigencia: string | null;
  tarifa_motivo: string | null;
  mmgd_un: number | null;
  mmgd_mw: number | null;
  mmgd_ref: string | null;
  mmgd_motivo: string | null;
  tsee_uc: number | null;
  tsee_pct: number | null;
  tsee_ref: string | null;
  tsee_motivo: string | null;
};

const motivo = (b: Bloco<object>): string | null => (b.disponivel ? null : b.motivo);

/** Motivo de ausência com a competência AAAA-MM como mm/aaaa (mesmo tamanho: esta página está no limite de peso). */
export function motivoLegivel(m: string | null): string | null {
  return m ? m.replace(/(^|[^\w@_/.-])([1-9]\d{3})-(0[1-9]|1[0-2])(?![\w@_/-]|\d)/g, "$1$3/$2") : m;
}

export function linhaDistribuidora(d: DistribuidoraTerritorio): LinhaDistribuidora {
  const { perdas: p, qualidade: q, tarifa: t, mmgd: m, tsee: s } = d.indicadores;
  return {
    id: d.cnpj,
    i: d.i,
    sigla: d.sigla,
    nome: d.nome,
    cnpj_formatado: d.cnpj_formatado,
    ativa: d.ativa === null ? null : d.ativa ? "sim" : "não",
    municipios: d.area.municipios,
    confirmados: d.area.confirmados,
    so_mmgd: d.area.so_mmgd,
    nao_confirmados: d.area.nao_confirmados,
    exclusivos: d.area.exclusivos,
    compartilhados: d.area.compartilhados,
    ufs: d.area.ufs.join(", "),
    fora_do_sin: d.area.fora_do_sin,
    com_localidade_isolada: d.area.com_localidade_isolada,
    submercados: d.submercados.map((x) => `${x.sm ?? "sem submercado"}: ${num(x.municipios, 0)}`).join("; "),
    submercado_unico: d.submercado_unico,
    parte_fora_do_sin: d.parte_fora_do_sin ? "sim" : "não",
    perdas_pct: p.disponivel ? p.taxa_total_pct : null,
    perdas_ano: p.disponivel ? p.ano : null,
    perdas_meses: p.disponivel ? p.meses : null,
    perdas_situacao: p.disponivel ? (p.parcial ? "ano parcial" : "ano completo") : null,
    perdas_ressalvas: p.disponivel && p.ressalvas.length ? p.ressalvas.join(" ") : null,
    perdas_motivo: motivo(p),
    dec_h: q.disponivel ? q.dec_h : null,
    dec_lim_h: q.disponivel ? q.dec_limite_h : null,
    fec: q.disponivel ? q.fec : null,
    fec_lim: q.disponivel ? q.fec_limite : null,
    qual_ano: q.disponivel ? q.ano : null,
    qual_motivo: motivo(q),
    tarifa: t.disponivel ? t.total_rs_mwh : null,
    te: t.disponivel ? t.te_rs_mwh : null,
    tusd: t.disponivel ? t.tusd_rs_mwh : null,
    tarifa_ato: t.disponivel ? t.ato : null,
    tarifa_vigencia: t.disponivel && t.vigencia_inicio ? `${dataBR(t.vigencia_inicio)} a ${dataBR(t.vigencia_fim)}` : null,
    tarifa_motivo: motivo(t),
    mmgd_un: m.disponivel ? m.unidades : null,
    mmgd_mw: m.disponivel ? m.potencia_mw : null,
    mmgd_ref: m.disponivel ? m.periodo.fim : null,
    mmgd_motivo: motivo(m),
    tsee_uc: s.disponivel ? s.uc_tsee : null,
    tsee_pct: s.disponivel ? s.participacao_pct : null,
    tsee_ref: s.disponivel ? s.periodo.fim : null,
    tsee_motivo: motivo(s),
  };
}

export type LinhaUf = LinhaTabela & {
  id: string;
  uf: string;
  nome: string | null;
  codigo: string | null;
  subsistema: Submercado | null;
  submercado: string;
  estado: string;
  areas: string;
  municipios: number;
  fora_do_sin: number;
  com_localidade_isolada: number;
  /** Usinas em operação na UF principal, sem os registros de até 10 kW (a mesma regra da contagem municipal). */
  cap_usinas: number | null;
  /** Registros de até 10 kW em operação na UF principal, à parte. */
  cap_registros: number | null;
  /** Das usinas contadas: declaradas em um só município (as que a soma municipal conta) e em mais de um. */
  cap_um_municipio: number | null;
  cap_multimunicipio: number | null;
  cap_mw: number | null;
  cap_ref: string | null;
  cap_origem: string | null;
  cap_motivo: string | null;
  tsee_faturas: number | null;
  tsee_desconto: number | null;
  tsee_ref: string | null;
  tsee_motivo: string | null;
  isol_localidades: number | null;
  isol_pop: number | null;
  isol_ref: string | null;
  isol_motivo: string | null;
};

const ROTULO_VEREDITO: Record<AreaCargaUf["veredito"], string> = {
  provada: "provada",
  indeterminada: "sem carga nos dias conferidos",
  ambigua: "ambígua",
  reprovada: "reprovada",
};

export function textoAreasCarga(areas: readonly AreaCargaUf[]): string {
  return areas.map((a) => `${a.codigo} (${a.nome}): ${ROTULO_VEREDITO[a.veredito]}${a.submercado_hipotese ? ` no ${a.submercado_hipotese}` : ""}`).join("; ");
}

/**
 * A linha de uma UF. A gold publica `usinas` com os registros de até 10 kW dentro; com `separacao` (lida do arquivo de usinas), a contagem
 * exclui esses registros e eles vão para a coluna ao lado. Sem o arquivo de usinas a contagem fica sem dado, nunca com o total misturado.
 */
export function linhaUf(u: UfTerritorio, separacao?: UsinasDaUf | null): LinhaUf {
  const { capacidade: c, tsee: t, isolados: i } = u.indicadores;
  return {
    id: u.uf,
    uf: u.uf,
    nome: u.nome,
    codigo: u.codigo,
    subsistema: u.subsistema,
    submercado: u.subsistema ? NOME_SUBMERCADO[u.subsistema] : "sem submercado",
    estado: estadoSubmercadoNaTabela(u.estado_subsistema),
    areas: textoAreasCarga(u.areas_carga),
    municipios: u.municipios,
    fora_do_sin: u.municipios_fora_do_sin,
    com_localidade_isolada: u.municipios_com_localidade_isolada,
    cap_usinas: c.disponivel && separacao ? separacao.usinas : null,
    cap_registros: c.disponivel && separacao ? separacao.registros : null,
    cap_um_municipio: c.disponivel && separacao ? separacao.um_municipio : null,
    cap_multimunicipio: c.disponivel && separacao ? separacao.multimunicipio + separacao.sem_municipio : null,
    cap_mw: c.disponivel ? c.mw_fiscalizado : null,
    cap_ref: c.disponivel ? c.periodo.fim : null,
    cap_origem:
      c.disponivel && c.por_origem_mw
        ? Object.entries(c.por_origem_mw)
            .sort((a, b) => b[1] - a[1])
            .map(([k, v]) => `${k} ${num(v, 1)} MW`)
            .join("; ")
        : null,
    cap_motivo: motivo(c),
    tsee_faturas: t.disponivel ? t.faturas : null,
    tsee_desconto: t.disponivel ? t.desconto_reais : null,
    tsee_ref: t.disponivel ? t.periodo.fim : null,
    tsee_motivo: motivo(t),
    isol_localidades: i.disponivel ? i.localidades : null,
    isol_pop: i.disponivel ? i.populacao : null,
    isol_ref: i.disponivel ? i.periodo.fim : null,
    isol_motivo: motivo(i),
  };
}

export type LinhaSubmercado = LinhaTabela & {
  id: Submercado;
  nome: string;
  ufs: string;
  n_ufs: number;
  ufs_area_sem_carga: string | null;
  pld_dia: number | null;
  pld_dia_ref: string | null;
  pld_dia_motivo: string | null;
  pld_mes: number | null;
  pld_mes_ref: string | null;
  pld_mes_dias: number | null;
  pld_mes_motivo: string | null;
  ear_pct: number | null;
  ear_mwmes: number | null;
  ear_max_mwmes: number | null;
  ear_ref: string | null;
  ear_motivo: string | null;
  mmgd_ons: number | null;
  mmgd_ons_ref: string | null;
  mmgd_ons_motivo: string | null;
  mediana_residuo: string;
};

export function linhaSubmercado(s: SubmercadoTerritorio): LinhaSubmercado {
  const { pld_dia: d, pld_mes: m, ear: e, mmgd_ons: o } = s.indicadores;
  return {
    id: s.sm,
    nome: s.nome,
    ufs: s.ufs.join(", "),
    n_ufs: s.ufs.length,
    ufs_area_sem_carga: s.ufs_com_area_sem_carga.length ? s.ufs_com_area_sem_carga.join(", ") : null,
    pld_dia: d.disponivel ? d.valor : null,
    pld_dia_ref: d.disponivel ? d.periodo.fim : null,
    pld_dia_motivo: motivo(d),
    pld_mes: m.disponivel ? m.valor : null,
    pld_mes_ref: m.disponivel ? m.periodo.fim : null,
    pld_mes_dias: m.disponivel ? m.dias : null,
    pld_mes_motivo: motivo(m),
    ear_pct: e.disponivel ? e.pct : null,
    ear_mwmes: e.disponivel ? e.mwmes : null,
    ear_max_mwmes: e.disponivel ? e.max_mwmes : null,
    ear_ref: e.disponivel ? e.periodo.fim : null,
    ear_motivo: motivo(e),
    mmgd_ons: o.disponivel ? o.mwmed : null,
    mmgd_ons_ref: o.disponivel ? o.periodo.fim : null,
    mmgd_ons_motivo: motivo(o),
    mediana_residuo: s.conferencia.map((c) => `${dataBR(c.dia)}: ${num(c.mediana_abs_mwmed, 2)} MWmed`).join("; "),
  };
}

/** Rótulo e fonte de cada grão, para a ficha dizer de quem é cada número. */
export type GraoResumo = { id: IdGraoTerritorio; rotulo: string; rotulo_no_municipio: string };

/** Fonte curta de um bloco: órgão, conjunto e período do valor exibido. */
export type FonteCurta = { orgao: string; conjunto: string; periodo: string; natureza: string; url: string };

export function fonteCurta(p: Proveniencia | undefined): FonteCurta | null {
  if (!p) return null;
  return { orgao: p.fonte.orgao, conjunto: p.fonte.dataset, periodo: textoPeriodo(p.periodo_referencia), natureza: p.natureza, url: p.fonte.url_dataset };
}

export const CHAVES_FONTE = [
  "subsistema_uf", "areas_carga", "distribuidora_perdas", "distribuidora_qualidade", "conjuntos", "distribuidora_tarifa", "mmgd", "mmgd_ons",
  "populacao", "tarifa_social", "luz_para_todos", "isolados", "usinas", "pld_dia", "pld_mes", "ear", "indice",
] as const;
export type ChaveFonte = (typeof CHAVES_FONTE)[number];

/**
 * Tudo o que o explorador (componente cliente) recebe do servidor, uma vez só: as
 * linhas das tabelas pequenas são as mesmas que a ficha lê, para que nada viaje duas
 * vezes no HTML (contrato, seção 5.1). As tabelas grandes (municípios e usinas) vêm
 * dos arquivos sob demanda.
 */
export type DadosExplorador = {
  dataReferencia: string;
  referencias: GoldTerritorio["referencias"];
  submercados: LinhaSubmercado[];
  ufs: LinhaUf[];
  /** Só as distribuidoras com município na relação vigente (as demais ficam numa tabela do servidor). */
  distribuidoras: LinhaDistribuidora[];
  compatibilidade: CompatibilidadeTerritorio[];
  graos: GraoResumo[];
  camadas: { id: string; rotulo: string; descricao: string }[];
  fontes: Partial<Record<ChaveFonte, FonteCurta>>;
  arquivos: { municipios: string; usinas: string; geoUf: string; geoMunicipios: string };
  limiteRegistroKw: number;
  /** Usinas declaradas em mais de uma UF, que entram inteiras na UF principal; null sem o arquivo de usinas. */
  notaMultiestadual: string | null;
  estadosVinculo: Record<string, string>;
  /** Municípios por estado do submercado (resumo da gold), para a legenda antes de o índice chegar. */
  estadosMunicipio: Partial<Record<EstadoSubmercadoMunicipio, number>>;
  versao: string;
};

export function dadosExplorador(g: GoldTerritorio, usinas: readonly UsinaT[] | null = null): DadosExplorador {
  const fontes: Partial<Record<ChaveFonte, FonteCurta>> = {};
  const porUf = usinas ? usinasDaUf(usinas) : null;
  const vazia: UsinasDaUf = { usinas: 0, registros: 0, um_municipio: 0, multimunicipio: 0, sem_municipio: 0 };
  for (const k of CHAVES_FONTE) {
    const f = fonteCurta(g.proveniencia[k]);
    if (f) fontes[k] = f;
  }
  return {
    dataReferencia: g.data_referencia,
    referencias: g.referencias,
    submercados: g.submercados.map(linhaSubmercado),
    ufs: g.ufs.map((u) => linhaUf(u, porUf ? (porUf.get(u.uf) ?? vazia) : null)),
    distribuidoras: g.distribuidoras.filter((d) => d.area.municipios > 0).map(linhaDistribuidora),
    compatibilidade: g.compatibilidade,
    graos: g.graos.map((x) => ({ id: x.id, rotulo: x.rotulo, rotulo_no_municipio: x.rotulo_no_municipio })),
    camadas: g.camadas.map((c) => ({ id: c.id, rotulo: c.rotulo, descricao: c.descricao })),
    fontes,
    arquivos: { municipios: g.series.municipios, usinas: g.series.usinas, geoUf: g.geometria.uf, geoMunicipios: g.geometria.municipios },
    limiteRegistroKw: g.resumo.usinas.limite_registro_kw,
    notaMultiestadual: usinas ? notaMultiestadual(usinas, new Map(g.ufs.filter((u) => u.codigo).map((u) => [String(u.codigo), u.uf]))) : null,
    estadosVinculo: { 0: ROTULO_VINCULO[0], 1: ROTULO_VINCULO[1], 2: ROTULO_VINCULO[2] },
    estadosMunicipio: g.resumo.municipios_por_estado_submercado,
    versao: g.data_referencia,
  };
}

/** Distribuidoras sem nenhum município na relação vigente (encerradas, absorvidas ou sem conjunto). */
export function distribuidorasSemArea(g: GoldTerritorio): DistribuidoraTerritorio[] {
  return g.distribuidoras.filter((d) => d.area.municipios === 0);
}

/* ================================================================ municípios: vínculo e linhas */

export type SituacaoVinculo = "exclusiva" | "compartilhado" | "so_sem_confirmacao" | "sem_vinculo";

export const ROTULO_SITUACAO: Record<SituacaoVinculo, string> = {
  exclusiva: "Uma distribuidora",
  compartilhado: "Mais de uma distribuidora",
  so_sem_confirmacao: "Só vínculo sem confirmação",
  sem_vinculo: "Sem vínculo na relação",
};

/** Vínculos válidos para a seleção: estado 1 (confirmado) ou 2 (só pelo cadastro de MMGD). */
export function vinculosValidos(m: Pick<MunicipioT, "dist">): [number, EstadoVinculo][] {
  return m.dist.filter(([, e]) => e === 1 || e === 2);
}

export function situacaoVinculo(m: Pick<MunicipioT, "dist">): SituacaoVinculo {
  const v = vinculosValidos(m).length;
  if (v >= 2) return "compartilhado";
  if (v === 1) return "exclusiva";
  return m.dist.length ? "so_sem_confirmacao" : "sem_vinculo";
}

/** Estado do vínculo do município com a distribuidora de índice `i` (null: fora da área). */
export function estadoNaDistribuidora(m: Pick<MunicipioT, "dist">, i: number): EstadoVinculo | null {
  return m.dist.find(([d]) => d === i)?.[1] ?? null;
}

export type IndiceDistribuidoras = Map<number, LinhaDistribuidora>;

export function indiceDistribuidoras(dists: readonly LinhaDistribuidora[]): IndiceDistribuidoras {
  return new Map(dists.map((d) => [d.i, d]));
}

/** "CEMIG-D (confirmado); EDP ES (só pelo cadastro de MMGD)". */
export function textoDistribuidoras(m: Pick<MunicipioT, "dist">, idx: IndiceDistribuidoras): string {
  if (!m.dist.length) return "sem vínculo";
  return m.dist.map(([i, e]) => `${idx.get(i)?.sigla ?? `distribuidora ${i}`} (${ROTULO_VINCULO[e]})`).join("; ");
}

export type LinhaMunicipio = LinhaTabela & {
  id: string;
  municipio: string;
  uf: string;
  submercado: string;
  estado_sm: string;
  distribuidoras: string;
  situacao: string;
  conjuntos: number;
  populacao: number | null;
  mmgd_un: number | null;
  mmgd_kw: number | null;
  mmgd_w_hab: number | null;
  tsee_faturas: number | null;
  tsee_desconto: number | null;
  tsee_proxy_pct: number | null;
  tsee_base_pequena: string | null;
  lpt_dom: number | null;
  usi_op_n: number;
  usi_op_mw: number;
  usi_cart_n: number;
  usi_cart_mw: number;
  usi_reg_n: number;
  usi_reg_kw: number;
  usi_multi_n: number;
  isol_n: number;
  isol_pop: number | null;
  isol_sede: string | null;
};

export function textoSubmercadoMunicipio(m: Pick<MunicipioT, "sm" | "sm_estado">): string {
  if (m.sm_estado === "fora_do_sin") return "não se aplica (fora do SIN)";
  return m.sm ? NOME_SUBMERCADO[m.sm] : "sem submercado provado";
}

export function linhaMunicipio(m: MunicipioT, idx: IndiceDistribuidoras): LinhaMunicipio {
  return {
    id: m.ibge,
    municipio: m.nome,
    uf: m.uf,
    submercado: textoSubmercadoMunicipio(m),
    estado_sm: m.sm_estado ? estadoSubmercadoNaTabela(m.sm_estado) : "sem estado",
    distribuidoras: textoDistribuidoras(m, idx),
    situacao: ROTULO_SITUACAO[situacaoVinculo(m)],
    conjuntos: m.conj.length,
    populacao: m.pop,
    mmgd_un: m.mmgd_un,
    mmgd_kw: m.mmgd_kw,
    mmgd_w_hab: m.mmgd_w_hab,
    tsee_faturas: m.tsee_faturas,
    tsee_desconto: m.tsee_desconto,
    tsee_proxy_pct: m.tsee_proxy_pct,
    tsee_base_pequena: m.tsee_base_pequena === null ? null : m.tsee_base_pequena ? "sim" : "não",
    lpt_dom: m.lpt_dom,
    usi_op_n: m.usi_op_n,
    usi_op_mw: m.usi_op_mw,
    usi_cart_n: m.usi_cart_n,
    usi_cart_mw: m.usi_cart_mw,
    usi_reg_n: m.usi_reg_n,
    usi_reg_kw: m.usi_reg_kw,
    usi_multi_n: m.usi_multi.length,
    isol_n: m.isol_n,
    isol_pop: m.isol_pop,
    isol_sede: m.isol_sede === null ? null : m.isol_sede ? "sim" : "não",
  };
}

/* ================================================================ medidas do mapa municipal */

export type DefinicaoMedida = {
  rotulo: string;
  /** Id no catálogo `indicadores` da gold (rótulo completo, natureza e módulo de origem). */
  indicador: string;
  unidade: string;
  casas: number;
  /** Cortes fixos para contagens com muitos zeros; sem eles, quantis (cinco classes). */
  cortes?: number[];
  nota?: string;
};

export const MEDIDA: Record<MedidaMunicipio, DefinicaoMedida> = {
  mmgd_w_hab: { rotulo: "MMGD por habitante", indicador: "mun_mmgd_w_hab", unidade: "W/hab", casas: 1, nota: "Sem população estimada, a razão fica sem dado (nunca zero)." },
  mmgd_kw: { rotulo: "Potência de MMGD", indicador: "mun_mmgd_kw", unidade: "kW", casas: 0, nota: "Total absoluto: a cor acompanha o tamanho do município. Para comparar municípios, use a razão por habitante (MMGD por habitante) ou a proxy da Tarifa Social." },
  mmgd_un: { rotulo: "Unidades de MMGD", indicador: "mun_mmgd_unidades", unidade: "unidades", casas: 0, nota: "Total absoluto: a cor acompanha o tamanho do município. Para comparar municípios, use a razão por habitante (MMGD por habitante) ou a proxy da Tarifa Social." },
  tsee_faturas: { rotulo: "Faturas com Tarifa Social", indicador: "mun_tsee_faturas", unidade: "faturas no mês", casas: 0, nota: "Total absoluto: a cor acompanha o tamanho do município. Para comparar municípios, use a razão por habitante (MMGD por habitante) ou a proxy da Tarifa Social." },
  tsee_proxy_pct: {
    rotulo: "Tarifa Social por família do CadÚnico (proxy)",
    indicador: "mun_tsee_proxy",
    unidade: "%",
    casas: 1,
    nota: "Proxy, não cobertura: faturas com desconto divididas por famílias de baixa renda do Cadastro Único. Município com menos de 50 famílias no denominador tem razão instável (coluna própria na tabela).",
  },
  lpt_dom: { rotulo: "Luz para Todos (domicílios)", indicador: "mun_lpt", unidade: "domicílios", casas: 0, nota: "Município sem linha no arquivo do programa fica sem dado, não zero." },
  usi_op_n: { rotulo: "Usinas em operação só no município", indicador: "mun_usinas_operacao", unidade: "usinas", casas: 0, cortes: [1, 2, 5, 10], nota: "Total absoluto: a cor acompanha o tamanho do município; não há razão por habitante publicada para esta medida." },
  usi_op_mw: { rotulo: "Potência em operação só no município", indicador: "mun_usinas_operacao", unidade: "MW", casas: 1, cortes: [1, 10, 100, 1000], nota: "Total absoluto: a cor acompanha o tamanho do município; não há razão por habitante publicada para esta medida." },
  usi_reg_n: { rotulo: "Registros de até 10 kW", indicador: "mun_registros_10kw", unidade: "registros", casas: 0, cortes: [1, 10, 100, 1000], nota: "Total absoluto: a cor acompanha o tamanho do município; não há razão por habitante publicada para esta medida." },
  isol_n: { rotulo: "Localidades isoladas", indicador: "mun_isolados", unidade: "localidades", casas: 0, cortes: [1, 2, 4] },
};

/** Valor da medida na linha do município: o mesmo número que a tabela mostra e exporta. */
export function valorMedida(l: LinhaMunicipio, med: MedidaMunicipio): number | null {
  const v = l[med];
  return typeof v === "number" ? v : null;
}

export function valoresMedida(linhas: readonly LinhaMunicipio[], med: MedidaMunicipio): Record<string, ValorClassificavel> {
  const out: Record<string, ValorClassificavel> = {};
  for (const l of linhas) out[l.id] = valorMedida(l, med);
  return out;
}

export function classificacaoMedida(med: MedidaMunicipio, valores: readonly ValorClassificavel[]): Classificacao {
  const d = MEDIDA[med];
  return d.cortes ? quebrasFixas(d.cortes, valores, { casas: d.casas }) : quebrasQuantis(valores, CORES_SEQUENCIAIS.length, { casas: d.casas });
}

/* ================================================================ compatibilidade entre camadas */

const GRAO_DA_SELECAO: Record<TipoSelecao, IdGraoTerritorio> = { mun: "municipio", dist: "distribuidora", sm: "submercado", uf: "uf", usi: "usina" };

export function regraCompatibilidade(compat: readonly CompatibilidadeTerritorio[], de: IdGraoTerritorio, para: IdGraoTerritorio): CompatibilidadeTerritorio | null {
  return compat.find((c) => c.de === de && c.para === para) ?? null;
}

/**
 * Como a entidade escolhida aparece numa camada. `valida` falso: a seleção não passa
 * para esta camada e `texto` diz por quê (regra publicada na gold). `aviso` verdadeiro:
 * passa, com ressalva escrita. Os destaques dizem o que o mapa acende; nenhum número
 * muda de grão.
 */
export type Correspondencia = {
  valida: boolean;
  aviso: boolean;
  texto: string | null;
  /** Submercados acesos (um, ou vários listados sem escolher). */
  sms: Submercado[];
  /** UF com contorno. */
  uf: string | null;
  /** Município com contorno. */
  municipio: string | null;
  /** Área de distribuidora acesa (índice). */
  dist: number | null;
  /** Mais de uma distribuidora: listadas, nenhuma escolhida pela página. */
  candidatas: number[];
  /** Municípios acesos (área da distribuidora, municípios declarados de uma usina). */
  municipios: "area" | "declarados" | null;
  /** Usinas acesas: as declaradas no município escolhido, ou a usina escolhida. */
  usinas: "do_municipio" | "a_usina" | null;
};

const VAZIA: Correspondencia = { valida: true, aviso: false, texto: null, sms: [], uf: null, municipio: null, dist: null, candidatas: [], municipios: null, usinas: null };

export type ContextoSelecao = {
  compat: readonly CompatibilidadeTerritorio[];
  municipio?: Pick<MunicipioT, "ibge" | "nome" | "uf" | "sm" | "sm_estado" | "dist" | "isol_sede"> | null;
  distribuidora?: Pick<LinhaDistribuidora, "i" | "sigla" | "submercado_unico" | "submercados" | "parte_fora_do_sin" | "fora_do_sin"> | null;
  uf?: Pick<LinhaUf, "uf" | "subsistema"> | null;
  usina?: Pick<UsinaT, "ceg" | "uf" | "municipios"> | null;
};

function naoPassa(ctx: ContextoSelecao, de: IdGraoTerritorio, para: IdGraoTerritorio, reserva: string): Correspondencia {
  const r = regraCompatibilidade(ctx.compat, de, para);
  return { ...VAZIA, valida: false, texto: r && !r.valida ? r.regra : reserva };
}

/** Submercados citados no texto da distribuidora ("SE: 83; S: 1"), sem o rótulo "sem submercado". */
export function submercadosDaDistribuidora(d: Pick<LinhaDistribuidora, "submercados">): Submercado[] {
  return d.submercados
    .split(";")
    .map((p) => p.trim().split(":")[0])
    .filter((s): s is Submercado => (SUBMERCADOS as readonly string[]).includes(s));
}

export function correspondencia(sel: Selecao, camada: Camada, ctx: ContextoSelecao): Correspondencia {
  if (!sel) return VAZIA;
  const de = GRAO_DA_SELECAO[sel.tipo];
  const para = GRAO_DA_CAMADA[camada];

  if (sel.tipo === "mun") {
    const m = ctx.municipio;
    if (!m) return { ...VAZIA, valida: false, texto: "Município ainda não carregado: o índice municipal é baixado sob demanda." };
    const base = { ...VAZIA, municipio: m.ibge, uf: m.uf };
    if (camada === "municipio") return base;
    if (camada === "usinas") return { ...base, usinas: "do_municipio" };
    if (camada === "submercado") {
      const r = regraCompatibilidade(ctx.compat, "municipio", "submercado");
      if (m.sm_estado === "fora_do_sin" || !m.sm) {
        const motivoFora =
          m.sm_estado === "fora_do_sin"
            ? m.isol_sede === 1
              ? `${m.nome} está fora do SIN: a sede é localidade isolada do PASI. O submercado não se aplica a ele, e a cor da UF não vale para o município.`
              : `${m.nome} está fora do SIN: as localidades isoladas somam ao menos metade da população estimada. O submercado não se aplica a ele, e a cor da UF não vale para o município.`
            : `${m.nome} não tem submercado provado.`;
        return { ...base, valida: false, texto: motivoFora, sms: [] };
      }
      if (m.sm_estado === "com_localidade_isolada")
        return {
          ...base,
          aviso: true,
          sms: [m.sm],
          texto: `${m.nome} fica no submercado ${NOME_SUBMERCADO[m.sm]} pela UF, mas tem localidade isolada fora do SIN: os números do submercado não descrevem essas localidades.`,
        };
      return { ...base, sms: [m.sm], texto: r?.regra ?? null };
    }
    // camada de distribuidoras
    const validos = vinculosValidos(m);
    if (validos.length === 1) return { ...base, dist: validos[0][0] };
    if (validos.length > 1)
      return {
        ...base,
        aviso: true,
        candidatas: validos.map(([i]) => i),
        texto: `${m.nome} é atendido por ${validos.length} distribuidoras na relação oficial. A página lista ${validos.length === 2 ? "as duas" : `as ${validos.length}`} e não escolhe uma: os limites internos do município não são publicados.`,
      };
    if (m.dist.length)
      return {
        ...base,
        aviso: true,
        candidatas: m.dist.map(([i]) => i),
        texto: `${m.nome} só tem vínculo sem confirmação pelo cadastro de MMGD: a distribuidora é listada com ressalva e a área não é acesa.`,
      };
    return { ...base, valida: false, texto: `${m.nome} não tem distribuidora com vínculo na relação oficial vigente.` };
  }

  if (sel.tipo === "dist") {
    const d = ctx.distribuidora;
    if (!d) return { ...VAZIA, valida: false, texto: "Distribuidora sem município na relação vigente." };
    if (camada === "distribuidora") return { ...VAZIA, dist: d.i };
    if (camada === "municipio") return { ...VAZIA, dist: d.i, municipios: "area", texto: regraCompatibilidade(ctx.compat, "distribuidora", "municipio")?.regra ?? null };
    if (camada === "usinas") return naoPassa(ctx, "usina", "distribuidora", "Usina e distribuidora não se correspondem.");
    // submercado
    const sms = d.submercado_unico ? [d.submercado_unico] : submercadosDaDistribuidora(d);
    if (!sms.length) return { ...VAZIA, valida: false, texto: `${d.sigla} não tem município de vínculo válido no SIN: o submercado não se aplica.` };
    const fora = d.parte_fora_do_sin === "sim";
    const partes: string[] = [];
    if (!d.submercado_unico && sms.length > 1) partes.push(`A área de ${d.sigla} tem municípios em ${sms.length} submercados: todos são listados, nenhum é escolhido.`);
    if (fora) partes.push(`${num(d.fora_do_sin, 0)} municípios da área estão fora do SIN e não entram no submercado.`);
    return { ...VAZIA, sms, aviso: partes.length > 0, texto: partes.length ? partes.join(" ") : null };
  }

  if (sel.tipo === "sm") {
    const sm = sel.id as Submercado;
    if (camada === "submercado") return { ...VAZIA, sms: [sm] };
    if (camada === "usinas") return naoPassa(ctx, "usina", "submercado", "Usina não é ligada a submercado.");
    return naoPassa(ctx, "submercado", "municipio", "Submercado não seleciona município.");
  }

  if (sel.tipo === "uf") {
    const u = ctx.uf;
    if (camada === "submercado") return { ...VAZIA, uf: sel.id, sms: u?.subsistema ? [u.subsistema] : [] };
    // nas outras camadas a UF é só um contorno de referência: nenhum valor da UF desce
    return { ...VAZIA, uf: sel.id };
  }

  // usina
  const u = ctx.usina;
  if (camada === "usinas") return { ...VAZIA, usinas: "a_usina", uf: u?.uf ?? null };
  if (camada === "municipio") return { ...VAZIA, municipios: "declarados", usinas: "a_usina", texto: regraCompatibilidade(ctx.compat, "usina", "municipio")?.regra ?? null };
  if (camada === "submercado") return naoPassa(ctx, "usina", "submercado", "Usina não é ligada a submercado.");
  return naoPassa(ctx, de, para, "Usina não é ligada a distribuidora.");
}

/* ================================================================ textos derivados */

function lista(itens: string[]): string {
  if (itens.length <= 1) return itens[0] ?? "";
  return `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}

/** Resposta curta do painel, toda tirada do resumo da gold. */
export function respostaTerritorio(g: Pick<GoldTerritorio, "resumo" | "referencias" | "distribuidoras">): string {
  const r = g.resumo;
  const e = r.municipios_por_estado_submercado;
  const comArea = g.distribuidoras.filter((d) => d.area.municipios > 0).length;
  const provados = (e.provado ?? 0) + (e.provado_com_area_sem_carga ?? 0);
  const soSem = r.municipios_so_vinculo_nao_confirmado.length;
  const sem = r.municipios_sem_vinculo.length;
  const partesDist = [`${inteiro(r.municipios_com_distribuidora)} têm distribuidora com vínculo válido`, `${inteiro(r.municipios_compartilhados)} delas com mais de uma`];
  const restoDist: string[] = [];
  if (soSem) restoDist.push(`${inteiro(soSem)} só com vínculo sem confirmação`);
  if (sem) restoDist.push(`${inteiro(sem)} sem vínculo`);
  const u = r.usinas;
  return (
    `Escolha uma região para ver preço, tarifa, perdas, continuidade e usinas, cada um na área e na unidade da fonte. Cobertura desta publicação: ` +
    `os ${inteiro(r.municipios)} municípios do IBGE estão ligados a ${inteiro(comArea)} distribuidoras pela relação oficial da ANEEL de ${g.referencias.relacao_distribuidoras_ano ?? "sem data"}: ` +
    `${partesDist.join(", ")}${restoDist.length ? `; ${lista(restoDist)}` : ""}. ` +
    `Pela UF, ${inteiro(provados)} municípios estão num submercado com a pertença provada pela carga do ONS, ` +
    `${inteiro(e.com_localidade_isolada ?? 0)} ficam no submercado da UF com localidade isolada e ${inteiro(e.fora_do_sin ?? 0)} estão fora do SIN, sem submercado. ` +
    `Das ${inteiro(u.total)} usinas do SIGA de ${dataBR(g.referencias.siga_data)}, ${inteiro(u.todos_municipios_reconhecidos)} têm todos os municípios declarados reconhecidos.`
  );
}

/**
 * Veredito do P002 em palavras comuns: o que a página faz e de quem é cada número (do submercado, da distribuidora inteira
 * ou do conjunto elétrico). Cita só as camadas que a gold traz; a cobertura por município, distribuidora, submercado e usina
 * fica em respostaTerritorio, na segunda camada.
 */
export function vereditoTerritorio(g: Pick<GoldTerritorio, "resumo">): string {
  const r = g.resumo;
  const usinas = r.usinas.total > 0 ? " e usinas" : "";
  const conjunto = r.conjuntos_referenciados > 0 ? " e a continuidade é do conjunto elétrico" : "";
  return `Escolha uma região e veja preço, tarifa, perdas, continuidade${usinas}. Cada número é da área da sua fonte: o preço é do submercado, a tarifa e as perdas são da distribuidora inteira${conjunto}.`;
}

/**
 * "O que mudou": a página não compara com a publicação anterior, então não descreve mudança. Traz só as datas que o campo
 * Período não traz (Tarifa Social, população e a conferência das áreas de carga); as demais ficam no Período, sem repetir.
 */
export function textoAtualidade(g: Pick<GoldTerritorio, "referencias">): string {
  const r = g.referencias;
  const partes = [
    r.tsee_mes_cde && `Tarifa Social de ${textoReferencia(r.tsee_mes_cde)}`,
    r.populacao_ano !== null && `população estimada de ${r.populacao_ano}`,
  ].filter((x): x is string => typeof x === "string");
  const dias = r.areas_carga_dias.map(dataBR);
  return `Sem comparação com a publicação anterior.${partes.length ? ` Datas que o Período não traz: ${lista(partes)}.` : ""}${dias.length ? ` A pertença das áreas de carga ao submercado foi conferida em ${lista(dias)}.` : ""}`;
}

export type ContextoTexto = {
  distribuidoras: IndiceDistribuidoras;
  populacaoAno: number | null;
};

/** Resposta da ficha de um município: quem atende, em que submercado e o que é do próprio município. */
export function respostaMunicipio(m: MunicipioT, ctx: ContextoTexto): string {
  const nome = `${m.nome} (${m.uf})`;
  const validos = vinculosValidos(m);
  const sigla = (i: number) => ctx.distribuidoras.get(i)?.sigla ?? `distribuidora ${i}`;
  let quem: string;
  if (validos.length === 1) quem = `${nome} é atendido pela distribuidora ${sigla(validos[0][0])} (vínculo ${ROTULO_VINCULO[validos[0][1]]})`;
  else if (validos.length > 1) quem = `${nome} é atendido por ${validos.length} distribuidoras: ${lista(validos.map(([i]) => sigla(i)))}`;
  else if (m.dist.length) quem = `${nome} só tem vínculo sem confirmação, com ${lista(m.dist.map(([i]) => sigla(i)))}`;
  else quem = `${nome} não tem distribuidora com vínculo na relação oficial vigente`;

  let onde: string;
  if (m.sm_estado === "fora_do_sin")
    onde = m.isol_sede === 1 ? "e está fora do SIN, porque a sede é localidade isolada: o submercado não se aplica" : "e está fora do SIN, porque as localidades isoladas somam ao menos metade da população: o submercado não se aplica";
  else if (!m.sm) onde = "e não tem submercado provado";
  else if (m.sm_estado === "com_localidade_isolada") onde = `e fica no submercado ${NOME_SUBMERCADO[m.sm]} pela UF, com localidade isolada fora do SIN`;
  else onde = `e fica no submercado ${NOME_SUBMERCADO[m.sm]} pela UF`;

  const doMun: string[] = [];
  doMun.push(m.pop === null ? "população sem dado" : `${inteiro(m.pop)} habitantes (IBGE, ${ctx.populacaoAno ?? "sem ano"})`);
  if (m.mmgd_un === null) doMun.push("MMGD sem dado");
  else if (m.mmgd_un === 0) doMun.push("nenhuma unidade de MMGD");
  else doMun.push(`${inteiro(m.mmgd_un)} ${m.mmgd_un === 1 ? "unidade" : "unidades"} de MMGD (${numTexto(m.mmgd_kw, 0)} kW)`);
  if (m.usi_op_n === 0) doMun.push("nenhuma usina em operação declarada só nele");
  else doMun.push(`${inteiro(m.usi_op_n)} ${m.usi_op_n === 1 ? "usina" : "usinas"} em operação declarada${m.usi_op_n === 1 ? "" : "s"} só nele (${numTexto(m.usi_op_mw, 1)} MW)`);
  if (m.usi_reg_n > 0) doMun.push(`${inteiro(m.usi_reg_n)} ${m.usi_reg_n === 1 ? "registro" : "registros"} de até 10 kW, à parte`);
  return `${quem} ${onde}. No município: ${lista(doMun)}.`;
}

export function respostaDistribuidora(d: LinhaDistribuidora): string {
  const area =
    `${d.sigla} atende ${inteiro(d.municipios)} ${d.municipios === 1 ? "município" : "municípios"} na relação oficial (${inteiro(d.confirmados)} confirmados` +
    `${d.so_mmgd ? `, ${inteiro(d.so_mmgd)} só pelo cadastro de MMGD` : ""}${d.nao_confirmados ? `, ${inteiro(d.nao_confirmados)} sem confirmação` : ""}), em ${d.ufs || "nenhuma UF"}`;
  const sm = d.submercado_unico
    ? `; submercado ${NOME_SUBMERCADO[d.submercado_unico]}`
    : submercadosDaDistribuidora(d).length > 1
      ? `; municípios em ${submercadosDaDistribuidora(d).length} submercados`
      : "";
  const fora = d.fora_do_sin ? `; ${inteiro(d.fora_do_sin)} fora do SIN` : "";
  const valores: string[] = [];
  valores.push(d.perdas_pct === null ? "perdas sem dado" : `perdas de ${num(d.perdas_pct, 2)}% da energia injetada em ${d.perdas_ano}${d.perdas_situacao === "ano parcial" ? " (ano parcial)" : ""}`);
  valores.push(d.dec_h === null ? "DEC sem dado" : `DEC de ${num(d.dec_h, 2)} h em ${d.qual_ano}`);
  valores.push(d.tarifa === null ? "tarifa B1 sem dado" : `tarifa B1 de R$ ${num(d.tarifa, 2)}/MWh sem tributos`);
  return `${area}${sm}${fora}. Valores da área inteira da distribuidora, não de um município: ${lista(valores)}.`;
}

export function respostaSubmercado(s: LinhaSubmercado): string {
  const valores: string[] = [];
  valores.push(s.pld_dia === null ? "PLD do dia sem dado" : `PLD médio de R$ ${num(s.pld_dia, 2)}/MWh em ${dataBR(s.pld_dia_ref)}`);
  valores.push(s.ear_pct === null ? "EAR sem dado" : `energia armazenada de ${num(s.ear_pct, 1)}% da máxima em ${dataBR(s.ear_ref)}`);
  const frase = valores.join(" e ");
  return `${s.nome} reúne ${inteiro(s.n_ufs)} UFs (${s.ufs}). ${frase.charAt(0).toUpperCase()}${frase.slice(1)}. Os valores são do submercado inteiro, não de uma UF nem de um município.`;
}

export function respostaUf(u: LinhaUf): string {
  const sm = u.subsistema ? `está no submercado ${NOME_SUBMERCADO[u.subsistema]} (camada oficial da EPE; ${u.estado})` : "não tem submercado provado";
  const fora = u.fora_do_sin ? `, ${inteiro(u.fora_do_sin)} fora do SIN` : "";
  const regs = u.cap_registros ? ` (mais ${inteiro(u.cap_registros)} ${u.cap_registros === 1 ? "registro" : "registros"} de até 10 kW, à parte)` : "";
  const cap =
    u.cap_mw === null
      ? "capacidade sem dado"
      : u.cap_usinas === null
        ? `${num(u.cap_mw, 1)} MW em operação fiscalizados pela UF principal`
        : `${inteiro(u.cap_usinas)} usinas em operação${regs}, com ${num(u.cap_mw, 1)} MW fiscalizados pela UF principal`;
  return `${u.nome ?? u.uf} ${sm}. ${inteiro(u.municipios)} municípios${fora}; ${cap}.`;
}

export function respostaUsina(u: UsinaT, nomeMunicipio: (ibge: string) => string): string {
  const est = (ROTULO_ESTAGIO as Record<string, string>)[u.estagio]?.toLowerCase() ?? u.estagio;
  const pot = potenciaUsina(u);
  const potTexto = pot === null ? "potência sem dado" : `${num(pot, pot < 1 ? 3 : 1)} MW ${u.estagio === "operacao" ? "fiscalizados" : "outorgados"}`;
  const muns = u.municipios.map(nomeMunicipio);
  const decl =
    u.n_declarados > 1
      ? `declarada em ${u.n_declarados} municípios (${lista(muns)}), sem a potência repartida entre eles`
      : muns.length
        ? `declarada em ${muns[0]}`
        : "sem município reconhecido";
  const coord =
    u.coord_no_declarado === 1
      ? " A coordenada do SIGA cai dentro de um município declarado."
      : u.coord_no_declarado === 0
        ? " A coordenada do SIGA cai fora dos municípios declarados (a declaração prevalece)."
        : "";
  const reg = u.registro_ate_10kw ? " É um registro de até 10 kW, fora da contagem de usinas do município." : "";
  return `${u.nome} (${u.tipo}, ${est}) tem ${potTexto} e está ${decl}.${coord}${reg}`;
}

/* ================================================================ ligações para os módulos de origem */

/** Links que levam a seleção para a página de origem quando ela aceita a mesma entidade (CNPJ ou código IBGE). */
export function linksDistribuidora(cnpj: string): LinkModulo[] {
  return [
    { rotulo: "Perdas desta distribuidora", href: `/setor-eletrico/perdas?d=${cnpj}` },
    { rotulo: "DEC e FEC desta distribuidora", href: `/setor-eletrico/qualidade?dist=${cnpj}` },
    { rotulo: "Tarifa desta distribuidora", href: `/setor-eletrico/conta-de-luz?dist=${cnpj}` },
  ];
}

export function linksMunicipio(ibge: string): LinkModulo[] {
  return [
    { rotulo: "Histórico de MMGD deste município", href: `/setor-eletrico/transicao/mmgd?mmgd.mun=1&mmgd.msel=${ibge}#p063` },
    { rotulo: "Interrupções neste município", href: `/setor-eletrico/qualidade?mun=${ibge}` },
  ];
}

/** Próxima pergunta de cada camada, com a pergunta e o endereço do destino na navegação. */
export function proximaPergunta(camada: Camada): { pergunta: string; href: string } {
  const slug = camada === "submercado" ? "pld" : camada === "distribuidora" ? "perdas" : camada === "municipio" ? "transicao" : "expansao";
  const d = destino(slug);
  return { pergunta: d.pergunta, href: d.href };
}

/* ================================================================ tabelas */

export const COLUNAS_SUBMERCADOS: ColunaTabela[] = [
  { id: "nome", rotulo: "Submercado", tipo: "texto" },
  { id: "ufs", rotulo: "UFs", tipo: "texto" },
  { id: "pld_dia", rotulo: "PLD médio do dia", tipo: "numero", unidade: "R$/MWh", casas: 2 },
  { id: "pld_mes", rotulo: "PLD médio do mês", tipo: "numero", unidade: "R$/MWh", casas: 2 },
  { id: "ear_pct", rotulo: "EAR", tipo: "percentual", casas: 1 },
  { id: "ear_mwmes", rotulo: "EAR", tipo: "numero", unidade: "MWmês", casas: 0 },
  { id: "mmgd_ons", rotulo: "Carga atendida por MMGD (estimativa do ONS)", tipo: "numero", unidade: "MWmed", casas: 0 },
  { id: "mediana_residuo", rotulo: "Mediana do resíduo da soma das áreas", tipo: "texto" },
];

export const COLUNAS_UFS_SUBMERCADO: ColunaTabela[] = [
  { id: "uf", rotulo: "UF", tipo: "texto" },
  { id: "nome", rotulo: "Nome", tipo: "texto" },
  { id: "submercado", rotulo: "Submercado (cor no mapa)", tipo: "texto", categorica: true },
  { id: "estado", rotulo: "Pertença ao submercado (só a ressalva)", tipo: "texto", categorica: true },
  { id: "areas", rotulo: "Áreas de carga do ONS", tipo: "texto" },
  { id: "municipios", rotulo: "Municípios", tipo: "numero", casas: 0 },
  { id: "fora_do_sin", rotulo: "Municípios fora do SIN", tipo: "numero", casas: 0 },
  { id: "com_localidade_isolada", rotulo: "Com localidade isolada", tipo: "numero", casas: 0 },
];

export const COLUNAS_UFS_INDICADORES: ColunaTabela[] = [
  { id: "uf", rotulo: "UF", tipo: "texto" },
  { id: "submercado", rotulo: "Submercado", tipo: "texto", categorica: true },
  { id: "cap_usinas", rotulo: "Usinas em operação (UF principal, sem registros de até 10 kW)", tipo: "numero", casas: 0 },
  { id: "cap_registros", rotulo: "Registros de até 10 kW em operação (UF principal)", tipo: "numero", casas: 0 },
  { id: "cap_mw", rotulo: "Capacidade em operação (todas as usinas, em MW)", tipo: "numero", unidade: "MW", casas: 1 },
  { id: "tsee_faturas", rotulo: "Faturas com Tarifa Social (contagem do mês)", tipo: "numero", unidade: "faturas no mês", casas: 0 },
  { id: "tsee_desconto", rotulo: "Desconto líquido da Tarifa Social (com cancelamentos e refaturamentos)", tipo: "numero", unidade: "R$ líquidos no mês", casas: 2 },
  { id: "isol_localidades", rotulo: "Localidades isoladas", tipo: "numero", casas: 0 },
  { id: "isol_pop", rotulo: "População em localidades isoladas", tipo: "numero", casas: 0 },
];

export const COLUNAS_DISTRIBUIDORAS: ColunaTabela[] = [
  { id: "sigla", rotulo: "Distribuidora", tipo: "texto" },
  { id: "nome", rotulo: "Razão social", tipo: "texto" },
  { id: "cnpj_formatado", rotulo: "CNPJ", tipo: "texto" },
  { id: "ufs", rotulo: "UFs", tipo: "texto", categorica: true },
  { id: "municipios", rotulo: "Municípios", tipo: "numero", casas: 0 },
  { id: "confirmados", rotulo: "Confirmados", tipo: "numero", casas: 0 },
  { id: "compartilhados", rotulo: "Compartilhados", tipo: "numero", casas: 0 },
  { id: "fora_do_sin", rotulo: "Fora do SIN", tipo: "numero", casas: 0 },
  { id: "submercados", rotulo: "Municípios por submercado", tipo: "texto" },
  { id: "perdas_pct", rotulo: "Perdas totais sobre a injetada", tipo: "percentual", casas: 2 },
  { id: "perdas_situacao", rotulo: "Ano das perdas", tipo: "texto", categorica: true },
  { id: "dec_h", rotulo: "DEC", tipo: "numero", unidade: "h", casas: 2 },
  { id: "fec", rotulo: "FEC", tipo: "numero", unidade: "interrupções", casas: 2 },
  { id: "tarifa", rotulo: "Tarifa B1 sem tributos", tipo: "numero", unidade: "R$/MWh", casas: 2 },
  { id: "mmgd_mw", rotulo: "MMGD cadastrada", tipo: "numero", unidade: "MW", casas: 1 },
  { id: "tsee_pct", rotulo: "Residenciais com Tarifa Social", tipo: "percentual", casas: 2 },
];

export function colunasMunicipios(med: MedidaMunicipio | null): ColunaTabela[] {
  const base: ColunaTabela[] = [
    { id: "municipio", rotulo: "Município", tipo: "texto" },
    { id: "uf", rotulo: "UF", tipo: "texto", categorica: true },
    { id: "id", rotulo: "Código IBGE", tipo: "texto" },
  ];
  const resto: ColunaTabela[] = [
    { id: "populacao", rotulo: "População estimada", tipo: "numero", unidade: "hab", casas: 0 },
    { id: "mmgd_un", rotulo: "Unidades de MMGD", tipo: "numero", casas: 0 },
    { id: "mmgd_kw", rotulo: "Potência de MMGD", tipo: "numero", unidade: "kW", casas: 0 },
    { id: "mmgd_w_hab", rotulo: "MMGD por habitante", tipo: "numero", unidade: "W/hab", casas: 1 },
    { id: "tsee_faturas", rotulo: "Faturas com Tarifa Social", tipo: "numero", casas: 0 },
    { id: "tsee_desconto", rotulo: "Desconto líquido da Tarifa Social (com cancelamentos e refaturamentos)", tipo: "numero", unidade: "R$ líquidos", casas: 2 },
    { id: "tsee_proxy_pct", rotulo: "Tarifa Social por família do CadÚnico (proxy)", tipo: "percentual", casas: 1 },
    { id: "tsee_base_pequena", rotulo: "Menos de 50 famílias no CadÚnico", tipo: "texto", categorica: true },
    { id: "lpt_dom", rotulo: "Luz para Todos", tipo: "numero", unidade: "domicílios", casas: 0 },
    { id: "usi_op_n", rotulo: "Usinas em operação só no município", tipo: "numero", casas: 0 },
    { id: "usi_op_mw", rotulo: "Potência em operação", tipo: "numero", unidade: "MW", casas: 3 },
    { id: "usi_cart_n", rotulo: "Usinas a construir só no município", tipo: "numero", casas: 0 },
    { id: "usi_cart_mw", rotulo: "Potência a construir", tipo: "numero", unidade: "MW outorgados", casas: 3 },
    { id: "usi_reg_n", rotulo: "Registros de até 10 kW", tipo: "numero", casas: 0 },
    { id: "usi_reg_kw", rotulo: "Potência dos registros", tipo: "numero", unidade: "kW", casas: 0 },
    { id: "usi_multi_n", rotulo: "Usinas também em outros municípios", tipo: "numero", casas: 0 },
    { id: "isol_n", rotulo: "Localidades isoladas", tipo: "numero", casas: 0 },
    { id: "isol_pop", rotulo: "População das localidades isoladas", tipo: "numero", casas: 0 },
  ];
  // a medida do mapa vem logo depois do nome: é a coluna que a cor do mapa mostra
  const destaque = med ? resto.filter((c) => c.id === med) : [];
  return [...base, ...destaque, ...resto.filter((c) => c.id !== med)];
}

export const COLUNAS_VINCULO: ColunaTabela[] = [
  { id: "municipio", rotulo: "Município", tipo: "texto" },
  { id: "uf", rotulo: "UF", tipo: "texto", categorica: true },
  { id: "id", rotulo: "Código IBGE", tipo: "texto" },
  { id: "situacao", rotulo: "Situação (cor no mapa)", tipo: "texto", categorica: true },
  { id: "distribuidoras", rotulo: "Distribuidoras e estado do vínculo", tipo: "texto" },
  { id: "submercado", rotulo: "Submercado", tipo: "texto", categorica: true },
];

export const COLUNAS_ISOLADOS: ColunaTabela[] = [
  { id: "municipio", rotulo: "Município", tipo: "texto" },
  { id: "uf", rotulo: "UF", tipo: "texto", categorica: true },
  { id: "estado_sm", rotulo: "Estado no mapa", tipo: "texto", categorica: true },
  { id: "isol_n", rotulo: "Localidades isoladas", tipo: "numero", casas: 0 },
  { id: "isol_pop", rotulo: "População das localidades", tipo: "numero", casas: 0 },
  { id: "populacao", rotulo: "População estimada do município", tipo: "numero", casas: 0 },
  { id: "isol_sede", rotulo: "Sede isolada", tipo: "texto", categorica: true },
];

export type LinhaUsina = LinhaTabela & {
  id: string;
  nome: string;
  tipo: string;
  fonte: string;
  estagio: string;
  uf: string | null;
  mw_fiscalizado: number | null;
  mw_outorgado: number | null;
  municipios: string;
  n_declarados: number;
  coordenada: string;
  outorga: string | null;
  registro: string;
};

export function linhaUsina(u: UsinaT, nomeMunicipio: (ibge: string) => string): LinhaUsina {
  return {
    id: u.ceg,
    nome: u.nome,
    tipo: u.tipo,
    fonte: ROTULO_FONTE[fonteDaUsina(u.tipo)],
    estagio: (ROTULO_ESTAGIO as Record<string, string>)[u.estagio] ?? u.estagio,
    uf: u.uf,
    mw_fiscalizado: u.mw_fiscalizado,
    mw_outorgado: u.mw_outorgado,
    municipios: u.municipios.map(nomeMunicipio).join("; "),
    n_declarados: u.n_declarados,
    coordenada: u.coord_no_declarado === 1 ? "no município declarado" : u.coord_no_declarado === 0 ? "fora do município declarado" : "sem conferência",
    outorga: u.outorga,
    registro: u.registro_ate_10kw ? "sim" : "não",
  };
}

export const COLUNAS_USINAS: ColunaTabela[] = [
  { id: "nome", rotulo: "Usina", tipo: "texto" },
  { id: "id", rotulo: "CEG", tipo: "texto" },
  { id: "tipo", rotulo: "Tipo", tipo: "texto", categorica: true },
  { id: "estagio", rotulo: "Estágio", tipo: "texto", categorica: true },
  { id: "uf", rotulo: "UF", tipo: "texto", categorica: true },
  { id: "mw_fiscalizado", rotulo: "Potência fiscalizada", tipo: "numero", unidade: "MW", casas: 3 },
  { id: "mw_outorgado", rotulo: "Potência outorgada", tipo: "numero", unidade: "MW", casas: 3 },
  { id: "municipios", rotulo: "Municípios declarados", tipo: "texto" },
  { id: "coordenada", rotulo: "Coordenada", tipo: "texto", categorica: true },
  { id: "outorga", rotulo: "Outorga", tipo: "texto", categorica: true },
  { id: "registro", rotulo: "Registro de até 10 kW", tipo: "texto", categorica: true },
];

/** Conjuntos elétricos do município: valores do conjunto inteiro, lidos da tabela de conjuntos do índice. */
export type LinhaConjunto = {
  id: string;
  nome: string;
  distribuidora: string;
  ano: number;
  meses: number | null;
  dec_h: number | null;
  fec: number | null;
  dec_lim_h: number | null;
  fec_lim: number | null;
  ucs: number | null;
  n_mun: number;
};

export function conjuntosDoMunicipio(m: Pick<MunicipioT, "conj">, tabela: Record<string, LinhaConjuntoTerritorio>, idx: IndiceDistribuidoras): LinhaConjunto[] {
  return m.conj.flatMap((id) => {
    const c = tabela[String(id)];
    if (!c) return [];
    const [nome, dist, ano, meses, dec, fec, decLim, fecLim, ucs, nMun] = c;
    return [{ id: String(id), nome, distribuidora: dist === null ? "sem distribuidora" : idx.get(dist)?.sigla ?? `distribuidora ${dist}`, ano, meses, dec_h: dec, fec, dec_lim_h: decLim, fec_lim: fecLim, ucs, n_mun: nMun }];
  });
}

/* ================================================================ busca de entidades */

export type EntidadeTerritorio = {
  id: string;
  rotulo: string;
  detalhe: string;
  sinonimos: string[];
  tipo: TipoSelecao;
  /** População do município, só para ordenar e para escrever ao lado da opção (não entra na busca). */
  pop?: number | null;
  populacao?: string;
};

/** População em poucas palavras para a opção da busca ("1,1 mi hab.", "52 mil hab.", "830 hab."). */
export function textoPopulacao(pop: number | null | undefined): string | undefined {
  if (pop === null || pop === undefined || !Number.isFinite(pop)) return undefined;
  if (pop >= 1e6) return `${num(pop / 1e6, 1)} mi hab.`;
  if (pop >= 1e3) return `${num(pop / 1e3, 0)} mil hab.`;
  return `${num(pop, 0)} hab.`;
}

/**
 * Resultados da busca com o nome exato primeiro (sem acento nem maiúscula) e, no resto, na ordem recebida: os municípios entram em
 * `entidadesBusca` por população decrescente, então "Campinas" lista Campinas (SP) antes de Campinas do Piauí e "São Paulo" põe a capital na frente.
 */
export function ordenarResultadosBusca<E extends { rotulo: string }>(itens: readonly E[], consulta: string): E[] {
  const norm = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  const q = norm(consulta);
  return itens.map((e, i) => ({ e, i, exato: norm(e.rotulo) === q ? 0 : 1 })).sort((a, b) => a.exato - b.exato || a.i - b.i).map((x) => x.e);
}

/** Entidades buscáveis: submercados, UFs, distribuidoras e, depois de carregado o índice, municípios. */
export function entidadesBusca(d: Pick<DadosExplorador, "submercados" | "ufs" | "distribuidoras">, municipios: readonly MunicipioT[] | null): EntidadeTerritorio[] {
  const out: EntidadeTerritorio[] = [];
  for (const s of d.submercados) out.push({ id: `sm:${s.id}`, rotulo: s.nome, detalhe: "submercado", sinonimos: [s.id], tipo: "sm" });
  for (const u of d.ufs) out.push({ id: `uf:${u.uf}`, rotulo: u.nome ?? u.uf, detalhe: `UF ${u.uf}`, sinonimos: [u.uf], tipo: "uf" });
  for (const x of d.distribuidoras)
    out.push({ id: `dist:${x.id}`, rotulo: x.sigla, detalhe: `distribuidora · ${x.ufs}`, sinonimos: [x.nome ?? "", x.id, x.cnpj_formatado ?? ""], tipo: "dist" });
  if (municipios)
    // por população decrescente: nas homônimas e nas buscas por parte do nome, o município maior vem antes (o desempate da busca é a ordem recebida)
    for (const m of [...municipios].sort((a, b) => (b.pop ?? -1) - (a.pop ?? -1)))
      out.push({ id: `mun:${m.ibge}`, rotulo: m.nome, detalhe: `município · ${m.uf}`, sinonimos: [m.ibge, m.uf], tipo: "mun", pop: m.pop, populacao: textoPopulacao(m.pop) });
  return out;
}

/** Texto do id de seleção ("mun:3550308") de volta para a seleção. */
export function selecaoDeId(id: string): Selecao {
  return leitorSelecao.ler(id) ?? null;
}

/** Descrição de camada da gold sem o nome de campo do índice municipal entre parênteses ("(sm_estado 'fora_do_sin' no índice municipal)"). */
export function descricaoCamada(descricao: string): string {
  return descricao.replace(/\s*\([a-z]+(?:_[a-z]+)+ '[a-z_]+'[^)]*\)/g, "");
}

/** Qualidade da malha do IBGE como a gold a publica ("minima", "intermediaria") escrita em português. */
export function textoQualidadeMalha(qualidade: string): string {
  const ROTULO: Record<string, string> = { minima: "mínima, simplificada para desenhar", intermediaria: "intermediária", maxima: "máxima" };
  return ROTULO[qualidade] ?? qualidade;
}

/* ================================================================ distribuidoras: o que falta e como se distribuem */

/**
 * Por que algumas distribuidoras ficam sem tarifa B1 residencial no quadro: a vigência anterior terminou e a seguinte ainda não consta no
 * arquivo da ANEEL, a distribuidora foi incorporada por outra, ou o arquivo não tem linha para ela. Escrito a partir do motivo que a gold publica
 * para cada uma; null quando todas têm tarifa.
 */
export function textoSemTarifa(dist: readonly Pick<LinhaDistribuidora, "tarifa" | "tarifa_motivo">[]): string | null {
  const sem = dist.filter((d) => d.tarifa === null);
  if (!sem.length) return null;
  const encerrada = sem.filter((d) => /vigência encerrada/i.test(d.tarifa_motivo ?? "")).length;
  const incorporada = sem.filter((d) => !/vigência encerrada/i.test(d.tarifa_motivo ?? "") && /incorporada/i.test(d.tarifa_motivo ?? "")).length;
  const outras = sem.length - encerrada - incorporada;
  const partes = [
    encerrada ? `${inteiro(encerrada)} tiveram a vigência encerrada e a tarifa seguinte ainda não consta no arquivo da ANEEL` : "",
    incorporada ? `${inteiro(incorporada)} ${incorporada === 1 ? "foi incorporada" : "foram incorporadas"} por outra distribuidora` : "",
    outras ? `${inteiro(outras)} ${outras === 1 ? "não tem" : "não têm"} linha de tarifa residencial no arquivo` : "",
  ].filter(Boolean);
  return `${inteiro(sem.length)} das ${inteiro(dist.length)} distribuidoras do quadro ficam sem tarifa B1 residencial: ${partes.join("; ")}.`;
}

export type QuartisIndicador = { id: string; rotulo: string; unidade: string; casas: number; n: number; min: number | null; p25: number | null; mediana: number | null; p75: number | null; max: number | null };

/**
 * Como os indicadores do quadro de distribuidoras se distribuem entre elas: menor, quartis e maior, só entre as que têm o valor (quantil tipo 7, o
 * mesmo do pipeline). Cada valor é o da área inteira da distribuidora; a distribuição não diz nada sobre um município.
 */
export function quartisDistribuidoras(dist: readonly LinhaDistribuidora[]): QuartisIndicador[] {
  const campos: { id: string; rotulo: string; unidade: string; casas: number; v: (d: LinhaDistribuidora) => number | null }[] = [
    { id: "tarifa", rotulo: "Tarifa B1 residencial, sem tributos", unidade: "R$/MWh", casas: 2, v: (d) => d.tarifa },
    { id: "perdas_pct", rotulo: "Perdas totais sobre a energia injetada", unidade: "%", casas: 2, v: (d) => d.perdas_pct },
    { id: "dec_h", rotulo: "DEC da distribuidora", unidade: "h", casas: 2, v: (d) => d.dec_h },
    { id: "fec", rotulo: "FEC da distribuidora", unidade: "interrupções", casas: 2, v: (d) => d.fec },
    { id: "tsee_pct", rotulo: "Residenciais com Tarifa Social", unidade: "%", casas: 2, v: (d) => d.tsee_pct },
  ];
  return campos.map((c) => {
    const r = resumo(dist.map(c.v));
    return { id: c.id, rotulo: c.rotulo, unidade: c.unidade, casas: c.casas, n: r.n, min: r.min, p25: r.p25, mediana: r.mediana, p75: r.p75, max: r.max };
  });
}

/* ================================================================ recorte do painel (seção 7.2, item 3) */

/**
 * Por que o cadastro tem mais distribuidoras que a relação de municípios: as que não têm município na relação vigente. Quando
 * todas estão inativas na gold, a causa é dita ("encerradas ou absorvidas"); com alguma ativa ou sem informação, só a contagem.
 */
function causaSemArea(ds: readonly Pick<DistribuidoraTerritorio, "area" | "ativa">[]): string {
  const sem = ds.filter((d) => d.area.municipios === 0);
  if (!sem.length) return "";
  return sem.every((d) => d.ativa === false) ? `; as outras ${inteiro(sem.length)} foram encerradas ou absorvidas` : `; ${inteiro(sem.length)} sem município na relação`;
}

/** Universo do painel, todo tirado da gold. */
export function textoUniverso(g: Pick<GoldTerritorio, "resumo" | "ufs" | "submercados" | "distribuidoras">): string {
  const comArea = g.distribuidoras.filter((d) => d.area.municipios > 0).length;
  return (
    `${inteiro(g.resumo.municipios)} municípios do IBGE, ${inteiro(g.ufs.length)} UFs, ${inteiro(g.submercados.length)} submercados, ` +
    `${inteiro(comArea)} distribuidoras com município na relação (de ${inteiro(g.distribuidoras.length)} no cadastro${causaSemArea(g.distribuidoras)}), ` +
    `${inteiro(g.resumo.conjuntos_referenciados)} conjuntos elétricos e ${inteiro(g.resumo.usinas.total)} usinas do SIGA`
  );
}

/** Período do painel: as referências anuais e as diárias mais recentes, agrupadas por data; cada número traz a sua. */
export function textoPeriodoPainel(g: Pick<GoldTerritorio, "referencias">): string {
  const r = g.referencias;
  const porData = new Map<string, string[]>();
  for (const [rotulo, data] of [
    ["tarifa vigente", r.tarifa_data],
    ["SIGA", r.siga_data],
    ["PLD", r.pld_dia],
    ["cadastro de MMGD", r.mmgd_data_cadastro],
    ["EAR", r.ear_dia],
  ] as const) {
    if (!data) continue;
    porData.set(data, [...(porData.get(data) ?? []), rotulo]);
  }
  const diarias = Array.from(porData.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([data, rotulos]) => `${lista(rotulos)} de ${dataBR(data)}`);
  return [
    `relação de distribuidoras de ${r.relacao_distribuidoras_ano ?? "sem data"}`,
    ...(r.perdas_ano === r.qualidade_ano
      ? [`perdas, DEC e FEC de ${r.perdas_ano ?? "sem data"}`]
      : [`perdas de ${r.perdas_ano ?? "sem data"}`, `DEC e FEC de ${r.qualidade_ano ?? "sem data"}`]),
    ...diarias,
    "cada número traz a data da sua fonte",
  ].join("; ");
}
