/* eslint-disable @typescript-eslint/no-explicit-any -- leitura da gold publicada */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type {
  CalibracaoRegraAntiga,
  CelulaAtual,
  Desempenho,
  ParticaoEmissoes,
  PrevisaoAtual,
  PrevisoesDesempenhoGold,
  Prospectivo,
  PublicacaoDesempenho,
  PublicadoNoCorte,
  RegistroEmissao,
  Rodada,
  Rotina,
} from "@/lib/energia/tipos-previsoes";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PaginaPrevisoes from "@/app/setor-eletrico/pld/previsoes/page";
import PaginaModelos from "@/app/setor-eletrico/pld/modelos/page";
import PaginaFicha, { generateStaticParams as paramsFicha } from "@/app/setor-eletrico/pld/modelos/[modelo]/page";
import { PrevisoesIndisponivel } from "@/components/energia/PrevisoesPagina";
import { DESTINOS_NAVEGACAO } from "@/lib/energia/navegacao";
import { matrizExportacao } from "@/lib/energia/tabela";
import {
  COLUNAS_ARQUIVO,
  COLUNAS_GRADE,
  COLUNAS_MODELOS,
  PAINEIS_PREVISOES,
  ROTA_MODELOS,
  ROTA_PREVISOES,
  arquivoAte,
  coeficientesDoSegmento,
  colunasCoeficientes,
  d7AcimaDe1,
  datasInclusao,
  diasDaEntrega,
  diasSemRodada,
  enderecoPainel,
  fimDaEntrega,
  instanteBR,
  linhasAmostra,
  linhasArquivo,
  linhasCoeficientes,
  linhasDesempenho,
  linhasGrade,
  linhasGraficoRodadas,
  linhasModelos,
  linhasProspectivo,
  linhasPublicadoNoCorte,
  linhasReexecucao,
  matrizGrade,
  minimoCalibracao,
  minusculaInicial,
  oQueMudouRodada,
  perguntaPainel,
  proximoPainel,
  respostaFicha,
  respostaP013,
  respostaP014,
  respostaP015,
  respostaP016,
  resumoRodadas,
  rodadasRecentes,
  textoCoeficientes,
  textoEmissao,
  textoPublicadoNoCorte,
  textoTolerancia,
} from "@/lib/energia/previsoes";
import { interpretarCsv, lerCsvPrevisoes } from "@/lib/energia/previsoes-arquivos";

/**
 * Contrato da gold do módulo Previsões (public/energia/gold/previsoes_desempenho.json) com
 * os tipos de src/lib/energia/tipos-previsoes.ts, e das partições publicadas do arquivo de
 * emissões. Cada mapa abaixo é conferido pelo compilador contra o tipo (chave a mais, a
 * menos ou com a obrigatoriedade trocada não compila) e, em tempo de teste, contra as
 * chaves da gold: campo novo na gold sem tipo, ou campo obrigatório do tipo ausente na
 * gold, reprova. Foi assim que publicacao_desempenho, desempenho.calculado,
 * calibracao_recalculada, calibracao_regra_antiga e ultimo_dia_ear/ena passaram sem tipo.
 */

