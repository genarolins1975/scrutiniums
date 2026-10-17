/**
 * Lógica pura das páginas Transição e ambiente (/setor-eletrico/transicao), sem
 * React e testável em node (src/tests/energia-transicao.test.ts).
 *
 * Por que um arquivo próprio: os componentes "use client" só exportam componentes,
 * e as mesmas linhas precisam alimentar o gráfico, a tabela equivalente e a
 * exportação (seção 11.7 da especificação: "equivalência entre gráfico, tabela e
 * exportação"). Cada função `linhas*` ou `dados*` monta UMA matriz que o gráfico e
 * a tabela recebem iguais; o teste confere essa matriz contra os CSV publicados por
 * pipeline/energia/modulos/transicao.py, por caminho independente quando há um.
 *
 * O que fica aqui:
 *  - seleção, ordenação e conversão de formato de números publicados na gold;
 *    nenhuma razão, média ou taxa é refeita (a fórmula roda no pipeline). A única
 *    agregação é a soma das fontes de um município e ano, lida do CSV publicado,
 *    para o histórico municipal sob demanda (e o teste a confere contra o total do
 *    município publicado no JSON municipal);
 *  - as respostas curtas e os textos "o que mudou", gerados por regra
 *    determinística a partir dos números publicados (seção 7.4). Nenhuma frase traz
 *    número fixo: todo número vem do argumento, e a ausência vira "sem dado";
 *  - os esquemas de estado na URL (useEstadoUrl), constantes de módulo, e a tabela
 *    oficial de códigos de UF do IBGE (o mapa usa o código; a gold, a sigla).
 *
 * Três grandezas que nunca se somam (ver tipos-transicao.ts): capacidade cadastrada
 * na ANEEL (unidades, kW, MW), energia de MMGD estimada pelo ONS (MWmed, TWh, só
 * SIN) e fator de emissão do MCTI (tCO2/MWh, só CO2). Cada função diz a sua.
 */
import type {
  BlocoEmissoes,
  BlocoMmgd,
  BlocoOnsMmgd,
  ConferenciaQuebra2023,
  FatorAno,
  FatorMes,
  MmgdAno,
  MmgdDistribuidora,
  MmgdFonte,
  MmgdMes,
  MmgdMunicipioCurto,
  MmgdPerfilLinha,
  MmgdUf,
  MmgdUfAno,
  MunicipiosMmgdArquivo,
  OnsMmgdAno,
  OnsMmgdMes,
} from "./tipos-transicao";
import type { Leitor } from "./estadoUrl";
import type { Idioma } from "@/lib/idioma";
import { campo, tiposUrl } from "./estadoUrl";
import { carimbo, dataBR, mesAno, nomeMes, nomeSubmercado, num, pct, plural } from "./formato";
import { idiomaEnergia, tx } from "./idioma";
import {
  AVISO_DISTRIBUIDORA,
  DIA_SEMANA_EN,
  FERIADO_EN,
  FONTE_MMGD_EN,
  NOTA_TRANSICAO_EN,
  rotuloDado,
} from "./i18n/expansao-transicao-territorio";
import { LIMITE_COMPARACAO, type ColunaTabela } from "./tabela";

/* ================================================================ comum */

/**
 * Ausência dentro de frase. O traço de AUSENTE (formato.ts) serve às células de
 * tabela; no meio de um texto ele se leria como pontuação, então as funções de
 * texto deste arquivo dizem "sem dado".
 */
export function semDado(idioma: Idioma = idiomaEnergia()): string {
  return tx("sem dado", "no data", idioma);
}
export const SEM_DADO = semDado("pt");
const temValor = (v: number | null | undefined): v is number => v !== null && v !== undefined && Number.isFinite(v);

/** "2025-05" → "mai/2025"; ausência → "sem dado". */
export function mes(m: string | null | undefined, idioma: Idioma = idiomaEnergia()): string {
  return m ? mesAno(m, idioma) : semDado(idioma);
}

/** "2026-09-29" → "29/09/2026"; ausência → "sem dado". */
export function data(iso: string | null | undefined, idioma: Idioma = idiomaEnergia()): string {
  return iso ? dataBR(iso, idioma) : semDado(idioma);
}

/** Inteiro em pt-BR (unidades, municípios, habitantes); ausência → "sem dado". */
export function inteiro(v: number | null | undefined, idioma: Idioma = idiomaEnergia()): string {
  return temValor(v) ? num(v, 0, idioma) : semDado(idioma);
}

export function numTexto(v: number | null | undefined, casas = 1, idioma: Idioma = idiomaEnergia()): string {
  return temValor(v) ? num(v, casas, idioma) : semDado(idioma);
}

export function pctTexto(v: number | null | undefined, casas = 1, idioma: Idioma = idiomaEnergia()): string {
  return temValor(v) ? pct(v, casas, idioma) : semDado(idioma);
}

/**
 * Contagem com o substantivo concordando com o número publicado ("1 registro", "46
 * registros"): a contagem vem da gold e pode mudar a cada publicação, então a
 * concordância não pode ficar escrita à mão. É o `plural` de formato.ts com a
 * ausência dita em palavras ("sem dado"), para uso dentro de frase.
 */
export function contagem(v: number | null | undefined, um: string, varios: string, idioma: Idioma = idiomaEnergia()): string {
  return temValor(v) ? plural(v, um, varios, idioma) : semDado(idioma);
}

/** Fator de emissão com as 4 casas publicadas pelo MCTI ("0,0461"); ausência → "sem dado". */
export function fator(v: number | null | undefined, idioma: Idioma = idiomaEnergia()): string {
  return temValor(v) ? num(v, 4, idioma) : semDado(idioma);
}

/**
 * Participação em % com a regra da gold (regras.participacoes): duas casas; abaixo
 * de 0,01% e diferente de zero, dois algarismos significativos ("0,005%",
 * "0,00097%"), para que uma categoria pequena nunca apareça como zero.
 */
export function participacaoTexto(v: number | null | undefined, idioma: Idioma = idiomaEnergia()): string {
  if (!temValor(v)) return semDado(idioma);
  if (v !== 0 && Math.abs(v) < 0.01) {
    const s = Number(v.toPrecision(2)).toLocaleString(tx("pt-BR", "en-US", idioma), { maximumFractionDigits: 12 });
    return `${s}%`;
  }
  return pct(v, 2, idioma);
}

/**
 * Compara dois valores no arredondamento em que aparecem no texto: "maior", "menor"
 * ou "igual". Ausência em qualquer lado → null (o texto não afirma direção).
 */
export function comparaArredondado(a: number | null | undefined, b: number | null | undefined, casas: number): "maior" | "menor" | "igual" | null {
  if (!temValor(a) || !temValor(b)) return null;
  const f = 10 ** casas;
  const ra = Math.round(a * f);
  const rb = Math.round(b * f);
  return ra > rb ? "maior" : ra < rb ? "menor" : "igual"; // i18n: dado
}

/** Lista legível: "a", "a e b", "a, b e c" ("a, b and c" em inglês). */
export function listaTexto(itens: readonly string[], idioma: Idioma = idiomaEnergia()): string {
  if (itens.length <= 1) return itens[0] ?? "";
  return `${itens.slice(0, -1).join(", ")} ${tx("e", "and", idioma)} ${itens.at(-1)}`;
}

/** Item de maior (ou menor) valor, ignorando ausências; empate fica com o primeiro na ordem publicada. */
function extremo<T>(itens: readonly T[], valor: (x: T) => number | null | undefined, sentido: "max" | "min"): T | null {
  let melhor: T | null = null;
  let mv = 0;
  for (const x of itens) {
    const v = valor(x);
    if (!temValor(v)) continue;
    if (melhor === null || (sentido === "max" ? v > mv : v < mv)) {
      melhor = x;
      mv = v;
    }
  }
  return melhor;
}

/* ---------------------------------------------------------------- UF */

/**
 * Códigos de UF do IBGE (dois dígitos), os mesmos ids da malha publicada em
 * public/energia/geo/uf.json; o teste confere cada par contra o arquivo da malha.
 */
export const CODIGO_UF: Readonly<Record<string, string>> = {
  RO: "11", AC: "12", AM: "13", RR: "14", PA: "15", AP: "16", TO: "17",
  MA: "21", PI: "22", CE: "23", RN: "24", PB: "25", PE: "26", AL: "27", SE: "28", BA: "29",
  MG: "31", ES: "32", RJ: "33", SP: "35",
  PR: "41", SC: "42", RS: "43",
  MS: "50", MT: "51", GO: "52", DF: "53",
};
export const UFS: readonly string[] = Object.keys(CODIGO_UF);
const SIGLA_DO_CODIGO: Readonly<Record<string, string>> = Object.fromEntries(Object.entries(CODIGO_UF).map(([s, c]) => [c, s]));

export function codigoUf(sigla: string | null | undefined): string | null {
  return sigla ? (CODIGO_UF[sigla] ?? null) : null;
}
export function siglaDoCodigo(codigo: string | null | undefined): string | null {
  return codigo ? (SIGLA_DO_CODIGO[codigo] ?? null) : null;
}

/* ================================================================ páginas */

export const ROTA_TRANSICAO = "/setor-eletrico/transicao";
/** Pergunta da abertura do módulo (o título da página de síntese), no idioma. */
export function perguntaTransicao(idioma: Idioma = idiomaEnergia()): string {
  return tx("Como a matriz está mudando?", "How is the power mix changing?", idioma);
}
export const PERGUNTA_TRANSICAO = perguntaTransicao("pt");
export type PainelTransicao = "p063" | "ons" | "p064";

/** Perguntas da estimativa de energia do ONS (parte do P063) e do achado A11, na página da energia estimada. */
export function perguntaOns(idioma: Idioma = idiomaEnergia()): string {
  return tx(
    "Quanta energia a MMGD entrega ao SIN, segundo a estimativa do ONS?",
    "How much energy does distributed micro and mini generation (MMGD) deliver to the SIN, according to the ONS estimate?",
    idioma,
  );
}
export function perguntaA11(idioma: Idioma = idiomaEnergia()): string {
  return tx(
    "Quando o ONS passou a incluir a MMGD no Balanço de Energia, o degrau aparece na geração e na carga?",
    "When the ONS began including MMGD in the Energy Balance, does the step appear in generation and in load?",
    idioma,
  );
}
export const PERGUNTA_ONS = perguntaOns("pt");
export const PERGUNTA_A11 = perguntaA11("pt");

type PaginaPainelTransicao = { id: PainelTransicao; slug: string; rotulo: string; pergunta: string; painel: "P063" | "P064" };
/**
 * As páginas dos painéis, na ordem das perguntas (a próxima pergunta de cada uma é a
 * seguinte): o P063 em duas (o cadastro da ANEEL no território e a energia estimada
 * pelo ONS, com o achado A11) e o P064. O mapa municipal, as séries, as tabelas e as
 * fichas de prova, juntos numa página, passariam da meta de cerca de 600 KB de HTML
 * por página (contrato, seção 5.1).
 */
export function paineisTransicao(idioma: Idioma = idiomaEnergia()): readonly PaginaPainelTransicao[] {
  return [
    { id: "p063", slug: "mmgd", rotulo: tx("MMGD no território", "MMGD across the territory", idioma), pergunta: tx("Onde a geração distribuída cresce?", "Where is distributed generation growing?", idioma), painel: "P063" },
    { id: "ons", slug: "energia-estimada", rotulo: tx("Energia estimada (ONS)", "Estimated energy (ONS)", idioma), pergunta: perguntaOns(idioma), painel: "P063" },
    { id: "p064", slug: "emissoes", rotulo: tx("Emissões", "Emissions", idioma), pergunta: tx("Como varia a intensidade de emissões?", "How does emissions intensity vary?", idioma), painel: "P064" },
  ];
}
export const PAINEIS_TRANSICAO: readonly PaginaPainelTransicao[] = paineisTransicao("pt");

export function rotaPainel(id: PainelTransicao): string {
  const p = PAINEIS_TRANSICAO.find((x) => x.id === id);
  return p ? `${ROTA_TRANSICAO}/${p.slug}` : ROTA_TRANSICAO;
}

export function perguntaPainel(id: PainelTransicao, idioma: Idioma = idiomaEnergia()): string {
  return paineisTransicao(idioma).find((x) => x.id === id)!.pergunta;
}

/**
 * Painel de outro módulo que continua a narrativa das emissões: a matriz efetiva da
 * Geração (P021), com a pergunta do Anexo A. Sem âncora: o P021 é a própria página
 * /setor-eletrico/geracao, e uma âncora interna dela pode mudar quando aquele módulo
 * reorganizar os blocos.
 */
export function ligacaoGeracao(idioma: Idioma = idiomaEnergia()) {
  return { href: "/setor-eletrico/geracao", pergunta: tx("De onde vem a eletricidade?", "Where does electricity come from?", idioma) } as const;
}
export const LIGACAO_GERACAO = ligacaoGeracao("pt");

/** Fontes do módulo no idioma: o nome do recurso oficial em português vira descrição curta em inglês. */
function fontesTransicao(idioma: Idioma) {
  return {
    aneel: tx(
      "ANEEL, Relação de empreendimentos de Mini e Micro Geração Distribuída; IBGE, Estimativas de população (SIDRA 6579)",
      "ANEEL, register of distributed micro and mini generation projects; IBGE, population estimates (SIDRA 6579)",
      idioma,
    ),
    aneelCadastro: tx("ANEEL, Relação de empreendimentos de Mini e Micro Geração Distribuída", "ANEEL, register of distributed micro and mini generation projects", idioma),
    ons: tx("ONS, Carga de Energia Verificada (parcela de MMGD)", "ONS, verified energy load (MMGD share)", idioma),
    mcti: tx("MCTI, Fatores de emissão de CO2 da geração de energia elétrica no SIN", "MCTI, CO2 emission factors of electricity generation in the SIN", idioma),
  };
}
const FONTES_PT = fontesTransicao("pt");
const FONTES_EN_CHAVE = fontesTransicao("en");
export const FONTE_ANEEL = FONTES_PT.aneel;
export const FONTE_ANEEL_CADASTRO = FONTES_PT.aneelCadastro;
export const FONTE_ONS = FONTES_PT.ons;
export const FONTE_MCTI = FONTES_PT.mcti;
const FONTES_EN: Record<string, string> = Object.fromEntries(
  (Object.keys(FONTES_PT) as (keyof typeof FONTES_PT)[]).map((k) => [FONTES_PT[k], FONTES_EN_CHAVE[k]]),
);
/** Uma das fontes acima (na forma portuguesa) no idioma da página. */
export function fonteTransicao(fonte: string, idioma: Idioma = idiomaEnergia()): string {
  return idioma === "en" ? (FONTES_EN[fonte] ?? fonte) : fonte;
}

