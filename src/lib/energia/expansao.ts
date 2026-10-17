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
import type { Download, Proveniencia } from "./tipos";
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
import type { Idioma } from "@/lib/idioma";
import { campo, tiposUrl } from "./estadoUrl";
import { dataBR, mesAno, num, pct } from "./formato";
import { idiomaEnergia, tx } from "./idioma";
import {
  CAMADA_PDE_EN,
  COLUNA_FIGURA_EN,
  CORRESPONDENCIA_EN,
  ESTAGIO_EN,
  HIPOTESE_PDE_EN,
  JUSTIFICATIVA_EN,
  NOME_TIPO_GOLD_EN,
  OBRA_RALIE_EN,
  ORGAO_EN,
  SITUACAO_CRONOGRAMA_EN,
  SITUACAO_SIGET_EN,
  TITULO_FIGURA_EN,
  VIABILIDADE_EN,
  atoNormativoEn,
  mesPorExtensoEn,
  rotuloDado,
} from "./i18n/expansao-transicao-territorio";
import { LIMITE_COMPARACAO, type ColunaTabela } from "./tabela";

/* ================================================================ comum */

/** Ausência dentro de frase: o traço das tabelas se leria como pontuação. */
export function semDado(idioma: Idioma = idiomaEnergia()): string {
  return tx("sem dado", "no data", idioma);
}
export const SEM_DADO = semDado("pt");

export const temValor = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);

export function inteiro(v: number | null | undefined, idioma: Idioma = idiomaEnergia()): string {
  return temValor(v) ? num(v, 0, idioma) : semDado(idioma);
}
export function numTexto(v: number | null | undefined, casas = 1, idioma: Idioma = idiomaEnergia()): string {
  return temValor(v) ? num(v, casas, idioma) : semDado(idioma);
}
export function pctTexto(v: number | null | undefined, casas = 1, idioma: Idioma = idiomaEnergia()): string {
  return temValor(v) ? pct(v, casas, idioma) : semDado(idioma);
}
/** Potência: "87.267,2 MW". */
export function mwTexto(v: number | null | undefined, casas = 1, idioma: Idioma = idiomaEnergia()): string {
  return temValor(v) ? `${num(v, casas, idioma)} MW` : semDado(idioma);
}
export function gwTexto(v: number | null | undefined, casas = 1, idioma: Idioma = idiomaEnergia()): string {
  return temValor(v) ? `${num(v, casas, idioma)} GW` : semDado(idioma);
}
export function kmTexto(v: number | null | undefined, casas = 1, idioma: Idioma = idiomaEnergia()): string {
  return temValor(v) ? `${num(v, casas, idioma)} km` : semDado(idioma);
}
export function mvaTexto(v: number | null | undefined, casas = 1, idioma: Idioma = idiomaEnergia()): string {
  return temValor(v) ? `${num(v, casas, idioma)} MVA` : semDado(idioma);
}
/** Dias com sinal tipográfico: "−1.209 dias", "1 dia". */
export function diasTexto(v: number | null | undefined, idioma: Idioma = idiomaEnergia()): string {
  if (!temValor(v)) return semDado(idioma);
  const a = Math.round(v);
  return `${num(a, 0, idioma)} ${Math.abs(a) === 1 ? tx("dia", "day", idioma) : tx("dias", "days", idioma)}`;
}
/** Data AAAA-MM-DD (ou carimbo) em dd/mm/aaaa; ausência → "sem dado". */
export function dataTexto(iso: string | null | undefined, idioma: Idioma = idiomaEnergia()): string {
  return iso ? dataBR(iso, idioma) : semDado(idioma);
}
/** "2026-09" ou "2026-09-18" → "set/2026"; ausência → "sem dado". */
export function mesTexto(m: string | null | undefined, idioma: Idioma = idiomaEnergia()): string {
  return m && /^\d{4}-\d{2}/.test(m) ? mesAno(m.slice(0, 7), idioma) : semDado(idioma);
}

/** Primeira letra maiúscula (início de frase). */
export function inicial(t: string): string {
  return t ? t.charAt(0).toLocaleUpperCase("pt-BR") + t.slice(1) : t;
}

