/**
 * Lógica pura das páginas da Expansão da oferta e da rede (/setor-eletrico/expansao),
 * sem React e testável em node (src/tests/energia-expansao.test.ts).
 *
 * Por que um arquivo próprio: os componentes "use client" só exportam componentes, e
 * as mesmas linhas precisam alimentar o gráfico, a tabela equivalente e a exportação
 * (seção 11.7 da especificação). Cada função `linhas*` ou `dados*` monta UMA matriz que
 * o gráfico e a tabela recebem iguais; o teste confere essas matrizes contra os CSV
 * publicados pelo pipeline (pipeline/energia/modulos/expansao.py), lidos por outro
 * caminho.
 *
 * O que fica aqui:
 *  - seleção, ordenação e rótulos de números publicados na gold; nenhuma participação,
 *    média, mediana ou soma é refeita (a fórmula roda no pipeline, a interface só lê).
 *    As únicas operações são de apresentação: escolher a linha, ordenar, contar linhas
 *    que cumprem uma condição publicada e converter GW para exibição;
 *  - as respostas curtas e os textos "o que mudou" de cada painel, gerados por regra
 *    determinística a partir dos números publicados (seção 7.4). Nenhuma frase traz
 *    número fixo: todo número vem do argumento, e a ausência vira "sem dado";
 *  - os esquemas de estado na URL (useEstadoUrl), que precisam ser constantes de
 *    módulo, a tabela de códigos de UF do IBGE (o mapa usa o código, a gold a sigla) e a
 *    projeção dos pontos das usinas na grade da malha oficial.
 *
 * Três camadas que nunca se misturam (ver tipos-expansao.ts): realizado (SIGA,
 * liberações comerciais, obras energizadas do SIGET), carteira com previsões (RALIE,
 * sempre com a data da fotografia) e cenário (PDE 2035). MW é potência (não é energia
 * nem garantia física), km é extensão de circuito ou de traçado, MVA é transformação,
 * R$ é dinheiro nominal: campos separados, nunca somados nem divididos entre si.
 */
import type { Download } from "./tipos";
import type {
  CamadaPde,
  ConfiabilidadeFotografia,
  Coorte,
  Desfecho,
  Deslizamento,
  EncerramentosAno,
  Estagio,
  EstagioResumo,
  ExpansaoGold,
  FiguraPde,
  GeracaoERedeUf,
  HistoricoMensalRalie,
  LeilaoAno,
  PontosUsinas,
  SerieAnualExpansao,
  UsinaAtrasada,
} from "./tipos-expansao";
import { campo, tiposUrl } from "./estadoUrl";
import { dataBR, mesAno, num, pct } from "./formato";
import { LIMITE_COMPARACAO, type ColunaTabela } from "./tabela";

/* ================================================================ comum */

/** Ausência dentro de frase: o traço das tabelas se leria como pontuação. */
export const SEM_DADO = "sem dado";

export const temValor = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);

export function inteiro(v: number | null | undefined): string {
  return temValor(v) ? num(v, 0) : SEM_DADO;
}
export function numTexto(v: number | null | undefined, casas = 1): string {
  return temValor(v) ? num(v, casas) : SEM_DADO;
}
export function pctTexto(v: number | null | undefined, casas = 1): string {
  return temValor(v) ? pct(v, casas) : SEM_DADO;
}
/** Potência: "87.267,2 MW". */
export function mwTexto(v: number | null | undefined, casas = 1): string {
  return temValor(v) ? `${num(v, casas)} MW` : SEM_DADO;
}
export function gwTexto(v: number | null | undefined, casas = 1): string {
  return temValor(v) ? `${num(v, casas)} GW` : SEM_DADO;
}
export function kmTexto(v: number | null | undefined, casas = 1): string {
  return temValor(v) ? `${num(v, casas)} km` : SEM_DADO;
}
export function mvaTexto(v: number | null | undefined, casas = 1): string {
  return temValor(v) ? `${num(v, casas)} MVA` : SEM_DADO;
}
/** Dias com sinal tipográfico: "−1.209 dias", "1 dia". */
export function diasTexto(v: number | null | undefined): string {
  if (!temValor(v)) return SEM_DADO;
  const a = Math.round(v);
  return `${num(a, 0)} ${Math.abs(a) === 1 ? "dia" : "dias"}`;
}
/** Data AAAA-MM-DD (ou carimbo) em dd/mm/aaaa; ausência → "sem dado". */
export function dataTexto(iso: string | null | undefined): string {
  return iso ? dataBR(iso) : SEM_DADO;
}
/** "2026-09" ou "2026-09-18" → "set/2026"; ausência → "sem dado". */
export function mesTexto(m: string | null | undefined): string {
  return m && /^\d{4}-\d{2}/.test(m) ? mesAno(m.slice(0, 7)) : SEM_DADO;
}

/** Lista legível: "a", "a e b", "a, b e c". */
export function listaTexto(itens: readonly string[]): string {
  if (itens.length <= 1) return itens[0] ?? "";
  return `${itens.slice(0, -1).join(", ")} e ${itens.at(-1)}`;
}

/**
 * Compara dois valores no arredondamento em que aparecem no texto: "maior", "menor" ou
 * "igual". Ausência em qualquer lado → null (o texto não afirma direção).
 */
export function comparaArredondado(a: number | null | undefined, b: number | null | undefined, casas: number): "maior" | "menor" | "igual" | null {
  if (!temValor(a) || !temValor(b)) return null;
  const f = 10 ** casas;
  const ra = Math.round(a * f);
  const rb = Math.round(b * f);
  return ra > rb ? "maior" : ra < rb ? "menor" : "igual";
}

/** Conversão de unidade para exibição (não é cálculo): MW ÷ 1.000; ausência continua ausência. */
export function emGw(v: number | null | undefined): number | null {
  return temValor(v) ? v / 1000 : null;
}

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
export const NOME_UF: Readonly<Record<string, string>> = {
  RO: "Rondônia", AC: "Acre", AM: "Amazonas", RR: "Roraima", PA: "Pará", AP: "Amapá", TO: "Tocantins",
  MA: "Maranhão", PI: "Piauí", CE: "Ceará", RN: "Rio Grande do Norte", PB: "Paraíba", PE: "Pernambuco", AL: "Alagoas", SE: "Sergipe", BA: "Bahia",
  MG: "Minas Gerais", ES: "Espírito Santo", RJ: "Rio de Janeiro", SP: "São Paulo",
  PR: "Paraná", SC: "Santa Catarina", RS: "Rio Grande do Sul",
  MS: "Mato Grosso do Sul", MT: "Mato Grosso", GO: "Goiás", DF: "Distrito Federal",
};
export function entidadesUf(): { id: string; rotulo: string; sinonimos: string[] }[] {
  return UFS.map((u) => ({ id: u, rotulo: `${NOME_UF[u]} (${u})`, sinonimos: [u] }));
}

/** Nome por extenso do tipo de geração do SIGA (rótulos do dicionário da ANEEL). */
export const NOME_TIPO: Readonly<Record<string, string>> = {
  UHE: "Usina hidrelétrica",
  PCH: "Pequena central hidrelétrica",
  CGH: "Central geradora hidrelétrica",
  EOL: "Central geradora eólica",
  UFV: "Central geradora solar fotovoltaica",
  UTE: "Usina termelétrica",
  UTN: "Usina termonuclear",
  CGU: "Central geradora undi-elétrica",
};
/** Cor de série por tipo de geração: as fontes mantêm a mesma identidade visual do observatório. */
export const COR_TIPO: Readonly<Record<string, string>> = {
  UHE: "var(--serie-hidraulica)",
  PCH: "var(--serie-comp-1)",
  CGH: "var(--serie-comp-2)",
  EOL: "var(--serie-eolica)",
  UFV: "var(--serie-solar)",
  UTE: "var(--serie-termica)",
  UTN: "var(--serie-comp-3)",
  CGU: "var(--serie-comp-4)",
};

/* ================================================================ páginas */

export const ROTA_EXPANSAO = "/setor-eletrico/expansao";
export type PainelExpansao = "p040" | "p041" | "p042" | "p043";
/** As quatro páginas de painel, na ordem das perguntas (a próxima pergunta de cada uma é a seguinte). */
export const PAINEIS_EXPANSAO: readonly { id: PainelExpansao; slug: string; rotulo: string; pergunta: string }[] = [
  { id: "p040", slug: "carteira", rotulo: "Carteira de projetos", pergunta: "O que está planejado e em construção?" },
  { id: "p041", slug: "cronograma", rotulo: "Cronograma e atrasos", pergunta: "Quando deve entrar e o que atrasou?" },
  { id: "p042", slug: "geracao-e-transmissao", rotulo: "Geração e transmissão", pergunta: "A expansão vem acompanhada de rede?" },
  { id: "p043", slug: "cenarios", rotulo: "Cenários oficiais", pergunta: "Como o planejamento enxerga a matriz?" },
];
export function painel(id: PainelExpansao) {
  return PAINEIS_EXPANSAO.find((p) => p.id === id)!;
}
export function rotaPainel(id: PainelExpansao): string {
  return `${ROTA_EXPANSAO}/${painel(id).slug}`;
}
/** Próximo painel na ordem das perguntas (o último volta ao primeiro). */
export function proximoPainel(id: PainelExpansao): PainelExpansao {
  const i = PAINEIS_EXPANSAO.findIndex((p) => p.id === id);
  return PAINEIS_EXPANSAO[(i + 1) % PAINEIS_EXPANSAO.length].id;
}

export const FONTE_SIGA = "ANEEL, SIGA: Sistema de Informações de Geração";
export const FONTE_RALIE = "ANEEL, RALIE: Relatório de Acompanhamento da Expansão da Oferta de Geração";
export const FONTE_ATOS = "ANEEL, Atos de outorgas de geração";
export const FONTE_LIBERACOES = "ANEEL, Liberação para operação comercial";
export const FONTE_SIGET = "ANEEL, SIGET: Sistema de Gestão da Transmissão";
export const FONTE_LEILOES = "ANEEL, Resultado de leilões (transmissão)";
export const FONTE_EPE_REDE = "EPE, WebMap (linhas de transmissão existentes e planejadas)";
export const FONTE_PDE = "EPE e MME, Plano Decenal de Expansão de Energia 2035";