/* ================================================================ P063: MMGD (ANEEL) */

export const MEDIDAS_UF = ["whab", "mw", "umil", "cresc", "mwref"] as const;
export type MedidaUf = (typeof MEDIDAS_UF)[number];

type CampoUf = "w_por_habitante" | "potencia_mw" | "unidades_por_mil_habitantes" | "crescimento_estoque_ano_referencia_pct" | "potencia_mw_ano_referencia";

type DefMedidaUf = { campo: CampoUf; rotulo: string; unidade: string; casas: number };
/** Medidas do mapa e das barras por UF; o ano de referência entra no rótulo pela função `rotuloMedidaUf`. */
export function medidasUf(idioma: Idioma = idiomaEnergia()): Record<MedidaUf, DefMedidaUf> {
  return {
    whab: { campo: "w_por_habitante", rotulo: tx("Potência instalada por habitante", "Installed capacity per inhabitant", idioma), unidade: tx("W/hab", "W/inhab.", idioma), casas: 1 },
    mw: { campo: "potencia_mw", rotulo: tx("Potência instalada cadastrada", "Registered installed capacity", idioma), unidade: "MW", casas: 1 },
    umil: {
      campo: "unidades_por_mil_habitantes",
      rotulo: tx("Unidades por mil habitantes", "Units per thousand inhabitants", idioma),
      unidade: tx("unidades por mil hab.", "units per thousand inhab.", idioma),
      casas: 2,
    },
    cresc: { campo: "crescimento_estoque_ano_referencia_pct", rotulo: tx("Crescimento do estoque no ano", "Growth of the stock in the year", idioma), unidade: "%", casas: 1 },
    mwref: { campo: "potencia_mw_ano_referencia", rotulo: tx("Potência conectada no ano", "Capacity connected in the year", idioma), unidade: "MW", casas: 1 },
  };
}
export const MEDIDA_UF: Record<MedidaUf, DefMedidaUf> = medidasUf("pt");

export function rotuloMedidaUf(med: MedidaUf, anoReferencia: number, idioma: Idioma = idiomaEnergia()): string {
  const m = medidasUf(idioma)[med];
  return med === "cresc" || med === "mwref" ? `${m.rotulo} (${anoReferencia})` : m.rotulo;
}

export const DIMENSOES_PERFIL = ["classe", "modalidade", "porte", "tipo_consumidor"] as const;
export type DimensaoPerfil = (typeof DIMENSOES_PERFIL)[number];
export function rotulosDimensao(idioma: Idioma = idiomaEnergia()): Record<DimensaoPerfil, string> {
  return {
    classe: tx("Classe de consumo", "Consumption class", idioma),
    modalidade: tx("Modalidade de compensação", "Compensation mode", idioma),
    porte: tx("Porte", "Size", idioma),
    tipo_consumidor: tx("Tipo de consumidor", "Consumer type", idioma),
  };
}
export const ROTULO_DIMENSAO: Record<DimensaoPerfil, string> = rotulosDimensao("pt");

export const MEDIDAS_MUN = ["whab", "kw", "cresc", "fora"] as const;
export type MedidaMun = (typeof MEDIDAS_MUN)[number];
export function medidasMun(idioma: Idioma = idiomaEnergia()): Record<MedidaMun, { rotulo: string; unidade: string; casas: number }> {
  return {
    whab: { rotulo: tx("Potência instalada por habitante", "Installed capacity per inhabitant", idioma), unidade: tx("W/hab", "W/inhab.", idioma), casas: 1 },
    kw: { rotulo: tx("Potência instalada cadastrada", "Registered installed capacity", idioma), unidade: "kW", casas: 0 },
    cresc: { rotulo: tx("Crescimento do estoque no ano de referência", "Growth of the stock in the reference year", idioma), unidade: "%", casas: 1 },
    fora: {
      rotulo: tx("Unidades de distribuidora sem conjunto elétrico na UF", "Units of a distribution utility with no consumer set in the state", idioma),
      unidade: tx("unidades", "units", idioma),
      casas: 0,
    },
  };
}
export const MEDIDA_MUN = medidasMun("pt");

export const LISTAS_DESTAQUE = ["maior_crescimento_estoque", "maior_w_por_habitante", "maior_potencia", "menor_w_por_habitante"] as const;
export type ListaDestaque = (typeof LISTAS_DESTAQUE)[number];
export function rotulosDestaque(idioma: Idioma = idiomaEnergia()): Record<ListaDestaque, string> {
  return {
    maior_crescimento_estoque: tx("Maior crescimento do estoque no ano de referência", "Largest growth of the stock in the reference year", idioma),
    maior_w_por_habitante: tx("Maior potência por habitante", "Largest capacity per inhabitant", idioma),
    maior_potencia: tx("Maior potência instalada", "Largest installed capacity", idioma),
    menor_w_por_habitante: tx("Menor potência por habitante", "Smallest capacity per inhabitant", idioma),
  };
}
export const ROTULO_DESTAQUE: Record<ListaDestaque, string> = rotulosDestaque("pt");

const leitorUf = tiposUrl.opcao(UFS);
/** Código IBGE de município (7 dígitos); nenhum vínculo por nome. */
const leitorIbge: Leitor<string> = { ler: (b) => (/^\d{7}$/.test(b) ? b : undefined), escrever: (v) => v };

/**
 * Estado da página da MMGD na URL. Seleção de UF e de município são listas de até
 * quatro (comparação), e a última escolhida é a que o mapa e a tabela destacam: o
 * mapa, as barras, a tabela e o histórico leem a mesma lista.
 */
export const ESQUEMA_MMGD = {
  med: campo(tiposUrl.opcao(MEDIDAS_UF), "whab", { param: "mmgd.med" }),
  ufs: campo(tiposUrl.lista(leitorUf, { max: LIMITE_COMPARACAO }), [] as string[], { param: "mmgd.uf" }),
  de: campo(tiposUrl.mes(), "", { param: "mmgd.de" }), // i18n: dado
  ate: campo(tiposUrl.mes(), "", { param: "mmgd.ate" }),
  perfil: campo(tiposUrl.opcao(DIMENSOES_PERFIL), "classe", { param: "mmgd.perfil" }),
  mun: campo(tiposUrl.booleano(), false, { param: "mmgd.mun" }),
  mmed: campo(tiposUrl.opcao(MEDIDAS_MUN), "whab", { param: "mmgd.mmed" }),
  muns: campo(tiposUrl.lista(leitorIbge, { max: LIMITE_COMPARACAO }), [] as string[], { param: "mmgd.msel" }),
  rank: campo(tiposUrl.opcao(LISTAS_DESTAQUE), "maior_crescimento_estoque", { param: "mmgd.rank" }),
};

/* ---------- por UF: mapa, barras com referência, tabela ---------- */

export type LinhaUf = {
  id: string;
  uf: string;
  nome: string;
  unidades: number;
  potencia_mw: number | null;
  unidades_sem_potencia: number;
  participacao_potencia_pct: number | null;
  populacao: number | null;
  w_por_habitante: number | null;
  unidades_por_mil_habitantes: number | null;
  potencia_mw_ano_referencia: number | null;
  crescimento_estoque_ano_referencia_pct: number | null;
  ucs_recebem_credito: number;
};

/** Uma linha por UF, como publicada (a mesma matriz alimenta mapa, barras e tabela). */
export function linhasUfs(ufs: readonly MmgdUf[]): LinhaUf[] {
  return ufs.map((u) => ({
    id: u.uf,
    uf: u.uf,
    nome: u.nome,
    unidades: u.unidades,
    potencia_mw: u.potencia_mw,
    unidades_sem_potencia: u.unidades_sem_potencia,
    participacao_potencia_pct: u.participacao_potencia_pct,
    populacao: u.populacao,
    w_por_habitante: u.w_por_habitante,
    unidades_por_mil_habitantes: u.unidades_por_mil_habitantes,
    potencia_mw_ano_referencia: u.potencia_mw_ano_referencia,
    crescimento_estoque_ano_referencia_pct: u.crescimento_estoque_ano_referencia_pct,
    ucs_recebem_credito: u.ucs_recebem_credito,
  }));
}

export function colunasUfs(anoReferencia: number, anoPopulacao: number | null, idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "uf", rotulo: tx("UF", "State", idioma), tipo: "texto" },
    { id: "nome", rotulo: tx("Nome", "Name", idioma), tipo: "texto", idiomaTexto: "nome" },
    { id: "unidades", rotulo: tx("Unidades", "Units", idioma), tipo: "numero", casas: 0 },
    { id: "potencia_mw", rotulo: tx("Potência instalada", "Installed capacity", idioma), tipo: "numero", unidade: "MW", casas: 1 },
    { id: "unidades_sem_potencia", rotulo: tx("Unidades sem potência informada", "Units without reported capacity", idioma), tipo: "numero", casas: 0 },
    { id: "participacao_potencia_pct", rotulo: tx("Participação na potência do Brasil", "Share of Brazil's capacity", idioma), tipo: "percentual", casas: 2 },
    { id: "populacao", rotulo: tx(`População estimada (${anoPopulacao ?? "IBGE"})`, `Estimated population (${anoPopulacao ?? "IBGE"})`, idioma), tipo: "numero", casas: 0 },
    { id: "w_por_habitante", rotulo: tx("Potência por habitante", "Capacity per inhabitant", idioma), tipo: "numero", unidade: tx("W/hab", "W/inhab.", idioma), casas: 1 },
    { id: "unidades_por_mil_habitantes", rotulo: tx("Unidades por mil habitantes", "Units per thousand inhabitants", idioma), tipo: "numero", casas: 2 },
    { id: "potencia_mw_ano_referencia", rotulo: tx(`Potência conectada em ${anoReferencia}`, `Capacity connected in ${anoReferencia}`, idioma), tipo: "numero", unidade: "MW", casas: 1 },
    {
      id: "crescimento_estoque_ano_referencia_pct",
      rotulo: tx(`Crescimento do estoque em ${anoReferencia}`, `Growth of the stock in ${anoReferencia}`, idioma),
      tipo: "percentual",
      casas: 1,
    },
    {
      id: "ucs_recebem_credito",
      rotulo: tx("UC que recebem créditos (soma por empreendimento)", "Consumer units receiving credits (sum by project)", idioma),
      tipo: "numero",
      casas: 0,
    },
  ];
}

/** Valores do mapa por código IBGE da UF; ausência continua ausência (nunca zero). */
export function valoresMapaUf(linhas: readonly LinhaUf[], med: MedidaUf): Record<string, number | null> {
  const campo = MEDIDA_UF[med].campo;
  const out: Record<string, number | null> = {};
  for (const l of linhas) {
    const c = codigoUf(l.uf);
    if (c) out[c] = l[campo];
  }
  return out;
}

/** Barras por UF na medida escolhida, em ordem decrescente; ausência fica no fim, sem virar zero. */
export function dadosBarrasUf(linhas: readonly LinhaUf[], med: MedidaUf): { id: string; nome: string; valor: number | null }[] {
  const campo = MEDIDA_UF[med].campo;
  return linhas
    .map((l) => ({ id: l.uf, nome: l.nome, valor: l[campo] }))
    .sort((a, b) => (a.valor === null ? 1 : b.valor === null ? -1 : b.valor - a.valor || a.id.localeCompare(b.id)));
}

/**
 * Referência das barras por UF: só a medida com valor nacional publicado na gold
 * (W/hab do Brasil). As demais ficam sem linha de referência, e a nota diz por quê.
 */
export function referenciaUf(wPorHabitanteBrasil: number | null, med: MedidaUf, idioma: Idioma = idiomaEnergia()): { valor: number; rotulo: string }[] {
  // o gráfico já escreve "rótulo: valor unidade" na linha e na legenda: o rótulo é só o recorte, sem repetir o valor
  return med === "whab" && temValor(wPorHabitanteBrasil) ? [{ valor: wPorHabitanteBrasil, rotulo: tx("Brasil", "Brazil", idioma) }] : [];
}

/* ---------- histórico anual ---------- */

export type LinhaAnual = {
  id: string;
  ano: number;
  rotulo: string;
  unidades: number | null;
  potencia_mw: number | null;
  acumulado_unidades: number;
  acumulado_mw: number;
  situacao: string;
};

/**
 * Situação de um ponto da série: ano parcial (ano do cadastro), fora da cobertura
 * declarada pela ANEEL (antes de dez/2008), coberto só em parte (2008) ou completo.
 */
function situacaoAno(a: Pick<MmgdAno, "parcial" | "cobertura_declarada">, dataCadastro: string, idioma: Idioma): string {
  // i18n: dado (valores da gold)
  if (a.cobertura_declarada === "fora") return tx("fora da cobertura declarada pela ANEEL (antes de dez/2008)", `outside the coverage declared by ANEEL (before ${mesAno("2008-12", idioma)})`, idioma);
  // i18n: dado (valores da gold)
  if (a.cobertura_declarada === "parcial") return tx("cobertura declarada só em dezembro", "coverage declared only in December", idioma);
  if (a.parcial) return tx(`parcial, até ${dataBR(dataCadastro, idioma)}`, `partial, through ${dataBR(dataCadastro, idioma)}`, idioma);
  return tx("ano completo", "full year", idioma);
}

/** Conexões por ano (Brasil) e estoque ao fim de cada ano, como publicados; o rótulo marca ano parcial e cobertura. */
export function linhasAnual(m: Pick<BlocoMmgd, "anual" | "data_cadastro">, idioma: Idioma = idiomaEnergia()): LinhaAnual[] {
  return m.anual.map((a) => {
    const marca = a.parcial ? tx(" (parcial)", " (partial)", idioma) : a.cobertura_declarada ? tx(" (fora da cobertura)", " (outside coverage)", idioma) : "";
    return {
      id: String(a.ano),
      ano: a.ano,
      rotulo: `${a.ano}${marca}`,
      unidades: a.unidades,
      potencia_mw: a.potencia_mw,
      acumulado_unidades: a.acumulado_unidades,
      acumulado_mw: a.acumulado_mw,
      situacao: situacaoAno(a, m.data_cadastro, idioma),
    };
  });
}

