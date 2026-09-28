import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { ANCORA, CONTORNO, FRONTEIRAS, ORDEM_REGIOES, REGIOES, VIEWBOX, projetar } from "@/lib/energia/geo";
import { PAGINAS_MAPA } from "@/lib/energia/mapa";

/**
 * Gramática visual do Observatório do Setor Elétrico
 * (docs/observatorios/DESIGN_VISUAL_GRAMMAR_ENERGIA.md): mapa-base esquemático
 * e declarado como tal, paleta semântica em tokens, um visual principal por
 * página, estado explorável na URL, animação só para fluxo e tempo e
 * respeitando prefers-reduced-motion, nada de efeito decorativo, celular sem
 * rolagem horizontal, ausência de dado sempre nomeada.
 */
const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, p), "utf-8");
const arquivos = (d: string, filtro = /\.(tsx|ts)$/) => {
  const saida: string[] = [];
  const varre = (dir: string) => {
    for (const n of readdirSync(dir)) {
      const p = join(dir, n);
      if (statSync(p).isDirectory()) varre(p);
      else if (filtro.test(n)) saida.push(p);
    }
  };
  varre(join(raiz, d));
  return saida;
};
const PAGINAS = "src/app/setor-eletrico";
/** lado da caixa de desenho do mapa ("0 0 600 600") */
const LADO = Number(VIEWBOX.split(" ")[2]);
const COMPONENTES = "src/components/energia";

describe("mapa-base esquemático", () => {
  it("cobre os quatro submercados, todos dentro da caixa de desenho", () => {
    expect(ORDEM_REGIOES).toEqual(["N", "NE", "SE", "S"]);
    for (const sm of ORDEM_REGIOES) {
      const pontos = REGIOES[sm];
      expect(pontos.length, sm).toBeGreaterThanOrEqual(3);
      for (const p of pontos) {
        const [x, y] = projetar(p);
        expect(x, `${sm} x`).toBeGreaterThanOrEqual(0);
        expect(x, `${sm} x`).toBeLessThanOrEqual(LADO);
        expect(y, `${sm} y`).toBeGreaterThanOrEqual(0);
        expect(y, `${sm} y`).toBeLessThanOrEqual(LADO);
      }
      const [ax, ay] = projetar(ANCORA[sm]);
      expect(ax).toBeGreaterThan(0);
      expect(ax).toBeLessThan(LADO);
      expect(ay).toBeGreaterThan(0);
      expect(ay).toBeLessThan(LADO);
    }
    for (const p of CONTORNO) {
      const [x, y] = projetar(p);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(LADO);
    }
  });

  it("as quatro fronteiras monitoradas pelo ONS ligam submercados distintos", () => {
    expect(FRONTEIRAS.map((f) => f.par).sort()).toEqual(["NE_SE", "N_NE", "N_SE", "S_SE"]);
    for (const f of FRONTEIRAS) {
      expect(ORDEM_REGIOES).toContain(f.de);
      expect(ORDEM_REGIOES).toContain(f.para);
      expect(f.de).not.toBe(f.para);
    }
  });

  it("declara a natureza esquemática e a leitura não conferida da divisão por estado", () => {
    const m = ler(`${COMPONENTES}/MapaBrasil.tsx`);
    expect(m).toContain("Mapa esquemático");
    expect(m).toContain("não conferida em documento do ONS ou da CCEE");
    const v = ler(`${COMPONENTES}/VisualConceito.tsx`);
    // quem esconde a nota padrão do mapa declara a natureza na própria legenda
    expect((v.match(/nota=\{null\}/g) ?? []).length).toBe((v.match(/Mapa esquemático, sem escala/g) ?? []).length);
  });
});