/** true = obrigatório no tipo; false = opcional. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- teste de campo opcional no tipo
type Mapa<T> = { [K in keyof T]-?: {} extends Pick<T, K> ? false : true };

const raiz = process.cwd();
const gold: any = JSON.parse(readFileSync(join(raiz, "public", "energia", "gold", "previsoes_desempenho.json"), "utf-8"));

function confere(obj: Record<string, unknown>, mapa: Record<string, boolean>, rotulo: string) {
  const chaves = Object.keys(obj);
  const declaradas = Object.keys(mapa);
  for (const k of chaves) expect(declaradas, `${rotulo}: campo ${k} da gold sem tipo`).toContain(k);
  for (const [k, obrigatoria] of Object.entries(mapa)) {
    if (obrigatoria) expect(chaves, `${rotulo}: campo obrigatório ${k} ausente na gold`).toContain(k);
  }
}

const TOPO = {
  dominio: true,
  gold: true,
  gerado_em: true,
  versao_pipeline: true,
  versao_codigo: true,
  disponivel: true,
  motivo: false,
  paineis: true,
  proveniencia: true,
  definicoes: true,
  dados: true,
  modelos: true,
  publicacao_desempenho: true,
  desempenho: true,
  selecao: true,
  regimes: true,
  sensibilidade_latencia: true,
  g23_r1: true,
  prospectivo: true,
  rotina: true,
  previsao_atual: true,
  fichas: true,
  governanca: true,
  evidencias: true,
  validacoes: true,
  downloads: true,
} satisfies Mapa<PrevisoesDesempenhoGold>;

const DADOS = {
  instante_informacao: true,
  ultimo_dia_pld: true,
  origens: true,
  snapshots: true,
  revisoes_hidrologia: true,
  dicionarios_ons: true,
  ultima_entrega_apurada_teste: true,
  linhas_csv: true,
  ultimo_dia_ear: true,
  ultimo_dia_ena: true,
  configuracao_sha256: true,
  configuracao_registrada_sha256: true,
} satisfies Mapa<PrevisoesDesempenhoGold["dados"]>;

const DESEMPENHO_RETIDO = { publicado: true, motivo: true, calculado: true } satisfies Mapa<
  Extract<Desempenho, { publicado: false }>
>;
const DESEMPENHO_PUBLICADO = {
  publicado: true,
  por_horizonte: true,
  por_frequencia: true,
  por_celula: true,
  por_celula_nota: true,
} satisfies Mapa<Extract<Desempenho, { publicado: true }>>;

const PUBLICACAO_RETIDA = {
  estado: true,
  publicado: true,
  regra: true,
  decisao: true,
  motivo: true,
  interpretacao_do_implementador: true,
  para_liberar: true,
  arquivos_retirados_do_portal: true,
} satisfies Mapa<Extract<PublicacaoDesempenho, { estado: "RETIDA" }>>;
const PUBLICACAO_LIBERADA = { estado: true, publicado: true, regra: true, decisao: true } satisfies Mapa<
  Extract<PublicacaoDesempenho, { estado: "LIBERADA" }>
>;

const ATUAL = {
  disponivel: true,
  rotulo: true,
  run_id: true,
  origem: true,
  cutoff: true,
  prazo: true,
  emitido_em: true,
  atraso_min: true,
  modo: true,
  alertas: true,
  versao_codigo: true,
  celulas: true,
  bandas: true,
  candidatos: true,
  ja_publicado_no_corte: true,
  proveniencia: true,
} satisfies Mapa<Extract<PrevisaoAtual, { rotulo: string }>>;

const CELULA = {
  horizonte: true,
  submercado: true,
  entrega: true,
  previsao: true,
  status: true,
  motivo: true,
  quantis: true,
  calibracao: true,
  limites: true,
  ajustada_ao_limite: true,
  fracao_conhecida: true,
  periodo_usado: true,
  forecast_id: true,
  calibracao_recalculada: false,
  evidencia: true,
} satisfies Mapa<CelulaAtual>;

const NO_CORTE = {
  cutoff: true,
  origem: true,
  natureza: true,
  nota: true,
  submercados: true,
  proveniencia: true,
} satisfies Mapa<PublicadoNoCorte>;

const NO_CORTE_SM = {
  horas: true,
  primeira: true,
  ultima: true,
  media: true,
  minimo: true,
  maximo: true,
  valores: true,
  capturado_em: true,
  evidencia: true,
} satisfies Mapa<PublicadoNoCorte["submercados"]["SE"]>;

const PROSPECTIVO = {
  rodadas: true,
  total_rodadas: true,
  registros: true,
  registros_por_tipo: true,
  apuracoes: true,
  apuracoes_total: true,
  metricas: true,
  leitura: true,
  revisoes_entre_rodadas: true,
  reexecucao: true,
  calibracao_regra_antiga: true,
} satisfies Mapa<Prospectivo>;

const RODADA = {
  run_id: true,
  origem: true,
  cutoff: true,
  prazo: true,
  emitido_em: true,
  atraso_min: true,
  atraso_origem: true,
  no_prazo: true,
  modo: true,
  executor: true,
  run_url: true,
  tipos: true,
  modelos: true,
  versao_codigo: true,
  celulas: true,
  com_numero: true,
  falha: true,
  motivos: true,
  alertas: true,
  registrado_no_portal_em: true,
} satisfies Mapa<Rodada>;

const ROTINA = {
  workflow: true,
  cron_utc: true,
  horarios: true,
  fuso: true,
  inicio_operacao_agendada: true,
  verificado_em: true,
  dias_vencidos_ate: true,
  execucoes_agendadas: true,
  no_prazo: true,
  atrasadas: true,
  falhas: true,
  dias_sem_rodada: true,
  dias_sem_rodada_total: true,
  comprovada: true,
  leitura: true,
  criterio_comprovacao: true,
} satisfies Mapa<Rotina>;

const REGRA_ANTIGA = {
  descricao: true,
  rodadas: true,
  registros: true,
  cobertura_diferente: true,
  status_diferente: true,
  por_registro: true,
} satisfies Mapa<CalibracaoRegraAntiga>;

const REGRA_ANTIGA_REGISTRO = {
  forecast_id: true,
  run_id: true,
  horizonte: true,
  submercado: true,
  status_gravado: true,
  status_recalculado: true,
  entregas: true,
  cobertura_gravada: false,
  cobertura_recalculada: false,
} satisfies Mapa<CalibracaoRegraAntiga["por_registro"][number]>;

const CALIBRACAO_REGISTRO = {
  status: true,
  cobertura_p10_p90: false,
  cobertura_retida: false,
  entregas: false,
  fonte: false,
  comparacao: false,
} satisfies Mapa<RegistroEmissao["calibracao"]>;

const PARTICAO = { mes: true, registros: true, projecao: false } satisfies Mapa<ParticaoEmissoes>;

describe("contrato da gold previsoes_desempenho.json com os tipos", () => {
  it("chaves de topo, dados e publicação", () => {
    confere(gold, TOPO, "topo");
    confere(gold.dados, DADOS, "dados");
    confere(gold.desempenho, gold.desempenho.publicado ? DESEMPENHO_PUBLICADO : DESEMPENHO_RETIDO, "desempenho");
    confere(
      gold.publicacao_desempenho,
      gold.publicacao_desempenho.publicado ? PUBLICACAO_LIBERADA : PUBLICACAO_RETIDA,
      "publicacao_desempenho",
    );
  });

  it("P013: previsão atual, células e PLD já publicado no corte", () => {
    const at = gold.previsao_atual;
    if (!at.rotulo) return;
    confere(at, ATUAL, "previsao_atual");
    for (const c of at.celulas) confere(c, CELULA, `celula ${c.forecast_id}`);
    if (at.ja_publicado_no_corte) {
      confere(at.ja_publicado_no_corte, NO_CORTE, "ja_publicado_no_corte");
      for (const [sm, x] of Object.entries(at.ja_publicado_no_corte.submercados))
        confere(x as Record<string, unknown>, NO_CORTE_SM, `ja_publicado_no_corte ${sm}`);
    }
  });

  it("P015: prospectivo, rodadas, rotina e recalibração", () => {
    confere(gold.prospectivo, PROSPECTIVO, "prospectivo");
    for (const r of gold.prospectivo.rodadas) confere(r, RODADA, `rodada ${r.run_id}`);
    confere(gold.rotina, ROTINA, "rotina");
    confere(gold.prospectivo.calibracao_regra_antiga, REGRA_ANTIGA, "calibracao_regra_antiga");
    for (const r of gold.prospectivo.calibracao_regra_antiga.por_registro)
      confere(r, REGRA_ANTIGA_REGISTRO, `calibracao_regra_antiga ${r.forecast_id}`);
  });
});

describe("números publicados de P013 têm evidência", () => {
  it("cada célula com número aponta para uma evidência com o mesmo valor", () => {
    const at = gold.previsao_atual;
    if (!at.celulas) return;
    for (const c of at.celulas) {
      if (c.previsao === null) {
        expect(c.evidencia, c.forecast_id).toBeNull();
        continue;
      }
      const e = gold.evidencias[c.evidencia];
      expect(e, c.forecast_id).toBeTruthy();
      expect(e.valor_calculo).toBeCloseTo(c.previsao, 9);
      expect(e.testes.every((t: any) => t.resultado === "aprovado"), c.forecast_id).toBe(true);
    }
    expect(at.proveniencia.natureza).toBe("PREVISTO");
    if (at.ja_publicado_no_corte) expect(at.ja_publicado_no_corte.proveniencia.natureza).toBe("OBSERVADO");
  });
});

describe("retenção dos números de desempenho no portal", () => {
  const retida = !gold.publicacao_desempenho.publicado;
  const chaves = /"(mae|rmse|vies|ganho_vs_b0|perda_quantilica|cobertura_p10_p90|cobertura_p05_p95|largura_p10_p90|cobertura_gravada|cobertura_recalculada)"\s*:\s*-?\d/;

  it("gold sem número de desempenho quando retida", () => {
    if (!retida) return;
    expect(JSON.stringify(gold)).not.toMatch(chaves);
    expect(gold.selecao).toBeNull();
    expect(gold.g23_r1).toBeNull();
  });

  it("partições publicadas do arquivo de emissões sem cobertura quando retida, e com o tipo", () => {
    const dir = join(raiz, "public", "energia", "series");
    const nomes = readdirSync(dir).filter((n) => /^previsoes_emissoes_\d{4}-\d{2}\.json$/.test(n));
    expect(nomes.length).toBeGreaterThan(0);
    for (const n of nomes) {
      const texto = readFileSync(join(dir, n), "utf-8");
      const p = JSON.parse(texto);
      confere(p, PARTICAO, n);
      for (const r of p.registros) confere(r.calibracao, CALIBRACAO_REGISTRO, `${n} ${r.forecast_id} calibracao`);
      if (retida) expect(texto, n).not.toMatch(chaves);
    }
  });
});

/* ======================================================================================
 * Fase de interface: lógica pura, coerência gráfico/tabela/exportação, textos derivados
 * e renderização das páginas no servidor. Os valores esperados vêm da gold, do CSV e do
 * código Python por caminho independente das funções testadas.
 * ==================================================================================== */


