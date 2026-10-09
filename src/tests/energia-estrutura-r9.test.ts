import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CabecalhoModulo } from "@/components/energia/CabecalhoModulo";

/**
 * Mudanças estruturais depois da r8, sobre o que os nove revisores da r8 mais repetiram: a resposta curta ficou curta e continuou abaixo
 * da dobra (topo mediano a 1.071 px em 390 px), e as abas de seção em uma linha que rola foram lidas como cortadas (sete de nove).
 * Aqui: abertura do módulo recolhida em Entender (fontes e datas ficam à vista), e abas que quebram linha no celular.
 */
const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf-8");
const css = ler("src/app/globals.css");

describe("abertura do módulo recolhida em Entender", () => {
  const h = renderToStaticMarkup(
    createElement(CabecalhoModulo, { rotulo: "Carga", titulo: "Quanto o sistema está consumindo?", referencia: "ONS, até 28/09/2026", siglas: ["ONS"] }, "A carga é a energia atendida no sistema interligado."),
  );

  it("rótulo, pergunta e fontes com datas ficam à vista; só a abertura vai para um bloco recolhido, que continua no HTML", () => {
    expect(h).toContain("<h1");
    const bloco = h.match(/<details[^>]*data-sobre-pagina="true"[^>]*>([\s\S]*?)<\/details>/);
    expect(bloco, "bloco recolhido").not.toBeNull();
    expect(bloco![0]).not.toContain(" open");
    expect(bloco![1]).toContain("Ler a abertura da página");
    expect(bloco![1]).toContain('class="cab-lead ed-lead max-w-prose2 text-carvao-muted"');
    expect(bloco![1]).toContain("A carga é a energia atendida no sistema interligado.");
    // as fontes e as datas de referência não ficam atrás do toque (a J3 da r9 não achou até quando vão os dados)
    expect(bloco![1]).not.toContain("Fontes e datas de referência");
    const fora = h.replace(bloco![0], "");
    expect(fora).toContain("Fontes e datas de referência: ");
    expect(fora).toContain("ONS, até 28/09/2026");
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

  it("sem abertura não há bloco recolhido", () => {
    const t = renderToStaticMarkup(createElement(CabecalhoModulo, { rotulo: "X", titulo: "Pergunta?" }));
    expect(t).not.toContain("<details");
  });

  it("abertura editorial (com lead): título, duas frases, recorte e fonte curta à vista; fontes por extenso, datas e siglas num bloco único que continua no HTML", () => {
    const e = renderToStaticMarkup(
      createElement(
        CabecalhoModulo,
        { titulo: "Quanta energia está armazenada?", lead: "O armazenamento de cada região frente à mediana da mesma data.", recorte: "29/09/2026 · SIN", fonte: "ONS, EAR", referencia: "ONS, até 29/09/2026; processado em 01/10/2026", siglas: ["ONS", "SIN"] },
        "Texto longo de apresentação da página.",
      ),
    );
    expect(e).toContain('data-abertura="editorial"');
    expect(e).toContain("<h1");
    expect(e).not.toContain('class="rotulo text-mineral"'); // sem rótulo: a navegação já diz onde o leitor está
    const bloco = e.match(/<details[^>]*data-sobre-pagina="true"[^>]*>([\s\S]*?)<\/details>/);
    expect(bloco, "bloco recolhido").not.toBeNull();
    expect(bloco![0]).not.toContain(" open");
    expect(bloco![1]).toContain("Fontes, datas e siglas");
    expect(bloco![1]).toContain("Fontes e datas de referência");
    expect(bloco![1]).toContain("Texto longo de apresentação da página.");
    expect(bloco![1]).toContain('data-siglas="true"');
    const fora = e.replace(bloco![0], "");
    for (const t of ["O armazenamento de cada região frente à mediana da mesma data.", "29/09/2026 · SIN", "Fonte: ONS, EAR"]) expect(fora).toContain(t);
    expect(fora).not.toContain("Texto longo de apresentação");
  });

  it("com lead e rótulo, o rótulo continua acima do título (página filha usa como migalha)", () => {
    const e = renderToStaticMarkup(createElement(CabecalhoModulo, { rotulo: "Água e clima", titulo: "A água que chega está acima do normal?", lead: "Frase." }));
    expect(e).toContain("Água e clima");
  });

  // O cabeçalho próprio do PLD (PldCabecalho) deixou de existir: as cinco páginas do PLD usam o CabecalhoModulo, coberto pelos testes acima.

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

  it("no celular o espaço entre colunas da faixa cabe duas metades de linha (senão cada aba cai numa linha própria)", () => {
    // duas metades de calc(50% - 0.25rem) somam 100% - 0.5rem: o gap-x-6 de 24 px da NavegacaoLocal as empurrava para uma coluna só
    const bloco = css.match(/@media \(max-width: 40rem\) \{(\s*\.nav-faixa > li[\s\S]*?)\n\}/)?.[1] ?? "";
    expect(bloco).toMatch(/ol\.nav-faixa \{ column-gap: 0\.25rem; \}/);
  });

  it("a faixa de módulos do cabeçalho do site também quebra linha abaixo de 768 px, sem máscara de esmaecimento", () => {
    expect(css).toMatch(/@media \(max-width: 47\.99rem\) \{\s*#modulos-energia \{ flex-wrap: wrap; overflow: visible; -webkit-mask-image: none; mask-image: none; \}/);
  });
});

describe("lista que quebra linha não ganha respiro de rolagem", () => {
  // Erro da r9: acompanhaFaixa tratava a lista que passou a quebrar linha como faixa que rola. Com a aba atual na coluna da direita
  // (a borda direita do item coincide com a da lista, e a regra pede 8 px de folga), a função gravava padding-right inline de até 175 px,
  // e os itens ficavam com 80 px em vez de metade da linha: "Armazenamento" cortado e "Limites e regras de preço" em 5 linhas.
  it("só alinha quando a lista tem rolagem horizontal, antes de medir o item atual", () => {
    const av = ler("src/components/energia/AtivoVisivel.tsx");
    const alinha = av.slice(av.indexOf("const alinha = () => {"), av.indexOf("const bordas = () => {"));
    expect(alinha).toContain("if (lista.scrollWidth <= lista.clientWidth + 1) return;");
    expect(alinha.indexOf("if (lista.scrollWidth <= lista.clientWidth + 1) return;")).toBeLessThan(alinha.indexOf("getBoundingClientRect"));
    expect(alinha.indexOf("if (lista.scrollWidth <= lista.clientWidth + 1) return;")).toBeLessThan(alinha.indexOf("lista.style.paddingRight"));
  });
});
