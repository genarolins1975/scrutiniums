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
import { campo, tiposUrl } from "./estadoUrl";
import { carimbo, dataBR, mesAno, num, pct, plural } from "./formato";
import { LIMITE_COMPARACAO, type ColunaTabela } from "./tabela";

/* ================================================================ comum */

/**
 * Ausência dentro de frase. O traço de AUSENTE (formato.ts) serve às células de
 * tabela; no meio de um texto ele se leria como pontuação, então as funções de
 * texto deste arquivo dizem "sem dado".
 */
export const SEM_DADO = "sem dado";
const temValor = (v: number | null | undefined): v is number => v !== null && v !== undefined && Number.isFinite(v);

/** "2025-05" → "mai/2025"; ausência → "sem dado". */
export function mes(m: string | null | undefined): string {
  return m ? mesAno(m) : SEM_DADO;
}

/** "2026-09-29" → "29/09/2026"; ausência → "sem dado". */
export function data(iso: string | null | undefined): string {
  return iso ? dataBR(iso) : SEM_DADO;
}

/** Inteiro em pt-BR (unidades, municípios, habitantes); ausência → "sem dado". */
export function inteiro(v: number | null | undefined): string {
  return temValor(v) ? num(v, 0) : SEM_DADO;
}

export function numTexto(v: number | null | undefined, casas = 1): string {
  return temValor(v) ? num(v, casas) : SEM_DADO;
}

export function pctTexto(v: number | null | undefined, casas = 1): string {
  return temValor(v) ? pct(v, casas) : SEM_DADO;
}

/**
 * Contagem com o substantivo concordando com o número publicado ("1 registro", "46
 * registros"): a contagem vem da gold e pode mudar a cada publicação, então a
 * concordância não pode ficar escrita à mão. É o `plural` de formato.ts com a
 * ausência dita em palavras ("sem dado"), para uso dentro de frase.
 */
export function contagem(v: number | null | undefined, um: string, varios: string): string {
  return temValor(v) ? plural(v, um, varios) : SEM_DADO;
}

/** Fator de emissão com as 4 casas publicadas pelo MCTI ("0,0461"); ausência → "sem dado". */
export function fator(v: number | null | undefined): string {
  return temValor(v) ? num(v, 4) : SEM_DADO;
}

/**
 * Participação em % com a regra da gold (regras.participacoes): duas casas; abaixo
 * de 0,01% e diferente de zero, dois algarismos significativos ("0,005%",
 * "0,00097%"), para que uma categoria pequena nunca apareça como zero.
 */
export function participacaoTexto(v: number | null | undefined): string {
  if (!temValor(v)) return SEM_DADO;
  if (v !== 0 && Math.abs(v) < 0.01) {
    const s = Number(v.toPrecision(2)).toLocaleString("pt-BR", { maximumFractionDigits: 12 });
    return `${s}%`;
  }
  return pct(v, 2);
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
  return ra > rb ? "maior" : ra < rb ? "menor" : "igual";
}

