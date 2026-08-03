/* eslint-disable @typescript-eslint/no-explicit-any -- validação de JSON gold sem tipos gerados */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Desenrola Brasil. A base do BCB tem sete colunas, e o risco deste painel não é
 * errar uma conta — é sugerir que sabe mais do que a fonte permite. Por isso a
 * maior parte destes testes é de contenção:
 *
 *  - faixas de pessoa física NUNCA somam com Pequenos Negócios (universos distintos);
 *  - o volume do SCR NUNCA é apresentado como o total do programa;
 *  - baixa de registro negativo NUNCA aparece como pagamento ou renegociação;
 *  - o resultado condicionado à abertura do e-mail NÃO recebe selo causal;
 *  - toda seção sem dado declara a lacuna em vez de estimar.
 */
const G = "public/obs/data/gold/";
const D = JSON.parse(readFileSync(join(process.cwd(), G + "desenrola.json"), "utf-8"));
const app = readFileSync(join(process.cwd(), "public/obs/app.js"), "utf-8");
const coletor = readFileSync(join(process.cwd(), "pipeline/sources/desenrola.py"), "utf-8");

const pagina = (() => {
  const i = app.indexOf("function renderDesenrola(");
  return app.slice(i, app.indexOf("\n/* ---------- ALERTAS", i));
})();

describe("universos separados: PF e Pequenos Negócios não se somam", () => {
  it("os totais publicados cobrem apenas as faixas 1 e 2", () => {
    const f1 = D.componentes.find((c: any) => c.id === "faixa1");
    const f2 = D.componentes.find((c: any) => c.id === "faixa2");
    expect(D.totais_scr.operacoes).toBe(f1.operacoes + f2.operacoes);
    expect(D.totais_scr.volume).toBeCloseTo(f1.volume + f2.volume, 0);
    // o tipo 3 fica fora do total, num objeto próprio
    expect(D.pequenos_negocios.operacoes).toBeGreaterThan(0);
    expect(D.totais_scr.operacoes).not.toBe(
      f1.operacoes + f2.operacoes + D.pequenos_negocios.operacoes);
  });

  it("o aviso sobre o programa de pessoas jurídicas é explícito", () => {
    expect(D.aviso_tipo3).toMatch(/programa distinto/i);
    expect(D.aviso_tipo3).toMatch(/não se soma/i);
    expect(pagina).toContain("D.aviso_tipo3");
  });

  it("o mapa e os credores usam só as faixas de pessoa física", () => {
    expect(D.mapa.reduce((s: number, m: any) => s + m.operacoes, 0)).toBe(D.totais_scr.operacoes);
    expect(D.instituicoes.reduce((s: number, i: any) => s + i.operacoes, 0)).toBe(D.totais_scr.operacoes);
  });
});

describe("o volume do SCR não é apresentado como o total do programa", () => {
  it("a reconciliação com o número oficial está publicada e é coerente", () => {
    expect(D.reconciliacao.scr_volume).toBeCloseTo(D.totais_scr.volume, 0);
    expect(D.reconciliacao.oficial_regularizado).toBeGreaterThan(D.reconciliacao.scr_volume);
    expect(D.reconciliacao.razao).toBeCloseTo(
      D.reconciliacao.oficial_regularizado / D.reconciliacao.scr_volume, 1);
    expect(D.reconciliacao.explicacao).toMatch(/quitado à vista|recursos próprios/i);
    expect(D.reconciliacao.explicacao).toMatch(/não financeiros/i);
  });

  it("o aviso de cobertura lista as exclusões declaradas pela própria fonte", () => {
    for (const termo of [/recursos próprios/i, /R\$ 200/, /não financeiros/i, /SCR/]) {
      expect(D.aviso_cobertura).toMatch(termo);
    }
  });

  it("a página mostra o aviso antes do primeiro número", () => {
    expect(pagina.indexOf("D.aviso_cobertura")).toBeGreaterThan(-1);
    expect(pagina.indexOf("D.aviso_cobertura")).toBeLessThan(pagina.indexOf("const kpis"));
  });

  it("o valor é declarado como pós-desconto em toda parte que importa", () => {
    const vol = D.catalogo.find((c: any) => c.id === "volume");
    expect(vol.nome).toMatch(/após desconto/i);
    expect(vol.limitacoes).toMatch(/DEPOIS do desconto/i);
    expect(vol.limitacoes).toMatch(/não permite calcular desconto/i);
  });
});