/** Lista legível: "a", "a e b", "a, b e c" ("a, b and c" em inglês). */
export function listaTexto(itens: readonly string[], idioma: Idioma = idiomaEnergia()): string {
  if (itens.length <= 1) return itens[0] ?? "";
  return `${itens.slice(0, -1).join(", ")} ${tx("e", "and", idioma)} ${itens.at(-1)}`;
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
  return ra > rb ? "maior" : ra < rb ? "menor" : "igual"; // i18n: dado
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
/** Nomes próprios das UF (ficam em português nos dois idiomas; a tela os marca com <Nome>). */
export const NOME_UF: Readonly<Record<string, string>> = {
  // i18n: dado (nomes próprios)
  RO: "Rondônia", AC: "Acre", AM: "Amazonas", RR: "Roraima", PA: "Pará", AP: "Amapá", TO: "Tocantins",
  // i18n: dado (nomes próprios)
  MA: "Maranhão", PI: "Piauí", CE: "Ceará", RN: "Rio Grande do Norte", PB: "Paraíba", PE: "Pernambuco", AL: "Alagoas", SE: "Sergipe", BA: "Bahia",
  // i18n: dado (nomes próprios)
  MG: "Minas Gerais", ES: "Espírito Santo", RJ: "Rio de Janeiro", SP: "São Paulo",
  // i18n: dado (nomes próprios)
  PR: "Paraná", SC: "Santa Catarina", RS: "Rio Grande do Sul",
  // i18n: dado (nomes próprios)
  MS: "Mato Grosso do Sul", MT: "Mato Grosso", GO: "Goiás", DF: "Distrito Federal",
};
export function entidadesUf(): { id: string; rotulo: string; sinonimos: string[] }[] {
  return UFS.map((u) => ({ id: u, rotulo: `${NOME_UF[u]} (${u})`, sinonimos: [u] }));
}

/** Nome por extenso do tipo de geração do SIGA (rótulos do dicionário da ANEEL), no idioma. */
function nomesTipo(idioma: Idioma): Readonly<Record<string, string>> {
  return {
    UHE: tx("Usina hidrelétrica", "Hydropower plant", idioma),
    PCH: tx("Pequena central hidrelétrica", "Small hydropower plant", idioma),
    CGH: tx("Central geradora hidrelétrica", "Mini hydropower plant", idioma),
    EOL: tx("Central geradora eólica", "Wind power plant", idioma),
    UFV: tx("Central geradora solar fotovoltaica", "Solar photovoltaic plant", idioma),
    UTE: tx("Usina termelétrica", "Thermal power plant", idioma),
    UTN: tx("Usina termonuclear", "Nuclear power plant", idioma),
    CGU: tx("Central geradora undi-elétrica", "Wave power plant", idioma),
  };
}
export const NOME_TIPO: Readonly<Record<string, string>> = nomesTipo("pt");
/** Tipo de geração em frase ("71,7 GW em usinas solares fotovoltaicas"), no idioma. */
function tiposEmFrase(idioma: Idioma): Readonly<Record<string, string>> {
  return {
    UHE: tx("hidrelétricas", "hydropower plants", idioma),
    PCH: tx("pequenas centrais hidrelétricas", "small hydropower plants", idioma),
    CGH: tx("centrais geradoras hidrelétricas", "mini hydropower plants", idioma),
    EOL: tx("usinas eólicas", "wind power plants", idioma),
    UFV: tx("usinas solares fotovoltaicas", "solar photovoltaic plants", idioma),
    UTE: tx("termelétricas", "thermal power plants", idioma),
    UTN: tx("termonuclear", "nuclear power", idioma),
    CGU: tx("centrais undi-elétricas", "wave power plants", idioma),
  };
}
export const TIPO_EM_FRASE: Readonly<Record<string, string>> = tiposEmFrase("pt");
/** Nome curto do tipo de geração para o eixo de um gráfico estreito (o nome completo fica nas tabelas): sem "Central geradora". */
function nomesTipoCurto(idioma: Idioma): Readonly<Record<string, string>> {
  return {
    UHE: tx("Hidrelétrica", "Hydropower", idioma),
    PCH: tx("Pequena hidrelétrica", "Small hydropower", idioma),
    CGH: tx("Central hidrelétrica", "Mini hydropower", idioma),
    EOL: tx("Eólica", "Wind", idioma),
    UFV: tx("Solar fotovoltaica", "Solar photovoltaic", idioma),
    UTE: tx("Termelétrica", "Thermal", idioma),
    UTN: tx("Termonuclear", "Nuclear", idioma),
    CGU: tx("Undi-elétrica", "Wave", idioma),
  };
}
export const NOME_TIPO_CURTO: Readonly<Record<string, string>> = nomesTipoCurto("pt");
const NOME_TIPO_EN = nomesTipo("en");
const TIPO_EM_FRASE_EN = tiposEmFrase("en");
const NOME_TIPO_CURTO_EN = nomesTipoCurto("en");
/** Nome por extenso do tipo de geração no idioma (o código desconhecido volta como veio). */
export function nomeTipo(tipo: string, idioma: Idioma = idiomaEnergia()): string {
  return (idioma === "en" ? NOME_TIPO_EN : NOME_TIPO)[tipo] ?? tipo;
}
/** Tipo de geração em frase, no idioma. */
export function tipoEmFrase(tipo: string, idioma: Idioma = idiomaEnergia()): string {
  return (idioma === "en" ? TIPO_EM_FRASE_EN : TIPO_EM_FRASE)[tipo] ?? tipo;
}
/** Nome curto do tipo de geração, no idioma. */
export function nomeTipoCurto(tipo: string, idioma: Idioma = idiomaEnergia()): string {
  return (idioma === "en" ? NOME_TIPO_CURTO_EN : NOME_TIPO_CURTO)[tipo] ?? tipo;
}
/** Nome do tipo como a gold o publica (por extenso, em português), no idioma. */
export function nomeTipoDaGold(nome: string, idioma: Idioma = idiomaEnergia()): string {
  return rotuloDado(nome, NOME_TIPO_GOLD_EN, idioma);
}
/** Número por extenso nas frases curtas (até dez), como no texto editorial; acima disso, algarismos. */
export function porExtenso(n: number, genero: "f" | "m" = "f", idioma: Idioma = idiomaEnergia()): string {
  const nomes = tx(
    genero === "f"
      ? ["zero", "uma", "duas", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez"]
      : ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez"],
    ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"],
    idioma,
  );
  return Number.isInteger(n) && n >= 0 && n <= 10 ? nomes[n] : num(n, 0, idioma);
}
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
/** Pergunta da abertura do módulo (o título da página de síntese), no idioma. */
export function perguntaExpansao(idioma: Idioma = idiomaEnergia()): string {
  return tx("O que está sendo construído?", "What is being built?", idioma);
}
/** Pergunta da figura principal da abertura (fonte da carteira em implantação), a mesma que o mapa do observatório faz ao módulo. */
export function perguntaCapacidade(idioma: Idioma = idiomaEnergia()): string {
  return tx("Quanta capacidade está chegando, e de que fontes?", "How much capacity is coming, and from which sources?", idioma);
}
export const PERGUNTA_EXPANSAO = perguntaExpansao("pt");
export const PERGUNTA_CAPACIDADE = perguntaCapacidade("pt");
export type PainelExpansao = "p040" | "p041" | "p042" | "p043";
type PaginaPainel = { id: PainelExpansao; slug: string; rotulo: string; pergunta: string };
/** As quatro páginas de painel, na ordem das perguntas (a próxima pergunta de cada uma é a seguinte), no idioma. */
export function paineisExpansao(idioma: Idioma = idiomaEnergia()): readonly PaginaPainel[] {
  return [
    { id: "p040", slug: "carteira", rotulo: tx("Carteira de projetos", "Project portfolio", idioma), pergunta: tx("O que está planejado e em construção?", "What is planned and under construction?", idioma) },
    { id: "p041", slug: "cronograma", rotulo: tx("Cronograma e atrasos", "Schedule and delays", idioma), pergunta: tx("Quando deve entrar e o que atrasou?", "When should it come online, and what is delayed?", idioma) },
    {
      id: "p042",
      slug: "geracao-e-transmissao",
      rotulo: tx("Geração e transmissão", "Generation and transmission", idioma),
      pergunta: tx("A expansão vem acompanhada de rede?", "Does the expansion come with grid?", idioma),
    },
    { id: "p043", slug: "cenarios", rotulo: tx("Cenários oficiais", "Official scenarios", idioma), pergunta: tx("Como o planejamento enxerga a matriz?", "How does planning see the power mix?", idioma) },
  ];
}
export const PAINEIS_EXPANSAO: readonly PaginaPainel[] = paineisExpansao("pt");
const PAINEIS_EXPANSAO_EN: readonly PaginaPainel[] = paineisExpansao("en");
/** Painel com rótulo e pergunta no idioma. */
export function painel(id: PainelExpansao, idioma: Idioma = idiomaEnergia()): PaginaPainel {
  return (idioma === "en" ? PAINEIS_EXPANSAO_EN : PAINEIS_EXPANSAO).find((x) => x.id === id)!;
}
export function rotaPainel(id: PainelExpansao): string {
  return `${ROTA_EXPANSAO}/${painel(id, "pt").slug}`;
}
/** Próximo painel na ordem das perguntas (o último volta ao primeiro). */
export function proximoPainel(id: PainelExpansao): PainelExpansao {
  const i = PAINEIS_EXPANSAO.findIndex((p) => p.id === id);
  return PAINEIS_EXPANSAO[(i + 1) % PAINEIS_EXPANSAO.length].id;
}

/** Fontes do módulo, no idioma: a base fica com a sigla e o nome oficial; em inglês, a sigla e uma descrição curta. */
function fontes(idioma: Idioma) {
  return {
    siga: tx("ANEEL, SIGA: Sistema de Informações de Geração", "ANEEL, SIGA (generation information system)", idioma),
    ralie: tx("ANEEL, RALIE: Relatório de Acompanhamento da Expansão da Oferta de Geração", "ANEEL, RALIE (generation supply expansion monitoring report)", idioma),
    atos: tx("ANEEL, Atos de outorgas de geração", "ANEEL, generation grant acts", idioma),
    liberacoes: tx("ANEEL, Liberação para operação comercial", "ANEEL, release for commercial operation", idioma),
    siget: tx("ANEEL, SIGET: Sistema de Gestão da Transmissão", "ANEEL, SIGET (transmission management system)", idioma),
    leiloes: tx("ANEEL, Resultado de leilões (transmissão)", "ANEEL, auction results (transmission)", idioma),
    epeRede: tx("EPE, WebMap (linhas de transmissão existentes e planejadas)", "EPE, WebMap (existing and planned transmission lines)", idioma),
    pde: tx("EPE e MME, Plano Decenal de Expansão de Energia 2035", "EPE and MME, Ten-Year Energy Expansion Plan 2035 (PDE 2035)", idioma),
  };
}
const FONTES_PT = fontes("pt");
const FONTES_EN_POR_CHAVE = fontes("en");
export const FONTE_SIGA = FONTES_PT.siga;
export const FONTE_RALIE = FONTES_PT.ralie;
export const FONTE_ATOS = FONTES_PT.atos;
export const FONTE_LIBERACOES = FONTES_PT.liberacoes;
export const FONTE_SIGET = FONTES_PT.siget;
export const FONTE_LEILOES = FONTES_PT.leiloes;
export const FONTE_EPE_REDE = FONTES_PT.epeRede;
export const FONTE_PDE = FONTES_PT.pde;
const FONTES_EN: Record<string, string> = Object.fromEntries(
  (Object.keys(FONTES_PT) as (keyof typeof FONTES_PT)[]).map((k) => [FONTES_PT[k], FONTES_EN_POR_CHAVE[k]]),
);
/** Uma das fontes acima (passada na forma portuguesa) no idioma da página. */
export function fonteExpansao(fonte: string, idioma: Idioma = idiomaEnergia()): string {
  return idioma === "en" ? (FONTES_EN[fonte] ?? fonte) : fonte;
}

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

/* ================================================================ síntese */

/** Carteira do RALIE por tipo de geração (MW das unidades em implantação), da maior para a menor. */
export function linhasRalieTipo(g: Pick<ExpansaoGold, "estagios">, idioma: Idioma = idiomaEnergia()) {
  return [...g.estagios.ralie.por_tipo]
    .sort((a, b) => b.mw_ugs_em_implantacao - a.mw_ugs_em_implantacao)
    .map((t) => ({ id: t.tipo, tipo: `${nomeTipo(t.tipo, idioma)} (${t.tipo})`, usinas: t.usinas, mw: t.mw_ugs_em_implantacao, mw_outorgado: t.mw_outorgado }));
}

/** As mesmas linhas de linhasRalieTipo com o nome curto do tipo, para o eixo do gráfico da abertura (mesmos números, mesma ordem). */
export function linhasRalieTipoNoGrafico(g: Pick<ExpansaoGold, "estagios">, idioma: Idioma = idiomaEnergia()) {
  return linhasRalieTipo(g, idioma).map((l) => ({ ...l, tipo: `${nomeTipoCurto(l.id, idioma)} (${l.id})` }));
}

/**
 * Resposta da página de síntese ("Quanta capacidade está chegando, e de que fontes?").
 * Regra: total das unidades em implantação no RALIE e os três tipos com mais potência,
 * com o número de tipos restantes; depois, o que a fiscalização prevê para os dois
 * primeiros anos e o lembrete de que carteira não é entrada certa, sustentado pelo
 * desfecho da coorte de 2021 quando a gold o publica.
 */
export function respostaSintese(g: Pick<ExpansaoGold, "estagios" | "cronograma" | "referencias">, idioma: Idioma = idiomaEnergia()): string {
  const r = g.estagios.ralie;
  const tipos = linhasRalieTipo(g, idioma);
  const top = tipos.slice(0, 3);
  const resto = tipos.length - top.length;
  const lista = listaTexto(
    top.map((t) => tx(`${mwTexto(t.mw, 1, idioma)} em ${TIPO_EM_FRASE[t.id] ?? t.id}`, `${mwTexto(t.mw, 1, idioma)} in ${tipoEmFrase(t.id, idioma)}`, idioma)),
    idioma,
  );
  const restante =
    resto > 0
      ? tx(`, e o restante em ${resto === 1 ? "outro tipo" : `outros ${porExtenso(resto, "m", idioma)} tipos`}`, `, and the rest in ${resto === 1 ? "one other type" : `${porExtenso(resto, "m", idioma)} other types`}`, idioma)
      : "";
  const partes = [
    tx(
      `Na fotografia do RALIE de ${dataTexto(r.data_ralie, idioma)}, ${inteiro(r.usinas, idioma)} usinas estão em implantação, com ${mwTexto(r.mw_ugs_em_implantacao, 1, idioma)} em unidades geradoras: ${lista}${restante}.`,
      `In the RALIE snapshot of ${dataTexto(r.data_ralie, idioma)}, ${inteiro(r.usinas, idioma)} plants are under implementation, with ${mwTexto(r.mw_ugs_em_implantacao, 1, idioma)} in generating units: ${lista}${restante}.`,
      idioma,
    ),
  ];
  const pa = g.cronograma.previsoes_atuais;
  const anoFoto = pa.data_ralie.slice(0, 4);
  const anos = [...pa.por_ano].sort((a, b) => a.ano.localeCompare(b.ano)).slice(0, 2);
  if (anos.length) {
    const quando = listaTexto(
      anos.map((a) => `${mwTexto(a.mw, 1, idioma)} ${a.ano === anoFoto ? tx(`no restante de ${a.ano}`, `in the rest of ${a.ano}`, idioma) : tx(`em ${a.ano}`, `in ${a.ano}`, idioma)}`),
      idioma,
    );
    partes.push(tx(`A fiscalização prevê ${quando}.`, `ANEEL's inspection expects ${quando}.`, idioma));
  }
  const c0 = coorteInicial(g);
  if (c0) {
    const enc = c0.desfechos.outorga_encerrada.pct_mw;
    const perda = temValor(enc) && enc > 0;
    partes.push(
      tx(
        `${perda ? "Carteira não é entrada certa: da" : "Da"} potência que estava em implantação em ${dataTexto(g.referencias.ralie_historico_desde, idioma)}, ${pctTexto(c0.desfechos.operacao.pct_mw, 1, idioma)} entrou em operação e ${pctTexto(enc, 1, idioma)} teve a outorga encerrada.`,
        `${perda ? "A portfolio is not a guaranteed entry: of the" : "Of the"} capacity under implementation on ${dataTexto(g.referencias.ralie_historico_desde, idioma)}, ${pctTexto(c0.desfechos.operacao.pct_mw, 1, idioma)} entered operation and ${pctTexto(enc, 1, idioma)} had its grant terminated.`,
        idioma,
      ),
    );
  }
  return partes.join(" ");
}

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
export function respostaCarteira(g: Pick<ExpansaoGold, "estagios" | "referencias">, idioma: Idioma = idiomaEnergia()): string {
  const op = estagio(g, "operacao");
  const con = estagio(g, "construcao");
  const nao = estagio(g, "construcao_nao_iniciada");
  const i = (v: number | null | undefined) => inteiro(v, idioma);
  const mw = (v: number | null | undefined) => mwTexto(v, 1, idioma);
  const pc = (v: number | null | undefined) => pctTexto(v, 1, idioma);
  const dt = (v: string | null | undefined) => dataTexto(v, idioma);
  const partes = [
    tx(
      `Em ${dt(g.estagios.data_referencia)}, o SIGA da ANEEL registra ${i(con?.usinas)} usinas em construção, com ${mw(con?.mw_outorgado)} outorgados, e ${i(nao?.usinas)} usinas outorgadas com a construção não iniciada, com ${mw(nao?.mw_outorgado)}; em operação são ${i(op?.usinas)} usinas e ${mw(op?.mw_fiscalizado)} fiscalizados.`,
      `On ${dt(g.estagios.data_referencia)}, ANEEL's SIGA records ${i(con?.usinas)} plants under construction, with ${mw(con?.mw_outorgado)} granted, and ${i(nao?.usinas)} granted plants with construction not started, with ${mw(nao?.mw_outorgado)}; in operation there are ${i(op?.usinas)} plants and ${mw(op?.mw_fiscalizado)} inspected.`,
      idioma,
    ),
  ];
  const c0 = coorteInicial(g);
  if (c0) {
    const d = c0.desfechos;
    const perda = (temValor(d.outorga_encerrada.pct_mw) && d.outorga_encerrada.pct_mw > 0) || (temValor(d.sem_desfecho.pct_mw) && d.sem_desfecho.pct_mw > 0);
    partes.push(
      tx(
        `${perda ? "Outorga não é entrada garantida: das" : "Das"} usinas em implantação na primeira fotografia do RALIE (${dt(g.referencias.ralie_historico_desde)}), ${pc(d.operacao.pct_mw)} da potência entrou em operação, ${pc(d.outorga_encerrada.pct_mw)} teve a outorga revogada ou extinta e ${pc(d.em_implantacao.pct_mw)} seguia em implantação em ${dt(g.referencias.ralie)}.`,
        `${perda ? "A grant is not a guaranteed entry: of the" : "Of the"} plants under implementation in the first RALIE snapshot (${dt(g.referencias.ralie_historico_desde)}), ${pc(d.operacao.pct_mw)} of the capacity entered operation, ${pc(d.outorga_encerrada.pct_mw)} had its grant revoked or extinguished and ${pc(d.em_implantacao.pct_mw)} was still under implementation on ${dt(g.referencias.ralie)}.`,
        idioma,
      ),
    );
  } else {
    partes.push(
      tx(
        "O desfecho das usinas da primeira fotografia do RALIE não está nesta publicação (sem dado).",
        "The outcome of the plants in the first RALIE snapshot is not in this release (no data).",
        idioma,
      ),
    );
  }
  return partes.join(" ");
}

/**
 * "O que mudou" do P040: carteira do RALIE entre a primeira e a última fotografia mensal
 * (direção decidida no arredondamento exibido) e encerramentos do ano mais recente ao
 * lado do ano anterior, sem palavra de comparação quando o ano mais recente é parcial.
 */
export function mudancaCarteira(g: Pick<ExpansaoGold, "estagios" | "referencias">, idioma: Idioma = idiomaEnergia()): string {
  const h = g.estagios.historico_mensal;
  const a = h[0];
  const b = h.at(-1);
  const partes: string[] = [];
  const i = (v: number | null | undefined) => inteiro(v, idioma);
  const mw = (v: number | null | undefined) => mwTexto(v, 1, idioma);
  const dt = (v: string | null | undefined) => dataTexto(v, idioma);
  if (a && b) {
    const dir = comparaArredondado(b.mw_ugs, a.mw_ugs, 1);
    const verbo = dir === "maior" ? tx("subiu", "rose", idioma) : dir === "menor" ? tx("caiu", "fell", idioma) : tx("ficou igual", "stayed the same", idioma);
    partes.push(
      tx(
        `A potência das unidades em implantação no RALIE ${verbo} entre ${mesTexto(a.ralie, idioma)} e ${mesTexto(b.ralie, idioma)}: de ${mw(a.mw_ugs)} para ${mw(b.mw_ugs)} na última fotografia de cada mês.`,
        `The capacity of the units under implementation in the RALIE ${verbo} between ${mesTexto(a.ralie, idioma)} and ${mesTexto(b.ralie, idioma)}: from ${mw(a.mw_ugs)} to ${mw(b.mw_ugs)} in the last snapshot of each month.`,
        idioma,
      ),
    );
  }
  const anos = g.estagios.encerramentos.por_ano;
  const ult = anos.at(-1);
  const ant = anos.at(-2);
  if (ult) {
    const parcial = ult.ano_parcial ? tx(` (ano parcial, atos publicados até ${dt(g.referencias.atos)})`, ` (partial year, acts published through ${dt(g.referencias.atos)})`, idioma) : "";
    const antes = ant
      ? tx(
          `; em ${ant.ano}${ant.ano_parcial ? " (parcial)" : ""}, foram ${i(ant.atos)} atos e ${mw(ant.mw_usinas)}`,
          `; in ${ant.ano}${ant.ano_parcial ? " (partial)" : ""}, there were ${i(ant.atos)} acts and ${mw(ant.mw_usinas)}`,
          idioma,
        )
      : "";
    partes.push(
      tx(
        `Em ${ult.ano}${parcial}, ${i(ult.atos)} atos revogaram ou extinguiram outorgas de ${i(ult.usinas)} usinas, com ${mw(ult.mw_usinas)}${antes}.`,
        `In ${ult.ano}${parcial}, ${i(ult.atos)} acts revoked or extinguished the grants of ${i(ult.usinas)} plants, with ${mw(ult.mw_usinas)}${antes}.`,
        idioma,
      ),
    );
  }
  return partes.join(" ");
}

/** Etapas do parque: as três fases do SIGA, na ordem do ciclo de vida, com a mesma medida (MW outorgado) para todas. */
export type LinhaEstagio = { id: Estagio; rotulo: string; usinas: number; mw_outorgado: number; mw_fiscalizado: number };
const ORDEM_ESTAGIO: Record<Estagio, number> = { construcao_nao_iniciada: 0, construcao: 1, operacao: 2, outro: 3 };
export function linhasEstagios(g: Pick<ExpansaoGold, "estagios">, idioma: Idioma = idiomaEnergia()): LinhaEstagio[] {
  return [...g.estagios.resumo]
    .sort((a, b) => ORDEM_ESTAGIO[a.estagio] - ORDEM_ESTAGIO[b.estagio])
    .map((r) => ({ id: r.estagio, rotulo: rotuloDado(r.rotulo, ESTAGIO_EN, idioma), usinas: r.usinas, mw_outorgado: r.mw_outorgado, mw_fiscalizado: r.mw_fiscalizado }));
}
export function colunasEstagios(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "rotulo", rotulo: tx("Estágio (fase no SIGA)", "Stage (SIGA phase)", idioma), tipo: "texto" },
    { id: "usinas", rotulo: tx("Usinas", "Plants", idioma), tipo: "numero", casas: 0 }, // i18n: dado
    { id: "mw_outorgado", rotulo: tx("Potência outorgada", "Granted capacity", idioma), tipo: "numero", unidade: "MW", casas: 1 },
    { id: "mw_fiscalizado", rotulo: tx("Potência fiscalizada", "Inspected capacity", idioma), tipo: "numero", unidade: "MW", casas: 1 },
  ];
}
export const COLUNAS_ESTAGIOS: ColunaTabela[] = colunasEstagios("pt");

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
export function linhasEstagiosTipo(g: Pick<ExpansaoGold, "estagios">, idioma: Idioma = idiomaEnergia()): LinhaEstagioTipo[] {
  return [...g.estagios.por_tipo]
    .map((t) => ({
      id: t.tipo,
      nome: `${nomeTipoDaGold(t.nome, idioma)} (${t.tipo})`,
      construcao_mw: t.construcao_mw_outorgado,
      nao_iniciada_mw: t.construcao_nao_iniciada_mw_outorgado,
      operacao_mw: t.operacao_mw_outorgado,
      construcao_usinas: t.construcao_usinas,
      nao_iniciada_usinas: t.construcao_nao_iniciada_usinas,
      operacao_usinas: t.operacao_usinas,
    }))
    .sort((a, b) => b.construcao_mw + b.nao_iniciada_mw - (a.construcao_mw + a.nao_iniciada_mw));
}
export function colunasEstagiosTipo(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "nome", rotulo: tx("Tipo de geração", "Generation type", idioma), tipo: "texto" },
    { id: "nao_iniciada_usinas", rotulo: tx("Outorgado sem obra, usinas", "Granted, no construction, plants", idioma), tipo: "numero", casas: 0 },
    { id: "nao_iniciada_mw", rotulo: tx("Outorgado sem obra", "Granted, no construction", idioma), tipo: "numero", unidade: tx("MW outorgado", "granted MW", idioma), casas: 1 },
    { id: "construcao_usinas", rotulo: tx("Em construção, usinas", "Under construction, plants", idioma), tipo: "numero", casas: 0 },
    { id: "construcao_mw", rotulo: tx("Em construção", "Under construction", idioma), tipo: "numero", unidade: tx("MW outorgado", "granted MW", idioma), casas: 1 },
    { id: "operacao_usinas", rotulo: tx("Em operação, usinas", "In operation, plants", idioma), tipo: "numero", casas: 0 },
    { id: "operacao_mw", rotulo: tx("Em operação", "In operation", idioma), tipo: "numero", unidade: tx("MW outorgado", "granted MW", idioma), casas: 1 },
  ];
}
export const COLUNAS_ESTAGIOS_TIPO: ColunaTabela[] = colunasEstagiosTipo("pt");

/** Medidas do mapa por UF do P040: as três fases do SIGA e a carteira do RALIE. */
export const MEDIDAS_CARTEIRA = ["nao_iniciada", "construcao", "operacao", "ralie"] as const;
export type MedidaCarteira = (typeof MEDIDAS_CARTEIRA)[number];
/** Medidas do mapa do P040 no idioma (rótulo, unidade e fonte). */
function medidasCarteira(idioma: Idioma): Record<MedidaCarteira, { rotulo: string; unidade: string; fonte: string }> {
  const siga = fonteExpansao(FONTE_SIGA, idioma);
  const mwOutorgado = tx("MW outorgado", "granted MW", idioma);
  return {
    nao_iniciada: { rotulo: tx("Outorgado, construção não iniciada", "Granted, construction not started", idioma), unidade: mwOutorgado, fonte: siga },
    construcao: { rotulo: tx("Em construção", "Under construction", idioma), unidade: mwOutorgado, fonte: siga },
    operacao: { rotulo: tx("Em operação", "In operation", idioma), unidade: mwOutorgado, fonte: siga },
    ralie: { rotulo: tx("Unidades em implantação (RALIE)", "Units under implementation (RALIE)", idioma), unidade: tx("MW das unidades", "MW of generating units", idioma), fonte: fonteExpansao(FONTE_RALIE, idioma) },
  };
}
export const MEDIDA_CARTEIRA = medidasCarteira("pt");
const MEDIDA_CARTEIRA_EN = medidasCarteira("en");
/** Medida do mapa do P040 no idioma (rótulo, unidade e fonte). */
export function medidaCarteira(m: MedidaCarteira, idioma: Idioma = idiomaEnergia()) {
  return (idioma === "en" ? MEDIDA_CARTEIRA_EN : MEDIDA_CARTEIRA)[m];
}

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
export function colunasCarteiraUf(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "nome", rotulo: tx("UF", "State", idioma), tipo: "texto", idiomaTexto: "nome" },
    { id: "id", rotulo: tx("Sigla", "Code", idioma), tipo: "texto" },
    { id: "nao_iniciada_mw", rotulo: tx("Outorgado sem obra", "Granted, no construction", idioma), tipo: "numero", unidade: tx("MW outorgado", "granted MW", idioma), casas: 1 },
    { id: "nao_iniciada_usinas", rotulo: tx("Outorgado sem obra, usinas", "Granted, no construction, plants", idioma), tipo: "numero", casas: 0 },
    { id: "construcao_mw", rotulo: tx("Em construção", "Under construction", idioma), tipo: "numero", unidade: tx("MW outorgado", "granted MW", idioma), casas: 1 },
    { id: "construcao_usinas", rotulo: tx("Em construção, usinas", "Under construction, plants", idioma), tipo: "numero", casas: 0 },
    { id: "operacao_mw", rotulo: tx("Em operação", "In operation", idioma), tipo: "numero", unidade: tx("MW outorgado", "granted MW", idioma), casas: 1 },
    { id: "operacao_usinas", rotulo: tx("Em operação, usinas", "In operation, plants", idioma), tipo: "numero", casas: 0 },
    { id: "ralie_mw", rotulo: tx("Unidades em implantação (RALIE)", "Units under implementation (RALIE)", idioma), tipo: "numero", unidade: "MW", casas: 1 },
  ];
}
export const COLUNAS_CARTEIRA_UF: ColunaTabela[] = colunasCarteiraUf("pt");
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
  usina: campo(tiposUrl.inteiro({ min: 1 }), 0, { param: "car.usina" }), // i18n: dado
};

