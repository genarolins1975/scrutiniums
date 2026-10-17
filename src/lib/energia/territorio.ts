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
import type { Idioma } from "@/lib/idioma";
import { dataBR, mesAno, nomeSubmercado, num } from "./formato";
import { idiomaEnergia, tx } from "./idioma";
import {
  CAMADA_TERRITORIO_EN,
  DESCRICAO_CAMADA_EN,
  GRAO_NO_MUNICIPIO_EN,
  GRAO_TERRITORIO_EN,
  OUTORGA_SIGA_EN,
  REGRA_COMPATIBILIDADE_EN,
  rotuloDado,
} from "./i18n/expansao-transicao-territorio";
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

export const CAMADAS = ["submercado", "distribuidora", "municipio", "usinas"] as const; // i18n: dado
export type Camada = (typeof CAMADAS)[number];

/** Nome de cada camada do mapa, no idioma. */
export function rotulosCamada(idioma: Idioma = idiomaEnergia()): Record<Camada, string> {
  return {
    submercado: tx("Submercados", "Submarkets", idioma),
    distribuidora: tx("Distribuidoras", "Distribution utilities", idioma),
    municipio: tx("Municípios", "Municipalities", idioma),
    usinas: tx("Usinas", "Power plants", idioma),
  };
}
export const ROTULO_CAMADA: Record<Camada, string> = rotulosCamada("pt");

/** Grão que cada camada desenha (o da tabela equivalente). */
export const GRAO_DA_CAMADA: Record<Camada, IdGraoTerritorio> = {
  submercado: "submercado",
  distribuidora: "distribuidora",
  municipio: "municipio",
  usinas: "usina", // i18n: dado
};

export const SUBMERCADOS: readonly Submercado[] = ["SE", "S", "NE", "N"];

export const NOME_SUBMERCADO: Record<Submercado, string> = {
  SE: "Sudeste/Centro-Oeste",
  S: "Sul",
  NE: "Nordeste",
  N: "Norte",
};

/** Nome do submercado no idioma (em português, o desta página; em inglês, o do núcleo). */
export function nomeSm(sm: Submercado, idioma: Idioma = idiomaEnergia()): string {
  return idioma === "en" ? nomeSubmercado(sm, "en") : NOME_SUBMERCADO[sm];
}

/** "sim"/"não" no idioma, e o reconhecimento das duas formas (as linhas viajam no idioma da página). */
export function simNao(v: boolean, idioma: Idioma = idiomaEnergia()): string {
  return v ? tx("sim", "yes", idioma) : tx("não", "no", idioma);
}
export function ehSim(v: string | null | undefined): boolean {
  return v === "sim" || v === "yes";
}
/** Ausência dentro de frase. */
export function semDado(idioma: Idioma = idiomaEnergia()): string {
  return tx("sem dado", "no data", idioma);
}

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

export function rotulosEstadoSm(idioma: Idioma = idiomaEnergia()): Record<EstadoSubmercadoMunicipio, string> {
  return {
    provado: tx("conferido pela carga das áreas do ONS", "checked against the load of the ONS areas", idioma),
    provado_com_area_sem_carga: tx(
      "conferido por uma das áreas (a outra sem carga nos dias conferidos)",
      "checked by one of the areas (the other had no load on the days checked)",
      idioma,
    ),
    nao_provado: tx("não conferido", "not checked", idioma),
    com_localidade_isolada: tx("submercado da UF, com localidade isolada fora do SIN", "submarket of the state, with an isolated locality outside the SIN", idioma),
    fora_do_sin: tx("fora do SIN (submercado não se aplica)", "outside the SIN (submarket does not apply)", idioma),
  };
}
export const ROTULO_ESTADO_SM: Record<EstadoSubmercadoMunicipio, string> = rotulosEstadoSm("pt");

/** Pertença nas tabelas: só a exceção é escrita por extenso; o caso comum (conferido) vira "sem ressalva", para a coluna não repetir a mesma frase em quase toda linha. */
export function estadoSubmercadoNaTabela(e: EstadoSubmercadoMunicipio, idioma: Idioma = idiomaEnergia()): string {
  return e === "provado" ? tx("sem ressalva", "no caveat", idioma) : rotulosEstadoSm(idioma)[e];
}

export function rotulosVinculo(idioma: Idioma = idiomaEnergia()): Record<EstadoVinculo, string> {
  return {
    1: tx("confirmado", "confirmed", idioma),
    0: tx("sem confirmação", "unconfirmed", idioma),
    2: tx("só pelo cadastro de MMGD", "only through the MMGD register", idioma),
  };
}
export const ROTULO_VINCULO: Record<EstadoVinculo, string> = rotulosVinculo("pt");

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

export function inteiro(v: number | null | undefined, idioma: Idioma = idiomaEnergia()): string {
  return v === null || v === undefined ? semDado(idioma) : num(v, 0, idioma);
}