export function colunasAnual(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "ano", rotulo: tx("Ano de conexão", "Year of connection", idioma), tipo: "numero", casas: 0, buscavel: true }, // i18n: dado
    { id: "unidades", rotulo: tx("Unidades conectadas no ano", "Units connected in the year", idioma), tipo: "numero", casas: 0 },
    { id: "potencia_mw", rotulo: tx("Potência conectada no ano", "Capacity connected in the year", idioma), tipo: "numero", unidade: "MW", casas: 1 },
    { id: "acumulado_unidades", rotulo: tx("Estoque de unidades ao fim do ano", "Stock of units at year end", idioma), tipo: "numero", casas: 0 },
    { id: "acumulado_mw", rotulo: tx("Estoque de potência ao fim do ano", "Stock of capacity at year end", idioma), tipo: "numero", unidade: "MW", casas: 1 },
    { id: "situacao", rotulo: tx("Situação do ano", "Status of the year", idioma), tipo: "texto", categorica: true },
  ];
}
export const COLUNAS_ANUAL: ColunaTabela[] = colunasAnual("pt");

/**
 * Primeiro ano inteiro dentro da cobertura declarada (inicio_declarado "2008-12-01"
 * → 2009). Antes dele, ano sem registro é ausência; a partir dele, ano sem conexão
 * no cadastro completo é zero real (regra series_com_zero da gold).
 */
export function primeiroAnoCoberto(inicioDeclarado: string): number {
  const ano = Number(inicioDeclarado.slice(0, 4));
  return inicioDeclarado.slice(5, 10) === "01-01" ? ano : ano + 1;
}

/** Só o que o histórico por UF desenha: as props do componente cliente viajam no HTML (contrato, seção 5.1). */
export type UfAnoCompacto = Pick<MmgdUfAno, "uf" | "ano" | "potencia_mw">;
export function ufAnualCompacto(ufAnual: readonly MmgdUfAno[]): UfAnoCompacto[] {
  return ufAnual.map((x) => ({ uf: x.uf, ano: x.ano, potencia_mw: x.potencia_mw }));
}

/**
 * Histórico de conexões por ano (MW) das UF escolhidas, na mesma escala. A gold
 * publica cada UF do primeiro ano com conexão ao ano do cadastro; os anos de outra
 * UF anteriores a esse, dentro da cobertura declarada, são zero (o cadastro é
 * completo e não tem conexão ali); fora da cobertura, ficam ausentes. Nulo
 * publicado continua nulo.
 */
export function dadosHistoricoUfs(ufAnual: readonly UfAnoCompacto[], ufs: readonly string[], primeiroCoberto: number): Record<string, string | number | null>[] {
  const escolhidas = ufs.filter((u) => ufAnual.some((x) => x.uf === u));
  if (!escolhidas.length) return [];
  const porUf = new Map<string, Map<number, UfAnoCompacto>>();
  for (const u of escolhidas) porUf.set(u, new Map());
  let ini = Infinity;
  let fim = -Infinity;
  for (const x of ufAnual) {
    const mapa = porUf.get(x.uf);
    if (!mapa) continue;
    mapa.set(x.ano, x);
    ini = Math.min(ini, x.ano);
    fim = Math.max(fim, x.ano);
  }
  const linhas: Record<string, string | number | null>[] = [];
  for (let ano = ini; ano <= fim; ano++) {
    const l: Record<string, string | number | null> = { ano: String(ano) };
    for (const u of escolhidas) {
      const x = porUf.get(u)!.get(ano);
      l[u] = x ? x.potencia_mw : ano >= primeiroCoberto ? 0 : null;
    }
    linhas.push(l);
  }
  return linhas;
}

/* ---------- série mensal ---------- */

export type LinhaMensal = {
  m: string;
  consolidado: number | null;
  provisorio: number | null;
  acumulado_mw: number;
};

/**
 * Conexões por mês (MW) em duas séries que não se sobrepõem: consolidado e
 * provisório (meses depois de `corte_provisorio`). Cada mês está em uma só delas;
 * o estoque acumulado vai em coluna própria. Meses fora da cobertura declarada
 * chegam nulos da gold e viram lacuna.
 */
export function dadosMensal(mensal: readonly MmgdMes[]): LinhaMensal[] {
  return mensal.map((x) => ({
    m: x.m,
    consolidado: x.provisorio ? null : x.potencia_mw,
    provisorio: x.provisorio ? x.potencia_mw : null,
    acumulado_mw: x.acumulado_mw,
  }));
}

export function linhasMensal(mensal: readonly MmgdMes[], idioma: Idioma = idiomaEnergia()) {
  return mensal.map((x) => ({
    id: x.m,
    m: x.m,
    unidades: x.unidades,
    potencia_mw: x.potencia_mw,
    acumulado_unidades: x.acumulado_unidades,
    acumulado_mw: x.acumulado_mw,
    situacao:
      x.cobertura_declarada === "fora" // i18n: dado
        ? tx("fora da cobertura declarada", "outside the declared coverage", idioma)
        : x.provisorio
          ? tx("provisório", "provisional", idioma)
          : tx("consolidado", "consolidated", idioma),
  }));
}

export function colunasMensal(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "m", rotulo: tx("Mês de conexão", "Month of connection", idioma), tipo: "texto" },
    { id: "unidades", rotulo: tx("Unidades conectadas no mês", "Units connected in the month", idioma), tipo: "numero", casas: 0 },
    { id: "potencia_mw", rotulo: tx("Potência conectada no mês", "Capacity connected in the month", idioma), tipo: "numero", unidade: "MW", casas: 3 },
    { id: "acumulado_unidades", rotulo: tx("Estoque de unidades ao fim do mês", "Stock of units at month end", idioma), tipo: "numero", casas: 0 },
    { id: "acumulado_mw", rotulo: tx("Estoque de potência ao fim do mês", "Stock of capacity at month end", idioma), tipo: "numero", unidade: "MW", casas: 3 },
    { id: "situacao", rotulo: tx("Situação", "Status", idioma), tipo: "texto", categorica: true },
  ];
}
export const COLUNAS_MENSAL: ColunaTabela[] = colunasMensal("pt");

/** Meses provisórios publicados (os posteriores ao corte), do primeiro ao último. */
export function mesesProvisorios(mensal: readonly MmgdMes[]): { primeiro: MmgdMes | null; ultimo: MmgdMes | null; n: number } {
  const p = mensal.filter((x) => x.provisorio);
  return { primeiro: p[0] ?? null, ultimo: p.at(-1) ?? null, n: p.length };
}

/* ---------- fontes e perfis ---------- */

export function linhasFontes(fontes: readonly MmgdFonte[], idioma: Idioma = idiomaEnergia()) {
  return fontes.map((f) => ({
    id: f.fonte,
    rotulo: rotuloDado(f.rotulo, FONTE_MMGD_EN, idioma),
    unidades: f.unidades,
    potencia_mw: f.potencia_mw,
    unidades_sem_potencia: f.unidades_sem_potencia,
    participacao_potencia_pct: f.participacao_potencia_pct,
  }));
}

function rotulosCategoria(idioma: Idioma): Record<string, string> {
  return {
    "Geracao na propria UC": tx("Geração na própria unidade consumidora", "Generation at the consumer unit itself", idioma),
    "Auto consumo remoto": tx("Autoconsumo remoto", "Remote self-consumption", idioma),
    Compartilhada: tx("Geração compartilhada", "Shared generation", idioma),
    Microgeracao: tx("Microgeração", "Micro generation", idioma),
    Minigeracao: tx("Minigeração", "Mini generation", idioma),
    PF: tx("Pessoa física", "Individual", idioma),
    PJ: tx("Pessoa jurídica", "Legal entity", idioma),
    nao_informado: tx("Não informado", "Not reported", idioma),
    nao_informada: tx("Não informada", "Not reported", idioma),
  };
}
const ROTULO_CATEGORIA = rotulosCategoria("pt");
const ROTULO_CATEGORIA_EN = rotulosCategoria("en");
/** Categorias publicadas já com acento (classe de consumo, condomínio), só em inglês. */
const CATEGORIA_EN: Record<string, string> = {
  Residencial: "Residential",
  Comercial: "Commercial",
  Rural: "Rural",
  Industrial: "Industrial",
  "Poder Público": "Government",
  REBR: "REBR",
  "Serviço Público": "Public service",
  "Iluminação pública": "Public lighting",
  "Consumo Próprio": "Own consumption",
  "Condomínio": "Condominium",
};

/** Rótulo legível da categoria publicada (acentos e siglas); a categoria original fica como id. */
export function rotuloCategoria(cat: string, idioma: Idioma = idiomaEnergia()): string {
  if (idioma === "en") return ROTULO_CATEGORIA_EN[cat] ?? CATEGORIA_EN[cat] ?? cat;
  return ROTULO_CATEGORIA[cat] ?? cat;
}

export type LinhaPerfil = {
  id: string;
  rotulo: string;
  unidades: number;
  potencia_mw: number | null;
  unidades_sem_potencia: number;
  participacao_unidades_pct: number;
  unidades_ano_referencia: number;
  potencia_mw_ano_referencia: number | null;
};

export function linhasPerfil(perfis: BlocoMmgd["perfis"], dim: DimensaoPerfil, idioma: Idioma = idiomaEnergia()): LinhaPerfil[] {
  return perfis[dim].map((p: MmgdPerfilLinha) => ({
    id: p.categoria,
    rotulo: rotuloCategoria(p.categoria, idioma),
    unidades: p.unidades,
    potencia_mw: p.potencia_mw,
    unidades_sem_potencia: p.unidades_sem_potencia,
    participacao_unidades_pct: p.participacao_unidades_pct,
    unidades_ano_referencia: p.unidades_ano_referencia,
    potencia_mw_ano_referencia: p.potencia_mw_ano_referencia,
  }));
}

/* ---------- distribuidoras ---------- */

function rotulosClasseCurto(idioma: Idioma) {
  return {
    provavel_municipio_errado: tx("provável município errado", "likely wrong municipality", idioma),
    provavel_distribuidora_errada: tx("provável distribuidora errada", "likely wrong distribution utility", idioma),
    indeterminada: tx("indeterminada", "undetermined", idioma),
  } as const;
}
const ROTULO_CLASSE_CURTO = rotulosClasseCurto("pt");

/** "COELBA (15.139.629/0001-94)" quando há sigla; só o CNPJ formatado quando não há. */
export function cnpjFormatado(cnpj: string): string {
  return /^\d{14}$/.test(cnpj) ? `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}` : cnpj;
}

/**
 * Uma linha por distribuidora (CNPJ), só com as colunas da tabela: as props do
 * componente cliente viajam no HTML (contrato, seção 5.1). UF por ano, municípios e
 * a área completa dos conjuntos estão no CSV por distribuidora, UF e ano.
 */
export function linhasDistribuidoras(ds: readonly MmgdDistribuidora[], idioma: Idioma = idiomaEnergia()) {
  const rotulos = rotulosClasseCurto(idioma);
  return ds.map((d) => {
    const c = d.classes_fora_da_area;
    const classes = c
      ? (Object.keys(ROTULO_CLASSE_CURTO) as (keyof typeof ROTULO_CLASSE_CURTO)[])
          .filter((k) => c[k].unidades > 0)
          .map((k) => `${inteiro(c[k].unidades, idioma)} ${rotulos[k]}`)
          .join("; ")
      : "";
    return {
      id: d.cnpj,
      sigla: d.sigla ?? cnpjFormatado(d.cnpj),
      nome: d.nome ?? "",
      cnpj: cnpjFormatado(d.cnpj),
      uf_principal: d.uf_principal,
      unidades: d.unidades,
      potencia_mw: d.potencia_mw,
      unidades_sem_potencia: d.unidades_sem_potencia,
      potencia_mw_ano_referencia: d.potencia_mw_ano_referencia,
      unidades_fora_da_area: d.unidades_fora_da_area,
      // texto em vez de célula vazia: sem unidade fora da área não é ausência de dado
      classes_fora_da_area:
        d.unidades_fora_da_area === null
          ? tx("sem referência de área", "no area reference", idioma)
          : d.unidades_fora_da_area === 0
            ? tx("nenhuma unidade fora da área", "no unit outside the area", idioma)
            : classes || tx("classes indisponíveis", "classes unavailable", idioma),
      aviso_total: d.aviso_total ? avisoDistribuidora(d.aviso_total, idioma) : tx("nenhum", "none", idioma),
    };
  });
}

/** Aviso sobre o total da distribuidora (texto da gold, de modelo fixo) no idioma; fora do modelo, volta como veio. */
function avisoDistribuidora(aviso: string, idioma: Idioma): string {
  if (idioma !== "en") return aviso;
  const m = AVISO_DISTRIBUIDORA.exec(aviso);
  if (!m) return aviso;
  // números na forma inglesa: separador de milhar e vírgula decimal trocados, mesmos algarismos
  const unidades = m[1].replaceAll(".", ",");
  const mw = m[2].replace(",", ".");
  const ufs = m[3];
  return tx(
    aviso,
    `The total includes ${unidades} ${unidades === "1" ? "unit" : "units"} (${mw} MW) registered with this CNPJ in ${ufs}, where it has no consumer set, with ZIP code, project code and published state in the municipality's state: they probably belong to another distribution utility and inflate this one's total.`,
    idioma,
  );
}

export function colunasDistribuidoras(anoReferencia: number, idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "sigla", rotulo: tx("Distribuidora", "Distribution utility", idioma), tipo: "texto", idiomaTexto: "nome" },
    { id: "nome", rotulo: tx("Razão social publicada", "Published corporate name", idioma), tipo: "texto", idiomaTexto: "nome" },
    { id: "cnpj", rotulo: "CNPJ", tipo: "texto" },
    { id: "uf_principal", rotulo: tx("UF principal", "Main state", idioma), tipo: "texto", categorica: true },
    { id: "unidades", rotulo: tx("Unidades", "Units", idioma), tipo: "numero", casas: 0 },
    { id: "potencia_mw", rotulo: tx("Potência instalada", "Installed capacity", idioma), tipo: "numero", unidade: "MW", casas: 1 },
    { id: "unidades_sem_potencia", rotulo: tx("Unidades sem potência informada", "Units without reported capacity", idioma), tipo: "numero", casas: 0 },
    { id: "potencia_mw_ano_referencia", rotulo: tx(`Potência conectada em ${anoReferencia}`, `Capacity connected in ${anoReferencia}`, idioma), tipo: "numero", unidade: "MW", casas: 1 },
    { id: "unidades_fora_da_area", rotulo: tx("Unidades em UF sem conjunto do CNPJ", "Units in a state with no consumer set of the CNPJ", idioma), tipo: "numero", casas: 0 },
    { id: "classes_fora_da_area", rotulo: tx("Classes pelo CEP", "Classes by ZIP code", idioma), tipo: "texto" },
    { id: "aviso_total", rotulo: tx("Aviso sobre o total", "Warning about the total", idioma), tipo: "texto" },
  ];
}