const G = gold as PrevisoesDesempenhoGold;
const temCelulas = Array.isArray(gold.previsao_atual?.celulas) && gold.previsao_atual.celulas.length > 0;
const celulasGold: CelulaAtual[] = temCelulas ? gold.previsao_atual.celulas : [];
const br2 = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const CURTO: Record<string, string> = { SE: "SE/CO", S: "Sul", NE: "Nordeste", N: "Norte" };
const csvTexto = readFileSync(join(raiz, "public", "energia", "series", "previsoes_emissoes.csv"), "utf-8");
/** Leitura independente do CSV (outro caminho que não interpretarCsv). */
const csvBruto = csvTexto
  .trim()
  .split("\n")
  .map((l) => l.split(";"));
const cabCsv = csvBruto[0];
const colCsv = (nome: string) => cabCsv.indexOf(nome);

describe("navegação entre os quatro painéis", () => {
  it("cada painel tem rota, âncora e pergunta do Anexo A; a próxima pergunta percorre os quatro sem repetir", () => {
    expect(PAINEIS_PREVISOES.map((p) => p.codigo).sort()).toEqual(["P013", "P014", "P015", "P016"]);
    expect(perguntaPainel("p013")).toBe("Quais os preços possíveis nos próximos períodos?");
    expect(perguntaPainel("p014")).toBe("Como cada previsão foi calculada?");
    expect(perguntaPainel("p015")).toBe("O que foi previsto antes do resultado?");
    expect(perguntaPainel("p016")).toBe("O modelo supera referências simples?");
    expect(enderecoPainel("p013")).toBe(`${ROTA_PREVISOES}#p013`);
    expect(enderecoPainel("p016")).toBe(`${ROTA_MODELOS}#p016`);
    const visitados = new Set<string>();
    let id = "p013" as Parameters<typeof proximoPainel>[0];
    for (let i = 0; i < 4; i++) {
      visitados.add(id);
      id = proximoPainel(id).id;
    }
    expect(visitados.size).toBe(4);
    expect(id).toBe("p013");
  });

  it("o destino Previsões e modelos está publicado no menu", () => {
    expect(DESTINOS_NAVEGACAO.find((d) => d.slug === "pld-modelos")?.publicado).toBe(true);
  });
});

describe("datas das entregas", () => {
  it("o fim da entrega pelo identificador é o mesmo do instante gravado (Brasília, fim excluído)", () => {
    if (!temCelulas) return;
    for (const c of celulasGold) {
      // UTC−3 sem horário de verão desde 2019: 03h00Z é 00h00 de Brasília
      const fimBR = new Date(Date.parse(c.entrega.fim) - 3 * 3_600_000).toISOString().slice(0, 10);
      expect(fimDaEntrega(c.entrega.id), c.forecast_id).toBe(fimBR);
      const d = diasDaEntrega(c.entrega);
      expect(Date.parse(`${fimBR}T00:00:00Z`) - Date.parse(`${d.ultimo}T00:00:00Z`)).toBe(86_400_000);
    }
    expect(fimDaEntrega("W2026-10-03")).toBe("2026-10-10");
    expect(fimDaEntrega("M2026-12")).toBe("2027-01-01");
    expect(fimDaEntrega("X")).toBeNull();
  });

  it("instantes UTC exibidos em Brasília", () => {
    expect(instanteBR("2026-09-30T23:31:17Z")).toBe("30/09/2026 às 20h31");
    expect(instanteBR("2026-09-30T10:00:00Z")).toBe("30/09/2026 às 07h00");
    expect(diasSemRodada("2026-09-30", "2026-09-30")).toBe(0);
    expect(diasSemRodada("2026-09-28", "2026-09-30")).toBe(2);
  });
});