/** Lista legível: "a", "a e b", "a, b e c". */
export function listaTexto(itens: readonly string[]): string {
  if (itens.length <= 1) return itens[0] ?? "";
  return `${itens.slice(0, -1).join(", ")} e ${itens.at(-1)}`;
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
export type PainelTransicao = "p063" | "ons" | "p064";

/** Perguntas da estimativa de energia do ONS (parte do P063) e do achado A11, na página da energia estimada. */
export const PERGUNTA_ONS = "Quanta energia a MMGD entrega ao SIN, segundo a estimativa do ONS?";
export const PERGUNTA_A11 = "Quando o ONS passou a incluir a MMGD no Balanço de Energia, o degrau aparece na geração e na carga?";

/**
 * As páginas dos painéis, na ordem das perguntas (a próxima pergunta de cada uma é a
 * seguinte): o P063 em duas (o cadastro da ANEEL no território e a energia estimada
 * pelo ONS, com o achado A11) e o P064. O mapa municipal, as séries, as tabelas e as
 * fichas de prova, juntos numa página, passariam da meta de cerca de 600 KB de HTML
 * por página (contrato, seção 5.1).
 */
export const PAINEIS_TRANSICAO: readonly { id: PainelTransicao; slug: string; rotulo: string; pergunta: string; painel: "P063" | "P064" }[] = [
  { id: "p063", slug: "mmgd", rotulo: "MMGD no território", pergunta: "Onde a geração distribuída cresce?", painel: "P063" },
  { id: "ons", slug: "energia-estimada", rotulo: "Energia estimada (ONS)", pergunta: PERGUNTA_ONS, painel: "P063" },
  { id: "p064", slug: "emissoes", rotulo: "Emissões", pergunta: "Como varia a intensidade de emissões?", painel: "P064" },
];

export function rotaPainel(id: PainelTransicao): string {
  const p = PAINEIS_TRANSICAO.find((x) => x.id === id);
  return p ? `${ROTA_TRANSICAO}/${p.slug}` : ROTA_TRANSICAO;
}

export function perguntaPainel(id: PainelTransicao): string {
  return PAINEIS_TRANSICAO.find((x) => x.id === id)!.pergunta;
}

/**
 * Painel de outro módulo que continua a narrativa das emissões: a matriz efetiva da
 * Geração (P021), com a pergunta do Anexo A. Sem âncora: o P021 é a própria página
 * /setor-eletrico/geracao, e uma âncora interna dela pode mudar quando aquele módulo
 * reorganizar os blocos.
 */
export const LIGACAO_GERACAO = { href: "/setor-eletrico/geracao", pergunta: "Quais fontes atenderam a carga?" } as const;

export const FONTE_ANEEL = "ANEEL, Relação de empreendimentos de Mini e Micro Geração Distribuída; IBGE, Estimativas de população (SIDRA 6579)";
export const FONTE_ANEEL_CADASTRO = "ANEEL, Relação de empreendimentos de Mini e Micro Geração Distribuída";
export const FONTE_ONS = "ONS, Carga de Energia Verificada (parcela de MMGD)";
export const FONTE_MCTI = "MCTI, Fatores de emissão de CO2 da geração de energia elétrica no SIN";

/* ================================================================ P063: MMGD (ANEEL) */

export const MEDIDAS_UF = ["whab", "mw", "umil", "cresc", "mwref"] as const;
export type MedidaUf = (typeof MEDIDAS_UF)[number];

type CampoUf = "w_por_habitante" | "potencia_mw" | "unidades_por_mil_habitantes" | "crescimento_estoque_ano_referencia_pct" | "potencia_mw_ano_referencia";

/** Medidas do mapa e das barras por UF; o ano de referência entra no rótulo pela função `rotuloMedidaUf`. */
export const MEDIDA_UF: Record<MedidaUf, { campo: CampoUf; rotulo: string; unidade: string; casas: number }> = {
  whab: { campo: "w_por_habitante", rotulo: "Potência instalada por habitante", unidade: "W/hab", casas: 1 },
  mw: { campo: "potencia_mw", rotulo: "Potência instalada cadastrada", unidade: "MW", casas: 1 },
  umil: { campo: "unidades_por_mil_habitantes", rotulo: "Unidades por mil habitantes", unidade: "unidades por mil hab.", casas: 2 },
  cresc: { campo: "crescimento_estoque_ano_referencia_pct", rotulo: "Crescimento do estoque no ano", unidade: "%", casas: 1 },
  mwref: { campo: "potencia_mw_ano_referencia", rotulo: "Potência conectada no ano", unidade: "MW", casas: 1 },
};

export function rotuloMedidaUf(med: MedidaUf, anoReferencia: number): string {
  const m = MEDIDA_UF[med];
  return med === "cresc" || med === "mwref" ? `${m.rotulo} (${anoReferencia})` : m.rotulo;
}

export const DIMENSOES_PERFIL = ["classe", "modalidade", "porte", "tipo_consumidor"] as const;
export type DimensaoPerfil = (typeof DIMENSOES_PERFIL)[number];
export const ROTULO_DIMENSAO: Record<DimensaoPerfil, string> = {
  classe: "Classe de consumo",
  modalidade: "Modalidade de compensação",
  porte: "Porte",
  tipo_consumidor: "Tipo de consumidor",
};

export const MEDIDAS_MUN = ["whab", "kw", "cresc", "fora"] as const;
export type MedidaMun = (typeof MEDIDAS_MUN)[number];
export const MEDIDA_MUN: Record<MedidaMun, { rotulo: string; unidade: string; casas: number }> = {
  whab: { rotulo: "Potência instalada por habitante", unidade: "W/hab", casas: 1 },
  kw: { rotulo: "Potência instalada cadastrada", unidade: "kW", casas: 0 },
  cresc: { rotulo: "Crescimento do estoque no ano de referência", unidade: "%", casas: 1 },
  fora: { rotulo: "Unidades de distribuidora sem conjunto elétrico na UF", unidade: "unidades", casas: 0 },
};

export const LISTAS_DESTAQUE = ["maior_crescimento_estoque", "maior_w_por_habitante", "maior_potencia", "menor_w_por_habitante"] as const;
export type ListaDestaque = (typeof LISTAS_DESTAQUE)[number];
export const ROTULO_DESTAQUE: Record<ListaDestaque, string> = {
  maior_crescimento_estoque: "Maior crescimento do estoque no ano de referência",
  maior_w_por_habitante: "Maior potência por habitante",
  maior_potencia: "Maior potência instalada",
  menor_w_por_habitante: "Menor potência por habitante",
};

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
  de: campo(tiposUrl.mes(), "", { param: "mmgd.de" }),
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

export function colunasUfs(anoReferencia: number, anoPopulacao: number | null): ColunaTabela[] {
  return [
    { id: "uf", rotulo: "UF", tipo: "texto" },
    { id: "nome", rotulo: "Nome", tipo: "texto" },
    { id: "unidades", rotulo: "Unidades", tipo: "numero", casas: 0 },
    { id: "potencia_mw", rotulo: "Potência instalada", tipo: "numero", unidade: "MW", casas: 1 },
    { id: "unidades_sem_potencia", rotulo: "Unidades sem potência informada", tipo: "numero", casas: 0 },
    { id: "participacao_potencia_pct", rotulo: "Participação na potência do Brasil", tipo: "percentual", casas: 2 },
    { id: "populacao", rotulo: `População estimada (${anoPopulacao ?? "IBGE"})`, tipo: "numero", casas: 0 },
    { id: "w_por_habitante", rotulo: "Potência por habitante", tipo: "numero", unidade: "W/hab", casas: 1 },
    { id: "unidades_por_mil_habitantes", rotulo: "Unidades por mil habitantes", tipo: "numero", casas: 2 },
    { id: "potencia_mw_ano_referencia", rotulo: `Potência conectada em ${anoReferencia}`, tipo: "numero", unidade: "MW", casas: 1 },
    { id: "crescimento_estoque_ano_referencia_pct", rotulo: `Crescimento do estoque em ${anoReferencia}`, tipo: "percentual", casas: 1 },
    { id: "ucs_recebem_credito", rotulo: "UC que recebem créditos (soma por empreendimento)", tipo: "numero", casas: 0 },
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
export function referenciaUf(wPorHabitanteBrasil: number | null, med: MedidaUf): { valor: number; rotulo: string }[] {
  return med === "whab" && temValor(wPorHabitanteBrasil) ? [{ valor: wPorHabitanteBrasil, rotulo: `Brasil: ${num(wPorHabitanteBrasil, 1)} W/hab` }] : [];
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
function situacaoAno(a: Pick<MmgdAno, "parcial" | "cobertura_declarada">, dataCadastro: string): string {
  if (a.cobertura_declarada === "fora") return "fora da cobertura declarada pela ANEEL (antes de dez/2008)";
  if (a.cobertura_declarada === "parcial") return "cobertura declarada só em dezembro";
  if (a.parcial) return `parcial, até ${dataBR(dataCadastro)}`;
  return "ano completo";
}

/** Conexões por ano (Brasil) e estoque ao fim de cada ano, como publicados; o rótulo marca ano parcial e cobertura. */
export function linhasAnual(m: Pick<BlocoMmgd, "anual" | "data_cadastro">): LinhaAnual[] {
  return m.anual.map((a) => {
    const marca = a.parcial ? " (parcial)" : a.cobertura_declarada ? " (fora da cobertura)" : "";
    return {
      id: String(a.ano),
      ano: a.ano,
      rotulo: `${a.ano}${marca}`,
      unidades: a.unidades,
      potencia_mw: a.potencia_mw,
      acumulado_unidades: a.acumulado_unidades,
      acumulado_mw: a.acumulado_mw,
      situacao: situacaoAno(a, m.data_cadastro),
    };
  });
}

export const COLUNAS_ANUAL: ColunaTabela[] = [
  { id: "ano", rotulo: "Ano de conexão", tipo: "numero", casas: 0, buscavel: true },
  { id: "unidades", rotulo: "Unidades conectadas no ano", tipo: "numero", casas: 0 },
  { id: "potencia_mw", rotulo: "Potência conectada no ano", tipo: "numero", unidade: "MW", casas: 1 },
  { id: "acumulado_unidades", rotulo: "Estoque de unidades ao fim do ano", tipo: "numero", casas: 0 },
  { id: "acumulado_mw", rotulo: "Estoque de potência ao fim do ano", tipo: "numero", unidade: "MW", casas: 1 },
  { id: "situacao", rotulo: "Situação do ano", tipo: "texto", categorica: true },
];

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

export function linhasMensal(mensal: readonly MmgdMes[]) {
  return mensal.map((x) => ({
    id: x.m,
    m: x.m,
    unidades: x.unidades,
    potencia_mw: x.potencia_mw,
    acumulado_unidades: x.acumulado_unidades,
    acumulado_mw: x.acumulado_mw,
    situacao: x.cobertura_declarada === "fora" ? "fora da cobertura declarada" : x.provisorio ? "provisório" : "consolidado",
  }));
}

export const COLUNAS_MENSAL: ColunaTabela[] = [
  { id: "m", rotulo: "Mês de conexão", tipo: "texto" },
  { id: "unidades", rotulo: "Unidades conectadas no mês", tipo: "numero", casas: 0 },
  { id: "potencia_mw", rotulo: "Potência conectada no mês", tipo: "numero", unidade: "MW", casas: 3 },
  { id: "acumulado_unidades", rotulo: "Estoque de unidades ao fim do mês", tipo: "numero", casas: 0 },
  { id: "acumulado_mw", rotulo: "Estoque de potência ao fim do mês", tipo: "numero", unidade: "MW", casas: 3 },
  { id: "situacao", rotulo: "Situação", tipo: "texto", categorica: true },
];

/** Meses provisórios publicados (os posteriores ao corte), do primeiro ao último. */
export function mesesProvisorios(mensal: readonly MmgdMes[]): { primeiro: MmgdMes | null; ultimo: MmgdMes | null; n: number } {
  const p = mensal.filter((x) => x.provisorio);
  return { primeiro: p[0] ?? null, ultimo: p.at(-1) ?? null, n: p.length };
}

/* ---------- fontes e perfis ---------- */

export function linhasFontes(fontes: readonly MmgdFonte[]) {
  return fontes.map((f) => ({
    id: f.fonte,
    rotulo: f.rotulo,
    unidades: f.unidades,
    potencia_mw: f.potencia_mw,
    unidades_sem_potencia: f.unidades_sem_potencia,
    participacao_potencia_pct: f.participacao_potencia_pct,
  }));
}

const ROTULO_CATEGORIA: Record<string, string> = {
  "Geracao na propria UC": "Geração na própria unidade consumidora",
  "Auto consumo remoto": "Autoconsumo remoto",
  Compartilhada: "Geração compartilhada",
  Microgeracao: "Microgeração",
  Minigeracao: "Minigeração",
  PF: "Pessoa física",
  PJ: "Pessoa jurídica",
  nao_informado: "Não informado",
  nao_informada: "Não informada",
};

/** Rótulo legível da categoria publicada (acentos e siglas); a categoria original fica como id. */
export function rotuloCategoria(cat: string): string {
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

export function linhasPerfil(perfis: BlocoMmgd["perfis"], dim: DimensaoPerfil): LinhaPerfil[] {
  return perfis[dim].map((p: MmgdPerfilLinha) => ({
    id: p.categoria,
    rotulo: rotuloCategoria(p.categoria),
    unidades: p.unidades,
    potencia_mw: p.potencia_mw,
    unidades_sem_potencia: p.unidades_sem_potencia,
    participacao_unidades_pct: p.participacao_unidades_pct,
    unidades_ano_referencia: p.unidades_ano_referencia,
    potencia_mw_ano_referencia: p.potencia_mw_ano_referencia,
  }));
}

/* ---------- distribuidoras ---------- */

const ROTULO_CLASSE_CURTO = {
  provavel_municipio_errado: "provável município errado",
  provavel_distribuidora_errada: "provável distribuidora errada",
  indeterminada: "indeterminada",
} as const;

/** "COELBA (15.139.629/0001-94)" quando há sigla; só o CNPJ formatado quando não há. */
export function cnpjFormatado(cnpj: string): string {
  return /^\d{14}$/.test(cnpj) ? `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}` : cnpj;
}

/**
 * Uma linha por distribuidora (CNPJ), só com as colunas da tabela: as props do
 * componente cliente viajam no HTML (contrato, seção 5.1). UF por ano, municípios e
 * a área completa dos conjuntos estão no CSV por distribuidora, UF e ano.
 */
export function linhasDistribuidoras(ds: readonly MmgdDistribuidora[]) {
  return ds.map((d) => {
    const c = d.classes_fora_da_area;
    const classes = c
      ? (Object.keys(ROTULO_CLASSE_CURTO) as (keyof typeof ROTULO_CLASSE_CURTO)[])
          .filter((k) => c[k].unidades > 0)
          .map((k) => `${inteiro(c[k].unidades)} ${ROTULO_CLASSE_CURTO[k]}`)
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
        d.unidades_fora_da_area === null ? "sem referência de área" : d.unidades_fora_da_area === 0 ? "nenhuma unidade fora da área" : classes || "classes indisponíveis",
      aviso_total: d.aviso_total ?? "nenhum",
    };
  });
}

export function colunasDistribuidoras(anoReferencia: number): ColunaTabela[] {
  return [
    { id: "sigla", rotulo: "Distribuidora", tipo: "texto" },
    { id: "nome", rotulo: "Razão social publicada", tipo: "texto" },
    { id: "cnpj", rotulo: "CNPJ", tipo: "texto" },
    { id: "uf_principal", rotulo: "UF principal", tipo: "texto", categorica: true },
    { id: "unidades", rotulo: "Unidades", tipo: "numero", casas: 0 },
    { id: "potencia_mw", rotulo: "Potência instalada", tipo: "numero", unidade: "MW", casas: 1 },
    { id: "unidades_sem_potencia", rotulo: "Unidades sem potência informada", tipo: "numero", casas: 0 },
    { id: "potencia_mw_ano_referencia", rotulo: `Potência conectada em ${anoReferencia}`, tipo: "numero", unidade: "MW", casas: 1 },
    { id: "unidades_fora_da_area", rotulo: "Unidades em UF sem conjunto do CNPJ", tipo: "numero", casas: 0 },
    { id: "classes_fora_da_area", rotulo: "Classes pelo CEP", tipo: "texto" },
    { id: "aviso_total", rotulo: "Aviso sobre o total", tipo: "texto" },
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

const ROTULO_FONTE: Record<string, string> = {
  solar: "solar",
  termica: "termelétrica",
  hidraulica: "hidráulica",
  eolica: "eólica",
  outra: "outra",
  nao_informada: "não informada",
};

/** Linhas do JSON municipal (transicao_municipios.json), pelo nome de cada campo publicado, não pela posição. */
export function municipiosDoJson(arq: Pick<MunicipiosMmgdArquivo, "campos" | "linhas">): MunicipioMmgd[] {
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
    fonte_principal: ROTULO_FONTE[(l[i.fonte_principal] as string | null) ?? ""] ?? "sem unidade",
    unidades_distribuidora_fora_da_uf: n(l, "unidades_distribuidora_fora_da_uf"),
    potencia_kw_distribuidora_fora_da_uf: n(l, "potencia_kw_distribuidora_fora_da_uf"),
    unidades_provavel_municipio_errado: n(l, "unidades_provavel_municipio_errado"),
    potencia_kw_provavel_municipio_errado: n(l, "potencia_kw_provavel_municipio_errado"),
    unidades_provavel_distribuidora_errada: n(l, "unidades_provavel_distribuidora_errada"),
    potencia_kw_provavel_distribuidora_errada: n(l, "potencia_kw_provavel_distribuidora_errada"),
  }));
}

export function colunasMunicipios(anoReferencia: number, anoPopulacao: number | null): ColunaTabela[] {
  return [
    { id: "municipio", rotulo: "Município", tipo: "texto" },
    { id: "uf", rotulo: "UF", tipo: "texto", categorica: true },
    { id: "id", rotulo: "Código IBGE", tipo: "texto" },
    { id: "unidades", rotulo: "Unidades", tipo: "numero", casas: 0 },
    { id: "potencia_kw", rotulo: "Potência instalada", tipo: "numero", unidade: "kW", casas: 2 },
    { id: "unidades_sem_potencia", rotulo: "Unidades sem potência informada", tipo: "numero", casas: 0 },
    { id: "populacao", rotulo: `População estimada (${anoPopulacao ?? "IBGE"})`, tipo: "numero", casas: 0 },
    { id: "w_por_habitante", rotulo: "Potência por habitante", tipo: "numero", unidade: "W/hab", casas: 1 },
    { id: "unidades_por_mil_habitantes", rotulo: "Unidades por mil habitantes", tipo: "numero", casas: 2 },
    { id: "potencia_kw_ano_referencia", rotulo: `Potência conectada em ${anoReferencia}`, tipo: "numero", unidade: "kW", casas: 2 },
    { id: "crescimento_estoque_pct", rotulo: `Crescimento do estoque em ${anoReferencia}`, tipo: "percentual", casas: 1 },
    { id: "fonte_principal", rotulo: "Fonte principal", tipo: "texto", categorica: true },
    { id: "unidades_distribuidora_fora_da_uf", rotulo: "Unidades de distribuidora sem conjunto na UF", tipo: "numero", casas: 0 },
    { id: "unidades_provavel_municipio_errado", rotulo: "Dessas: provável município errado", tipo: "numero", casas: 0 },
    { id: "unidades_provavel_distribuidora_errada", rotulo: "Dessas: provável distribuidora errada", tipo: "numero", casas: 0 },
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
export function respostaMmgd(m: Pick<BlocoMmgd, "data_cadastro" | "ano_referencia" | "resumo" | "anual" | "ufs">): string {
  const r = m.resumo;
  const ref = m.ano_referencia;
  const atual = m.anual.find((a) => a.ano === ref);
  const ant = m.anual.find((a) => a.ano === ref - 1);
  const partes: string[] = [];
  partes.push(
    `Em ${data(m.data_cadastro)}, o cadastro da ANEEL tinha ${inteiro(r.unidades)} unidades de micro e minigeração distribuída, com ${numTexto(r.potencia_mw, 1)} MW de potência instalada (capacidade cadastrada, não energia gerada), ${participacaoTexto(r.participacao_solar_potencia_pct)} dela solar.`,
  );
  if (atual) {
    const dir = comparaArredondado(atual.potencia_mw, ant?.potencia_mw, 1);
    const comp =
      dir === null || !ant
        ? ""
        : dir === "igual"
          ? `, igual aos ${numTexto(ant.potencia_mw, 1)} MW de ${ant.ano}`
          : `, ${dir === "maior" ? "mais" : "menos"} que os ${numTexto(ant.potencia_mw, 1)} MW de ${ant.ano}`;
    partes.push(`Em ${ref}, último ano completo, foram conectados ${numTexto(atual.potencia_mw, 1)} MW em ${inteiro(atual.unidades)} unidades${comp}.`);
  }
  const maisMw = extremo(m.ufs, (u) => u.potencia_mw_ano_referencia, "max");
  const maisCresc = extremo(m.ufs, (u) => u.crescimento_estoque_ano_referencia_pct, "max");
  const maisWhab = extremo(m.ufs, (u) => u.w_por_habitante, "max");
  if (maisMw && maisCresc) {
    partes.push(
      `${maisMw.nome} foi a UF que mais acrescentou potência em ${ref} (${numTexto(maisMw.potencia_mw_ano_referencia, 1)} MW); em proporção do estoque do fim de ${ref - 1}, o maior crescimento foi ${maisCresc.uf === maisMw.uf ? "também o dela" : `o de ${maisCresc.nome}`} (${pctTexto(maisCresc.crescimento_estoque_ano_referencia_pct, 1)}).`,
    );
  }
  if (maisWhab) {
    partes.push(`Por habitante, ${maisWhab.nome} lidera com ${numTexto(maisWhab.w_por_habitante, 1)} W/hab, para ${numTexto(r.w_por_habitante_brasil, 1)} W/hab no Brasil.`);
  }
  return partes.join(" ");
}

/**
 * "O que mudou": os meses provisórios, com os valores publicados do primeiro e do
 * último, a última data de conexão no arquivo e o estado das revisões entre
 * capturas. Não atribui causa à queda dos meses finais (a fonte não informa).
 */
export function mudancaMmgd(m: Pick<BlocoMmgd, "mensal" | "corte_provisorio" | "resumo" | "revisoes">): string {
  const { primeiro, ultimo, n } = mesesProvisorios(m.mensal);
  const partes: string[] = [];
  if (primeiro && ultimo) {
    const dir = comparaArredondado(ultimo.potencia_mw, primeiro.potencia_mw, 1);
    const verbo = dir === "menor" ? "caem" : dir === "maior" ? "sobem" : dir === "igual" ? "ficam iguais" : "variam";
    partes.push(
      `Os ${n} meses depois de ${mes(m.corte_provisorio)} são provisórios: as conexões publicadas ${verbo} de ${numTexto(primeiro.potencia_mw, 1)} MW em ${mes(primeiro.m)} para ${numTexto(ultimo.potencia_mw, 1)} MW em ${mes(ultimo.m)}, e a última data de conexão no arquivo é ${data(m.resumo.ultima_data_conexao)}. Registros desses meses ainda podem entrar nas próximas capturas; a fonte não atribui causa ao movimento, e esta página também não.`,
    );
  }
  const rv = m.revisoes;
  if (rv.capturas_comparadas < 2) partes.push(rv.nota ?? "Ainda não há duas capturas do cadastro para medir revisões.");
  else
    partes.push(
      `Entre as capturas de ${data(rv.primeira_captura)} e ${data(rv.ultima_captura)}, ${inteiro(rv.meses.length)} meses de conexão mudaram de valor (detalhe no modo Auditar).`,
    );
  return partes.join(" ");
}

/**
 * Texto da limitação territorial das modalidades em que o crédito vai para outra
 * unidade, com os números publicados do perfil de modalidade (nenhuma soma nem
 * participação refeita aqui).
 */
export function textoModalidadesRemotas(perfis: BlocoMmgd["perfis"]): string {
  const remoto = perfis.modalidade.find((p) => p.categoria === "Auto consumo remoto");
  const comp = perfis.modalidade.find((p) => p.categoria === "Compartilhada");
  const partes: string[] = [];
  if (remoto) partes.push(`no autoconsumo remoto (${inteiro(remoto.unidades)} unidades, ${numTexto(remoto.potencia_mw, 1)} MW)`);
  if (comp) partes.push(`na geração compartilhada (${inteiro(comp.unidades)} unidades, ${numTexto(comp.potencia_mw, 1)} MW)`);
  if (!partes.length) return "";
  const lista = listaTexto(partes);
  return `${lista.charAt(0).toUpperCase()}${lista.slice(1)}, a energia é compensada em outras unidades, que podem ficar em outro município: o mapa mostra onde a unidade geradora está, não onde o crédito é usado.`;
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
  de: campo(tiposUrl.mes(), "", { param: "ons.de" }),
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

export function linhasOnsMensal(mensal: readonly OnsMmgdMes[]) {
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
    situacao: x.completo ? "mês completo" : "mês incompleto",
    capacidade_aneel_mw: x.capacidade_aneel_mw,
    // estoque de meses depois do corte do cadastro ainda pode crescer: o número vem rotulado
    capacidade_situacao: x.capacidade_aneel_mw === null ? null : x.capacidade_aneel_provisoria ? "provisória (cadastro recente)" : "consolidada",
    razao_estimativa_ons_capacidade_pct: x.razao_estimativa_ons_capacidade_pct,
  }));
}

export const COLUNAS_ONS_MENSAL: ColunaTabela[] = [
  { id: "m", rotulo: "Mês", tipo: "texto" },
  { id: "sin", rotulo: "MMGD estimada, SIN", tipo: "numero", unidade: "MWmed", casas: 1 },
  { id: "SE", rotulo: "SE/CO", tipo: "numero", unidade: "MWmed", casas: 1 },
  { id: "S", rotulo: "Sul", tipo: "numero", unidade: "MWmed", casas: 1 },
  { id: "NE", rotulo: "Nordeste", tipo: "numero", unidade: "MWmed", casas: 1 },
  { id: "N", rotulo: "Norte", tipo: "numero", unidade: "MWmed", casas: 1 },
  { id: "carga_global_sin_mwmed", rotulo: "Carga global, SIN", tipo: "numero", unidade: "MWmed", casas: 0 },
  { id: "participacao_carga_global_sin_pct", rotulo: "MMGD na carga global, SIN", tipo: "percentual", casas: 2 },
  { id: "dias_completos_sin", rotulo: "Dias completos no SIN", tipo: "numero", casas: 0 },
  { id: "dias_no_mes", rotulo: "Dias no mês", tipo: "numero", casas: 0 },
  { id: "situacao", rotulo: "Situação", tipo: "texto", categorica: true },
  { id: "capacidade_aneel_mw", rotulo: "Capacidade cadastrada ANEEL (Brasil, média do estoque no início e no fim do mês)", tipo: "numero", unidade: "MW", casas: 0 },
  { id: "capacidade_situacao", rotulo: "Situação da capacidade", tipo: "texto", categorica: true },
  { id: "razao_estimativa_ons_capacidade_pct", rotulo: "Razão estimativa ÷ capacidade (não é fator de capacidade)", tipo: "percentual", casas: 1 },
];

export function linhasOnsAnual(anual: readonly OnsMmgdAno[]) {
  return anual.map((a) => ({
    id: String(a.ano),
    ano: a.ano,
    rotulo: a.completo ? String(a.ano) : `${a.ano} (incompleto)`,
    mmgd_sin_mwmed: a.mmgd_sin_mwmed,
    mmgd_sin_twh: a.mmgd_sin_twh,
    participacao_carga_global_pct: a.participacao_carga_global_pct,
    dias_completos: a.dias_completos,
    situacao: a.completo ? "ano completo" : "ano incompleto",
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

export function respostaOns(o: Pick<BlocoOnsMmgd, "ultimo_mes_completo" | "anual">): string {
  const u = o.ultimo_mes_completo;
  const anoC = ultimoAnoCompletoOns(o.anual);
  const primeiroC = o.anual.find((a) => a.completo) ?? null;
  const partes: string[] = [];
  if (u) {
    partes.push(
      `No último mês completo (${mes(u.m)}), a MMGD estimada pelo ONS foi de ${numTexto(u.SIN, 1)} MWmed no SIN, ${pctTexto(u.participacao_carga_global_sin_pct, 2)} da carga global.`,
    );
  } else partes.push("Nenhum mês da série do ONS tem os quatro submercados completos nesta publicação.");
  if (anoC) {
    const desde =
      primeiroC && primeiroC.ano !== anoC.ano ? `, contra ${pctTexto(primeiroC.participacao_carga_global_pct, 2)} em ${primeiroC.ano}, primeiro ano completo da série` : "";
    partes.push(
      `Em ${anoC.ano}, último ano completo, foram ${numTexto(anoC.mmgd_sin_mwmed, 0)} MWmed, ou ${numTexto(anoC.mmgd_sin_twh, 2)} TWh, ${pctTexto(anoC.participacao_carga_global_pct, 2)} da carga global${desde}.`,
    );
  }
  partes.push("É uma estimativa publicada pelo ONS, não medição, e não se soma à capacidade cadastrada na ANEEL.");
  return partes.join(" ");
}

/** Último mês com a razão publicada e o motivo da ausência nos meses seguintes. */
export function mudancaOns(o: Pick<BlocoOnsMmgd, "mensal">, corteProvisorio: string): string {
  const r = dadosRazaoCapacidade(o.mensal);
  const ult = r.at(-1);
  if (!ult) return "A razão entre a estimativa do ONS e a capacidade cadastrada não tem nenhum mês publicado nesta versão.";
  return `A razão entre a energia estimada e a capacidade cadastrada foi ${pctTexto(ult.razao, 1)} em ${mes(ult.m)}. Ela fica sem valor nos meses depois de ${mes(corteProvisorio)}, porque o cadastro desses meses é provisório, e em meses incompletos do ONS. Não é fator de capacidade: compara perímetros diferentes (SIN e Brasil).`;
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

export function linhasPares(c: Pick<ConferenciaQuebra2023, "pares_mesmo_dia_da_semana">) {
  return c.pares_mesmo_dia_da_semana.map((p) => ({
    id: p.d,
    d: p.d,
    dia_da_semana: p.dia_da_semana,
    d_comparacao: p.d_comparacao,
    solar_d: p.solar_d,
    solar_comparacao: p.solar_comparacao,
    diferenca_solar: p.diferenca_solar,
    carga_d: p.carga_d,
    carga_comparacao: p.carga_comparacao,
    diferenca_carga: p.diferenca_carga,
    mmgd_ons_d: p.mmgd_ons_d,
    mediana: p.entra_na_mediana ? "entra" : `fora (${p.feriado ?? "feriado"})`,
  }));
}

export const COLUNAS_PARES: ColunaTabela[] = [
  { id: "d", rotulo: "Dia", tipo: "data" },
  { id: "dia_da_semana", rotulo: "Dia da semana", tipo: "texto" },
  { id: "d_comparacao", rotulo: "Comparado com", tipo: "data" },
  { id: "solar_d", rotulo: "Solar no dia", tipo: "numero", unidade: "MWmed", casas: 0 },
  { id: "solar_comparacao", rotulo: "Solar 14 dias antes", tipo: "numero", unidade: "MWmed", casas: 0 },
  { id: "diferenca_solar", rotulo: "Diferença na solar", tipo: "numero", unidade: "MWmed", casas: 0 },
  { id: "carga_d", rotulo: "Carga no dia", tipo: "numero", unidade: "MWmed", casas: 0 },
  { id: "carga_comparacao", rotulo: "Carga 14 dias antes", tipo: "numero", unidade: "MWmed", casas: 0 },
  { id: "diferenca_carga", rotulo: "Diferença na carga", tipo: "numero", unidade: "MWmed", casas: 0 },
  { id: "mmgd_ons_d", rotulo: "MMGD estimada no dia", tipo: "numero", unidade: "MWmed", casas: 0 },
  { id: "mediana", rotulo: "Na mediana", tipo: "texto" },
];

/* ================================================================ P064: emissões (MCTI) */

const leitorAno: Leitor<string> = { ler: (b) => (/^(19|20)\d\d$/.test(b) ? b : undefined), escrever: (v) => v };

/** Estado da página de emissões na URL: intervalo da série mensal e até quatro anos comparados mês a mês. */
export const ESQUEMA_EMISSOES = {
  de: campo(tiposUrl.mes(), "", { param: "em.de" }),
  ate: campo(tiposUrl.mes(), "", { param: "em.ate" }),
  anos: campo(tiposUrl.lista(leitorAno, { max: LIMITE_COMPARACAO }), [] as string[], { param: "em.anos" }),
};

/** Série mensal do fator médio (inventários), como publicada pelo MCTI. */
export function dadosFatorMensal(e: Pick<BlocoEmissoes, "medio_mensal">): { m: string; medio: number }[] {
  return e.medio_mensal.map((x) => ({ m: x.m, medio: x.valor }));
}

export function linhasFatorMensal(e: Pick<BlocoEmissoes, "medio_mensal" | "quebras">) {
  const quebra = e.quebras[0]?.data ?? null;
  return e.medio_mensal.map((x) => ({
    id: x.m,
    m: x.m,
    ano: x.m.slice(0, 4),
    medio: x.valor,
    base: quebra && x.m >= quebra ? `base ampliada (a partir de ${mes(quebra)})` : quebra ? `base anterior a ${mes(quebra)}` : "base única",
  }));
}

export const COLUNAS_FATOR_MENSAL: ColunaTabela[] = [
  { id: "m", rotulo: "Mês", tipo: "texto" },
  { id: "ano", rotulo: "Ano", tipo: "texto", categorica: true },
  { id: "medio", rotulo: "Fator médio (inventários)", tipo: "numero", unidade: "tCO2/MWh", casas: 4 },
  { id: "base", rotulo: "Base de usinas", tipo: "texto", categorica: true },
];

/** Uma linha por ano: fator médio anual e, em colunas separadas e rotuladas, os fatores do MDL e o controle de leitura. */
export function linhasFatorAnual(e: Pick<BlocoEmissoes, "medio_anual" | "margem_construcao_anual" | "margem_operacao_simples_ajustado_anual" | "energia_despachada_mwh" | "anual_x_media_mensal">) {
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
    controle: ctl.has(ano) ? (ctl.get(ano)!.dentro_da_tolerancia ? "dentro da tolerância" : "fora da tolerância (ressalva)") : "sem controle",
    margem_construcao: bm.get(ano) ?? null,
    margem_operacao_simples_ajustado: sa.get(ano) ?? null,
    energia_despachada_mwh: en.get(ano) ?? null,
  }));
}

export const COLUNAS_FATOR_ANUAL: ColunaTabela[] = [
  { id: "ano", rotulo: "Ano", tipo: "numero", casas: 0, buscavel: true },
  { id: "medio", rotulo: "Fator médio anual (inventários)", tipo: "numero", unidade: "tCO2/MWh", casas: 4 },
  { id: "media_simples_meses", rotulo: "Média simples dos 12 meses (controle)", tipo: "numero", unidade: "tCO2/MWh", casas: 5 },
  { id: "controle", rotulo: "Anual × meses", tipo: "texto", categorica: true },
  { id: "margem_construcao", rotulo: "Margem de construção (MDL)", tipo: "numero", unidade: "tCO2/MWh", casas: 4 },
  { id: "margem_operacao_simples_ajustado", rotulo: "Margem de operação, simples ajustado (MDL)", tipo: "numero", unidade: "tCO2/MWh", casas: 4 },
  { id: "energia_despachada_mwh", rotulo: "Energia despachada (simples ajustado)", tipo: "numero", unidade: "MWh", casas: 0 },
];

/** Barras do fator médio anual, uma por ano publicado. */
export function dadosFatorAnual(e: Pick<BlocoEmissoes, "medio_anual">): { id: string; rotulo: string; medio: number }[] {
  return e.medio_anual.map((x) => ({ id: String(x.ano), rotulo: String(x.ano), medio: x.valor }));
}

/** Referência das barras anuais: o último ano completo publicado, para comparar cada ano com ele. */
export function referenciaAnual(e: Pick<BlocoEmissoes, "ultimo_ano">): { valor: number; rotulo: string }[] {
  const u = e.ultimo_ano;
  return u ? [{ valor: u.valor, rotulo: `${u.ano}: ${fator(u.valor)} tCO2/MWh` }] : [];
}

/** Anos com pelo menos um mês do fator médio publicado; no ano corrente, os meses ainda não publicados ficam em branco na comparação. */
export function anosDoFatorMensal(e: Pick<BlocoEmissoes, "medio_mensal">): string[] {
  return Array.from(new Set(e.medio_mensal.map((x) => x.m.slice(0, 4)))).sort();
}

const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/**
 * Perfil mês a mês dos anos escolhidos (até quatro), na mesma escala: x é o mês do
 * ano, uma série por ano. Mês não publicado (ano corrente) fica ausente, nunca zero.
 */
export function dadosPerfilAnos(e: Pick<BlocoEmissoes, "medio_mensal">, anos: readonly string[]): Record<string, string | number | null>[] {
  const v = new Map(e.medio_mensal.map((x) => [x.m, x.valor]));
  return MESES_CURTOS.map((rot, i) => {
    const mm = String(i + 1).padStart(2, "0");
    const l: Record<string, string | number | null> = { mes: rot };
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
export function respostaEmissoes(e: Pick<BlocoEmissoes, "medio_anual" | "ultimo_ano" | "ultimo_mes" | "quebras">): string {
  const ua = e.ultimo_ano;
  const partes: string[] = [];
  if (ua) {
    const ant = e.medio_anual.find((x) => x.ano === ua.ano - 1);
    const dir = comparaArredondado(ua.valor, ant?.valor, 4);
    const comp = dir === null || !ant ? "" : dir === "igual" ? `, igual a ${ant.ano}` : `, ${dir === "maior" ? "acima" : "abaixo"} de ${ant.ano} (${fator(ant.valor)})`;
    partes.push(`Em ${ua.ano}, o fator médio de emissão de CO2 da geração no SIN, publicado pelo MCTI, foi ${fator(ua.valor)} tCO2/MWh${comp}.`);
  } else partes.push("O MCTI não tem fator médio anual publicado nesta versão.");
  if (e.ultimo_mes) partes.push(`No último mês publicado (${mes(e.ultimo_mes.m)}), ${fator(e.ultimo_mes.valor)} tCO2/MWh.`);
  const max = extremo(e.medio_anual, (x) => x.valor, "max");
  const min = extremo(e.medio_anual, (x) => x.valor, "min");
  if (max && min && e.medio_anual.length > 1) {
    partes.push(
      `Na série anual de ${e.medio_anual[0].ano} a ${e.medio_anual.at(-1)!.ano}, o maior valor foi ${fator(max.valor)} (${max.ano}) e o menor, ${fator(min.valor)} (${min.ano}).`,
    );
  }
  const q = e.quebras[0];
  if (q) partes.push(`A partir de ${mes(q.data)}, o MCTI ampliou a base de usinas, com a mesma metodologia: comparações que atravessam essa data misturam bases.`);
  return partes.join(" ");
}

/**
 * "O que mudou": o último mês contra o mesmo mês do ano anterior (sazonalidade
 * igual), com a quebra lembrada quando os dois lados ficam em bases diferentes.
 */
export function mudancaEmissoes(e: Pick<BlocoEmissoes, "medio_mensal" | "ultimo_mes" | "quebras">): string {
  const um = e.ultimo_mes;
  if (!um) return "Sem mês publicado nesta versão.";
  const mAnt = `${Number(um.m.slice(0, 4)) - 1}${um.m.slice(4)}`;
  const ant = e.medio_mensal.find((x) => x.m === mAnt);
  const dir = comparaArredondado(um.valor, ant?.valor, 4);
  const q = e.quebras[0]?.data;
  const atravessa = q && ant ? ant.m < q && um.m >= q : false;
  const base = dir === null || !ant ? `Em ${mes(um.m)}, ${fator(um.valor)} tCO2/MWh; o mesmo mês do ano anterior não tem valor publicado.` : `Em ${mes(um.m)}, ${fator(um.valor)} tCO2/MWh, ${dir === "igual" ? "igual ao" : dir === "maior" ? "acima do" : "abaixo do"} mesmo mês do ano anterior (${fator(ant.valor)} em ${mes(ant.m)}).`;
  return atravessa ? `${base} Os dois meses estão em bases de usinas diferentes (quebra de ${mes(q)}).` : base;
}

/**
 * Estado de acesso à página do MCTI: bloqueio registrado na última tentativa vira
 * aviso de fonte defasada (vale a última captura válida); acesso normal vira só a
 * data. Nunca "em breve": o texto diz o que aconteceu e quando.
 */
export function estadoAcessoMcti(a: BlocoEmissoes["acesso"]): { defasada: boolean; texto: string } {
  if (a.situacao === "bloqueada") {
    return {
      defasada: true,
      texto: `Na última tentativa (${carimbo(a.tentado_em)}), a página do MCTI respondeu com um desafio de verificação humana, que não é contornado. Os valores são da última captura válida (${carimbo(a.ultimo_acesso_ok)}); um mês publicado depois dela ainda não aparece aqui.`,
    };
  }
  if (a.situacao === null) return { defasada: true, texto: "Não há registro de acesso à página do MCTI nesta publicação; os valores vêm das planilhas já capturadas." };
  return { defasada: false, texto: `Página do MCTI acessada em ${carimbo(a.ultimo_acesso_ok)}: ${a.detalhe ?? "listagem lida"}.` };
}

/* ================================================================ síntese */

/** As três grandezas do módulo, que nunca se somam (texto da página de síntese). */
export const GRANDEZAS = [
  {
    nome: "Capacidade cadastrada",
    unidade: "unidades, kW e MW",
    texto: "Potência instalada das unidades de micro e minigeração distribuída no cadastro da ANEEL. Mede capacidade, não energia gerada.",
  },
  {
    nome: "Energia estimada",
    unidade: "MWmed e TWh",
    texto: "Energia de MMGD que o ONS estima para o SIN a cada meia hora. É estimativa da fonte, não medição, e cobre só o SIN.",
  },
  {
    nome: "Fator de emissão",
    unidade: "tCO2/MWh",
    texto: "Toneladas de CO2 por MWh gerado no SIN, calculadas e publicadas pelo MCTI. Só CO2, emissões da operação das usinas.",
  },
] as const;