/* ---------- municípios: destaques (gold) e mapa sob demanda (JSON) ---------- */

export type LinhaDestaque = {
  id: string;
  posicao: number;
  municipio: string;
  uf: string;
  unidades: number;
  potencia_kw: number | null;
  populacao: number | null;
  w_por_habitante: number | null;
  crescimento_estoque_pct: number | null;
  unidades_distribuidora_fora_da_uf: number | null;
};

/** Ranking como a gold o publica (a ordem é a da gold), só com as colunas exibidas. */
export function linhasDestaque(lista: readonly MmgdMunicipioCurto[]): LinhaDestaque[] {
  return lista.map((x, i) => ({
    id: x.ibge,
    posicao: i + 1,
    municipio: x.nome ?? x.ibge,
    uf: x.uf ?? "",
    unidades: x.unidades,
    potencia_kw: x.potencia_kw,
    populacao: x.populacao,
    w_por_habitante: x.w_por_habitante,
    crescimento_estoque_pct: x.crescimento_estoque_pct,
    unidades_distribuidora_fora_da_uf: x.unidades_distribuidora_fora_da_uf,
  }));
}

export function listasDestaque(d: BlocoMmgd["municipios_destaque"]): Record<ListaDestaque, LinhaDestaque[]> {
  return Object.fromEntries(LISTAS_DESTAQUE.map((k) => [k, linhasDestaque(d[k])])) as Record<ListaDestaque, LinhaDestaque[]>;
}

export type MunicipioMmgd = {
  id: string;
  municipio: string;
  uf: string;
  unidades: number;
  potencia_kw: number | null;
  unidades_sem_potencia: number;
  populacao: number | null;
  w_por_habitante: number | null;
  unidades_por_mil_habitantes: number | null;
  unidades_ano_referencia: number;
  potencia_kw_ano_referencia: number | null;
  potencia_kw_estoque_ano_anterior: number | null;
  crescimento_estoque_pct: number | null;
  fonte_principal: string;
  unidades_distribuidora_fora_da_uf: number | null;
  potencia_kw_distribuidora_fora_da_uf: number | null;
  unidades_provavel_municipio_errado: number | null;
  potencia_kw_provavel_municipio_errado: number | null;
  unidades_provavel_distribuidora_errada: number | null;
  potencia_kw_provavel_distribuidora_errada: number | null;
};

function rotulosFonte(idioma: Idioma): Record<string, string> {
  return {
    solar: "solar",
    termica: tx("termelétrica", "thermal", idioma),
    hidraulica: tx("hidráulica", "hydro", idioma),
    eolica: tx("eólica", "wind", idioma),
    outra: tx("outra", "other", idioma),
    nao_informada: tx("não informada", "not reported", idioma),
  };
}

/** Linhas do JSON municipal (transicao_municipios.json), pelo nome de cada campo publicado, não pela posição. */
export function municipiosDoJson(arq: Pick<MunicipiosMmgdArquivo, "campos" | "linhas">, idioma: Idioma = idiomaEnergia()): MunicipioMmgd[] {
  const ROTULO_FONTE = rotulosFonte(idioma);
  const semUnidade = tx("sem unidade", "no unit", idioma);
  const i = Object.fromEntries((arq.campos as readonly string[]).map((c, k) => [c, k])) as Record<string, number>;
  const n = (l: readonly unknown[], c: string): number | null => {
    const v = l[i[c]];
    return typeof v === "number" ? v : null;
  };
  return arq.linhas.map((l) => ({
    id: String(l[i.ibge]),
    municipio: (l[i.nome] as string | null) ?? String(l[i.ibge]),
    uf: (l[i.uf] as string | null) ?? "",
    unidades: n(l, "unidades") ?? 0,
    potencia_kw: n(l, "potencia_kw"),
    unidades_sem_potencia: n(l, "unidades_sem_potencia") ?? 0,
    populacao: n(l, "populacao"),
    w_por_habitante: n(l, "w_por_habitante"),
    unidades_por_mil_habitantes: n(l, "unidades_por_mil_habitantes"),
    unidades_ano_referencia: n(l, "unidades_ano_referencia") ?? 0,
    potencia_kw_ano_referencia: n(l, "potencia_kw_ano_referencia"),
    potencia_kw_estoque_ano_anterior: n(l, "potencia_kw_estoque_ano_anterior"),
    crescimento_estoque_pct: n(l, "crescimento_estoque_pct"),
    fonte_principal: ROTULO_FONTE[(l[i.fonte_principal] as string | null) ?? ""] ?? semUnidade,
    unidades_distribuidora_fora_da_uf: n(l, "unidades_distribuidora_fora_da_uf"),
    potencia_kw_distribuidora_fora_da_uf: n(l, "potencia_kw_distribuidora_fora_da_uf"),
    unidades_provavel_municipio_errado: n(l, "unidades_provavel_municipio_errado"),
    potencia_kw_provavel_municipio_errado: n(l, "potencia_kw_provavel_municipio_errado"),
    unidades_provavel_distribuidora_errada: n(l, "unidades_provavel_distribuidora_errada"),
    potencia_kw_provavel_distribuidora_errada: n(l, "potencia_kw_provavel_distribuidora_errada"),
  }));
}

export function colunasMunicipios(anoReferencia: number, anoPopulacao: number | null, idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "municipio", rotulo: tx("Município", "Municipality", idioma), tipo: "texto", idiomaTexto: "nome" },
    { id: "uf", rotulo: tx("UF", "State", idioma), tipo: "texto", categorica: true },
    { id: "id", rotulo: tx("Código IBGE", "IBGE code", idioma), tipo: "texto" },
    { id: "unidades", rotulo: tx("Unidades", "Units", idioma), tipo: "numero", casas: 0 },
    { id: "potencia_kw", rotulo: tx("Potência instalada", "Installed capacity", idioma), tipo: "numero", unidade: "kW", casas: 2 },
    { id: "unidades_sem_potencia", rotulo: tx("Unidades sem potência informada", "Units without reported capacity", idioma), tipo: "numero", casas: 0 },
    { id: "populacao", rotulo: tx(`População estimada (${anoPopulacao ?? "IBGE"})`, `Estimated population (${anoPopulacao ?? "IBGE"})`, idioma), tipo: "numero", casas: 0 },
    { id: "w_por_habitante", rotulo: tx("Potência por habitante", "Capacity per inhabitant", idioma), tipo: "numero", unidade: tx("W/hab", "W/inhab.", idioma), casas: 1 },
    { id: "unidades_por_mil_habitantes", rotulo: tx("Unidades por mil habitantes", "Units per thousand inhabitants", idioma), tipo: "numero", casas: 2 },
    { id: "potencia_kw_ano_referencia", rotulo: tx(`Potência conectada em ${anoReferencia}`, `Capacity connected in ${anoReferencia}`, idioma), tipo: "numero", unidade: "kW", casas: 2 },
    { id: "crescimento_estoque_pct", rotulo: tx(`Crescimento do estoque em ${anoReferencia}`, `Growth of the stock in ${anoReferencia}`, idioma), tipo: "percentual", casas: 1 },
    { id: "fonte_principal", rotulo: tx("Fonte principal", "Main source", idioma), tipo: "texto", categorica: true },
    {
      id: "unidades_distribuidora_fora_da_uf",
      rotulo: tx("Unidades de distribuidora sem conjunto na UF", "Units of a utility with no consumer set in the state", idioma),
      tipo: "numero",
      casas: 0,
    },
    { id: "unidades_provavel_municipio_errado", rotulo: tx("Dessas: provável município errado", "Of these: likely wrong municipality", idioma), tipo: "numero", casas: 0 },
    { id: "unidades_provavel_distribuidora_errada", rotulo: tx("Dessas: provável distribuidora errada", "Of these: likely wrong utility", idioma), tipo: "numero", casas: 0 },
  ];
}

/**
 * Nome e UF de municípios pelo código IBGE, lidos do JSON municipal publicado (no
 * servidor, para listas curtas do modo Auditar cuja gold só traz o código). O vínculo é
 * só pelo código; código sem linha no arquivo fica sem nome, e a tabela mostra o código.
 */
export function nomesMunicipios(arq: Pick<MunicipiosMmgdArquivo, "campos" | "linhas">, ids: readonly string[]): Map<string, string> {
  const alvo = new Set(ids);
  const i = Object.fromEntries((arq.campos as readonly string[]).map((c, k) => [c, k])) as Record<string, number>;
  const out = new Map<string, string>();
  for (const l of arq.linhas) {
    const id = String(l[i.ibge]);
    if (!alvo.has(id)) continue;
    const nome = l[i.nome];
    const uf = l[i.uf];
    if (typeof nome === "string" && nome) out.set(id, typeof uf === "string" && uf ? `${nome} (${uf})` : nome);
  }
  return out;
}

export function valorMunicipio(m: MunicipioMmgd, med: MedidaMun): number | null {
  if (med === "whab") return m.w_por_habitante;
  if (med === "kw") return m.potencia_kw;
  if (med === "cresc") return m.crescimento_estoque_pct;
  return m.unidades_distribuidora_fora_da_uf;
}

/* ---------- histórico municipal (CSV publicado, sob demanda) ---------- */

/** CSV publicado pelo pipeline: `;` como separador, aspas só quando o campo precisa, vazio = ausência. */
export function lerCsv(texto: string): Record<string, string>[] {
  const linhas: string[][] = [];
  let campoAtual = "";
  let linha: string[] = [];
  let aspas = false;
  const t = texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto;
  for (let k = 0; k < t.length; k++) {
    const ch = t[k];
    if (aspas) {
      if (ch === '"') {
        if (t[k + 1] === '"') {
          campoAtual += '"';
          k++;
        } else aspas = false;
      } else campoAtual += ch;
    } else if (ch === '"') aspas = true;
    else if (ch === ";") {
      linha.push(campoAtual);
      campoAtual = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && t[k + 1] === "\n") k++;
      linha.push(campoAtual);
      campoAtual = "";
      if (linha.length > 1 || linha[0] !== "") linhas.push(linha);
      linha = [];
    } else campoAtual += ch;
  }
  if (campoAtual !== "" || linha.length) {
    linha.push(campoAtual);
    linhas.push(linha);
  }
  const [cab, ...resto] = linhas;
  if (!cab) return [];
  return resto.map((l) => Object.fromEntries(cab.map((c, k) => [c, l[k] ?? ""])));
}

/**
 * Conexões por ano (kW, todas as fontes) dos municípios escolhidos, lidas do CSV
 * municipio × ano × fonte publicado. A soma das fontes de um município e ano é a
 * única agregação feita na interface; o teste confere que, somados os anos e as
 * unidades sem data, ela fecha com o total do município publicado.
 *
 * O CSV só tem as combinações com conexão. Dentro da cobertura declarada (a partir
 * de `primeiroCoberto`), ano sem linha é zero real (o cadastro é completo); antes
 * dela, é ausência. Ano com unidade sem potência informada fica nulo (a soma seria
 * parcial), e a contagem dessas unidades sai em `parciais`; unidades com data
 * sentinela ("sem_data" no CSV) ficam fora dos anos e são contadas em `semData`.
 */
export function historicoMunicipiosCsv(
  texto: string,
  ids: readonly string[],
  anoFinal: number,
  primeiroCoberto: number,
): { linhas: Record<string, string | number | null>[]; parciais: number; semData: number } {
  const alvo = new Set(ids);
  if (!alvo.size) return { linhas: [], parciais: 0, semData: 0 };
  const soma = new Map<string, Map<number, { kw: number; parcial: boolean }>>();
  let parciais = 0;
  let semData = 0;
  let ini = Infinity;
  for (const r of lerCsv(texto)) {
    const id = r.codigo_ibge;
    if (!alvo.has(id)) continue;
    const ano = Number(r.ano_conexao);
    if (!/^\d{4}$/.test(r.ano_conexao) || !Number.isFinite(ano)) {
      // "sem_data": data publicada sentinela; a unidade está no total do município, sem ano de conexão
      semData += Number(r.unidades || "0");
      continue;
    }
    const semPot = Number(r.unidades_sem_potencia || "0");
    const kw = r.potencia_kw === "" ? null : Number(r.potencia_kw);
    if (!soma.has(id)) soma.set(id, new Map());
    const m = soma.get(id)!;
    const atual = m.get(ano) ?? { kw: 0, parcial: false };
    if (kw !== null) atual.kw += kw;
    if (semPot > 0 || kw === null) {
      atual.parcial = true;
      parciais += semPot;
    }
    m.set(ano, atual);
    ini = Math.min(ini, ano);
  }
  if (!Number.isFinite(ini)) return { linhas: [], parciais, semData };
  const linhas: Record<string, string | number | null>[] = [];
  for (let ano = ini; ano <= anoFinal; ano++) {
    const l: Record<string, string | number | null> = { ano: String(ano) };
    for (const id of ids) {
      const x = soma.get(id)?.get(ano);
      // arredonda ao centésimo de kW publicado: a soma em ponto flutuante não inventa casas
      l[id] = x ? (x.parcial ? null : Math.round(x.kw * 100) / 100) : ano >= primeiroCoberto ? 0 : null;
    }
    linhas.push(l);
  }
  return { linhas, parciais, semData };
}

/* ---------- textos derivados (P063) ---------- */

/**
 * Resposta curta de "Onde a geração distribuída cresce?": estoque e composição do
 * cadastro, conexões do último ano completo contra o anterior, a UF que mais
 * acrescentou potência, a de maior crescimento proporcional e a de maior potência
 * por habitante. Todos os números vêm da gold; direção só quando os dois lados têm
 * valor, decidida na precisão exibida.
 */