describe.skipIf(!temCelulas)("P013: grade, gráfico, tabela e exportação com as mesmas linhas", () => {
  const celulas = celulasGold;
  const linhas = linhasGrade(celulas);

  it("28 linhas, uma por célula, com o número gravado na gold", () => {
    expect(linhas).toHaveLength(celulas.length);
    expect(new Set(linhas.map((l) => l.id)).size).toBe(linhas.length);
    for (const c of celulas) {
      const l = linhas.find((x) => x.id === `${c.horizonte}:${c.submercado}`)!;
      expect(l.previsao, c.forecast_id).toBe(c.previsao);
      expect(l.p10).toBe(c.quantis?.p10 ?? null);
      expect(l.piso).toBe(c.limites?.piso_medio ?? null);
    }
  });

  it("grade 4 × 7, tabela longa e exportação trazem os mesmos números", () => {
    const m = matrizGrade(linhas);
    const daGrade = m.flatMap((r) => r.valores);
    expect(daGrade.slice().sort()).toEqual(linhas.map((l) => l.previsao).slice().sort());
    const exp = matrizExportacao(COLUNAS_GRADE, linhas);
    const iPrev = exp.cabecalho.findIndex((c) => c.startsWith("Referência B0"));
    expect(exp.linhas).toHaveLength(linhas.length);
    expect(exp.linhas.map((r) => r[iPrev])).toEqual(linhas.map((l) => l.previsao));
    // ausência de faixa exportada vazia, nunca zero
    const iP10 = exp.cabecalho.findIndex((c) => c.startsWith("P10"));
    linhas.forEach((l, i) => expect(exp.linhas[i][iP10]).toBe(l.p10));
  });

  it("resposta com o menor e o maior número por frequência, contados à parte na gold", () => {
    const t = respostaP013(G);
    const producao = G.modelos.some((m) => m.estado === "PRODUCAO");
    if (!producao) expect(t).toContain("Não há previsão oficial do PLD: nenhum modelo está aprovado para produção.");
    for (const f of ["W", "M"]) {
      const cs = celulas.filter((c) => c.horizonte.startsWith(f) && c.previsao !== null);
      if (!cs.length) continue;
      const min = cs.reduce((a, c) => (c.previsao! < a.previsao! ? c : a));
      const max = cs.reduce((a, c) => (c.previsao! > a.previsao! ? c : a));
      expect(t).toContain(`R$ ${br2(min.previsao!)}/MWh (${CURTO[min.submercado]})`);
      expect(t).toContain(`R$ ${br2(max.previsao!)}/MWh (${CURTO[max.submercado]})`);
    }
    if (celulas.every((c) => c.quantis === null)) expect(t).toContain("Sem faixa de incerteza: nenhum segmento está calibrado.");
    expect(t).not.toMatch(/—|–/);
  });

  it("resposta muda com o dado: rodada sem número e modelo em produção", () => {
    const sem = { ...G, previsao_atual: { ...G.previsao_atual, celulas: celulas.map((c) => ({ ...c, previsao: null, motivo: "SEM_PLD_CAPTURADO_ATE_O_CORTE" })) } };
    expect(respostaP013(sem as PrevisoesDesempenhoGold)).toContain(
      `não tem número em nenhuma das ${celulas.length} células: nenhum PLD do período exigido havia sido capturado até o corte.`,
    );
    const prod = { ...G, modelos: G.modelos.map((m) => (m.codigo === "B0" ? { ...m, estado: "PRODUCAO" } : m)) };
    expect(respostaP013(prod as PrevisoesDesempenhoGold)).toContain("Modelo em produção: B0.");
  });

  it("PLD já publicado no corte: média da gold, horas e gráfico com as mesmas horas", () => {
    const pub = G.previsao_atual.ja_publicado_no_corte as PublicadoNoCorte | null;
    if (!pub) return;
    for (const sm of ["SE", "S", "NE", "N"] as const) {
      const x = pub.submercados[sm];
      if (!x.horas) continue;
      const t = textoPublicadoNoCorte(pub, sm);
      expect(t).toContain(`média de R$ ${br2(x.media!)}/MWh`);
      expect(t).toContain(`${x.horas} horas`);
      // a média publicada confere com as horas publicadas (outro caminho)
      const soma = x.valores.reduce((a, [, v]) => a + (v ?? 0), 0);
      expect(soma / x.valores.length).toBeCloseTo(x.media!, 2);
    }
    const ls = linhasPublicadoNoCorte(pub);
    expect(ls).toHaveLength(Math.max(...Object.values(pub.submercados).map((x) => x.valores.length)));
    expect(ls[0].SE).toBe(pub.submercados.SE.valores[0][1]);
  });

  it("textos da emissão e do que mudou derivados da rodada", () => {
    const at = G.previsao_atual as Extract<PrevisaoAtual, { rotulo: string }>;
    const t = textoEmissao(at);
    if (at.atraso_min && at.atraso_min > 0) expect(t).toContain(`${Math.round(at.atraso_min)} minutos depois do prazo das 08h00`);
    if (at.modo === "manual") expect(t).toContain("emitida manualmente");
    const r = G.prospectivo.rodadas.slice().sort((a, b) => a.origem.localeCompare(b.origem));
    const ult = r[r.length - 1];
    expect(oQueMudouRodada(G)).toContain(`${ult.com_numero} de ${ult.celulas} células com número`);
  });
});

