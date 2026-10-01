import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { faseAtual, situacaoConsulta, type FaseConsulta, type GoldRegulacao } from "@/lib/energia/tipos-regulacao";

/**
 * Contrato da gold do módulo Regulação (P044 a P046) do lado da interface:
 * a regra de situação das consultas reaplicada na página (situacaoConsulta) dá o mesmo
 * resultado que o pipeline na data de referência da gold, e os limites do PLD mantêm os
 * campos separados que o painel de permanência do PLD consome. Os casos concretos (atos,
 * datas, patamares e módulos) vêm das fontes primárias citadas em
 * docs/observatorios/energia/modulos/regulacao.md, seção 4.
 */
const gold = JSON.parse(readFileSync(join(process.cwd(), "public/energia/gold/regulacao.json"), "utf-8")) as GoldRegulacao;
const disponivel = gold.disponivel === true;

const fase = (f: Partial<FaseConsulta>): FaseConsulta => ({
  fase: "abertura",
  data_deliberacao: "2026-01-01",
  reuniao: "x",
  inicio: null,
  fim: null,
  janela_origem: null,
  fim_calculado: false,
  duracao_dias: null,
  sessao: null,
  trecho_periodo: null,
  ...f,
});

describe("regra de situação das consultas (sem depender da gold)", () => {
  it("fase sem janela nunca vira aberta e o rótulo diz por quê", () => {
    expect(situacaoConsulta({ fases: [fase({ duracao_dias: 45 })], resultado: null }, "2026-01-10")).toBe("prazo_nao_datado");
    expect(situacaoConsulta({ fases: [fase({ sessao: "2026-01-20" })], resultado: null }, "2026-01-10")).toBe("sessao_sem_periodo");
    expect(situacaoConsulta({ fases: [fase({})], resultado: null }, "2026-01-10")).toBe("sem_periodo_na_ata");
  });

  it("resultado levado à pauta depois da fase sem data: contribuições encerradas (CP 45/2019, pauta de 28/07/2026)", () => {
    const c = {
      fases: [fase({ fase: "3ª fase", data_deliberacao: "2024-12-10", duracao_dias: 60 })],
      resultado: {
        data: "2026-07-28", reuniao: "y", ato: null, ato_na_ata: null, ato_suspeito: false, motivo_ato_suspeito: null,
        resultado_julgamento: "Pedido de Vista", decidido: false, decisao: "", vinculo: "numero_citado" as const, forma: "resultado" as const,
      },
    };
    expect(situacaoConsulta(c, "2026-09-30")).toBe("resultado_em_pauta");
  });

  it("fim calculado de início e duração conta como janela (CP 16/2026: 93 dias a partir de 8 de junho de 2026)", () => {
    const c = { fases: [fase({ data_deliberacao: "2026-06-02", inicio: "2026-06-08", fim: "2026-09-08", janela_origem: "inicio_e_duracao", fim_calculado: true, duracao_dias: 93 })], resultado: null };
    expect(situacaoConsulta(c, "2026-09-08")).toBe("aberta");
    expect(situacaoConsulta(c, "2026-09-30")).toBe("encerrada_aguardando");
  });
});

