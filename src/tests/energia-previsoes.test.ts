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
