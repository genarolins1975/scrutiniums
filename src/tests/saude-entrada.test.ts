import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", async () => ({
  ...(await vi.importActual<typeof import("next/navigation")>("next/navigation")),
  useRouter: () => ({ push: () => {}, replace: () => {}, prefetch: () => {}, back: () => {}, forward: () => {}, refresh: () => {} }),
}));

import PaginaSaude from "@/app/eficiencia-estatal/saude-capitais/page";
import LayoutSaude from "@/app/eficiencia-estatal/saude-capitais/layout";
import { GRUPOS_DESTINO, GRUPOS_FONTE, IndiceSaude, agrupar, composicaoAgregada, evolucaoDaDespesa, populacaoDoUniverso, variacaoTotal } from "@/lib/eficiencia/saude/consulta";
import { dadosSaude, goldSaude } from "@/lib/eficiencia/saude/dados";
import { modeloSaude, naoPublicados, numeroSusUniao, perguntasSaude } from "@/components/eficiencia/saude/entradaSaude";

/**
 * Entrada da Saúde nas capitais redesenhada (direção do coordenador de 24/11/2026). Invariantes, não texto: os números novos saem das
 * observações pelas regras de elegibilidade, as fatias do modelo somam 100% e cobrem o total, o conjunto fixo da evolução só tem
 * capitais comparáveis em todos os anos, toda pergunta com número traz a prova, e o escore experimental saiu das páginas do módulo.
 */
const g = goldSaude()!;
const gastos = new IndiceSaude(dadosSaude(g, "gastos"));
const modelo = modeloSaude(g);

describe("contas da entrada (consulta.ts)", () => {
  it("agrupar: as fatias somam 100% e o valor do total, e cada categoria cai num grupo só", () => {
    const fon: [string, string][] = Object.entries(gastos.d.rotulos.fontes);
    const ag = composicaoAgregada(gastos, "sau.despesa.por_fonte", 2025, fon, { exigeTodas: true });
    const f = agrupar(ag.linhas, GRUPOS_FONTE);
    const total = ag.linhas.reduce((s, l) => s + l.valor, 0);
    expect(f.reduce((s, x) => s + x.participacao, 0)).toBeCloseTo(100, 6);
    expect(f.reduce((s, x) => s + x.valor, 0)).toBeCloseTo(total, 0);
    for (const grupos of [GRUPOS_FONTE, GRUPOS_DESTINO]) {
      const membros = grupos.flatMap((x) => x.membros);
      expect(new Set(membros).size).toBe(membros.length);
    }
    expect(GRUPOS_FONTE.flatMap((x) => x.membros).sort()).toEqual(Object.keys(gastos.d.rotulos.fontes).sort());
    expect(GRUPOS_DESTINO.flatMap((x) => x.membros).sort()).toEqual(Object.keys(gastos.d.rotulos.subfuncoes).sort());
    expect(agrupar([], GRUPOS_FONTE)).toEqual([]);
  });

  it("evolução: só capitais com valor observado e elegível em todos os exercícios; Campo Grande (2021) e Macapá (2025) ficam fora com o motivo", () => {
    const e = evolucaoDaDespesa(gastos);
    const anos = gastos.anos("sau.despesa.funcao_saude", "real_2025");
    for (const c of e.capitais) for (const a of anos) expect(gastos.ponto("sau.despesa.funcao_saude", c.cod, a, "real_2025").elegivel).toBe(true);
    expect(e.capitais.length + e.fora.length).toBe(gastos.d.capitais.length);
    const fora = e.fora.map((f) => f.cap.nome);
    expect(fora).toContain("Campo Grande");
    expect(fora).toContain("Macapá");
    expect(e.fora.every((f) => /^\d{4}: \S/.test(f.motivo))).toBe(true);
    // a soma em reais de 2025 do último ano é a mesma em reais correntes (fator 1)
    const ult = e.pontos[e.pontos.length - 1];
    expect(ult.real).toBeCloseTo(ult.nominal, 0);
    expect(variacaoTotal(e.pontos)).not.toBeNull();
    expect(variacaoTotal([])).toBeNull();
  });

  it("população do universo: soma das capitais com valor, sem estimar a que falta", () => {
    const p = populacaoDoUniverso(gastos, 2025);
    expect(p.universo).toBe(26);
    expect(p.capitais).toBeLessThanOrEqual(26);
    expect(p.soma).toBeGreaterThan(40e6);
  });
});

describe("modelo didático e perguntas", () => {
  it("cada elo publicado soma 100%; capital sem composição traz o motivo, não zero", () => {
    for (const m of [modelo.conjunto, ...modelo.capitais]) {
      for (const e of [m.fonte, m.destino]) {
        if (e.ok) expect(e.fatias.reduce((s, f) => s + f.participacao, 0)).toBeCloseTo(100, 6);
        else expect(e.motivo.length).toBeGreaterThan(10);
      }
      for (const o of [m.cobertura, m.icsap, m.planos]) if (o.valor === null) expect(o.nota).toBeTruthy();
    }
    expect(modelo.capitais).toHaveLength(26);
  });

  it("a parcela do SUS da União é a fatia do conjunto, com escopo declarado", () => {
    const s = numeroSusUniao(modelo);
    expect(s.valor).not.toBeNull();
    if (s.valor !== null) {
      expect(s.valor).toBeGreaterThan(0);
      expect(s.valor).toBeLessThan(100);
      expect(s.escopo).toMatch(/^Soma de \d+ de 26 capitais$/);
    }
  });

  it("oito portas, com a comparação e o método; toda pergunta com número traz a prova com fonte", () => {
    const p = perguntasSaude(g, modelo);
    expect(p).toHaveLength(8);
    expect(p.map((x) => x.id)).toEqual(expect.arrayContaining(["comparar", "metodos"]));
    for (const x of p) {
      if (x.numero) expect(x.prova, x.id).toMatch(/ · .+ · \S/);
      expect(`${x.numero ?? ""} ${x.prova ?? ""} ${x.resposta}`).not.toMatch(/undefined|NaN/);
    }
  });

  it("o que o painel ainda não mede vem da gold, com motivo", () => {
    const n = naoPublicados(g);
    expect(n.length).toBeGreaterThan(0);
    for (const x of n) expect(x.motivos[0].length).toBeGreaterThan(20);
  });
});

describe("página e layout", () => {
  it("a entrada traz quatro números, o modelo, as réguas, as perguntas e o que o painel ainda não mede", () => {
    const h = renderToStaticMarkup(createElement(PaginaSaude));
    expect(h.match(/data-numero-indicador/g)).toHaveLength(4);
    expect(h).toContain('id="modelo-saude-elos"');
    expect(h).toContain('id="perguntas-saude"');
    expect(h).toContain('id="ainda-nao-mede"');
    expect(h).not.toMatch(/mortalidade infantil/i);
  });

  it("o escore experimental saiu do layout do módulo (anunciava cálculo que não existe)", () => {
    const h = renderToStaticMarkup(createElement(LayoutSaude, null, createElement("p", null, "conteúdo")));
    expect(h).not.toContain('id="escores-servicos"');
  });
});