export function respostaMmgd(m: Pick<BlocoMmgd, "data_cadastro" | "ano_referencia" | "resumo" | "anual" | "ufs">, idioma: Idioma = idiomaEnergia()): string {
  const r = m.resumo;
  const ref = m.ano_referencia;
  const atual = m.anual.find((a) => a.ano === ref);
  const ant = m.anual.find((a) => a.ano === ref - 1);
  const partes: string[] = [];
  const nt = (v: number | null | undefined, c = 1) => numTexto(v, c, idioma);
  partes.push(
    tx(
      `Em ${data(m.data_cadastro, idioma)}, o cadastro da ANEEL tinha ${inteiro(r.unidades, idioma)} unidades de micro e minigeração distribuída, com ${nt(r.potencia_mw)} MW de potência instalada (capacidade cadastrada, não energia gerada), ${participacaoTexto(r.participacao_solar_potencia_pct, idioma)} dela solar.`,
      `On ${data(m.data_cadastro, idioma)}, ANEEL's register had ${inteiro(r.unidades, idioma)} distributed micro and mini generation units, with ${nt(r.potencia_mw)} MW of installed capacity (registered capacity, not energy generated), ${participacaoTexto(r.participacao_solar_potencia_pct, idioma)} of it solar.`,
      idioma,
    ),
  );
  if (atual) {
    const dir = comparaArredondado(atual.potencia_mw, ant?.potencia_mw, 1);
    const comp =
      dir === null || !ant
        ? ""
        : dir === "igual"
          ? tx(`, igual aos ${nt(ant.potencia_mw)} MW de ${ant.ano}`, `, the same as the ${nt(ant.potencia_mw)} MW of ${ant.ano}`, idioma)
          : tx(
              `, ${dir === "maior" ? "mais" : "menos"} que os ${nt(ant.potencia_mw)} MW de ${ant.ano}`,
              `, ${dir === "maior" ? "more" : "less"} than the ${nt(ant.potencia_mw)} MW of ${ant.ano}`,
              idioma,
            );
    partes.push(
      tx(
        `Em ${ref}, último ano completo, foram conectados ${nt(atual.potencia_mw)} MW em ${inteiro(atual.unidades, idioma)} unidades${comp}.`,
        `In ${ref}, the last full year, ${nt(atual.potencia_mw)} MW were connected in ${inteiro(atual.unidades, idioma)} units${comp}.`,
        idioma,
      ),
    );
  }
  const maisMw = extremo(m.ufs, (u) => u.potencia_mw_ano_referencia, "max");
  const maisCresc = extremo(m.ufs, (u) => u.crescimento_estoque_ano_referencia_pct, "max");
  const maisWhab = extremo(m.ufs, (u) => u.w_por_habitante, "max");
  if (maisMw && maisCresc) {
    const mesma = maisCresc.uf === maisMw.uf;
    partes.push(
      tx(
        `${maisMw.nome} foi a UF que mais acrescentou potência em ${ref} (${nt(maisMw.potencia_mw_ano_referencia)} MW); em proporção do estoque do fim de ${ref - 1}, o maior crescimento foi ${mesma ? "também o dela" : `o de ${maisCresc.nome}`} (${pctTexto(maisCresc.crescimento_estoque_ano_referencia_pct, 1, idioma)}).`,
        `${maisMw.nome} was the state that added the most capacity in ${ref} (${nt(maisMw.potencia_mw_ano_referencia)} MW); in proportion to the stock at the end of ${ref - 1}, the largest growth was ${mesma ? "also its own" : `that of ${maisCresc.nome}`} (${pctTexto(maisCresc.crescimento_estoque_ano_referencia_pct, 1, idioma)}).`,
        idioma,
      ),
    );
  }
  if (maisWhab) {
    partes.push(
      tx(
        `Por habitante, ${maisWhab.nome} lidera com ${nt(maisWhab.w_por_habitante)} W/hab, para ${nt(r.w_por_habitante_brasil)} W/hab no Brasil.`,
        `Per inhabitant, ${maisWhab.nome} leads with ${nt(maisWhab.w_por_habitante)} W/inhab., against ${nt(r.w_por_habitante_brasil)} W/inhab. in Brazil.`,
        idioma,
      ),
    );
  }
  return partes.join(" ");
}

/**
 * "O que mudou": os meses provisórios, com os valores publicados do primeiro e do
 * último, a última data de conexão no arquivo e o estado das revisões entre
 * capturas. Não atribui causa à queda dos meses finais (a fonte não informa).
 */
export function mudancaMmgd(m: Pick<BlocoMmgd, "mensal" | "corte_provisorio" | "resumo" | "revisoes">, idioma: Idioma = idiomaEnergia()): string {
  const { primeiro, ultimo, n } = mesesProvisorios(m.mensal);
  const partes: string[] = [];
  if (primeiro && ultimo) {
    const dir = comparaArredondado(ultimo.potencia_mw, primeiro.potencia_mw, 1);
    const verbo =
      dir === "menor"
        ? tx("caem", "fall", idioma)
        : dir === "maior"
          ? tx("sobem", "rise", idioma)
          : dir === "igual"
            ? tx("ficam iguais", "stay the same", idioma)
            : tx("variam", "vary", idioma);
    partes.push(
      tx(
        `Os ${n} meses depois de ${mes(m.corte_provisorio, idioma)} são provisórios: as conexões publicadas ${verbo} de ${numTexto(primeiro.potencia_mw, 1, idioma)} MW em ${mes(primeiro.m, idioma)} para ${numTexto(ultimo.potencia_mw, 1, idioma)} MW em ${mes(ultimo.m, idioma)}, e a última data de conexão no arquivo é ${data(m.resumo.ultima_data_conexao, idioma)}. Registros desses meses ainda podem entrar nas próximas capturas; a fonte não atribui causa ao movimento, e esta página também não.`,
        `The ${n} months after ${mes(m.corte_provisorio, idioma)} are provisional: the published connections ${verbo} from ${numTexto(primeiro.potencia_mw, 1, idioma)} MW in ${mes(primeiro.m, idioma)} to ${numTexto(ultimo.potencia_mw, 1, idioma)} MW in ${mes(ultimo.m, idioma)}, and the last connection date in the file is ${data(m.resumo.ultima_data_conexao, idioma)}. Records for these months may still enter the next captures; the source does not attribute a cause to the movement, and neither does this page.`,
        idioma,
      ),
    );
  }
  const rv = m.revisoes;
  if (rv.capturas_comparadas < 2) {
    const nota = rv.nota ?? tx("Ainda não há duas capturas do cadastro para medir revisões.", "There are not yet two captures of the register to measure revisions.", idioma);
    partes.push(rotuloDado(nota, NOTA_TRANSICAO_EN, idioma));
  } else
    partes.push(
      tx(
        `Entre as capturas de ${data(rv.primeira_captura, idioma)} e ${data(rv.ultima_captura, idioma)}, ${inteiro(rv.meses.length, idioma)} meses de conexão mudaram de valor (detalhe no modo Auditar).`,
        `Between the captures of ${data(rv.primeira_captura, idioma)} and ${data(rv.ultima_captura, idioma)}, ${inteiro(rv.meses.length, idioma)} connection months changed value (detail in Audit mode).`,
        idioma,
      ),
    );
  return partes.join(" ");
}

/**
 * Texto da limitação territorial das modalidades em que o crédito vai para outra
 * unidade, com os números publicados do perfil de modalidade (nenhuma soma nem
 * participação refeita aqui).
 */
export function textoModalidadesRemotas(perfis: BlocoMmgd["perfis"], idioma: Idioma = idiomaEnergia()): string {
  // i18n: dado (categorias da gold)
  const remoto = perfis.modalidade.find((p) => p.categoria === "Auto consumo remoto");
  const comp = perfis.modalidade.find((p) => p.categoria === "Compartilhada");
  const partes: string[] = [];
  if (remoto)
    partes.push(
      tx(
        `no autoconsumo remoto (${inteiro(remoto.unidades, idioma)} unidades, ${numTexto(remoto.potencia_mw, 1, idioma)} MW)`,
        `in remote self-consumption (${inteiro(remoto.unidades, idioma)} units, ${numTexto(remoto.potencia_mw, 1, idioma)} MW)`,
        idioma,
      ),
    );
  if (comp)
    partes.push(
      tx(
        `na geração compartilhada (${inteiro(comp.unidades, idioma)} unidades, ${numTexto(comp.potencia_mw, 1, idioma)} MW)`,
        `in shared generation (${inteiro(comp.unidades, idioma)} units, ${numTexto(comp.potencia_mw, 1, idioma)} MW)`,
        idioma,
      ),
    );
  if (!partes.length) return "";
  const lista = listaTexto(partes, idioma);
  return tx(
    `${lista.charAt(0).toUpperCase()}${lista.slice(1)}, a energia é compensada em outras unidades, que podem ficar em outro município: o mapa mostra onde a unidade geradora está, não onde o crédito é usado.`,
    `${lista.charAt(0).toUpperCase()}${lista.slice(1)}, the energy is offset at other units, which may be in another municipality: the map shows where the generating unit is, not where the credit is used.`,
    idioma,
  );
}

/* ================================================================ P063: estimativa do ONS */

export const MEDIDAS_ONS = ["mwmed", "part"] as const;
export type MedidaOns = (typeof MEDIDAS_ONS)[number];

/** Séries do gráfico mensal do ONS que a legenda pode ocultar (ids de `dadosOnsMensal`). */
export const SERIES_ONS = ["sin", "sin_incompleto", "SE", "S", "NE", "N"] as const;
export type SerieOns = (typeof SERIES_ONS)[number];

/**
 * Estado da página da energia estimada na URL: medida, intervalo e as séries ocultas
 * pela legenda (ons.ocultas), para que o link compartilhado abra o mesmo recorte e o
 * voltar do navegador desfaça a troca. Id desconhecido volta ao padrão (nada oculto).
 */
export const ESQUEMA_ONS = {
  med: campo(tiposUrl.opcao(MEDIDAS_ONS), "mwmed", { param: "ons.med" }),
  de: campo(tiposUrl.mes(), "", { param: "ons.de" }), // i18n: dado
  ate: campo(tiposUrl.mes(), "", { param: "ons.ate" }),
  ocultas: campo(tiposUrl.lista(tiposUrl.opcao(SERIES_ONS), { max: SERIES_ONS.length }), [] as SerieOns[], { param: "ons.ocultas" }),
};

/**
 * Série mensal do ONS para o gráfico: em MWmed, o SIN separado entre mês completo e
 * incompleto (cada mês numa só série) e os quatro submercados; em participação, só
 * o SIN, que é o que a gold publica por mês.
 */
export function dadosOnsMensal(mensal: readonly OnsMmgdMes[], med: MedidaOns): Record<string, string | number | null>[] {
  return mensal.map((x): Record<string, string | number | null> =>
    med === "mwmed"
      ? { m: x.m, sin: x.completo ? x.SIN : null, sin_incompleto: x.completo ? null : x.SIN, SE: x.SE, S: x.S, NE: x.NE, N: x.N }
      : { m: x.m, sin: x.completo ? x.participacao_carga_global_sin_pct : null, sin_incompleto: x.completo ? null : x.participacao_carga_global_sin_pct },
  );
}

export function linhasOnsMensal(mensal: readonly OnsMmgdMes[], idioma: Idioma = idiomaEnergia()) {
  return mensal.map((x) => ({
    id: x.m,
    m: x.m,
    sin: x.SIN,
    SE: x.SE,
    S: x.S,
    NE: x.NE,
    N: x.N,
    carga_global_sin_mwmed: x.carga_global_sin_mwmed,
    participacao_carga_global_sin_pct: x.participacao_carga_global_sin_pct,
    dias_completos_sin: x.dias_completos_sin,
    dias_no_mes: x.dias_no_mes,
    situacao: x.completo ? tx("mês completo", "full month", idioma) : tx("mês incompleto", "incomplete month", idioma),
    capacidade_aneel_mw: x.capacidade_aneel_mw,
    // estoque de meses depois do corte do cadastro ainda pode crescer: o número vem rotulado
    capacidade_situacao:
      x.capacidade_aneel_mw === null
        ? null
        : x.capacidade_aneel_provisoria
          ? tx("provisória (cadastro recente)", "provisional (recent register)", idioma)
          : tx("consolidada", "consolidated", idioma),
    razao_estimativa_ons_capacidade_pct: x.razao_estimativa_ons_capacidade_pct,
  }));
}

export function colunasOnsMensal(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const mwmed = tx("MWmed", "MWavg", idioma);
  return [
    { id: "m", rotulo: tx("Mês", "Month", idioma), tipo: "texto" },
    { id: "sin", rotulo: tx("MMGD estimada, SIN", "Estimated MMGD, SIN", idioma), tipo: "numero", unidade: mwmed, casas: 1 },
    { id: "SE", rotulo: nomeSubmercado("SE", idioma, true), tipo: "numero", unidade: mwmed, casas: 1 },
    { id: "S", rotulo: nomeSubmercado("S", idioma, true), tipo: "numero", unidade: mwmed, casas: 1 },
    { id: "NE", rotulo: nomeSubmercado("NE", idioma, true), tipo: "numero", unidade: mwmed, casas: 1 },
    { id: "N", rotulo: nomeSubmercado("N", idioma, true), tipo: "numero", unidade: mwmed, casas: 1 },
    { id: "carga_global_sin_mwmed", rotulo: tx("Carga global, SIN", "Gross load, SIN", idioma), tipo: "numero", unidade: mwmed, casas: 0 },
    { id: "participacao_carga_global_sin_pct", rotulo: tx("MMGD na carga global, SIN", "MMGD in the gross load, SIN", idioma), tipo: "percentual", casas: 2 },
    { id: "dias_completos_sin", rotulo: tx("Dias completos no SIN", "Complete days in the SIN", idioma), tipo: "numero", casas: 0 },
    { id: "dias_no_mes", rotulo: tx("Dias no mês", "Days in the month", idioma), tipo: "numero", casas: 0 },
    { id: "situacao", rotulo: tx("Situação", "Status", idioma), tipo: "texto", categorica: true },
    {
      id: "capacidade_aneel_mw",
      rotulo: tx(
        "Capacidade cadastrada ANEEL (Brasil, média do estoque no início e no fim do mês)",
        "ANEEL registered capacity (Brazil, average of the stock at the start and end of the month)",
        idioma,
      ),
      tipo: "numero",
      unidade: "MW",
      casas: 0,
    },
    { id: "capacidade_situacao", rotulo: tx("Situação da capacidade", "Status of the capacity", idioma), tipo: "texto", categorica: true },
    {
      id: "razao_estimativa_ons_capacidade_pct",
      rotulo: tx("Razão estimativa ÷ capacidade (não é fator de capacidade)", "Ratio estimate ÷ capacity (not a capacity factor)", idioma),
      tipo: "percentual",
      casas: 1,
    },
  ];
}
export const COLUNAS_ONS_MENSAL: ColunaTabela[] = colunasOnsMensal("pt");