/** RALIE: situação da obra × viabilidade (MW das unidades em implantação), com zero onde a combinação não ocorre. */
// i18n: dado (valores da gold)
export const VIABILIDADES = ["Alta", "Média", "Baixa"] as const;
// i18n: dado (valores da gold)
export const OBRAS_RALIE = ["Em andamento", "Paralisada", "Não Iniciada"] as const;
/** Rótulos do RALIE (viabilidade, situação da obra, do cronograma e justificativa) no idioma. */
export function rotuloViabilidade(v: string, idioma: Idioma = idiomaEnergia()): string {
  return rotuloDado(v, VIABILIDADE_EN, idioma);
}
export function rotuloObra(v: string, idioma: Idioma = idiomaEnergia()): string {
  return rotuloDado(v, OBRA_RALIE_EN, idioma);
}
export function rotuloSituacaoCronograma(v: string, idioma: Idioma = idiomaEnergia()): string {
  return rotuloDado(v, SITUACAO_CRONOGRAMA_EN, idioma);
}
export function rotuloJustificativa(v: string, idioma: Idioma = idiomaEnergia()): string {
  return rotuloDado(v, JUSTIFICATIVA_EN, idioma);
}
export type LinhaObraViabilidade = { id: string; obra: string; alta: number; media: number; baixa: number; usinas: number; mw_outorgado: number };
/**
 * A gold publica só as combinações que ocorrem (obra_x_viabilidade); como o cruzamento é
 * exaustivo (a soma das usinas é o total do RALIE, conferido no teste), a combinação
 * ausente é zero observado, não falta de dado.
 */
export function linhasObraViabilidade(g: Pick<ExpansaoGold, "estagios">, idioma: Idioma = idiomaEnergia()): LinhaObraViabilidade[] {
  const r = g.estagios.ralie;
  const obras = [...OBRAS_RALIE.filter((o) => r.por_obra.some((x) => x.situacao_obra === o)), ...r.por_obra.map((x) => x.situacao_obra).filter((o) => !(OBRAS_RALIE as readonly string[]).includes(o))];
  return obras.map((obra) => {
    const de = (v: string) => r.obra_x_viabilidade.find((x) => x.situacao_obra === obra && x.viabilidade === v)?.mw_ugs_em_implantacao ?? 0;
    const tot = r.por_obra.find((x) => x.situacao_obra === obra);
    // i18n: dado (as chaves "Alta", "Média" e "Baixa" são os valores da gold)
    return { id: obra, obra: rotuloDado(obra, OBRA_RALIE_EN, idioma), alta: de("Alta"), media: de("Média"), baixa: de("Baixa"), usinas: tot?.usinas ?? 0, mw_outorgado: tot?.mw_outorgado ?? 0 };
  });
}
export function colunasObraViabilidade(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "obra", rotulo: tx("Situação da obra", "Construction status", idioma), tipo: "texto" },
    { id: "usinas", rotulo: tx("Usinas", "Plants", idioma), tipo: "numero", casas: 0 }, // i18n: dado
    { id: "alta", rotulo: tx("Viabilidade alta", "High feasibility", idioma), tipo: "numero", unidade: "MW", casas: 1 },
    { id: "media", rotulo: tx("Viabilidade média", "Medium feasibility", idioma), tipo: "numero", unidade: "MW", casas: 1 },
    { id: "baixa", rotulo: tx("Viabilidade baixa", "Low feasibility", idioma), tipo: "numero", unidade: "MW", casas: 1 },
    { id: "mw_outorgado", rotulo: tx("Potência outorgada", "Granted capacity", idioma), tipo: "numero", unidade: "MW", casas: 1 },
  ];
}
export const COLUNAS_OBRA_VIABILIDADE: ColunaTabela[] = colunasObraViabilidade("pt");

export function linhasJustificativas(g: Pick<ExpansaoGold, "estagios">, idioma: Idioma = idiomaEnergia()) {
  return [...g.estagios.ralie.por_justificativa]
    .sort((a, b) => b.mw_ugs_em_implantacao - a.mw_ugs_em_implantacao)
    .map((j) => ({ id: j.justificativa, justificativa: rotuloDado(j.justificativa, JUSTIFICATIVA_EN, idioma), usinas: j.usinas, mw: j.mw_ugs_em_implantacao, mw_outorgado: j.mw_outorgado }));
}
export function colunasJustificativas(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "justificativa", rotulo: tx("Justificativa da previsão (fiscalização)", "Reason for the forecast (inspection)", idioma), tipo: "texto" },
    { id: "usinas", rotulo: tx("Usinas", "Plants", idioma), tipo: "numero", casas: 0 }, // i18n: dado
    { id: "mw", rotulo: tx("Unidades em implantação", "Units under implementation", idioma), tipo: "numero", unidade: "MW", casas: 1 },
    { id: "mw_outorgado", rotulo: tx("Potência outorgada", "Granted capacity", idioma), tipo: "numero", unidade: "MW", casas: 1 },
  ];
}
export const COLUNAS_JUSTIFICATIVAS: ColunaTabela[] = colunasJustificativas("pt");