describe("P015: arquivo de emissões, CSV publicado e tabela", () => {
  const lido = interpretarCsv(csvTexto);
  const estados = Object.fromEntries(G.modelos.map((m) => [m.codigo, m.estado]));
  const linhas = linhasArquivo(lido.linhas, estados);

  it("o CSV é lido inteiro, sem linha descartada, com as colunas da fase de interface", () => {
    expect(lido.invalidas).toBe(0);
    expect(lido.linhas).toHaveLength(csvBruto.length - 1);
    expect(lido.linhas).toHaveLength(G.prospectivo.registros);
    for (const c of ["versao_codigo", "registrado_no_portal_em", "p10", "p90", "alertas", "substitui", "anterior"]) expect(cabCsv).toContain(c);
    expect(lerCsvPrevisoes("/energia/series/previsoes_emissoes.csv")?.linhas).toHaveLength(lido.linhas.length);
    // só arquivos do próprio módulo
    expect(lerCsvPrevisoes("/energia/series/../gold/pld.json")).toBeNull();
    expect(interpretarCsv("a;b\n1;2\n3\n").invalidas).toBe(1);
  });

  it("tabela e exportação têm as linhas do CSV, na mesma ordem e com os mesmos números", () => {
    const exp = matrizExportacao(COLUNAS_ARQUIVO, linhas);
    const iId = exp.cabecalho.indexOf("Identificador");
    const iPrev = exp.cabecalho.findIndex((c) => c.startsWith("Previsão arquivada"));
    const iSha = exp.cabecalho.indexOf("sha256 do registro");
    expect(exp.linhas.map((r) => r[iId])).toEqual(csvBruto.slice(1).map((r) => r[colCsv("forecast_id")]));
    expect(exp.linhas.map((r) => r[iSha])).toEqual(csvBruto.slice(1).map((r) => r[colCsv("sha256")]));
    // número de rodada interna de modelo fora de produção sai retido; os demais, como no CSV
    const esperado = csvBruto
      .slice(1)
      .map((r) => (r[colCsv("previsao")] === "" || (r[colCsv("tipo")] === "RODADA_INTERNA" && estados[r[colCsv("modelo")]] !== "PRODUCAO") ? null : Number(r[colCsv("previsao")])));
    expect(exp.linhas.map((r) => r[iPrev])).toEqual(esperado);
  });

  it("na interface, número de rodada interna de modelo fora de produção nunca aparece como previsão", () => {
    const cab = cabCsv;
    const base = Object.fromEntries(cab.map((c, i) => [c, csvBruto[1][i]]));
    // linha de teste: a mesma célula, como se a rodada interna tivesse gravado um número
    const interna = { ...base, tipo: "RODADA_INTERNA", modelo: "C2-P", previsao: "131.5", p10: "100", p90: "150" };
    const [l] = linhasArquivo([interna], { "C2-P": "PESQUISA" });
    expect([l.previsao, l.p10, l.p90, l.com_numero]).toEqual([null, null, null, "número retido (rodada interna)"]);
    const [p] = linhasArquivo([interna], { "C2-P": "PRODUCAO" });
    expect(p.previsao).toBe(131.5);
    const [r] = linhasArquivo([{ ...interna, tipo: "REFERENCIA_EXPERIMENTAL", modelo: "B0" }], { B0: "PESQUISA" });
    expect(r.previsao).toBe(131.5);
  });

  it("gráfico de rodadas conta as mesmas linhas da tabela e confere com as rodadas da gold", () => {
    const rs = resumoRodadas(linhas);
    expect(rs).toHaveLength(G.prospectivo.total_rodadas);
    for (const r of G.prospectivo.rodadas) {
      const x = rs.find((y) => y.run_id === r.run_id)!;
      expect(x.celulas, r.run_id).toBe(r.celulas);
      expect(x.com_numero, r.run_id).toBe(r.com_numero);
      expect(x.atraso_min, r.run_id).toBe(r.atraso_min);
    }
    const graf = linhasGraficoRodadas(rs);
    expect(graf.reduce((a, l) => a + (l.com_numero as number) + (l.sem_numero as number), 0)).toBe(linhas.length);
  });

  it("registro incluído depois da emissão aparece como transcrito; o do próprio dia, não", () => {
    csvBruto.slice(1).forEach((r, i) => {
      const emitidoBR = new Date(Date.parse(r[colCsv("emitido_em")]) - 3 * 3_600_000).toISOString().slice(0, 10);
      const transcrito = r[colCsv("registrado_no_portal_em")] > emitidoBR;
      expect(linhas[i].transcrito.startsWith("sim"), r[0]).toBe(transcrito);
    });
  });

  it("o arquivo como estava ao fim de cada dia só tem os registros incluídos até ele", () => {
    const datas = datasInclusao(linhas);
    expect(datas.length).toBeGreaterThan(0);
    for (const d of datas) {
      const ate = arquivoAte(linhas, d);
      expect(ate.length).toBe(csvBruto.slice(1).filter((r) => r[colCsv("registrado_no_portal_em")] <= d).length);
    }
    const antes = arquivoAte(linhas, "2000-01-01");
    expect(antes).toHaveLength(0);
    expect(respostaP015(antes, "2000-01-01", linhas.length)).toBe("Nenhum registro estava no arquivo ao fim de 01/01/2000.");
  });

  it("resposta do arquivo inteiro com contagens, transcrição e a primeira entrega a terminar", () => {
    const t = respostaP015(linhas, "", linhas.length);
    expect(t).toContain(`O arquivo tem ${linhas.length} registros de ${G.prospectivo.total_rodadas} rodadas.`);
    const semNumero = G.prospectivo.rodadas.filter((r) => r.com_numero === 0);
    for (const r of semNumero) expect(t).toContain(`A rodada de ${r.origem.split("-").reverse().join("/")}`);
    if (G.prospectivo.apuracoes.every((a) => a.realizado === null) && G.prospectivo.apuracoes.length) {
      const fins = G.prospectivo.apuracoes.map((a) => fimDaEntrega(a.entrega)!).sort();
      expect(t).toContain(`termina em ${fins[0].split("-").reverse().join("/")}`);
      expect(t).toContain("Nenhuma entrega prevista terminou");
    }
    expect(t).not.toMatch(/—|–/);
  });

  it("recorte da página guarda as rodadas mais recentes e declara as omitidas", () => {
    const rs = resumoRodadas(linhas);
    const r1 = rodadasRecentes(linhas, 1);
    expect(r1.omitidas).toBe(rs.length - 1);
    expect(new Set(r1.linhas.map((l) => l.run_id))).toEqual(new Set([rs[rs.length - 1].run_id]));
    expect(rodadasRecentes(linhas, 100).linhas).toHaveLength(linhas.length);
  });
});