export function linhasOnsAnual(anual: readonly OnsMmgdAno[], idioma: Idioma = idiomaEnergia()) {
  return anual.map((a) => ({
    id: String(a.ano),
    ano: a.ano,
    rotulo: a.completo ? String(a.ano) : tx(`${a.ano} (incompleto)`, `${a.ano} (incomplete)`, idioma),
    mmgd_sin_mwmed: a.mmgd_sin_mwmed,
    mmgd_sin_twh: a.mmgd_sin_twh,
    participacao_carga_global_pct: a.participacao_carga_global_pct,
    dias_completos: a.dias_completos,
    situacao: a.completo ? tx("ano completo", "full year", idioma) : tx("ano incompleto", "incomplete year", idioma),
  }));
}

/** Razão rotulada (estimativa ÷ capacidade) só nos meses em que a gold a publica. */
export function dadosRazaoCapacidade(mensal: readonly OnsMmgdMes[]): { m: string; razao: number }[] {
  return mensal.filter((x) => temValor(x.razao_estimativa_ons_capacidade_pct)).map((x) => ({ m: x.m, razao: x.razao_estimativa_ons_capacidade_pct as number }));
}

/** Último ano completo do ONS (o ano corrente é parcial e não compete com anos completos). */
export function ultimoAnoCompletoOns(anual: readonly OnsMmgdAno[]): OnsMmgdAno | null {
  return [...anual].reverse().find((a) => a.completo) ?? null;
}

export function respostaOns(o: Pick<BlocoOnsMmgd, "ultimo_mes_completo" | "anual">, idioma: Idioma = idiomaEnergia()): string {
  const u = o.ultimo_mes_completo;
  const anoC = ultimoAnoCompletoOns(o.anual);
  const primeiroC = o.anual.find((a) => a.completo) ?? null;
  const partes: string[] = [];
  if (u) {
    partes.push(
      tx(
        `No último mês completo (${mes(u.m, idioma)}), a MMGD estimada pelo ONS foi de ${numTexto(u.SIN, 1, idioma)} MWmed no SIN, ${pctTexto(u.participacao_carga_global_sin_pct, 2, idioma)} da carga global.`,
        `In the last full month (${mes(u.m, idioma)}), the MMGD estimated by the ONS was ${numTexto(u.SIN, 1, idioma)} MWavg in the SIN, ${pctTexto(u.participacao_carga_global_sin_pct, 2, idioma)} of the gross load.`,
        idioma,
      ),
    );
  } else
    partes.push(
      tx(
        "Nenhum mês da série do ONS tem os quatro submercados completos nesta publicação.",
        "No month of the ONS series has the four submarkets complete in this release.",
        idioma,
      ),
    );
  if (anoC) {
    const desde =
      primeiroC && primeiroC.ano !== anoC.ano
        ? tx(
            `, contra ${pctTexto(primeiroC.participacao_carga_global_pct, 2, idioma)} em ${primeiroC.ano}, primeiro ano completo da série`,
            `, against ${pctTexto(primeiroC.participacao_carga_global_pct, 2, idioma)} in ${primeiroC.ano}, the first full year of the series`,
            idioma,
          )
        : "";
    partes.push(
      tx(
        `Em ${anoC.ano}, último ano completo, foram ${numTexto(anoC.mmgd_sin_mwmed, 0, idioma)} MWmed, ou ${numTexto(anoC.mmgd_sin_twh, 2, idioma)} TWh, ${pctTexto(anoC.participacao_carga_global_pct, 2, idioma)} da carga global${desde}.`,
        `In ${anoC.ano}, the last full year, there were ${numTexto(anoC.mmgd_sin_mwmed, 0, idioma)} MWavg, or ${numTexto(anoC.mmgd_sin_twh, 2, idioma)} TWh, ${pctTexto(anoC.participacao_carga_global_pct, 2, idioma)} of the gross load${desde}.`,
        idioma,
      ),
    );
  }
  partes.push(
    tx(
      "É uma estimativa publicada pelo ONS, não medição, e não se soma à capacidade cadastrada na ANEEL.",
      "It is an estimate published by the ONS, not a measurement, and it is not added to the capacity registered with ANEEL.",
      idioma,
    ),
  );
  return partes.join(" ");
}

/** Último mês com a razão publicada e o motivo da ausência nos meses seguintes. */
export function mudancaOns(o: Pick<BlocoOnsMmgd, "mensal">, corteProvisorio: string, idioma: Idioma = idiomaEnergia()): string {
  const r = dadosRazaoCapacidade(o.mensal);
  const ult = r.at(-1);
  if (!ult)
    return tx(
      "A razão entre a estimativa do ONS e a capacidade cadastrada não tem nenhum mês publicado nesta versão.",
      "The ratio between the ONS estimate and the registered capacity has no month published in this version.",
      idioma,
    );
  return tx(
    `A razão entre a energia estimada e a capacidade cadastrada foi ${pctTexto(ult.razao, 1, idioma)} em ${mes(ult.m, idioma)}. Ela fica sem valor nos meses depois de ${mes(corteProvisorio, idioma)}, porque o cadastro desses meses é provisório, e em meses incompletos do ONS. Não é fator de capacidade: compara perímetros diferentes (SIN e Brasil).`,
    `The ratio between the estimated energy and the registered capacity was ${pctTexto(ult.razao, 1, idioma)} in ${mes(ult.m, idioma)}. It has no value in the months after ${mes(corteProvisorio, idioma)}, because the register for those months is provisional, and in incomplete ONS months. It is not a capacity factor: it compares different perimeters (SIN and Brazil).`,
    idioma,
  );
}

/* ---------- conferência da quebra de 2023 (achado A11) ---------- */

/**
 * Primeiro dia com o critério novo do Balanço de Energia: o primeiro dia dos pares
 * publicados pelo pipeline (cada dia a partir da incorporação declarada pelo ONS).
 * Nunca escrito à mão; sem pares, null.
 */
export function dataIncorporacao(c: Pick<ConferenciaQuebra2023, "pares_mesmo_dia_da_semana">): string | null {
  return c.pares_mesmo_dia_da_semana[0]?.d ?? null;
}

/**
 * Os dois trechos da janela publicada, antes e a partir da incorporação, como o
 * pipeline os usa nas médias da solar (`solar_media_7d_antes` e `solar_media_depois`):
 * primeiro e último dia de cada trecho e quantos dias ele tem. O rótulo da tabela diz
 * de que dias é cada média, em vez de "depois" sem data.
 */
export function trechosConferencia(c: Pick<ConferenciaQuebra2023, "dias" | "pares_mesmo_dia_da_semana">): {
  antes: { inicio: string; fim: string; dias: number } | null;
  depois: { inicio: string; fim: string; dias: number } | null;
} {
  const marco = dataIncorporacao(c);
  if (!marco) return { antes: null, depois: null };
  const trecho = (ds: string[]) => (ds.length ? { inicio: ds[0], fim: ds[ds.length - 1], dias: ds.length } : null);
  const ordem = c.dias.map((x) => x.d).sort();
  return { antes: trecho(ordem.filter((d) => d < marco)), depois: trecho(ordem.filter((d) => d >= marco)) };
}

export function dadosConferencia(c: Pick<ConferenciaQuebra2023, "dias">) {
  return c.dias.map((d) => ({
    d: d.d,
    solar: d.solar_balanco_sin_mwmed,
    carga: d.carga_balanco_sin_mwmed,
    mmgd: d.mmgd_ons_sin_mwmed,
  }));
}

export function linhasPares(c: Pick<ConferenciaQuebra2023, "pares_mesmo_dia_da_semana">, idioma: Idioma = idiomaEnergia()) {
  return c.pares_mesmo_dia_da_semana.map((p) => ({
    id: p.d,
    d: p.d,
    dia_da_semana: rotuloDado(p.dia_da_semana, DIA_SEMANA_EN, idioma),
    d_comparacao: p.d_comparacao,
    solar_d: p.solar_d,
    solar_comparacao: p.solar_comparacao,
    diferenca_solar: p.diferenca_solar,
    carga_d: p.carga_d,
    carga_comparacao: p.carga_comparacao,
    diferenca_carga: p.diferenca_carga,
    mmgd_ons_d: p.mmgd_ons_d,
    mediana: p.entra_na_mediana
      ? tx("entra", "included", idioma)
      : tx(`fora (${p.feriado ?? "feriado"})`, `excluded (${rotuloDado(p.feriado ?? "feriado", FERIADO_EN, idioma)})`, idioma),
  }));
}

export function colunasPares(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const mwmed = tx("MWmed", "MWavg", idioma);
  return [
    { id: "d", rotulo: tx("Dia", "Day", idioma), tipo: "data" },
    { id: "dia_da_semana", rotulo: tx("Dia da semana", "Day of the week", idioma), tipo: "texto" },
    { id: "d_comparacao", rotulo: tx("Comparado com", "Compared with", idioma), tipo: "data" },
    { id: "solar_d", rotulo: tx("Solar no dia", "Solar on the day", idioma), tipo: "numero", unidade: mwmed, casas: 0 },
    { id: "solar_comparacao", rotulo: tx("Solar 14 dias antes", "Solar 14 days earlier", idioma), tipo: "numero", unidade: mwmed, casas: 0 },
    { id: "diferenca_solar", rotulo: tx("Diferença na solar", "Difference in solar", idioma), tipo: "numero", unidade: mwmed, casas: 0 },
    { id: "carga_d", rotulo: tx("Carga no dia", "Load on the day", idioma), tipo: "numero", unidade: mwmed, casas: 0 },
    { id: "carga_comparacao", rotulo: tx("Carga 14 dias antes", "Load 14 days earlier", idioma), tipo: "numero", unidade: mwmed, casas: 0 },
    { id: "diferenca_carga", rotulo: tx("Diferença na carga", "Difference in load", idioma), tipo: "numero", unidade: mwmed, casas: 0 },
    { id: "mmgd_ons_d", rotulo: tx("MMGD estimada no dia", "Estimated MMGD on the day", idioma), tipo: "numero", unidade: mwmed, casas: 0 },
    { id: "mediana", rotulo: tx("Na mediana", "In the median", idioma), tipo: "texto" },
  ];
}
export const COLUNAS_PARES: ColunaTabela[] = colunasPares("pt");

/* ================================================================ P064: emissões (MCTI) */

const leitorAno: Leitor<string> = { ler: (b) => (/^(19|20)\d\d$/.test(b) ? b : undefined), escrever: (v) => v };

/** Estado da página de emissões na URL: intervalo da série mensal e até quatro anos comparados mês a mês. */
export const ESQUEMA_EMISSOES = {
  de: campo(tiposUrl.mes(), "", { param: "em.de" }), // i18n: dado
  ate: campo(tiposUrl.mes(), "", { param: "em.ate" }), // i18n: dado
  anos: campo(tiposUrl.lista(leitorAno, { max: LIMITE_COMPARACAO }), [] as string[], { param: "em.anos" }), // i18n: dado
};

/** Série mensal do fator médio (inventários), como publicada pelo MCTI. */
export function dadosFatorMensal(e: Pick<BlocoEmissoes, "medio_mensal">): { m: string; medio: number }[] {
  return e.medio_mensal.map((x) => ({ m: x.m, medio: x.valor }));
}

export function linhasFatorMensal(e: Pick<BlocoEmissoes, "medio_mensal" | "quebras">, idioma: Idioma = idiomaEnergia()) {
  const quebra = e.quebras[0]?.data ?? null;
  return e.medio_mensal.map((x) => ({
    id: x.m,
    m: x.m,
    ano: x.m.slice(0, 4),
    medio: x.valor,
    base:
      quebra && x.m >= quebra
        ? tx(`base ampliada (a partir de ${mes(quebra, idioma)})`, `expanded base (from ${mes(quebra, idioma)})`, idioma)
        : quebra
          ? tx(`base anterior a ${mes(quebra, idioma)}`, `base before ${mes(quebra, idioma)}`, idioma)
          : tx("base única", "single base", idioma),
  }));
}

export function colunasFatorMensal(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "m", rotulo: tx("Mês", "Month", idioma), tipo: "texto" },
    { id: "ano", rotulo: tx("Ano", "Year", idioma), tipo: "texto", categorica: true }, // i18n: dado
    { id: "medio", rotulo: tx("Fator médio (inventários)", "Average factor (inventories)", idioma), tipo: "numero", unidade: "tCO2/MWh", casas: 4 },
    { id: "base", rotulo: tx("Base de usinas", "Plant base", idioma), tipo: "texto", categorica: true },
  ];
}
export const COLUNAS_FATOR_MENSAL: ColunaTabela[] = colunasFatorMensal("pt");

/** Uma linha por ano: fator médio anual e, em colunas separadas e rotuladas, os fatores do MDL e o controle de leitura. */
export function linhasFatorAnual(
  e: Pick<BlocoEmissoes, "medio_anual" | "margem_construcao_anual" | "margem_operacao_simples_ajustado_anual" | "energia_despachada_mwh" | "anual_x_media_mensal">,
  idioma: Idioma = idiomaEnergia(),
) {
  const bm = new Map(e.margem_construcao_anual.map((x) => [x.ano, x.valor]));
  const sa = new Map(e.margem_operacao_simples_ajustado_anual.map((x) => [x.ano, x.valor]));
  const en = new Map(e.energia_despachada_mwh.map((x) => [x.ano, x.mwh]));
  const ctl = new Map(e.anual_x_media_mensal.map((x) => [x.ano, x]));
  const anos = Array.from(new Set([...e.medio_anual.map((x) => x.ano), ...Array.from(bm.keys()), ...Array.from(sa.keys())])).sort((a, b) => a - b);
  const medio = new Map(e.medio_anual.map((x) => [x.ano, x.valor]));
  return anos.map((ano) => ({
    id: String(ano),
    ano,
    medio: medio.get(ano) ?? null,
    media_simples_meses: ctl.get(ano)?.media_simples_meses ?? null,
    controle: ctl.has(ano)
      ? ctl.get(ano)!.dentro_da_tolerancia
        ? tx("dentro da tolerância", "within tolerance", idioma)
        : tx("fora da tolerância (ressalva)", "outside tolerance (caveat)", idioma)
      : tx("sem controle", "no check", idioma),
    margem_construcao: bm.get(ano) ?? null,
    margem_operacao_simples_ajustado: sa.get(ano) ?? null,
    energia_despachada_mwh: en.get(ano) ?? null,
  }));
}

