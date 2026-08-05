/* eslint-disable @typescript-eslint/no-explicit-any -- leitura de gold sem tipos gerados */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Indicadores operacionais (Fase 0): gente, rede e auditoria a partir de
 * fontes estruturadas oficiais. As invariantes protegidas aqui:
 * ausência nunca vira zero; escopos declarados; somas fecham; variações
 * extremas sempre carregam flag; nenhum nível abaixo de A (é tudo dado
 * administrativo oficial — se um dia entrar estimativa, o teste força a
 * decisão consciente).
 */
const g = JSON.parse(
  readFileSync(join(process.cwd(), "public/obs/data/gold/operacional.json"), "utf-8"),
);

describe("estrutura e cobertura", () => {
  it("gold disponível, com cobertura consistente", () => {
    expect(g.disponivel).toBe(true);
    expect(g.instituicoes.length).toBe(g.cobertura.instituicoes);
    expect(g.instituicoes.filter((i: any) => i.empregados).length).toBe(g.cobertura.com_empregados);
    expect(g.instituicoes.filter((i: any) => i.auditor).length).toBe(g.cobertura.com_auditor);
    expect(g.instituicoes.filter((i: any) => i.rede).length).toBe(g.cobertura.com_rede);
  });

  it("fontes com URL https e nível A (dado administrativo oficial)", () => {
    expect(g.fontes.length).toBeGreaterThanOrEqual(3);
    for (const f of g.fontes) {
      expect(f.url).toMatch(/^https:\/\//);
      expect(f.nivel).toBe("A");
    }
  });

  it("aviso de escopo presente (FRE ≠ conglomerado; rede = banco operacional)", () => {
    expect(g.aviso).toContain("FRE");
    expect(g.aviso).toContain("conglomerado");
    expect(g.aviso).toContain("nunca com zero");
  });
});

describe("empregados (CVM/FRE)", () => {
  const comEmpregados = g.instituicoes.filter((i: any) => i.empregados);

  it("soma fecha: total = liderança + não-liderança = soma das regiões", () => {
    for (const inst of comEmpregados) {
      for (const p of inst.empregados.serie) {
        expect(p.total, `${inst.id} ${p.ref}`).toBe(p.lideranca + p.nao_lideranca);
        const somaRegioes = Object.values(p.regioes).reduce(
          (a: number, b) => a + (b as number), 0);
        expect(somaRegioes, `${inst.id} ${p.ref} regiões`).toBe(p.total);
      }
    }
  });

  it("série ordenada por data de referência, sem duplicata", () => {
    for (const inst of comEmpregados) {
      const refs = inst.empregados.serie.map((p: any) => p.ref);
      expect([...refs].sort()).toEqual(refs);
      expect(new Set(refs).size).toBe(refs.length);
    }
  });

  it("escopo declarado em toda série", () => {
    for (const inst of comEmpregados) {
      expect(inst.empregados.escopo, inst.id).toContain("FRE");
      expect(inst.empregados.nivel).toBe("A");
    }
  });

  it("variação acima do limiar sempre carrega flag", () => {
    for (const inst of comEmpregados) {
      for (const p of inst.empregados.serie) {
        if (p.var_aa_pct !== null && Math.abs(p.var_aa_pct) > 30) {
          const temFlag = g.flags.some(
            (f: any) => f.instituicao === inst.nome && f.indicador === "empregados");
          expect(temFlag, `${inst.id}: var ${p.var_aa_pct}% sem flag`).toBe(true);
        }
      }
    }
  });

  it("sanidade: Itaú declara dezenas de milhares de empregados", () => {
    const itau = g.instituicoes.find((i: any) => i.id === "itau");
    const ultimo = itau.empregados.serie.at(-1);
    expect(ultimo.total).toBeGreaterThan(50000);
    expect(ultimo.total).toBeLessThan(200000);
  });
});

describe("rede de agências (BCB/ESTBAN)", () => {
  const comRede = g.instituicoes.filter((i: any) => i.rede);

  it("série mensal ordenada; agências e municípios não negativos", () => {
    for (const inst of comRede) {
      const meses = inst.rede.serie.map((p: any) => p.mes);
      expect([...meses].sort()).toEqual(meses);
      for (const p of inst.rede.serie) {
        expect(p.agencias, `${inst.id} ${p.mes}`).toBeGreaterThanOrEqual(0);
        expect(p.municipios, `${inst.id} ${p.mes}`).toBeGreaterThanOrEqual(0);
        expect(p.municipios).toBeLessThanOrEqual(5570);
      }
    }
  });

  it("atual é o último ponto e var_12m confere com a série", () => {
    for (const inst of comRede) {
      const serie = inst.rede.serie;
      expect(inst.rede.atual).toEqual(serie.at(-1));
      if (inst.rede.var_12m !== null) {
        const [ano, mes] = inst.rede.atual.mes.split("-");
        const ref = serie.find((p: any) => p.mes === `${Number(ano) - 1}-${mes}`);
        expect(ref, inst.id).toBeTruthy();
        expect(inst.rede.var_12m).toBe(inst.rede.atual.agencias - ref.agencias);
      }
    }
  });

  it("queda de rede acima do limiar sempre carrega flag", () => {
    for (const inst of comRede) {
      if (inst.rede.var_12m_pct !== null && inst.rede.var_12m_pct < -15) {
        const temFlag = g.flags.some(
          (f: any) => f.instituicao === inst.nome && f.indicador === "rede");
        expect(temFlag, `${inst.id}: queda ${inst.rede.var_12m_pct}% sem flag`).toBe(true);
      }
    }
  });

  it("Caixa entra só com rede — ausência nas fontes CVM não vira zero", () => {
    const caixa = g.instituicoes.find((i: any) => i.id === "caixa");
    expect(caixa.listada).toBe(false);
    expect(caixa.rede.serie.length).toBeGreaterThan(12);
    expect(caixa.empregados).toBeNull();
    expect(caixa.auditor).toBeNull();
  });

  it("mapa geral por CNPJ-raiz cobre o SFN e confere com o agregado", () => {
    const mapa = g.rede_por_cnpj8;
    const bancos = Object.keys(mapa);
    expect(bancos.length).toBeGreaterThan(80);
    const somaMapa = bancos.reduce((s, c) => s + mapa[c].agencias, 0);
    expect(somaMapa).toBe(g.sfn.rede.serie.at(-1).agencias);
    for (const c of bancos) {
      expect(c).toMatch(/^\d{8}$/);
      expect(mapa[c].agencias).toBeGreaterThan(0);
    }
  });

  it("código IF.data: presente só quando verificado; join do piloto consistente", () => {
    for (const inst of g.instituicoes) {
      if (inst.cod_ifdata) expect(inst.cod_ifdata).toMatch(/^(C\d{7}|\d{8})$/);
    }
    // BRB, Alfa e BMI não constam do universo de páginas do IF.data no corte
    for (const id of ["brb", "alfa", "bmi"]) {
      expect(g.instituicoes.find((i: any) => i.id === id).cod_ifdata, id).toBeNull();
    }
    expect(g.instituicoes.find((i: any) => i.id === "itau").cod_ifdata).toBe("C0010069");
  });

  it("agregado do SFN: série ordenada, com bancos e municípios plausíveis", () => {
    const serie = g.sfn.rede.serie;
    expect(serie.length).toBeGreaterThanOrEqual(12);
    const meses = serie.map((p: any) => p.mes);
    expect([...meses].sort()).toEqual(meses);
    for (const p of serie) {
      expect(p.agencias).toBeGreaterThan(5000);
      expect(p.bancos).toBeGreaterThan(50);
      expect(p.municipios).toBeGreaterThan(2000);
      expect(p.municipios).toBeLessThanOrEqual(5570);
    }
  });
});

describe("auditoria (CVM/FCA)", () => {
  it("histórico ordenado e vigente sem data de fim", () => {
    for (const inst of g.instituicoes.filter((i: any) => i.auditor)) {
      const inicios = inst.auditor.historico.map((h: any) => h.inicio);
      expect([...inicios].sort()).toEqual(inicios);
      if (inst.auditor.vigente) {
        expect(inst.auditor.vigente.nome.length).toBeGreaterThan(3);
      }
    }
  });
});

describe("flags", () => {
  it("toda flag é completa e aponta instituição existente", () => {
    const nomes = new Set(g.instituicoes.map((i: any) => i.nome));
    for (const f of g.flags) {
      expect(nomes.has(f.instituicao), f.instituicao).toBe(true);
      expect(["empregados", "rede", "auditoria"]).toContain(f.indicador);
      expect(f.detalhe.length).toBeGreaterThan(20);
    }
  });
});

describe("síntese citável (página de imprensa)", () => {
  it("todo item tem nível A, fonte, URL https e exibição pronta", () => {
    expect(g.sintese.length).toBeGreaterThanOrEqual(3);
    for (const s of g.sintese) {
      expect(s.nivel, s.id).toBe("A");
      expect(s.url, s.id).toMatch(/^https:\/\//);
      expect(["oficial", "calculado"]).toContain(s.status);
      expect(s.exibir.length, s.id).toBeGreaterThan(0);
      expect(s.conceito.length, s.id).toBeGreaterThan(30);
      expect(s.data_ref, s.id).toBeTruthy();
    }
  });

  it("o total de agências da síntese confere com a série do SFN", () => {
    const item = g.sintese.find((s: any) => s.id === "agencias_sfn");
    expect(item.valor).toBe(g.sfn.rede.serie.at(-1).agencias);
  });
});