describe("P014: fichas, pesos do último ajuste e reexecução", () => {
  const fichas = G.fichas;

  it("tabela das fichas: uma linha por modelo, com estado, implementação e número no arquivo", () => {
    const ls = linhasModelos(G);
    expect(ls.map((l) => l.codigo).sort()).toEqual(fichas.map((f) => f.codigo).sort());
    for (const f of fichas) {
      const l = ls.find((x) => x.codigo === f.codigo)!;
      expect(l.implementado).toBe(f.implementado_no_repositorio ? "sim" : "não");
      if (f.aprovacao.referencia_experimental) expect(l.emite).toBe("referência experimental publicada");
      if (!f.implementado_no_repositorio) expect(l.emite).toBe("não emite: sem implementação");
    }
    expect(matrizExportacao(COLUNAS_MODELOS, ls).linhas).toHaveLength(fichas.length);
  });

  it("resposta com o estado de todos os modelos e a reexecução gravada", () => {
    const t = respostaP014(G);
    const estados = new Set(fichas.map((f) => f.estado));
    if (estados.size === 1 && estados.has("PESQUISA")) expect(t).toContain(`Os ${fichas.length} modelos registrados estão todos em pesquisa: nenhum alimenta previsão oficial.`);
    const r = fichas.find((f) => f.reproducao?.reexecucao_do_arquivo)?.reproducao?.reexecucao_do_arquivo;
    if (r) {
      expect(t).toContain(`${r.conferidas} previsões arquivadas refeitas`);
      expect(t).toContain(r.divergentes.length ? `${r.divergentes.length} com divergência` : "sem divergência");
      expect(t).toContain("R$ 0,005/MWh");
    }
    expect(textoTolerancia("0.005 R$/MWh (previsão gravada com 4 casas decimais)")).toBe("R$ 0,005/MWh");
    expect(textoTolerancia("texto livre")).toBe("texto livre");
  });

  it("coeficientes: tabela e gráfico do segmento com os números da ficha; variável não usada é ausência", () => {
    const ls = linhasCoeficientes(fichas);
    const total = fichas.reduce((a, f) => a + (f.coeficientes_ultimo_ajuste?.segmentos.length ?? 0), 0);
    expect(ls).toHaveLength(total);
    for (const f of fichas) {
      for (const s of f.coeficientes_ultimo_ajuste?.segmentos ?? []) {
        const l = ls.find((x) => x.id === `${f.codigo}:${s.horizonte}-${s.submercado}`)!;
        for (const [k, v] of Object.entries(s.coeficientes ?? {})) expect(l[k], `${l.id} ${k}`).toBe(v);
        // C2-P não usa reservatório nem vazão: ausência, nunca zero
        if (!("ear28" in (s.coeficientes ?? {}))) expect(l.ear28).toBeNull();
      }
    }
    const seg = `${ls[0].horizonte}-${ls[0].segmento.split("-")[1]}`;
    const barras = coeficientesDoSegmento(fichas, seg);
    for (const b of barras) for (const l of ls.filter((x) => x.segmento === seg)) expect(b[l.modelo]).toBe(l[b.id as string] ?? null);
    expect(matrizExportacao(colunasCoeficientes(fichas), ls).linhas).toHaveLength(ls.length);
  });

  it("achado G23-R1: segmentos com coeficiente da média dos 7 dias acima de 1, contados direto nas fichas", () => {
    const esperado: string[] = [];
    for (const f of fichas)
      for (const s of f.coeficientes_ultimo_ajuste?.segmentos ?? []) {
        const v = s.coeficientes?.d7_menos_b0;
        if (typeof v === "number" && v > 1) esperado.push(`${f.codigo}:${s.horizonte}-${s.submercado}`);
      }
    expect(d7AcimaDe1(fichas).map((x) => `${x.modelo}:${x.segmento}`).sort()).toEqual(esperado.sort());
    for (const id of esperado) {
      const [, seg] = id.split(":");
      expect(textoCoeficientes(fichas, seg)).toContain("acima de 1");
    }
    const seguro = linhasCoeficientes(fichas).find((l) => !esperado.some((e) => e.endsWith(`:${l.segmento}`)));
    if (seguro) expect(textoCoeficientes(fichas, seguro.segmento)).toContain("Nenhum coeficiente da média dos 7 dias menos B0 passa de 1");
  });

  it("reexecução: cada número arquivado do B0 tem prova com o mesmo valor e teste aprovado", () => {
    const ls = linhasReexecucao(G);
    const comNumero = temCelulas ? celulasGold.filter((c) => c.evidencia) : [];
    expect(ls).toHaveLength(new Set(comNumero.map((c) => c.evidencia)).size);
    for (const l of ls) {
      const c = comNumero.find((x) => x.evidencia === l.id)!;
      expect(l.valor).toBeCloseTo(c.previsao!, 9);
      expect(l.resultado).toBe("aprovado");
    }
  });

  it("resposta da ficha diz o estado e, sem implementação, o motivo", () => {
    for (const f of fichas) {
      const t = respostaFicha(f, G);
      expect(t).toContain(`${f.codigo} (${f.nome}, versão ${f.versao}) está em`);
      if (!f.implementado_no_repositorio) expect(t).toContain(f.motivo_sem_implementacao!.slice(1, 40));
      expect(t).not.toMatch(/—|–/);
    }
  });
});

