import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { MercadoDetalhe, MercadoGold } from "@/lib/energia/tipos-mercado";

/**
 * Contrato da gold do módulo Mercado (public/energia/gold/mercado.json) nos pontos corrigidos
 * depois da verificação de 01/10/2026: cada teste falharia na gold anterior. Os números
 * esperados vêm de conferências independentes registradas no documento do módulo
 * (docs/observatorios/energia/modulos/mercado.md, seção 4).
 */
const ler = <T,>(...p: string[]): T => JSON.parse(readFileSync(join(process.cwd(), ...p), "utf-8")) as T;
const g = ler<MercadoGold>("public", "energia", "gold", "mercado.json");
const d = ler<MercadoDetalhe>("public", "energia", "series", "mercado_detalhe.json");

describe("mercado: acesso à CCEE pendente de decisão", () => {
  it("painéis que dependem da CCEE não aparecem como concluídos", () => {
    expect(g.acesso_ccee.decisao.situacao).toBe("pendente");
    for (const p of g.paineis) {
      expect(p.depende_da_ccee, p.id).toBe(true);
      expect(p.estado_dados, p.id).toBe("pendente_decisao_acesso");
      expect(p.limitacoes.some((l) => l.includes("Decisão pendente")), p.id).toBe(true);
    }
  });
});

describe("mercado: ACL sem exportação (P032)", () => {
  it("junho de 2023: 38,39% sem a exportação e 39,76% com ela", () => {
    const jun = g.livre_regulado.ccee_mensal.find((x) => x.mes === "2023-06")!;
    expect(jun.acl_pct).toBeCloseTo(38.39, 2);
    expect(jun.acl_com_exportacao_pct).toBeCloseTo(39.76, 2);
    expect(jun.exportacao_mwmed).toBeCloseTo(1480.2, 1);
  });

  it("12 meses até julho de 2026: 42,51% sem e 42,76% com exportação", () => {
    const k = g.livre_regulado.kpis.participacao_acl_ccee_12m!;
    expect(k.valor_pct).toBeCloseTo(42.51, 2);
    expect(k.com_exportacao_pct).toBeCloseTo(42.76, 2);
  });

  it("consumo contabilizado conferido com 'O consumo contabilizou' do InfoMercado, não com 'Consumo/Geração'", () => {
    const jul = g.livre_regulado.reconciliacao.infomercado.find((x) => x.medida === "consumo_contabilizado_mwmed" && x.mes === "2026-07")!;
    expect(jul.publicado).toBe(70238);
    expect(jul.calculado!).toBeCloseTo(70235.7, 1);
    expect(jul.resultado).toBe("aprovado");
    expect(g.livre_regulado.reconciliacao.infomercado.some((x) => x.medida.startsWith("consumo_geracao"))).toBe(false);
  });

  it("participação anual divergente entre EPE e consolidação do MME publicada como ressalva", () => {
    const c = g.livre_regulado.reconciliacao.mme_consolidacao_anual.find((x) => x.ano === "2025")!;
    expect(c.mme_acl_pct).toBe(45.6);
    expect(c.resultado).toBe("ressalva");
  });
});

describe("mercado: SAMP com completude por medida (P032/P033)", () => {
  it("julho de 2026 incompleto (ELEKTRO e EQUATORIAL PA sem linhas LIVRE) e reconciliação em junho", () => {
    const jul = g.livre_regulado.samp_nacional_mensal.find((x) => x.mes === "2026-07")!;
    expect(jul.completo).toBe(false);
    expect(jul.ocorrencias.some((o) => o.startsWith("ELEKTRO sem linhas LIVRE"))).toBe(true);
    const rec = g.agentes_migracao.kpis.ucs_livres!.evidencia.reconciliacao!;
    expect(rec.descricao).toContain("2026-06");
    expect(rec.descricao).toContain("98,2%");
  });
});