/** Desfechos na ordem de leitura da barra: o que entrou, o que segue, o que saiu. */
export const DESFECHOS: readonly Desfecho[] = ["operacao", "em_implantacao", "outorga_encerrada", "sem_desfecho"];
function rotulosDesfecho(idioma: Idioma): Record<Desfecho, string> {
  return {
    operacao: tx("Entrou em operação", "Entered operation", idioma),
    em_implantacao: tx("Segue em implantação", "Still under implementation", idioma),
    outorga_encerrada: tx("Outorga revogada ou extinta", "Grant revoked or extinguished", idioma),
    sem_desfecho: tx("Saiu sem desfecho identificado", "Left with no identified outcome", idioma),
  };
}
export const ROTULO_DESFECHO: Record<Desfecho, string> = rotulosDesfecho("pt");
const ROTULO_DESFECHO_EN: Record<Desfecho, string> = rotulosDesfecho("en");
export function rotuloDesfecho(d: Desfecho, idioma: Idioma = idiomaEnergia()): string {
  return (idioma === "en" ? ROTULO_DESFECHO_EN : ROTULO_DESFECHO)[d];
}
/** Rótulo da coorte publicado pela gold ("Entraram no RALIE em 2021", "Estoque na primeira fotografia (17/06/2021)") no idioma. */
export function rotuloCoorte(rotulo: string, idioma: Idioma = idiomaEnergia()): string {
  if (idioma !== "en") return rotulo;
  const ano = /^Entraram no RALIE em (\d{4})$/.exec(rotulo); // i18n: dado
  if (ano) return `Entered the RALIE in ${ano[1]}`;
  const estoque = /^Estoque na primeira fotografia \((\d{2})\/(\d{2})\/(\d{4})\)$/.exec(rotulo); // i18n: dado
  if (estoque) return `Stock in the first snapshot (${dataBR(`${estoque[3]}-${estoque[2]}-${estoque[1]}`, idioma)})`;
  return rotulo;
}
export const COR_DESFECHO: Record<Desfecho, string> = {
  operacao: "var(--cor-energia)", // i18n: dado
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
export function linhasCoortes(g: Pick<ExpansaoGold, "estagios">, idioma: Idioma = idiomaEnergia()): LinhaCoorte[] {
  return g.estagios.coortes.map((c) => {
    const l: Record<string, string | number | null> = {
      id: c.coorte,
      rotulo: rotuloCoorte(c.rotulo, idioma),
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
export function colunasCoortes(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const r = (d: Desfecho) => rotuloDesfecho(d, idioma);
  return [
    { id: "rotulo", rotulo: tx("Coorte", "Cohort", idioma), tipo: "texto" },
    { id: "usinas", rotulo: tx("Usinas", "Plants", idioma), tipo: "numero", casas: 0 }, // i18n: dado
    { id: "mw_em_implantacao", rotulo: tx("Em implantação na primeira fotografia (peso)", "Under implementation in the first snapshot (weight)", idioma), tipo: "numero", unidade: "MW", casas: 1 },
    ...DESFECHOS.map((d): ColunaTabela => ({ id: `pct_${d}`, rotulo: r(d), tipo: "percentual", unidade: tx("% do MW", "% of MW", idioma), casas: 1 })),
    ...DESFECHOS.map((d): ColunaTabela => ({ id: `mw_desfecho_${d}`, rotulo: `${r(d)}, MW`, tipo: "numero", unidade: "MW", casas: 1 })),
    // i18n: dado (id da coluna)
    ...DESFECHOS.map((d): ColunaTabela => ({ id: `usinas_desfecho_${d}`, rotulo: tx(`${r(d)}, usinas`, `${r(d)}, plants`, idioma), tipo: "numero", casas: 0 })),
    { id: "usinas_que_ja_operavam", rotulo: tx("Ampliações (já operavam)", "Expansions (already operating)", idioma), tipo: "numero", casas: 0 },
  ];
}
export const COLUNAS_COORTES: ColunaTabela[] = colunasCoortes("pt");

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
export function marcosAtipicos(h: readonly HistoricoMensalRalie[], idioma: Idioma = idiomaEnergia()): { x: string; rotulo: string }[] {
  return h
    .filter((x) => x.usinas_atipicas_excluidas > 0)
    .map((x) => ({
      x: x.ralie,
      rotulo: tx(
        `${inteiro(x.usinas_atipicas_excluidas, idioma)} usinas com unidades fora de escala excluídas`,
        `${inteiro(x.usinas_atipicas_excluidas, idioma)} ${x.usinas_atipicas_excluidas === 1 ? "plant" : "plants"} with out-of-scale units excluded`,
        idioma,
      ),
    }));
}

/** Encerramentos por ano: potência uma vez por usina; ano parcial marcado no rótulo. */
export function linhasEncerramentos(anos: readonly EncerramentosAno[], idioma: Idioma = idiomaEnergia()) {
  return anos.map((a) => ({
    id: a.ano,
    ano: a.ano_parcial ? tx(`${a.ano} (parcial)`, `${a.ano} (partial)`, idioma) : a.ano,
    atos: a.atos,
    revogacoes: a.revogacoes,
    extincoes: a.extincoes,
    usinas: a.usinas,
    mw_usinas: a.mw_usinas,
    usinas_em_operacao_no_siga: a.usinas_em_operacao_no_siga,
    atos_sem_chave_de_usina: a.atos_sem_chave_de_usina,
  }));
}
export function colunasEncerramentos(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "ano", rotulo: tx("Ano de publicação", "Year of publication", idioma), tipo: "texto" }, // i18n: dado
    { id: "atos", rotulo: tx("Atos", "Acts", idioma), tipo: "numero", casas: 0 },
    { id: "revogacoes", rotulo: tx("Revogações", "Revocations", idioma), tipo: "numero", casas: 0 },
    { id: "extincoes", rotulo: tx("Extinções", "Extinctions", idioma), tipo: "numero", casas: 0 },
    { id: "usinas", rotulo: tx("Usinas", "Plants", idioma), tipo: "numero", casas: 0 }, // i18n: dado
    { id: "mw_usinas", rotulo: tx("Potência das usinas", "Capacity of the plants", idioma), tipo: "numero", unidade: "MW", casas: 1 },
    { id: "usinas_em_operacao_no_siga", rotulo: tx("Seguem em operação no SIGA", "Still in operation in SIGA", idioma), tipo: "numero", casas: 0 },
    { id: "atos_sem_chave_de_usina", rotulo: tx("Atos sem chave de usina", "Acts without a plant key", idioma), tipo: "numero", casas: 0 },
  ];
}
export const COLUNAS_ENCERRAMENTOS: ColunaTabela[] = colunasEncerramentos("pt");

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
function classesPonto(idioma: Idioma) {
  return [
    { ate: 30, raio: 1, rotulo: tx("até 30 MW", "up to 30 MW", idioma) },
    { ate: 300, raio: 2, rotulo: tx("mais de 30 até 300 MW", "over 30 up to 300 MW", idioma) },
    { ate: Infinity, raio: 3.5, rotulo: tx("mais de 300 MW", "over 300 MW", idioma) },
  ] as const;
}
export const CLASSES_PONTO = classesPonto("pt");
const CLASSES_PONTO_EN = classesPonto("en");
/** Rótulo da classe de tamanho do ponto no idioma. */
export function rotuloClassePonto(i: number, idioma: Idioma = idiomaEnergia()): string {
  return (idioma === "en" ? CLASSES_PONTO_EN : CLASSES_PONTO)[i].rotulo;
}
export function classePonto(mw: number | null): number {
  if (!temValor(mw)) return 0;
  const i = CLASSES_PONTO.findIndex((c) => mw <= c.ate);
  return i < 0 ? CLASSES_PONTO.length - 1 : i;
}
function rotulosEstagio(idioma: Idioma): Record<Estagio, string> {
  return {
    construcao_nao_iniciada: tx("Outorgado, construção não iniciada", "Granted, construction not started", idioma),
    construcao: tx("Em construção", "Under construction", idioma),
    operacao: tx("Em operação", "In operation", idioma),
    outro: tx("Outra fase", "Other phase", idioma),
  };
}
export const ROTULO_ESTAGIO: Record<Estagio, string> = rotulosEstagio("pt");
const ROTULO_ESTAGIO_EN: Record<Estagio, string> = rotulosEstagio("en");
export function rotuloEstagio(e: Estagio, idioma: Idioma = idiomaEnergia()): string {
  return (idioma === "en" ? ROTULO_ESTAGIO_EN : ROTULO_ESTAGIO)[e];
}
export function colunasPontos(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "nome", rotulo: tx("Usina", "Plant", idioma), tipo: "texto", idiomaTexto: "nome" },
    { id: "nucleo", rotulo: tx("Núcleo do CEG", "CEG core", idioma), tipo: "numero", casas: 0, buscavel: true },
    { id: "tipo", rotulo: tx("Tipo", "Type", idioma), tipo: "texto", categorica: true },
    { id: "estagio", rotulo: tx("Estágio", "Stage", idioma), tipo: "texto", categorica: true },
    { id: "uf", rotulo: tx("UF", "State", idioma), tipo: "texto", categorica: true },
    { id: "mw_outorgado", rotulo: tx("Potência outorgada", "Granted capacity", idioma), tipo: "numero", unidade: "MW", casas: 1 },
    { id: "mw_fiscalizado", rotulo: tx("Potência fiscalizada", "Inspected capacity", idioma), tipo: "numero", unidade: "MW", casas: 1 },
  ];
}
export const COLUNAS_PONTOS: ColunaTabela[] = colunasPontos("pt");
export function linhasPontos(pts: readonly UsinaPonto[], idioma: Idioma = idiomaEnergia()) {
  return pts.map((p) => ({
    id: String(p.nucleo),
    nome: p.nome,
    nucleo: p.nucleo,
    tipo: p.tipo,
    estagio: rotuloEstagio(p.estagio, idioma),
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
export function respostaCronograma(g: Pick<ExpansaoGold, "cronograma">, idioma: Idioma = idiomaEnergia()): string {
  const pa = g.cronograma.previsoes_atuais;
  const anoFoto = pa.data_ralie.slice(0, 4);
  const anos = [...pa.por_ano].sort((a, b) => a.ano.localeCompare(b.ano)).slice(0, 2);
  const mw = (v: number | null | undefined) => mwTexto(v, 1, idioma);
  const pc = (v: number | null | undefined) => pctTexto(v, 1, idioma);
  const dt = (v: string | null | undefined) => dataTexto(v, idioma);
  const quando = anos.map((a) => `${mw(a.mw)} ${a.ano === anoFoto ? tx(`no restante de ${a.ano}`, `in the rest of ${a.ano}`, idioma) : tx(`em ${a.ano}`, `in ${a.ano}`, idioma)}`);
  const lista = quando.length ? listaTexto(quando, idioma) : semDado(idioma);
  const partes = [
    tx(
      `Na fotografia do RALIE de ${dt(pa.data_ralie)}, a fiscalização da ANEEL prevê a entrada em operação comercial de ${lista}.`,
      `In the RALIE snapshot of ${dt(pa.data_ralie)}, ANEEL's inspection expects ${lista} to enter commercial operation.`,
      idioma,
    ),
  ];
  const b = pa.datas_em_bloco;
  if (b && b.datas.length) {
    const datas = listaTexto(
      b.datas.map((d) => dt(d)),
      idioma,
    );
    partes.push(
      tx(
        `Outros ${mw(b.mw)} têm previsão numa data convencional atribuída em bloco (${datas}), que não é cronograma de obra.`,
        `Another ${mw(b.mw)} is forecast for a conventional date assigned in bulk (${datas}), which is not a construction schedule.`,
        idioma,
      ),
    );
  }
  const c = ultimaConfiabilidade(g);
  if (c) {
    partes.push(
      tx(
        `Do que a fotografia de ${dt(c.ralie)} previa para os 12 meses seguintes, ${pc(c.pct_no_prazo)} da potência foi liberada para operação comercial no prazo, ${pc(c.pct_depois)} depois e ${pc(c.pct_nao_liberado)} não tinha sido liberada até ${dt(g.cronograma.data_liberacoes)}.`,
        `Of what the snapshot of ${dt(c.ralie)} forecast for the following 12 months, ${pc(c.pct_no_prazo)} of the capacity was released for commercial operation on time, ${pc(c.pct_depois)} later and ${pc(c.pct_nao_liberado)} had not been released by ${dt(g.cronograma.data_liberacoes)}.`,
        idioma,
      ),
    );
  }
  const at = g.cronograma.por_situacao_cronograma.find((s) => s.situacao === "Atrasado");
  if (at)
    partes.push(
      tx(
        `A fiscalização classifica ${inteiro(at.usinas, idioma)} usinas, com ${mw(at.mw_outorgado)} outorgados, com cronograma atrasado.`,
        `The inspection classifies ${inteiro(at.usinas, idioma)} plants, with ${mw(at.mw_outorgado)} granted, as behind schedule.`,
        idioma,
      ),
    );
  return partes.join(" ");
}

/** "O que mudou" do P041: revisão das previsões entre fotografias com 12 meses de distância, com e sem as datas em bloco. */
export function mudancaCronograma(g: Pick<ExpansaoGold, "cronograma">, idioma: Idioma = idiomaEnergia()): string {
  const d = ultimoDeslizamento(g);
  if (!d)
    return tx(
      "Sem pares de fotografias com 12 meses de distância nesta publicação (sem dado).",
      "No pairs of snapshots 12 months apart in this release (no data).",
      idioma,
    );
  const s = d.sem_datas_em_bloco;
  const pc = (v: number | null | undefined) => pctTexto(v, 1, idioma);
  const dt = (v: string | null | undefined) => dataTexto(v, idioma);
  return tx(
    `Entre as fotografias de ${dt(d.ralie)} e ${dt(d.ralie_seguinte)}, ${pc(d.pct_adiada)} da potência que seguia em implantação teve a previsão adiada, ${pc(d.pct_mantida)} manteve e ${pc(d.pct_antecipada)} antecipou (adiamento mediano, ponderado pela potência: ${diasTexto(d.mediana_dias_ponderada, idioma)}). Sem as unidades em data em bloco, que andam com a fotografia, as parcelas são ${pc(s.pct_adiada)}, ${pc(s.pct_mantida)} e ${pc(s.pct_antecipada)} (adiamento mediano de ${diasTexto(s.mediana_dias_ponderada, idioma)}).`,
    `Between the snapshots of ${dt(d.ralie)} and ${dt(d.ralie_seguinte)}, ${pc(d.pct_adiada)} of the capacity still under implementation had its forecast postponed, ${pc(d.pct_mantida)} kept it and ${pc(d.pct_antecipada)} brought it forward (capacity-weighted median postponement: ${diasTexto(d.mediana_dias_ponderada, idioma)}). Without the units on bulk-assigned dates, which move with the snapshot, the shares are ${pc(s.pct_adiada)}, ${pc(s.pct_mantida)} and ${pc(s.pct_antecipada)} (median postponement of ${diasTexto(s.mediana_dias_ponderada, idioma)}).`,
    idioma,
  );
}

/** Viabilidade na URL sem acento; o rótulo é o da fonte. */
export const IDS_VIABILIDADE = ["alta", "media", "baixa"] as const;
export type IdViabilidade = (typeof IDS_VIABILIDADE)[number];
// i18n: dado (valores da gold)
export const VIABILIDADE_DO_ID: Record<IdViabilidade, (typeof VIABILIDADES)[number]> = { alta: "Alta", media: "Média", baixa: "Baixa" };
export const COR_VIABILIDADE: Record<IdViabilidade, string> = {
  alta: "var(--escala-seq-5)",
  media: "var(--escala-seq-3)",
  baixa: "var(--escala-seq-1)",
};
export const ESQUEMA_CRONOGRAMA = {
  via: campo(tiposUrl.lista(tiposUrl.opcao(IDS_VIABILIDADE)), [...IDS_VIABILIDADE] as IdViabilidade[], { param: "cro.via" }),
  // i18n: dado
  bloco: campo(tiposUrl.opcao(["com", "sem"] as const), "com", { param: "cro.bloco" }),
  de: campo(tiposUrl.data(), "", { param: "cro.de" }), // i18n: dado
  ate: campo(tiposUrl.data(), "", { param: "cro.ate" }),
};

/**
 * Anos (AAAA) que contêm as datas em bloco da fotografia: previsões convencionais que a fiscalização atribui em lote, e não
 * cronograma de obra. A lista de datas é a publicada pela gold; só o ano de cada data é lido.
 */
export function anosComDataEmBloco(g: Pick<ExpansaoGold, "cronograma">): string[] {
  return Array.from(new Set(g.cronograma.previsoes_atuais.datas_em_bloco.datas.map((d) => d.slice(0, 4)))).sort();
}

/**
 * Previsões por ano: uma coluna por viabilidade (MW das unidades), na ordem dos anos. `inclui_bloco` marca o ano que contém
 * datas em bloco, para a tabela e a exportação carregarem a separação que o gráfico faz.
 */
export function linhasPrevisoesAno(g: Pick<ExpansaoGold, "cronograma">, idioma: Idioma = idiomaEnergia()) {
  const comBloco = new Set(anosComDataEmBloco(g));
  return [...g.cronograma.previsoes_atuais.por_ano]
    .sort((a, b) => a.ano.localeCompare(b.ano))
    .map((a) => ({
      id: a.ano,
      ano: a.ano,
      ugs: a.ugs,
      mw: a.mw,
      alta: a.por_viabilidade.Alta,
      media: a.por_viabilidade["Média"],
      baixa: a.por_viabilidade.Baixa,
      inclui_bloco: comBloco.has(a.ano) ? tx("sim", "yes", idioma) : tx("não", "no", idioma),
    }));
}
/**
 * Cronograma da fiscalização separado das datas convencionais: as linhas do gráfico por ano são as publicadas, sem o ano que
 * contém as datas em bloco (uma barra de dezenas de GW numa data convencional esconde o cronograma dos outros anos). O ano
 * excluído, as datas e a potência das datas em bloco saem à parte, cada número como a gold o publica, sem subtração.
 */
export function previsoesPorAnoSeparadas(g: Pick<ExpansaoGold, "cronograma">, idioma: Idioma = idiomaEnergia()) {
  const comBloco = new Set(anosComDataEmBloco(g));
  const linhas = linhasPrevisoesAno(g, idioma);
  const b = g.cronograma.previsoes_atuais.datas_em_bloco;
  return {
    cronograma: linhas.filter((l) => !comBloco.has(l.ano)),
    anosEmBloco: linhas.filter((l) => comBloco.has(l.ano)).map((l) => ({ ano: l.ano, mw: l.mw })),
    datas: b.datas,
    mwEmBloco: b.mw,
    ugsEmBloco: b.ugs,
  };
}
/** Frase que diz o que o gráfico por ano deixa de fora (o ano das datas em bloco) e onde está; vazia quando nenhum ano contém data em bloco. */
export function textoAnoDasDatasEmBloco(g: Pick<ExpansaoGold, "cronograma">, idioma: Idioma = idiomaEnergia()): string {
  const sep = previsoesPorAnoSeparadas(g, idioma);
  if (!sep.anosEmBloco.length) return "";
  const anos = listaTexto(
    sep.anosEmBloco.map((a) => tx(`${a.ano} (${mwTexto(a.mw, 1, idioma)} com previsão no ano)`, `${a.ano} (${mwTexto(a.mw, 1, idioma)} forecast in the year)`, idioma)),
    idioma,
  );
  const um = sep.anosEmBloco.length === 1;
  const datas = listaTexto(
    sep.datas.map((d) => dataTexto(d, idioma)),
    idioma,
  );
  return tx(
    `O gráfico por ano não inclui ${anos}: ${um ? "é o ano" : "são os anos"} das datas em bloco ${datas}, datas convencionais que somam ${mwTexto(sep.mwEmBloco, 1, idioma)} e não são cronograma de obra. A tabela abaixo traz todos os anos.`,
    `The chart by year does not include ${anos}: ${um ? "it is the year" : "they are the years"} of the bulk-assigned dates ${datas}, conventional dates that add up to ${mwTexto(sep.mwEmBloco, 1, idioma)} and are not a construction schedule. The table below shows every year.`,
    idioma,
  );
}
/** Primeiro ano com previsão (o ano da fotografia é "o restante do ano"), como o veredito do cronograma o escolhe. */
export function previsaoPrimeiroAno(g: Pick<ExpansaoGold, "cronograma">): { ano: string; mw: number; restante: boolean } | null {
  const pa = g.cronograma.previsoes_atuais;
  const primeiro = [...pa.por_ano].sort((a, b) => a.ano.localeCompare(b.ano))[0];
  return primeiro ? { ano: primeiro.ano, mw: primeiro.mw, restante: primeiro.ano === pa.data_ralie.slice(0, 4) } : null;
}
/** Usinas e potência outorgada que a própria fiscalização classifica com cronograma atrasado na fotografia atual. */
export function cronogramaAtrasadoDaFiscalizacao(g: Pick<ExpansaoGold, "cronograma">): { usinas: number; mw_outorgado: number } | null {
  const s = g.cronograma.por_situacao_cronograma.find((x) => x.situacao === "Atrasado");
  return s ? { usinas: s.usinas, mw_outorgado: s.mw_outorgado } : null;
}
export function linhasProximos24(g: Pick<ExpansaoGold, "cronograma">, idioma: Idioma = idiomaEnergia()) {
  return [...g.cronograma.previsoes_atuais.proximos_24_meses]
    .sort((a, b) => a.mes.localeCompare(b.mes))
    .map((m) => ({ id: m.mes, mes: mesTexto(m.mes, idioma), mw: m.mw, alta: m.por_viabilidade.Alta, media: m.por_viabilidade["Média"], baixa: m.por_viabilidade.Baixa }));
}
export function colunasPrevisoesAno(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "ano", rotulo: tx("Ano previsto", "Forecast year", idioma), tipo: "texto" }, // i18n: dado
    { id: "ugs", rotulo: tx("Unidades geradoras", "Generating units", idioma), tipo: "numero", casas: 0 },
    { id: "mw", rotulo: tx("Potência prevista", "Forecast capacity", idioma), tipo: "numero", unidade: "MW", casas: 1 },
    { id: "alta", rotulo: tx("Viabilidade alta", "High feasibility", idioma), tipo: "numero", unidade: "MW", casas: 1 },
    { id: "media", rotulo: tx("Viabilidade média", "Medium feasibility", idioma), tipo: "numero", unidade: "MW", casas: 1 },
    { id: "baixa", rotulo: tx("Viabilidade baixa", "Low feasibility", idioma), tipo: "numero", unidade: "MW", casas: 1 },
    { id: "inclui_bloco", rotulo: tx("Inclui data em bloco", "Includes a bulk-assigned date", idioma), tipo: "texto", categorica: true },
  ];
}
export const COLUNAS_PREVISOES_ANO: ColunaTabela[] = colunasPrevisoesAno("pt");

/** Datas mais frequentes, com a marca de data em bloco publicada pela gold. */
export function linhasDatasFrequentes(g: Pick<ExpansaoGold, "cronograma">, idioma: Idioma = idiomaEnergia()) {
  return g.cronograma.previsoes_atuais.datas_mais_frequentes.map((d) => ({
    id: d.data,
    data: d.data,
    usinas: d.usinas,
    ugs: d.ugs,
    mw: d.mw,
    em_bloco: d.em_bloco ? tx("sim", "yes", idioma) : tx("não", "no", idioma),
  }));
}
export function colunasDatasFrequentes(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "data", rotulo: tx("Data prevista", "Forecast date", idioma), tipo: "data" },
    { id: "usinas", rotulo: tx("Usinas", "Plants", idioma), tipo: "numero", casas: 0 }, // i18n: dado
    { id: "ugs", rotulo: tx("Unidades", "Units", idioma), tipo: "numero", casas: 0 },
    { id: "mw", rotulo: tx("Potência", "Capacity", idioma), tipo: "numero", unidade: "MW", casas: 1 },
    { id: "em_bloco", rotulo: tx("Data em bloco", "Bulk-assigned date", idioma), tipo: "texto", categorica: true },
  ];
}
export const COLUNAS_DATAS_FREQUENTES: ColunaTabela[] = colunasDatasFrequentes("pt");

export function linhasSemPrevisao(g: Pick<ExpansaoGold, "cronograma">, idioma: Idioma = idiomaEnergia()) {
  return [...g.cronograma.previsoes_atuais.sem_previsao]
    .sort((a, b) => b.mw - a.mw)
    .map((s) => ({ id: s.justificativa, justificativa: rotuloDado(s.justificativa, JUSTIFICATIVA_EN, idioma), ugs: s.ugs, mw: s.mw }));
}
export function colunasSemPrevisao(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "justificativa", rotulo: tx("Justificativa da fiscalização", "Inspection's reason", idioma), tipo: "texto" },
    { id: "ugs", rotulo: tx("Unidades", "Units", idioma), tipo: "numero", casas: 0 },
    { id: "mw", rotulo: tx("Potência", "Capacity", idioma), tipo: "numero", unidade: "MW", casas: 1 },
  ];
}
export const COLUNAS_SEM_PREVISAO: ColunaTabela[] = colunasSemPrevisao("pt");

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
export function colunasConfiabilidade(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "ralie", rotulo: tx("Fotografia (data-base)", "Snapshot (base date)", idioma), tipo: "data" },
    { id: "fim_janela", rotulo: tx("Fim da janela", "End of window", idioma), tipo: "data" },
    { id: "ugs", rotulo: tx("Unidades", "Units", idioma), tipo: "numero", casas: 0 },
    { id: "mw_prometido", rotulo: tx("Previsto para 12 meses", "Forecast for 12 months", idioma), tipo: "numero", unidade: "MW", casas: 1 },
    { id: "mw_no_prazo", rotulo: tx("Liberado no prazo", "Released on time", idioma), tipo: "numero", unidade: "MW", casas: 1 },
    { id: "mw_depois", rotulo: tx("Liberado depois", "Released later", idioma), tipo: "numero", unidade: "MW", casas: 1 },
    { id: "mw_nao_liberado", rotulo: tx("Não liberado", "Not released", idioma), tipo: "numero", unidade: "MW", casas: 1 },
    { id: "pct_no_prazo", rotulo: tx("No prazo", "On time", idioma), tipo: "percentual", casas: 1 },
    { id: "pct_depois", rotulo: tx("Depois", "Later", idioma), tipo: "percentual", casas: 1 },
    { id: "pct_nao_liberado", rotulo: tx("Não liberado", "Not released", idioma), tipo: "percentual", casas: 1 },
  ];
}
export const COLUNAS_CONFIABILIDADE: ColunaTabela[] = colunasConfiabilidade("pt");
export function linhasConfiabilidadeTipo(g: Pick<ExpansaoGold, "cronograma">, idioma: Idioma = idiomaEnergia()) {
  return [...g.cronograma.confiabilidade_ultima_por_tipo]
    .sort((a, b) => b.mw_prometido - a.mw_prometido)
    .map((t) => ({ id: t.tipo, tipo: `${nomeTipo(t.tipo, idioma)} (${t.tipo})`, mw_prometido: t.mw_prometido, mw_no_prazo: t.mw_no_prazo, pct_no_prazo: t.pct_no_prazo }));
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
export function colunasDeslizamento(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "ralie", rotulo: tx("Fotografia S", "Snapshot S", idioma), tipo: "data" },
    { id: "ralie_seguinte", rotulo: tx("Fotografia S + 12 meses", "Snapshot S + 12 months", idioma), tipo: "data" },
    { id: "ugs", rotulo: tx("Unidades nas duas", "Units in both", idioma), tipo: "numero", casas: 0 },
    { id: "mw", rotulo: tx("Potência", "Capacity", idioma), tipo: "numero", unidade: "MW", casas: 1 },
    { id: "pct_adiada", rotulo: tx("Adiada", "Postponed", idioma), tipo: "percentual", casas: 1 },
    { id: "pct_mantida", rotulo: tx("Mantida", "Kept", idioma), tipo: "percentual", casas: 1 },
    { id: "pct_antecipada", rotulo: tx("Antecipada", "Brought forward", idioma), tipo: "percentual", casas: 1 },
    { id: "mediana_dias", rotulo: tx("Mediana ponderada da revisão", "Weighted median revision", idioma), tipo: "numero", unidade: tx("dias", "days", idioma), casas: 0 },
    { id: "pct_mw_em_data_em_bloco", rotulo: tx("Potência em data em bloco (S ou S + 12)", "Capacity on a bulk-assigned date (S or S + 12)", idioma), tipo: "percentual", casas: 1 },
  ];
}
export const COLUNAS_DESLIZAMENTO: ColunaTabela[] = colunasDeslizamento("pt");