describe("P016: desempenho retido, amostra de calibração e prospectivo", () => {
  it("mínimo de calibração lido do texto da gold é o do código Python (outro caminho)", () => {
    const py = readFileSync(join(raiz, "pipeline", "energia", "governanca.py"), "utf-8");
    const m = /CALIBRACAO_MIN, CALIBRACAO_MAX, CALIBRACAO_N_MIN = [\d.]+, [\d.]+, (\d+)/.exec(py);
    expect(m).toBeTruthy();
    expect(minimoCalibracao(G.definicoes.calibracao)).toBe(Number(m![1]));
    expect(minimoCalibracao("sem número")).toBeNull();
  });

  it("amostra por horizonte: entregas distintas gravadas nas células, faltam até o mínimo", () => {
    const ls = linhasAmostra(G);
    const regs = G.prospectivo.calibracao_regra_antiga.por_registro;
    const min = minimoCalibracao(G.definicoes.calibracao)!;
    for (const l of ls) {
      const ns = regs.filter((r) => r.horizonte === l.horizonte).map((r) => r.entregas as number);
      expect(l.entregas).toBe(Math.min(...ns));
      expect(l.faltam).toBe(Math.max(0, min - l.entregas!));
    }
  });

  it("prospectivo por horizonte soma as apurações da gold", () => {
    const ls = linhasProspectivo(G);
    expect(ls.reduce((a, l) => a + l.registradas, 0)).toBe(G.prospectivo.apuracoes.length);
    expect(ls.reduce((a, l) => a + l.apuradas, 0)).toBe(G.prospectivo.apuracoes.filter((a) => a.realizado !== null).length);
    for (const l of ls) if (l.termina) expect(l.termina).toBe(fimDaEntrega(l.proxima_entrega!));
  });

  it("resposta com números retidos: o que está calculado, por que não aparece e a amostra; nenhum número de desempenho", () => {
    const t = respostaP016(G);
    if (G.desempenho.publicado) return;
    const aprov = G.validacoes.filter((v) => v.resultado === "aprovado").length;
    expect(t).toContain("Ainda não é possível responder no portal.");
    expect(t).toContain(`${aprov} de ${G.validacoes.length} controles aprovados`);
    expect(t).toContain(`${G.dados.origens.n.toLocaleString("pt-BR")} origens diárias`);
    expect(t).toContain("retidos até a liberação formal pelo responsável pela plataforma");
    const amostra = linhasAmostra(G);
    const w = amostra.find((a) => a.horizonte.startsWith("W"))!.entregas;
    const m = amostra.find((a) => a.horizonte.startsWith("M"))!.entregas;
    expect(t).toContain(`${w} entregas semanais e ${m} mensais distintas, abaixo do mínimo de ${minimoCalibracao(G.definicoes.calibracao)}`);
    expect(t).not.toMatch(/MAE|cobertura de \d|ganho de \d/i);
  });

  it("com a publicação liberada, as métricas viram linhas com cobertura em % e intervalo do ganho", () => {
    // linha de teste (não é dado publicado): confere só o mapeamento das colunas
    const linha = {
      modelo: "C2-P", horizonte: "W1", submercado: null, periodo: "teste", linhas: 10, entregas: 9, mae: 1, vies: 0, rmse: 1,
      mae_b0_pareado: 2, ganho_vs_b0: 1, ganho_ic90: [0.5, 1.5], skill: null, perda_quantilica: null, cobertura_p10_p90: 0.8,
      cobertura_p05_p95: null, largura_p10_p90: null, abaixo_p10: null, acima_p90: null, entregas_com_quantis: 9, calibracao: null,
    } as const;
    const [l] = linhasDesempenho([linha as unknown as Parameters<typeof linhasDesempenho>[0][number]]);
    expect([l.cobertura, l.ic_inf, l.ic_sup, l.mae_b0]).toEqual([80, 0.5, 1.5, 2]);
  });
});