/** Downloads publicados pelo módulo, filtrados pelos endereços de um painel (só os que a gold lista). */
export function downloadsDe(g: Pick<ExpansaoGold, "downloads">, urls: readonly string[]): Download[] {
  return g.downloads.filter((d) => urls.includes(d.url));
}
export const DOWNLOADS_PAINEL: Record<PainelExpansao, readonly string[]> = {
  p040: [
    "/energia/series/expansao_usinas_siga.csv",
    "/energia/series/expansao_carteira_ralie.csv",
    "/energia/series/expansao_trajetorias_ralie.csv",
    "/energia/series/expansao_encerramentos_outorga.csv",
    "/energia/series/expansao_capacidade_uf_fonte.csv",
    "/energia/series/expansao_usinas_pontos.json",
  ],
  p041: [
    "/energia/series/expansao_unidades_ralie.csv",
    "/energia/series/expansao_confiabilidade_previsoes.csv",
    "/energia/series/expansao_liberacoes_anuais.csv",
    "/energia/series/expansao_carteira_ralie.csv",
  ],
  p042: [
    "/energia/series/expansao_leiloes_transmissao.csv",
    "/energia/series/expansao_obras_transmissao.csv",
    "/energia/series/expansao_contratos_transmissao.csv",
    "/energia/series/expansao_rede_epe.json",
  ],
  p043: ["/energia/series/expansao_pde2035.csv", "/energia/series/expansao_capacidade_uf_fonte.csv"],
};

/* ================================================================ P040: carteira */

export function estagio(g: Pick<ExpansaoGold, "estagios">, id: Estagio): EstagioResumo | null {
  return g.estagios.resumo.find((r) => r.estagio === id) ?? null;
}
export function coorteInicial(g: Pick<ExpansaoGold, "estagios">): Coorte | null {
  return g.estagios.coortes.find((c) => c.coorte === "estoque_inicial") ?? null;
}

/**
 * Resposta curta do P040. Regra: estágios do SIGA na data do arquivo (construção e
 * outorgado sem obra em MW outorgado; operação em MW fiscalizado) e, em seguida, o
 * desfecho da coorte da primeira fotografia do RALIE. A abertura "Outorga não é entrada
 * garantida" só aparece quando a gold mostra potência com outorga encerrada ou sem
 * desfecho: a frase é sustentada pelo número que vem depois dela.
 */
export function respostaCarteira(g: Pick<ExpansaoGold, "estagios" | "referencias">): string {
  const op = estagio(g, "operacao");
  const con = estagio(g, "construcao");
  const nao = estagio(g, "construcao_nao_iniciada");
  const partes = [
    `Em ${dataTexto(g.estagios.data_referencia)}, o SIGA da ANEEL registra ${inteiro(con?.usinas)} usinas em construção, com ${mwTexto(con?.mw_outorgado)} outorgados, e ${inteiro(nao?.usinas)} usinas outorgadas com a construção não iniciada, com ${mwTexto(nao?.mw_outorgado)}; em operação são ${inteiro(op?.usinas)} usinas e ${mwTexto(op?.mw_fiscalizado)} fiscalizados.`,
  ];
  const c0 = coorteInicial(g);
  if (c0) {
    const d = c0.desfechos;
    const perda = (temValor(d.outorga_encerrada.pct_mw) && d.outorga_encerrada.pct_mw > 0) || (temValor(d.sem_desfecho.pct_mw) && d.sem_desfecho.pct_mw > 0);
    partes.push(
      `${perda ? "Outorga não é entrada garantida: das" : "Das"} usinas em implantação na primeira fotografia do RALIE (${dataTexto(g.referencias.ralie_historico_desde)}), ${pctTexto(d.operacao.pct_mw)} da potência entrou em operação, ${pctTexto(d.outorga_encerrada.pct_mw)} teve a outorga revogada ou extinta e ${pctTexto(d.em_implantacao.pct_mw)} seguia em implantação em ${dataTexto(g.referencias.ralie)}.`,
    );
  } else {
    partes.push("O desfecho das usinas da primeira fotografia do RALIE não está nesta publicação (sem dado).");
  }
  return partes.join(" ");
}

/**
 * "O que mudou" do P040: carteira do RALIE entre a primeira e a última fotografia mensal
 * (direção decidida no arredondamento exibido) e encerramentos do ano mais recente ao
 * lado do ano anterior, sem palavra de comparação quando o ano mais recente é parcial.
 */
export function mudancaCarteira(g: Pick<ExpansaoGold, "estagios" | "referencias">): string {
  const h = g.estagios.historico_mensal;
  const a = h[0];
  const b = h.at(-1);
  const partes: string[] = [];
  if (a && b) {
    const dir = comparaArredondado(b.mw_ugs, a.mw_ugs, 1);
    const verbo = dir === "maior" ? "subiu" : dir === "menor" ? "caiu" : "ficou igual";
    partes.push(
      `A potência das unidades em implantação no RALIE ${verbo} entre ${mesTexto(a.ralie)} e ${mesTexto(b.ralie)}: de ${mwTexto(a.mw_ugs)} para ${mwTexto(b.mw_ugs)} na última fotografia de cada mês.`,
    );
  }
  const anos = g.estagios.encerramentos.por_ano;
  const ult = anos.at(-1);
  const ant = anos.at(-2);
  if (ult) {
    const parcial = ult.ano_parcial ? ` (ano parcial, atos publicados até ${dataTexto(g.referencias.atos)})` : "";
    const antes = ant ? `; em ${ant.ano}${ant.ano_parcial ? " (parcial)" : ""}, foram ${inteiro(ant.atos)} atos e ${mwTexto(ant.mw_usinas)}` : "";
    partes.push(`Em ${ult.ano}${parcial}, ${inteiro(ult.atos)} atos revogaram ou extinguiram outorgas de ${inteiro(ult.usinas)} usinas, com ${mwTexto(ult.mw_usinas)}${antes}.`);
  }
  return partes.join(" ");
}

/** Etapas do parque: as três fases do SIGA, na ordem do ciclo de vida, com a mesma medida (MW outorgado) para todas. */
export type LinhaEstagio = { id: Estagio; rotulo: string; usinas: number; mw_outorgado: number; mw_fiscalizado: number };
const ORDEM_ESTAGIO: Record<Estagio, number> = { construcao_nao_iniciada: 0, construcao: 1, operacao: 2, outro: 3 };
export function linhasEstagios(g: Pick<ExpansaoGold, "estagios">): LinhaEstagio[] {
  return [...g.estagios.resumo]
    .sort((a, b) => ORDEM_ESTAGIO[a.estagio] - ORDEM_ESTAGIO[b.estagio])
    .map((r) => ({ id: r.estagio, rotulo: r.rotulo, usinas: r.usinas, mw_outorgado: r.mw_outorgado, mw_fiscalizado: r.mw_fiscalizado }));
}
export const COLUNAS_ESTAGIOS: ColunaTabela[] = [
  { id: "rotulo", rotulo: "Estágio (fase no SIGA)", tipo: "texto" },
  { id: "usinas", rotulo: "Usinas", tipo: "numero", casas: 0 },
  { id: "mw_outorgado", rotulo: "Potência outorgada", tipo: "numero", unidade: "MW", casas: 1 },
  { id: "mw_fiscalizado", rotulo: "Potência fiscalizada", tipo: "numero", unidade: "MW", casas: 1 },
];

/** Por tipo de geração: carteira (construção e outorgado sem obra) e operação, em MW outorgado. */
export type LinhaEstagioTipo = {
  id: string;
  nome: string;
  construcao_mw: number;
  nao_iniciada_mw: number;
  operacao_mw: number;
  construcao_usinas: number;
  nao_iniciada_usinas: number;
  operacao_usinas: number;
};
export function linhasEstagiosTipo(g: Pick<ExpansaoGold, "estagios">): LinhaEstagioTipo[] {
  return [...g.estagios.por_tipo]
    .map((t) => ({
      id: t.tipo,
      nome: `${t.nome} (${t.tipo})`,
      construcao_mw: t.construcao_mw_outorgado,
      nao_iniciada_mw: t.construcao_nao_iniciada_mw_outorgado,
      operacao_mw: t.operacao_mw_outorgado,
      construcao_usinas: t.construcao_usinas,
      nao_iniciada_usinas: t.construcao_nao_iniciada_usinas,
      operacao_usinas: t.operacao_usinas,
    }))
    .sort((a, b) => b.construcao_mw + b.nao_iniciada_mw - (a.construcao_mw + a.nao_iniciada_mw));
}
export const COLUNAS_ESTAGIOS_TIPO: ColunaTabela[] = [
  { id: "nome", rotulo: "Tipo de geração", tipo: "texto" },
  { id: "nao_iniciada_usinas", rotulo: "Outorgado sem obra, usinas", tipo: "numero", casas: 0 },
  { id: "nao_iniciada_mw", rotulo: "Outorgado sem obra", tipo: "numero", unidade: "MW outorgado", casas: 1 },
  { id: "construcao_usinas", rotulo: "Em construção, usinas", tipo: "numero", casas: 0 },
  { id: "construcao_mw", rotulo: "Em construção", tipo: "numero", unidade: "MW outorgado", casas: 1 },
  { id: "operacao_usinas", rotulo: "Em operação, usinas", tipo: "numero", casas: 0 },
  { id: "operacao_mw", rotulo: "Em operação", tipo: "numero", unidade: "MW outorgado", casas: 1 },
];

/** Medidas do mapa por UF do P040: as três fases do SIGA e a carteira do RALIE. */
export const MEDIDAS_CARTEIRA = ["nao_iniciada", "construcao", "operacao", "ralie"] as const;
export type MedidaCarteira = (typeof MEDIDAS_CARTEIRA)[number];
export const MEDIDA_CARTEIRA: Record<MedidaCarteira, { rotulo: string; unidade: string; fonte: string }> = {
  nao_iniciada: { rotulo: "Outorgado, construção não iniciada", unidade: "MW outorgado", fonte: FONTE_SIGA },
  construcao: { rotulo: "Em construção", unidade: "MW outorgado", fonte: FONTE_SIGA },
  operacao: { rotulo: "Em operação", unidade: "MW outorgado", fonte: FONTE_SIGA },
  ralie: { rotulo: "Unidades em implantação (RALIE)", unidade: "MW das unidades", fonte: FONTE_RALIE },
};

export type LinhaCarteiraUf = {
  id: string;
  nome: string;
  nao_iniciada_mw: number;
  nao_iniciada_usinas: number;
  construcao_mw: number;
  construcao_usinas: number;
  operacao_mw: number;
  operacao_usinas: number;
  /** MW das unidades em implantação no RALIE (zero observado quando a UF não tem usina no RALIE; null fora da tabela). */
  ralie_mw: number | null;
};
/**
 * Uma linha por UF (as 27 do SIGA). A carteira do RALIE por UF vem de
 * transmissao.geracao_e_rede_por_uf, que publica as 27 UF com zero observado onde o RALIE
 * não tem usina; UF fora daquela tabela fica sem dado (null), nunca zero.
 */
