import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ConteudoFrescor } from "@/components/dados/SeloFrescor";
import { LIMITE_ATRASO_DIAS, PROMESSA_ATUALIZACAO, publicadoEmBrasilia, situacaoFrescor } from "@/lib/frescor";

/**
 * Selo de frescor do crédito. De 24/09 a 13/10/2026 a publicação ficou retida
 * pelo portão de testes e as páginas seguiram dizendo "atualizado diariamente":
 * o leitor não tinha como saber. O que se trava aqui:
 * - o atraso é calculado na hora da leitura, no navegador, e não no build;
 * - a partir do mesmo limite da vigília, o aviso é explícito e traz a data;
 * - nenhuma página pública volta a prometer atualização diária.
 */
const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, p), "utf-8");
const GERADO = "2026-09-24T15:25:15+00:00";

describe("situação de frescor", () => {
  it("data da publicação no horário de Brasília", () => {
    expect(publicadoEmBrasilia(GERADO)).toBe("24/09/2026 às 12h25");
    expect(publicadoEmBrasilia("2026-10-13T02:10:00")).toBe("12/10/2026 às 23h10"); // sem fuso = UTC
  });

  it("em dia até o limite; atrasado a partir dele", () => {
    const mesmoDia = situacaoFrescor(GERADO, new Date("2026-09-24T20:00:00Z"))!;
    expect(mesmoDia).toMatchObject({ dias: 0, atrasado: false, idade: "hoje" });
    expect(situacaoFrescor(GERADO, new Date("2026-09-25T16:00:00Z"))).toMatchObject({ dias: 1, atrasado: false, idade: "ontem" });
    expect(situacaoFrescor(GERADO, new Date("2026-09-26T15:24:00Z"))!.atrasado).toBe(false);
    expect(situacaoFrescor(GERADO, new Date("2026-09-26T15:26:00Z"))).toMatchObject({ dias: 2, atrasado: true, idade: "há 2 dias" });
    expect(situacaoFrescor(GERADO, new Date("2026-10-13T12:00:00Z"))).toMatchObject({ dias: 18, atrasado: true });
  });

  it("relógio do leitor adiantado em relação à publicação não gera idade negativa; data inválida não vira selo", () => {
    expect(situacaoFrescor(GERADO, new Date("2026-09-20T00:00:00Z"))!.dias).toBe(0);
    expect(situacaoFrescor("não é data", new Date())).toBeNull();
  });

  it("o limite é o mesmo da vigília de frescor do repositório", () => {
    const m = ler("scripts/vigilancia.py").match(/^LIMITE_DIAS = (\d+)/m);
    expect(Number(m?.[1])).toBe(LIMITE_ATRASO_DIAS);
  });
});

describe("selo renderizado", () => {
  const html = (agora: Date | null) =>
    renderToStaticMarkup(
      createElement(ConteudoFrescor, { geradoEm: GERADO, situacao: agora ? situacaoFrescor(GERADO, agora) : null }),
    );

  it("acima do limite, aviso explícito de atraso com a data da última publicação", () => {
    const h = html(new Date("2026-10-13T12:00:00Z"));
    expect(h).toContain('data-frescor="atrasado"');
    expect(h).toContain('role="status"');
    expect(h).toContain("Atualização atrasada");
    expect(h).toContain("24/09/2026 às 12h25");
    expect(h).toContain("há 18 dias");
  });

  it("em dia, só a data, a idade e a promessa verdadeira", () => {
    const h = html(new Date("2026-09-24T18:00:00Z"));
    expect(h).toContain('data-frescor="em-dia"');
    expect(h).not.toContain("atrasada");
    expect(h).toContain("hoje");
    expect(h).toContain(PROMESSA_ATUALIZACAO.slice(0, 40));
  });

  it("o HTML do build não afirma estar em dia: traz a data e espera o cálculo do navegador", () => {
    const h = html(null);
    expect(h).toContain('data-frescor="calculando"');
    expect(h).toContain("24/09/2026 às 12h25");
    expect(h).not.toMatch(/hoje|ontem|há \d+ dias/);
  });
});

describe("páginas: selo no cliente e promessa verdadeira", () => {
  const PAGINAS = ["src/app/resumo/page.tsx", "src/app/dados/page.tsx", "src/app/dados/[slug]/page.tsx", "src/app/observatorio-do-credito/page.tsx"];

  it("o componente é de cliente e calcula a idade num efeito, com o relógio do leitor", () => {
    const c = ler("src/components/dados/SeloFrescor.tsx");
    expect(c.startsWith('"use client"')).toBe(true);
    expect(c).toMatch(/useEffect\(\(\) => \{[\s\S]*situacaoFrescor\(geradoEm, new Date\(\)\)/);
  });

  it.each(PAGINAS)("%s usa o selo e não promete atualização diária", (p) => {
    const s = ler(p);
    expect(s).toContain("<SeloFrescor");
    expect(s).not.toMatch(/atualizad[oa]s? diariamente|atualizad[oa]s? todos os dias|atualização diária|Atualizado todos os dias/i);
  });
});