/** Desvio da liberação comercial em relação ao prazo outorgado vigente, por ano (não é atraso). */
export function linhasDesvioPrazo(g: Pick<ExpansaoGold, "cronograma">, idioma: Idioma = idiomaEnergia()) {
  return g.cronograma.desvio_prazo_vigente.por_ano.map((a) => ({
    id: a.ano,
    ano: a.ano_parcial ? tx(`${a.ano} (parcial)`, `${a.ano} (partial)`, idioma) : a.ano,
    unidades: a.unidades_ou_grupos,
    mw_liberado: a.mw_liberado,
    mw_com_data_outorgada: a.mw_com_data_outorgada,
    mw_sem_data_outorgada: a.mw_sem_data_outorgada,
    pct_depois: a.pct_mw_depois_do_prazo,
    pct_antes: a.pct_mw_antes_do_prazo,
    mediana_dias: a.mediana_desvio_dias_ponderada,
  }));
}
export function colunasDesvioPrazo(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "ano", rotulo: tx("Ano da liberação", "Year of release", idioma), tipo: "texto" }, // i18n: dado
    { id: "unidades", rotulo: tx("Unidades ou grupos", "Units or groups", idioma), tipo: "numero", casas: 0 },
    { id: "mw_liberado", rotulo: tx("Liberado", "Released", idioma), tipo: "numero", unidade: "MW", casas: 1 },
    { id: "mw_com_data_outorgada", rotulo: tx("Com data outorgada (denominador)", "With a granted date (denominator)", idioma), tipo: "numero", unidade: "MW", casas: 1 },
    { id: "mw_sem_data_outorgada", rotulo: tx("Sem data outorgada", "Without a granted date", idioma), tipo: "numero", unidade: "MW", casas: 1 },
    { id: "pct_depois", rotulo: tx("Depois do prazo vigente", "After the current deadline", idioma), tipo: "percentual", casas: 1 },
    { id: "pct_antes", rotulo: tx("Antes do prazo vigente", "Before the current deadline", idioma), tipo: "percentual", casas: 1 },
    { id: "mediana_dias", rotulo: tx("Mediana ponderada do desvio", "Weighted median deviation", idioma), tipo: "numero", unidade: tx("dias", "days", idioma), casas: 0 },
  ];
}
export const COLUNAS_DESVIO_PRAZO: ColunaTabela[] = colunasDesvioPrazo("pt");

/** Maiores usinas atrasadas, com a marca de previsão em data em bloco (a "previsão" é a data convencional). */
export function linhasAtrasadas(g: Pick<ExpansaoGold, "cronograma">, idioma: Idioma = idiomaEnergia()) {
  const bloco = new Set(g.cronograma.previsoes_atuais.datas_em_bloco.datas);
  return g.cronograma.maiores_atrasadas.map((u: UsinaAtrasada) => ({
    id: String(u.nucleo),
    nome: u.nome,
    tipo: u.tipo,
    uf: u.uf,
    mw_outorgado: u.mw_outorgado,
    situacao_obra: u.situacao_obra === null ? null : rotuloDado(u.situacao_obra, OBRA_RALIE_EN, idioma),
    viabilidade: u.viabilidade === null ? null : rotuloDado(u.viabilidade, VIABILIDADE_EN, idioma),
    justificativa: u.justificativa === null ? null : rotuloDado(u.justificativa, JUSTIFICATIVA_EN, idioma),
    outorgado_max: u.outorgado_max,
    previsao_max: u.previsao_max,
    previsao_em_bloco: u.previsao_max === null ? null : bloco.has(u.previsao_max) ? tx("sim", "yes", idioma) : tx("não", "no", idioma),
    atraso_previsto_dias: u.atraso_previsto_dias,
  }));
}
export function colunasAtrasadas(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "nome", rotulo: tx("Usina", "Plant", idioma), tipo: "texto", idiomaTexto: "nome" },
    { id: "tipo", rotulo: tx("Tipo", "Type", idioma), tipo: "texto", categorica: true },
    { id: "uf", rotulo: tx("UF", "State", idioma), tipo: "texto", categorica: true },
    { id: "mw_outorgado", rotulo: tx("Potência outorgada", "Granted capacity", idioma), tipo: "numero", unidade: "MW", casas: 1 },
    { id: "situacao_obra", rotulo: tx("Obra", "Construction", idioma), tipo: "texto", categorica: true },
    { id: "viabilidade", rotulo: tx("Viabilidade", "Feasibility", idioma), tipo: "texto", categorica: true },
    { id: "justificativa", rotulo: tx("Justificativa", "Reason", idioma), tipo: "texto" },
    { id: "outorgado_max", rotulo: tx("Data outorgada (última unidade)", "Granted date (last unit)", idioma), tipo: "data" },
    { id: "previsao_max", rotulo: tx("Previsão da fiscalização (última unidade)", "Inspection forecast (last unit)", idioma), tipo: "data" },
    { id: "previsao_em_bloco", rotulo: tx("Previsão em data em bloco", "Forecast on a bulk-assigned date", idioma), tipo: "texto", categorica: true },
    { id: "atraso_previsto_dias", rotulo: tx("Previsão menos data outorgada", "Forecast minus granted date", idioma), tipo: "numero", unidade: tx("dias", "days", idioma), casas: 0 },
  ];
}
export const COLUNAS_ATRASADAS: ColunaTabela[] = colunasAtrasadas("pt");

/* ================================================================ P042: geração e transmissão */

/**
 * Resposta curta do P042. Regra: obras de transmissão em andamento no SIGET (km de
 * circuito e MVA novos), geração em implantação no RALIE e, para as três UF com mais
 * geração em implantação, os km de linhas em obra que tocam a UF, lado a lado. As
 * grandezas não se somam nem se dividem; a frase final diz por quê.
 */
export function respostaTransmissao(g: Pick<ExpansaoGold, "transmissao" | "estagios">, idioma: Idioma = idiomaEnergia()): string {
  const o = g.transmissao.obras;
  const r = g.estagios.ralie;
  const top = [...g.transmissao.geracao_e_rede_por_uf]
    .filter((u) => temValor(u.mw_ugs_em_implantacao))
    .sort((a, b) => b.mw_ugs_em_implantacao - a.mw_ugs_em_implantacao)
    .slice(0, 3);
  const mw = (v: number | null | undefined) => mwTexto(v, 1, idioma);
  const km = (v: number | null | undefined) => kmTexto(v, 1, idioma);
  const dt = (v: string | null | undefined) => dataTexto(v, idioma);
  const partes = [
    tx(
      `Em ${dt(o.data_referencia)}, o SIGET da ANEEL registra ${inteiro(o.em_andamento.empreendimentos, idioma)} empreendimentos de transmissão em andamento, com ${km(o.em_andamento.km_lt_novas)} de circuito em linhas novas e ${mvaTexto(o.em_andamento.mva_tr_novos, 1, idioma)} de transformação nova; o RALIE acompanha ${mw(r.mw_ugs_em_implantacao)} de geração em implantação (fotografia de ${dt(r.data_ralie)}).`,
      `On ${dt(o.data_referencia)}, ANEEL's SIGET records ${inteiro(o.em_andamento.empreendimentos, idioma)} transmission projects in progress, with ${km(o.em_andamento.km_lt_novas)} of circuit in new lines and ${mvaTexto(o.em_andamento.mva_tr_novos, 1, idioma)} of new transformation; the RALIE monitors ${mw(r.mw_ugs_em_implantacao)} of generation under implementation (snapshot of ${dt(r.data_ralie)}).`,
      idioma,
    ),
  ];
  if (top.length) {
    const lista = listaTexto(
      top.map((u) =>
        tx(
          `${NOME_UF[u.uf] ?? u.uf} tem ${mw(u.mw_ugs_em_implantacao)} de geração e ${km(u.km_lt_em_andamento_toca_uf)} de linhas em obra que tocam a UF`,
          `${NOME_UF[u.uf] ?? u.uf} has ${mw(u.mw_ugs_em_implantacao)} of generation and ${km(u.km_lt_em_andamento_toca_uf)} of lines under construction that touch the state`,
          idioma,
        ),
      ),
      idioma,
    );
    partes.push(
      tx(
        `${top.length === 1 ? "Na UF" : `Nas ${porExtenso(top.length, "f", idioma)} UF`} com mais geração em implantação, ${lista}.`,
        `${top.length === 1 ? "In the state" : `In the ${porExtenso(top.length, "f", idioma)} states`} with the most generation under implementation, ${lista}.`,
        idioma,
      ),
    );
  }
  partes.push(
    tx(
      "MW, km e MVA não se somam nem se dividem: a capacidade de escoar a geração depende da topologia e dos limites da rede, que esses totais não descrevem.",
      "MW, km and MVA are neither added nor divided: the capacity to carry the generation depends on the grid's topology and limits, which these totals do not describe.",
      idioma,
    ),
  );
  return partes.join(" ");
}

/** "O que mudou" do P042: último ano completo e ano parcial da série anual, e o fim do arquivo aberto de leilões. */
export function mudancaTransmissao(g: Pick<ExpansaoGold, "transmissao">, idioma: Idioma = idiomaEnergia()): string {
  const s = [...g.transmissao.serie_anual].sort((a, b) => a.ano.localeCompare(b.ano));
  const completo = [...s].reverse().find((x) => !x.ano_parcial);
  const parcial = s.at(-1)?.ano_parcial ? s.at(-1) : undefined;
  const partes: string[] = [];
  const mw = (v: number | null | undefined) => mwTexto(v, 1, idioma);
  const km = (v: number | null | undefined) => kmTexto(v, 1, idioma);
  const mva = (v: number | null | undefined) => mvaTexto(v, 1, idioma);
  if (completo) {
    partes.push(
      tx(
        `Em ${completo.ano}, foram liberados ${mw(completo.mw_geracao_liberada)} de geração para operação comercial e energizados ${km(completo.km_lt_energizados)} de linhas novas e ${mva(completo.mva_tr_energizados)} de transformação.`,
        `In ${completo.ano}, ${mw(completo.mw_geracao_liberada)} of generation was released for commercial operation and ${km(completo.km_lt_energizados)} of new lines and ${mva(completo.mva_tr_energizados)} of transformation were energized.`,
        idioma,
      ),
    );
  }
  if (parcial) {
    partes.push(
      tx(
        `Em ${parcial.ano}, ano parcial, já são ${mw(parcial.mw_geracao_liberada)}, ${km(parcial.km_lt_energizados)} e ${mva(parcial.mva_tr_energizados)}.`,
        `In ${parcial.ano}, a partial year, the totals are already ${mw(parcial.mw_geracao_liberada)}, ${km(parcial.km_lt_energizados)} and ${mva(parcial.mva_tr_energizados)}.`,
        idioma,
      ),
    );
  }
  const u = g.transmissao.leiloes.ultimo_leilao;
  if (u.leilao) {
    const ausentes = s.filter((x) => x.ano > (u.data ?? "").slice(0, 4) && x.km_contratados_leilao === null).map((x) => x.ano);
    const um = ausentes.length === 1;
    const resto = ausentes.length
      ? tx(
          `: ${listaTexto(ausentes, idioma)} ${um ? "aparece" : "aparecem"} como ausência, não como ${um ? "ano" : "anos"} sem leilão`,
          `: ${listaTexto(ausentes, idioma)} ${um ? "appears" : "appear"} as missing data, not as ${um ? "a year" : "years"} without an auction`,
          idioma,
        )
      : "";
    partes.push(
      tx(
        `O arquivo aberto de leilões de transmissão termina no leilão ${u.leilao} (${dataTexto(u.data, idioma)})${resto}.`,
        `The open file of transmission auctions ends at auction ${u.leilao} (${dataTexto(u.data, idioma)})${resto}.`,
        idioma,
      ),
    );
  }
  return partes.join(" ");
}

