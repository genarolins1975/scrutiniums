import { describe, expect, it, vi } from "vitest";
import { createElement, type FunctionComponent, type ReactNode } from "react";

// A busca da página de entrada usa o roteador do Next, que não existe na renderização estática do teste.
vi.mock("next/navigation", async () => ({
  ...(await vi.importActual<typeof import("next/navigation")>("next/navigation")),
  useRouter: () => ({ push: () => {}, replace: () => {}, prefetch: () => {}, back: () => {}, forward: () => {}, refresh: () => {} }),
  usePathname: () => "/saneamento",
  useSearchParams: () => new URLSearchParams(),
}));
import { renderToStaticMarkup } from "react-dom/server";
import { jmpPaises, meta, ods } from "@/lib/saneamento/gold";
import { REFERENCIAS, posicao, tetoRegua } from "@/lib/saneamento/mundo";
import { mesPorExtenso } from "@/lib/saneamento/formato";
import { FiguraJmp, FiguraOds, TabelaOds, TabelaUrbanoRural } from "@/components/saneamento/ReferenciaMundial";
import Entrada from "@/app/saneamento/page";
import Acesso from "@/app/saneamento/acesso/page";
import Desigualdades from "@/app/saneamento/desigualdades/page";
import Continuidade from "@/app/saneamento/continuidade/page";
import Esgoto from "@/app/saneamento/esgoto/page";
import Financiamento from "@/app/saneamento/financiamento/page";
import Planejamento from "@/app/saneamento/planejamento/page";
import Saude from "@/app/saneamento/saude-ambiente/page";
import Resiliencia from "@/app/saneamento/resiliencia/page";
import Internacional from "@/app/saneamento/internacional/page";
import Metodologia from "@/app/saneamento/metodologia/page";

/**
 * Referências mundiais por capítulo (base global dos ODS da ONU, edição 2026.Q3.G.01, consultada em 17/10/2026, e
 * componentes do JMP já integrados). Os valores fixos abaixo foram lidos na API da ONU na consulta.
 */
const g = ods()!;
const texto = (h: string) => h.replace(/<!-- -->/g, "").replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ");
function html<P extends object>(c: (p: P) => ReactNode, p?: P): string {
  return texto(renderToStaticMarkup(createElement(c as unknown as FunctionComponent<P>, p ?? ({} as P))));
}

describe("Referências mundiais: gold", () => {
  it("toda referência tem série na gold, e Brasil, mundo e região estão no ano comparado", () => {
    for (const codigo of Object.keys(REFERENCIAS)) {
      const s = g.series[codigo];
      expect(s, codigo).toBeDefined();
      expect(s.brasil?.ano, codigo).toBe(s.ano_comparado);
      for (const p of [s.mundo, s.alc]) if (p) expect(p.ano, codigo).toBe(s.ano_comparado);
      const br = s.paises.filter((p) => p.m49 === 76);
      expect(br, codigo).toHaveLength(1);
      expect(br[0].valor, codigo).toBe(s.brasil?.valor);
    }
  });

  it("valores da consulta: esgoto tratado em 2022, mortalidade em 2019, estresse hídrico em 2023", () => {
    const e = g.series.EN_WWT_WWDS;
    expect([e.ano_comparado, +e.brasil!.valor!.toFixed(1), +e.mundo!.valor!.toFixed(1), +e.alc!.valor!.toFixed(1)]).toEqual([2022, 43.4, 57.8, 45.9]);
    const w = g.series.SH_STA_WASHARI;
    expect([w.ano_comparado, +w.brasil!.valor!.toFixed(1), +w.mundo!.valor!.toFixed(1)]).toEqual([2019, 6.6, 18.2]);
    const st = g.series.ER_H2O_STRESS;
    expect([st.ano_comparado, +st.brasil!.valor!.toFixed(1), +st.mundo!.valor!.toFixed(1)]).toEqual([2023, 1.4, 17.6]);
    expect(meta()?.ods?.edicoes).toEqual(["2026.Q3.G.01"]);
  });

  it("posição neutra: maior, igual e menor somam os países com valor, recontados por outro caminho", () => {
    for (const [codigo, ref] of Object.entries(REFERENCIAS)) {
      const s = g.series[codigo];
      const p = posicao(s, ref.casas)!;
      expect(p.maior + p.igual + p.menor, codigo).toBe(s.paises.length);
      const f = 10 ** ref.casas;
      const b = Math.round(s.brasil!.valor! * f);
      expect(p.maior, codigo).toBe(s.paises.filter((x) => Math.round(x.valor * f) > b).length);
      expect(p.igual, codigo).toBeGreaterThanOrEqual(1);
    }
  });

  it("teto da régua: fixo nas porcentagens e acima do maior valor nas demais", () => {
    expect(tetoRegua(g.series.ER_H2O_STRESS, REFERENCIAS.ER_H2O_STRESS)).toBe(100);
    const w = g.series.SH_STA_WASHARI;
    expect(tetoRegua(w, REFERENCIAS.SH_STA_WASHARI)).toBeGreaterThanOrEqual(Math.max(...w.paises.map((p) => p.valor)));
  });
});