export function linhasCarteiraUf(g: Pick<ExpansaoGold, "estagios" | "transmissao">): LinhaCarteiraUf[] {
  const ralie = new Map(g.transmissao.geracao_e_rede_por_uf.map((u) => [u.uf, u.mw_ugs_em_implantacao]));
  return g.estagios.por_uf
    .map((u) => ({
      id: u.uf,
      nome: NOME_UF[u.uf] ?? u.uf,
      nao_iniciada_mw: u.construcao_nao_iniciada_mw_outorgado,
      nao_iniciada_usinas: u.construcao_nao_iniciada_usinas,
      construcao_mw: u.construcao_mw_outorgado,
      construcao_usinas: u.construcao_usinas,
      operacao_mw: u.operacao_mw_outorgado,
      operacao_usinas: u.operacao_usinas,
      ralie_mw: ralie.has(u.uf) ? (ralie.get(u.uf) as number) : null,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
export const COLUNAS_CARTEIRA_UF: ColunaTabela[] = [
  { id: "nome", rotulo: "UF", tipo: "texto" },
  { id: "id", rotulo: "Sigla", tipo: "texto" },
  { id: "nao_iniciada_mw", rotulo: "Outorgado sem obra", tipo: "numero", unidade: "MW outorgado", casas: 1 },
  { id: "nao_iniciada_usinas", rotulo: "Outorgado sem obra, usinas", tipo: "numero", casas: 0 },
  { id: "construcao_mw", rotulo: "Em construção", tipo: "numero", unidade: "MW outorgado", casas: 1 },
  { id: "construcao_usinas", rotulo: "Em construção, usinas", tipo: "numero", casas: 0 },
  { id: "operacao_mw", rotulo: "Em operação", tipo: "numero", unidade: "MW outorgado", casas: 1 },
  { id: "operacao_usinas", rotulo: "Em operação, usinas", tipo: "numero", casas: 0 },
  { id: "ralie_mw", rotulo: "Unidades em implantação (RALIE)", tipo: "numero", unidade: "MW", casas: 1 },
];
export function valorCarteiraUf(l: LinhaCarteiraUf, m: MedidaCarteira): number | null {
  if (m === "nao_iniciada") return l.nao_iniciada_mw;
  if (m === "construcao") return l.construcao_mw;
  if (m === "operacao") return l.operacao_mw;
  return l.ralie_mw;
}
/** Valores do mapa pelo código IBGE da UF. */
export function valoresMapaCarteira(linhas: readonly LinhaCarteiraUf[], m: MedidaCarteira): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const l of linhas) {
    const c = codigoUf(l.id);
    if (c) out[c] = valorCarteiraUf(l, m);
  }
  return out;
}

/** Estado do P040 na URL: medida e UF do mapa, UF em comparação (até 4), estágios e usina do mapa de pontos. */
const leitorUf = tiposUrl.opcao(UFS);
export const ESTAGIOS_PONTOS = ["construcao_nao_iniciada", "construcao", "operacao"] as const;
export type EstagioPonto = (typeof ESTAGIOS_PONTOS)[number];
export const ESQUEMA_CARTEIRA = {
  med: campo(tiposUrl.opcao(MEDIDAS_CARTEIRA), "nao_iniciada", { param: "car.med" }),
  uf: campo(leitorUf, "", { param: "car.uf" }),
  cmp: campo(tiposUrl.lista(leitorUf, { max: LIMITE_COMPARACAO }), [] as string[], { param: "car.cmp" }),
  pts: campo(tiposUrl.lista(tiposUrl.opcao(ESTAGIOS_PONTOS)), ["construcao_nao_iniciada", "construcao"] as EstagioPonto[], { param: "car.pts" }),
  usina: campo(tiposUrl.inteiro({ min: 1 }), 0, { param: "car.usina" }),
};

/** RALIE: situação da obra × viabilidade (MW das unidades em implantação), com zero onde a combinação não ocorre. */
export const VIABILIDADES = ["Alta", "Média", "Baixa"] as const;
export const OBRAS_RALIE = ["Em andamento", "Paralisada", "Não Iniciada"] as const;
export type LinhaObraViabilidade = { id: string; obra: string; alta: number; media: number; baixa: number; usinas: number; mw_outorgado: number };
/**
 * A gold publica só as combinações que ocorrem (obra_x_viabilidade); como o cruzamento é
 * exaustivo (a soma das usinas é o total do RALIE, conferido no teste), a combinação
 * ausente é zero observado, não falta de dado.
 */
export function linhasObraViabilidade(g: Pick<ExpansaoGold, "estagios">): LinhaObraViabilidade[] {
  const r = g.estagios.ralie;
  const obras = [...OBRAS_RALIE.filter((o) => r.por_obra.some((x) => x.situacao_obra === o)), ...r.por_obra.map((x) => x.situacao_obra).filter((o) => !(OBRAS_RALIE as readonly string[]).includes(o))];
  return obras.map((obra) => {
    const de = (v: string) => r.obra_x_viabilidade.find((x) => x.situacao_obra === obra && x.viabilidade === v)?.mw_ugs_em_implantacao ?? 0;
    const tot = r.por_obra.find((x) => x.situacao_obra === obra);
    return { id: obra, obra, alta: de("Alta"), media: de("Média"), baixa: de("Baixa"), usinas: tot?.usinas ?? 0, mw_outorgado: tot?.mw_outorgado ?? 0 };
  });
}
export const COLUNAS_OBRA_VIABILIDADE: ColunaTabela[] = [
  { id: "obra", rotulo: "Situação da obra", tipo: "texto" },
  { id: "usinas", rotulo: "Usinas", tipo: "numero", casas: 0 },
  { id: "alta", rotulo: "Viabilidade alta", tipo: "numero", unidade: "MW", casas: 1 },
  { id: "media", rotulo: "Viabilidade média", tipo: "numero", unidade: "MW", casas: 1 },
  { id: "baixa", rotulo: "Viabilidade baixa", tipo: "numero", unidade: "MW", casas: 1 },
  { id: "mw_outorgado", rotulo: "Potência outorgada", tipo: "numero", unidade: "MW", casas: 1 },
];

export function linhasJustificativas(g: Pick<ExpansaoGold, "estagios">) {
  return [...g.estagios.ralie.por_justificativa]
    .sort((a, b) => b.mw_ugs_em_implantacao - a.mw_ugs_em_implantacao)
    .map((j) => ({ id: j.justificativa, justificativa: j.justificativa, usinas: j.usinas, mw: j.mw_ugs_em_implantacao, mw_outorgado: j.mw_outorgado }));
}
export const COLUNAS_JUSTIFICATIVAS: ColunaTabela[] = [
  { id: "justificativa", rotulo: "Justificativa da previsão (fiscalização)", tipo: "texto" },
  { id: "usinas", rotulo: "Usinas", tipo: "numero", casas: 0 },
  { id: "mw", rotulo: "Unidades em implantação", tipo: "numero", unidade: "MW", casas: 1 },
  { id: "mw_outorgado", rotulo: "Potência outorgada", tipo: "numero", unidade: "MW", casas: 1 },
];

/** Desfechos na ordem de leitura da barra: o que entrou, o que segue, o que saiu. */
export const DESFECHOS: readonly Desfecho[] = ["operacao", "em_implantacao", "outorga_encerrada", "sem_desfecho"];
export const ROTULO_DESFECHO: Record<Desfecho, string> = {
  operacao: "Entrou em operação",
  em_implantacao: "Segue em implantação",
  outorga_encerrada: "Outorga revogada ou extinta",
  sem_desfecho: "Saiu sem desfecho identificado",
};
export const COR_DESFECHO: Record<Desfecho, string> = {
  operacao: "var(--cor-energia)",
  em_implantacao: "var(--escala-seq-2)",
  outorga_encerrada: "var(--escala-div-neg-1)",
  sem_desfecho: "var(--cor-mineral-soft)",
};
export type LinhaCoorte = {
  id: string;
  rotulo: string;
  usinas: number;
  mw_em_implantacao: number;
  mw_outorgado: number;
  usinas_que_ja_operavam: number;
} & Record<`pct_${Desfecho}`, number | null> &
  Record<`mw_desfecho_${Desfecho}`, number> &
  Record<`usinas_desfecho_${Desfecho}`, number>;
/** Uma linha por coorte (estoque da primeira fotografia e ano de entrada no RALIE), participações publicadas pela gold. */
export function linhasCoortes(g: Pick<ExpansaoGold, "estagios">): LinhaCoorte[] {
  return g.estagios.coortes.map((c) => {
    const l: Record<string, string | number | null> = {
      id: c.coorte,
      rotulo: c.rotulo,
      usinas: c.usinas,
      mw_em_implantacao: c.mw_em_implantacao,
      mw_outorgado: c.mw_outorgado,
      usinas_que_ja_operavam: c.usinas_que_ja_operavam,
    };
    for (const d of DESFECHOS) {
      l[`pct_${d}`] = c.desfechos[d].pct_mw;
      // prefixo próprio: "mw_em_implantacao" já é o peso da coorte inteira
      l[`mw_desfecho_${d}`] = c.desfechos[d].mw_em_implantacao;
      l[`usinas_desfecho_${d}`] = c.desfechos[d].usinas;
    }
    return l as LinhaCoorte;
  });
}
export const COLUNAS_COORTES: ColunaTabela[] = [
  { id: "rotulo", rotulo: "Coorte", tipo: "texto" },
  { id: "usinas", rotulo: "Usinas", tipo: "numero", casas: 0 },
  { id: "mw_em_implantacao", rotulo: "Em implantação na primeira fotografia (peso)", tipo: "numero", unidade: "MW", casas: 1 },
  ...DESFECHOS.map((d): ColunaTabela => ({ id: `pct_${d}`, rotulo: ROTULO_DESFECHO[d], tipo: "percentual", unidade: "% do MW", casas: 1 })),
  ...DESFECHOS.map((d): ColunaTabela => ({ id: `mw_desfecho_${d}`, rotulo: `${ROTULO_DESFECHO[d]}, MW`, tipo: "numero", unidade: "MW", casas: 1 })),
  ...DESFECHOS.map((d): ColunaTabela => ({ id: `usinas_desfecho_${d}`, rotulo: `${ROTULO_DESFECHO[d]}, usinas`, tipo: "numero", casas: 0 })),
  { id: "usinas_que_ja_operavam", rotulo: "Ampliações (já operavam)", tipo: "numero", casas: 0 },
];

/** Série mensal da carteira (última fotografia de cada mês), sem as unidades fora de escala. */
export function dadosHistoricoCarteira(h: readonly HistoricoMensalRalie[]) {
  return h.map((x) => ({
    ralie: x.ralie,
    mw_outorgado: x.mw_outorgado,
    mw_ugs: x.mw_ugs,
    mw_ugs_sem_previsao: x.mw_ugs_sem_previsao,
    obra_nao_iniciada: x.mw_obra_nao_iniciada,
    obra_em_andamento: x.mw_obra_em_andamento,
    obra_paralisada: x.mw_obra_paralisada,
    usinas: x.usinas,
    ugs: x.ugs,
    usinas_atipicas_excluidas: x.usinas_atipicas_excluidas,
    mw_ugs_atipicas_excluidas: x.mw_ugs_atipicas_excluidas,
  }));
}
/** Fotografias mensais com unidades fora de escala excluídas: marcadas no gráfico. */
export function marcosAtipicos(h: readonly HistoricoMensalRalie[]): { x: string; rotulo: string }[] {
  return h.filter((x) => x.usinas_atipicas_excluidas > 0).map((x) => ({ x: x.ralie, rotulo: `${inteiro(x.usinas_atipicas_excluidas)} usinas com unidades fora de escala excluídas` }));
}

/** Encerramentos por ano: potência uma vez por usina; ano parcial marcado no rótulo. */
export function linhasEncerramentos(anos: readonly EncerramentosAno[]) {
  return anos.map((a) => ({
    id: a.ano,
    ano: a.ano_parcial ? `${a.ano} (parcial)` : a.ano,
    atos: a.atos,
    revogacoes: a.revogacoes,
    extincoes: a.extincoes,
    usinas: a.usinas,
    mw_usinas: a.mw_usinas,
    usinas_em_operacao_no_siga: a.usinas_em_operacao_no_siga,
    atos_sem_chave_de_usina: a.atos_sem_chave_de_usina,
  }));
}
export const COLUNAS_ENCERRAMENTOS: ColunaTabela[] = [
  { id: "ano", rotulo: "Ano de publicação", tipo: "texto" },
  { id: "atos", rotulo: "Atos", tipo: "numero", casas: 0 },
  { id: "revogacoes", rotulo: "Revogações", tipo: "numero", casas: 0 },
  { id: "extincoes", rotulo: "Extinções", tipo: "numero", casas: 0 },
  { id: "usinas", rotulo: "Usinas", tipo: "numero", casas: 0 },
  { id: "mw_usinas", rotulo: "Potência das usinas", tipo: "numero", unidade: "MW", casas: 1 },
  { id: "usinas_em_operacao_no_siga", rotulo: "Seguem em operação no SIGA", tipo: "numero", casas: 0 },
  { id: "atos_sem_chave_de_usina", rotulo: "Atos sem chave de usina", tipo: "numero", casas: 0 },
];

/* ---------- pontos das usinas (mapa sob demanda) ---------- */

/**
 * Raio da esfera autálica do GRS80, o mesmo de pipeline/energia/geo.py (R_AUTALICO): é
 * constante geodésica, não dado. O teste confere que a malha publicada declara este raio
 * e que os pontos caem dentro da UF que o SIGA informa.
 */
export const R_AUTALICO_GRS80 = 6371007.181;
export type ProjecaoGeo = {
  paralelos_padrao: number[];
  meridiano_central: number;
  latitude_origem: number;
  unidade_svg_m: number;
  origem_m: [number, number];
};
/**
 * Albers cônica equivalente na esfera autálica, com os parâmetros da malha publicada
 * (public/energia/geo/uf.json, campo projecao), e a mesma grade do SVG (origem e metros
 * por unidade, y para baixo). Devolve coordenadas na grade da malha, sem quantizar.
 */
export function projetaPonto(lon: number, lat: number, p: ProjecaoGeo): [number, number] {
  const rad = Math.PI / 180;
  const [f1, f2] = [p.paralelos_padrao[0] * rad, p.paralelos_padrao[1] * rad];
  const f0 = p.latitude_origem * rad;
  const n = (Math.sin(f1) + Math.sin(f2)) / 2;
  const c = Math.cos(f1) ** 2 + 2 * n * Math.sin(f1);
  const rho0 = (R_AUTALICO_GRS80 * Math.sqrt(c - 2 * n * Math.sin(f0))) / n;
  const rho = (R_AUTALICO_GRS80 * Math.sqrt(c - 2 * n * Math.sin(lat * rad))) / n;
  const teta = n * (lon - p.meridiano_central) * rad;
  const x = rho * Math.sin(teta);
  const y = rho0 - rho * Math.cos(teta);
  return [(x - p.origem_m[0]) / p.unidade_svg_m, (p.origem_m[1] - y) / p.unidade_svg_m];
}

export type UsinaPonto = {
  nucleo: number;
  nome: string | null;
  tipo: string | null;
  estagio: Estagio;
  uf: string | null;
  mw_outorgado: number | null;
  mw_fiscalizado: number | null;
  x: number;
  y: number;
};
/** Linhas do JSON de pontos, projetadas na grade da malha; filtro por estágio. */
export function pontosDoJson(j: PontosUsinas, p: ProjecaoGeo, estagios: readonly Estagio[]): UsinaPonto[] {
  const quer = new Set(estagios);
  const out: UsinaPonto[] = [];
  for (const [nucleo, nome, tipo, est, uf, mwo, mwf, lat, lon] of j.linhas) {
    if (!quer.has(est)) continue;
    const [x, y] = projetaPonto(lon, lat, p);
    out.push({ nucleo, nome, tipo, estagio: est, uf, mw_outorgado: mwo, mw_fiscalizado: mwf, x, y });
  }
  return out;
}
/** Classe de tamanho do ponto pela potência outorgada (marca, não escala de área). */
export const CLASSES_PONTO = [
  { ate: 30, raio: 1, rotulo: "até 30 MW" },
  { ate: 300, raio: 2, rotulo: "mais de 30 até 300 MW" },
  { ate: Infinity, raio: 3.5, rotulo: "mais de 300 MW" },
] as const;
export function classePonto(mw: number | null): number {
  if (!temValor(mw)) return 0;
  const i = CLASSES_PONTO.findIndex((c) => mw <= c.ate);
  return i < 0 ? CLASSES_PONTO.length - 1 : i;
}
export const ROTULO_ESTAGIO: Record<Estagio, string> = {
  construcao_nao_iniciada: "Outorgado, construção não iniciada",
  construcao: "Em construção",
  operacao: "Em operação",
  outro: "Outra fase",
};
export const COLUNAS_PONTOS: ColunaTabela[] = [
  { id: "nome", rotulo: "Usina", tipo: "texto" },
  { id: "nucleo", rotulo: "Núcleo do CEG", tipo: "numero", casas: 0, buscavel: true },
  { id: "tipo", rotulo: "Tipo", tipo: "texto", categorica: true },
  { id: "estagio", rotulo: "Estágio", tipo: "texto", categorica: true },
  { id: "uf", rotulo: "UF", tipo: "texto", categorica: true },
  { id: "mw_outorgado", rotulo: "Potência outorgada", tipo: "numero", unidade: "MW", casas: 1 },
  { id: "mw_fiscalizado", rotulo: "Potência fiscalizada", tipo: "numero", unidade: "MW", casas: 1 },
];
export function linhasPontos(pts: readonly UsinaPonto[]) {
  return pts.map((p) => ({
    id: String(p.nucleo),
    nome: p.nome,
    nucleo: p.nucleo,
    tipo: p.tipo,
    estagio: ROTULO_ESTAGIO[p.estagio],
    uf: p.uf,
    mw_outorgado: p.mw_outorgado,
    mw_fiscalizado: p.mw_fiscalizado,
  }));
}

/* ================================================================ P041: cronograma */

export function ultimaConfiabilidade(g: Pick<ExpansaoGold, "cronograma">): ConfiabilidadeFotografia | null {
  return [...g.cronograma.confiabilidade].sort((a, b) => a.ralie.localeCompare(b.ralie)).at(-1) ?? null;
}
export function ultimoDeslizamento(g: Pick<ExpansaoGold, "cronograma">): Deslizamento | null {
  return [...g.cronograma.deslizamento].sort((a, b) => a.ralie.localeCompare(b.ralie)).at(-1) ?? null;
}

/**
 * Resposta curta do P041. Regra: previsões da fotografia atual nos dois primeiros anos
 * (o ano da fotografia é "o restante do ano"), a potência em datas convencionais em
 * bloco, a confiabilidade da janela mais recente encerrada e as usinas que a própria
 * fiscalização classifica como atrasadas. Toda previsão sai com a data da fotografia.
 */
export function respostaCronograma(g: Pick<ExpansaoGold, "cronograma">): string {
  const pa = g.cronograma.previsoes_atuais;
  const anoFoto = pa.data_ralie.slice(0, 4);
  const anos = [...pa.por_ano].sort((a, b) => a.ano.localeCompare(b.ano)).slice(0, 2);
  const quando = anos.map((a) => `${mwTexto(a.mw)} ${a.ano === anoFoto ? `no restante de ${a.ano}` : `em ${a.ano}`}`);
  const partes = [
    `Na fotografia do RALIE de ${dataTexto(pa.data_ralie)}, a fiscalização da ANEEL prevê a entrada em operação comercial de ${quando.length ? listaTexto(quando) : SEM_DADO}.`,
  ];
  const b = pa.datas_em_bloco;
  if (b && b.datas.length) {
    partes.push(`Outros ${mwTexto(b.mw)} têm previsão numa data convencional atribuída em bloco (${listaTexto(b.datas.map(dataTexto))}), que não é cronograma de obra.`);
  }
  const c = ultimaConfiabilidade(g);
  if (c) {
    partes.push(
      `Do que a fotografia de ${dataTexto(c.ralie)} previa para os 12 meses seguintes, ${pctTexto(c.pct_no_prazo)} da potência foi liberada para operação comercial no prazo, ${pctTexto(c.pct_depois)} depois e ${pctTexto(c.pct_nao_liberado)} não tinha sido liberada até ${dataTexto(g.cronograma.data_liberacoes)}.`,
    );
  }
  const at = g.cronograma.por_situacao_cronograma.find((s) => s.situacao === "Atrasado");
  if (at) partes.push(`A fiscalização classifica ${inteiro(at.usinas)} usinas, com ${mwTexto(at.mw_outorgado)} outorgados, com cronograma atrasado.`);
  return partes.join(" ");
}

/** "O que mudou" do P041: revisão das previsões entre fotografias com 12 meses de distância, com e sem as datas em bloco. */
export function mudancaCronograma(g: Pick<ExpansaoGold, "cronograma">): string {
  const d = ultimoDeslizamento(g);
  if (!d) return "Sem pares de fotografias com 12 meses de distância nesta publicação (sem dado).";
  const s = d.sem_datas_em_bloco;
  return `Entre as fotografias de ${dataTexto(d.ralie)} e ${dataTexto(d.ralie_seguinte)}, ${pctTexto(d.pct_adiada)} da potência que seguia em implantação teve a previsão adiada, ${pctTexto(d.pct_mantida)} manteve e ${pctTexto(d.pct_antecipada)} antecipou (mediana ponderada de ${diasTexto(d.mediana_dias_ponderada)}). Sem as unidades em data em bloco, que andam com a fotografia, as parcelas são ${pctTexto(s.pct_adiada)}, ${pctTexto(s.pct_mantida)} e ${pctTexto(s.pct_antecipada)} (mediana de ${diasTexto(s.mediana_dias_ponderada)}).`;
}

/** Viabilidade na URL sem acento; o rótulo é o da fonte. */
export const IDS_VIABILIDADE = ["alta", "media", "baixa"] as const;
export type IdViabilidade = (typeof IDS_VIABILIDADE)[number];
export const VIABILIDADE_DO_ID: Record<IdViabilidade, (typeof VIABILIDADES)[number]> = { alta: "Alta", media: "Média", baixa: "Baixa" };
export const COR_VIABILIDADE: Record<IdViabilidade, string> = {
  alta: "var(--escala-seq-5)",
  media: "var(--escala-seq-3)",
  baixa: "var(--escala-seq-1)",
};
export const ESQUEMA_CRONOGRAMA = {
  via: campo(tiposUrl.lista(tiposUrl.opcao(IDS_VIABILIDADE)), [...IDS_VIABILIDADE] as IdViabilidade[], { param: "cro.via" }),
  bloco: campo(tiposUrl.opcao(["com", "sem"] as const), "com", { param: "cro.bloco" }),
  de: campo(tiposUrl.data(), "", { param: "cro.de" }),
  ate: campo(tiposUrl.data(), "", { param: "cro.ate" }),
};

/** Previsões por ano: uma coluna por viabilidade (MW das unidades), na ordem dos anos. */
export function linhasPrevisoesAno(g: Pick<ExpansaoGold, "cronograma">) {
  return [...g.cronograma.previsoes_atuais.por_ano]
    .sort((a, b) => a.ano.localeCompare(b.ano))
    .map((a) => ({ id: a.ano, ano: a.ano, ugs: a.ugs, mw: a.mw, alta: a.por_viabilidade.Alta, media: a.por_viabilidade["Média"], baixa: a.por_viabilidade.Baixa }));
}
export function linhasProximos24(g: Pick<ExpansaoGold, "cronograma">) {
  return [...g.cronograma.previsoes_atuais.proximos_24_meses]
    .sort((a, b) => a.mes.localeCompare(b.mes))
    .map((m) => ({ id: m.mes, mes: mesTexto(m.mes), mw: m.mw, alta: m.por_viabilidade.Alta, media: m.por_viabilidade["Média"], baixa: m.por_viabilidade.Baixa }));
}
export const COLUNAS_PREVISOES_ANO: ColunaTabela[] = [
  { id: "ano", rotulo: "Ano previsto", tipo: "texto" },
  { id: "ugs", rotulo: "Unidades geradoras", tipo: "numero", casas: 0 },
  { id: "mw", rotulo: "Potência prevista", tipo: "numero", unidade: "MW", casas: 1 },
  { id: "alta", rotulo: "Viabilidade alta", tipo: "numero", unidade: "MW", casas: 1 },
  { id: "media", rotulo: "Viabilidade média", tipo: "numero", unidade: "MW", casas: 1 },
  { id: "baixa", rotulo: "Viabilidade baixa", tipo: "numero", unidade: "MW", casas: 1 },
];

/** Datas mais frequentes, com a marca de data em bloco publicada pela gold. */
export function linhasDatasFrequentes(g: Pick<ExpansaoGold, "cronograma">) {
  return g.cronograma.previsoes_atuais.datas_mais_frequentes.map((d) => ({
    id: d.data,
    data: d.data,
    usinas: d.usinas,
    ugs: d.ugs,
    mw: d.mw,
    em_bloco: d.em_bloco ? "sim" : "não",
  }));
}
export const COLUNAS_DATAS_FREQUENTES: ColunaTabela[] = [
  { id: "data", rotulo: "Data prevista", tipo: "data" },
  { id: "usinas", rotulo: "Usinas", tipo: "numero", casas: 0 },
  { id: "ugs", rotulo: "Unidades", tipo: "numero", casas: 0 },
  { id: "mw", rotulo: "Potência", tipo: "numero", unidade: "MW", casas: 1 },
  { id: "em_bloco", rotulo: "Data em bloco", tipo: "texto", categorica: true },
];

export function linhasSemPrevisao(g: Pick<ExpansaoGold, "cronograma">) {
  return [...g.cronograma.previsoes_atuais.sem_previsao].sort((a, b) => b.mw - a.mw).map((s) => ({ id: s.justificativa, justificativa: s.justificativa, ugs: s.ugs, mw: s.mw }));
}
export const COLUNAS_SEM_PREVISAO: ColunaTabela[] = [
  { id: "justificativa", rotulo: "Justificativa da fiscalização", tipo: "texto" },
  { id: "ugs", rotulo: "Unidades", tipo: "numero", casas: 0 },
  { id: "mw", rotulo: "Potência", tipo: "numero", unidade: "MW", casas: 1 },
];

/** Confiabilidade por fotografia mensal: participações publicadas e as potências que as formam. */
export function linhasConfiabilidade(g: Pick<ExpansaoGold, "cronograma">) {
  return [...g.cronograma.confiabilidade]
    .sort((a, b) => a.ralie.localeCompare(b.ralie))
    .map((c) => ({
      id: c.ralie,
      ralie: c.ralie,
      fim_janela: c.fim_janela,
      ugs: c.ugs,
      mw_prometido: c.mw_prometido,
      mw_no_prazo: c.mw_no_prazo,
      mw_depois: c.mw_depois,
      mw_nao_liberado: c.mw_nao_liberado,
      pct_no_prazo: c.pct_no_prazo,
      pct_depois: c.pct_depois,
      pct_nao_liberado: c.pct_nao_liberado,
    }));
}
export const COLUNAS_CONFIABILIDADE: ColunaTabela[] = [
  { id: "ralie", rotulo: "Fotografia (data-base)", tipo: "data" },
  { id: "fim_janela", rotulo: "Fim da janela", tipo: "data" },
  { id: "ugs", rotulo: "Unidades", tipo: "numero", casas: 0 },
  { id: "mw_prometido", rotulo: "Previsto para 12 meses", tipo: "numero", unidade: "MW", casas: 1 },
  { id: "mw_no_prazo", rotulo: "Liberado no prazo", tipo: "numero", unidade: "MW", casas: 1 },
  { id: "mw_depois", rotulo: "Liberado depois", tipo: "numero", unidade: "MW", casas: 1 },
  { id: "mw_nao_liberado", rotulo: "Não liberado", tipo: "numero", unidade: "MW", casas: 1 },
  { id: "pct_no_prazo", rotulo: "No prazo", tipo: "percentual", casas: 1 },
  { id: "pct_depois", rotulo: "Depois", tipo: "percentual", casas: 1 },
  { id: "pct_nao_liberado", rotulo: "Não liberado", tipo: "percentual", casas: 1 },
];
export function linhasConfiabilidadeTipo(g: Pick<ExpansaoGold, "cronograma">) {
  return [...g.cronograma.confiabilidade_ultima_por_tipo]
    .sort((a, b) => b.mw_prometido - a.mw_prometido)
    .map((t) => ({ id: t.tipo, tipo: `${NOME_TIPO[t.tipo] ?? t.tipo} (${t.tipo})`, mw_prometido: t.mw_prometido, mw_no_prazo: t.mw_no_prazo, pct_no_prazo: t.pct_no_prazo }));
}

/** Revisão das previsões entre fotografias com 12 meses de distância; "sem" tira as unidades em data em bloco. */
export function linhasDeslizamento(g: Pick<ExpansaoGold, "cronograma">, bloco: "com" | "sem") {
  return [...g.cronograma.deslizamento]
    .sort((a, b) => a.ralie.localeCompare(b.ralie))
    .map((d) => {
      const v = bloco === "com" ? d : d.sem_datas_em_bloco;
      return {
        id: d.ralie,
        ralie: d.ralie,
        ralie_seguinte: d.ralie_seguinte,
        ugs: v.ugs,
        mw: v.mw,
        pct_adiada: v.pct_adiada,
        pct_mantida: v.pct_mantida,
        pct_antecipada: v.pct_antecipada,
        mediana_dias: v.mediana_dias_ponderada,
        pct_mw_em_data_em_bloco: d.pct_mw_em_data_em_bloco,
      };
    });
}
export const COLUNAS_DESLIZAMENTO: ColunaTabela[] = [
  { id: "ralie", rotulo: "Fotografia S", tipo: "data" },
  { id: "ralie_seguinte", rotulo: "Fotografia S + 12 meses", tipo: "data" },
  { id: "ugs", rotulo: "Unidades nas duas", tipo: "numero", casas: 0 },
  { id: "mw", rotulo: "Potência", tipo: "numero", unidade: "MW", casas: 1 },
  { id: "pct_adiada", rotulo: "Adiada", tipo: "percentual", casas: 1 },
  { id: "pct_mantida", rotulo: "Mantida", tipo: "percentual", casas: 1 },
  { id: "pct_antecipada", rotulo: "Antecipada", tipo: "percentual", casas: 1 },
  { id: "mediana_dias", rotulo: "Mediana ponderada da revisão", tipo: "numero", unidade: "dias", casas: 0 },
  { id: "pct_mw_em_data_em_bloco", rotulo: "Potência em data em bloco (S ou S + 12)", tipo: "percentual", casas: 1 },
];

/** Desvio da liberação comercial em relação ao prazo outorgado vigente, por ano (não é atraso). */
export function linhasDesvioPrazo(g: Pick<ExpansaoGold, "cronograma">) {
  return g.cronograma.desvio_prazo_vigente.por_ano.map((a) => ({
    id: a.ano,
    ano: a.ano_parcial ? `${a.ano} (parcial)` : a.ano,
    unidades: a.unidades_ou_grupos,
    mw_liberado: a.mw_liberado,
    mw_com_data_outorgada: a.mw_com_data_outorgada,
    mw_sem_data_outorgada: a.mw_sem_data_outorgada,
    pct_depois: a.pct_mw_depois_do_prazo,
    pct_antes: a.pct_mw_antes_do_prazo,
    mediana_dias: a.mediana_desvio_dias_ponderada,
  }));
}
export const COLUNAS_DESVIO_PRAZO: ColunaTabela[] = [
  { id: "ano", rotulo: "Ano da liberação", tipo: "texto" },
  { id: "unidades", rotulo: "Unidades ou grupos", tipo: "numero", casas: 0 },
  { id: "mw_liberado", rotulo: "Liberado", tipo: "numero", unidade: "MW", casas: 1 },
  { id: "mw_com_data_outorgada", rotulo: "Com data outorgada (denominador)", tipo: "numero", unidade: "MW", casas: 1 },
  { id: "mw_sem_data_outorgada", rotulo: "Sem data outorgada", tipo: "numero", unidade: "MW", casas: 1 },
  { id: "pct_depois", rotulo: "Depois do prazo vigente", tipo: "percentual", casas: 1 },
  { id: "pct_antes", rotulo: "Antes do prazo vigente", tipo: "percentual", casas: 1 },
  { id: "mediana_dias", rotulo: "Mediana ponderada do desvio", tipo: "numero", unidade: "dias", casas: 0 },
];

/** Maiores usinas atrasadas, com a marca de previsão em data em bloco (a "previsão" é a data convencional). */
export function linhasAtrasadas(g: Pick<ExpansaoGold, "cronograma">) {
  const bloco = new Set(g.cronograma.previsoes_atuais.datas_em_bloco.datas);
  return g.cronograma.maiores_atrasadas.map((u: UsinaAtrasada) => ({
    id: String(u.nucleo),
    nome: u.nome,
    tipo: u.tipo,
    uf: u.uf,
    mw_outorgado: u.mw_outorgado,
    situacao_obra: u.situacao_obra,
    viabilidade: u.viabilidade,
    justificativa: u.justificativa,
    outorgado_max: u.outorgado_max,
    previsao_max: u.previsao_max,
    previsao_em_bloco: u.previsao_max === null ? null : bloco.has(u.previsao_max) ? "sim" : "não",
    atraso_previsto_dias: u.atraso_previsto_dias,
  }));
}
export const COLUNAS_ATRASADAS: ColunaTabela[] = [
  { id: "nome", rotulo: "Usina", tipo: "texto" },
  { id: "tipo", rotulo: "Tipo", tipo: "texto", categorica: true },
  { id: "uf", rotulo: "UF", tipo: "texto", categorica: true },
  { id: "mw_outorgado", rotulo: "Potência outorgada", tipo: "numero", unidade: "MW", casas: 1 },
  { id: "situacao_obra", rotulo: "Obra", tipo: "texto", categorica: true },
  { id: "viabilidade", rotulo: "Viabilidade", tipo: "texto", categorica: true },
  { id: "justificativa", rotulo: "Justificativa", tipo: "texto" },
  { id: "outorgado_max", rotulo: "Data outorgada (última unidade)", tipo: "data" },
  { id: "previsao_max", rotulo: "Previsão da fiscalização (última unidade)", tipo: "data" },
  { id: "previsao_em_bloco", rotulo: "Previsão em data em bloco", tipo: "texto", categorica: true },
  { id: "atraso_previsto_dias", rotulo: "Previsão menos data outorgada", tipo: "numero", unidade: "dias", casas: 0 },
];

/* ================================================================ P042: geração e transmissão */

/**
 * Resposta curta do P042. Regra: obras de transmissão em andamento no SIGET (km de
 * circuito e MVA novos), geração em implantação no RALIE e, para as três UF com mais
 * geração em implantação, os km de linhas em obra que tocam a UF, lado a lado. As
 * grandezas não se somam nem se dividem; a frase final diz por quê.
 */
export function respostaTransmissao(g: Pick<ExpansaoGold, "transmissao" | "estagios">): string {
  const o = g.transmissao.obras;
  const r = g.estagios.ralie;
  const top = [...g.transmissao.geracao_e_rede_por_uf]
    .filter((u) => temValor(u.mw_ugs_em_implantacao))
    .sort((a, b) => b.mw_ugs_em_implantacao - a.mw_ugs_em_implantacao)
    .slice(0, 3);
  const partes = [
    `Em ${dataTexto(o.data_referencia)}, o SIGET da ANEEL registra ${inteiro(o.em_andamento.empreendimentos)} empreendimentos de transmissão em andamento, com ${kmTexto(o.em_andamento.km_lt_novas)} de circuito em linhas novas e ${mvaTexto(o.em_andamento.mva_tr_novos)} de transformação nova; o RALIE acompanha ${mwTexto(r.mw_ugs_em_implantacao)} de geração em implantação (fotografia de ${dataTexto(r.data_ralie)}).`,
  ];
  if (top.length) {
    partes.push(
      `Nas ${top.length === 1 ? "UF" : `${top.length} UF`} com mais geração em implantação, ${listaTexto(top.map((u) => `${NOME_UF[u.uf] ?? u.uf} tem ${mwTexto(u.mw_ugs_em_implantacao)} de geração e ${kmTexto(u.km_lt_em_andamento_toca_uf)} de linhas em obra que tocam a UF`))}.`,
    );
  }
  partes.push("MW, km e MVA não se somam nem se dividem: a capacidade de escoar a geração depende da topologia e dos limites da rede, que esses totais não descrevem.");
  return partes.join(" ");
}

/** "O que mudou" do P042: último ano completo e ano parcial da série anual, e o fim do arquivo aberto de leilões. */
export function mudancaTransmissao(g: Pick<ExpansaoGold, "transmissao">): string {
  const s = [...g.transmissao.serie_anual].sort((a, b) => a.ano.localeCompare(b.ano));
  const completo = [...s].reverse().find((x) => !x.ano_parcial);
  const parcial = s.at(-1)?.ano_parcial ? s.at(-1) : undefined;
  const partes: string[] = [];
  if (completo) {
    partes.push(
      `Em ${completo.ano}, foram liberados ${mwTexto(completo.mw_geracao_liberada)} de geração para operação comercial e energizados ${kmTexto(completo.km_lt_energizados)} de linhas novas e ${mvaTexto(completo.mva_tr_energizados)} de transformação.`,
    );
  }
  if (parcial) {
    partes.push(`Em ${parcial.ano}, ano parcial, já são ${mwTexto(parcial.mw_geracao_liberada)}, ${kmTexto(parcial.km_lt_energizados)} e ${mvaTexto(parcial.mva_tr_energizados)}.`);
  }
  const u = g.transmissao.leiloes.ultimo_leilao;
  if (u.leilao) {
    const ausentes = s.filter((x) => x.ano > (u.data ?? "").slice(0, 4) && x.km_contratados_leilao === null).map((x) => x.ano);
    partes.push(
      `O arquivo aberto de leilões de transmissão termina no leilão ${u.leilao} (${dataTexto(u.data)})${ausentes.length ? `: ${listaTexto(ausentes)} ${ausentes.length === 1 ? "aparece" : "aparecem"} como ausência, não como ${ausentes.length === 1 ? "ano" : "anos"} sem leilão` : ""}.`,
    );
  }
  return partes.join(" ");
}

/** Medidas do mapa por UF do P042: cada uma na sua unidade; nunca combinadas. */
export const MEDIDAS_REDE = ["mw_impl", "mw_24m", "km_obra", "mva_obra", "km_epe", "km_epe_plan"] as const;
export type MedidaRede = (typeof MEDIDAS_REDE)[number];
export const MEDIDA_REDE: Record<MedidaRede, { rotulo: string; unidade: string; campo: keyof GeracaoERedeUf; fonte: string; casas: number }> = {
  mw_impl: { rotulo: "Geração em implantação (RALIE)", unidade: "MW", campo: "mw_ugs_em_implantacao", fonte: FONTE_RALIE, casas: 1 },
  mw_24m: { rotulo: "Geração prevista para os próximos 24 meses (RALIE)", unidade: "MW", campo: "mw_previsto_24_meses", fonte: FONTE_RALIE, casas: 1 },
  km_obra: { rotulo: "Linhas novas em obra que tocam a UF (SIGET)", unidade: "km de circuito", campo: "km_lt_em_andamento_toca_uf", fonte: FONTE_SIGET, casas: 1 },
  mva_obra: { rotulo: "Transformação nova em obra (SIGET)", unidade: "MVA", campo: "mva_tr_em_andamento", fonte: FONTE_SIGET, casas: 0 },
  km_epe: { rotulo: "Rede existente (EPE)", unidade: "km de traçado", campo: "km_rede_existente_epe", fonte: FONTE_EPE_REDE, casas: 1 },
  km_epe_plan: { rotulo: "Rede planejada (EPE)", unidade: "km de traçado", campo: "km_rede_planejada_epe", fonte: FONTE_EPE_REDE, casas: 1 },
};
export function linhasGeracaoRedeUf(g: Pick<ExpansaoGold, "transmissao">) {
  return [...g.transmissao.geracao_e_rede_por_uf]
    .map((u) => ({
      id: u.uf,
      nome: NOME_UF[u.uf] ?? u.uf,
      mw_impl: u.mw_ugs_em_implantacao,
      mw_24m: u.mw_previsto_24_meses,
      km_obra: u.km_lt_em_andamento_toca_uf,
      mva_obra: u.mva_tr_em_andamento,
      empreendimentos: u.empreendimentos_transmissao_em_andamento,
      km_epe: u.km_rede_existente_epe,
      km_epe_plan: u.km_rede_planejada_epe,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
export type LinhaGeracaoRedeUf = ReturnType<typeof linhasGeracaoRedeUf>[number];
export const COLUNAS_GERACAO_REDE_UF: ColunaTabela[] = [
  { id: "nome", rotulo: "UF", tipo: "texto" },
  { id: "id", rotulo: "Sigla", tipo: "texto" },
  { id: "mw_impl", rotulo: "Geração em implantação", tipo: "numero", unidade: "MW", casas: 1 },
  { id: "mw_24m", rotulo: "Geração prevista em 24 meses", tipo: "numero", unidade: "MW", casas: 1 },
  { id: "km_obra", rotulo: "Linhas em obra que tocam a UF", tipo: "numero", unidade: "km de circuito", casas: 1 },
  { id: "mva_obra", rotulo: "Transformação em obra", tipo: "numero", unidade: "MVA", casas: 0 },
  { id: "empreendimentos", rotulo: "Empreendimentos de transmissão em andamento", tipo: "numero", casas: 0 },
  { id: "km_epe", rotulo: "Rede existente (EPE)", tipo: "numero", unidade: "km de traçado", casas: 1 },
  { id: "km_epe_plan", rotulo: "Rede planejada (EPE)", tipo: "numero", unidade: "km de traçado", casas: 1 },
];
export function valoresMapaRede(linhas: readonly LinhaGeracaoRedeUf[], m: MedidaRede): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const l of linhas) {
    const c = codigoUf(l.id);
    if (c) out[c] = l[m];
  }
  return out;
}

export const CAMADAS_REDE = ["existente", "planejada"] as const;
export type CamadaRede = (typeof CAMADAS_REDE)[number];
export const TENSOES_MINIMAS = ["0", "230", "345", "500"] as const;
export const ESQUEMA_TRANSMISSAO = {
  med: campo(tiposUrl.opcao(MEDIDAS_REDE), "mw_impl", { param: "tra.med" }),
  uf: campo(leitorUf, "", { param: "tra.uf" }),
  cmp: campo(tiposUrl.lista(leitorUf, { max: LIMITE_COMPARACAO }), [] as string[], { param: "tra.cmp" }),
  cam: campo(tiposUrl.lista(tiposUrl.opcao(CAMADAS_REDE)), ["existente", "planejada"] as CamadaRede[], { param: "rede.cam" }),
  kv: campo(tiposUrl.opcao(TENSOES_MINIMAS), "0", { param: "rede.kv" }),
};

/** Série anual em três painéis, um por unidade: MW de geração, km de linhas e MVA de transformação. */
export function dadosSerieMw(s: readonly SerieAnualExpansao[]) {
  return [...s].sort((a, b) => a.ano.localeCompare(b.ano)).map((x) => ({ id: x.ano, ano: x.ano_parcial ? `${x.ano} (parcial)` : x.ano, mw: x.mw_geracao_liberada }));
}
export function dadosSerieKm(s: readonly SerieAnualExpansao[]) {
  return [...s]
    .sort((a, b) => a.ano.localeCompare(b.ano))
    .map((x) => ({ id: x.ano, ano: x.ano_parcial ? `${x.ano} (parcial)` : x.ano, energizados: x.km_lt_energizados, leilao: x.km_contratados_leilao, contratos: x.km_contratos_assinados_siget }));
}
export function dadosSerieMva(s: readonly SerieAnualExpansao[]) {
  return [...s]
    .sort((a, b) => a.ano.localeCompare(b.ano))
    .map((x) => ({ id: x.ano, ano: x.ano_parcial ? `${x.ano} (parcial)` : x.ano, energizados: x.mva_tr_energizados, leilao: x.mva_contratados_leilao, contratos: x.mva_contratos_assinados_siget }));
}

export function linhasLeiloes(anos: readonly LeilaoAno[]) {
  return [...anos]
    .sort((a, b) => a.ano.localeCompare(b.ano))
    .map((a) => ({
      id: a.ano,
      ano: a.ano,
      lotes_ofertados: a.lotes_ofertados,
      lotes_contratados: a.lotes_contratados,
      lotes_sem_vencedor: a.lotes_sem_vencedor,
      km: a.km,
      lotes_km_nao_informado: a.lotes_km_nao_informado,
      mva: a.mva,
      lotes_mva_nao_informado: a.lotes_mva_nao_informado,
      investimento: a.investimento_previsto_rs_mi,
      rap_edital: a.rap_edital_rs_mi,
      rap_vencedor: a.rap_vencedor_rs_mi,
      desagio: a.desagio_agregado_pct,
    }));
}
export const COLUNAS_LEILOES: ColunaTabela[] = [
  { id: "ano", rotulo: "Ano do leilão", tipo: "texto" },
  { id: "lotes_ofertados", rotulo: "Lotes ofertados", tipo: "numero", casas: 0 },
  { id: "lotes_contratados", rotulo: "Lotes contratados", tipo: "numero", casas: 0 },
  { id: "lotes_sem_vencedor", rotulo: "Lotes sem vencedor", tipo: "numero", casas: 0 },
  { id: "km", rotulo: "Extensão contratada", tipo: "numero", unidade: "km", casas: 1 },
  { id: "lotes_km_nao_informado", rotulo: "Lotes com km não informado", tipo: "numero", casas: 0 },
  { id: "mva", rotulo: "Transformação contratada", tipo: "numero", unidade: "MVA", casas: 0 },
  { id: "lotes_mva_nao_informado", rotulo: "Lotes com MVA não informado", tipo: "numero", casas: 0 },
  { id: "investimento", rotulo: "Investimento previsto", tipo: "numero", unidade: "R$ milhões nominais", casas: 1 },
  { id: "rap_edital", rotulo: "RAP do edital", tipo: "numero", unidade: "R$ milhões nominais por ano", casas: 1 },
  { id: "rap_vencedor", rotulo: "RAP vencedora", tipo: "numero", unidade: "R$ milhões nominais por ano", casas: 1 },
  { id: "desagio", rotulo: "Deságio agregado pela RAP", tipo: "percentual", casas: 1 },
];

export function linhasObrasSituacao(g: Pick<ExpansaoGold, "transmissao">) {
  return g.transmissao.obras.por_situacao.map((s) => ({
    id: s.situacao,
    situacao: s.situacao,
    empreendimentos: s.empreendimentos,
    obras: s.obras,
    km: s.km_lt_novas,
    mva: s.mva_tr_novos,
    mva_reserva: s.mva_tr_reserva,
  }));
}
export const COLUNAS_OBRAS_SITUACAO: ColunaTabela[] = [
  { id: "situacao", rotulo: "Situação no SIGET", tipo: "texto" },
  { id: "empreendimentos", rotulo: "Empreendimentos", tipo: "numero", casas: 0 },
  { id: "obras", rotulo: "Obras", tipo: "numero", casas: 0 },
  { id: "km", rotulo: "Linhas novas", tipo: "numero", unidade: "km de circuito", casas: 1 },
  { id: "mva", rotulo: "Transformação nova", tipo: "numero", unidade: "MVA", casas: 1 },
  { id: "mva_reserva", rotulo: "Transformador reserva (à parte)", tipo: "numero", unidade: "MVA", casas: 1 },
];
export function linhasPrazosVencidos(g: Pick<ExpansaoGold, "transmissao">) {
  return g.transmissao.obras.maiores_prazos_vencidos.map((p) => ({
    id: p.id,
    nome: p.nome,
    ons: p.ons,
    oper_ato_legal: p.oper_ato_legal,
    dias: p.dias_desde_prazo_legal,
    km: p.km_lt,
    mva: p.mva_tr,
    ufs: p.ufs.length ? p.ufs.join(", ") : null,
  }));
}
export const COLUNAS_PRAZOS_VENCIDOS: ColunaTabela[] = [
  { id: "nome", rotulo: "Empreendimento", tipo: "texto" },
  { id: "ons", rotulo: "Código ONS", tipo: "texto" },
  { id: "oper_ato_legal", rotulo: "Prazo vigente do ato legal", tipo: "data" },
  { id: "dias", rotulo: "Dias desde o prazo", tipo: "numero", unidade: "dias", casas: 0 },
  { id: "km", rotulo: "Linhas novas", tipo: "numero", unidade: "km de circuito", casas: 1 },
  { id: "mva", rotulo: "Transformação nova", tipo: "numero", unidade: "MVA", casas: 1 },
  { id: "ufs", rotulo: "UF", tipo: "texto" },
];
export function linhasDesvioObras(g: Pick<ExpansaoGold, "transmissao">) {
  return g.transmissao.obras.desvio_prazo_vigente_por_ano.por_ano.map((a) => ({
    id: a.ano,
    ano: a.ano,
    empreendimentos: a.empreendimentos,
    pct_depois: a.pct_depois_do_prazo_vigente,
    iguais: a.empreendimentos_data_efetiva_igual_ao_prazo,
    pct_iguais: a.pct_data_efetiva_igual_ao_prazo,
    mediana: a.mediana_desvio_dias,
    p75: a.p75_desvio_dias,
  }));
}
export const COLUNAS_DESVIO_OBRAS: ColunaTabela[] = [
  { id: "ano", rotulo: "Ano da entrada", tipo: "texto" },
  { id: "empreendimentos", rotulo: "Empreendimentos", tipo: "numero", casas: 0 },
  { id: "pct_depois", rotulo: "Depois do prazo vigente", tipo: "percentual", casas: 1 },
  { id: "iguais", rotulo: "Data efetiva igual ao prazo", tipo: "numero", casas: 0 },
  { id: "pct_iguais", rotulo: "Data efetiva igual ao prazo (%)", tipo: "percentual", casas: 1 },
  { id: "mediana", rotulo: "Mediana do desvio", tipo: "numero", unidade: "dias", casas: 0 },
  { id: "p75", rotulo: "Percentil 75 do desvio", tipo: "numero", unidade: "dias", casas: 0 },
];
export function linhasContratosAno(g: Pick<ExpansaoGold, "transmissao">) {
  const c = g.transmissao.contratos_assinados;
  if (!c) return [];
  return [...c.por_ano]
    .sort((a, b) => a.ano.localeCompare(b.ano))
    .map((a) => ({
      id: a.ano,
      ano: a.ano_parcial ? `${a.ano} (parcial)` : a.ano,
      contratos: a.contratos,
      sem_empreendimento: a.contratos_sem_empreendimento,
      empreendimentos: a.empreendimentos,
      km: a.km_lt_novas,
      mva: a.mva_tr_novos,
      mva_reserva: a.mva_tr_reserva,
    }));
}
export const COLUNAS_CONTRATOS_ANO: ColunaTabela[] = [
  { id: "ano", rotulo: "Ano de assinatura", tipo: "texto" },
  { id: "contratos", rotulo: "Contratos", tipo: "numero", casas: 0 },
  { id: "sem_empreendimento", rotulo: "Sem empreendimento no SIGET", tipo: "numero", casas: 0 },
  { id: "empreendimentos", rotulo: "Empreendimentos", tipo: "numero", casas: 0 },
  { id: "km", rotulo: "Linhas novas do objeto original", tipo: "numero", unidade: "km de circuito", casas: 1 },
  { id: "mva", rotulo: "Transformação nova", tipo: "numero", unidade: "MVA", casas: 0 },
  { id: "mva_reserva", rotulo: "Transformador reserva (à parte)", tipo: "numero", unidade: "MVA", casas: 0 },
];
export function linhasContratosRecentes(g: Pick<ExpansaoGold, "transmissao">) {
  const c = g.transmissao.contratos_assinados;
  if (!c) return [];
  return c.depois_do_ultimo_leilao_do_arquivo.contratos.map((x) => ({
    id: x.contrato,
    numero: x.numero,
    assinatura: x.assinatura,
    agente: x.agente,
    empreendimentos: x.empreendimentos,
    km: x.km_lt_novas,
    mva: x.mva_tr_novos,
  }));
}
export const COLUNAS_CONTRATOS_RECENTES: ColunaTabela[] = [
  { id: "numero", rotulo: "Contrato", tipo: "texto" },
  { id: "assinatura", rotulo: "Assinatura", tipo: "data" },
  { id: "agente", rotulo: "Concessionária", tipo: "texto" },
  { id: "empreendimentos", rotulo: "Empreendimentos no SIGET", tipo: "numero", casas: 0 },
  { id: "km", rotulo: "Linhas novas", tipo: "numero", unidade: "km de circuito", casas: 1 },
  { id: "mva", rotulo: "Transformação nova", tipo: "numero", unidade: "MVA", casas: 0 },
];

export function linhasRedeTensao(g: Pick<ExpansaoGold, "transmissao">) {
  const r = g.transmissao.rede_epe;
  if (!r) return [];
  const tensoes = Array.from(new Set([...r.existente.por_tensao, ...r.planejada.por_tensao].map((t) => t.tensao_kv)));
  return tensoes
    .sort((a, b) => (b ?? -1) - (a ?? -1))
    .map((kv) => {
      const e = r.existente.por_tensao.find((t) => t.tensao_kv === kv);
      const p = r.planejada.por_tensao.find((t) => t.tensao_kv === kv);
      return {
        id: kv === null ? "sem-tensao" : String(kv),
        tensao: kv === null ? "tensão não informada" : `${num(kv, 0)} kV`,
        existente_linhas: e?.linhas ?? 0,
        existente_km: e?.km ?? 0,
        planejada_linhas: p?.linhas ?? 0,
        planejada_km: p?.km ?? 0,
      };
    });
}
export const COLUNAS_REDE_TENSAO: ColunaTabela[] = [
  { id: "tensao", rotulo: "Tensão", tipo: "texto" },
  { id: "existente_linhas", rotulo: "Existente, linhas", tipo: "numero", casas: 0 },
  { id: "existente_km", rotulo: "Existente", tipo: "numero", unidade: "km de traçado", casas: 1 },
  { id: "planejada_linhas", rotulo: "Planejada, linhas", tipo: "numero", casas: 0 },
  { id: "planejada_km", rotulo: "Planejada", tipo: "numero", unidade: "km de traçado", casas: 1 },
];

/** Linhas do JSON da rede da EPE filtradas por camada e tensão mínima (tensão não informada só entra com mínimo 0). */
export function filtraRede<T extends readonly [string, string | null, number | null, number | null, number | null, string]>(linhas: readonly T[], camadas: readonly string[], kvMin: number): T[] {
  const quer = new Set(camadas);
  return linhas.filter((l) => quer.has(l[0]) && (kvMin <= 0 || (temValor(l[2]) && l[2] >= kvMin)));
}

/* ================================================================ P043: cenários */

/**
 * Resposta curta do P043. Regra: edição, aprovação e data-base do plano; capacidade
 * nacional do Cenário de Referência em dez/2025 e dez/2035 (conferências da gold contra
 * os rótulos do relatório); e, entre as categorias com correspondência direta no cadastro
 * da ANEEL, a de maior capacidade em 2035 no cenário, com o realizado e a carteira lado a
 * lado, sem diferença calculada.
 */
export function respostaCenarios(g: Pick<ExpansaoGold, "cenarios" | "evidencias">): string {
  const c = g.cenarios;
  const c2025 = c.conferencia_relatorio.find((x) => x.descricao.includes("3-25") && x.descricao.includes("dez/2025"));
  const c2035 = c.conferencia_relatorio.find((x) => x.descricao.includes("3-25") && x.descricao.includes("dez/2035"));
  const ev = g.evidencias.pde_capacidade_2035;
  const total2035 = ev?.valor_calculo ?? c2035?.calculado_gw ?? null;
  const partes = [
    `O ${c.edicao} (${c.orgao}${c.aprovacao ? `; aprovado pela ${c.aprovacao.texto}` : ""}) é um cenário com data-base em ${c.data_base_premissas}, não uma previsão: no Cenário de Referência, a capacidade instalada nacional, contando micro e minigeração distribuída, baterias e resposta da demanda, vai de ${gwTexto(c2025?.calculado_gw)} em dezembro de 2025 a ${gwTexto(total2035)} em dezembro de 2035.`,
  ];
  const diretas = c.camadas.filter((x) => x.correspondencia === "direta" && temValor(x.pde_dez2035_gw));
  const maior = [...diretas].sort((a, b) => (b.pde_dez2035_gw ?? 0) - (a.pde_dez2035_gw ?? 0))[0];
  if (maior) {
    partes.push(
      `Entre as categorias com correspondência direta no cadastro da ANEEL, a maior em 2035 é a de ${maior.rotulo.toLocaleLowerCase("pt-BR")}, com ${gwTexto(maior.pde_dez2035_gw)} no cenário, ${gwTexto(maior.realizado_siga_gw)} em operação no SIGA e ${gwTexto(maior.carteira_ralie_gw)} em implantação no RALIE hoje.`,
    );
  }
  return partes.join(" ");
}

/** "O que mudou" do P043: o que o próprio relatório diz ter mudado depois da data-base (ressalvas publicadas com a página). */
export function mudancaCenarios(g: Pick<ExpansaoGold, "cenarios">): string {
  const r = g.cenarios.hipoteses.filter((h) => h.ressalva);
  if (!r.length) return `O relatório não registra mudança posterior à data-base (${g.cenarios.data_base_premissas}) nas hipóteses publicadas.`;
  return r.map((h) => `${h.ressalva}${h.pagina_ressalva ? ` (relatório, p. ${h.pagina_ressalva})` : ""}`).join(" ");
}

export const FIGURAS_PDE = ["fig_3_25", "fig_3_6", "fig_3_23", "fig_4_19", "fig_4_24", "fig_4_27", "fig_12_4"] as const;
export type IdFigura = (typeof FIGURAS_PDE)[number];
export const ESQUEMA_CENARIOS = {
  fig: campo(tiposUrl.opcao(FIGURAS_PDE), "fig_3_6", { param: "cen.fig" }),
  cat: campo(tiposUrl.texto({ max: 40 }), "", { param: "cen.cat" }),
};
/** Rótulo curto da figura ("Figura 3-6") a partir do id da gold. */
export function rotuloFigura(id: string): string {
  return `Figura ${id.replace(/^fig_/, "").replace("_", "-")}`;
}
export const CORES_FIGURA = [
  "var(--serie-1)",
  "var(--serie-2)",
  "var(--serie-3)",
  "var(--serie-4)",
  "var(--serie-5)",
  "var(--serie-6)",
  "var(--serie-comp-1)",
  "var(--serie-comp-2)",
  "var(--serie-comp-3)",
  "var(--serie-comp-4)",
] as const;

/**
 * Dados de uma figura do PDE para o gráfico e a tabela. Com até 3 referências (dez/2025
 * e dez/2035; 2025, 2030 e 2035) vira barras agrupadas (categorias = colunas da figura,
 * séries = referências); com mais, linhas no tempo (séries = colunas). Os ids das séries
 * são posicionais ("c0", "r0") porque os rótulos da EPE têm espaços, acentos e
 * parênteses; o rótulo original fica intacto.
 */
export type DadosFigura =
  | { modo: "linhas"; dados: Record<string, string | number | null>[]; series: { id: string; rotulo: string }[] }
  | { modo: "barras"; dados: Record<string, string | number | null>[]; series: { id: string; rotulo: string }[] };
export function dadosFigura(f: FiguraPde): DadosFigura {
  if (f.linhas.length <= 3) {
    const series = f.linhas.map((l, i) => ({ id: `r${i}`, rotulo: l.ref }));
    const dados = f.colunas.map((col, j) => {
      const o: Record<string, string | number | null> = { id: `c${j}`, coluna: col };
      f.linhas.forEach((l, i) => {
        const v = l[col];
        o[`r${i}`] = typeof v === "number" ? v : null;
      });
      return o;
    });
    return { modo: "barras", dados, series };
  }
  const series = f.colunas.map((col, j) => ({ id: `c${j}`, rotulo: col }));
  const dados = f.linhas.map((l) => {
    const o: Record<string, string | number | null> = { ref: l.ref };
    f.colunas.forEach((col, j) => {
      const v = l[col];
      o[`c${j}`] = typeof v === "number" ? v : null;
    });
    return o;
  });
  return { modo: "linhas", dados, series };
}

/** Camadas lado a lado, por categoria do PDE: cenário (Anexo I-3, sem a parcela que o SIGA não cadastra), realizado e carteira. */
export function linhasCamadas(g: Pick<ExpansaoGold, "cenarios">) {
  return g.cenarios.camadas.map((c: CamadaPde) => ({
    id: c.categoria,
    categoria: c.rotulo,
    correspondencia: c.correspondencia,
    pde_dez2025: c.pde_dez2025_gw,
    pde_dez2035: c.pde_dez2035_gw,
    anexo_dez2026: c.pde_anexo_i3?.dez2026_gw ?? null,
    anexo_dez2035: c.pde_anexo_i3?.dez2035_gw ?? null,
    fora_do_siga_dez2035: c.pde_anexo_i3?.parcela_fora_do_siga?.dez2035_gw ?? null,
    realizado: c.realizado_siga_gw,
    carteira: c.carteira_ralie_gw,
    tipos_siga: c.siga_tipos ? c.siga_tipos.join(", ") : null,
  }));
}
export type LinhaCamada = ReturnType<typeof linhasCamadas>[number];
export const COLUNAS_CAMADAS: ColunaTabela[] = [
  { id: "categoria", rotulo: "Categoria do PDE", tipo: "texto" },
  { id: "correspondencia", rotulo: "Correspondência com o SIGA", tipo: "texto", categorica: true },
  { id: "pde_dez2025", rotulo: "Cenário, dez/2025 (Figura 3-25)", tipo: "numero", unidade: "GW", casas: 3 },
  { id: "pde_dez2035", rotulo: "Cenário, dez/2035 (Figura 3-25)", tipo: "numero", unidade: "GW", casas: 3 },
  { id: "anexo_dez2026", rotulo: "Cenário comparável, dez/2026 (Anexo I-3)", tipo: "numero", unidade: "GW", casas: 3 },
  { id: "anexo_dez2035", rotulo: "Cenário comparável, dez/2035 (Anexo I-3)", tipo: "numero", unidade: "GW", casas: 3 },
  { id: "fora_do_siga_dez2035", rotulo: "Parcela que o SIGA não cadastra, dez/2035", tipo: "numero", unidade: "GW", casas: 3 },
  { id: "realizado", rotulo: "Realizado (SIGA, em operação)", tipo: "numero", unidade: "GW", casas: 3 },
  { id: "carteira", rotulo: "Carteira (RALIE, em implantação)", tipo: "numero", unidade: "GW", casas: 3 },
  { id: "tipos_siga", rotulo: "Tipos do SIGA somados", tipo: "texto" },
];
/** Só as categorias com valor comparável no Anexo I-3 entram no gráfico de camadas; as demais ficam na tabela, com o motivo. */
export function linhasCamadasComparaveis(linhas: readonly LinhaCamada[]) {
  return linhas.filter((l) => temValor(l.anexo_dez2035) || temValor(l.realizado));
}
