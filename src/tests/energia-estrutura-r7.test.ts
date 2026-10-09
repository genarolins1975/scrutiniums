import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LegendaDeSiglas } from "@/components/energia/LegendaSiglas";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { SIGLAS } from "@/lib/energia/siglas";

/**
 * Mudanças estruturais da r7 sobre o que os nove revisores da r6 repetiram: legenda de siglas derivada do texto à vista,
 * abas de seção em uma linha no celular, resposta curta antes dos filtros e tabela larga recolhida em Entender.
 */
const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, p), "utf-8");
const css = ler("src/app/globals.css");

// Contrato alterado de propósito na r9: as abas de seção deixaram de rolar no celular (ver energia-estrutura-r9.test.ts).
describe("abas de seção: marcação comum às duas versões", () => {
  const NAVEGACOES = ["Agua", "Carga", "Empresas", "Expansao", "Geracao", "Inclusao", "Pld", "Previsoes", "Rede", "Regulacao", "Transicao"].map((m) => `src/components/energia/${m}Pagina.tsx`);
  const BARRAS = ["MercadoPainel", "PerdasPainel", "DadosPainel"].map((m) => `src/components/energia/${m}.tsx`);

  it("as onze navegações de seção com quebra de linha usam a faixa de seções (própria ou a NavegacaoLocal compartilhada)", () => {
    for (const f of NAVEGACOES) {
      const t = ler(f);
      expect(t.includes('<ol className="nav-faixa flex flex-wrap gap-2 text-sm">') || t.includes("<NavegacaoLocal"), f).toBe(true);
    }
    // a faixa compartilhada quebra linha e leva o marcador que o AtivoVisivel e o CSS do celular procuram
    expect(ler("src/components/energia/NavegacaoLocal.tsx")).toContain('<ol className="nav-faixa flex flex-wrap');
  });

  it("as três barras de Mercado, Perdas e Dados usam a variante de barra (própria ou a faixa compartilhada NavegacaoLocal)", () => {
    for (const f of BARRAS) {
      const t = ler(f);
      expect(t.includes('<ul className="nav-faixa-barra flex flex-wrap') || t.includes("<NavegacaoLocal"), f).toBe(true);
    }
  });

  it("a aba atual é trazida à vista só quando está cortada, pelo mesmo componente que cuida da faixa de módulos", () => {
    const av = ler("src/components/energia/AtivoVisivel.tsx");
    expect(av).toContain("export function FaixasDeSecao()");
    expect(av).toContain('document.querySelectorAll<HTMLElement>(".nav-faixa")');
    expect(av).toContain("if (a.left >= l.left && a.right <= l.right - 8) return;");
    expect(ler("src/components/evidencia/ModoProfundidade.tsx")).toContain("<FaixasDeSecao />");
  });
});

describe("resposta curta antes dos filtros", () => {
  it("o contêiner de espaçamento vertical com a resposta como filho direto a põe em primeiro lugar, sem mexer na ordem do DOM", () => {
    expect(css).toContain('[class*="space-y-"]:has(> [data-resposta]) { display: flex; flex-direction: column; }');
    expect(css).toMatch(/\[class\*="space-y-"\] > \[data-resposta\]:not\(\[data-resposta-depois\]\) \{ order: -1; margin-top: 0 !important; margin-bottom: 1\.5rem !important; \}/);
  });

  it("o cabeçalho de módulo é mais baixo no celular e mais folgado a partir de 768 px (abertura editorial)", () => {
    const cab = ler("src/components/energia/CabecalhoModulo.tsx");
    expect(cab).toContain('<header className="cab-modulo">');
    expect(cab).toContain('<header className="cab-modulo" data-abertura="editorial">');
    // o PLD usa o CabecalhoModulo (o cabeçalho próprio do PldPagina deixou de existir)
    expect(ler("src/components/energia/PldPagina.tsx")).not.toContain('<header className="cab-modulo">');
    expect(css).toMatch(/\.cab-modulo \{ padding-top: 1\.25rem; padding-bottom: 0\.5rem; \}/);
    expect(css).toMatch(/@media \(min-width: 768px\) \{ \.cab-modulo \{ padding-top: 2rem; padding-bottom: 0\.75rem; \} \}/);
  });
});