describe("desnegativação não é pagamento", () => {
  it("o componente existe, declara-se sem dado e traz o alerta conceitual", () => {
    const d = D.componentes.find((c: any) => c.id === "desnegativacao");
    expect(d).toBeTruthy();
    expect(d.no_scr).toBe(false);
    expect(d.alerta).toMatch(/NÃO é pagamento/i);
    expect(d.alerta).toMatch(/nem perdão|nem renegociação/i);
    expect(d.dados).toMatch(/INDISPONÍVEL/i);
  });

  it("os dois números oficiais de pessoas convivem com a distinção explicada", () => {
    const ben = D.oficiais.find((o: any) => o.id === "beneficiados");
    const ren = D.oficiais.find((o: any) => o.id === "renegociaram");
    expect(ben.valor).toBeGreaterThan(ren.valor);
    expect(ben.nota).toMatch(/baixa de registros negativos|não é renegociação/i);
  });
});

describe("selos: cada categoria de evidência tem o seu, e não se misturam", () => {
  it("o vocabulário de selos está declarado", () => {
    for (const s of ["reportado", "calculado", "estimado", "causal", "associacao"]) {
      expect(D.selos[s], s).toBeTruthy();
    }
  });

  it("todo indicador do catálogo tem selo do vocabulário e dicionário completo", () => {
    for (const c of D.catalogo) {
      expect(Object.keys(D.selos), c.id).toContain(c.selo);
      for (const campo of ["nome", "definicao", "formula", "unidade", "unidade_analise",
                           "periodicidade", "fonte", "cobertura", "limitacoes", "versao"]) {
        expect(c[campo], `${c.id}.${campo}`).toBeTruthy();
      }
    }
  });

  it("a razão entre quem renegociou e os elegíveis é ESTIMADO, nunca calculado", () => {
    const r = D.catalogo.find((c: any) => c.id === "adesao_ilustrativa");
    expect(r.selo).toBe("estimado");
    expect(r.limitacoes).toMatch(/não é uma taxa|ordem de grandeza/i);
  });

  it("todo número oficial citado traz fonte nominal", () => {
    for (const o of D.oficiais) {
      expect(o.selo).toBe("reportado");
      expect(o.fonte, o.id).toBeTruthy();
      expect(o.nota, o.id).toBeTruthy();
    }
  });
});

describe("evidência causal: o objeto e a força da inferência", () => {
  it("a avaliação declara que NÃO mede o efeito do programa", () => {
    expect(D.avaliacao.objeto).toMatch(/NÃO mede o efeito do Desenrola/);
    expect(D.avaliacao.desenho).toMatch(/aleatoriz/i);
    expect(D.avaliacao.desenho).toMatch(/controle puro/i);
  });

  it("só o resultado de intenção de tratar recebe selo causal", () => {
    const causais = D.avaliacao.resultados.filter((r: any) => r.selo === "causal");
    expect(causais.length).toBe(1);
    expect(causais[0].achado).toMatch(/não foi possível encontrar impacto/i);
    expect(causais[0].forca).toMatch(/aleatorização preservada/i);
  });

  it("o resultado condicionado à abertura é associação, com o motivo declarado", () => {
    const cond = D.avaliacao.resultados.find((r: any) => /Entre quem abriu/i.test(r.achado));
    expect(cond.selo).toBe("associacao");
    expect(cond.forca).toMatch(/posterior ao sorteio|seleciona/i);
  });

  it("a ausência de avaliação de impacto do programa está declarada", () => {
    expect(D.avaliacao.limite).toMatch(/não permite afirmar qual foi o efeito/i);
    expect(D.avaliacao.limite).toMatch(/não existe em fonte pública verificável/i);
  });
});