export function colunasFatorAnual(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "ano", rotulo: tx("Ano", "Year", idioma), tipo: "numero", casas: 0, buscavel: true }, // i18n: dado
    { id: "medio", rotulo: tx("Fator médio anual (inventários)", "Annual average factor (inventories)", idioma), tipo: "numero", unidade: "tCO2/MWh", casas: 4 },
    { id: "media_simples_meses", rotulo: tx("Média simples dos 12 meses (controle)", "Simple average of the 12 months (check)", idioma), tipo: "numero", unidade: "tCO2/MWh", casas: 5 },
    { id: "controle", rotulo: tx("Anual × meses", "Annual × months", idioma), tipo: "texto", categorica: true },
    { id: "margem_construcao", rotulo: tx("Margem de construção (MDL)", "Build margin (CDM)", idioma), tipo: "numero", unidade: "tCO2/MWh", casas: 4 },
    {
      id: "margem_operacao_simples_ajustado",
      rotulo: tx("Margem de operação, simples ajustado (MDL)", "Operating margin, simple adjusted (CDM)", idioma),
      tipo: "numero",
      unidade: "tCO2/MWh",
      casas: 4,
    },
    { id: "energia_despachada_mwh", rotulo: tx("Energia despachada (simples ajustado)", "Dispatched energy (simple adjusted)", idioma), tipo: "numero", unidade: "MWh", casas: 0 },
  ];
}
export const COLUNAS_FATOR_ANUAL: ColunaTabela[] = colunasFatorAnual("pt");

/** Barras do fator médio anual, uma por ano publicado. */
export function dadosFatorAnual(e: Pick<BlocoEmissoes, "medio_anual">): { id: string; rotulo: string; medio: number }[] {
  return e.medio_anual.map((x) => ({ id: String(x.ano), rotulo: String(x.ano), medio: x.valor }));
}

/** Referência das barras anuais: o último ano completo publicado, para comparar cada ano com ele. */
export function referenciaAnual(e: Pick<BlocoEmissoes, "ultimo_ano">): { valor: number; rotulo: string }[] {
  const u = e.ultimo_ano;
  // o gráfico já escreve "rótulo: valor unidade" na linha e na legenda: o rótulo é só o ano, sem repetir o valor
  return u ? [{ valor: u.valor, rotulo: String(u.ano) }] : [];
}

/** Anos com pelo menos um mês do fator médio publicado; no ano corrente, os meses ainda não publicados ficam em branco na comparação. */
export function anosDoFatorMensal(e: Pick<BlocoEmissoes, "medio_mensal">): string[] {
  return Array.from(new Set(e.medio_mensal.map((x) => x.m.slice(0, 4)))).sort();
}

const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]; // i18n: dado

/**
 * Perfil mês a mês dos anos escolhidos (até quatro), na mesma escala: x é o mês do
 * ano, uma série por ano. Mês não publicado (ano corrente) fica ausente, nunca zero.
 */
export function dadosPerfilAnos(e: Pick<BlocoEmissoes, "medio_mensal">, anos: readonly string[], idioma: Idioma = idiomaEnergia()): Record<string, string | number | null>[] {
  const v = new Map(e.medio_mensal.map((x) => [x.m, x.valor]));
  return MESES_CURTOS.map((rot, i) => {
    const mm = String(i + 1).padStart(2, "0");
    const l: Record<string, string | number | null> = { mes: idioma === "en" ? nomeMes(i + 1, idioma) : rot };
    for (const a of anos) l[a] = v.get(`${a}-${mm}`) ?? null;
    return l;
  });
}

/** Margem de operação por despacho (MDL), mensal. */
export function dadosMargemOperacao(e: Pick<BlocoEmissoes, "margem_operacao_despacho_mensal">): { m: string; om: number }[] {
  return e.margem_operacao_despacho_mensal.map((x: FatorMes) => ({ m: x.m, om: x.valor }));
}

/** Fatores anuais do MDL lado a lado (construção e operação pelo simples ajustado), sem o fator médio. */
export function dadosMdlAnual(e: Pick<BlocoEmissoes, "margem_construcao_anual" | "margem_operacao_simples_ajustado_anual">): Record<string, string | number | null>[] {
  const bm = new Map(e.margem_construcao_anual.map((x: FatorAno) => [x.ano, x.valor]));
  const sa = new Map(e.margem_operacao_simples_ajustado_anual.map((x: FatorAno) => [x.ano, x.valor]));
  const anos = Array.from(new Set([...Array.from(bm.keys()), ...Array.from(sa.keys())])).sort((a, b) => a - b);
  return anos.map((a) => ({ ano: String(a), bm: bm.get(a) ?? null, sa: sa.get(a) ?? null }));
}

/**
 * Resposta curta de "Como varia a intensidade de emissões?": último fator anual
 * contra o ano anterior, último mês publicado, extremos da série anual e a quebra
 * declarada pelo MCTI. Todos os números vêm da gold.
 */
export function respostaEmissoes(e: Pick<BlocoEmissoes, "medio_anual" | "ultimo_ano" | "ultimo_mes" | "quebras">, idioma: Idioma = idiomaEnergia()): string {
  const ua = e.ultimo_ano;
  const partes: string[] = [];
  const f = (v: number | null | undefined) => fator(v, idioma);
  if (ua) {
    const ant = e.medio_anual.find((x) => x.ano === ua.ano - 1);
    const dir = comparaArredondado(ua.valor, ant?.valor, 4);
    const comp =
      dir === null || !ant
        ? ""
        : dir === "igual"
          ? tx(`, igual a ${ant.ano}`, `, the same as ${ant.ano}`, idioma)
          : tx(`, ${dir === "maior" ? "acima" : "abaixo"} de ${ant.ano} (${f(ant.valor)})`, `, ${dir === "maior" ? "above" : "below"} ${ant.ano} (${f(ant.valor)})`, idioma);
    partes.push(
      tx(
        `Em ${ua.ano}, o fator médio de emissão de CO2 da geração no SIN, publicado pelo MCTI, foi ${f(ua.valor)} tCO2/MWh${comp}.`,
        `In ${ua.ano}, the average CO2 emission factor of generation in the SIN, published by the MCTI, was ${f(ua.valor)} tCO2/MWh${comp}.`,
        idioma,
      ),
    );
  } else partes.push(tx("O MCTI não tem fator médio anual publicado nesta versão.", "The MCTI has no annual average factor published in this version.", idioma));
  if (e.ultimo_mes)
    partes.push(
      tx(
        `No último mês publicado (${mes(e.ultimo_mes.m, idioma)}), ${f(e.ultimo_mes.valor)} tCO2/MWh.`,
        `In the last published month (${mes(e.ultimo_mes.m, idioma)}), ${f(e.ultimo_mes.valor)} tCO2/MWh.`,
        idioma,
      ),
    );
  const max = extremo(e.medio_anual, (x) => x.valor, "max");
  const min = extremo(e.medio_anual, (x) => x.valor, "min");
  if (max && min && e.medio_anual.length > 1) {
    partes.push(
      tx(
        `Na série anual de ${e.medio_anual[0].ano} a ${e.medio_anual.at(-1)!.ano}, o maior valor foi ${f(max.valor)} (${max.ano}) e o menor, ${f(min.valor)} (${min.ano}).`,
        `In the annual series from ${e.medio_anual[0].ano} to ${e.medio_anual.at(-1)!.ano}, the highest value was ${f(max.valor)} (${max.ano}) and the lowest, ${f(min.valor)} (${min.ano}).`,
        idioma,
      ),
    );
  }
  const q = e.quebras[0];
  if (q)
    partes.push(
      tx(
        `A partir de ${mes(q.data, idioma)}, o MCTI ampliou a base de usinas, com a mesma metodologia: comparações que atravessam essa data misturam bases.`,
        `From ${mes(q.data, idioma)}, the MCTI expanded the plant base, with the same methodology: comparisons that cross this date mix bases.`,
        idioma,
      ),
    );
  return partes.join(" ");
}

/**
 * "O que mudou": o último mês contra o mesmo mês do ano anterior (sazonalidade
 * igual), com a quebra lembrada quando os dois lados ficam em bases diferentes.
 */
export function mudancaEmissoes(e: Pick<BlocoEmissoes, "medio_mensal" | "ultimo_mes" | "quebras">, idioma: Idioma = idiomaEnergia()): string {
  const um = e.ultimo_mes;
  if (!um) return tx("Sem mês publicado nesta versão.", "No month published in this version.", idioma);
  const mAnt = `${Number(um.m.slice(0, 4)) - 1}${um.m.slice(4)}`;
  const ant = e.medio_mensal.find((x) => x.m === mAnt);
  const dir = comparaArredondado(um.valor, ant?.valor, 4);
  const q = e.quebras[0]?.data;
  const atravessa = q && ant ? ant.m < q && um.m >= q : false;
  const f = (v: number | null | undefined) => fator(v, idioma);
  const base =
    dir === null || !ant
      ? tx(
          `Em ${mes(um.m, idioma)}, ${f(um.valor)} tCO2/MWh; o mesmo mês do ano anterior não tem valor publicado.`,
          `In ${mes(um.m, idioma)}, ${f(um.valor)} tCO2/MWh; the same month of the previous year has no published value.`,
          idioma,
        )
      : tx(
          `Em ${mes(um.m, idioma)}, ${f(um.valor)} tCO2/MWh, ${dir === "igual" ? "igual ao" : dir === "maior" ? "acima do" : "abaixo do"} mesmo mês do ano anterior (${f(ant.valor)} em ${mes(ant.m, idioma)}).`,
          `In ${mes(um.m, idioma)}, ${f(um.valor)} tCO2/MWh, ${dir === "igual" ? "the same as" : dir === "maior" ? "above" : "below"} the same month of the previous year (${f(ant.valor)} in ${mes(ant.m, idioma)}).`,
          idioma,
        );
  return atravessa
    ? tx(
        `${base} Os dois meses estão em bases de usinas diferentes (quebra de ${mes(q, idioma)}).`,
        `${base} The two months are in different plant bases (break of ${mes(q, idioma)}).`,
        idioma,
      )
    : base;
}

/**
 * Estado de acesso à página do MCTI: bloqueio registrado na última tentativa vira
 * aviso de fonte defasada (vale a última captura válida); acesso normal vira só a
 * data. Nunca "em breve": o texto diz o que aconteceu e quando.
 */
export function estadoAcessoMcti(a: BlocoEmissoes["acesso"], idioma: Idioma = idiomaEnergia()): { defasada: boolean; texto: string; detalhe: string | null } {
  // i18n: dado (situação da gold)
  if (a.situacao === "bloqueada") {
    return {
      defasada: true,
      texto: tx(
        `Na última tentativa (${carimbo(a.tentado_em, idioma)}), a página do MCTI respondeu com um desafio de verificação humana, que não é contornado. Os valores são da última captura válida (${carimbo(a.ultimo_acesso_ok, idioma)}); um mês publicado depois dela ainda não aparece aqui.`,
        `On the last attempt (${carimbo(a.tentado_em, idioma)}), the MCTI page responded with a human verification challenge, which is not bypassed. The values are from the last valid capture (${carimbo(a.ultimo_acesso_ok, idioma)}); a month published after it does not appear here yet.`,
        idioma,
      ),
      detalhe: null,
    };
  }
  if (a.situacao === null)
    return {
      defasada: true,
      texto: tx(
        "Não há registro de acesso à página do MCTI nesta publicação; os valores vêm das planilhas já capturadas.",
        "There is no record of access to the MCTI page in this release; the values come from the spreadsheets already captured.",
        idioma,
      ),
      detalhe: null,
    };
  // a contagem de planilhas, âncoras e notas da listagem é detalhe de coleta: vai separada, para o modo Auditar
  const detalhe = a.detalhe ? detalheAcessoMcti(a.detalhe.replace(/\b1 notas técnicas\b/, "1 nota técnica"), idioma) : null;
  return { defasada: false, texto: tx(`Página do MCTI acessada em ${carimbo(a.ultimo_acesso_ok, idioma)}.`, `MCTI page accessed on ${carimbo(a.ultimo_acesso_ok, idioma)}.`, idioma), detalhe };
}

/** Detalhe da listagem do MCTI ("23 planilhas publicadas, 13 âncoras ocultas ignoradas, 1 nota técnica") no idioma. */
function detalheAcessoMcti(detalhe: string, idioma: Idioma): string {
  if (idioma !== "en") return detalhe;
  const m = /^(\d+) planilhas publicadas, (\d+) âncoras ocultas ignoradas, (\d+) notas? técnicas?$/.exec(detalhe); // i18n: dado
  if (!m) return detalhe;
  const n = (v: string, um: string, varios: string) => `${v} ${v === "1" ? um : varios}`;
  return `${n(m[1], "spreadsheet", "spreadsheets")} published, ${n(m[2], "hidden anchor", "hidden anchors")} ignored, ${n(m[3], "technical note", "technical notes")}`;
}

/* ================================================================ síntese */

/** As três grandezas do módulo, que nunca se somam (texto da página de síntese), no idioma. */
export function grandezas(idioma: Idioma = idiomaEnergia()) {
  return [
    {
      nome: tx("Capacidade cadastrada", "Registered capacity", idioma),
      unidade: tx("unidades, kW e MW", "units, kW and MW", idioma),
      texto: tx(
        "Potência instalada das unidades de micro e minigeração distribuída no cadastro da ANEEL. Mede capacidade, não energia gerada.",
        "Installed capacity of the distributed micro and mini generation units in ANEEL's register. It measures capacity, not energy generated.",
        idioma,
      ),
    },
    {
      nome: tx("Energia estimada", "Estimated energy", idioma),
      unidade: tx("MWmed e TWh", "MWavg and TWh", idioma),
      texto: tx(
        "Energia de MMGD que o ONS estima para o SIN a cada meia hora. É estimativa da fonte, não medição, e cobre só o SIN.",
        "MMGD energy that the ONS estimates for the SIN every half hour. It is the source's estimate, not a measurement, and covers only the SIN.",
        idioma,
      ),
    },
    {
      nome: tx("Fator de emissão", "Emission factor", idioma),
      unidade: "tCO2/MWh",
      texto: tx(
        "Toneladas de CO2 por MWh gerado no SIN, calculadas e publicadas pelo MCTI. Só CO2, emissões da operação das usinas.",
        "Tonnes of CO2 per MWh generated in the SIN, calculated and published by the MCTI. Only CO2, emissions from the plants' operation.",
        idioma,
      ),
    },
  ] as const;
}
export const GRANDEZAS = grandezas("pt");

/* ================================================================ vereditos (r8): resposta curta em duas camadas */

/**
 * Cada veredito responde, em palavras simples e com no máximo dois números, à pergunta do título do painel e diz o limite
 * de leitura. Os números saem dos mesmos campos da resposta completa (respostaMmgd, respostaOns e respostaEmissoes), que
 * continua inteira como segunda camada em Analisar e Auditar. Dado ausente: veredito vazio.
 */