export function numTexto(v: number | null | undefined, casas = 1, idioma: Idioma = idiomaEnergia()): string {
  return v === null || v === undefined ? semDado(idioma) : num(v, casas, idioma);
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "2025" → "2025"; "2026-03" → "mar/2026"; "2026-09-30" → "30/09/2026". */
export function textoReferencia(ref: string | null | undefined, idioma: Idioma = idiomaEnergia()): string {
  if (!ref) return tx("sem data", "no date", idioma);
  if (/^\d{4}$/.test(ref)) return ref;
  if (/^\d{4}-\d{2}$/.test(ref)) return idioma === "en" ? mesAno(ref, "en") : `${MESES[Number(ref.slice(5, 7)) - 1]}/${ref.slice(0, 4)}`;
  return dataBR(ref, idioma);
}

/** Período de um bloco: um valor só quando início e fim coincidem. */
export function textoPeriodo(p: { inicio: string | null; fim: string | null } | null | undefined, idioma: Idioma = idiomaEnergia()): string {
  if (!p || (!p.inicio && !p.fim)) return tx("sem data", "no date", idioma);
  if (!p.inicio || p.inicio === p.fim) return textoReferencia(p.fim, idioma);
  return tx(`${textoReferencia(p.inicio, idioma)} a ${textoReferencia(p.fim, idioma)}`, `${textoReferencia(p.inicio, idioma)} to ${textoReferencia(p.fim, idioma)}`, idioma);
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
export function textoDefasagem(fim: string | null | undefined, referencia: string, idioma: Idioma = idiomaEnergia()): string | null {
  const m = mesesDeDefasagem(fim, referencia);
  if (m === null || m < 2) return null;
  return tx(
    `último mês publicado pela fonte: ${textoReferencia(fim, idioma)}, ${m} meses antes desta publicação`,
    `last month published by the source: ${textoReferencia(fim, idioma)}, ${m} months before this release`,
    idioma,
  );
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
export function notaMultiestadual(usinas: readonly UsinaT[], ufPorCodigo: ReadonlyMap<string, string>, idioma: Idioma = idiomaEnergia()): string | null {
  const multi = usinas
    .filter((u) => u.estagio === "operacao" && !u.registro_ate_10kw)
    .map((u) => ({ u, ufs: Array.from(new Set(u.municipios.map((m) => ufPorCodigo.get(m.slice(0, 2))).filter((x): x is string => !!x))) }))
    .filter((x) => x.ufs.length > 1);
  if (!multi.length) return null;
  const e = tx(" e ", " and ", idioma);
  const maiores = [...multi].sort((a, b) => (b.u.mw_fiscalizado ?? 0) - (a.u.mw_fiscalizado ?? 0)).slice(0, 2);
  const exemplos = maiores.map((x) => `${x.u.nome} (${num(x.u.mw_fiscalizado ?? 0, 0, idioma)} MW, ${x.ufs.join(e)})`).join(e);
  const um = multi.length === 1;
  return tx(
    `${inteiro(multi.length, idioma)} ${um ? "usina em operação está declarada" : "usinas em operação estão declaradas"} em municípios de mais de uma UF e entra${um ? "" : "m"} inteira${um ? "" : "s"} na UF principal, sem repartir a potência (as duas maiores: ${exemplos}).`,
    `${inteiro(multi.length, idioma)} ${um ? "operating plant is declared" : "operating plants are declared"} in municipalities of more than one state and ${um ? "is" : "are"} counted whole in the main state, without splitting the capacity (the two largest: ${exemplos}).`,
    idioma,
  );
}

/**
 * Desconto da Tarifa Social: o número que a fonte publica por UF e por município é o desconto líquido do mês, a soma dos descontos com os
 * cancelamentos e refaturamentos, que entram no desconto e não na contagem de faturas. Nunca é lido como a soma de descontos concedidos.
 */
export function textoDescontoLiquido(desconto: number | null | undefined, idioma: Idioma = idiomaEnergia()): string | null {
  if (desconto === null || desconto === undefined) return null;
  const base = tx(
    "Desconto líquido: soma dos descontos do mês com os cancelamentos e refaturamentos, que entram no desconto e não na contagem de faturas.",
    "Net discount: sum of the month's discounts with cancellations and rebillings, which enter the discount and not the count of bills.",
    idioma,
  );
  return desconto < 0
    ? tx(
        `${base} O valor é negativo porque, no mês, os cancelamentos e refaturamentos somaram mais que os descontos concedidos.`,
        `${base} The value is negative because, in the month, cancellations and rebillings added up to more than the discounts granted.`,
        idioma,
      )
    : base;
}

/** Grupo de fonte da usina pelo tipo do SIGA (cor no mapa e filtro). */
export function fonteDaUsina(tipo: string): FonteUsina {
  if (tipo === "UFV") return "solar";
  if (tipo === "EOL") return "eolica";
  if (tipo === "UHE" || tipo === "PCH" || tipo === "CGH") return "hidraulica";
  if (tipo === "UTN") return "nuclear";
  return "termica";
}

export function rotulosFonte(idioma: Idioma = idiomaEnergia()): Record<FonteUsina, string> {
  return {
    solar: tx("Solar (UFV)", "Solar (UFV)", idioma),
    eolica: tx("Eólica (EOL)", "Wind (EOL)", idioma),
    hidraulica: tx("Hidráulica (UHE, PCH, CGH)", "Hydro (UHE, PCH, CGH)", idioma),
    termica: tx("Térmica (UTE)", "Thermal (UTE)", idioma),
    nuclear: tx("Nuclear (UTN)", "Nuclear (UTN)", idioma),
  };
}
export const ROTULO_FONTE: Record<FonteUsina, string> = rotulosFonte("pt");

export const COR_FONTE: Record<FonteUsina, string> = {
  solar: "var(--serie-solar)",
  eolica: "var(--serie-eolica)",
  hidraulica: "var(--serie-hidraulica)",
  termica: "var(--serie-termica)",
  nuclear: "var(--serie-1)",
};

export function rotulosEstagio(idioma: Idioma = idiomaEnergia()): Record<EstagioUsina, string> {
  return {
    operacao: tx("Em operação", "In operation", idioma),
    construcao: tx("Em construção", "Under construction", idioma),
    construcao_nao_iniciada: tx("Construção não iniciada", "Construction not started", idioma),
  };
}
export const ROTULO_ESTAGIO: Record<EstagioUsina, string> = rotulosEstagio("pt");

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
  /** A energia sobre a qual a taxa foi calculada (injetada publicada, requerida ou mistura dos dois no ano); null sem o registro da fonte. */
  perdas_base: string | null;
  /** A mesma perda total sobre a energia injetada publicada, para a distribuidora cuja taxa usa outra base; null quando a base já é a publicada. */
  perdas_pct_pub: number | null;
  /** "sem sinalização" ou o que o módulo Perdas sinalizou (ano parcial, balanço que não fecha, valor fora de 0% a 100%). */
  perdas_sinal: string | null;
  perdas_ressalvas: string | null;
  perdas_motivo: string | null;
  /** Unidades consumidoras do cadastro de continuidade, o peso da mediana ponderada; null sem o dado. */
  ucs: number | null;
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

/** A energia sobre a qual cada distribuidora calcula a taxa de perdas (campo `origem_injetada` do módulo Perdas). */
export type BasePerdas = "publicada" | "requerida" | "mista";
export function rotulosBasePerdas(idioma: Idioma = idiomaEnergia()): Record<BasePerdas, string> {
  return {
    publicada: tx("energia injetada publicada", "published injected energy", idioma),
    requerida: tx("energia requerida", "required energy", idioma),
    mista: tx("energia injetada e requerida no mesmo ano", "injected and required energy in the same year", idioma),
  };
}
export const ROTULO_BASE_PERDAS: Record<BasePerdas, string> = rotulosBasePerdas("pt");
/** A base de perdas de um rótulo de linha, em qualquer dos dois idiomas; null sem base registrada. */
export function baseDoRotulo(rotulo: string | null | undefined): BasePerdas | null {
  if (!rotulo) return null;
  for (const idioma of ["pt", "en"] as const) {
    const r = rotulosBasePerdas(idioma);
    const b = (Object.keys(r) as BasePerdas[]).find((k) => r[k] === rotulo);
    if (b) return b;
  }
  return null;
}
/** "sem registro da base" no idioma. */
export function semRegistroDaBase(idioma: Idioma = idiomaEnergia()): string {
  return tx("sem registro da base", "base not recorded", idioma);
}
/**
 * Do arquivo anual de perdas por distribuidora: a base da taxa, a taxa que o arquivo traz (para conferir com a gold) e a mesma perda total
 * sobre a energia injetada publicada.
 */
export type PerdasDaFonte = { base: BasePerdas; taxa_pct: number | null; taxa_publicada_pct: number | null };

export function semSinalPerdas(idioma: Idioma = idiomaEnergia()): string {
  return tx("sem sinalização", "no flag", idioma);
}
export const SEM_SINAL_PERDAS = semSinalPerdas("pt");
/** Sinal de perdas vazio ("sem sinalização"), em qualquer dos dois idiomas. */
export function ehSemSinalPerdas(s: string | null | undefined): boolean {
  return s === SEM_SINAL_PERDAS || s === semSinalPerdas("en");
}
function rotulosAlertaPerdas(idioma: Idioma): Record<string, string> {
  return {
    balanco_nao_fecha: tx("balanço que não fecha", "balance that does not close", idioma),
    fornecida_maior_que_injetada: tx("energia fornecida maior que a injetada", "energy supplied greater than injected", idioma),
    perda_total_negativa: tx("perda total negativa", "negative total loss", idioma),
  };
}
/** "ano parcial" no idioma e o reconhecimento das duas formas. */
export function anoParcialTexto(idioma: Idioma = idiomaEnergia()): string {
  return tx("ano parcial", "partial year", idioma);
}
export function ehAnoParcial(s: string | null | undefined): boolean {
  return s === "ano parcial" || s === "partial year";
}

/** O que o módulo Perdas sinalizou na taxa da distribuidora, em palavras: ano parcial, balanço que não fecha, valor fora da faixa física. */
export function sinalDePerdas(p: { parcial: boolean; meses: number | null; alertas: readonly string[] }, idioma: Idioma = idiomaEnergia()): string {
  const alerta = rotulosAlertaPerdas(idioma);
  const partes = [
    ...(p.parcial ? [`${anoParcialTexto(idioma)}${p.meses ? tx(` (${p.meses} meses)`, ` (${p.meses} months)`, idioma) : ""}`] : []),
    ...p.alertas.map((a) => alerta[a] ?? a.replace(/_/g, " ")),
  ];
  return partes.length ? partes.join("; ") : semSinalPerdas(idioma);
}

/** Ressalva de perdas que a gold escreve, sem os nomes de alerta do módulo e com a vírgula decimal ("-10.44%" vira "-10,44%"). */
export function ressalvaDePerdas(texto: string): string {
  return texto
    .replace(/\s*\(alertas do módulo Perdas:[^)]*\)/g, "")
    .replace(/(\d)\.(\d+)%/g, "$1,$2%")
    .trim();
}

/** Motivo de ausência com a competência AAAA-MM como mm/aaaa (mesmo tamanho: esta página está no limite de peso). */
export function motivoLegivel(m: string | null): string | null {
  return m ? m.replace(/(^|[^\w@_/.-])([1-9]\d{3})-(0[1-9]|1[0-2])(?![\w@_/-]|\d)/g, "$1$3/$2") : m;
}

export function linhaDistribuidora(d: DistribuidoraTerritorio, perdasArquivo: PerdasDaFonte | null = null, idioma: Idioma = idiomaEnergia()): LinhaDistribuidora {
  const { perdas: p, qualidade: q, tarifa: t, mmgd: m, tsee: s } = d.indicadores;
  // a linha do arquivo anual só vale se for da mesma publicação da gold: a taxa dela confere com a da gold
  const perdasFonte = perdasArquivo && p.disponivel && perdasArquivo.taxa_pct !== null && p.taxa_total_pct !== null && Math.abs(perdasArquivo.taxa_pct - p.taxa_total_pct) <= 0.006 ? perdasArquivo : null;
  return {
    id: d.cnpj,
    i: d.i,
    sigla: d.sigla,
    nome: d.nome,
    cnpj_formatado: d.cnpj_formatado,
    ativa: d.ativa === null ? null : simNao(d.ativa, idioma),
    municipios: d.area.municipios,
    confirmados: d.area.confirmados,
    so_mmgd: d.area.so_mmgd,
    nao_confirmados: d.area.nao_confirmados,
    exclusivos: d.area.exclusivos,
    compartilhados: d.area.compartilhados,
    ufs: d.area.ufs.join(", "),
    fora_do_sin: d.area.fora_do_sin,
    com_localidade_isolada: d.area.com_localidade_isolada,
    submercados: d.submercados.map((x) => `${x.sm ?? tx("sem submercado", "no submarket", idioma)}: ${num(x.municipios, 0, idioma)}`).join("; "),
    submercado_unico: d.submercado_unico,
    parte_fora_do_sin: simNao(d.parte_fora_do_sin, idioma),
    perdas_pct: p.disponivel ? p.taxa_total_pct : null,
    perdas_ano: p.disponivel ? p.ano : null,
    perdas_meses: p.disponivel ? p.meses : null,
    perdas_situacao: p.disponivel ? (p.parcial ? anoParcialTexto(idioma) : tx("ano completo", "full year", idioma)) : null,
    perdas_base: p.disponivel ? (perdasFonte ? rotulosBasePerdas(idioma)[perdasFonte.base] : semRegistroDaBase(idioma)) : null,
    perdas_pct_pub: p.disponivel && perdasFonte && perdasFonte.base !== "publicada" ? perdasFonte.taxa_publicada_pct : null,
    perdas_sinal: p.disponivel ? sinalDePerdas(p, idioma) : null,
    perdas_ressalvas: p.disponivel && p.ressalvas.length ? p.ressalvas.map(ressalvaDePerdas).join(" ") : null,
    perdas_motivo: motivo(p),
    ucs: q.disponivel ? q.ucs : null,
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
    tarifa_vigencia:
      t.disponivel && t.vigencia_inicio
        ? tx(`${dataBR(t.vigencia_inicio, idioma)} a ${dataBR(t.vigencia_fim, idioma)}`, `${dataBR(t.vigencia_inicio, idioma)} to ${dataBR(t.vigencia_fim, idioma)}`, idioma)
        : null,
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

function rotulosVeredito(idioma: Idioma): Record<AreaCargaUf["veredito"], string> {
  return {
    provada: tx("conferida", "checked", idioma),
    indeterminada: tx("sem carga nos dias conferidos", "no load on the days checked", idioma),
    ambigua: tx("ambígua", "ambiguous", idioma),
    reprovada: tx("não confere", "does not match", idioma),
  };
}

export function textoAreasCarga(areas: readonly AreaCargaUf[], idioma: Idioma = idiomaEnergia()): string {
  const v = rotulosVeredito(idioma);
  const no = tx(" no ", " in ", idioma);
  return areas.map((a) => `${a.codigo} (${a.nome}): ${v[a.veredito]}${a.submercado_hipotese ? `${no}${a.submercado_hipotese}` : ""}`).join("; ");
}

/**
 * O que "conferido" quer dizer nesta página, com o teste por extenso. A base publicada diz "provada" para a área que passa; aqui a palavra é "conferida"
 * porque o teste é de consistência da carga em dois dias, com a tolerância publicada, e não a medida de uma fronteira do submercado.
 */
export function textoTesteDeCarga(g: Pick<GoldTerritorio, "areas_carga" | "ufs">, idioma: Idioma = idiomaEnergia()): string {
  const dias = [...g.areas_carga.dias].sort().map((d) => dataBR(d, idioma));
  const tol = g.areas_carga.conferencias.map((c) => c.tolerancia_mwmed).find((x) => typeof x === "number");
  const parciais = g.ufs.filter((u) => u.estado_subsistema === "provado_com_area_sem_carga").map((u) => u.nome ?? u.uf);
  const quando =
    dias.length === 2
      ? tx(`nos dois dias conferidos (${dias[0]} e ${dias[1]})`, `on the two days checked (${dias[0]} and ${dias[1]})`, idioma)
      : dias.length
        ? tx(`em ${lista(dias, idioma)}`, `on ${lista(dias, idioma)}`, idioma)
        : tx("nos dias conferidos", "on the days checked", idioma);
  const residuo =
    typeof tol === "number"
      ? tx(`, com a mediana do resíduo por meia hora dentro de ${num(tol, 0, idioma)} MWmed`, `, with the median residual per half hour within ${num(tol, 0, idioma)} MWavg`, idioma)
      : "";
  const doisDias = dias.length === 2;
  const umaUf = parciais.length === 1;
  return (
    tx(
      `Conferido quer dizer que, ${quando}, a carga de cada submercado fecha com a soma das suas áreas de carga do ONS${residuo}, `,
      `Checked means that, ${quando}, the load of each submarket matches the sum of its ONS load areas${residuo}, `,
      idioma,
    ) +
    tx(
      `e que nenhuma troca de áreas testada também fecha. É um teste de consistência da carga em ${doisDias ? "dois dias" : "poucos dias"}, não a medida de uma fronteira.`,
      `and that no swap of areas tested also matches. It is a consistency test of the load on ${doisDias ? "two days" : "a few days"}, not the measurement of a boundary.`,
      idioma,
    ) +
    (parciais.length
      ? tx(
          ` ${lista(parciais, idioma)} ${umaUf ? "é conferido" : "são conferidos"} só por uma das áreas, porque a outra não tinha carga nos dias conferidos.`,
          ` ${lista(parciais, idioma)} ${umaUf ? "is checked" : "are checked"} by only one of the areas, because the other had no load on the days checked.`,
          idioma,
        )
      : "")
  );
}

/**
 * A linha de uma UF. A gold publica `usinas` com os registros de até 10 kW dentro; com `separacao` (lida do arquivo de usinas), a contagem
 * exclui esses registros e eles vão para a coluna ao lado. Sem o arquivo de usinas a contagem fica sem dado, nunca com o total misturado.
 */
export function linhaUf(u: UfTerritorio, separacao?: UsinasDaUf | null, idioma: Idioma = idiomaEnergia()): LinhaUf {
  const { capacidade: c, tsee: t, isolados: i } = u.indicadores;
  return {
    id: u.uf,
    uf: u.uf,
    nome: u.nome,
    codigo: u.codigo,
    subsistema: u.subsistema,
    submercado: u.subsistema ? nomeSm(u.subsistema, idioma) : tx("sem submercado", "no submarket", idioma),
    estado: estadoSubmercadoNaTabela(u.estado_subsistema, idioma),
    areas: textoAreasCarga(u.areas_carga, idioma),
    municipios: u.municipios,
    fora_do_sin: u.municipios_fora_do_sin,
    // a gold conta na UF todos os municípios com localidade isolada, inclusive os fora do SIN; a legenda do mapa e a tabela contam os de dentro do SIN
    com_localidade_isolada: Math.max(0, u.municipios_com_localidade_isolada - u.municipios_fora_do_sin),
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
            .map(([k, v]) => `${k} ${num(v, 1, idioma)} MW`)
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

export function linhaSubmercado(s: SubmercadoTerritorio, idioma: Idioma = idiomaEnergia()): LinhaSubmercado {
  const { pld_dia: d, pld_mes: m, ear: e, mmgd_ons: o } = s.indicadores;
  return {
    id: s.sm,
    nome: idioma === "en" ? nomeSm(s.sm, "en") : s.nome,
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
    mediana_residuo: s.conferencia.map((c) => `${dataBR(c.dia, idioma)}: ${num(c.mediana_abs_mwmed, 2, idioma)} ${tx("MWmed", "MWavg", idioma)}`).join("; "),
  };
}

/** Rótulo e fonte de cada grão, para a ficha dizer de quem é cada número. */
export type GraoResumo = { id: IdGraoTerritorio; rotulo: string; rotulo_no_municipio: string };

/** Fonte curta de um bloco: órgão, conjunto e período do valor exibido. */
export type FonteCurta = { orgao: string; conjunto: string; periodo: string; natureza: string; url: string };

export function fonteCurta(p: Proveniencia | undefined, idioma: Idioma = idiomaEnergia()): FonteCurta | null {
  if (!p) return null;
  return { orgao: p.fonte.orgao, conjunto: p.fonte.dataset, periodo: textoPeriodo(p.periodo_referencia, idioma), natureza: p.natureza, url: p.fonte.url_dataset };
}

export const CHAVES_FONTE = [
  "subsistema_uf", "areas_carga", "distribuidora_perdas", "distribuidora_qualidade", "conjuntos", "distribuidora_tarifa", "mmgd", "mmgd_ons",
  "populacao", "tarifa_social", "luz_para_todos", "isolados", "usinas", "pld_dia", "pld_mes", "ear", "indice", // i18n: dado
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

/** Rótulo de grão ou camada da gold no idioma (tabela exata; sem entrada, o rótulo publicado). */
function daGold(texto: string, tabela: Readonly<Record<string, string>>, idioma: Idioma): string {
  return rotuloDado(texto, tabela, idioma);
}

/** Descrição de camada da gold no idioma: em inglês, a tradução exata; em português, a forma legível. */
export function descricaoCamadaNoIdioma(descricao: string, idioma: Idioma = idiomaEnergia()): string {
  if (idioma === "en" && DESCRICAO_CAMADA_EN[descricao]) return DESCRICAO_CAMADA_EN[descricao];
  return textoLegivel(descricao);
}

/** Regra de compatibilidade da gold no idioma: em inglês, a tradução exata; em português (ou sem entrada), como publicada. */
export function regraNoIdioma(regra: string, idioma: Idioma = idiomaEnergia()): string {
  return idioma === "en" ? (REGRA_COMPATIBILIDADE_EN[regra] ?? regra) : regra;
}

export function dadosExplorador(
  g: GoldTerritorio,
  usinas: readonly UsinaT[] | null = null,
  perdasFonte: ReadonlyMap<string, PerdasDaFonte> | null = null,
  idioma: Idioma = idiomaEnergia(),
): DadosExplorador {
  const fontes: Partial<Record<ChaveFonte, FonteCurta>> = {};
  const porUf = usinas ? usinasDaUf(usinas) : null;
  const vazia: UsinasDaUf = { usinas: 0, registros: 0, um_municipio: 0, multimunicipio: 0, sem_municipio: 0 };
  for (const k of CHAVES_FONTE) {
    const f = fonteCurta(g.proveniencia[k], idioma);
    if (f) fontes[k] = f;
  }
  return {
    dataReferencia: g.data_referencia,
    referencias: g.referencias,
    submercados: g.submercados.map((x) => linhaSubmercado(x, idioma)),
    ufs: g.ufs.map((u) => linhaUf(u, porUf ? (porUf.get(u.uf) ?? vazia) : null, idioma)),
    distribuidoras: g.distribuidoras.filter((d) => d.area.municipios > 0).map((d) => linhaDistribuidora(d, perdasFonte?.get(d.cnpj) ?? null, idioma)),
    compatibilidade: idioma === "en" ? g.compatibilidade.map((c) => ({ ...c, regra: regraNoIdioma(c.regra, idioma) })) : g.compatibilidade,
    graos: g.graos.map((x) => ({
      id: x.id,
      rotulo: daGold(x.rotulo, GRAO_TERRITORIO_EN, idioma),
      rotulo_no_municipio: daGold(x.rotulo_no_municipio, GRAO_NO_MUNICIPIO_EN, idioma),
    })),
    camadas: g.camadas.map((c) => ({ id: c.id, rotulo: daGold(c.rotulo, CAMADA_TERRITORIO_EN, idioma), descricao: descricaoCamadaNoIdioma(c.descricao, idioma) })),
    fontes,
    arquivos: { municipios: g.series.municipios, usinas: g.series.usinas, geoUf: g.geometria.uf, geoMunicipios: g.geometria.municipios },
    limiteRegistroKw: g.resumo.usinas.limite_registro_kw,
    notaMultiestadual: usinas ? notaMultiestadual(usinas, new Map(g.ufs.filter((u) => u.codigo).map((u) => [String(u.codigo), u.uf])), idioma) : null,
    estadosVinculo: { 0: rotulosVinculo(idioma)[0], 1: rotulosVinculo(idioma)[1], 2: rotulosVinculo(idioma)[2] },
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

export function rotulosSituacao(idioma: Idioma = idiomaEnergia()): Record<SituacaoVinculo, string> {
  return {
    exclusiva: tx("Uma distribuidora", "One distribution utility", idioma),
    compartilhado: tx("Mais de uma distribuidora", "More than one distribution utility", idioma),
    so_sem_confirmacao: tx("Só vínculo sem confirmação", "Only an unconfirmed link", idioma),
    sem_vinculo: tx("Sem vínculo na relação", "No link in the official list", idioma),
  };
}
export const ROTULO_SITUACAO: Record<SituacaoVinculo, string> = rotulosSituacao("pt");

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
export function textoDistribuidoras(m: Pick<MunicipioT, "dist">, idx: IndiceDistribuidoras, idioma: Idioma = idiomaEnergia()): string {
  if (!m.dist.length) return tx("sem vínculo", "no link", idioma);
  const v = rotulosVinculo(idioma);
  return m.dist.map(([i, e]) => `${idx.get(i)?.sigla ?? tx(`distribuidora ${i}`, `utility ${i}`, idioma)} (${v[e]})`).join("; ");
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

export function textoSubmercadoMunicipio(m: Pick<MunicipioT, "sm" | "sm_estado">, idioma: Idioma = idiomaEnergia()): string {
  if (m.sm_estado === "fora_do_sin") return tx("não se aplica (fora do SIN)", "does not apply (outside the SIN)", idioma);
  return m.sm ? nomeSm(m.sm, idioma) : tx("sem submercado conferido", "no checked submarket", idioma);
}

export function linhaMunicipio(m: MunicipioT, idx: IndiceDistribuidoras, idioma: Idioma = idiomaEnergia()): LinhaMunicipio {
  return {
    id: m.ibge,
    municipio: m.nome,
    uf: m.uf,
    submercado: textoSubmercadoMunicipio(m, idioma),
    estado_sm: m.sm_estado ? estadoSubmercadoNaTabela(m.sm_estado, idioma) : tx("sem estado", "no status", idioma),
    distribuidoras: textoDistribuidoras(m, idx, idioma),
    situacao: rotulosSituacao(idioma)[situacaoVinculo(m)],
    conjuntos: m.conj.length,
    populacao: m.pop,
    mmgd_un: m.mmgd_un,
    mmgd_kw: m.mmgd_kw,
    mmgd_w_hab: m.mmgd_w_hab,
    tsee_faturas: m.tsee_faturas,
    tsee_desconto: m.tsee_desconto,
    tsee_proxy_pct: m.tsee_proxy_pct,
    tsee_base_pequena: m.tsee_base_pequena === null ? null : simNao(!!m.tsee_base_pequena, idioma),
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
    isol_sede: m.isol_sede === null ? null : simNao(!!m.isol_sede, idioma),
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

/** Medidas do mapa municipal, com rótulo, unidade e nota no idioma. */
export function medidas(idioma: Idioma = idiomaEnergia()): Record<MedidaMunicipio, DefinicaoMedida> {
  const absoluto = tx("Total absoluto: a cor acompanha o tamanho do município. Para comparar municípios, use a razão por habitante (MMGD por habitante) ou a proxy da Tarifa Social.", "Absolute total: the color follows the size of the municipality. To compare municipalities, use the ratio per inhabitant (MMGD per inhabitant) or the Social Tariff proxy.", idioma);
  const absolutoSemRazao = tx("Total absoluto: a cor acompanha o tamanho do município; não há razão por habitante publicada para esta medida.", "Absolute total: the color follows the size of the municipality; there is no ratio per inhabitant published for this measure.", idioma);
  return {
    mmgd_w_hab: {
      rotulo: tx("MMGD por habitante", "MMGD per inhabitant", idioma),
      indicador: "mun_mmgd_w_hab",
      unidade: tx("W/hab", "W/inhab.", idioma),
      casas: 1,
      nota: tx("Sem população estimada, a razão fica sem dado (nunca zero).", "Without an estimated population, the ratio has no data (never zero).", idioma),
    },
    mmgd_kw: { rotulo: tx("Potência de MMGD", "MMGD capacity", idioma), indicador: "mun_mmgd_kw", unidade: "kW", casas: 0, nota: absoluto },
    mmgd_un: { rotulo: tx("Unidades de MMGD", "MMGD units", idioma), indicador: "mun_mmgd_unidades", unidade: tx("unidades", "units", idioma), casas: 0, nota: absoluto },
    tsee_faturas: {
      rotulo: tx("Faturas com Tarifa Social", "Bills with the Social Tariff", idioma),
      indicador: "mun_tsee_faturas",
      unidade: tx("faturas no mês", "bills in the month", idioma),
      casas: 0,
      nota: absoluto,
    },
    tsee_proxy_pct: {
      rotulo: tx("Tarifa Social por família do CadÚnico (proxy)", "Social Tariff per CadÚnico family (proxy)", idioma),
      indicador: "mun_tsee_proxy",
      unidade: "%",
      casas: 1,
      nota: tx(
        "Proxy, não cobertura: faturas com desconto divididas por famílias de baixa renda do Cadastro Único. Município com menos de 50 famílias no denominador tem razão instável (coluna própria na tabela).",
        "Proxy, not coverage: discounted bills divided by low-income families in the Cadastro Único (CadÚnico). A municipality with fewer than 50 families in the denominator has an unstable ratio (own column in the table).",
        idioma,
      ),
    },
    lpt_dom: {
      rotulo: tx("Luz para Todos (domicílios)", "Luz para Todos (households)", idioma),
      indicador: "mun_lpt",
      unidade: tx("domicílios", "households", idioma),
      casas: 0,
      nota: tx("Município sem linha no arquivo do programa fica sem dado, não zero.", "A municipality without a row in the program file has no data, not zero.", idioma),
    },
    usi_op_n: {
      rotulo: tx("Usinas em operação só no município", "Plants in operation only in the municipality", idioma),
      indicador: "mun_usinas_operacao",
      unidade: tx("usinas", "plants", idioma),
      casas: 0,
      cortes: [1, 2, 5, 10],
      nota: absolutoSemRazao,
    },
    usi_op_mw: {
      rotulo: tx("Potência em operação só no município", "Capacity in operation only in the municipality", idioma),
      indicador: "mun_usinas_operacao",
      unidade: "MW",
      casas: 1,
      cortes: [1, 10, 100, 1000],
      nota: absolutoSemRazao,
    },
    usi_reg_n: {
      rotulo: tx("Registros de até 10 kW", "Registrations of up to 10 kW", idioma),
      indicador: "mun_registros_10kw",
      unidade: tx("registros", "registrations", idioma),
      casas: 0,
      cortes: [1, 10, 100, 1000],
      nota: absolutoSemRazao,
    },
    isol_n: { rotulo: tx("Localidades isoladas", "Isolated localities", idioma), indicador: "mun_isolados", unidade: tx("localidades", "localities", idioma), casas: 0, cortes: [1, 2, 4] },
  };
}
export const MEDIDA: Record<MedidaMunicipio, DefinicaoMedida> = medidas("pt");

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

const GRAO_DA_SELECAO: Record<TipoSelecao, IdGraoTerritorio> = { mun: "municipio", dist: "distribuidora", sm: "submercado", uf: "uf", usi: "usina" }; // i18n: dado

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

function naoPassa(ctx: ContextoSelecao, de: IdGraoTerritorio, para: IdGraoTerritorio, reserva: string, idioma: Idioma): Correspondencia {
  const r = regraCompatibilidade(ctx.compat, de, para);
  return { ...VAZIA, valida: false, texto: r && !r.valida ? regraNoIdioma(r.regra, idioma) : reserva };
}

/** Submercados citados no texto da distribuidora ("SE: 83; S: 1"), sem o rótulo "sem submercado". */
export function submercadosDaDistribuidora(d: Pick<LinhaDistribuidora, "submercados">): Submercado[] {
  return d.submercados
    .split(";")
    .map((p) => p.trim().split(":")[0])
    .filter((s): s is Submercado => (SUBMERCADOS as readonly string[]).includes(s));
}

export function correspondencia(sel: Selecao, camada: Camada, ctx: ContextoSelecao, idioma: Idioma = idiomaEnergia()): Correspondencia {
  if (!sel) return VAZIA;
  const regra = (de: IdGraoTerritorio, para: IdGraoTerritorio) => {
    const r = regraCompatibilidade(ctx.compat, de, para);
    return r ? regraNoIdioma(r.regra, idioma) : null;
  };
  const de = GRAO_DA_SELECAO[sel.tipo];
  const para = GRAO_DA_CAMADA[camada];

  if (sel.tipo === "mun") {
    const m = ctx.municipio;
    if (!m)
      return {
        ...VAZIA,
        valida: false,
        texto: tx("Município ainda não carregado: o índice municipal é baixado sob demanda.", "Municipality not loaded yet: the municipal index is downloaded on demand.", idioma),
      };
    const base = { ...VAZIA, municipio: m.ibge, uf: m.uf };
    if (camada === "municipio") return base;
    if (camada === "usinas") return { ...base, usinas: "do_municipio" };
    if (camada === "submercado") {
      if (m.sm_estado === "fora_do_sin" || !m.sm) {
        const motivoFora =
          m.sm_estado === "fora_do_sin"
            ? m.isol_sede === 1
              ? tx(
                  `${m.nome} está fora do SIN: a sede é localidade isolada do PASI. O submercado não se aplica a ele, e a cor da UF não vale para o município.`,
                  `${m.nome} is outside the SIN: its seat is an isolated locality of the PASI. The submarket does not apply to it, and the state's color does not hold for the municipality.`,
                  idioma,
                )
              : tx(
                  `${m.nome} está fora do SIN: as localidades isoladas somam ao menos metade da população estimada. O submercado não se aplica a ele, e a cor da UF não vale para o município.`,
                  `${m.nome} is outside the SIN: isolated localities add up to at least half of the estimated population. The submarket does not apply to it, and the state's color does not hold for the municipality.`,
                  idioma,
                )
            : tx(`${m.nome} não tem submercado conferido.`, `${m.nome} has no checked submarket.`, idioma);
        return { ...base, valida: false, texto: motivoFora, sms: [] };
      }
      if (m.sm_estado === "com_localidade_isolada")
        return {
          ...base,
          aviso: true,
          sms: [m.sm],
          texto: tx(
            `${m.nome} fica no submercado ${NOME_SUBMERCADO[m.sm]} pela UF, mas tem localidade isolada fora do SIN: os números do submercado não descrevem essas localidades.`,
            `${m.nome} is in the ${nomeSm(m.sm, "en")} submarket through its state, but has an isolated locality outside the SIN: the submarket figures do not describe those localities.`,
            idioma,
          ),
        };
      return { ...base, sms: [m.sm], texto: regra("municipio", "submercado") };
    }
    // camada de distribuidoras
    const validos = vinculosValidos(m);
    if (validos.length === 1) return { ...base, dist: validos[0][0] };
    if (validos.length > 1)
      return {
        ...base,
        aviso: true,
        candidatas: validos.map(([i]) => i),
        texto: tx(
          `${m.nome} é atendido por ${validos.length} distribuidoras na relação oficial. A página lista ${validos.length === 2 ? "as duas" : `as ${validos.length}`} e não escolhe uma: os limites internos do município não são publicados.`,
          `${m.nome} is served by ${validos.length} distribution utilities in the official list. The page lists ${validos.length === 2 ? "both" : `all ${validos.length}`} and does not choose one: the municipality's internal boundaries are not published.`,
          idioma,
        ),
      };
    if (m.dist.length)
      return {
        ...base,
        aviso: true,
        candidatas: m.dist.map(([i]) => i),
        texto: tx(
          `${m.nome} só tem vínculo sem confirmação pelo cadastro de MMGD: a distribuidora é listada com ressalva e a área não é acesa.`,
          `${m.nome} only has an unconfirmed link through the MMGD register: the utility is listed with a caveat and the area is not highlighted.`,
          idioma,
        ),
      };
    return {
      ...base,
      valida: false,
      texto: tx(
        `${m.nome} não tem distribuidora com vínculo na relação oficial vigente.`,
        `${m.nome} has no distribution utility linked in the official list in force.`,
        idioma,
      ),
    };
  }

  if (sel.tipo === "dist") {
    const d = ctx.distribuidora;
    if (!d) return { ...VAZIA, valida: false, texto: tx("Distribuidora sem município na relação vigente.", "Distribution utility with no municipality in the list in force.", idioma) };
    if (camada === "distribuidora") return { ...VAZIA, dist: d.i };
    if (camada === "municipio") return { ...VAZIA, dist: d.i, municipios: "area", texto: regra("distribuidora", "municipio") };
    if (camada === "usinas") return naoPassa(ctx, "usina", "distribuidora", tx("Usina e distribuidora não se correspondem.", "Plant and distribution utility do not correspond.", idioma), idioma); // i18n: dado
    // submercado
    const sms = d.submercado_unico ? [d.submercado_unico] : submercadosDaDistribuidora(d);
    if (!sms.length)
      return {
        ...VAZIA,
        valida: false,
        texto: tx(
          `${d.sigla} não tem município de vínculo válido no SIN: o submercado não se aplica.`,
          `${d.sigla} has no validly linked municipality in the SIN: the submarket does not apply.`,
          idioma,
        ),
      };
    const fora = ehSim(d.parte_fora_do_sin);
    const partes: string[] = [];
    if (!d.submercado_unico && sms.length > 1)
      partes.push(
        tx(
          `A área de ${d.sigla} tem municípios em ${sms.length} submercados: todos são listados, nenhum é escolhido.`,
          `The area of ${d.sigla} has municipalities in ${sms.length} submarkets: all are listed, none is chosen.`,
          idioma,
        ),
      );
    if (fora)
      partes.push(
        tx(
          `${num(d.fora_do_sin, 0)} municípios da área estão fora do SIN e não entram no submercado.`,
          `${num(d.fora_do_sin, 0, idioma)} municipalities in the area are outside the SIN and do not enter the submarket.`,
          idioma,
        ),
      );
    return { ...VAZIA, sms, aviso: partes.length > 0, texto: partes.length ? partes.join(" ") : null };
  }

  if (sel.tipo === "sm") {
    const sm = sel.id as Submercado;
    if (camada === "submercado") return { ...VAZIA, sms: [sm] };
    if (camada === "usinas") return naoPassa(ctx, "usina", "submercado", tx("Usina não é ligada a submercado.", "A plant is not linked to a submarket.", idioma), idioma); // i18n: dado
    return naoPassa(ctx, "submercado", "municipio", tx("Submercado não seleciona município.", "A submarket does not select a municipality.", idioma), idioma);
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
  if (camada === "municipio") return { ...VAZIA, municipios: "declarados", usinas: "a_usina", texto: regra("usina", "municipio") }; // i18n: dado
  if (camada === "submercado") return naoPassa(ctx, "usina", "submercado", tx("Usina não é ligada a submercado.", "A plant is not linked to a submarket.", idioma), idioma); // i18n: dado
  return naoPassa(ctx, de, para, tx("Usina não é ligada a distribuidora.", "A plant is not linked to a distribution utility.", idioma), idioma);
}

/* ================================================================ textos derivados */

function lista(itens: string[], idioma: Idioma = idiomaEnergia()): string {
  if (itens.length <= 1) return itens[0] ?? "";
  return `${itens.slice(0, -1).join(", ")} ${tx("e", "and", idioma)} ${itens[itens.length - 1]}`;
}

/** Resposta curta do painel, toda tirada do resumo da gold. */
export function respostaTerritorio(g: Pick<GoldTerritorio, "resumo" | "referencias" | "distribuidoras">, idioma: Idioma = idiomaEnergia()): string {
  const r = g.resumo;
  const e = r.municipios_por_estado_submercado;
  const comArea = g.distribuidoras.filter((d) => d.area.municipios > 0).length;
  const provados = (e.provado ?? 0) + (e.provado_com_area_sem_carga ?? 0);
  const soSem = r.municipios_so_vinculo_nao_confirmado.length;
  const sem = r.municipios_sem_vinculo.length;
  const n = (v: number | null | undefined) => inteiro(v, idioma);
  const partesDist = [
    tx(`${n(r.municipios_com_distribuidora)} têm distribuidora com vínculo válido`, `${n(r.municipios_com_distribuidora)} have a validly linked distribution utility`, idioma),
    tx(`${n(r.municipios_compartilhados)} delas com mais de uma`, `${n(r.municipios_compartilhados)} of them with more than one`, idioma),
  ];
  const restoDist: string[] = [];
  if (soSem) restoDist.push(tx(`${n(soSem)} só com vínculo sem confirmação`, `${n(soSem)} only with an unconfirmed link`, idioma));
  if (sem) restoDist.push(tx(`${n(sem)} sem vínculo`, `${n(sem)} with no link`, idioma));
  const u = r.usinas;
  const ano = g.referencias.relacao_distribuidoras_ano ?? tx("sem data", "no date", idioma);
  const resto = `${partesDist.join(", ")}${restoDist.length ? `; ${lista(restoDist, idioma)}` : ""}. `;
  return (
    tx(`Cobertura desta publicação: `, `Coverage of this release: `, idioma) +
    tx(
      `os ${n(r.municipios)} municípios do IBGE estão ligados a ${n(comArea)} distribuidoras pela relação oficial da ANEEL de ${ano}: `,
      `the ${n(r.municipios)} IBGE municipalities are linked to ${n(comArea)} distribution utilities by ANEEL's official list of ${ano}: `,
      idioma,
    ) +
    resto +
    tx(
      `Pela UF, ${n(provados)} municípios estão num submercado com a pertença conferida pela carga do ONS, `,
      `Through their state, ${n(provados)} municipalities are in a submarket whose membership is checked against the ONS load, `,
      idioma,
    ) +
    tx(
      `${n(e.com_localidade_isolada ?? 0)} ficam no submercado da UF com localidade isolada e ${n(e.fora_do_sin ?? 0)} estão fora do SIN, sem submercado. `,
      `${n(e.com_localidade_isolada ?? 0)} are in the state's submarket with an isolated locality and ${n(e.fora_do_sin ?? 0)} are outside the SIN, with no submarket. `,
      idioma,
    ) +
    tx(
      `Das ${n(u.total)} usinas do SIGA de ${dataBR(g.referencias.siga_data, idioma)}, ${n(u.todos_municipios_reconhecidos)} têm todos os municípios declarados reconhecidos.`,
      `Of the ${n(u.total)} SIGA plants of ${dataBR(g.referencias.siga_data, idioma)}, ${n(u.todos_municipios_reconhecidos)} have all their declared municipalities recognized.`,
      idioma,
    )
  );
}

/**
 * Veredito do P002 em palavras comuns: o que a página faz e de quem é cada número (do submercado, da distribuidora inteira
 * ou do conjunto elétrico). Cita só as camadas que a gold traz; a cobertura por município, distribuidora, submercado e usina
 * fica em respostaTerritorio, na segunda camada.
 */
export function vereditoTerritorio(g: Pick<GoldTerritorio, "resumo">, idioma: Idioma = idiomaEnergia()): string {
  const r = g.resumo;
  const usinas = r.usinas.total > 0 ? tx(" e usinas", " and plants", idioma) : "";
  const conjunto = r.conjuntos_referenciados > 0 ? tx(" e a continuidade é do conjunto elétrico", " and continuity is the consumer set's", idioma) : "";
  return tx(
    `Escolha uma região e veja preço, tarifa, perdas, continuidade${usinas}. O preço é do submercado, a tarifa e as perdas são da distribuidora inteira${conjunto}.`,
    `Choose a region and see price, tariff, losses, continuity${usinas}. The price is the submarket's, the tariff and losses are the whole distribution utility's${conjunto}.`,
    idioma,
  );
}

/**
 * "O que mudou": a página não compara com a publicação anterior, então não descreve mudança. Traz só as datas que o campo
 * Período não traz (Tarifa Social, população e a conferência das áreas de carga); as demais ficam no Período, sem repetir.
 */
export function textoAtualidade(g: Pick<GoldTerritorio, "referencias">, idioma: Idioma = idiomaEnergia()): string {
  const r = g.referencias;
  const partes = [
    r.tsee_mes_cde && tx(`Tarifa Social de ${textoReferencia(r.tsee_mes_cde, idioma)}`, `Social Tariff of ${textoReferencia(r.tsee_mes_cde, idioma)}`, idioma),
    r.populacao_ano !== null && tx(`população estimada de ${r.populacao_ano}`, `population estimate of ${r.populacao_ano}`, idioma),
  ].filter((x): x is string => typeof x === "string");
  const dias = r.areas_carga_dias.map((x) => dataBR(x, idioma));
  return (
    tx("Sem comparação com a publicação anterior.", "No comparison with the previous release.", idioma) +
    (partes.length ? tx(` Datas que o Período não traz: ${lista(partes, idioma)}.`, ` Dates the Period does not show: ${lista(partes, idioma)}.`, idioma) : "") +
    (dias.length
      ? tx(
          ` A pertença das áreas de carga ao submercado foi conferida em ${lista(dias, idioma)}.`,
          ` The membership of the load areas in the submarket was checked on ${lista(dias, idioma)}.`,
          idioma,
        )
      : "")
  );
}

export type ContextoTexto = {
  distribuidoras: IndiceDistribuidoras;
  populacaoAno: number | null;
};

/** Resposta da ficha de um município: quem atende, em que submercado e o que é do próprio município. */
export function respostaMunicipio(m: MunicipioT, ctx: ContextoTexto, idioma: Idioma = idiomaEnergia()): string {
  const nome = `${m.nome} (${m.uf})`;
  const validos = vinculosValidos(m);
  const v = rotulosVinculo(idioma);
  const sigla = (i: number) => ctx.distribuidoras.get(i)?.sigla ?? tx(`distribuidora ${i}`, `utility ${i}`, idioma);
  const n = (x: number | null | undefined) => inteiro(x, idioma);
  let quem: string;
  if (validos.length === 1)
    quem = tx(
      `${nome} é atendido pela distribuidora ${sigla(validos[0][0])} (vínculo ${v[validos[0][1]]})`,
      `${nome} is served by the distribution utility ${sigla(validos[0][0])} (link ${v[validos[0][1]]})`,
      idioma,
    );
  else if (validos.length > 1)
    quem = tx(
      `${nome} é atendido por ${validos.length} distribuidoras: ${lista(validos.map(([i]) => sigla(i)), idioma)}`,
      `${nome} is served by ${validos.length} distribution utilities: ${lista(validos.map(([i]) => sigla(i)), idioma)}`,
      idioma,
    );
  else if (m.dist.length)
    quem = tx(
      `${nome} só tem vínculo sem confirmação, com ${lista(m.dist.map(([i]) => sigla(i)), idioma)}`,
      `${nome} only has an unconfirmed link, with ${lista(m.dist.map(([i]) => sigla(i)), idioma)}`,
      idioma,
    );
  else quem = tx(`${nome} não tem distribuidora com vínculo na relação oficial vigente`, `${nome} has no distribution utility linked in the official list in force`, idioma);

  let onde: string;
  if (m.sm_estado === "fora_do_sin")
    onde =
      m.isol_sede === 1
        ? tx(
            "e está fora do SIN, porque a sede é localidade isolada: o submercado não se aplica",
            "and is outside the SIN, because its seat is an isolated locality: the submarket does not apply",
            idioma,
          )
        : tx(
            "e está fora do SIN, porque as localidades isoladas somam ao menos metade da população: o submercado não se aplica",
            "and is outside the SIN, because isolated localities add up to at least half of the population: the submarket does not apply",
            idioma,
          );
  else if (!m.sm) onde = tx("e não tem submercado conferido", "and has no checked submarket", idioma);
  else if (m.sm_estado === "com_localidade_isolada")
    onde = tx(
      `e fica no submercado ${nomeSm(m.sm, idioma)} pela UF, com localidade isolada fora do SIN`,
      `and is in the ${nomeSm(m.sm, idioma)} submarket through its state, with an isolated locality outside the SIN`,
      idioma,
    );
  else onde = tx(`e fica no submercado ${nomeSm(m.sm, idioma)} pela UF`, `and is in the ${nomeSm(m.sm, idioma)} submarket through its state`, idioma);

  const doMun: string[] = [];
  doMun.push(
    m.pop === null
      ? tx("população sem dado", "population with no data", idioma)
      : tx(`${n(m.pop)} habitantes (IBGE, ${ctx.populacaoAno ?? "sem ano"})`, `${n(m.pop)} inhabitants (IBGE, ${ctx.populacaoAno ?? "no year"})`, idioma),
  );
  if (m.mmgd_un === null) doMun.push(tx("MMGD sem dado", "MMGD with no data", idioma));
  else if (m.mmgd_un === 0) doMun.push(tx("nenhuma unidade de MMGD", "no MMGD unit", idioma));
  else
    doMun.push(
      tx(
        `${n(m.mmgd_un)} ${m.mmgd_un === 1 ? "unidade" : "unidades"} de MMGD (${numTexto(m.mmgd_kw, 0, idioma)} kW)`,
        `${n(m.mmgd_un)} MMGD ${m.mmgd_un === 1 ? "unit" : "units"} (${numTexto(m.mmgd_kw, 0, idioma)} kW)`,
        idioma,
      ),
    );
  const umaUsina = m.usi_op_n === 1;
  if (m.usi_op_n === 0) doMun.push(tx("nenhuma usina em operação declarada só nele", "no plant in operation declared only in it", idioma));
  else
    doMun.push(
      tx(
        `${n(m.usi_op_n)} ${umaUsina ? "usina" : "usinas"} em operação declarada${umaUsina ? "" : "s"} só nele (${numTexto(m.usi_op_mw, 1, idioma)} MW)`,
        `${n(m.usi_op_n)} ${umaUsina ? "plant" : "plants"} in operation declared only in it (${numTexto(m.usi_op_mw, 1, idioma)} MW)`,
        idioma,
      ),
    );
  if (m.usi_reg_n > 0)
    doMun.push(
      tx(
        `${n(m.usi_reg_n)} ${m.usi_reg_n === 1 ? "registro" : "registros"} de até 10 kW, à parte`,
        `${n(m.usi_reg_n)} ${m.usi_reg_n === 1 ? "registration" : "registrations"} of up to 10 kW, counted separately`,
        idioma,
      ),
    );
  return tx(`${quem} ${onde}. No município: ${lista(doMun, idioma)}.`, `${quem} ${onde}. In the municipality: ${lista(doMun, idioma)}.`, idioma);
}

/** Usada em `.map`: o idioma vem da página (idiomaEnergia), não de um segundo argumento. */
export function respostaDistribuidora(d: LinhaDistribuidora): string {
  const idioma = idiomaEnergia();
  const n = (v: number | null | undefined) => inteiro(v, idioma);
  const nSm = submercadosDaDistribuidora(d).length;
  const umMun = d.municipios === 1;
  const soMmgd = d.so_mmgd ? tx(`, ${n(d.so_mmgd)} só pelo cadastro de MMGD`, `, ${n(d.so_mmgd)} only through the MMGD register`, idioma) : "";
  const naoConf = d.nao_confirmados ? tx(`, ${n(d.nao_confirmados)} sem confirmação`, `, ${n(d.nao_confirmados)} unconfirmed`, idioma) : "";
  const area = tx(
    `${d.sigla} atende ${n(d.municipios)} ${umMun ? "município" : "municípios"} na relação oficial (${n(d.confirmados)} confirmados${soMmgd}${naoConf}), em ${d.ufs || "nenhuma UF"}`,
    `${d.sigla} serves ${n(d.municipios)} ${umMun ? "municipality" : "municipalities"} in the official list (${n(d.confirmados)} confirmed${soMmgd}${naoConf}), in ${d.ufs || "no state"}`,
    idioma,
  );
  const sm = d.submercado_unico
    ? tx(`; submercado ${nomeSm(d.submercado_unico, idioma)}`, `; ${nomeSm(d.submercado_unico, idioma)} submarket`, idioma)
    : nSm > 1
      ? tx(`; municípios em ${nSm} submercados`, `; municipalities in ${nSm} submarkets`, idioma)
      : "";
  const fora = d.fora_do_sin ? tx(`; ${n(d.fora_do_sin)} fora do SIN`, `; ${n(d.fora_do_sin)} outside the SIN`, idioma) : "";
  const parcial = ehAnoParcial(d.perdas_situacao) ? tx(" (ano parcial)", " (partial year)", idioma) : "";
  const valores: string[] = [];
  valores.push(
    d.perdas_pct === null
      ? tx("perdas sem dado", "losses with no data", idioma)
      : tx(
          `perdas de ${num(d.perdas_pct, 2, idioma)}% da energia injetada em ${d.perdas_ano}${parcial}`,
          `losses of ${num(d.perdas_pct, 2, idioma)}% of injected energy in ${d.perdas_ano}${parcial}`,
          idioma,
        ),
  );
  valores.push(
    d.dec_h === null ? tx("DEC sem dado", "DEC with no data", idioma) : tx(`DEC de ${num(d.dec_h, 2, idioma)} h em ${d.qual_ano}`, `DEC of ${num(d.dec_h, 2, idioma)} h in ${d.qual_ano}`, idioma),
  );
  valores.push(
    d.tarifa === null
      ? tx("tarifa B1 sem dado", "B1 tariff with no data", idioma)
      : tx(`tarifa B1 de R$ ${num(d.tarifa, 2, idioma)}/MWh sem tributos`, `B1 tariff of R$ ${num(d.tarifa, 2, idioma)}/MWh before taxes`, idioma),
  );
  return tx(
    `${area}${sm}${fora}. Valores da área inteira da distribuidora, não de um município: ${lista(valores, idioma)}.`,
    `${area}${sm}${fora}. Values for the distribution utility's whole area, not for a municipality: ${lista(valores, idioma)}.`,
    idioma,
  );
}

/** Usada em `.map`: o idioma vem da página (idiomaEnergia), não de um segundo argumento. */
export function respostaSubmercado(s: LinhaSubmercado): string {
  const idioma = idiomaEnergia();
  const valores: string[] = [];
  valores.push(
    s.pld_dia === null
      ? tx("PLD do dia sem dado", "PLD of the day with no data", idioma)
      : tx(
          `PLD médio de R$ ${num(s.pld_dia, 2, idioma)}/MWh em ${dataBR(s.pld_dia_ref, idioma)}`,
          `average PLD of R$ ${num(s.pld_dia, 2, idioma)}/MWh on ${dataBR(s.pld_dia_ref, idioma)}`,
          idioma,
        ),
  );
  valores.push(
    s.ear_pct === null
      ? tx("EAR sem dado", "EAR with no data", idioma)
      : tx(
          `energia armazenada de ${num(s.ear_pct, 1, idioma)}% da máxima em ${dataBR(s.ear_ref, idioma)}`,
          `stored energy at ${num(s.ear_pct, 1, idioma)}% of the maximum on ${dataBR(s.ear_ref, idioma)}`,
          idioma,
        ),
  );
  const frase = valores.join(tx(" e ", " and ", idioma));
  const fraseInicial = `${frase.charAt(0).toUpperCase()}${frase.slice(1)}`;
  return tx(
    `${s.nome} reúne ${inteiro(s.n_ufs, idioma)} UFs (${s.ufs}). ${fraseInicial}. Os valores são do submercado inteiro, não de uma UF nem de um município.`,
    `${s.nome} brings together ${inteiro(s.n_ufs, idioma)} states (${s.ufs}). ${fraseInicial}. The values are for the whole submarket, not for a state or a municipality.`,
    idioma,
  );
}

/** Usada em `.map`: o idioma vem da página (idiomaEnergia), não de um segundo argumento. */
export function respostaUf(u: LinhaUf): string {
  const idioma = idiomaEnergia();
  const n = (v: number | null | undefined) => inteiro(v, idioma);
  const sm = u.subsistema
    ? tx(
        `está no submercado ${nomeSm(u.subsistema, idioma)} (camada oficial da EPE; ${u.estado})`,
        `is in the ${nomeSm(u.subsistema, idioma)} submarket (official EPE layer; ${u.estado})`,
        idioma,
      )
    : tx("não tem submercado conferido", "has no checked submarket", idioma);
  const fora = u.fora_do_sin ? tx(`, ${n(u.fora_do_sin)} fora do SIN`, `, ${n(u.fora_do_sin)} outside the SIN`, idioma) : "";
  const umReg = u.cap_registros === 1;
  const regs = u.cap_registros
    ? tx(
        ` (mais ${n(u.cap_registros)} ${umReg ? "registro" : "registros"} de até 10 kW, à parte)`,
        ` (plus ${n(u.cap_registros)} ${umReg ? "registration" : "registrations"} of up to 10 kW, counted separately)`,
        idioma,
      )
    : "";
  const cap =
    u.cap_mw === null
      ? tx("capacidade sem dado", "capacity with no data", idioma)
      : u.cap_usinas === null
        ? tx(`${num(u.cap_mw, 1, idioma)} MW em operação fiscalizados pela UF principal`, `${num(u.cap_mw, 1, idioma)} MW in operation inspected, by main state`, idioma)
        : tx(
            `${n(u.cap_usinas)} usinas em operação${regs}, com ${num(u.cap_mw, 1, idioma)} MW fiscalizados pela UF principal`,
            `${n(u.cap_usinas)} plants in operation${regs}, with ${num(u.cap_mw, 1, idioma)} MW inspected, by main state`,
            idioma,
          );
  return tx(`${u.nome ?? u.uf} ${sm}. ${n(u.municipios)} municípios${fora}; ${cap}.`, `${u.nome ?? u.uf} ${sm}. ${n(u.municipios)} municipalities${fora}; ${cap}.`, idioma);
}

export function respostaUsina(u: UsinaT, nomeMunicipio: (ibge: string) => string, idioma: Idioma = idiomaEnergia()): string {
  const est = (rotulosEstagio(idioma) as Record<string, string>)[u.estagio]?.toLowerCase() ?? u.estagio;
  const pot = potenciaUsina(u);
  const emOperacao = u.estagio === "operacao";
  const potTexto =
    pot === null
      ? tx("potência sem dado", "capacity with no data", idioma)
      : tx(
          `${num(pot, pot < 1 ? 3 : 1, idioma)} MW ${emOperacao ? "fiscalizados" : "outorgados"}`,
          `${num(pot, pot < 1 ? 3 : 1, idioma)} MW ${emOperacao ? "inspected" : "granted"}`,
          idioma,
        );
  const muns = u.municipios.map(nomeMunicipio);
  const decl =
    u.n_declarados > 1
      ? tx(
          `declarada em ${u.n_declarados} municípios (${lista(muns, idioma)}), sem a potência repartida entre eles`,
          `declared in ${u.n_declarados} municipalities (${lista(muns, idioma)}), without the capacity split among them`,
          idioma,
        )
      : muns.length
        ? tx(`declarada em ${muns[0]}`, `declared in ${muns[0]}`, idioma)
        : tx("sem município reconhecido", "with no recognized municipality", idioma);
  const coord =
    u.coord_no_declarado === 1
      ? tx(" A coordenada do SIGA cai dentro de um município declarado.", " The SIGA coordinate falls inside a declared municipality.", idioma)
      : u.coord_no_declarado === 0
        ? tx(
            " A coordenada do SIGA cai fora dos municípios declarados (a declaração prevalece).",
            " The SIGA coordinate falls outside the declared municipalities (the declaration prevails).",
            idioma,
          )
        : "";
  const reg = u.registro_ate_10kw
    ? tx(" É um registro de até 10 kW, fora da contagem de usinas do município.", " It is a registration of up to 10 kW, outside the municipality's plant count.", idioma)
    : "";
  return tx(`${u.nome} (${u.tipo}, ${est}) tem ${potTexto} e está ${decl}.${coord}${reg}`, `${u.nome} (${u.tipo}, ${est}) has ${potTexto} and is ${decl}.${coord}${reg}`, idioma);
}

/* ================================================================ ligações para os módulos de origem */

/** Links que levam a seleção para a página de origem quando ela aceita a mesma entidade (CNPJ ou código IBGE). */
export function linksDistribuidora(cnpj: string, idioma: Idioma = idiomaEnergia()): LinkModulo[] {
  return [
    { rotulo: tx("Perdas desta distribuidora", "Losses of this distribution utility", idioma), href: `/setor-eletrico/perdas?d=${cnpj}` },
    { rotulo: tx("DEC e FEC desta distribuidora", "DEC and FEC of this distribution utility", idioma), href: `/setor-eletrico/qualidade?dist=${cnpj}` },
    { rotulo: tx("Tarifa desta distribuidora", "Tariff of this distribution utility", idioma), href: `/setor-eletrico/conta-de-luz?dist=${cnpj}` },
  ];
}

export function linksMunicipio(ibge: string, idioma: Idioma = idiomaEnergia()): LinkModulo[] {
  return [
    { rotulo: tx("Histórico de MMGD deste município", "MMGD history of this municipality", idioma), href: `/setor-eletrico/transicao/mmgd?mmgd.mun=1&mmgd.msel=${ibge}#p063` },
    { rotulo: tx("Interrupções neste município", "Interruptions in this municipality", idioma), href: `/setor-eletrico/qualidade?mun=${ibge}` },
  ];
}

/** Próxima pergunta de cada camada, com a pergunta e o endereço do destino na navegação. */
export function proximaPergunta(camada: Camada): { pergunta: string; href: string } {
  const slug = camada === "submercado" ? "pld" : camada === "distribuidora" ? "perdas" : camada === "municipio" ? "transicao" : "expansao";
  const d = destino(slug);
  return { pergunta: d.pergunta, href: d.href };
}

/* ================================================================ tabelas */

function colunasSubmercadosBase(idioma: Idioma): ColunaTabela[] {
  return [
    { id: "nome", rotulo: tx("Submercado", "Submarket", idioma), tipo: "texto" },
    { id: "ufs", rotulo: tx("UFs", "States", idioma), tipo: "texto" },
    { id: "pld_dia", rotulo: tx("PLD médio do dia", "Average PLD of the day", idioma), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "pld_mes", rotulo: tx("PLD médio do mês", "Average PLD of the month", idioma), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "ear_pct", rotulo: "EAR", tipo: "percentual", casas: 1 },
    { id: "ear_mwmes", rotulo: "EAR", tipo: "numero", unidade: tx("MWmês", "MWmonth", idioma), casas: 0 },
    {
      id: "mmgd_ons",
      rotulo: tx("Carga atendida por MMGD (estimativa do ONS)", "Load served by MMGD (ONS estimate)", idioma),
      tipo: "numero",
      unidade: tx("MWmed", "MWavg", idioma),
      casas: 0,
    },
    { id: "mediana_residuo", rotulo: tx("Mediana do resíduo da soma das áreas", "Median residual of the sum of the areas", idioma), tipo: "texto" },
  ];
}
export const COLUNAS_SUBMERCADOS: ColunaTabela[] = colunasSubmercadosBase("pt");

/** As colunas da tabela de submercados com o mês da estimativa de MMGD do ONS no cabeçalho (a estimativa é mensal, as demais colunas são do dia). */
export function colunasSubmercados(mesMmgdOns: string | null, idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return colunasSubmercadosBase(idioma).map((c) =>
    c.id === "mmgd_ons" && mesMmgdOns
      ? {
          ...c,
          rotulo: tx(
            `Carga atendida por MMGD (estimativa do ONS de ${textoReferencia(mesMmgdOns, idioma)})`,
            `Load served by MMGD (ONS estimate of ${textoReferencia(mesMmgdOns, idioma)})`,
            idioma,
          ),
        }
      : c,
  );
}

export function colunasUfsSubmercado(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "uf", rotulo: tx("UF", "State", idioma), tipo: "texto" },
    { id: "nome", rotulo: tx("Nome", "Name", idioma), tipo: "texto", idiomaTexto: "nome" },
    { id: "submercado", rotulo: tx("Submercado (cor no mapa)", "Submarket (color on the map)", idioma), tipo: "texto", categorica: true },
    { id: "estado", rotulo: tx("Pertença ao submercado (só a ressalva)", "Membership in the submarket (caveat only)", idioma), tipo: "texto", categorica: true },
    { id: "areas", rotulo: tx("Áreas de carga do ONS", "ONS load areas", idioma), tipo: "texto", idiomaTexto: "nome" },
    { id: "municipios", rotulo: tx("Municípios", "Municipalities", idioma), tipo: "numero", casas: 0 },
    { id: "fora_do_sin", rotulo: tx("Municípios fora do SIN", "Municipalities outside the SIN", idioma), tipo: "numero", casas: 0 },
    { id: "com_localidade_isolada", rotulo: tx("Com localidade isolada, dentro do SIN", "With an isolated locality, inside the SIN", idioma), tipo: "numero", casas: 0 },
  ];
}
export const COLUNAS_UFS_SUBMERCADO: ColunaTabela[] = colunasUfsSubmercado("pt");

export function colunasUfsIndicadores(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "uf", rotulo: tx("UF", "State", idioma), tipo: "texto" },
    { id: "submercado", rotulo: tx("Submercado", "Submarket", idioma), tipo: "texto", categorica: true },
    {
      id: "cap_usinas",
      rotulo: tx("Usinas em operação (UF principal, sem registros de até 10 kW)", "Plants in operation (main state, without registrations of up to 10 kW)", idioma),
      tipo: "numero",
      casas: 0,
    },
    { id: "cap_registros", rotulo: tx("Registros de até 10 kW em operação (UF principal)", "Registrations of up to 10 kW in operation (main state)", idioma), tipo: "numero", casas: 0 },
    { id: "cap_mw", rotulo: tx("Capacidade em operação (todas as usinas, em MW)", "Capacity in operation (all plants, in MW)", idioma), tipo: "numero", unidade: "MW", casas: 1 },
    {
      id: "tsee_faturas",
      rotulo: tx("Faturas com Tarifa Social (contagem do mês)", "Bills with the Social Tariff (count for the month)", idioma),
      tipo: "numero",
      unidade: tx("faturas no mês", "bills in the month", idioma),
      casas: 0,
    },
    {
      id: "tsee_desconto",
      rotulo: tx("Desconto líquido da Tarifa Social (com cancelamentos e refaturamentos)", "Net Social Tariff discount (with cancellations and rebillings)", idioma),
      tipo: "numero",
      unidade: tx("R$ líquidos no mês", "net R$ in the month", idioma),
      casas: 2,
    },
    { id: "isol_localidades", rotulo: tx("Localidades isoladas", "Isolated localities", idioma), tipo: "numero", casas: 0 },
    { id: "isol_pop", rotulo: tx("População em localidades isoladas", "Population in isolated localities", idioma), tipo: "numero", casas: 0 },
  ];
}
export const COLUNAS_UFS_INDICADORES: ColunaTabela[] = colunasUfsIndicadores("pt");

export function colunasDistribuidoras(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "sigla", rotulo: tx("Distribuidora", "Distribution utility", idioma), tipo: "texto", idiomaTexto: "nome" },
    { id: "nome", rotulo: tx("Razão social", "Corporate name", idioma), tipo: "texto", idiomaTexto: "nome" },
    { id: "cnpj_formatado", rotulo: "CNPJ", tipo: "texto" },
    { id: "ufs", rotulo: tx("UFs", "States", idioma), tipo: "texto", categorica: true },
    { id: "municipios", rotulo: tx("Municípios", "Municipalities", idioma), tipo: "numero", casas: 0 },
    { id: "confirmados", rotulo: tx("Confirmados", "Confirmed", idioma), tipo: "numero", casas: 0 },
    { id: "compartilhados", rotulo: tx("Compartilhados", "Shared", idioma), tipo: "numero", casas: 0 },
    { id: "fora_do_sin", rotulo: tx("Fora do SIN", "Outside the SIN", idioma), tipo: "numero", casas: 0 },
    { id: "submercados", rotulo: tx("Municípios por submercado", "Municipalities by submarket", idioma), tipo: "texto" },
    { id: "perdas_pct", rotulo: tx("Perdas totais sobre a energia de referência", "Total losses over the reference energy", idioma), tipo: "percentual", casas: 2 },
    { id: "perdas_base", rotulo: tx("Energia de referência das perdas", "Reference energy of the losses", idioma), tipo: "texto", categorica: true },
    { id: "perdas_pct_pub", rotulo: tx("Mesma perda sobre a injetada publicada", "Same loss over the published injected energy", idioma), tipo: "percentual", casas: 2 },
    { id: "perdas_situacao", rotulo: tx("Ano das perdas", "Year of the losses", idioma), tipo: "texto", categorica: true },
    { id: "perdas_sinal", rotulo: tx("Sinalização das perdas", "Flag on the losses", idioma), tipo: "texto", categorica: true },
    { id: "ucs", rotulo: tx("Unidades consumidoras (cadastro de continuidade)", "Consumer units (continuity register)", idioma), tipo: "numero", casas: 0 },
    { id: "dec_h", rotulo: "DEC", tipo: "numero", unidade: "h", casas: 2 },
    { id: "fec", rotulo: "FEC", tipo: "numero", unidade: tx("interrupções", "interruptions", idioma), casas: 2 },
    { id: "tarifa", rotulo: tx("Tarifa B1 sem tributos", "B1 tariff before taxes", idioma), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "mmgd_mw", rotulo: tx("MMGD cadastrada", "Registered MMGD", idioma), tipo: "numero", unidade: "MW", casas: 1 },
    { id: "tsee_pct", rotulo: tx("Residenciais com Tarifa Social", "Residential customers with the Social Tariff", idioma), tipo: "percentual", casas: 2 },
  ];
}
export const COLUNAS_DISTRIBUIDORAS: ColunaTabela[] = colunasDistribuidoras("pt");

export function colunasMunicipios(med: MedidaMunicipio | null, idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const base: ColunaTabela[] = [
    { id: "municipio", rotulo: tx("Município", "Municipality", idioma), tipo: "texto", idiomaTexto: "nome" },
    { id: "uf", rotulo: tx("UF", "State", idioma), tipo: "texto", categorica: true },
    { id: "id", rotulo: tx("Código IBGE", "IBGE code", idioma), tipo: "texto" },
  ];
  const resto: ColunaTabela[] = [
    { id: "populacao", rotulo: tx("População estimada", "Estimated population", idioma), tipo: "numero", unidade: tx("hab", "inhab.", idioma), casas: 0 },
    { id: "mmgd_un", rotulo: tx("Unidades de MMGD", "MMGD units", idioma), tipo: "numero", casas: 0 },
    { id: "mmgd_kw", rotulo: tx("Potência de MMGD", "MMGD capacity", idioma), tipo: "numero", unidade: "kW", casas: 0 },
    { id: "mmgd_w_hab", rotulo: tx("MMGD por habitante", "MMGD per inhabitant", idioma), tipo: "numero", unidade: tx("W/hab", "W/inhab.", idioma), casas: 1 },
    { id: "tsee_faturas", rotulo: tx("Faturas com Tarifa Social", "Bills with the Social Tariff", idioma), tipo: "numero", casas: 0 },
    {
      id: "tsee_desconto",
      rotulo: tx("Desconto líquido da Tarifa Social (com cancelamentos e refaturamentos)", "Net Social Tariff discount (with cancellations and rebillings)", idioma),
      tipo: "numero",
      unidade: tx("R$ líquidos", "net R$", idioma),
      casas: 2,
    },
    { id: "tsee_proxy_pct", rotulo: tx("Tarifa Social por família do CadÚnico (proxy)", "Social Tariff per CadÚnico family (proxy)", idioma), tipo: "percentual", casas: 1 },
    { id: "tsee_base_pequena", rotulo: tx("Menos de 50 famílias no CadÚnico", "Fewer than 50 families in CadÚnico", idioma), tipo: "texto", categorica: true },
    { id: "lpt_dom", rotulo: tx("Luz para Todos", "Luz para Todos", idioma), tipo: "numero", unidade: tx("domicílios", "households", idioma), casas: 0 },
    { id: "usi_op_n", rotulo: tx("Usinas em operação só no município", "Plants in operation only in the municipality", idioma), tipo: "numero", casas: 0 },
    { id: "usi_op_mw", rotulo: tx("Potência em operação", "Capacity in operation", idioma), tipo: "numero", unidade: "MW", casas: 3 },
    { id: "usi_cart_n", rotulo: tx("Usinas a construir só no município", "Plants to be built only in the municipality", idioma), tipo: "numero", casas: 0 },
    { id: "usi_cart_mw", rotulo: tx("Potência a construir", "Capacity to be built", idioma), tipo: "numero", unidade: tx("MW outorgados", "granted MW", idioma), casas: 3 },
    { id: "usi_reg_n", rotulo: tx("Registros de até 10 kW", "Registrations of up to 10 kW", idioma), tipo: "numero", casas: 0 },
    { id: "usi_reg_kw", rotulo: tx("Potência dos registros", "Capacity of the registrations", idioma), tipo: "numero", unidade: "kW", casas: 0 },
    { id: "usi_multi_n", rotulo: tx("Usinas também em outros municípios", "Plants also in other municipalities", idioma), tipo: "numero", casas: 0 },
    { id: "isol_n", rotulo: tx("Localidades isoladas", "Isolated localities", idioma), tipo: "numero", casas: 0 },
    { id: "isol_pop", rotulo: tx("População das localidades isoladas", "Population of the isolated localities", idioma), tipo: "numero", casas: 0 },
  ];
  // a medida do mapa vem logo depois do nome: é a coluna que a cor do mapa mostra
  const destaque = med ? resto.filter((c) => c.id === med) : [];
  return [...base, ...destaque, ...resto.filter((c) => c.id !== med)];
}

export function colunasVinculo(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "municipio", rotulo: tx("Município", "Municipality", idioma), tipo: "texto", idiomaTexto: "nome" },
    { id: "uf", rotulo: tx("UF", "State", idioma), tipo: "texto", categorica: true },
    { id: "id", rotulo: tx("Código IBGE", "IBGE code", idioma), tipo: "texto" },
    { id: "situacao", rotulo: tx("Situação (cor no mapa)", "Status (color on the map)", idioma), tipo: "texto", categorica: true },
    { id: "distribuidoras", rotulo: tx("Distribuidoras e estado do vínculo", "Distribution utilities and link status", idioma), tipo: "texto" },
    { id: "submercado", rotulo: tx("Submercado", "Submarket", idioma), tipo: "texto", categorica: true },
  ];
}
export const COLUNAS_VINCULO: ColunaTabela[] = colunasVinculo("pt");

export function colunasIsolados(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "municipio", rotulo: tx("Município", "Municipality", idioma), tipo: "texto", idiomaTexto: "nome" },
    { id: "uf", rotulo: tx("UF", "State", idioma), tipo: "texto", categorica: true },
    { id: "estado_sm", rotulo: tx("Estado no mapa", "Status on the map", idioma), tipo: "texto", categorica: true },
    { id: "isol_n", rotulo: tx("Localidades isoladas", "Isolated localities", idioma), tipo: "numero", casas: 0 },
    { id: "isol_pop", rotulo: tx("População das localidades", "Population of the localities", idioma), tipo: "numero", casas: 0 },
    { id: "populacao", rotulo: tx("População estimada do município", "Estimated population of the municipality", idioma), tipo: "numero", casas: 0 },
    { id: "isol_sede", rotulo: tx("Sede isolada", "Isolated seat", idioma), tipo: "texto", categorica: true },
  ];
}
export const COLUNAS_ISOLADOS: ColunaTabela[] = colunasIsolados("pt");

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

export function linhaUsina(u: UsinaT, nomeMunicipio: (ibge: string) => string, idioma: Idioma = idiomaEnergia()): LinhaUsina {
  return {
    id: u.ceg,
    nome: u.nome,
    tipo: u.tipo,
    fonte: rotulosFonte(idioma)[fonteDaUsina(u.tipo)],
    estagio: (rotulosEstagio(idioma) as Record<string, string>)[u.estagio] ?? u.estagio,
    uf: u.uf,
    mw_fiscalizado: u.mw_fiscalizado,
    mw_outorgado: u.mw_outorgado,
    municipios: u.municipios.map(nomeMunicipio).join("; "),
    n_declarados: u.n_declarados,
    coordenada:
      u.coord_no_declarado === 1
        ? tx("no município declarado", "in the declared municipality", idioma)
        : u.coord_no_declarado === 0
          ? tx("fora do município declarado", "outside the declared municipality", idioma)
          : tx("sem conferência", "not checked", idioma),
    outorga: u.outorga === null ? null : rotuloDado(u.outorga, OUTORGA_SIGA_EN, idioma),
    registro: simNao(u.registro_ate_10kw, idioma),
  };
}

export function colunasUsinas(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "nome", rotulo: tx("Usina", "Plant", idioma), tipo: "texto", idiomaTexto: "nome" },
    { id: "id", rotulo: "CEG", tipo: "texto" },
    { id: "tipo", rotulo: tx("Tipo", "Type", idioma), tipo: "texto", categorica: true },
    { id: "estagio", rotulo: tx("Estágio", "Stage", idioma), tipo: "texto", categorica: true },
    { id: "uf", rotulo: tx("UF", "State", idioma), tipo: "texto", categorica: true },
    { id: "mw_fiscalizado", rotulo: tx("Potência fiscalizada", "Inspected capacity", idioma), tipo: "numero", unidade: "MW", casas: 3 },
    { id: "mw_outorgado", rotulo: tx("Potência outorgada", "Granted capacity", idioma), tipo: "numero", unidade: "MW", casas: 3 },
    { id: "municipios", rotulo: tx("Municípios declarados", "Declared municipalities", idioma), tipo: "texto", idiomaTexto: "nome" },
    { id: "coordenada", rotulo: tx("Coordenada", "Coordinate", idioma), tipo: "texto", categorica: true },
    { id: "outorga", rotulo: tx("Outorga", "Grant", idioma), tipo: "texto", categorica: true },
    { id: "registro", rotulo: tx("Registro de até 10 kW", "Registration of up to 10 kW", idioma), tipo: "texto", categorica: true },
  ];
}
export const COLUNAS_USINAS: ColunaTabela[] = colunasUsinas("pt");

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

export function conjuntosDoMunicipio(
  m: Pick<MunicipioT, "conj">,
  tabela: Record<string, LinhaConjuntoTerritorio>,
  idx: IndiceDistribuidoras,
  idioma: Idioma = idiomaEnergia(),
): LinhaConjunto[] {
  return m.conj.flatMap((id) => {
    const c = tabela[String(id)];
    if (!c) return [];
    const [nome, dist, ano, meses, dec, fec, decLim, fecLim, ucs, nMun] = c;
    const distribuidora = dist === null ? tx("sem distribuidora", "no distribution utility", idioma) : (idx.get(dist)?.sigla ?? tx(`distribuidora ${dist}`, `utility ${dist}`, idioma));
    return [{ id: String(id), nome, distribuidora, ano, meses, dec_h: dec, fec, dec_lim_h: decLim, fec_lim: fecLim, ucs, n_mun: nMun }];
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
export function textoPopulacao(pop: number | null | undefined, idioma: Idioma = idiomaEnergia()): string | undefined {
  if (pop === null || pop === undefined || !Number.isFinite(pop)) return undefined;
  if (pop >= 1e6) return tx(`${num(pop / 1e6, 1)} mi hab.`, `${num(pop / 1e6, 1, idioma)} M inhab.`, idioma);
  if (pop >= 1e3) return tx(`${num(pop / 1e3, 0)} mil hab.`, `${num(pop / 1e3, 0, idioma)} thousand inhab.`, idioma);
  return tx(`${num(pop, 0)} hab.`, `${num(pop, 0, idioma)} inhab.`, idioma);
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
export function entidadesBusca(
  d: Pick<DadosExplorador, "submercados" | "ufs" | "distribuidoras">,
  municipios: readonly MunicipioT[] | null,
  idioma: Idioma = idiomaEnergia(),
): EntidadeTerritorio[] {
  const out: EntidadeTerritorio[] = [];
  const detSm = tx("submercado", "submarket", idioma);
  const detUf = tx("UF", "state", idioma);
  const detDist = tx("distribuidora", "distribution utility", idioma);
  const detMun = tx("município", "municipality", idioma);
  for (const s of d.submercados) out.push({ id: `sm:${s.id}`, rotulo: s.nome, detalhe: detSm, sinonimos: [s.id], tipo: "sm" });
  for (const u of d.ufs) out.push({ id: `uf:${u.uf}`, rotulo: u.nome ?? u.uf, detalhe: `${detUf} ${u.uf}`, sinonimos: [u.uf], tipo: "uf" });
  for (const x of d.distribuidoras)
    out.push({ id: `dist:${x.id}`, rotulo: x.sigla, detalhe: `${detDist} · ${x.ufs}`, sinonimos: [x.nome ?? "", x.id, x.cnpj_formatado ?? ""], tipo: "dist" });
  if (municipios)
    // por população decrescente: nas homônimas e nas buscas por parte do nome, o município maior vem antes (o desempate da busca é a ordem recebida)
    for (const m of [...municipios].sort((a, b) => (b.pop ?? -1) - (a.pop ?? -1)))
      out.push({ id: `mun:${m.ibge}`, rotulo: m.nome, detalhe: `${detMun} · ${m.uf}`, sinonimos: [m.ibge, m.uf], tipo: "mun", pop: m.pop, populacao: textoPopulacao(m.pop, idioma) });
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

/**
 * Texto que a base publicada escreve para quem audita, sem os nomes de campo e de estado do bastidor: "estado 1 (confirmado)", "provado_com_area_sem_carga",
 * "fora_do_sin", "gold", "pipeline", o nome do serviço da EPE e as listas no formato do programa viram palavras comuns. "Provada" vira "conferida", a
 * palavra que a página usa para o teste de consistência da carga em dois dias.
 */
export function textoLegivel(texto: string): string {
  return texto
    .replace(/vínculo com estado 1 \(confirmado\) ou 2 \(só pelo cadastro de MMGD\); estado 0 aparece com ressalva/g, "vínculo confirmado ou só pelo cadastro de MMGD; o vínculo sem confirmação aparece com ressalva")
    .replace(/campo dist \(estado 1 ou 2\)/g, "vínculo confirmado ou só pelo cadastro de MMGD")
    .replace(/estado 'provado' ou 'provado_com_area_sem_carga'/g, "submercado da UF conferido (por todas as áreas ou por uma delas)")
    .replace(/com 'com_localidade_isolada'/g, "com localidade isolada")
    .replace(/com 'fora_do_sin'/g, "fora do SIN")
    .replace(/'provado_com_area_sem_carga'/g, "conferido por uma das áreas")
    .replace(/\(area\.fora_do_sin\)/g, "(contagem à parte)")
    .replace(/com parte_fora_do_sin,/g, "com parte da área fora do SIN,")
    .replace(/\balternativas_que_fechariam_pelas_medias\b/g, "a lista de alternativas que fechariam pelas médias")
    .replace(/\bprovad(a|o|as|os)\b/g, "conferid$1")
    .replace(/\bgold de ([A-Za-zÀ-ÿ]+)/g, "base publicada de $1")
    .replace(/\bna gold\b/g, "na base publicada")
    .replace(/\bno pipeline\b/g, "na rotina de geração dos dados")
    .replace(/\(serviço WMS_Webmap_EPE_Data\)/g, "(serviço de mapas da EPE)")
    .replace(/\[((?:\('[^']*', '[^']*'\)(?:, )?)+)\]/g, (_m, pares: string) =>
      Array.from(pares.matchAll(/\('([^']*)', '([^']*)'\)/g))
        .map((x) => `${x[1]} lido como ${x[2]}`)
        .join("; "),
    )
    .replace(/\[((?:'[^']*'(?:, )?)+)\]/g, (_m, itens: string) =>
      Array.from(itens.matchAll(/'([^']*)'/g))
        .map((x) => x[1])
        .join(", "),
    );
}

/**
 * A evidência de um bloqueio como a base a escreve (um endereço do serviço consultado ou um caminho do repositório): o endereço vira o nome do
 * servidor, e o caminho interno diz que é um relatório interno, não publicado no site.
 */
export function evidenciaLegivel(evidencia: string, idioma: Idioma = idiomaEnergia()): { texto: string; href: string | null } {
  if (/^https?:\/\//.test(evidencia)) {
    try {
      const host = new URL(evidencia).hostname;
      return { texto: tx(`consulta ao serviço em ${host}`, `query to the service at ${host}`, idioma), href: evidencia };
    } catch {
      return { texto: evidencia, href: null };
    }
  }
  const rel = /^docs\/observatorios\/energia\/modulos\/(\w+)\.md, (.+)$/.exec(evidencia);
  if (rel) {
    const modulo = `${rel[1].charAt(0).toUpperCase()}${rel[1].slice(1)}`;
    return {
      texto: tx(`relatório interno do módulo ${modulo}, ${rel[2]} (não publicado no site)`, `internal report of the ${modulo} module, ${rel[2]} (not published on the site)`, idioma),
      href: null,
    };
  }
  return { texto: evidencia, href: null };
}

/** Qualidade da malha do IBGE como a gold a publica ("minima", "intermediaria") escrita em português. */
export function textoQualidadeMalha(qualidade: string, idioma: Idioma = idiomaEnergia()): string {
  const ROTULO: Record<string, string> = {
    minima: tx("mínima, simplificada para desenhar", "minimum, simplified for drawing", idioma),
    intermediaria: tx("intermediária", "intermediate", idioma),
    maxima: tx("máxima", "maximum", idioma),
  };
  return ROTULO[qualidade] ?? qualidade;
}

/* ================================================================ distribuidoras: o que falta e como se distribuem */

/**
 * Por que algumas distribuidoras ficam sem tarifa B1 residencial no quadro: a vigência anterior terminou e a seguinte ainda não consta no
 * arquivo da ANEEL, a distribuidora foi incorporada por outra, ou o arquivo não tem linha para ela. Escrito a partir do motivo que a gold publica
 * para cada uma; null quando todas têm tarifa.
 */
export function textoSemTarifa(dist: readonly Pick<LinhaDistribuidora, "tarifa" | "tarifa_motivo">[], idioma: Idioma = idiomaEnergia()): string | null {
  const sem = dist.filter((d) => d.tarifa === null);
  if (!sem.length) return null;
  const encerrada = sem.filter((d) => /vigência encerrada/i.test(d.tarifa_motivo ?? "")).length;
  const incorporada = sem.filter((d) => !/vigência encerrada/i.test(d.tarifa_motivo ?? "") && /incorporada/i.test(d.tarifa_motivo ?? "")).length;
  const outras = sem.length - encerrada - incorporada;
  const n = (v: number) => inteiro(v, idioma);
  const partes = [
    encerrada
      ? tx(
          `${n(encerrada)} tiveram a vigência encerrada e a tarifa seguinte ainda não consta no arquivo da ANEEL`,
          `${n(encerrada)} had their validity period end and the next tariff is not yet in ANEEL's file`,
          idioma,
        )
      : "",
    incorporada
      ? tx(
          `${n(incorporada)} ${incorporada === 1 ? "foi incorporada" : "foram incorporadas"} por outra distribuidora`,
          `${n(incorporada)} ${incorporada === 1 ? "was" : "were"} merged into another distribution utility`,
          idioma,
        )
      : "",
    outras
      ? tx(
          `${n(outras)} ${outras === 1 ? "não tem" : "não têm"} linha de tarifa residencial no arquivo`,
          `${n(outras)} ${outras === 1 ? "has" : "have"} no residential tariff row in the file`,
          idioma,
        )
      : "",
  ].filter(Boolean);
  return tx(
    `${n(sem.length)} das ${n(dist.length)} distribuidoras do quadro ficam sem tarifa B1 residencial: ${partes.join("; ")}.`,
    `${n(sem.length)} of the ${n(dist.length)} distribution utilities in the table have no residential B1 tariff: ${partes.join("; ")}.`,
    idioma,
  );
}

export type QuartisIndicador = {
  id: string;
  rotulo: string;
  unidade: string;
  casas: number;
  n: number;
  min: number | null;
  p25: number | null;
  mediana: number | null;
  p75: number | null;
  max: number | null;
  /** Parcela, em %, das unidades consumidoras do quadro que as distribuidoras desta linha reúnem; null sem unidades consumidoras publicadas. */
  cobertura_uc_pct: number | null;
  /** Mediana em que cada distribuidora pesa as suas unidades consumidoras (o menor valor que reúne metade do peso); null sem o peso. */
  mediana_uc: number | null;
};

/** Mediana ponderada: o menor valor em que o peso acumulado chega à metade do peso total. */
export function medianaPonderada(pares: readonly { v: number; w: number }[]): number | null {
  const p = pares.filter((x) => Number.isFinite(x.v) && Number.isFinite(x.w) && x.w > 0).sort((a, b) => a.v - b.v);
  if (!p.length) return null;
  const total = p.reduce((a, x) => a + x.w, 0);
  let acc = 0;
  for (const x of p) {
    acc += x.w;
    if (acc >= total / 2) return x.v;
  }
  return p[p.length - 1].v;
}

const sinalizadaPerdas = (d: Pick<LinhaDistribuidora, "perdas_sinal">) => d.perdas_sinal !== null && !ehSemSinalPerdas(d.perdas_sinal);

/**
 * Como os indicadores do quadro de distribuidoras se distribuem entre elas: menor, quartis e maior, só entre as que têm o valor (quantil tipo 7, o
 * mesmo do pipeline). Cada valor é o da área inteira da distribuidora; a distribuição não diz nada sobre um município. Cada distribuidora conta uma
 * vez, seja qual for o tamanho; as duas últimas colunas mostram o outro lado: quantas unidades consumidoras as distribuidoras da linha reúnem e a
 * mediana em que cada uma pesa as suas.
 *
 * As perdas ficam em linhas separadas pela energia sobre a qual a taxa foi calculada (injetada publicada, requerida ou mistura dos dois no ano), porque
 * taxas de bases diferentes não formam uma distribuição só; as taxas que o módulo Perdas sinaliza (ano parcial, balanço que não fecha, valor fora de 0% a
 * 100%) saem das linhas por base e vão para uma linha própria, a mesma exclusão que o módulo faz no total nacional.
 */
export function quartisDistribuidoras(dist: readonly LinhaDistribuidora[], idioma: Idioma = idiomaEnergia()): QuartisIndicador[] {
  type Campo = { id: string; rotulo: string; unidade: string; casas: number; v: (d: LinhaDistribuidora) => number | null; entra?: (d: LinhaDistribuidora) => boolean };
  const perdasPorBase = (base: BasePerdas, rotulo: string): Campo => ({
    id: `perdas_${base}`,
    rotulo,
    unidade: "%",
    casas: 2,
    v: (d) => d.perdas_pct,
    entra: (d) => !sinalizadaPerdas(d) && baseDoRotulo(d.perdas_base) === base,
  });
  const campos: Campo[] = [
    { id: "tarifa", rotulo: tx("Tarifa B1 residencial, sem tributos", "Residential B1 tariff, before taxes", idioma), unidade: "R$/MWh", casas: 2, v: (d) => d.tarifa },
    perdasPorBase("requerida", tx("Perdas totais sobre a energia requerida", "Total losses over the required energy", idioma)),
    perdasPorBase("publicada", tx("Perdas totais sobre a energia injetada publicada", "Total losses over the published injected energy", idioma)),
    perdasPorBase("mista", tx("Perdas totais sobre a energia injetada e a requerida no mesmo ano", "Total losses over injected and required energy in the same year", idioma)),
    {
      id: "perdas_sem_base",
      rotulo: tx("Perdas totais, base não registrada", "Total losses, base not recorded", idioma),
      unidade: "%",
      casas: 2,
      v: (d) => d.perdas_pct,
      entra: (d) => !sinalizadaPerdas(d) && d.perdas_pct !== null && baseDoRotulo(d.perdas_base) === null,
    },
    {
      id: "perdas_sinalizadas",
      rotulo: tx(
        "Perdas totais com sinalização (ano parcial, balanço que não fecha ou valor fora de 0% a 100%), de qualquer base",
        "Total losses with a flag (partial year, balance that does not close or value outside 0% to 100%), any base",
        idioma,
      ),
      unidade: "%",
      casas: 2,
      v: (d) => d.perdas_pct,
      entra: sinalizadaPerdas,
    },
    { id: "dec_h", rotulo: tx("DEC da distribuidora", "DEC of the distribution utility", idioma), unidade: "h", casas: 2, v: (d) => d.dec_h },
    { id: "fec", rotulo: tx("FEC da distribuidora", "FEC of the distribution utility", idioma), unidade: tx("interrupções", "interruptions", idioma), casas: 2, v: (d) => d.fec },
    { id: "tsee_pct", rotulo: tx("Residenciais com Tarifa Social", "Residential customers with the Social Tariff", idioma), unidade: "%", casas: 2, v: (d) => d.tsee_pct },
  ];
  const ucTotal = dist.reduce((a, d) => a + (d.ucs ?? 0), 0);
  return campos
    .map((c) => {
      const doCampo = dist.filter((d) => (c.entra ? c.entra(d) : true) && c.v(d) !== null);
      const r = resumo(doCampo.map(c.v));
      const comPeso = doCampo.filter((d) => d.ucs !== null && d.ucs > 0);
      const peso = comPeso.reduce((a, d) => a + (d.ucs ?? 0), 0);
      return {
        id: c.id,
        rotulo: c.rotulo,
        unidade: c.unidade,
        casas: c.casas,
        n: r.n,
        min: r.min,
        p25: r.p25,
        mediana: r.mediana,
        p75: r.p75,
        max: r.max,
        cobertura_uc_pct: ucTotal > 0 && comPeso.length ? (100 * peso) / ucTotal : null,
        mediana_uc: medianaPonderada(comPeso.map((d) => ({ v: c.v(d) as number, w: d.ucs as number }))),
      };
    })
    .filter((q) => q.n > 0 || !q.id.startsWith("perdas_"));
}

/**
 * A nota das perdas sob a tabela de quartis: sobre qual energia cada distribuidora calcula a taxa, quantas há em cada caso, a maior diferença entre a
 * taxa na base da distribuidora e a mesma perda sobre a energia injetada publicada, e o que fica na linha das taxas sinalizadas.
 */
export function textoBasesDePerdas(dist: readonly LinhaDistribuidora[], idioma: Idioma = idiomaEnergia()): string {
  const comPerdas = dist.filter((d) => d.perdas_pct !== null);
  if (!comPerdas.length) return tx("Nenhuma distribuidora do quadro tem taxa de perdas nesta publicação.", "No distribution utility in the table has a loss rate in this release.", idioma);
  const sinalizadas = comPerdas.filter(sinalizadaPerdas);
  const limpas = comPerdas.filter((d) => !sinalizadaPerdas(d));
  const n = (b: BasePerdas) => limpas.filter((d) => baseDoRotulo(d.perdas_base) === b).length;
  const semBase = limpas.length - n("requerida") - n("publicada") - n("mista");
  let maior: { sigla: string; taxa: number; pub: number; base: string } | null = null;
  for (const d of limpas) {
    if (d.perdas_pct === null || d.perdas_pct_pub === null) continue;
    if (!maior || Math.abs(d.perdas_pct - d.perdas_pct_pub) > Math.abs(maior.taxa - maior.pub)) maior = { sigla: d.sigla, taxa: d.perdas_pct, pub: d.perdas_pct_pub, base: d.perdas_base ?? "" };
  }
  const dif = maior ? Math.abs(maior.taxa - maior.pub) : 0;
  const taxas = sinalizadas.map((d) => d.perdas_pct as number);
  const i = (v: number) => inteiro(v, idioma);
  const semRegistro = semBase ? tx(`, ${i(semBase)} sem o registro`, `, ${i(semBase)} without the record`, idioma) : "";
  const pontos = dif < 2 ? tx("ponto percentual", "percentage point", idioma) : tx("pontos percentuais", "percentage points", idioma);
  const diferenca = maior
    ? tx(
        ` A diferença chega a ${num(dif, 1)} ${pontos}: ${maior.sigla} tem ${num(maior.taxa, 2)}% sobre a ${maior.base} e ${num(maior.pub, 2)}% sobre a energia injetada publicada.`,
        ` The difference reaches ${num(dif, 1, idioma)} ${pontos}: ${maior.sigla} has ${num(maior.taxa, 2, idioma)}% over the ${maior.base} and ${num(maior.pub, 2, idioma)}% over the published injected energy.`,
        idioma,
      )
    : "";
  const bases =
    semBase === limpas.length
      ? tx(
          "A energia sobre a qual cada taxa foi calculada não foi lida do arquivo de perdas por distribuidora nesta publicação.",
          "The energy on which each rate was calculated was not read from the losses-by-utility file in this release.",
          idioma,
        )
      : tx(
          `Cada distribuidora calcula a taxa sobre a energia que a ANEEL permite: a energia injetada publicada, a energia requerida (fornecida mais irregular mais perdas), onde o leiaute de 2024 do balanço deixou de fechar com a perda calculada pela fonte, ou uma mistura dos dois no mesmo ano. Por isso as perdas ficam em linhas separadas pela energia de referência (${i(n("requerida"))} sobre a energia requerida, ${i(n("publicada"))} sobre a injetada publicada e ${i(n("mista"))} com os dois no mesmo ano${semRegistro}), e juntá-las numa só distribuição misturaria bases diferentes.${diferenca}`,
          `Each distribution utility calculates the rate over the energy ANEEL allows: the published injected energy, the required energy (supplied plus irregular plus losses), where the 2024 layout of the balance stopped matching the loss calculated by the source, or a mix of the two in the same year. That is why the losses are in separate rows by reference energy (${i(n("requerida"))} over the required energy, ${i(n("publicada"))} over the published injected energy and ${i(n("mista"))} with both in the same year${semRegistro}), and putting them in a single distribution would mix different bases.${diferenca}`,
          idioma,
        );
  const sinal = sinalizadas.length
    ? tx(
        ` As ${i(sinalizadas.length)} taxas que o módulo Perdas sinaliza (ano parcial, balanço que não fecha ou valor fora de 0% a 100%), de ${num(Math.min(...taxas), 2)}% a ${num(Math.max(...taxas), 2)}%, ficam numa linha à parte e fora das linhas por base, como o módulo as deixa fora do total nacional.`,
        ` The ${i(sinalizadas.length)} rates the Losses module flags (partial year, balance that does not close or value outside 0% to 100%), from ${num(Math.min(...taxas), 2, idioma)}% to ${num(Math.max(...taxas), 2, idioma)}%, are in a separate row and out of the rows by base, just as the module leaves them out of the national total.`,
        idioma,
      )
    : "";
  return `${bases}${sinal}`;
}

/* ================================================================ recorte do painel (seção 7.2, item 3) */

/**
 * Por que o cadastro tem mais distribuidoras que a relação de municípios: as que não têm município na relação vigente. Quando
 * todas estão inativas na gold, a causa é dita ("encerradas ou absorvidas"); com alguma ativa ou sem informação, só a contagem.
 */
function causaSemArea(ds: readonly Pick<DistribuidoraTerritorio, "area" | "ativa">[], idioma: Idioma): string {
  const sem = ds.filter((d) => d.area.municipios === 0);
  if (!sem.length) return "";
  const n = inteiro(sem.length, idioma);
  return sem.every((d) => d.ativa === false)
    ? tx(`; as outras ${n} foram encerradas ou absorvidas`, `; the other ${n} were closed or absorbed`, idioma)
    : tx(`; ${n} sem município na relação`, `; ${n} with no municipality in the list`, idioma);
}

/** Universo do painel, todo tirado da gold. */
export function textoUniverso(g: Pick<GoldTerritorio, "resumo" | "ufs" | "submercados" | "distribuidoras">, idioma: Idioma = idiomaEnergia()): string {
  const comArea = g.distribuidoras.filter((d) => d.area.municipios > 0).length;
  const n = (v: number) => inteiro(v, idioma);
  const causa = causaSemArea(g.distribuidoras, idioma);
  return tx(
    `${n(g.resumo.municipios)} municípios do IBGE, ${n(g.ufs.length)} UFs, ${n(g.submercados.length)} submercados, ` +
      `${n(comArea)} distribuidoras com município na relação (de ${n(g.distribuidoras.length)} no cadastro${causa}), ` +
      `${n(g.resumo.conjuntos_referenciados)} conjuntos elétricos e ${n(g.resumo.usinas.total)} usinas do SIGA`,
    `${n(g.resumo.municipios)} IBGE municipalities, ${n(g.ufs.length)} states, ${n(g.submercados.length)} submarkets, ` +
      `${n(comArea)} distribution utilities with a municipality in the list (of ${n(g.distribuidoras.length)} in the register${causa}), ` +
      `${n(g.resumo.conjuntos_referenciados)} consumer sets and ${n(g.resumo.usinas.total)} SIGA plants`,
    idioma,
  );
}

/** Período do painel: as referências anuais e as diárias mais recentes, agrupadas por data; cada número traz a sua. */
export function textoPeriodoPainel(g: Pick<GoldTerritorio, "referencias"> & Partial<Pick<GoldTerritorio, "submercados">>, idioma: Idioma = idiomaEnergia()): string {
  const r = g.referencias;
  // a estimativa de MMGD do ONS é mensal e vem do bloco de cada submercado, não das referências diárias
  let mesMmgdOns: string | null = null;
  for (const s of g.submercados ?? []) {
    const b = s.indicadores.mmgd_ons;
    if (b.disponivel) {
      mesMmgdOns = b.periodo.fim;
      break;
    }
  }
  const porData = new Map<string, string[]>();
  for (const [rotulo, data] of [
    [tx("tarifa vigente", "tariff in force", idioma), r.tarifa_data],
    ["SIGA", r.siga_data],
    ["PLD", r.pld_dia],
    [tx("cadastro de MMGD", "MMGD register", idioma), r.mmgd_data_cadastro],
    ["EAR", r.ear_dia],
  ] as const) {
    if (!data) continue;
    porData.set(data, [...(porData.get(data) ?? []), rotulo]);
  }
  const de = tx("de", "of", idioma);
  const diarias = Array.from(porData.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([data, rotulos]) => `${lista(rotulos, idioma)} ${de} ${dataBR(data, idioma)}`);
  const semData = tx("sem data", "no date", idioma);
  return [
    tx(`relação de distribuidoras de ${r.relacao_distribuidoras_ano ?? semData}`, `list of distribution utilities of ${r.relacao_distribuidoras_ano ?? semData}`, idioma),
    ...(r.perdas_ano === r.qualidade_ano
      ? [tx(`perdas, DEC e FEC de ${r.perdas_ano ?? semData}`, `losses, DEC and FEC of ${r.perdas_ano ?? semData}`, idioma)]
      : [tx(`perdas de ${r.perdas_ano ?? semData}`, `losses of ${r.perdas_ano ?? semData}`, idioma), tx(`DEC e FEC de ${r.qualidade_ano ?? semData}`, `DEC and FEC of ${r.qualidade_ano ?? semData}`, idioma)]),
    ...diarias,
    ...(mesMmgdOns ? [tx(`estimativa de MMGD do ONS de ${textoReferencia(mesMmgdOns, idioma)}`, `ONS MMGD estimate of ${textoReferencia(mesMmgdOns, idioma)}`, idioma)] : []),
    tx("cada medida traz a data da sua fonte", "each measure carries the date of its source", idioma),
  ].join("; ");
}