describe("Referências mundiais: figuras", () => {
  it("figura do esgoto tratado: mesmo ano para os três, nota de comparabilidade e fonte com a edição", () => {
    const h = html(FiguraOds, { codigo: "EN_WWT_WWDS" });
    for (const t of ["Esgoto doméstico tratado com segurança, 2022", "43,4%", "57,8%", "45,9%", "2022, estimativa", "Não é a mesma medida do capítulo", "IES2003", "edição 2026.Q3.G.01"]) {
      expect(h, t).toContain(t);
    }
    expect(renderToStaticMarkup(createElement(FiguraOds, { codigo: "EN_WWT_WWDS" }))).toContain('href="/saneamento/gold/ods_paises.csv"');
    expect(h).toContain("A contagem só ordena valores; não classifica países.");
  });

  it("valores acima do teto são contados, não somem", () => {
    const s = g.series.ER_H2O_STRESS;
    const acima = s.paises.filter((p) => p.valor > 100).length;
    expect(acima).toBeGreaterThan(0);
    expect(html(FiguraOds, { codigo: "ER_H2O_STRESS" })).toContain(`${acima} têm valor acima de 100% e ficam na borda direita`);
  });

  it("agregado que a base não traz aparece como não publicado, nunca como zero", () => {
    const h = html(FiguraOds, { codigo: "DC_TOF_WASHL", semRegua: true });
    expect(h).toContain("não publicado");
    expect(h).toContain("milhões de dólares constantes de 2024");
    expect(h).not.toContain("Cada traço fino");
  });

  it("urbano e rural: ausência escrita e diferença só com os dois valores", () => {
    const h = html(TabelaUrbanoRural, { codigos: ["SH_H2O_SAFE", "SH_SAN_SAFE"] });
    expect(h).toContain("sem estimativa");
    expect(h).toContain("sem cálculo");
    const u = g.series.SH_H2O_SAFE.recortes!.URBAN.brasil!.valor!;
    const r = g.series.SH_H2O_SAFE.recortes!.RURAL.brasil!.valor!;
    expect(h).toContain((u - r).toFixed(1).replace(".", ","));
  });

  it("componentes do JMP: medianas recalculadas dos países e edição por extenso", () => {
    const { paises } = jmpPaises();
    const v = paises.map((p) => p.agua?.t.disponivel).filter((x): x is number => x != null).sort((a, b) => a - b);
    const med = v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2;
    const h = html(FiguraJmp, { campo: "disponivel" });
    expect(h).toContain(`${med.toFixed(1).replace(".", ",")}%`);
    expect(h).toContain(`${v.length} países e territórios`);
    expect(h).toContain(`edição de ${mesPorExtenso(meta()!.jmp!.edicao_mes)}`);
    expect(h).not.toContain("undefined");
  });

  it("a tabela da página internacional lista todas as séries com o capítulo de cada uma", () => {
    const h = html(TabelaOds);
    for (const codigo of Object.keys(REFERENCIAS)) expect(h, codigo).toContain(codigo);
    expect(h).toContain("13 · Saúde e ambiente");
  });
});

describe("Referências mundiais: páginas", () => {
  const casos: [string, () => ReactNode, string[]][] = [
    ["entrada", Entrada, ["O Brasil no mundo", "ODS 6.1.1 · 2024", "ODS 6.3.1 · 2022"]],
    ["acesso", Acesso, ["Como o Brasil se compara no mundo?", "Água gerenciada com segurança, 2024", "Esgotamento gerenciado com segurança, 2024"]],
    ["desigualdades", Desigualdades, ["A distância entre cidade e campo também existe no mundo?", "Serviço gerenciado com segurança nas áreas urbanas e rurais"]],
    ["continuidade", Continuidade, ["Água disponível quando necessária, 2024", "Água livre de contaminação fecal e química prioritária, 2024"]],
    ["esgoto", Esgoto, ["Quanto do esgoto é tratado em outros países?", "População ligada à rede de esgoto com tratamento, 2024"]],
    ["financiamento", Financiamento, ["Quanto vem de ajuda internacional?", "ODS 6.a.1"]],
    ["planejamento", Planejamento, ["Como o mundo mede o planejamento da água?", "ODS 6.5.1"]],
    ["saude", Saude, ["Mortalidade atribuída a água, esgoto e higiene inseguros, 2019", "Corpos d'água com boa qualidade ambiental, 2023"]],
    ["resiliencia", Resiliencia, ["O Brasil tem estresse hídrico?", "ODS 6.4.2"]],
    ["internacional", Internacional, ["Além do acesso: o que mais os ODS medem sobre água e saneamento?"]],
    ["metodologia", Metodologia, ["ods_paises.csv", "Séries da base global dos ODS"]],
  ];
  for (const [nome, Pagina, esperados] of casos) {
    it(`${nome}: seção de referência mundial com fonte`, () => {
      const h = html(Pagina);
      for (const t of esperados) expect(h, t).toContain(t);
    });
  }
});