/** Medidas do mapa por UF do P042: cada uma na sua unidade; nunca combinadas. */
export const MEDIDAS_REDE = ["mw_impl", "mw_24m", "km_obra", "mva_obra", "km_epe", "km_epe_plan"] as const;
export type MedidaRede = (typeof MEDIDAS_REDE)[number];
type DefMedidaRede = { rotulo: string; unidade: string; campo: keyof GeracaoERedeUf; fonte: string; casas: number };
function medidasRede(idioma: Idioma): Record<MedidaRede, DefMedidaRede> {
  const ralie = fonteExpansao(FONTE_RALIE, idioma);
  const siget = fonteExpansao(FONTE_SIGET, idioma);
  const epe = fonteExpansao(FONTE_EPE_REDE, idioma);
  const kmTracado = tx("km de traçado", "route km", idioma);
  return {
    mw_impl: { rotulo: tx("Geração em implantação (RALIE)", "Generation under implementation (RALIE)", idioma), unidade: "MW", campo: "mw_ugs_em_implantacao", fonte: ralie, casas: 1 },
    mw_24m: {
      rotulo: tx("Geração prevista para os próximos 24 meses (RALIE)", "Generation forecast for the next 24 months (RALIE)", idioma),
      unidade: "MW",
      campo: "mw_previsto_24_meses",
      fonte: ralie,
      casas: 1,
    },
    km_obra: {
      rotulo: tx("Linhas novas em obra que tocam a UF (SIGET)", "New lines under construction that touch the state (SIGET)", idioma),
      unidade: tx("km de circuito", "circuit km", idioma),
      campo: "km_lt_em_andamento_toca_uf",
      fonte: siget,
      casas: 1,
    },
    mva_obra: { rotulo: tx("Transformação nova em obra (SIGET)", "New transformation under construction (SIGET)", idioma), unidade: "MVA", campo: "mva_tr_em_andamento", fonte: siget, casas: 0 },
    km_epe: { rotulo: tx("Rede existente (EPE)", "Existing grid (EPE)", idioma), unidade: kmTracado, campo: "km_rede_existente_epe", fonte: epe, casas: 1 },
    km_epe_plan: { rotulo: tx("Rede planejada (EPE)", "Planned grid (EPE)", idioma), unidade: kmTracado, campo: "km_rede_planejada_epe", fonte: epe, casas: 1 },
  };
}
export const MEDIDA_REDE: Record<MedidaRede, DefMedidaRede> = medidasRede("pt");
const MEDIDA_REDE_EN: Record<MedidaRede, DefMedidaRede> = medidasRede("en");
/** Medida do mapa do P042 no idioma (rótulo, unidade e fonte). */
export function medidaRede(m: MedidaRede, idioma: Idioma = idiomaEnergia()): DefMedidaRede {
  return (idioma === "en" ? MEDIDA_REDE_EN : MEDIDA_REDE)[m];
}
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
export function colunasGeracaoRedeUf(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "nome", rotulo: tx("UF", "State", idioma), tipo: "texto", idiomaTexto: "nome" },
    { id: "id", rotulo: tx("Sigla", "Code", idioma), tipo: "texto" },
    { id: "mw_impl", rotulo: tx("Geração em implantação", "Generation under implementation", idioma), tipo: "numero", unidade: "MW", casas: 1 },
    { id: "mw_24m", rotulo: tx("Geração prevista em 24 meses", "Generation forecast in 24 months", idioma), tipo: "numero", unidade: "MW", casas: 1 },
    { id: "km_obra", rotulo: tx("Linhas em obra que tocam a UF", "Lines under construction that touch the state", idioma), tipo: "numero", unidade: tx("km de circuito", "circuit km", idioma), casas: 1 },
    { id: "mva_obra", rotulo: tx("Transformação em obra", "Transformation under construction", idioma), tipo: "numero", unidade: "MVA", casas: 0 },
    { id: "empreendimentos", rotulo: tx("Empreendimentos de transmissão em andamento", "Transmission projects in progress", idioma), tipo: "numero", casas: 0 },
    { id: "km_epe", rotulo: tx("Rede existente (EPE)", "Existing grid (EPE)", idioma), tipo: "numero", unidade: tx("km de traçado", "route km", idioma), casas: 1 },
    { id: "km_epe_plan", rotulo: tx("Rede planejada (EPE)", "Planned grid (EPE)", idioma), tipo: "numero", unidade: tx("km de traçado", "route km", idioma), casas: 1 },
  ];
}
export const COLUNAS_GERACAO_REDE_UF: ColunaTabela[] = colunasGeracaoRedeUf("pt");
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
export function dadosSerieMw(s: readonly SerieAnualExpansao[], idioma: Idioma = idiomaEnergia()) {
  return [...s].sort((a, b) => a.ano.localeCompare(b.ano)).map((x) => ({ id: x.ano, ano: anoParcial(x.ano, x.ano_parcial, idioma), mw: x.mw_geracao_liberada }));
}
/** "2026 (parcial)" para o ano parcial, no idioma. */
export function anoParcial(ano: string, parcial: boolean | null | undefined, idioma: Idioma = idiomaEnergia()): string {
  return parcial ? tx(`${ano} (parcial)`, `${ano} (partial)`, idioma) : ano;
}
export function dadosSerieKm(s: readonly SerieAnualExpansao[], idioma: Idioma = idiomaEnergia()) {
  return [...s]
    .sort((a, b) => a.ano.localeCompare(b.ano))
    .map((x) => ({ id: x.ano, ano: anoParcial(x.ano, x.ano_parcial, idioma), energizados: x.km_lt_energizados, leilao: x.km_contratados_leilao, contratos: x.km_contratos_assinados_siget }));
}
export function dadosSerieMva(s: readonly SerieAnualExpansao[], idioma: Idioma = idiomaEnergia()) {
  return [...s]
    .sort((a, b) => a.ano.localeCompare(b.ano))
    .map((x) => ({ id: x.ano, ano: anoParcial(x.ano, x.ano_parcial, idioma), energizados: x.mva_tr_energizados, leilao: x.mva_contratados_leilao, contratos: x.mva_contratos_assinados_siget }));
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
export function colunasLeiloes(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "ano", rotulo: tx("Ano do leilão", "Auction year", idioma), tipo: "texto" }, // i18n: dado
    { id: "lotes_ofertados", rotulo: tx("Lotes ofertados", "Lots offered", idioma), tipo: "numero", casas: 0 },
    { id: "lotes_contratados", rotulo: tx("Lotes contratados", "Lots contracted", idioma), tipo: "numero", casas: 0 },
    { id: "lotes_sem_vencedor", rotulo: tx("Lotes sem vencedor", "Lots without a winner", idioma), tipo: "numero", casas: 0 },
    { id: "km", rotulo: tx("Extensão contratada", "Contracted length", idioma), tipo: "numero", unidade: "km", casas: 1 }, // i18n: dado
    { id: "lotes_km_nao_informado", rotulo: tx("Lotes com km não informado", "Lots with km not reported", idioma), tipo: "numero", casas: 0 },
    { id: "mva", rotulo: tx("Transformação contratada", "Contracted transformation", idioma), tipo: "numero", unidade: "MVA", casas: 0 },
    { id: "lotes_mva_nao_informado", rotulo: tx("Lotes com MVA não informado", "Lots with MVA not reported", idioma), tipo: "numero", casas: 0 },
    { id: "investimento", rotulo: tx("Investimento previsto", "Planned investment", idioma), tipo: "numero", unidade: tx("R$ milhões nominais", "nominal R$ million", idioma), casas: 1 },
    { id: "rap_edital", rotulo: tx("RAP do edital", "Tender RAP (annual permitted revenue)", idioma), tipo: "numero", unidade: tx("R$ milhões nominais por ano", "nominal R$ million per year", idioma), casas: 1 },
    { id: "rap_vencedor", rotulo: tx("RAP vencedora", "Winning RAP", idioma), tipo: "numero", unidade: tx("R$ milhões nominais por ano", "nominal R$ million per year", idioma), casas: 1 },
    { id: "desagio", rotulo: tx("Deságio agregado pela RAP", "Aggregate discount on the RAP", idioma), tipo: "percentual", casas: 1 },
  ];
}
export const COLUNAS_LEILOES: ColunaTabela[] = colunasLeiloes("pt");

export function linhasObrasSituacao(g: Pick<ExpansaoGold, "transmissao">, idioma: Idioma = idiomaEnergia()) {
  return g.transmissao.obras.por_situacao.map((s) => ({
    id: s.situacao,
    situacao: rotuloDado(s.situacao, SITUACAO_SIGET_EN, idioma),
    empreendimentos: s.empreendimentos,
    obras: s.obras,
    km: s.km_lt_novas,
    mva: s.mva_tr_novos,
    mva_reserva: s.mva_tr_reserva,
  }));
}
export function colunasObrasSituacao(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "situacao", rotulo: tx("Situação no SIGET", "Status in SIGET", idioma), tipo: "texto" },
    { id: "empreendimentos", rotulo: tx("Empreendimentos", "Projects", idioma), tipo: "numero", casas: 0 },
    { id: "obras", rotulo: tx("Obras", "Works", idioma), tipo: "numero", casas: 0 },
    { id: "km", rotulo: tx("Linhas novas", "New lines", idioma), tipo: "numero", unidade: tx("km de circuito", "circuit km", idioma), casas: 1 },
    { id: "mva", rotulo: tx("Transformação nova", "New transformation", idioma), tipo: "numero", unidade: "MVA", casas: 1 },
    { id: "mva_reserva", rotulo: tx("Transformador reserva (à parte)", "Spare transformer (separate)", idioma), tipo: "numero", unidade: "MVA", casas: 1 },
  ];
}
export const COLUNAS_OBRAS_SITUACAO: ColunaTabela[] = colunasObrasSituacao("pt");
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
export function colunasPrazosVencidos(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "nome", rotulo: tx("Empreendimento", "Project", idioma), tipo: "texto", idiomaTexto: "nome" },
    { id: "ons", rotulo: tx("Código ONS", "ONS code", idioma), tipo: "texto" },
    { id: "oper_ato_legal", rotulo: tx("Prazo vigente do ato legal", "Current deadline in the legal act", idioma), tipo: "data" },
    { id: "dias", rotulo: tx("Dias desde o prazo", "Days since the deadline", idioma), tipo: "numero", unidade: tx("dias", "days", idioma), casas: 0 }, // i18n: dado
    { id: "km", rotulo: tx("Linhas novas", "New lines", idioma), tipo: "numero", unidade: tx("km de circuito", "circuit km", idioma), casas: 1 },
    { id: "mva", rotulo: tx("Transformação nova", "New transformation", idioma), tipo: "numero", unidade: "MVA", casas: 1 },
    { id: "ufs", rotulo: tx("UF", "State", idioma), tipo: "texto" },
  ];
}
export const COLUNAS_PRAZOS_VENCIDOS: ColunaTabela[] = colunasPrazosVencidos("pt");
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
export function colunasDesvioObras(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "ano", rotulo: tx("Ano da entrada", "Year of entry", idioma), tipo: "texto" }, // i18n: dado
    { id: "empreendimentos", rotulo: tx("Empreendimentos", "Projects", idioma), tipo: "numero", casas: 0 },
    { id: "pct_depois", rotulo: tx("Depois do prazo vigente", "After the current deadline", idioma), tipo: "percentual", casas: 1 },
    { id: "iguais", rotulo: tx("Data efetiva igual ao prazo", "Actual date equal to the deadline", idioma), tipo: "numero", casas: 0 },
    { id: "pct_iguais", rotulo: tx("Data efetiva igual ao prazo (%)", "Actual date equal to the deadline (%)", idioma), tipo: "percentual", casas: 1 },
    { id: "mediana", rotulo: tx("Mediana do desvio", "Median deviation", idioma), tipo: "numero", unidade: tx("dias", "days", idioma), casas: 0 },
    { id: "p75", rotulo: tx("Percentil 75 do desvio", "75th percentile of the deviation", idioma), tipo: "numero", unidade: tx("dias", "days", idioma), casas: 0 },
  ];
}
export const COLUNAS_DESVIO_OBRAS: ColunaTabela[] = colunasDesvioObras("pt");
export function linhasContratosAno(g: Pick<ExpansaoGold, "transmissao">, idioma: Idioma = idiomaEnergia()) {
  const c = g.transmissao.contratos_assinados;
  if (!c) return [];
  return [...c.por_ano]
    .sort((a, b) => a.ano.localeCompare(b.ano))
    .map((a) => ({
      id: a.ano,
      ano: anoParcial(a.ano, a.ano_parcial, idioma),
      contratos: a.contratos,
      sem_empreendimento: a.contratos_sem_empreendimento,
      empreendimentos: a.empreendimentos,
      km: a.km_lt_novas,
      mva: a.mva_tr_novos,
      mva_reserva: a.mva_tr_reserva,
    }));
}
export function colunasContratosAno(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "ano", rotulo: tx("Ano de assinatura", "Year of signature", idioma), tipo: "texto" }, // i18n: dado
    { id: "contratos", rotulo: tx("Contratos", "Contracts", idioma), tipo: "numero", casas: 0 },
    { id: "sem_empreendimento", rotulo: tx("Sem empreendimento no SIGET", "Without a project in SIGET", idioma), tipo: "numero", casas: 0 },
    { id: "empreendimentos", rotulo: tx("Empreendimentos", "Projects", idioma), tipo: "numero", casas: 0 },
    { id: "km", rotulo: tx("Linhas novas do objeto original", "New lines in the original scope", idioma), tipo: "numero", unidade: tx("km de circuito", "circuit km", idioma), casas: 1 },
    { id: "mva", rotulo: tx("Transformação nova", "New transformation", idioma), tipo: "numero", unidade: "MVA", casas: 0 },
    { id: "mva_reserva", rotulo: tx("Transformador reserva (à parte)", "Spare transformer (separate)", idioma), tipo: "numero", unidade: "MVA", casas: 0 },
  ];
}
export const COLUNAS_CONTRATOS_ANO: ColunaTabela[] = colunasContratosAno("pt");
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
export function colunasContratosRecentes(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "numero", rotulo: tx("Contrato", "Contract", idioma), tipo: "texto" },
    { id: "assinatura", rotulo: tx("Assinatura", "Signature", idioma), tipo: "data" },
    { id: "agente", rotulo: tx("Concessionária", "Concession holder", idioma), tipo: "texto", idiomaTexto: "nome" },
    { id: "empreendimentos", rotulo: tx("Empreendimentos no SIGET", "Projects in SIGET", idioma), tipo: "numero", casas: 0 },
    { id: "km", rotulo: tx("Linhas novas", "New lines", idioma), tipo: "numero", unidade: tx("km de circuito", "circuit km", idioma), casas: 1 },
    { id: "mva", rotulo: tx("Transformação nova", "New transformation", idioma), tipo: "numero", unidade: "MVA", casas: 0 },
  ];
}
export const COLUNAS_CONTRATOS_RECENTES: ColunaTabela[] = colunasContratosRecentes("pt");

export function linhasRedeTensao(g: Pick<ExpansaoGold, "transmissao">, idioma: Idioma = idiomaEnergia()) {
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
        tensao: kv === null ? tx("tensão não informada", "voltage not reported", idioma) : `${num(kv, 0, idioma)} kV`,
        existente_linhas: e?.linhas ?? 0,
        existente_km: e?.km ?? 0,
        planejada_linhas: p?.linhas ?? 0,
        planejada_km: p?.km ?? 0,
      };
    });
}
export function colunasRedeTensao(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "tensao", rotulo: tx("Tensão", "Voltage", idioma), tipo: "texto" },
    { id: "existente_linhas", rotulo: tx("Existente, linhas", "Existing, lines", idioma), tipo: "numero", casas: 0 },
    { id: "existente_km", rotulo: tx("Existente", "Existing", idioma), tipo: "numero", unidade: tx("km de traçado", "route km", idioma), casas: 1 },
    { id: "planejada_linhas", rotulo: tx("Planejada, linhas", "Planned, lines", idioma), tipo: "numero", casas: 0 },
    { id: "planejada_km", rotulo: tx("Planejada", "Planned", idioma), tipo: "numero", unidade: tx("km de traçado", "route km", idioma), casas: 1 },
  ];
}
export const COLUNAS_REDE_TENSAO: ColunaTabela[] = colunasRedeTensao("pt");

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
export function respostaCenarios(g: Pick<ExpansaoGold, "cenarios" | "evidencias" | "referencias">, idioma: Idioma = idiomaEnergia()): string {
  const c = g.cenarios;
  // as referências da Figura 3-25 (ponto de partida e fim do horizonte) vêm da própria figura
  const refs = (c.figuras.fig_3_25?.linhas ?? []).map((l) => l.ref).sort();
  const ini = refs[0];
  const fim = refs.at(-1);
  // a descrição da conferência é texto da gold (português): o mês é procurado na forma portuguesa
  const conf = (ref: string | undefined) =>
    ref ? c.conferencia_relatorio.find((x) => x.descricao.includes("3-25") && x.descricao.includes(`${mesTexto(ref, "pt")}`)) : undefined;
  const ev = g.evidencias.pde_capacidade_2035;
  const totalFim = ev?.valor_calculo ?? conf(fim)?.calculado_gw ?? null;
  const gw = (v: number | null | undefined) => gwTexto(v, 1, idioma);
  const partes = [
    tx(
      `O ${c.edicao} (${c.orgao}${c.aprovacao ? `; aprovado pela ${c.aprovacao.texto}` : ""}) é um cenário com data-base em ${c.data_base_premissas}, não uma previsão: no Cenário de Referência, a capacidade instalada nacional, contando micro e minigeração distribuída, baterias e resposta da demanda, vai de ${gw(conf(ini)?.calculado_gw)} em ${mesTexto(ini, idioma)} a ${gw(totalFim)} em ${mesTexto(fim, idioma)}.`,
      `The ${c.edicao} (${ORGAO_EN[c.orgao] ?? c.orgao}${c.aprovacao ? `; approved by ${atoNormativoEn(c.aprovacao.texto)}` : ""}) is a scenario with assumptions as of ${mesPorExtensoEn(c.data_base_premissas)}, not a forecast: in the Reference Scenario, national installed capacity, counting distributed micro and mini generation (MMGD), batteries and demand response, goes from ${gw(conf(ini)?.calculado_gw)} in ${mesTexto(ini, idioma)} to ${gw(totalFim)} in ${mesTexto(fim, idioma)}.`,
      idioma,
    ),
  ];
  const diretas = c.camadas.filter((x) => x.correspondencia === "direta" && temValor(x.pde_dez2035_gw));
  const maior = [...diretas].sort((a, b) => (b.pde_dez2035_gw ?? 0) - (a.pde_dez2035_gw ?? 0))[0];
  if (maior) {
    // categoria maior que a escolhida, mas só em parte comparável com o cadastro (a hidrelétrica, que soma Itaipu 50 Hz): dita, para a frase não contradizer o gráfico
    const acima = c.camadas.filter((x) => x.correspondencia === "parcial" && temValor(x.pde_dez2035_gw) && x.pde_dez2035_gw > (maior.pde_dez2035_gw ?? 0));
    const ressalva = acima.length
      ? ` ${inicial(
          listaTexto(
            acima.map((x) => tx(`${x.rotulo.charAt(0).toLocaleLowerCase("pt-BR")}${x.rotulo.slice(1)}, com ${gw(x.pde_dez2035_gw)} no cenário,`, `${rotuloCamadaEmFrase(x.rotulo, idioma)}, with ${gw(x.pde_dez2035_gw)} in the scenario,`, idioma)),
            idioma,
          ),
        )} ${tx("ficam fora desta comparação porque a correspondência com o cadastro é parcial.", `${acima.length === 1 ? "is" : "are"} left out of this comparison because the match with the register is partial.`, idioma)}`
      : "";
    const dSiga = dataBR(g.referencias.siga, idioma);
    const dRalie = dataBR(g.referencias.ralie, idioma);
    partes.push(
      tx(
        `Entre as categorias com correspondência direta no cadastro da ANEEL, a de maior capacidade em ${mesTexto(fim, idioma)} é a de ${maior.rotulo.toLocaleLowerCase("pt-BR")}, com ${gw(maior.pde_dez2035_gw)} no cenário, ${gw(maior.realizado_siga_gw)} em operação no SIGA de ${dSiga} e ${gw(maior.carteira_ralie_gw)} em implantação no RALIE de ${dRalie}.${ressalva}`,
        `Among the categories with a direct match in ANEEL's register, the one with the most capacity in ${mesTexto(fim, idioma)} is ${rotuloCamadaEmFrase(maior.rotulo, idioma)}, with ${gw(maior.pde_dez2035_gw)} in the scenario, ${gw(maior.realizado_siga_gw)} in operation in the SIGA of ${dSiga} and ${gw(maior.carteira_ralie_gw)} under implementation in the RALIE of ${dRalie}.${ressalva}`,
        idioma,
      ),
    );
  }
  return partes.join(" ");
}
/** Rótulo da categoria do PDE no idioma. */
export function rotuloCamada(rotulo: string, idioma: Idioma = idiomaEnergia()): string {
  return rotuloDado(rotulo, CAMADA_PDE_EN, idioma);
}
/** Rótulo da categoria do PDE no meio de uma frase inglesa: inicial minúscula, siglas preservadas. */
function rotuloCamadaEmFrase(rotulo: string, idioma: Idioma): string {
  const r = rotuloCamada(rotulo, idioma);
  return `${r.charAt(0).toLowerCase()}${r.slice(1)}`;
}
/** Correspondência da categoria do PDE com o cadastro no idioma. */
export function rotuloCorrespondencia(c: string, idioma: Idioma = idiomaEnergia()): string {
  return rotuloDado(c, CORRESPONDENCIA_EN, idioma);
}

