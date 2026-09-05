/* eslint-disable @typescript-eslint/no-explicit-any -- validação de JSON gold sem tipos gerados */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Crédito rural (MDCR/Sicor). O que se trava:
 * - a janela de 12 meses termina no último mês FECHADO e nenhum mês parcial entra nela;
 * - participações fecham (finalidades somam o total; UFs somam ~100%; faixas somam ~100%);
 * - o municipal reconcilia com o estadual dentro do arredondamento;
 * - ausência é nulo, nunca zero; ranking por habitante respeita o piso de população;
 * - a SPA registra a aba em todos os mapas (rota, título, render, dados, chunk, guia, catálogo).
 */
const raiz = process.cwd();
const read = (p: string) => readFileSync(join(raiz, p), "utf-8");
const lerGold = (n: string) => (existsSync(join(raiz, "public/obs/data/gold", n)) ? JSON.parse(read("public/obs/data/gold/" + n)) : null);
const R = lerGold("rural.json") ?? { disponivel: false };
const MUN = (lerGold("rural_mun.json")?.municipios ?? []) as any[];
const app = read("public/obs/app.js");
const html = read("public/obs/index.html");
// Sem gold publicado (primeira carga da MDCR converge em execuções diárias, com cap
// por execução), os testes de dado não têm o que travar e pulam com aviso — a aba
// mostra "indisponível". A trava de registro na SPA roda sempre.
const comDado = !!R.disponivel;

const soma = (xs: any[], k: string) => xs.reduce((s, x) => s + (x[k] || 0), 0);

describe.skipIf(!comDado)("rural.json: janela e meses parciais", () => {
  it("está disponível, com fonte, licença e nível de evidência declarados", () => {
    expect(R.disponivel).toBe(true);
    expect(R.fonte.url).toContain("olinda.bcb.gov.br/olinda/servico/SICOR");
    expect(R.fonte.licenca).toMatch(/ODbL/);
    expect(R.fonte.nivel).toMatch(/^A/);
  });

  it("a janela de 12 meses termina no último mês fechado e exclui os parciais", () => {
    expect(R.janela.fim).toBe(R.mes_fechado);
    expect(R.meses_parciais).not.toContain(R.mes_fechado);
    const meses = R.serie_mensal.map((p: any) => p.mes);
    const i = meses.indexOf(R.janela.fim);
    expect(meses[i - 11]).toBe(R.janela.ini);
    for (const p of R.serie_mensal) {
      if (p.parcial) expect(p.mes > R.janela.fim, p.mes).toBe(true);
    }
    expect(R.cautelas.join(" ")).toMatch(/parciais/);
  });

  it("a série mensal fecha: finalidades somam o valor; agrícola + pecuária = valor", () => {
    for (const p of R.serie_mensal) {
      const fin = p.custeio + p.investimento + p.comercializacao + p.industrializacao;
      expect(Math.abs(fin - p.valor), p.mes).toBeLessThan(1);
      expect(Math.abs(p.agricola + p.pecuaria - p.valor), p.mes).toBeLessThan(1);
    }
  });

  it("KPIs da janela batem com a soma dos 12 meses da série", () => {
    const jan = R.serie_mensal.filter((p: any) => p.mes >= R.janela.ini && p.mes <= R.janela.fim);
    expect(jan.length).toBe(12);
    expect(Math.abs(soma(jan, "valor") - R.kpis.valor_12m)).toBeLessThan(1);
    expect(soma(jan, "qtd")).toBe(R.kpis.contratos_12m);
    expect(R.kpis.ticket_medio).toBeCloseTo(R.kpis.valor_12m / R.kpis.contratos_12m, 0);
  });

  it("safras são julho a junho, e a incompleta é declarada", () => {
    for (const s of R.safras) expect(s.safra).toMatch(/^\d{4}\/\d{2}$/);
    const ultima = R.safras[R.safras.length - 1];
    if (ultima.meses < 12) expect(ultima.incompleta).toBe(true);
    for (const s of R.safras.filter((x: any) => x.meses === 12 && !x.incompleta)) {
      expect(Math.abs(s.custeio + s.investimento + s.comercializacao + s.industrializacao - s.valor), s.safra).toBeLessThan(1);
    }
  });
});