describe.skipIf(!disponivel)("gold regulacao.json", () => {
  it("situação das consultas: TypeScript reproduz o Python na data de referência", () => {
    const ref = gold.consultas.data_referencia;
    for (const c of gold.consultas.itens) expect(situacaoConsulta(c, ref), c.id).toBe(c.situacao);
  });

  it("consulta vencida nunca aparece como aberta, em qualquer data posterior", () => {
    for (const c of gold.consultas.itens) {
      const f = faseAtual(c);
      if (!f?.fim) continue;
      const depois = new Date(Date.parse(`${f.fim}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
      expect(["aberta", "a_abrir"]).not.toContain(situacaoConsulta(c, depois));
    }
  });

  it("CP 23/2026 ('entre os dias 30 de julho e 14 de setembro de 2026') tem janela e está encerrada em 30/09/2026", () => {
    const c = gold.consultas.itens.find((x) => x.id === "CP-23-2026");
    expect(c).toBeDefined();
    if (!c) return;
    expect([c.inicio, c.fim, c.janela_origem, c.fim_calculado]).toEqual(["2026-07-30", "2026-09-14", "datas_explicitas", false]);
    expect(situacaoConsulta(c, "2026-09-30")).toBe("encerrada_aguardando");
  });

  it("limites: piso, teto horário e teto estrutural em campos separados", () => {
    for (const a of gold.limites_pld.atos) {
      expect(a.unidade).toBe("R$/MWh");
      expect(a.vigencia_inicio <= a.vigencia_fim).toBe(true);
      if (a.pld_max_horario !== null && a.pld_max_estrutural !== null) expect(a.pld_max_horario).toBeGreaterThan(a.pld_max_estrutural);
    }
    for (const v of gold.limites_pld.vigencias) {
      expect(v.pld_min).not.toBeNull();
      expect(v.pld_max_horario).not.toBeNull();
      expect(v.pld_max_estrutural).not.toBeNull();
    }
  });

  it("publicação no DOU distinta da vigência, como o extrato informa", () => {
    const por = new Map(gold.limites_pld.atos.map((a) => [a.ato, a]));
    // REH nº 3.167/2022: "publicado no D.O. de 04.01.2023", vigência desde 01/01/2023; retificação no D.O. de 06.01.2023
    expect(por.get("Resolução Homologatória ANEEL nº 3.167/2022")?.data_publicacao).toBe("2023-01-04");
    expect(por.get("Resolução Homologatória ANEEL nº 3.167/2022")?.vigencia_inicio).toBe("2023-01-01");
    expect(por.get("Retificação da Resolução Homologatória ANEEL nº 3.167/2022")?.data_publicacao).toBe("2023-01-06");
    // Despacho nº 3.850/2025: publicado em 23/12/2025 para valer em 2026
    expect(por.get("Despacho ANEEL nº 3.850/2025")?.data_publicacao).toBe("2025-12-23");
    expect(por.get("Despacho ANEEL nº 3.850/2025")?.vigencia_inicio).toBe("2026-01-01");
    // 2021: extrato não acessado; publicação vazia, nunca a data de captura
    expect(por.get("Resolução Homologatória ANEEL nº 2.828/2020")?.data_publicacao).toBeNull();
    const distintas = gold.limites_pld.atos.filter((a) => a.data_publicacao && a.data_publicacao !== a.vigencia_inicio);
    expect(distintas.length).toBe(gold.limites_pld.atos.filter((a) => a.data_publicacao).length);
  });

  it("aplicação literal do art. 23, § 1º, é informativa e não reproduz os atos", () => {
    const lit = gold.limites_pld.conferencias_detalhe.filter((x) => x.conferencia === "art23_literal");
    expect(lit.length).toBeGreaterThan(0);
    for (const x of lit) {
      expect(x.resultado).toBe("ressalva");
      expect(Math.abs(x.diferenca ?? 0)).toBeGreaterThan(0.2);
    }
    expect(gold.limites_pld.conferencias.regra_ipca?.reprovado).toBe(0);
  });

  it("escassez hídrica termina em abril de 2022 com grão mensal, sem dia imputado; patamares vigentes ficam abertos", () => {
    // recurso Acionamento: 2022-04 a R$ 71,00 (metade de R$ 142,00): acionamento em parte do mês, dia não informado
    const esc = gold.bandeiras.vigencias.filter((x) => x.patamar === "Escassez Hídrica");
    expect(esc.map((x) => [x.rs_mwh, x.vigencia_fim, x.vigencia_fim_mes, x.vigencia_fim_grao, x.vigencia_fim_origem])).toEqual([
      [142, null, "2022-04", "mes", "ultimo_acionamento"],
    ]);
    expect(esc[0].ultimo_acionamento).toEqual({ competencia: "2022-04", rs_mwh: 71 });
    const p2 = gold.bandeiras.vigencias.filter((x) => x.patamar === "Vermelha P2").at(-1);
    expect([p2?.ato, p2?.rs_mwh, p2?.vigencia_fim]).toEqual(["REH nº 3.306/2024", 78.77, null]);
  });

  it("PRODIST: Módulo 11 não é afirmado como REN nº 956/2021 vigente (REN nº 1.137/2025 aprovou nova versão)", () => {
    const m11 = gold.procedimentos.itens.find((i) => i.conjunto === "PRODIST" && i.modulo === "Módulo 11");
    expect(m11?.ato_na_pagina).toBe("Resolução Normativa nº 956/2021");
    expect(m11?.conferencia).toBe("pagina_possivelmente_desatualizada");
    expect(m11?.ato_vigente).toBeNull();
    expect(m11?.atos_posteriores.map((e) => e.ato)).toContain("Resolução Normativa nº 1.137/2025");
    const m8 = gold.procedimentos.itens.find((i) => i.conjunto === "PRODIST" && i.modulo === "Módulo 8");
    expect([m8?.conferencia, m8?.ato_vigente]).toEqual(["confirmada_por_ato_integrado", "Resolução Normativa nº 1.137/2025"]);
  });

  it("adicionais contrariados pelo recurso Acionamento: Vermelha P1 de R$ 55 até 2015-08 e Vermelha P2 de R$ 35 até 2017-10", () => {
    // Acionamento: Vermelha P1 a R$ 45,00 de 2015-09 a 2016-01; Vermelha P2 a R$ 50,00 em 2017-11 (sem resolução no Adicional)
    const p1 = gold.bandeiras.vigencias.find((x) => x.patamar === "Vermelha P1" && x.vigencia_inicio === "2015-03-02");
    expect([p1?.rs_mwh, p1?.vigencia_fim, p1?.vigencia_fim_mes, p1?.vigencia_fim_origem]).toEqual([55, null, "2015-08", "acionamento_diverge"]);
    const p2 = gold.bandeiras.vigencias.find((x) => x.patamar === "Vermelha P2" && x.vigencia_inicio === "2017-02-01");
    expect([p2?.vigencia_fim, p2?.vigencia_fim_mes, p2?.conferencia_acionamento?.meses_divergentes]).toEqual([null, "2017-10", [{ competencia: "2017-11", rs_mwh: 50 }]]);
    const ids = gold.linha_do_tempo.eventos.filter((e) => e.vigencia_grao === "mes").map((e) => e.id);
    expect(ids).toContain("bandeiras-acionamento-2015-09-vermelha-p1");
    expect(ids).toContain("bandeiras-acionamento-2017-11-vermelha-p2");
  });

  it("consultas decididas por decisão que consolida o edital ou aprova o objeto (CP 6/2026, CP 3/2026)", () => {
    const cont = gold.consultas.contagem_por_situacao;
    // antes da correção: 108 encerradas aguardando e 411 decididas
    expect(cont.encerrada_aguardando ?? 999).toBeLessThanOrEqual(92);
    expect(cont.decidida ?? 0).toBeGreaterThanOrEqual(427);
    const cp6 = gold.consultas.itens.find((x) => x.id === "CP-6-2026");
    if (cp6) expect([cp6.situacao, cp6.resultado?.ato, cp6.resultado?.forma]).toEqual(["decidida", "Despacho nº 2.266/2026", "consolidacao"]);
    const cp3 = gold.consultas.itens.find((x) => x.id === "CP-3-2026");
    if (cp3) {
      // a ata registra "Portaria nº 1.160/2026"; a página do PRORET diz REN nº 1.160/2026: ato suspeito, não exibido
      expect([cp3.situacao, cp3.resultado?.vinculo, cp3.resultado?.ato, cp3.resultado?.ato_na_ata]).toEqual([
        "decidida", "processo_e_objeto", null, "Portaria nº 1.160/2026",
      ]);
    }
    // CP 1/2026: 2ª fase instaurada em 30/06/2026 pelo prazo de 45 dias, sem datas: entra na janela pela fase atual
    expect(gold.consultas.itens.find((x) => x.id === "CP-1-2026")?.situacao).toBe("prazo_nao_datado");
  });

  it("PRORET: versão da página conferida com a REN nº 1.114/2025 lida (Submódulo 4.3: página 1.3, ato 1.1)", () => {
    const sub = (m: string) => gold.procedimentos.itens.find((i) => i.conjunto === "PRORET" && i.modulo === m);
    expect([sub("Submódulo 4.3")?.versao_na_pagina, sub("Submódulo 4.3")?.versao_no_ato, sub("Submódulo 4.3")?.conferencia_versao]).toEqual(["1.3", "1.1", "diverge"]);
    expect([sub("Submódulo 2.1")?.conferencia, sub("Submódulo 2.1")?.conferencia_versao]).toEqual(["confirmada_por_ato_integrado", "confere"]);
    expect([sub("Submódulo 3.1 A")?.versao_na_pagina, sub("Submódulo 3.1 A")?.ato_na_pagina]).toEqual(["1.2", "Resolução Normativa nº 1.114/2025"]);
    expect(sub("Submódulo 12.1")?.ato_na_pagina).toBe("Despacho nº 3.606/2025");
  });

  it("REN nº 1.000/2021: publicação original no DOU de 20/12/2021, conferida no texto do ato", () => {
    const e = gold.linha_do_tempo.eventos.find((x) => x.id === "ren-1000-2021");
    expect([e?.data_publicacao, e?.conferencia_publicacao?.resultado]).toEqual(["2021-12-20", "aprovado"]);
    for (const x of gold.linha_do_tempo.eventos) expect(x.conferencia_publicacao?.resultado).not.toBe("reprovado");
  });

  it("agenda: só atividades sobre limites entram em limites_em_revisao", () => {
    expect(gold.limites_em_revisao.map((x) => x.codigo).sort()).toEqual(["AR24-05", "AR24-18"]);
  });

  it("linha do tempo nunca traz impacto estimado", () => {
    for (const e of gold.linha_do_tempo.eventos) expect(e.impacto_estimado).toBeNull();
  });
});