describe("legenda de siglas", () => {
  const html = (siglas?: string[]) => renderToStaticMarkup(createElement(LegendaDeSiglas, { siglas }));

  it("o HTML do servidor traz a lista que a página declara, para quem lê sem JavaScript", () => {
    const h = html(["PLD", "DEC", "FEC"]);
    expect(h).toContain('data-siglas="true"');
    expect(h).toContain("PLD, Preço de Liquidação das Diferenças");
    expect(h).toContain("DEC e FEC, Duração e Frequência Equivalentes");
    expect(h).not.toContain("<details");
  });

  it("sem lista declarada e sem JavaScript não há legenda: ela nasce do texto à vista", () => {
    expect(html()).toBe("");
    expect(html(["XYZ"])).toBe("");
  });

  it("mais de seis entradas deixam as demais atrás de 'Mais N siglas', e o bloco aberto não fica dentro de parágrafo", () => {
    const h = html(["ANEEL", "ONS", "CCEE", "EPE", "CVM", "IBGE", "CADE", "SIN"]);
    expect(h).toContain("Mais 2 siglas");
    expect(h).toContain("<details");
    expect(h).not.toMatch(/<p[^>]*>(?:(?!<\/p>)[\s\S])*<details/);
  });

  it("a legenda viva lê só o texto à vista: ignora elemento escondido, bloco fechado e a própria legenda", () => {
    const t = ler("src/components/energia/LegendaSiglas.tsx");
    expect(t).toContain('css.display === "none" || css.visibility === "hidden"');
    expect(t).toContain('tag === "DETAILS" && !el.hasAttribute("open")');
    expect(t).toContain('el.hasAttribute("data-siglas")');
    expect(t).toContain('attributeFilter: ["data-modo"]');
  });

  it("toda página de módulo monta a legenda, mesmo sem lista declarada", () => {
    expect(ler("src/components/energia/CabecalhoModulo.tsx")).toContain("<LegendaDeSiglas siglas={siglas} />");
    // a legenda do PLD vem do CabecalhoModulo, como nas demais páginas
    expect(ler("src/components/energia/PldPagina.tsx")).not.toContain("<LegendaDeSiglas");
  });
});

describe("siglas acrescentadas na r7 vêm do que o observatório já publica", () => {
  const NOVAS = ["POF", "SIDRA", "IPCA", "PMO", "SCEE", "PRORET", "BDGD", "CCC", "MPV", "MDL", "DVA", "UF", "SIGET", "SCS", "DMR"];

  const arquivos = (dir: string, ext: RegExp): string[] =>
    readdirSync(join(raiz, dir)).flatMap((n) => {
      const rel = `${dir}/${n}`;
      const st = statSync(join(raiz, rel));
      if (st.isDirectory()) return n === "node_modules" || n === ".next" ? [] : arquivos(rel, ext);
      return ext.test(n) && st.size < 4_000_000 ? [rel] : [];
    });
  const corpus = [
    ...arquivos("public/energia/gold", /\.json$/),
    ...arquivos("src/lib/energia", /\.tsx?$/),
    ...arquivos("src/components/energia", /\.tsx?$/),
    ...arquivos("src/app/setor-eletrico", /\.tsx?$/),
    ...arquivos("pipeline/energia", /\.py$/),
  ]
    .filter((f) => f !== "src/lib/energia/siglas.ts")
    .map(ler)
    .join("\n")
    .toLowerCase();

  for (const s of NOVAS) {
    it(`${s}: o nome por extenso consta em outro arquivo publicado do observatório`, () => {
      expect(s in SIGLAS, s).toBe(true);
      const nome = SIGLAS[s].split(",")[0].toLowerCase();
      expect(corpus.includes(nome), `${s}: "${nome}"`).toBe(true);
    });
  }
});

describe("células de tabela com classe curta", () => {
  const h = renderToStaticMarkup(
    createElement(TabelaInterativa, {
      titulo: "Teste",
      colunas: [
        { id: "nome", rotulo: "Nome", tipo: "texto" },
        { id: "nota", rotulo: "Nota", tipo: "texto" },
        { id: "valor", rotulo: "Valor", tipo: "numero", casas: 1 },
        { id: "dia", rotulo: "Dia", tipo: "data" },
      ],
      linhas: [{ id: "a", nome: "A", nota: "ok", valor: 1.5, dia: "2026-09-30" }],
      chaveLinha: "id",
      fonte: "teste",
      versao: "2026-09-30",
      nomeArquivo: "teste",
    }),
  );

  it("cada tipo de coluna recebe a classe curta que o CSS define, e as seis utilitárias repetidas saem do HTML", () => {
    expect(h).toContain('<td class="tc tc-t">');
    expect(h).toContain('<td class="tc tc-n">');
    expect(h).toContain('<td class="tc tc-d">');
    expect(h).not.toContain("px-2 py-2 text-carvao");
    expect(css).toMatch(/\.tc \{ padding: 0\.5rem; color: var\(--cor-carvao\); \}/);
    expect(css).toMatch(/\.tc-n \{ white-space: nowrap; text-align: right; \}/);
    expect(css).toMatch(/\.tc-d \{ white-space: nowrap; \}/);
    expect(css).toMatch(/\.tc-t \{ min-width: 8rem; \}/);
  });
});