/** "O que mudou" do P043: o que o próprio relatório diz ter mudado depois da data-base (ressalvas publicadas com a página). */
export function mudancaCenarios(g: Pick<ExpansaoGold, "cenarios">, idioma: Idioma = idiomaEnergia()): string {
  const r = g.cenarios.hipoteses.filter((h) => h.ressalva);
  const unica = tx(
    `Esta publicação traz uma única edição do plano (${g.cenarios.edicao}), sem comparação de números com outra edição.`,
    `This release has a single edition of the plan (${g.cenarios.edicao}), with no comparison of figures against another edition.`,
    idioma,
  );
  if (!r.length)
    return tx(
      `${unica} O relatório não registra mudança posterior à data-base (${g.cenarios.data_base_premissas}) nas hipóteses publicadas.`,
      `${unica} The report records no change after the base date (${mesPorExtensoEn(g.cenarios.data_base_premissas)}) in the published assumptions.`,
      idioma,
    );
  return tx(
    `${unica} Mudança que o próprio relatório registra depois da data-base: ${r.map((h) => h.ressalva).join(" ")}`,
    `${unica} Change that the report itself records after the base date: ${r.map((h) => hipoteseNoIdioma(h.ressalva as string, idioma)).join(" ")}`,
    idioma,
  );
}
/** Texto de hipótese ou ressalva do PDE no idioma (tradução de trabalho; sem entrada, volta como veio). */
export function hipoteseNoIdioma(texto: string, idioma: Idioma = idiomaEnergia()): string {
  return rotuloDado(texto, HIPOTESE_PDE_EN, idioma);
}
/** A hipótese tem versão no idioma da página (em português, sempre). */
export function hipoteseTraduzida(texto: string, idioma: Idioma = idiomaEnergia()): boolean {
  return idioma !== "en" || texto in HIPOTESE_PDE_EN;
}