describe("paleta semântica em tokens", () => {
  it("define PLD, nuclear, biomassa e o terreno do mapa como variáveis CSS", () => {
    const css = ler("src/app/globals.css");
    for (const v of ["--serie-pld", "--serie-nuclear", "--serie-biomassa", "--cor-mapa-terra", "--cor-mapa-borda", "--cor-preco-fundo"]) expect(css).toContain(`${v}:`);
    const tw = ler("tailwind.config.ts");
    expect(tw).toMatch(/preco:\s*\{/);
    expect(tw).toMatch(/mapa:\s*\{/);
  });

  it("o mapa colore cada tom com a série do domínio, nunca com hexadecimal", () => {
    const m = ler(`${COMPONENTES}/MapaBrasil.tsx`);
    expect(m).toContain('preco: "var(--serie-pld)"');
    expect(m).toContain('agua: "var(--serie-hidraulica)"');
    expect(m).not.toMatch(/#[0-9a-fA-F]{6}\b/);
  });

  it("componentes da home também não escrevem hexadecimal solto", () => {
    for (const f of arquivos("src/components/home")) expect(ler(f.replace(`${raiz}/`, "")), f).not.toMatch(/#[0-9a-fA-F]{6}\b/);
  });
});

describe("nada de efeito decorativo", () => {
  it("sem gradiente, glassmorphism, sombra pesada ou gauge nas páginas e componentes do domínio", () => {
    for (const f of [...arquivos(PAGINAS), ...arquivos(COMPONENTES), ...arquivos("src/components/home")]) {
      const t = ler(f.replace(`${raiz}/`, ""));
      expect(t, f).not.toMatch(/bg-gradient|backdrop-blur|shadow-(lg|xl|2xl)|conic-gradient|drop-shadow/);
    }
  });
});

describe("animação só para fluxo, mudança e tempo", () => {
  it("as três animações existem e param com prefers-reduced-motion", () => {
    const css = ler("src/app/globals.css");
    for (const k of ["fluxo-corre", "percorre-caminho", "surge"]) expect(css).toContain(`@keyframes ${k}`);
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("componentes com reprodução automática consultam prefers-reduced-motion", () => {
    for (const c of ["EvolucaoMatriz", "ExplicadorIncerteza"]) expect(ler(`${COMPONENTES}/${c}.tsx`), c).toContain('matchMedia("(prefers-reduced-motion: reduce)")');
  });
});

describe("estado explorável na URL", () => {
  it("useEstadoUrl lê depois de montar e grava sem nova carga", () => {
    const u = ler("src/lib/energia/useEstadoUrl.ts");
    expect(u).toContain("window.history.replaceState");
    expect(u).toContain("url.searchParams.set(chave, v)");
  });

  it("toda chave de URL pertence ao vocabulário documentado", () => {
    const permitidas = new Set(["dia", "submercado", "horizonte", "janela", "mes", "dominio", "etapa", "camada", "bloco", "visao", "modo"]);
    for (const f of arquivos(COMPONENTES)) {
      const t = ler(f.replace(`${raiz}/`, ""));
      for (const m of Array.from(t.matchAll(/useEstadoUrl<[^>]*>\(\s*"([a-z]+)"/g))) expect(permitidas.has(m[1]), `${f}: ${m[1]}`).toBe(true);
      for (const m of Array.from(t.matchAll(/chaveUrl = "([a-z]+)"/g))) expect(permitidas.has(m[1]), `${f}: ${m[1]}`).toBe(true);
    }
  });
});

describe("um visual principal por página, na ordem pergunta, resposta curta, visual", () => {
  const heroes: Record<string, string[]> = {
    "visao-geral/page.tsx": ["MapaVivo", "SistemaEmUmaTela"],
    "pld/page.tsx": ["LinhaDoDia", "DiagramaFormacao", "PrevisaoPld", "ExplicadorIncerteza", "MaquinaDoTempo", "MapaBrasil"],
    "agua-e-clima/page.tsx": ["MapaVivo", "ColunasReservatorio"],
    "geracao/page.tsx": ["SankeyFontes", "EvolucaoMatriz", "MapaBrasil"],
    "carga/page.tsx": ["HeatmapCalendario", "MapaBrasil"],
    "rede/page.tsx": ["AbasVisoes", "MapaBrasil"],
    "aprenda/page.tsx": ["MapaConceitual"],
    "aprenda/como-funciona/page.tsx": ["InfograficoSistema"],
    "aprenda/[conceito]/page.tsx": ["VisualConceito"],
    "dados/page.tsx": ["LinhagemDados", "PipelineEstados", "CatalogoFiltro"],
  };
  for (const [pagina, componentes] of Object.entries(heroes)) {
    it(`${pagina} usa ${componentes.join(", ")}`, () => {
      const t = ler(`${PAGINAS}/${pagina}`);
      for (const c of componentes) expect(t, c).toMatch(new RegExp(`<${c}\\b|${c}\\(`));
    });
  }

  it("a metodologia remete ao mapa de linhagem em vez de repeti-lo", () => {
    const m = ler(`${PAGINAS}/metodologia/page.tsx`);
    expect(m).toContain('href="/setor-eletrico/dados#linhagem"');
    expect(m).not.toContain("<LinhagemDados");
    expect(m).toContain('aria-label="Nesta página"');
  });

  it("módulos em integração trazem o infográfico estrutural sem números", () => {
    for (const m of ["mercado", "empresas", "expansao", "regulacao"]) {
      const t = ler(`${PAGINAS}/${m}/page.tsx`);
      expect(t, m).toContain("esquema={");
      expect(t, m).toMatch(/icone="[a-z]+"/);
    }
    const e = ler(`${COMPONENTES}/EsquemaConceitual.tsx`);
    expect(e).toContain("Sem números");
    expect(e).not.toContain("gridTemplateColumns");
  });

  it("o título de cada página do mapa é uma pergunta", () => {
    for (const [id, p] of Object.entries(PAGINAS_MAPA)) expect(p.pergunta.endsWith("?"), id).toBe(true);
    expect(ler(`${PAGINAS}/pld/page.tsx`)).toContain("Por que a energia tem este preço hoje?");
    expect(ler(`${PAGINAS}/visao-geral/page.tsx`)).toContain('PAGINAS_MAPA["visao-geral"].pergunta');
  });
});

describe("ausência nomeada, nunca estimada em silêncio", () => {
  it("o fan chart e a previsão do PLD explicam por que não há previsão", () => {
    expect(ler(`${COMPONENTES}/FanChart.tsx`)).toContain("motivoIndisponivel");
    expect(ler(`${COMPONENTES}/PrevisaoPld.tsx`)).toContain("motivoIndisponivel");
    expect(ler(`${COMPONENTES}/MaquinaDoTempo.tsx`)).toMatch(/sem número|número retido/);
  });

  it("o explicador de incerteza se declara ilustrativo, e o infográfico mestre nega causalidade nas setas", () => {
    expect(ler(`${COMPONENTES}/ExplicadorIncerteza.tsx`)).toContain("Nenhuma delas é a previsão");
    expect(ler(`${COMPONENTES}/InfograficoSistema.tsx`)).toContain("não uma relação de causa");
    expect(ler(`${COMPONENTES}/LinhaDoDia.tsx`)).toMatch(/limiar/);
  });

  it("a rede declara que os limites de intercâmbio não estão integrados", () => {
    const r = ler(`${PAGINAS}/rede/page.tsx`);
    expect(r).toContain("não integrados");
    expect(r).toMatch(/dado ausente/i);
  });
});

describe("celular e acessibilidade", () => {
  it("SVGs de largura fixa nunca ultrapassam o contêiner, e grades de etapas quebram em colunas", () => {
    expect(ler(`${COMPONENTES}/Sparkline.tsx`)).toContain("max-w-full");
    expect(ler(`${COMPONENTES}/InfograficoSistema.tsx`)).toContain("grid-cols-2");
    expect(ler(`${COMPONENTES}/MapaBrasil.tsx`)).toContain('className="hidden sm:block"');
  });

  it("todo mapa e infográfico tem lista ou tabela equivalente e navegação por botão", () => {
    const m = ler(`${COMPONENTES}/MapaBrasil.tsx`);
    expect(m).toContain("aria-pressed");
    expect(m).toMatch(/<ul|<table/);
    expect(ler(`${COMPONENTES}/SankeyFontes.tsx`)).toContain("TabelaDados");
    expect(ler(`${COMPONENTES}/HeatmapCalendario.tsx`)).toContain("TabelaDados");
    expect(ler(`${COMPONENTES}/InfograficoSistema.tsx`)).toContain('ev.key === "ArrowRight"');
  });

  it("todo ícone pedido pelas páginas existe no conjunto próprio", () => {
    const icones = new Set(Array.from(ler(`${COMPONENTES}/IconeSetor.tsx`).matchAll(/^ {2}([a-z]+): \[/gm)).map((m) => m[1]));
    expect(icones.size).toBeGreaterThanOrEqual(19);
    for (const f of [...arquivos(PAGINAS), ...arquivos(COMPONENTES), ...arquivos("src/lib/energia"), ...arquivos("src/lib", /^amostras\.ts$/)]) {
      const t = ler(f.replace(`${raiz}/`, ""));
      for (const m of Array.from(t.matchAll(/icone[=:]\s*"([a-z]+)"/g))) expect(icones.has(m[1]), `${f}: ${m[1]}`).toBe(true);
    }
  });
});

describe("home e seletor", () => {
  it("a home apresenta os dois observatórios com miniaturas de dado real, energia primeiro", () => {
    const hero = ler("src/components/home/Hero.tsx");
    expect(hero).toContain("Da informação dispersa ao conhecimento");
    expect(hero).toContain("Dois observatórios. Uma mesma infraestrutura de dados, método e evidência.");
    const secao = ler("src/components/home/SecaoObservatorios.tsx");
    expect(secao.indexOf("dominio={energia}")).toBeGreaterThan(-1);
    expect(secao.indexOf("dominio={energia}")).toBeLessThan(secao.indexOf("dominio={credito}"));
    for (const m of ["MiniaturaEnergia", "MiniaturaCredito"]) expect(ler(`src/components/home/${m}.tsx`), m).not.toMatch(/#[0-9a-fA-F]{6}\b/);
  });

  it("o seletor pergunta o que investigar e mostra amostras vivas com fonte e data", () => {
    const s = ler("src/app/app/(foco)/observatorios/page.tsx");
    expect(s).toContain("O que você quer investigar hoje?");
    expect(s).toContain("amostrasEnergia()");
    expect(s).toContain("amostrasCredito()");
  });

  it("o infográfico mestre está no sitemap e é estático", () => {
    expect(ler("src/app/sitemap.ts")).toContain('"/setor-eletrico/aprenda/como-funciona"');
    expect(ler(`${PAGINAS}/aprenda/como-funciona/page.tsx`)).toContain('export const dynamic = "force-static"');
  });
});
