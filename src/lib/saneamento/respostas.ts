/**
 * Resposta curta de cada capítulo para a página de entrada: uma frase factual e um número com prova (valor, o que mede e fonte),
 * calculados com os mesmos campos e a mesma formatação da página do capítulo. O teste `saneamento-entrada` confere que o valor
 * exibido na entrada aparece na página do capítulo. Sem o dado na gold, o capítulo não ganha resposta: a entrada mostra o resumo de
 * cobertura e não inventa número.
 */

import type { Agregado, Investimento } from "@/lib/saneamento/tipos";
import { agregado, fichas, meta, municipios, prestadores, reguladores } from "@/lib/saneamento/gold";
import { razaoPct } from "@/lib/saneamento/municipios";
import { ANOS_SAUDE } from "@/lib/saneamento/medidas";
import { TARIFAS, periodoConsultaTarifas } from "@/lib/saneamento/tarifas";
import { calcularConta } from "@/lib/saneamento/conta";
import { inteiro, numero, reais } from "@/lib/saneamento/formato";
import { resumoContratado } from "@/lib/saneamento/contratos";

/**
 * Capítulos cujo número de prova seria um valor financeiro autodeclarado ao SINISA (investimento e origem dos recursos). Pela decisão de
 * 20/10/2026 (src/lib/saneamento/autodeclarado.ts), esses valores não vão para a entrada: o capítulo aparece com o resumo e a marca,
 * e o número fica dentro dele.
 */
export const CAPITULOS_SEM_MANCHETE_FINANCEIRA = [9, 10] as const;

export type Resposta = {
  /** Número exibido, no mesmo formato da página do capítulo. */
  valor: string;
  /** O que o número mede. */
  rotulo: string;
  /** Resposta curta à pergunta do capítulo, só com fatos. */
  frase: string;
  /** Fonte e período. */
  fonte: string;
};

/** Anos de 2025 a 2033: do ano de referência do SINISA (2024) ao prazo legal (31/12/2033). */
export const ANOS_ATE_META = 9;
/** Motivo de interrupção sistemática declarado ao SINISA (GTA3011) que liga o racionamento à falta de água bruta. */
export const MANANCIAL = "Baixa disponibilidade do manancial";
/** Janela das tabelas do SIH e do SIM integradas. */
export const JANELA_SAUDE = `${ANOS_SAUDE[0]} a ${ANOS_SAUDE[ANOS_SAUDE.length - 1]}`;

export const FONTES_INVESTIMENTO = [
  { id: "proprios", rotulo: "Recursos próprios", cor: "var(--cor-obee)" },
  { id: "onerosos", rotulo: "Onerosos (empréstimos e financiamentos)", cor: "var(--serie-comp-1)" },
  { id: "nao_onerosos", rotulo: "Não onerosos (transferências e doações)", cor: "var(--serie-comp-3)" },
] as const;
export type ChaveFonte = (typeof FONTES_INVESTIMENTO)[number]["id"];

/** Investimento de prestador e Estado, em água e esgoto, por origem dos recursos (SINISA). */
export function fontesDe(a: Agregado): Record<ChaveFonte, number> {
  const out: Record<ChaveFonte, number> = { proprios: 0, onerosos: 0, nao_onerosos: 0 };
  for (const inv of [a.sinisa.agua.investimento, a.sinisa.esgoto.investimento] as (Investimento | null)[]) {
    for (const f of FONTES_INVESTIMENTO) out[f.id] += (inv?.prestador_fontes?.[f.id] ?? 0) + (inv?.estado_fontes?.[f.id] ?? 0);
  }
  return out;
}

const pct = (v: number | null | undefined, casas = 1) => `${numero(v, casas)}%`;
const tem = (...vs: unknown[]) => vs.every((v) => v != null && !(typeof v === "number" && !Number.isFinite(v)));