export const FIGURAS_PDE = ["fig_3_25", "fig_3_6", "fig_3_23", "fig_4_19", "fig_4_24", "fig_4_27", "fig_12_4"] as const;
export type IdFigura = (typeof FIGURAS_PDE)[number];
export const ESQUEMA_CENARIOS = {
  fig: campo(tiposUrl.opcao(FIGURAS_PDE), "fig_3_6", { param: "cen.fig" }),
  cat: campo(tiposUrl.texto({ max: 40 }), "", { param: "cen.cat" }),
};
/** Rótulo curto da figura ("Figura 3-6") a partir do id da gold. */
export function rotuloFigura(id: string, idioma: Idioma = idiomaEnergia()): string {
  return `${tx("Figura", "Figure", idioma)} ${id.replace(/^fig_/, "").replace("_", "-")}`;
}
/** Título da figura do PDE (como a EPE a intitula) no idioma. */
export function tituloFigura(titulo: string, idioma: Idioma = idiomaEnergia()): string {
  return rotuloDado(titulo, TITULO_FIGURA_EN, idioma);
}
/** Coluna da figura do PDE (rótulo da planilha da EPE) no idioma. */
export function colunaFigura(coluna: string, idioma: Idioma = idiomaEnergia()): string {
  return rotuloDado(coluna, COLUNA_FIGURA_EN, idioma);
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
export function dadosFigura(f: FiguraPde, idioma: Idioma = idiomaEnergia()): DadosFigura {
  if (f.linhas.length <= 3) {
    const series = f.linhas.map((l, i) => ({ id: `r${i}`, rotulo: l.ref }));
    const dados = f.colunas.map((col, j) => {
      const o: Record<string, string | number | null> = { id: `c${j}`, coluna: colunaFigura(col, idioma) };
      f.linhas.forEach((l, i) => {
        const v = l[col];
        o[`r${i}`] = typeof v === "number" ? v : null;
      });
      return o;
    });
    return { modo: "barras", dados, series };
  }
  const series = f.colunas.map((col, j) => ({ id: `c${j}`, rotulo: colunaFigura(col, idioma) }));
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
export function linhasCamadas(g: Pick<ExpansaoGold, "cenarios">, idioma: Idioma = idiomaEnergia()) {
  return g.cenarios.camadas.map((c: CamadaPde) => ({
    id: c.categoria,
    categoria: rotuloCamada(c.rotulo, idioma),
    correspondencia: rotuloCorrespondencia(c.correspondencia, idioma),
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
export function colunasCamadas(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "categoria", rotulo: tx("Categoria do PDE", "PDE category", idioma), tipo: "texto" },
    { id: "correspondencia", rotulo: tx("Correspondência com o SIGA", "Match with SIGA", idioma), tipo: "texto", categorica: true },
    { id: "pde_dez2025", rotulo: tx("Cenário, dez/2025 (Figura 3-25)", "Scenario, Dec 2025 (Figure 3-25)", idioma), tipo: "numero", unidade: "GW", casas: 3 },
    { id: "pde_dez2035", rotulo: tx("Cenário, dez/2035 (Figura 3-25)", "Scenario, Dec 2035 (Figure 3-25)", idioma), tipo: "numero", unidade: "GW", casas: 3 },
    { id: "anexo_dez2026", rotulo: tx("Cenário comparável, dez/2026 (Anexo I-3)", "Comparable scenario, Dec 2026 (Annex I-3)", idioma), tipo: "numero", unidade: "GW", casas: 3 },
    { id: "anexo_dez2035", rotulo: tx("Cenário comparável, dez/2035 (Anexo I-3)", "Comparable scenario, Dec 2035 (Annex I-3)", idioma), tipo: "numero", unidade: "GW", casas: 3 },
    { id: "fora_do_siga_dez2035", rotulo: tx("Parcela que o SIGA não cadastra, dez/2035", "Share SIGA does not register, Dec 2035", idioma), tipo: "numero", unidade: "GW", casas: 3 },
    { id: "realizado", rotulo: tx("Realizado (SIGA, em operação)", "Actual (SIGA, in operation)", idioma), tipo: "numero", unidade: "GW", casas: 3 },
    { id: "carteira", rotulo: tx("Carteira (RALIE, em implantação)", "Portfolio (RALIE, under implementation)", idioma), tipo: "numero", unidade: "GW", casas: 3 },
    { id: "tipos_siga", rotulo: tx("Tipos do SIGA somados", "SIGA types added up", idioma), tipo: "texto" },
  ];
}
export const COLUNAS_CAMADAS: ColunaTabela[] = colunasCamadas("pt");
/** Só as categorias com valor comparável no Anexo I-3 entram no gráfico de camadas; as demais ficam na tabela, com o motivo. */
export function linhasCamadasComparaveis(linhas: readonly LinhaCamada[]) {
  return linhas.filter((l) => temValor(l.anexo_dez2035) || temValor(l.realizado));
}

/* ================================================================ vereditos (r8): resposta curta em duas camadas */

/**
 * Cada veredito responde, em palavras simples e com no máximo dois números, à pergunta do título do painel e diz o limite
 * de leitura. Os números saem dos mesmos campos da resposta completa (respostaSintese, respostaCarteira,
 * respostaCronograma, respostaTransmissao e respostaCenarios), que continua inteira como segunda camada em Analisar e
 * Auditar. Dado ausente: veredito vazio e a página mostra a resposta completa.
 */

/** Síntese: o total em implantação, o tipo com mais potência e o lembrete de que carteira não é entrada certa. */
export function vereditoSintese(g: Pick<ExpansaoGold, "estagios">, idioma: Idioma = idiomaEnergia()): string {
  const r = g.estagios.ralie;
  if (!temValor(r.mw_ugs_em_implantacao)) return "";
  const top = linhasRalieTipo(g, idioma)[0];
  const mwTop = top ? mwTexto(top.mw, 1, idioma) : "";
  const maior = top ? tx(`, ${mwTop} deles em ${TIPO_EM_FRASE[top.id] ?? top.id}`, `, ${mwTop} of it in ${tipoEmFrase(top.id, idioma)}`, idioma) : "";
  const enc = coorteInicial(g)?.desfechos.outorga_encerrada.pct_mw;
  const limite =
    temValor(enc) && enc > 0
      ? tx(
          " Carteira não é entrada certa: parte das outorgas já foi revogada ou extinta.",
          " A portfolio is not a guaranteed entry: some of the grants have already been revoked or extinguished.",
          idioma,
        )
      : tx(" Carteira não é entrada certa.", " A portfolio is not a guaranteed entry.", idioma);
  return tx(
    `O RALIE acompanha ${mwTexto(r.mw_ugs_em_implantacao, 1, idioma)} de geração em implantação (fotografia de ${dataTexto(r.data_ralie, idioma)})${maior}.${limite}`,
    `The RALIE monitors ${mwTexto(r.mw_ugs_em_implantacao, 1, idioma)} of generation under implementation (snapshot of ${dataTexto(r.data_ralie, idioma)})${maior}.${limite}`,
    idioma,
  );
}

/** P040: o que está em construção e o que está só outorgado, e que outorga não é entrada garantida. */
export function vereditoCarteira(g: Pick<ExpansaoGold, "estagios">, idioma: Idioma = idiomaEnergia()): string {
  const con = estagio(g, "construcao");
  const nao = estagio(g, "construcao_nao_iniciada");
  if (!con && !nao) return "";
  const partes = [
    con ? tx(`${mwTexto(con.mw_outorgado, 1, idioma)} outorgados em usinas em construção`, `${mwTexto(con.mw_outorgado, 1, idioma)} granted in plants under construction`, idioma) : "",
    nao
      ? tx(`${mwTexto(nao.mw_outorgado, 1, idioma)} outorgados com a construção não iniciada`, `${mwTexto(nao.mw_outorgado, 1, idioma)} granted with construction not started`, idioma)
      : "",
  ].filter(Boolean);
  const c0 = coorteInicial(g);
  const d = c0?.desfechos;
  const perda = !!d && ((temValor(d.outorga_encerrada.pct_mw) && d.outorga_encerrada.pct_mw > 0) || (temValor(d.sem_desfecho.pct_mw) && d.sem_desfecho.pct_mw > 0));
  return tx(
    `Em ${dataTexto(g.estagios.data_referencia, idioma)}, o SIGA registra ${listaTexto(partes, idioma)}. ${perda ? "Outorga não é entrada garantida: parte já foi revogada ou extinta." : "Outorga não é entrada garantida."}`,
    `On ${dataTexto(g.estagios.data_referencia, idioma)}, the SIGA records ${listaTexto(partes, idioma)}. ${perda ? "A grant is not a guaranteed entry: some have already been revoked or extinguished." : "A grant is not a guaranteed entry."}`,
    idioma,
  );
}

/** P041: o que a fiscalização prevê para o ano da fotografia, quanto da previsão passada foi cumprido no prazo, e que data em bloco não é cronograma. */
export function vereditoCronograma(g: Pick<ExpansaoGold, "cronograma">, idioma: Idioma = idiomaEnergia()): string {
  const pa = g.cronograma.previsoes_atuais;
  const anoFoto = pa.data_ralie.slice(0, 4);
  const primeiro = [...pa.por_ano].sort((a, b) => a.ano.localeCompare(b.ano))[0];
  const c = ultimaConfiabilidade(g);
  if (!primeiro && !c) return "";
  const frases: string[] = [];
  if (c && temValor(c.pct_no_prazo))
    frases.push(
      tx(
        `Das previsões de ${dataTexto(c.ralie, idioma)} para os 12 meses seguintes, ${pctTexto(c.pct_no_prazo, 1, idioma)} da potência foi liberada no prazo.`,
        `Of the forecasts of ${dataTexto(c.ralie, idioma)} for the following 12 months, ${pctTexto(c.pct_no_prazo, 1, idioma)} of the capacity was released on time.`,
        idioma,
      ),
    );
  if (primeiro) {
    const quando = primeiro.ano === anoFoto ? tx(`no restante de ${primeiro.ano}`, `in the rest of ${primeiro.ano}`, idioma) : tx(`em ${primeiro.ano}`, `in ${primeiro.ano}`, idioma);
    frases.push(tx(`A fiscalização prevê ${mwTexto(primeiro.mw, 1, idioma)} ${quando}.`, `The inspection expects ${mwTexto(primeiro.mw, 1, idioma)} ${quando}.`, idioma));
  }
  if (pa.datas_em_bloco && pa.datas_em_bloco.datas.length)
    frases.push(
      tx(
        "Boa parte da carteira tem só uma data convencional, não cronograma de obra.",
        "A large part of the portfolio has only a conventional date, not a construction schedule.",
        idioma,
      ),
    );
  return frases.join(" ");
}

/** P042: obras de transmissão e geração em implantação lado a lado, e que os totais não dizem se a rede escoa a geração. */
export function vereditoTransmissao(g: Pick<ExpansaoGold, "transmissao" | "estagios">, idioma: Idioma = idiomaEnergia()): string {
  const o = g.transmissao.obras;
  const r = g.estagios.ralie;
  if (!temValor(o.em_andamento.km_lt_novas) && !temValor(r.mw_ugs_em_implantacao)) return "";
  return tx(
    `O SIGET registra ${kmTexto(o.em_andamento.km_lt_novas, 1, idioma)} de circuito em linhas novas em obras de transmissão, e o RALIE acompanha ${mwTexto(r.mw_ugs_em_implantacao, 1, idioma)} de geração em implantação. Só com esses totais não dá para saber se a rede escoa essa geração.`,
    `The SIGET records ${kmTexto(o.em_andamento.km_lt_novas, 1, idioma)} of circuit in new lines in transmission works, and the RALIE monitors ${mwTexto(r.mw_ugs_em_implantacao, 1, idioma)} of generation under implementation. These totals alone do not show whether the grid can carry that generation.`,
    idioma,
  );
}

/** P043: a capacidade nacional do cenário de referência no início e no fim do horizonte, dita como cenário e não previsão. */
export function vereditoCenarios(g: Pick<ExpansaoGold, "cenarios" | "evidencias">, idioma: Idioma = idiomaEnergia()): string {
  const c = g.cenarios;
  const refs = (c.figuras.fig_3_25?.linhas ?? []).map((l) => l.ref).sort();
  const ini = refs[0];
  const fim = refs.at(-1);
  // a descrição da conferência é texto da gold (português): o mês é procurado na forma portuguesa
  const conf = (ref: string | undefined) => (ref ? c.conferencia_relatorio.find((x) => x.descricao.includes("3-25") && x.descricao.includes(`${mesTexto(ref, "pt")}`)) : undefined);
  const totalFim = g.evidencias.pde_capacidade_2035?.valor_calculo ?? conf(fim)?.calculado_gw ?? null;
  const gwIni = conf(ini)?.calculado_gw;
  if (!temValor(gwIni) && !temValor(totalFim)) return "";
  return tx(
    `O ${c.edicao} é um cenário, não uma previsão: no cenário de referência, a capacidade instalada nacional vai de ${gwTexto(gwIni, 1, idioma)} em ${mesTexto(ini, idioma)} a ${gwTexto(totalFim, 1, idioma)} em ${mesTexto(fim, idioma)}.`,
    `The ${c.edicao} is a scenario, not a forecast: in the reference scenario, national installed capacity goes from ${gwTexto(gwIni, 1, idioma)} in ${mesTexto(ini, idioma)} to ${gwTexto(totalFim, 1, idioma)} in ${mesTexto(fim, idioma)}.`,
    idioma,
  );
}

/**
 * Categorias com correspondência direta em que operação (SIGA) mais implantação (RALIE) passam do cenário de dez/2035:
 * a soma de camadas diferentes não é previsão, e a nota diz isso com os números lado a lado. Vazia quando nenhuma passa.
 */
export function notaCarteiraAcimaDoCenario(g: Pick<ExpansaoGold, "cenarios">, idioma: Idioma = idiomaEnergia()): string {
  const acima = g.cenarios.camadas.filter(
    (x) => x.correspondencia === "direta" && temValor(x.pde_dez2035_gw) && temValor(x.realizado_siga_gw) && temValor(x.carteira_ralie_gw) && x.realizado_siga_gw + x.carteira_ralie_gw > x.pde_dez2035_gw,
  );
  if (!acima.length) return "";
  const gw = (v: number | null | undefined) => gwTexto(v, 1, idioma);
  const itens = acima.map((x) => {
    const soma = gw((x.realizado_siga_gw as number) + (x.carteira_ralie_gw as number));
    const nome = x.rotulo.charAt(0).toLocaleLowerCase("pt-BR") + x.rotulo.slice(1);
    return tx(
      `${nome} (${gw(x.realizado_siga_gw)} em operação mais ${gw(x.carteira_ralie_gw)} em implantação, ${soma}, contra ${gw(x.pde_dez2035_gw)} no cenário)`,
      `${rotuloCamadaEmFrase(x.rotulo, idioma)} (${gw(x.realizado_siga_gw)} in operation plus ${gw(x.carteira_ralie_gw)} under implementation, ${soma}, against ${gw(x.pde_dez2035_gw)} in the scenario)`,
      idioma,
    );
  });
  return tx(
    `Operação mais implantação passa do cenário de dez/2035 em ${listaTexto(itens, idioma)}. As camadas ficam lado a lado e não se somam: a carteira em implantação não é entrada certa, e o cenário é hipótese de planejamento, não previsão.`,
    `Operation plus implementation exceeds the Dec 2035 scenario in ${listaTexto(itens, idioma)}. The layers stay side by side and are not added: the portfolio under implementation is not a guaranteed entry, and the scenario is a planning assumption, not a forecast.`,
    idioma,
  );
}

/** Contagens de fotografias do RALIE e o uso de cada uma: 177 publicadas, 63 mensais, 50 janelas de confiabilidade e 51 pares de revisão. */
export function textoContagemFotografias(g: Pick<ExpansaoGold, "cronograma">, idioma: Idioma = idiomaEnergia()): string {
  const c = g.cronograma;
  const h = c.historico_fonte;
  const i = (v: number | null | undefined) => inteiro(v, idioma);
  return tx(
    `O RALIE publicou ${i(h.fotografias)} fotografias desde ${dataTexto(h.primeira_fotografia, idioma)}; ${i(h.fotografias_mensais)} são mensais (a última de cada mês). A confiabilidade das previsões usa ${i(c.confiabilidade.length)} delas, as que têm a janela de 12 meses já encerrada, e a revisão das previsões usa ${i(c.deslizamento.length)} pares de fotografias com 12 meses de distância.`,
    `The RALIE has published ${i(h.fotografias)} snapshots since ${dataTexto(h.primeira_fotografia, idioma)}; ${i(h.fotografias_mensais)} are monthly (the last of each month). The reliability of the forecasts uses ${i(c.confiabilidade.length)} of them, those whose 12-month window has already closed, and the revision of the forecasts uses ${i(c.deslizamento.length)} pairs of snapshots 12 months apart.`,
    idioma,
  );
}

/** As datas das duas leituras do cronograma: a confiabilidade termina numa fotografia, a revisão em outra. */
export function notaDatasCronograma(g: Pick<ExpansaoGold, "cronograma">, idioma: Idioma = idiomaEnergia()): string {
  const c = ultimaConfiabilidade(g);
  const d = ultimoDeslizamento(g);
  if (!c || !d) return "";
  const dt = (v: string | null | undefined) => dataTexto(v, idioma);
  return tx(
    `As duas leituras terminam em fotografias diferentes: a confiabilidade usa a última janela de 12 meses já encerrada (previsões de ${dt(c.ralie)}, janela até ${dt(c.fim_janela)}), e a revisão compara a fotografia de ${dt(d.ralie)} com a de ${dt(d.ralie_seguinte)}, a mais recente que tem par 12 meses depois.`,
    `The two readings end in different snapshots: reliability uses the last 12-month window already closed (forecasts of ${dt(c.ralie)}, window through ${dt(c.fim_janela)}), and the revision compares the snapshot of ${dt(d.ralie)} with that of ${dt(d.ralie_seguinte)}, the most recent one with a pair 12 months later.`,
    idioma,
  );
}

/**
 * Ressalva da validação sem o nome de campo da gold ("ver estagios.encerramentos.potencia_conferida") e sem "Parquet": o
 * texto de leitor; o campo vai separado, para o modo Auditar.
 */
export function ressalvaLegivel(r: string): { texto: string; campo: string | null } {
  const m = /[:.]?\s*[Vv]er (estagios(?:\.[a-z_]+)+)\.?\s*$/.exec(r);
  const base = m ? r.slice(0, m.index).replace(/[:;,\s]+$/, "") : r.replace(/\s+$/, "");
  const texto = base.replace(/Parquet histórico/g, "arquivo histórico").replace(/\.?$/, ".");
  return { texto, campo: m ? m[1] : null };
}

/** Tira da regra publicada o nome de campo da fonte entre parênteses ("(soma de MdaPotenciaUnitaria)"), que o leitor não tem como consultar. */
export function semNomeDeCampo(texto: string): string {
  return texto.replace(/\s*\((?:soma|campo) de [A-Z][A-Za-z0-9]+\)/g, "");
}

/**
 * RALIE e SIGA somam carteiras de totais próximos (usinas e MW) que não são a mesma lista nem a mesma medida: o RALIE conta as
 * unidades geradoras em implantação na fotografia dele; o SIGA, a potência outorgada nas fases Construção e Construção não
 * iniciada, na data do arquivo dele. A nota diz isso com a distribuição das usinas do RALIE pelas fases do SIGA.
 */
export function notaRalieSiga(g: Pick<ExpansaoGold, "estagios">, idioma: Idioma = idiomaEnergia()): string {
  const r = g.estagios.ralie;
  const con = estagio(g, "construcao");
  const nao = estagio(g, "construcao_nao_iniciada");
  if (!con || !nao || !r.fase_no_siga?.length) return "";
  const i = (v: number | null | undefined) => inteiro(v, idioma);
  const mw = (v: number | null | undefined) => mwTexto(v, 1, idioma);
  const dt = (v: string | null | undefined) => dataTexto(v, idioma);
  // i18n: dado ("ausente do SIGA" é o valor da gold)
  const ausente = (f: { fase: string }) => f.fase === "ausente do SIGA";
  const fases = listaTexto(
    r.fase_no_siga.map((f) =>
      tx(
        `${i(f.usinas)} ${ausente(f) ? "fora do arquivo aberto do SIGA" : `na fase ${f.fase} do SIGA`}`,
        `${i(f.usinas)} ${ausente(f) ? "outside the SIGA open file" : `in the SIGA phase ${rotuloDado(f.fase, ESTAGIO_EN, idioma)}`}`,
        idioma,
      ),
    ),
    idioma,
  );
  return tx(
    `Os totais do RALIE e do SIGA são próximos, mas não são a mesma lista nem a mesma medida: o RALIE (${dt(r.data_ralie)}) acompanha ${i(r.usinas)} usinas, com ${mw(r.mw_ugs_em_implantacao)} em unidades geradoras em implantação (${fases}); o SIGA (${dt(g.estagios.data_referencia)}) soma ${i(con.usinas + nao.usinas)} usinas, com ${mw(con.mw_outorgado + nao.mw_outorgado)} de potência outorgada, nas fases Construção e Construção não iniciada.`,
    `The RALIE and SIGA totals are close, but they are neither the same list nor the same measure: the RALIE (${dt(r.data_ralie)}) monitors ${i(r.usinas)} plants, with ${mw(r.mw_ugs_em_implantacao)} in generating units under implementation (${fases}); the SIGA (${dt(g.estagios.data_referencia)}) adds up ${i(con.usinas + nao.usinas)} plants, with ${mw(con.mw_outorgado + nao.mw_outorgado)} of granted capacity, in the Construction and Construction not started phases.`,
    idioma,
  );
}

/* ================================================================ abertura (redesenho): etapas, retratos e cenário */

/** Medida de potência de cada etapa do SIGA: o que opera é potência fiscalizada; o resto, potência outorgada. */
export type MedidaEtapa = "fiscalizada" | "outorgada"; // i18n: dado
export type MetricaEtapa = { id: Estagio; rotulo: string; usinas: number | null; mw: number | null; medida: MedidaEtapa };

/**
 * As três etapas do SIGA na ordem do ciclo (operação, construção, obra não iniciada), cada uma na sua medida. Não há total: a
 * potência fiscalizada e a outorgada são medidas diferentes e a faixa de métricas, o texto e o gráfico leem esta mesma lista.
 */
export function metricasEtapas(g: Pick<ExpansaoGold, "estagios">, idioma: Idioma = idiomaEnergia()): MetricaEtapa[] {
  const op = estagio(g, "operacao");
  const con = estagio(g, "construcao");
  const nao = estagio(g, "construcao_nao_iniciada");
  // i18n: dado (medida é chave; o texto sai em notaEtapa)
  const [fiscalizada, outorgada]: MedidaEtapa[] = ["fiscalizada", "outorgada"];
  return [
    { id: "operacao", rotulo: tx("Em operação", "In operation", idioma), usinas: op?.usinas ?? null, mw: op?.mw_fiscalizado ?? null, medida: fiscalizada },
    { id: "construcao", rotulo: tx("Em construção", "Under construction", idioma), usinas: con?.usinas ?? null, mw: con?.mw_outorgado ?? null, medida: outorgada },
    { id: "construcao_nao_iniciada", rotulo: tx("Obra não iniciada", "Construction not started", idioma), usinas: nao?.usinas ?? null, mw: nao?.mw_outorgado ?? null, medida: outorgada },
  ];
}
/** Linha de contexto de uma etapa: "Potência fiscalizada, 22.798 usinas." */
export function notaEtapa(m: MetricaEtapa, idioma: Idioma = idiomaEnergia()): string {
  const n = temValor(m.usinas) ? inteiro(m.usinas, idioma) : null;
  const um = m.usinas === 1;
  const usinas = n === null ? "" : tx(`, ${n} ${um ? "usina" : "usinas"}`, `, ${n} ${um ? "plant" : "plants"}`, idioma);
  return tx(`Potência ${m.medida}${usinas}.`, `${m.medida === "fiscalizada" ? "Inspected" : "Granted"} capacity${usinas}.`, idioma);
}
/** As etapas não se somam: a frase que acompanha a faixa de métricas diz a medida de cada uma. */
export function notaEtapas(idioma: Idioma = idiomaEnergia()): string {
  return tx(
    "Operação é potência fiscalizada; construção e obra não iniciada, potência outorgada. Medidas diferentes, sem soma.",
    "Operation is inspected capacity; construction and construction not started are granted capacity. Different measures, not added.",
    idioma,
  );
}
export const NOTA_ETAPAS = notaEtapas("pt");

/**
 * O SIGA e o RALIE são retratos diferentes da carteira: a frase diz a data e a medida de cada um e dá a escala do que já opera
 * (potência fiscalizada no SIGA) ao lado do gráfico do RALIE, sem somar as duas camadas.
 */
export function notaRetratosSigaRalie(g: Pick<ExpansaoGold, "estagios">, idioma: Idioma = idiomaEnergia()): string {
  const op = estagio(g, "operacao");
  const dSiga = dataTexto(g.estagios.data_referencia, idioma);
  const dRalie = dataTexto(g.estagios.ralie.data_ralie, idioma);
  const siga = tx(`de ${dSiga}, que mede a potência por usina`, `of ${dSiga}, which measures capacity per plant`, idioma);
  const escala =
    op && temValor(op.mw_fiscalizado)
      ? tx(
          `Para escala, o que já opera soma ${mwTexto(op.mw_fiscalizado, 1, idioma)} fiscalizados no SIGA ${siga}`,
          `For scale, what already operates adds up to ${mwTexto(op.mw_fiscalizado, 1, idioma)} inspected in the SIGA ${siga}`,
          idioma,
        )
      : tx(`Operação, construção e obra não iniciada vêm do SIGA ${siga}`, `Operation, construction and construction not started come from the SIGA ${siga}`, idioma);
  return tx(
    `${escala}; este gráfico é do RALIE de ${dRalie}, que mede as unidades geradoras em implantação. São retratos de datas e medidas diferentes, e as duas camadas não se somam.`,
    `${escala}; this chart is from the RALIE of ${dRalie}, which measures the generating units under implementation. They are snapshots of different dates and measures, and the two layers are not added.`,
    idioma,
  );
}

/**
 * Proveniência com o texto do leitor: "Parquet histórico" vira "arquivo histórico" nas limitações e nas transformações, o mesmo
 * tratamento que ressalvaLegivel dá às ressalvas da validação. Fonte, fórmula, snapshot e contagens ficam como a gold os publica.
 */
export function provenienciasDoLeitor(g: Pick<ExpansaoGold, "proveniencia">): ExpansaoGold["proveniencia"] {
  const limpa = (t: string) => t.replace(/Parquet histórico/g, "arquivo histórico");
  const tira = (p: Proveniencia): Proveniencia => ({ ...p, limitacoes: p.limitacoes.map(limpa), transformacoes: p.transformacoes.map(limpa) });
  return Object.fromEntries(Object.entries(g.proveniencia).map(([k, v]) => [k, v ? tira(v) : v])) as ExpansaoGold["proveniencia"];
}

/**
 * Capacidade nacional do Cenário de Referência no início e no fim do horizonte (Figura 3-25 e a conferência do relatório), como
 * a resposta do painel a lê: o fim vem da evidência quando ela existe. Nenhum valor é refeito.
 */
export function capacidadeNoCenario(g: Pick<ExpansaoGold, "cenarios" | "evidencias">): { inicio: { ref: string; gw: number | null } | null; fim: { ref: string; gw: number | null } | null } {
  const c = g.cenarios;
  const refs = (c.figuras.fig_3_25?.linhas ?? []).map((l) => l.ref).sort();
  const ini = refs[0];
  const fim = refs.at(-1);
  // a descrição da conferência é texto da gold (português): o mês é procurado na forma portuguesa
  const conf = (ref: string | undefined) => (ref ? c.conferencia_relatorio.find((x) => x.descricao.includes("3-25") && x.descricao.includes(`${mesTexto(ref, "pt")}`)) : undefined);
  const fimGw = g.evidencias.pde_capacidade_2035?.valor_calculo ?? conf(fim)?.calculado_gw ?? null;
  return {
    inicio: ini ? { ref: ini, gw: conf(ini)?.calculado_gw ?? null } : null,
    fim: fim ? { ref: fim, gw: fimGw } : null,
  };
}