describe("mercado: parcelas de carga sem as distribuidoras (P033)", () => {
  it("julho de 2026: 46.751 parcelas e 21.787.337 MWh no ACL; 139 das distribuidoras à parte", () => {
    const u = g.agentes_migracao.parcelas_mensal.find((x) => x.mes === "2026-07")!;
    expect(u.parcelas).toBe(46751);
    expect(u.consumo_acl_mwh).toBe(21787337);
    expect(u.parcelas_distribuidoras).toBe(139);
    expect(u.consumo_distribuidoras_mwh).toBe(29353995);
    expect(u.conferencia_ok).toBe(true);
    expect(g.agentes_migracao.kpis.parcelas_carga!.evidencia.indicador).toContain("sem as parcelas das distribuidoras");
  });

  it("cadastro de perfis com data de modificação do portal, sem data de posição inventada", () => {
    const p = g.agentes_migracao.perfis;
    expect(p.data_referencia).toBeNull();
    expect(p.data_modificacao_portal).toBe("2026-09-01");
    expect("posicao" in p).toBe(false);
  });

  it("desligamentos: ano corrente marcado como parcial", () => {
    const a = g.agentes_migracao.desligamentos_por_ano.filter((x) => x.ano === "2026");
    expect(a.length).toBeGreaterThan(0);
    for (const x of a) {
      expect(x.completo).toBe(false);
      expect(x.meses).toBe(9);
    }
    expect(d.desligamentos_anual.filter((x) => x.ano === "2026").every((x) => !x.completo)).toBe(true);
  });
});

describe("mercado: GSF de 12 meses e InfoMercado (P034)", () => {
  it("divergência com o número de 12 meses publicada na evidência e no texto", () => {
    const k = g.mre_gsf.kpis.gsf_12m!;
    expect(k.infomercado_12m?.publicado_pct).toBe(92.55);
    expect(k.infomercado_12m?.resultado).toBe("ressalva");
    expect(k.evidencia.reconciliacao?.descricao).toContain("DIVERGÊNCIA");
    expect(g.paineis.find((p) => p.id === "P034")!.resposta).toContain("92,55%");
  });
});

describe("mercado: liquidação e pagamento (P035)", () => {
  it("abril de 2025 presente como ausência e meses não informados nulos", () => {
    const abr = g.encargos.liquidacao_mensal.find((x) => x.mes === "2025-04")!;
    expect(abr.situacao).toBe("mes_ausente_na_fonte");
    expect(abr.a_liquidar).toBeNull();
    expect(g.encargos.lacunas_liquidacao).toContain("2025-04");
    for (const x of g.encargos.liquidacao_mensal.filter((y) => y.situacao === "liquidacao_nao_informada")) {
      expect(x.liquidado, x.mes).toBeNull();
      expect(x.inadimplencia, x.mes).toBeNull();
    }
  });

  it("zeros repetidos do pagamento de ESS não aparecem como pagamento nulo", () => {
    const z = g.encargos.pagamento_mensal.filter((x) => x.mes >= "2025-02" && x.mes <= "2026-07");
    expect(z.length).toBe(18);
    expect(z.every((x) => x.pagamento_ess === null && x.situacao_pagamento_ess === "zero_nao_confirmado")).toBe(true);
    expect(g.encargos.controles_pagamento.series.pagamento_ess[0].meses).toBe(18);
  });

  it("ESS de 2025 conferido com a consolidação anual do MME", () => {
    const c = g.encargos.mme.consolidacao_anual.find((x) => x.ano === "2025")!;
    expect(c.resultado).toBe("aprovado");
    expect(c.ccee_rs! / 1e9).toBeCloseTo(1.19, 2);
  });
});

describe("mercado: proveniência", () => {
  it("agregados calculados com natureza CALCULADO, fórmula e período derivado das séries", () => {
    const p = g.proveniencia;
    for (const k of ["risco_hidrologico_acr", "encargos_ccee", "consumo_ccee", "agentes_ccee"] as const) {
      expect(p[k].natureza, k).toBe("CALCULADO");
      expect(p[k].formula, k).toBeTruthy();
    }
    const ag = g.agentes_migracao;
    const fim = [ag.agentes_por_classe_mensal.at(-1)!.mes, ag.associados_fluxos.at(-1)!.mes, ag.parcelas_mensal.at(-1)!.mes].sort().at(-1);
    expect(p.agentes_ccee.periodo_referencia.fim).toBe(fim);
    expect(p.encargos_ccee.periodo_referencia.inicio <= g.encargos.ess_mensal[0].mes).toBe(true);
  });
});