export function respostasDosCapitulos(): Partial<Record<number, Resposta>> {
  const br = agregado("BR");
  if (!br) return {};
  const out: Partial<Record<number, Resposta>> = {};
  const mor = br.censo2022.moradores;
  const ag = br.sinisa.agua.indicadores;
  const es = br.sinisa.esgoto.indicadores;

  // 1. Acesso: pessoas, pelo Censo.
  if (tem(mor?.agua.sem_ligacao, mor?.esgoto.sem_rede_nem_septica)) {
    out[1] = {
      valor: inteiro(mor!.esgoto.sem_rede_nem_septica),
      rotulo: "pessoas sem rede de esgoto nem fossa séptica",
      frase: `No Censo 2022, ${inteiro(mor!.agua.sem_ligacao)} pessoas viviam em domicílios sem ligação à rede geral de água e ${inteiro(mor!.esgoto.sem_rede_nem_septica)} sem rede de esgoto nem fossa séptica.`,
      fonte: "IBGE, Censo 2022",
    };
  }

  // 2. Desigualdades: a mesma proporção da abertura do capítulo.
  const prop = (id: string) => {
    const [n, d] = br.desigualdades?.[id] ?? [null, null];
    return razaoPct(n, d);
  };
  const parda = prop("parda-esgoto");
  const branca = prop("branca-esgoto");
  if (tem(parda, branca)) {
    out[2] = {
      valor: pct(parda),
      rotulo: "dos moradores de cor ou raça parda sem rede nem fossa séptica",
      frase: `Viviam sem rede de esgoto nem fossa séptica ${pct(parda)} dos moradores de cor ou raça parda e ${pct(branca)} dos de cor ou raça branca.`,
      fonte: "IBGE, Censo 2022 (SIDRA 6894)",
    };
  }

  // 3. Continuidade.
  const c = br.continuidade;
  if (tem(c?.paralisacoes, c?.interrupcoes_sistematicas, c?.municipios_com_interrupcoes)) {
    out[3] = {
      valor: inteiro(c!.interrupcoes_sistematicas),
      rotulo: "interrupções sistemáticas (racionamento ou rodízio) declaradas",
      frase: `Em 2024, os prestadores declararam ${inteiro(c!.paralisacoes)} paralisações com falta de água e ${inteiro(c!.interrupcoes_sistematicas)} interrupções sistemáticas; ${inteiro(c!.municipios_com_interrupcoes)} municípios tiveram ao menos uma interrupção sistemática.`,
      fonte: "SINISA 2024, declarado pelos prestadores",
    };
  }

  // 4. Esgoto.
  if (tem(es.IES0007, es.IES0001, es.IES2004)) {
    out[4] = {
      valor: pct(es.IES0007),
      rotulo: "dos domicílios com coleta e tratamento de esgoto (IES0007)",
      frase: `A rede coletora atende ${pct(es.IES0001)} da população (IES0001), e ${pct(es.IES2004)} do esgoto coletado é tratado (IES2004).`,
      fonte: "SINISA 2024",
    };
  }

  // 5. Preço regulado: a mesma conta de 10 m³ da página do capítulo.
  const contas10 = TARIFAS.map((t) => calcularConta(t.categorias.residencial, 10).total).sort((a, b) => a - b);
  if (contas10.length >= 2) {
    const faixa = `${reais(contas10[0])} a ${reais(contas10[contas10.length - 1])}`;
    out[5] = {
      valor: faixa,
      rotulo: "conta residencial de água e esgoto com 10 m³ por mês",
      frase: `Com 10 m³ por mês na categoria residencial, a conta vai de ${faixa} nas ${TARIFAS.length} tabelas verificadas em atos oficiais; atos e vigências diferem.`,
      fonte: `Atos tarifários, consultas em ${periodoConsultaTarifas()}`,
    };
  }

  // 6. Tarifa social: vínculos prestador × município de água, como no capítulo.
  const municipiosCom = new Set<string>();
  let economias = 0;
  for (const f of fichas()) {
    for (const v of f.sinisa.prestadores ?? []) {
      const t = v.tarifa ?? {};
      if (v.servico !== "agua" || t.GFI1019 !== "Sim") continue;
      municipiosCom.add(f.id);
      if (typeof t.GFI1036 === "number") economias += t.GFI1036;
    }
  }
  if (municipiosCom.size > 0) {
    out[6] = {
      valor: inteiro(municipiosCom.size),
      rotulo: "municípios com tarifa social de água declarada",
      frase: `Em 2024, os prestadores declararam tarifa social de água em ${inteiro(municipiosCom.size)} municípios, com ${inteiro(economias)} economias residenciais na categoria.`,
      fonte: "SINISA 2024, declarado pelos prestadores",
    };
  }

  // 7. Prestadores.
  const lista = prestadores();
  const popRegionais = lista.filter((p) => p.abrangencia === "Regional").reduce((s, p) => s + (p.populacao_atendida_agua ?? 0), 0);
  const pctRegionais = razaoPct(popRegionais, br.sinisa.agua.pop_atendida);
  if (lista.length > 0 && tem(pctRegionais)) {
    out[7] = {
      valor: inteiro(lista.length),
      rotulo: "prestadores declarados ao SINISA",
      frase: `${inteiro(lista.length)} prestadores declararam serviço de água ou esgoto em 2024; os regionais atendem ${pct(pctRegionais)} da população com água.`,
      fonte: "SINISA 2024",
    };
  }

  // 8. Comparar prestadores: as perdas do Brasil, a mesma fórmula que o comparador aplica a cada prestador.
  if (tem(ag.IAG2013)) {
    out[8] = {
      valor: pct(ag.IAG2013),
      rotulo: "de perdas totais de água na distribuição, Brasil (IAG2013)",
      frase: `No Brasil, as perdas totais na distribuição somam ${pct(ag.IAG2013)} da água produzida e importada; o comparador aplica a mesma fórmula a até quatro prestadores.`,
      fonte: "SINISA 2024",
    };
  }

  // 9 e 10 (investimento e origem dos recursos): sem resposta na entrada, ver CAPITULOS_SEM_MANCHETE_FINANCEIRA.

  // 11. Planejamento: o ritmo aritmético da tabela do capítulo, no indicador oficial consolidado.
  const metaEsgoto = meta()?.metas.esgoto ?? 90;
  const g = br.gestao;
  if (tem(es.IES0007, g?.plano_sim)) {
    const ritmo = Math.max(0, metaEsgoto - es.IES0007!) / ANOS_ATE_META;
    out[11] = {
      valor: numero(ritmo, 2),
      rotulo: `pontos percentuais por ano para chegar a ${metaEsgoto}% de coleta com tratamento até 2033`,
      frase: `Com ${pct(es.IES0007)} dos domicílios com coleta e tratamento em 2024 (IES0007), chegar a ${metaEsgoto}% até 2033 exige ${numero(ritmo, 2)} pontos por ano; ${inteiro(g!.plano_sim)} municípios declaram ter plano municipal de saneamento.`,
      fonte: "SINISA 2024; Lei 11.445/2007, art. 11-B",
    };
  }

  // 15. Contratado desde o novo marco: contagem própria da tabela curada (nunca a de parte interessada).
  const rc = resumoContratado();
  if (rc && rc.contratos_de_servico_adjudicados > 0) {
    out[15] = {
      valor: inteiro(rc.contratos_de_servico_adjudicados),
      rotulo: "leilões de concessão ou PPP com contrato adjudicado desde 2020, na tabela curada",
      frase: `Desde o novo marco, ${inteiro(rc.leiloes_registrados)} leilões e desestatizações estão registrados, ${inteiro(rc.contratos_de_servico_adjudicados)} com contrato de serviço adjudicado; ${inteiro(rc.contratos_com_metas)} ${rc.contratos_com_metas === 1 ? "contrato tem" : "contratos têm"} metas transcritas e ${inteiro(rc.municipios_proxy_sinisa)} municípios declaram ao SINISA concessão iniciada de 2020 em diante.`,
      fonte: `Tabela curada (fontes por linha), capturada em ${rc.capturado_em.slice(8, 10)}/${rc.capturado_em.slice(5, 7)}/${rc.capturado_em.slice(0, 4)}; SINISA 2024`,
    };
  }

  // 12. Responsáveis.
  const regs = reguladores();
  const respondentes = municipios().filter((m) => m.gm_respondeu === "Sim");
  const semRegAgua = respondentes.filter((m) => m.reg_ag == null).length;
  if (regs.length > 0 && respondentes.length > 0) {
    out[12] = {
      valor: inteiro(regs.length),
      rotulo: "entidades reguladoras declaradas, por CNPJ",
      frase: `Os municípios declararam ${inteiro(regs.length)} entidades reguladoras distintas; ${inteiro(semRegAgua)} municípios respondentes não informaram regulador para a água.`,
      fonte: "SINISA 2024, módulo Gestão Municipal",
    };
  }

  // 13. Saúde e ambiente: totais do TabNet, como nos números do capítulo.
  const totais = meta()?.saude?.totais_tabnet;
  const internacoes = totais?.["sih-intestinais-int"];
  const obitos = totais?.["sim-intestinais-obt"];
  if (tem(internacoes, obitos)) {
    out[13] = {
      valor: inteiro(internacoes),
      rotulo: `internações por infecções intestinais, ${JANELA_SAUDE}`,
      frase: `De ${JANELA_SAUDE}, foram ${inteiro(internacoes)} internações pagas pelo SUS e ${inteiro(obitos)} óbitos por infecções intestinais; o capítulo põe as taxas ao lado da carência de esgoto, sem atribuir causa.`,
      fonte: "DATASUS, SIH e SIM",
    };
  }

  // 14. Resiliência.
  let porManancial = 0;
  let comColapso = 0;
  for (const f of fichas()) {
    const t = f.sinisa.agua.tecnica ?? {};
    if ((t.GTA3006 ?? 0) > 0) comColapso += 1;
    if ((t.GTA3003 ?? 0) > 0 && f.sinisa.agua.motivo_interrupcoes === MANANCIAL) porManancial += 1;
  }
  if (c) {
    out[14] = {
      valor: inteiro(porManancial),
      rotulo: "municípios com racionamento por baixa disponibilidade do manancial",
      frase: `Em 2024, ${inteiro(porManancial)} municípios declararam racionamento atribuído à baixa disponibilidade do manancial, e ${inteiro(comColapso)} declararam dias de colapso do sistema.`,
      fonte: "SINISA 2024, declarado pelos prestadores",
    };
  }

  return out;
}