describe.skipIf(!comDado)("rural.json: composições fecham", () => {
  it("UFs somam ~100% do valor e o Brasil tem 27 UFs", () => {
    expect(R.ufs.length).toBe(27);
    expect(soma(R.ufs, "share")).toBeCloseTo(100, 0);
    expect(Math.abs(soma(R.ufs, "valor") - R.kpis.valor_12m)).toBeLessThan(1);
  });

  it("programas somam o total e o PRONAF está identificado", () => {
    expect(Math.abs(soma(R.programas.itens, "valor") - R.kpis.valor_12m)).toBeLessThan(1);
    expect(R.programas.itens.some((p: any) => /PRONAF/i.test(p.nome))).toBe(true);
    expect(R.kpis.pronaf_share).toBeGreaterThan(5);
    expect(R.kpis.pronaf_share).toBeLessThan(60);
  });

  it("faixas de valor: 13 faixas, participações somam 100, concentração declarada", () => {
    expect(R.faixas.itens.length).toBe(13);
    expect(soma(R.faixas.itens, "share_qtd")).toBeCloseTo(100, 0);
    expect(soma(R.faixas.itens, "share_valor")).toBeCloseTo(100, 0);
    expect(R.kpis.acima_1mi_share_valor).toBeGreaterThan(R.kpis.ate_20mil_share_qtd * 0); // ambos existem
    expect(typeof R.kpis.ate_20mil_share_qtd).toBe("number");
  });

  it("famílias de fonte somam o total das fontes; controlada e equalizada são frações", () => {
    const tot = soma(R.fontes.itens, "valor");
    expect(Math.abs(soma(R.fontes.familias, "valor") - tot)).toBeLessThan(1);
    expect(soma(R.fontes.familias, "share")).toBeCloseTo(100, 0);
    for (const f of R.fontes.familias) {
      expect(f.controlada_share).toBeGreaterThanOrEqual(0);
      expect(f.controlada_share).toBeLessThanOrEqual(100);
    }
    expect(R.fontes.familias.map((f: any) => f.familia)).toContain("LCA");
  });

  it("gênero: universo declarado como PF, participações entre 0 e 100", () => {
    expect(R.genero.universo).toMatch(/pessoas físicas/);
    expect(R.genero.mulheres_share_qtd).toBeGreaterThan(0);
    expect(R.genero.mulheres_share_qtd).toBeLessThan(100);
    expect(R.genero.mulheres_share_valor).toBeLessThan(R.genero.mulheres_share_qtd); // cédulas menores
    expect(R.genero.por_uf.length).toBe(27);
  });

  it("instituições: CNPJ contratante, HHI e top-5 declarados, cooperativas identificadas", () => {
    if (!R.instituicoes.disponivel) return;
    expect(R.instituicoes.nota).toMatch(/CNPJ/);
    expect(R.instituicoes.top.length).toBeGreaterThan(10);
    expect(R.instituicoes.hhi).toBeGreaterThan(0);
    expect(R.instituicoes.top5_share).toBeGreaterThan(30);
    expect(R.instituicoes.por_segmento.some((s: any) => /Cooperativa/.test(s.nome))).toBe(true);
    for (const t of R.instituicoes.top) expect(t.pronaf_share == null || t.pronaf_share <= 100, t.nome).toBe(true);
  });
});

describe.skipIf(!comDado)("rural_mun.json: municípios", () => {
  it("cobre os 5.570 municípios; ausência é nulo, nunca zero", () => {
    expect(MUN.length).toBeGreaterThanOrEqual(5570);
    const sem = MUN.filter((m) => m.valor == null);
    expect(sem.length).toBe(R.municipios_meta.sem_contratacao);
    for (const m of sem) {
      expect(m.qtd).toBe(0);
      expect(m.valor_hab).toBeNull();
    }
    expect(MUN.filter((m) => m.valor === 0).length).toBe(0);
  });

  it("municipal fecha com o universo nacional (FonteRecursos = Faixa) e as UFs vêm do municipal", () => {
    expect(R.municipios_meta.reconciliacao_universo_pct).toBeGreaterThan(99.5);
    expect(R.municipios_meta.reconciliacao_universo_pct).toBeLessThanOrEqual(100.5);
    const porUf: Record<string, number> = {};
    for (const m of MUN) if (m.valor && m.uf) porUf[m.uf] = (porUf[m.uf] || 0) + m.valor;
    for (const u of R.ufs) expect(Math.abs((porUf[u.uf] || 0) - u.valor) / u.valor, u.uf).toBeLessThan(0.001);
    // o recurso RegiaoUF fica abaixo do universo e a aba diz isso
    expect(R.universo.cobertura_regiao_uf_pct).toBeLessThan(100);
    expect(R.cautelas.join(" ")).toMatch(/RegiaoUF/);
  });

  it("valor por habitante usa a população do Censo e o ranking respeita o piso de 5 mil habitantes", () => {
    for (const m of MUN.filter((x) => x.valor && x.pop)) {
      expect(m.valor_hab).toBeCloseTo(m.valor / m.pop, 0);
    }
    for (const r of R.rankings.maior_por_habitante) expect(r.pop).toBeGreaterThanOrEqual(5000);
    expect(R.rankings.regra_por_habitante).toMatch(/5 mil/);
  });

  it("o corpo do gold não carrega mais o array de municípios (separado em rural_mun.json)", () => {
    expect(R.municipios).toBeUndefined();
    expect(R.municipios_arquivo).toBe("rural_mun.json");
  });
});

describe("SPA: aba registrada em todos os mapas", () => {
  it("rota, título, render, dados, vintage, coletor, chunk e guia", () => {
    expect(app).toContain('rural: "/rural-credit"');
    expect(app).toContain('rural: "Crédito rural"');
    expect(app).toContain('rural: "renderRural"');
    expect(app).toContain('rural: ["rural", "rural_mun", "penetracao_malha"]');
    expect(app).toContain('rural: "sicor"');
    expect(app).toContain('rural: ["sicor"]');
    expect(app).toContain('rural: "municipal"');
    expect(app).toMatch(/\n  rural: \{ q: "[^"]+\?"/);
    expect(html).toContain('data-view="rural">Crédito rural</button>');
    expect(html).toContain('id="view-rural"');
  });

  it("o renderizador vive na região municipal (compartilha a malha e a escala dos mapas)", () => {
    const k = app.indexOf("function renderRural(");
    expect(k).toBeGreaterThan(-1);
    const regioes: [number, number][] = [];
    const re = /\/\* @chunk:municipal:(ini|fim) \*\//g;
    let m: RegExpExecArray | null;
    let aberto = -1;
    while ((m = re.exec(app))) {
      if (m[1] === "ini") aberto = m.index;
      else { regioes.push([aberto, m.index]); aberto = -1; }
    }
    expect(regioes.some(([a, b]) => k > a && k < b)).toBe(true);
    expect(app).toContain('penEscala(base.map(m => m[F.met]).filter(v => v != null), "pct", "#2f7d4f")');
  });

  it("a aba diz fluxo ≠ saldo e aponta a ponte para o produto rural do IF.data", () => {
    expect(app).toContain("ESTOQUE (saldo no IF.data), aqui é FLUXO");
    expect(app).toContain("meses parciais →");
  });
});