/** P063: a UF que mais acrescentou potência no último ano completo, o total cadastrado e o limite (capacidade, não energia). */
export function vereditoMmgd(m: Pick<BlocoMmgd, "data_cadastro" | "ano_referencia" | "resumo" | "ufs">, idioma: Idioma = idiomaEnergia()): string {
  const r = m.resumo;
  if (!temValor(r.potencia_mw)) return "";
  const mais = extremo(m.ufs, (u) => u.potencia_mw_ano_referencia, "max");
  const onde = mais
    ? tx(
        `Em ${m.ano_referencia}, último ano completo, ${mais.nome} foi a UF que mais acrescentou potência (${numTexto(mais.potencia_mw_ano_referencia, 1, idioma)} MW). `,
        `In ${m.ano_referencia}, the last full year, ${mais.nome} was the state that added the most capacity (${numTexto(mais.potencia_mw_ano_referencia, 1, idioma)} MW). `,
        idioma,
      )
    : "";
  return tx(
    `${onde}O cadastro da ANEEL somava ${numTexto(r.potencia_mw, 1, idioma)} MW em ${data(m.data_cadastro, idioma)}; é capacidade, não energia gerada.`,
    `${onde}ANEEL's register added up to ${numTexto(r.potencia_mw, 1, idioma)} MW on ${data(m.data_cadastro, idioma)}; this is capacity, not energy generated.`,
    idioma,
  );
}

/** O que mudou na MMGD, em palavras: as conexões do último ano completo contra o anterior; o resto é o aviso dos meses provisórios. */
export function mudancaMmgdAno(m: Pick<BlocoMmgd, "ano_referencia" | "anual" | "corte_provisorio">, idioma: Idioma = idiomaEnergia()): string {
  const atual = m.anual.find((a) => a.ano === m.ano_referencia);
  const ant = m.anual.find((a) => a.ano === m.ano_referencia - 1);
  const provisorio = tx(
    `Os meses depois de ${mes(m.corte_provisorio, idioma)} são provisórios: a ANEEL ainda pode receber registros deles.`,
    `The months after ${mes(m.corte_provisorio, idioma)} are provisional: ANEEL may still receive records for them.`,
    idioma,
  );
  if (!atual) return provisorio;
  const dir = comparaArredondado(atual.potencia_mw, ant?.potencia_mw, 1);
  const nt = (v: number | null | undefined) => numTexto(v, 1, idioma);
  const comp =
    dir === null || !ant
      ? ""
      : dir === "igual"
        ? tx(`, igual aos ${nt(ant.potencia_mw)} MW de ${ant.ano}`, `, the same as the ${nt(ant.potencia_mw)} MW of ${ant.ano}`, idioma)
        : tx(`, ${dir === "maior" ? "mais" : "menos"} que os ${nt(ant.potencia_mw)} MW de ${ant.ano}`, `, ${dir === "maior" ? "more" : "less"} than the ${nt(ant.potencia_mw)} MW of ${ant.ano}`, idioma);
  return tx(
    `Em ${m.ano_referencia}, último ano completo, foram conectados ${nt(atual.potencia_mw)} MW${comp}. ${provisorio}`,
    `In ${m.ano_referencia}, the last full year, ${nt(atual.potencia_mw)} MW were connected${comp}. ${provisorio}`,
    idioma,
  );
}

/** Energia estimada (ONS): o último mês completo, com "carga global" dita como a carga que o ONS verifica (nome do verbete), e o limite. */
export function vereditoOns(o: Pick<BlocoOnsMmgd, "ultimo_mes_completo">, idioma: Idioma = idiomaEnergia()): string {
  const u = o.ultimo_mes_completo;
  if (!u || !temValor(u.SIN)) return "";
  return tx(
    `Em ${mes(u.m, idioma)}, o ONS estimou que a MMGD entregou ${numTexto(u.SIN, 1, idioma)} MWmed ao SIN, ${pctTexto(u.participacao_carga_global_sin_pct, 2, idioma)} da carga global (a carga que o ONS verifica). É estimativa, não medição, e não se soma à capacidade cadastrada.`,
    `In ${mes(u.m, idioma)}, the ONS estimated that MMGD delivered ${numTexto(u.SIN, 1, idioma)} MWavg to the SIN, ${pctTexto(u.participacao_carga_global_sin_pct, 2, idioma)} of the gross load (the load that the ONS verifies). It is an estimate, not a measurement, and it is not added to the registered capacity.`,
    idioma,
  );
}

/**
 * O que mudou na energia estimada: o último mês completo contra o mesmo mês do ano anterior (a sazonalidade da solar não
 * entra na comparação). Sem o mês de um ano antes, só o valor.
 */
export function mudancaOnsMes(o: Pick<BlocoOnsMmgd, "ultimo_mes_completo" | "mensal">, idioma: Idioma = idiomaEnergia()): string {
  const u = o.ultimo_mes_completo;
  if (!u || !temValor(u.SIN)) return "";
  const antes = `${Number(u.m.slice(0, 4)) - 1}${u.m.slice(4)}`;
  const a = o.mensal.find((x) => x.m === antes && x.completo);
  const dir = comparaArredondado(u.SIN, a?.SIN, 1);
  if (dir === null || !a)
    return tx(
      `Em ${mes(u.m, idioma)}, a MMGD estimada foi de ${numTexto(u.SIN, 1, idioma)} MWmed no SIN; o mesmo mês do ano anterior não tem valor completo.`,
      `In ${mes(u.m, idioma)}, the estimated MMGD was ${numTexto(u.SIN, 1, idioma)} MWavg in the SIN; the same month of the previous year has no complete value.`,
      idioma,
    );
  const verbo = dir === "igual" ? tx("igual ao", "the same as", idioma) : dir === "maior" ? tx("acima do", "above", idioma) : tx("abaixo do", "below", idioma);
  return tx(
    `Em ${mes(u.m, idioma)}, a MMGD estimada foi de ${numTexto(u.SIN, 1, idioma)} MWmed no SIN, ${verbo} mesmo mês do ano anterior (${numTexto(a.SIN, 1, idioma)} MWmed em ${mes(a.m, idioma)}).`,
    `In ${mes(u.m, idioma)}, the estimated MMGD was ${numTexto(u.SIN, 1, idioma)} MWavg in the SIN, ${verbo} the same month of the previous year (${numTexto(a.SIN, 1, idioma)} MWavg in ${mes(a.m, idioma)}).`,
    idioma,
  );
}

/** Como ler a participação na carga global: o exemplo com o último mês, antes de qualquer fórmula. */
export function comoLerOns(o: Pick<BlocoOnsMmgd, "ultimo_mes_completo">, idioma: Idioma = idiomaEnergia()): string {
  const u = o.ultimo_mes_completo;
  if (!u || !temValor(u.participacao_carga_global_sin_pct)) return "";
  return tx(
    `Leia como a parcela da carga do SIN que o ONS atribui à MMGD: ${pctTexto(u.participacao_carga_global_sin_pct, 2, idioma)} em ${mes(u.m, idioma)} quer dizer que, de cada 100 MWh da carga global, cerca de ${numTexto(u.participacao_carga_global_sin_pct, 1, idioma)} MWh vieram da MMGD, segundo a estimativa do ONS.`,
    `Read it as the share of the SIN load that the ONS attributes to MMGD: ${pctTexto(u.participacao_carga_global_sin_pct, 2, idioma)} in ${mes(u.m, idioma)} means that, out of every 100 MWh of the gross load, about ${numTexto(u.participacao_carga_global_sin_pct, 1, idioma)} MWh came from MMGD, according to the ONS estimate.`,
    idioma,
  );
}

/** "46,1 kg de CO2 por MWh": o fator em tCO2/MWh na unidade de menor tamanho (conversão de unidade, sem outra conta). */
export function kgPorMwh(v: number | null | undefined, idioma: Idioma = idiomaEnergia()): string {
  return temValor(v) ? tx(`${num(v * 1000, 1, idioma)} kg de CO2 por MWh`, `${num(v * 1000, 1, idioma)} kg of CO2 per MWh`, idioma) : semDado(idioma);
}

/** P064: o fator médio do último ano completo contra o anterior, na linguagem de toneladas por MWh, e o limite da comparação. */
export function vereditoEmissoes(e: Pick<BlocoEmissoes, "medio_anual" | "ultimo_ano" | "quebras">, idioma: Idioma = idiomaEnergia()): string {
  const ua = e.ultimo_ano;
  if (!ua) return "";
  const ant = e.medio_anual.find((x) => x.ano === ua.ano - 1);
  const dir = comparaArredondado(ua.valor, ant?.valor, 4);
  const q = e.quebras[0];
  const anoQuebra = q ? Number(q.data.slice(0, 4)) : null;
  const atravessa = !!ant && anoQuebra !== null && anoQuebra > ant.ano && anoQuebra <= ua.ano;
  const f = (v: number | null | undefined) => fator(v, idioma);
  const comp =
    dir === null || !ant
      ? ""
      : dir === "igual"
        ? tx(`, igual ao de ${ant.ano}`, `, the same as in ${ant.ano}`, idioma)
        : tx(`, ${dir === "maior" ? "acima" : "abaixo"} dos ${f(ant.valor)} de ${ant.ano}`, `, ${dir === "maior" ? "above" : "below"} the ${f(ant.valor)} of ${ant.ano}`, idioma);
  const limite = atravessa
    ? tx(` A base de usinas do MCTI mudou em ${mes(q!.data, idioma)}, e a comparação mistura bases.`, ` The MCTI plant base changed in ${mes(q!.data, idioma)}, and the comparison mixes bases.`, idioma)
    : tx(" O fator médio não é o efeito de consumir um MWh a mais.", " The average factor is not the effect of consuming one more MWh.", idioma);
  return tx(
    `Em ${ua.ano}, cada MWh gerado no SIN emitiu em média ${f(ua.valor)} tonelada de CO2 (fator do MCTI)${comp}.${limite}`,
    `In ${ua.ano}, each MWh generated in the SIN emitted on average ${f(ua.valor)} tonnes of CO2 (MCTI factor)${comp}.${limite}`,
    idioma,
  );
}

/* ================================================================ abertura (redesenho): dois visuais separados */

/**
 * Conexões por ano dentro da cobertura declarada pela ANEEL (a partir do primeiro ano inteiro coberto), para o gráfico da
 * abertura; os anos anteriores, fora da cobertura, ficam no gráfico e na tabela da página da MMGD no território. Mesmas linhas de
 * `linhasAnual`: só muda quais anos entram.
 */
export function linhasAnualCobertas(m: Pick<BlocoMmgd, "anual" | "data_cadastro" | "controles">, idioma: Idioma = idiomaEnergia()): LinhaAnual[] {
  const primeiro = primeiroAnoCoberto(m.controles.cobertura_das_series.inicio_declarado);
  return linhasAnual(m, idioma).filter((a) => a.ano >= primeiro);
}

/** Frase que acompanha o gráfico de capacidade adicionada: o recorte de anos e o ano parcial, ditos junto da figura. */
export function notaAnosDaCapacidade(m: Pick<BlocoMmgd, "anual" | "data_cadastro" | "controles">, idioma: Idioma = idiomaEnergia()): string {
  const primeiro = primeiroAnoCoberto(m.controles.cobertura_das_series.inicio_declarado);
  const parcial = m.anual.find((a) => a.parcial);
  const ultimo = parcial
    ? tx(
        ` ${parcial.ano} vai só até ${data(m.data_cadastro, idioma)} e não compete com ano completo.`,
        ` ${parcial.ano} only runs through ${data(m.data_cadastro, idioma)} and does not compete with a full year.`,
        idioma,
      )
    : "";
  return tx(
    `Desde ${primeiro}, o primeiro ano inteiro com cobertura declarada pela ANEEL; os anos anteriores estão na página da MMGD no território.${ultimo}`,
    `Since ${primeiro}, the first full year with coverage declared by ANEEL; the earlier years are on the MMGD across the territory page.${ultimo}`,
    idioma,
  );
}

/** Potência e unidades conectadas no ano de referência (o último ano completo), como a resposta e o veredito as leem. */
export function conectadaNoAnoDeReferencia(m: Pick<BlocoMmgd, "anual" | "ano_referencia">): { ano: number; potencia_mw: number | null; unidades: number | null } | null {
  const a = m.anual.find((x) => x.ano === m.ano_referencia);
  return a ? { ano: a.ano, potencia_mw: a.potencia_mw, unidades: a.unidades } : null;
}

/** Anos de início e fim da série anual do fator médio, para dizer o período do gráfico de intensidade junto da figura. */
export function periodoFatorAnual(e: Pick<BlocoEmissoes, "medio_anual">): { inicio: number; fim: number } | null {
  const a = e.medio_anual;
  return a.length ? { inicio: a[0].ano, fim: a[a.length - 1].ano } : null;
}

/**
 * O mesmo mês do ano anterior ao último mês publicado (a sazonalidade é a mesma) e se os dois meses estão na mesma base de usinas:
 * a comparação atravessa a quebra declarada pela fonte quando o mês antigo é anterior a ela e o último é posterior.
 */
export function fatorDoMesmoMesDoAnoAnterior(e: Pick<BlocoEmissoes, "medio_mensal" | "ultimo_mes" | "quebras">): { m: string; valor: number; mesmaBase: boolean } | null {
  const um = e.ultimo_mes;
  if (!um) return null;
  const mAnt = `${Number(um.m.slice(0, 4)) - 1}${um.m.slice(4)}`;
  const ant = e.medio_mensal.find((x) => x.m === mAnt);
  if (!ant) return null;
  const q = e.quebras[0]?.data;
  const atravessa = q ? ant.m < q && um.m >= q : false;
  return { m: ant.m, valor: ant.valor, mesmaBase: !atravessa };
}

/** Fator médio anual do ano anterior ao último ano publicado e se os dois anos estão na mesma base de usinas (a quebra cai entre eles ou no último). */
export function fatorAnualDoAnoAnterior(e: Pick<BlocoEmissoes, "medio_anual" | "ultimo_ano" | "quebras">): { ano: number; valor: number; mesmaBase: boolean } | null {
  const ua = e.ultimo_ano;
  if (!ua) return null;
  const ant = e.medio_anual.find((x) => x.ano === ua.ano - 1);
  if (!ant) return null;
  const q = e.quebras[0];
  const anoQuebra = q ? Number(q.data.slice(0, 4)) : null;
  const atravessa = anoQuebra !== null && anoQuebra > ant.ano && anoQuebra <= ua.ano;
  return { ano: ant.ano, valor: ant.valor, mesmaBase: !atravessa };
}