describe("matriz de viabilidade e lacunas", () => {
  it("cobre as áreas pedidas e classifica cada indicador", () => {
    const areas = new Set(D.matriz_viabilidade.map((m: any) => m.area));
    for (const a of ["Alcance", "Condições", "Beneficiários", "Credores", "Depois", "Fiscal", "Efeitos"]) {
      expect(areas, a).toContain(a);
    }
    for (const m of D.matriz_viabilidade) {
      expect(["viavel", "parcial", "indisponivel"], m.indicador).toContain(m.status);
      // indisponível sem motivo é lacuna escondida
      if (m.status === "indisponivel") expect(m.falta, m.indicador).toBeTruthy();
      else expect(m.base, m.indicador).toBeTruthy();
    }
  });

  it("as seções estruturalmente vazias declaram a lacuna em vez de estimar", () => {
    const temas = D.lacunas.map((l: any) => l.tema);
    for (const t of ["Depois da renegociação", "Fiscal", "Condições", "Beneficiários"]) {
      expect(temas, t).toContain(t);
    }
    for (const l of D.lacunas) expect(l.precisaria, l.tema).toBeTruthy();
  });

  it("a página desenha blocos de lacuna e não preenche com número inventado", () => {
    expect(pagina).toContain("desLacuna(");
    expect((pagina.match(/desLacuna\(/g) ?? []).length).toBeGreaterThanOrEqual(5);
    expect(pagina).toMatch(/não há número aqui porque não há dado/i);
  });
});

describe("coerência dos agregados", () => {
  it("volume e operações batem entre série, mapa e credores", () => {
    const serieOp = D.serie.reduce((s: number, m: any) =>
      s + ((m.faixa1?.operacoes || 0) + (m.faixa2?.operacoes || 0)), 0);
    expect(serieOp).toBe(D.totais_scr.operacoes);
    const serieVol = D.serie.reduce((s: number, m: any) =>
      s + ((m.faixa1?.volume || 0) + (m.faixa2?.volume || 0)), 0);
    expect(serieVol).toBeCloseTo(D.totais_scr.volume, 0);
  });

  it("as participações fecham 100% no mapa e entre credores", () => {
    expect(Math.abs(D.mapa.reduce((s: number, m: any) => s + m.part_op, 0) - 100)).toBeLessThan(0.5);
    expect(Math.abs(D.instituicoes.reduce((s: number, i: any) => s + i.part_op, 0) - 100)).toBeLessThan(0.5);
  });

  it("a série não tem meses ausentes e marca o mês acumulado", () => {
    const meses = D.serie.map((m: any) => m.mes);
    expect(meses.length).toBe(D.meses);
    expect(new Set(meses).size).toBe(meses.length);
    const acum = D.serie.filter((m: any) => m.acumulado);
    expect(acum.length).toBe(1);
    expect(acum[0].mes).toBe("2023-09");
    expect(D.aviso_setembro).toMatch(/meses anteriores/i);
  });

  it("o ticket médio é consistente com volume e operações", () => {
    expect(D.totais_scr.ticket_medio)
      .toBe(Math.round(D.totais_scr.volume / D.totais_scr.operacoes));
    for (const m of D.mapa) {
      if (m.operacoes) expect(m.ticket_medio, m.uf).toBe(Math.round(m.volume / m.operacoes));
    }
  });

  it("a concentração é coerente com as participações", () => {
    const top5 = D.instituicoes.slice(0, 5).reduce((s: number, i: any) => s + i.part_op, 0);
    expect(D.concentracao.top5_operacoes).toBeCloseTo(top5, 1);
    expect(D.concentracao.n_conglomerados).toBe(D.instituicoes.length);
    expect(D.concentracao.hhi_operacoes).toBeGreaterThan(0);
    expect(D.concentracao.hhi_operacoes).toBeLessThanOrEqual(10000);
  });
});

describe("coleta: procedência auditável e falha alta se o esquema mudar", () => {
  it("preserva bronze com hash e registra linhagem", () => {
    expect(coletor).toContain("common.save_bronze");
    expect(coletor).toContain("common.record_lineage");
    expect(D.bronze_sha).toMatch(/^[0-9a-f]{64}$/);
    expect(D.coletado_em).toBeTruthy();
  });

  it("falha se a fonte mudar as colunas, em vez de gravar número errado", () => {
    expect(coletor).toContain("colunas ausentes no CSV");
    expect(coletor).toMatch(/esquema da fonte mudou/);
  });

  it("substitui a série inteira porque a fonte republica e retifica", () => {
    expect(coletor).toContain("DELETE FROM desenrola_op");
    expect(coletor).toMatch(/republica a série inteira/);
  });

  it("é barato o bastante para rodar diário: pula quando o hash não muda", () => {
    expect(coletor).toMatch(/SELECT linhas FROM desenrola_coleta WHERE bronze_sha=\?/);
    expect(coletor).toContain("arquivo inalterado");
  });
});

describe("credores: comparação sem ranking simplista", () => {
  it("a página avisa que não é ranking de melhores e piores", () => {
    expect(pagina).toMatch(/não é um ranking de melhores e piores/i);
    expect(pagina).toMatch(/654 credores/);
  });

  it("a identidade do conglomerado é o código, não o nome", () => {
    const cods = D.instituicoes.map((i: any) => i.cod);
    expect(new Set(cods).size).toBe(cods.length);
    for (const i of D.instituicoes) expect(i.nome, i.cod).toBeTruthy();
  });

  it("a comparação é limitada a cinco seleções", () => {
    expect(app).toMatch(/s\.size < 5/);
  });
});