describe.skipIf(!gold.disponivel)("páginas renderizadas no servidor", () => {
  const conteudo = (h: string) => h.slice(h.indexOf("<main"));
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const escTexto = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const prev = renderToStaticMarkup(createElement(PaginaPrevisoes));
  const mods = renderToStaticMarkup(createElement(PaginaModelos));
  const fichas = Object.fromEntries(paramsFicha().map(({ modelo }) => [modelo, renderToStaticMarkup(createElement(PaginaFicha, { params: { modelo } }))]));

  it("cada painel com a anatomia da seção 7.2 na sua página", () => {
    for (const [h, ids] of [
      [prev, ["p013", "p015"]],
      [mods, ["p014", "p016"]],
    ] as const) {
      for (const id of ids) {
        expect(h, id).toContain(`id="${id}"`);
        expect(h, id).toContain(`id="${id}-titulo"`);
        expect(h, id).toContain(esc(perguntaPainel(id)));
        expect(h, id).toContain(`data-resposta="${id}"`);
        // próxima pergunta: âncora na mesma página ou endereço do painel na outra
        const prox = proximoPainel(id);
        const naMesma = (h === prev ? ROTA_PREVISOES : ROTA_MODELOS) === prox.rota;
        expect(h.includes(`href="#${prox.id}"`) || h.includes(`href="${enderecoPainel(prox.id)}"`), `${id} -> ${prox.id}`).toBe(true);
        if (!naMesma) expect(h, id).toContain(`href="${enderecoPainel(prox.id)}"`);
      }
      for (const parte of ["Período", "Universo", "Unidade", "Como ler", "O que não permite concluir", "Como interpretar", "O que não é possível concluir", "Próxima pergunta", "Copiar link deste painel", "Baixar os dados deste painel"])
        expect(h, parte).toContain(parte);
      expect(h).toContain('role="radiogroup" aria-label="Nível de profundidade"');
      expect(h).toContain('data-nivel="analisar"');
      expect(h).toContain('data-nivel="auditar"');
      for (const p of PAINEIS_PREVISOES) expect(h).toContain(p.rotulo);
      expect(conteudo(h)).not.toMatch(/em breve|em constru|em integra/i);
      expect(conteudo(h)).not.toMatch(/—|–/);
    }
  });

  it("P013: respostas, três números com prova, grade 4 × 7 e tabela com os números da gold", () => {
    expect(prev).toContain(escTexto(respostaP013(G)));
    if (!temCelulas) return;
    expect((prev.match(/Comprove este número/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(prev).toContain('data-grade="4x7"');
    expect((prev.match(/data-grade-sm="/g) ?? []).length).toBe(4);
    for (const c of celulasGold) if (c.previsao !== null) expect(prev, c.forecast_id).toContain(br2(c.previsao));
    expect(prev).toContain("Células da rodada: referência B0, faixa, limites e período usado");
    expect(prev).toContain('data-kpis="SE"');
  });

  it("P015: resposta do recorte, gráfico de rodadas e tabela do arquivo", () => {
    const linhas = linhasArquivo(interpretarCsv(csvTexto).linhas, Object.fromEntries(G.modelos.map((m) => [m.codigo, m.estado])));
    expect(prev).toContain(escTexto(respostaP015(linhas, "", linhas.length)));
    expect(prev).toContain("Registros do arquivo de emissões");
    expect(prev).toContain("Células por rodada, com e sem número");
    expect(prev).toContain('type="date"');
    expect(prev).toContain("Previsões por entrega e rodada");
    expect((prev.match(/<table/g) ?? []).length).toBeGreaterThanOrEqual(6);
  });

  it("P014 e P016: respostas, provas da reexecução, fichas comparadas e amostra de calibração", () => {
    expect(mods).toContain(escTexto(respostaP014(G)));
    expect(mods).toContain(escTexto(respostaP016(G)));
    expect((mods.match(/data-reexec="/g) ?? []).length).toBe(linhasReexecucao(G).length);
    expect((mods.match(/comprove este número/g) ?? []).length).toBeGreaterThanOrEqual(linhasReexecucao(G).length);
    expect((mods.match(/data-ficha="/g) ?? []).length).toBe(Math.min(4, G.fichas.filter((f) => f.codigo !== "C1").length));
    expect(mods).toContain("As cinco fichas, em tabela");
    expect(mods).toContain("Entregas distintas do teste por horizonte, contra o mínimo para calibrar a faixa");
    expect(mods).toContain("Controles do teste e da rodada");
    if (!G.desempenho.publicado) expect(mods).toContain("Por que não há números de desempenho aqui:");
    expect((mods.match(/<table/g) ?? []).length).toBeGreaterThanOrEqual(8);
  });

  it("fichas: uma página por modelo, com a resposta, a fórmula ou o motivo e, no B0, a prova de cada número", () => {
    expect(Object.keys(fichas).sort()).toEqual(G.fichas.map((f) => f.codigo.toLowerCase()).sort());
    for (const f of G.fichas) {
      const h = fichas[f.codigo.toLowerCase()];
      expect(h, f.codigo).toContain(escTexto(respostaFicha(f, G)));
      expect(h, f.codigo).toContain("Próxima pergunta");
      expect(conteudo(h), f.codigo).not.toMatch(/—|–/);
      if (f.aprovacao.referencia_experimental) expect(h, f.codigo).toContain("data-reexecucao");
      if (f.coeficientes_ultimo_ajuste) expect(h, f.codigo).toContain(`Coeficientes do último ajuste do ${f.codigo}`);
      if (!f.implementado_no_repositorio) expect(h, f.codigo).toContain("Sem implementação no repositório");
    }
  });

  it("nenhuma página leva número de desempenho retido (conferido contra os resultados internos, quando existem)", () => {
    if (G.desempenho.publicado) return;
    const caminho = join(raiz, "data", "energia", "previsoes", "validacao_interna", "previsoes_desempenho_interno.json");
    let interno: any = null;
    try {
      interno = JSON.parse(readFileSync(caminho, "utf-8"));
    } catch {
      interno = null; // fora do ambiente de execução do pipeline os resultados retidos não existem
    }
    const retidos = new Set<string>();
    for (const l of interno?.desempenho?.por_horizonte ?? []) {
      if (l.periodo !== "teste") continue;
      for (const v of [l.mae, l.ganho_vs_b0]) if (typeof v === "number") retidos.add(`R$\u00a0${br2(v)}`);
      if (typeof l.cobertura_p10_p90 === "number") retidos.add(`${(l.cobertura_p10_p90 * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`);
    }
    for (const h of [prev, mods, ...Object.values(fichas)]) {
      const c = conteudo(h);
      for (const r of Array.from(retidos)) expect(c, r).not.toContain(r);
      // nenhum MAE, ganho ou cobertura escritos como número na página
      expect(c).not.toMatch(/MAE (do|de) [^<]{0,40}R\$\u00a0\d/);
    }
  });

  it("HTML de cada página abaixo de 520 KB antes das props (meta de cerca de 600 KB; contrato, seção 5.1)", () => {
    for (const [nome, h] of Object.entries({ prev, mods, ...fichas })) expect(h.length, nome).toBeLessThan(520_000);
  });

  it("gold ausente: indisponibilidade com o motivo, sem número de reserva", () => {
    const h = renderToStaticMarkup(createElement(PrevisoesIndisponivel, { motivo: "gold reprovada na validação" }));
    expect(h).toContain("Previsões e modelos indisponíveis nesta publicação");
    expect(h).toContain("gold reprovada na validação");
    expect(conteudo(h)).not.toMatch(/\d+,\d{2}/);
  });
});

describe("componentes do módulo", () => {
  const dir = join(raiz, "src/components/energia");
  const arquivos = [
    ...readdirSync(dir).filter((x) => x.startsWith("Previsoes")).map((f) => join(dir, f)),
    join(raiz, "src/app/setor-eletrico/pld/previsoes/page.tsx"),
    join(raiz, "src/app/setor-eletrico/pld/modelos/page.tsx"),
    join(raiz, "src/app/setor-eletrico/pld/modelos/[modelo]/page.tsx"),
    join(raiz, "src/lib/energia/previsoes.ts"),
  ];

  it("sem hexadecimal solto e sem travessão no texto", () => {
    for (const f of arquivos) {
      const t = readFileSync(f, "utf-8");
      expect(t, f).not.toMatch(/#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?\b/);
      expect(t, f).not.toMatch(/—|–/);
    }
  });

  it("módulos cliente só exportam componentes e tipos", () => {
    for (const f of arquivos.filter((x) => readFileSync(x, "utf-8").startsWith('"use client"'))) {
      const t = readFileSync(f, "utf-8");
      for (const m of Array.from(t.matchAll(/^export (const|let|var) (\w+)/gm))) expect(m[2], `${f} exporta ${m[2]}`).toMatch(/^[A-Z]/);
    }
  });
});

describe("texto citado da gold depois de dois-pontos", () => {
  it("só a primeira letra de palavra comum vira minúscula; siglas ficam", () => {
    expect(minusculaInicial("A composição do C1")).toBe("a composição do C1");
    expect(minusculaInicial("Nenhum modelo")).toBe("nenhum modelo");
    expect(minusculaInicial("CCEE publica")).toBe("CCEE publica");
    expect(minusculaInicial("B0 repete")).toBe("B0 repete");
  });
});
