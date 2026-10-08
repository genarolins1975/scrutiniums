import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { PldCabecalho } from "@/components/energia/PldPagina";

/**
 * Mudanças estruturais depois da r8, sobre o que os nove revisores da r8 mais repetiram: a resposta curta ficou curta e continuou abaixo
 * da dobra (topo mediano a 1.071 px em 390 px), e as abas de seção em uma linha que rola foram lidas como cortadas (sete de nove).
 * Aqui: abertura, fontes e datas do módulo recolhidas em Entender, e abas que quebram linha no celular.
 */
const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf-8");
const css = ler("src/app/globals.css");

describe("abertura do módulo recolhida em Entender", () => {
  const h = renderToStaticMarkup(
    createElement(CabecalhoModulo, { rotulo: "Carga", titulo: "Quanto o sistema está consumindo?", referencia: "ONS, até 28/09/2026", siglas: ["ONS"] }, "A carga é a energia atendida no sistema interligado."),
  );

  it("rótulo e pergunta ficam à vista; abertura e fontes vão para um bloco recolhido, que continua no HTML", () => {
    expect(h).toContain("<h1");
    const bloco = h.match(/<details[^>]*data-sobre-pagina="true"[^>]*>([\s\S]*?)<\/details>/);
    expect(bloco, "bloco recolhido").not.toBeNull();
    expect(bloco![0]).not.toContain(" open");
    expect(bloco![1]).toContain("Sobre esta página: abertura, fontes e datas");
    expect(bloco![1]).toContain('class="cab-lead max-w-prose2 leading-relaxed text-carvao-muted md:text-lg"');
    expect(bloco![1]).toContain("A carga é a energia atendida no sistema interligado.");
    expect(bloco![1]).toContain("Fontes e datas de referência: ");
    expect(bloco![1]).toContain("ONS, até 28/09/2026");
  });

  it("a legenda de siglas fica fora do bloco recolhido, porque conta o texto à vista", () => {
    const fora = h.replace(/<details[^>]*data-sobre-pagina="true"[^>]*>[\s\S]*?<\/details>/, "");
    expect(fora).toContain('data-siglas="true"');
    expect(fora).not.toContain("A carga é a energia atendida");
  });

  it("com recolher falso (página sem seletor de profundidade) o texto fica à vista, como antes", () => {
    const t = renderToStaticMarkup(createElement(CabecalhoModulo, { rotulo: "Aprenda", titulo: "O que significam os conceitos?", recolher: false, referencia: "Fonte" }, "Abertura."));
    expect(t).not.toContain("data-sobre-pagina");
    expect(t).toContain("Abertura.");
  });

  it("sem abertura e sem fontes não há bloco recolhido", () => {
    const t = renderToStaticMarkup(createElement(CabecalhoModulo, { rotulo: "X", titulo: "Pergunta?" }));
    expect(t).not.toContain("<details");
  });

  it("o cabeçalho do PLD, que tem marcação própria, recolhe do mesmo modo", () => {
    const t = renderToStaticMarkup(createElement(PldCabecalho, { titulo: "Limites?", referencia: "CCEE até 30/09/2026" }, "Abertura do PLD."));
    expect(t).toMatch(/<details[^>]*data-sobre-pagina="true"/);
    expect(t).toContain("Abertura do PLD.");
    expect(t).toContain("CCEE até 30/09/2026");
  });

  it("as páginas sem seletor de profundidade pedem recolher falso", () => {
    for (const f of ["src/components/energia/ModuloEmIntegracao.tsx", "src/app/setor-eletrico/aprenda/page.tsx", "src/app/setor-eletrico/aprenda/trilhas/page.tsx"]) {
      expect(ler(f), f).toContain("<CabecalhoModulo recolher={false}");
    }
  });

  it("o bloco abre sozinho em Analisar e Auditar e a legenda refaz a lista quando um bloco abre ou fecha", () => {
    const c = ler("src/components/energia/SobreEstaPagina.tsx");
    expect(c).toContain('el.open = modo === "analisar" || modo === "auditar";');
    expect(c).toContain('attributeFilter: ["data-modo"]');
    expect(ler("src/components/energia/LegendaSiglas.tsx")).toContain('document.addEventListener("toggle", agenda, true);');
  });
});

describe("abas de seção quebram linha no celular", () => {
  it("até 640 px cada aba ocupa metade da linha e nenhuma faixa de seção rola na horizontal", () => {
    expect(css).toMatch(/@media \(max-width: 40rem\) \{\s*\.nav-faixa > li,\s*\.nav-faixa-barra > li \{ flex: 1 1 calc\(50% - 0\.25rem\); min-width: 0; \}/);
    expect(css).not.toMatch(/\.nav-faixa-barra \{\s*flex-wrap: nowrap;\s*overflow-x: auto;/);
    expect(css).not.toMatch(/\.nav-faixa \{ margin: -3px 0; padding: 3px 0; \}/);
  });

  it("a faixa de módulos do cabeçalho do site também quebra linha abaixo de 768 px, sem máscara de esmaecimento", () => {
    expect(css).toMatch(/@media \(max-width: 47\.99rem\) \{\s*#modulos-energia \{ flex-wrap: wrap; overflow: visible; -webkit-mask-image: none; mask-image: none; \}/);
  });
});
