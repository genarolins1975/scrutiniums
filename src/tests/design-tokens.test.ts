import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { TOKENS } from "../lib/tokens.gerado";
import { derivar, propriedadesRaiz as raizCss } from "../../scripts/tokens-derivados.mjs";

const propriedadesRaiz = (css: string) => raizCss(css) as [string, string][];

/**
 * Um só arquivo de tokens e piso de 12 px (Iniciativa 5 do parecer docs/PARECER_UX_2026-10-21.md; referência em
 * docs/observatorios/DESIGN_SYSTEM_OBSERVATORIOS.md):
 * - src/app/globals.css é o único lugar que define cor; tailwind.config.ts lê var(--cor-…); os derivados (public/obs/tokens.css,
 *   src/lib/tokens.gerado.ts) estão em sincronia com ele;
 * - nenhum hexadecimal em src/components, src/app e nas folhas públicas da plataforma e da aplicação do Crédito, e nenhuma
 *   propriedade --cor-* redefinida fora de globals.css;
 * - nenhum corpo de letra abaixo de 0,75 rem (12 px) fora da impressão, nenhum text-[…] abaixo disso e nenhum !text-[ nos .tsx;
 * - contraste AA (4,5:1) dos tokens de texto sobre papel, marfim, superfície e os fundos de domínio, e 3:1 das séries.
 *
 * EXCECOES lista, com o PR que as resolve, o que ainda não migrou; exceção que já não se aplica reprova, para a lista só
 * encolher até ficar vazia.
 */
const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, p), "utf-8");
const globals = ler("src/app/globals.css");

// ---------------------------------------------------------------------------------------------------- exceções datadas
type Regra = "hexadecimal" | "redefine --cor-*" | "corpo abaixo de 12 px" | "!text-[" | "text-[…] abaixo de 0,75 rem";
// Lista de 22/10/2026 (PR 1 da Iniciativa 5).
const EXCECOES: Record<string, { regras: Regra[]; ate: string }> = {
  "src/components/LiteralFonte.tsx": { regras: ["text-[…] abaixo de 0,75 rem"], ate: "PR 3 da Iniciativa 5 (escala tipográfica)" },
  "src/components/agro/Agro.module.css": { regras: ["corpo abaixo de 12 px"], ate: "PR 3 da Iniciativa 5 (escala tipográfica)" },
  "src/components/conta/FerramentasConta.tsx": { regras: ["text-[…] abaixo de 0,75 rem"], ate: "PR 3 da Iniciativa 5 (escala tipográfica)" },
  "src/components/contas-estaduais/PainelEstadual.tsx": { regras: ["hexadecimal"], ate: "PR 2 da Iniciativa 5 (redefinições por coleção)" },
  "src/components/contas-publicas/IndiceFederal.module.css": { regras: ["corpo abaixo de 12 px"], ate: "PR 3 da Iniciativa 5 (escala tipográfica)" },
  "src/components/dados/GraficoSerie.tsx": { regras: ["hexadecimal"], ate: "PR 2 da Iniciativa 5 (redefinições por coleção)" },
  "src/components/educacao/educacao.css": { regras: ["hexadecimal"], ate: "PR 2 da Iniciativa 5 (redefinições por coleção)" },
  "src/components/eficiencia/AtlasCidadao.module.css": { regras: ["corpo abaixo de 12 px"], ate: "PR 3 da Iniciativa 5 (escala tipográfica)" },
  "src/components/eficiencia/ExploradorTema.tsx": { regras: ["!text-[", "text-[…] abaixo de 0,75 rem"], ate: "PR 3 da Iniciativa 5 (escala tipográfica)" },
  "src/components/eficiencia/ReferenciasPainel.tsx": { regras: ["!text-[", "text-[…] abaixo de 0,75 rem"], ate: "PR 3 da Iniciativa 5 (escala tipográfica)" },
  "src/components/eficiencia/TabelaComparativa.tsx": { regras: ["text-[…] abaixo de 0,75 rem"], ate: "PR 3 da Iniciativa 5 (escala tipográfica)" },
  "src/components/eficiencia/entrada/Entrada.module.css": { regras: ["corpo abaixo de 12 px"], ate: "PR 3 da Iniciativa 5 (escala tipográfica)" },
  "src/components/eficiencia/entrada/MinhaCapitalAperitivo.module.css": { regras: ["corpo abaixo de 12 px"], ate: "PR 3 da Iniciativa 5 (escala tipográfica)" },
  "src/components/eficiencia/estados.tsx": { regras: ["!text-[", "text-[…] abaixo de 0,75 rem"], ate: "PR 3 da Iniciativa 5 (escala tipográfica)" },
  "src/components/eficiencia/judiciario/Internacional.module.css": { regras: ["corpo abaixo de 12 px"], ate: "PR 3 da Iniciativa 5 (escala tipográfica)" },
  "src/components/eficiencia/judiciario/Judiciario.module.css": { regras: ["corpo abaixo de 12 px"], ate: "PR 3 da Iniciativa 5 (escala tipográfica)" },
  "src/components/energia/AprendaVerbete.tsx": { regras: ["!text-[", "text-[…] abaixo de 0,75 rem"], ate: "PR 3 da Iniciativa 5 (escala tipográfica)" },
  "src/components/energia/BarrasMix.tsx": { regras: ["text-[…] abaixo de 0,75 rem"], ate: "PR 3 da Iniciativa 5 (escala tipográfica)" },
  "src/components/energia/ComproveNumero.tsx": { regras: ["!text-[", "text-[…] abaixo de 0,75 rem"], ate: "PR 3 da Iniciativa 5 (escala tipográfica)" },
  "src/components/energia/ExploracaoInicial.module.css": { regras: ["corpo abaixo de 12 px"], ate: "PR 3 da Iniciativa 5 (escala tipográfica)" },
  "src/components/energia/ListaConsultavel.tsx": { regras: ["text-[…] abaixo de 0,75 rem"], ate: "PR 3 da Iniciativa 5 (escala tipográfica)" },
  "src/components/energia/PercursoVisualEnergia.module.css": { regras: ["corpo abaixo de 12 px"], ate: "PR 3 da Iniciativa 5 (escala tipográfica)" },
  "src/components/energia/TabelaInterativa.tsx": { regras: ["text-[…] abaixo de 0,75 rem"], ate: "PR 3 da Iniciativa 5 (escala tipográfica)" },
  "src/components/evidencia/SobreEsteDado.tsx": { regras: ["text-[…] abaixo de 0,75 rem"], ate: "PR 3 da Iniciativa 5 (escala tipográfica)" },
  "src/components/imprensa/GraficoEpae.tsx": { regras: ["hexadecimal"], ate: "PR 2 da Iniciativa 5 (redefinições por coleção)" },
  "src/components/layout/NavegacaoContexto.tsx": { regras: ["text-[…] abaixo de 0,75 rem"], ate: "PR 3 da Iniciativa 5 (escala tipográfica)" },
  "src/components/layout/PublicHeader.tsx": { regras: ["text-[…] abaixo de 0,75 rem"], ate: "PR 3 da Iniciativa 5 (escala tipográfica)" },
  "src/components/observatorios/DiretorioPaineis.module.css": { regras: ["hexadecimal"], ate: "PR 2 da Iniciativa 5 (redefinições por coleção)" },
  "src/components/observatorios/EntradaEstado.module.css": { regras: ["corpo abaixo de 12 px"], ate: "PR 3 da Iniciativa 5 (escala tipográfica)" },
  "src/components/observatorios/ParaVoce.module.css": { regras: ["hexadecimal"], ate: "PR 2 da Iniciativa 5 (redefinições por coleção)" },
  "src/components/previdencia/previdencia.css": { regras: ["hexadecimal"], ate: "PR 2 da Iniciativa 5 (redefinições por coleção)" },
  "src/components/saneamento/DiagramaSistema.tsx": { regras: ["hexadecimal"], ate: "PR 2 da Iniciativa 5 (redefinições por coleção)" },
  "src/components/saneamento/Ilustracoes.tsx": { regras: ["hexadecimal"], ate: "PR 2 da Iniciativa 5 (redefinições por coleção)" },
  "src/components/saneamento/Laboratorios.tsx": { regras: ["hexadecimal"], ate: "PR 2 da Iniciativa 5 (redefinições por coleção)" },
  "src/components/saneamento/PrecoRegulado.tsx": { regras: ["text-[…] abaixo de 0,75 rem"], ate: "PR 3 da Iniciativa 5 (escala tipográfica)" },
  "src/components/territorio/Desastres.tsx": { regras: ["text-[…] abaixo de 0,75 rem"], ate: "PR 3 da Iniciativa 5 (escala tipográfica)" },
  "src/components/territorio/Emissoes.tsx": { regras: ["text-[…] abaixo de 0,75 rem"], ate: "PR 3 da Iniciativa 5 (escala tipográfica)" },
  "src/components/territorio/Queimadas.tsx": { regras: ["hexadecimal", "text-[…] abaixo de 0,75 rem"], ate: "PR 2 (cor) e PR 3 (corpo) da Iniciativa 5" },
  "src/app/aperitivo/saneamento/page.tsx": { regras: ["text-[…] abaixo de 0,75 rem"], ate: "PR 3 da Iniciativa 5 (escala tipográfica)" },
  "src/app/app/(foco)/observatorios/escolha.module.css": { regras: ["hexadecimal", "corpo abaixo de 12 px"], ate: "PR 2 (cor) e PR 3 (corpo) da Iniciativa 5" },
  "src/app/contas-publicas/contas.css": { regras: ["corpo abaixo de 12 px"], ate: "PR 2 (cor) e PR 3 (corpo) da Iniciativa 5" },
  "src/app/contas-publicas-estaduais/estados.css": { regras: ["corpo abaixo de 12 px"], ate: "PR 2 (cor) e PR 3 (corpo) da Iniciativa 5" },
  "src/app/eficiencia-estatal/trabalho-renda/trabalho-renda.css": { regras: ["hexadecimal"], ate: "PR 2 da Iniciativa 5 (redefinições por coleção)" },
  "src/app/saneamento/municipio/[id]/page.tsx": { regras: ["text-[…] abaixo de 0,75 rem"], ate: "PR 3 da Iniciativa 5 (escala tipográfica)" },
  "src/app/saneamento/prestadores/divida/page.tsx": { regras: ["text-[…] abaixo de 0,75 rem"], ate: "PR 3 da Iniciativa 5 (escala tipográfica)" },
  "src/app/setor-eletrico/atlas-inicial.css": { regras: ["corpo abaixo de 12 px"], ate: "PR 2 (cor) e PR 3 (corpo) da Iniciativa 5" },
  "src/app/territorio/metodologia/page.tsx": { regras: ["text-[…] abaixo de 0,75 rem"], ate: "PR 3 da Iniciativa 5 (escala tipográfica)" },
  "public/observatorios.css": { regras: ["corpo abaixo de 12 px"], ate: "PR 2 (cor) e PR 3 (corpo) da Iniciativa 5" },
  "public/observatorios-gravuras.css": { regras: ["corpo abaixo de 12 px"], ate: "PR 2 (cor) e PR 3 (corpo) da Iniciativa 5" },
  "public/obs/styles.css": { regras: ["hexadecimal", "corpo abaixo de 12 px"], ate: "PR 4 da Iniciativa 5 (aplicação do Crédito)" },
  "public/obs/atlas.css": { regras: ["hexadecimal", "corpo abaixo de 12 px"], ate: "PR 2 (cor) e PR 3 (corpo) da Iniciativa 5" },
};

// ---------------------------------------------------------------------------------------------------- leitura dos arquivos
const ESCOPO_DIRS = ["src/components", "src/app"];
const ESCOPO_ARQUIVOS = ["public/observatorios.css", "public/observatorios-gravuras.css", "public/obs/styles.css", "public/obs/atlas.css"];
const PERMITIDOS = new Set(["src/app/globals.css"]);

function arquivosDoEscopo() {
  const lista: string[] = [];
  const varre = (d: string) => {
    for (const n of readdirSync(join(raiz, d))) {
      const p = join(d, n);
      if (statSync(join(raiz, p)).isDirectory()) varre(p);
      else if (/\.(tsx?|css)$/.test(n)) lista.push(p);
    }
  };
  ESCOPO_DIRS.forEach(varre);
  return [...lista, ...ESCOPO_ARQUIVOS].filter((p) => !PERMITIDOS.has(p)).map((p) => relative(raiz, join(raiz, p)));
}

/** Tira comentários: o que se lê ali é texto, não cor nem corpo de letra. */
function semComentarios(texto: string, css: boolean) {
  const t = texto.replace(/\/\*[\s\S]*?\*\//g, " ");
  return css ? t : t.replace(/(^|[\s;{}(),])\/\/[^\n]*/g, "$1").replace(/\{\/\*[\s\S]*?\*\/\}/g, " ");
}

/** Tira os blocos @media print, onde o corpo de letra do papel segue outra régua. */
function semImpressao(css: string) {
  let saida = "";
  let i = 0;
  for (const m of css.matchAll(/@media\s+print\s*\{/g)) {
    if (m.index! < i) continue;
    saida += css.slice(i, m.index);
    let nivel = 1;
    let j = m.index! + m[0].length;
    for (; j < css.length && nivel > 0; j++) nivel += css[j] === "{" ? 1 : css[j] === "}" ? -1 : 0;
    i = j;
  }
  return saida + css.slice(i);
}

const HEX_CSS = /(?<![\w&-])#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b/gi;
// Em TypeScript, hexadecimal de seis ou oito dígitos fora de palavra, ou de três entre aspas (âncoras como "#a07" vêm depois de
// um caminho e não casam).
const HEX_TS = /(?<![\w&/}-])#(?:[0-9a-f]{8}|[0-9a-f]{6})\b|["'`]#[0-9a-f]{3,4}["'`]/gi;
const REDEFINE_CSS = /(?:^|[;{\s])--cor-[a-z0-9-]+\s*:/gi;
const REDEFINE_TS = /["'`]--cor-[a-z0-9-]+["'`]\s*:/gi;
const PX_POR_REM = 16;

function corposAbaixoDoPiso(css: string) {
  const achados: string[] = [];
  const t = semImpressao(css);
  for (const m of t.matchAll(/font-size\s*:\s*([\d.]+)(px|rem)\b/gi)) {
    const px = parseFloat(m[1]) * (m[2].toLowerCase() === "rem" ? PX_POR_REM : 1);
    if (px < 12) achados.push(m[0]);
  }
  // atalho font: [estilo] [peso] <corpo>[/<entrelinha>] <família>
  for (const m of t.matchAll(/(?:^|[;{\s])font\s*:\s*[^;{}]*?(?<![\w.])([\d.]+)(px|rem)\s*(?:\/|\s)/gi)) {
    const px = parseFloat(m[1]) * (m[2].toLowerCase() === "rem" ? PX_POR_REM : 1);
    if (px < 12) achados.push(m[0].trim());
  }
  // escala de corpo em variável (--fs-*): o piso vale para o valor declarado
  for (const m of t.matchAll(/--fs-[a-z0-9-]+\s*:\s*([\d.]+)(px|rem)\b/gi)) {
    const px = parseFloat(m[1]) * (m[2].toLowerCase() === "rem" ? PX_POR_REM : 1);
    if (px < 12) achados.push(m[0]);
  }
  return achados;
}

function textoArbitrarioAbaixo(tsx: string) {
  const achados: string[] = [];
  for (const m of tsx.matchAll(/\btext-\[([\d.]+)(rem|px|em)\]/g)) {
    const px = parseFloat(m[1]) * (m[2] === "px" ? 1 : PX_POR_REM);
    if (px < 12) achados.push(m[0]);
  }
  return achados;
}

function infracoes() {
  const por: Record<string, Partial<Record<Regra, string[]>>> = {};
  const marca = (arq: string, regra: Regra, achados: string[]) => {
    if (achados.length) (por[arq] ??= {})[regra] = achados.slice(0, 5);
  };
  for (const arq of arquivosDoEscopo()) {
    const bruto = ler(arq);
    const css = arq.endsWith(".css");
    const t = semComentarios(bruto, css);
    marca(arq, "hexadecimal", [...t.matchAll(css ? HEX_CSS : HEX_TS)].map((m) => m[0]));
    marca(arq, "redefine --cor-*", [...t.matchAll(css ? REDEFINE_CSS : REDEFINE_TS)].map((m) => m[0].trim()));
    if (css) marca(arq, "corpo abaixo de 12 px", corposAbaixoDoPiso(t));
    if (arq.endsWith(".tsx")) {
      marca(arq, "!text-[", [...t.matchAll(/!text-\[[^\]]*\]/g)].map((m) => m[0]));
      marca(arq, "text-[…] abaixo de 0,75 rem", textoArbitrarioAbaixo(t));
    }
  }
  return por;
}

describe("um só arquivo de tokens", () => {
  const achadas = infracoes();

  it("nenhum arquivo fora de globals.css define cor ou corpo abaixo do piso (salvo as exceções datadas)", () => {
    const novas: string[] = [];
    for (const [arq, regras] of Object.entries(achadas)) {
      for (const [regra, exemplos] of Object.entries(regras)) {
        if (!EXCECOES[arq]?.regras.includes(regra as Regra)) novas.push(`${arq}: ${regra} (${exemplos!.join(", ")})`);
      }
    }
    expect(novas).toEqual([]);
  });

  it("exceção que já não se aplica sai da lista", () => {
    const vencidas: string[] = [];
    for (const [arq, { regras }] of Object.entries(EXCECOES)) {
      for (const r of regras) if (!achadas[arq]?.[r]) vencidas.push(`${arq}: ${r}`);
    }
    expect(vencidas).toEqual([]);
  });

  it("tailwind.config.ts não escreve hexadecimal: toda cor lê var(--cor-…)", () => {
    const cfg = semComentarios(ler("tailwind.config.ts"), false);
    expect(cfg).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(cfg).toContain("var(--cor-${nome})");
  });

  it("toda cor do Tailwind lida de globals.css existe lá", () => {
    const cfg = ler("tailwind.config.ts");
    const nomes = new Set(propriedadesRaiz(globals).map(([n]) => n));
    for (const m of cfg.matchAll(/(?:v|comAlfa)\("([a-z0-9-]+)"\)/g)) {
      const nome = m[0].startsWith("comAlfa") ? `--cor-${m[1]}-rgb` : `--cor-${m[1]}`;
      expect(nomes.has(nome), nome).toBe(true);
    }
  });

  it("as triplas RGB (cores com opacidade no Tailwind) são o mesmo valor do hexadecimal", () => {
    const props = new Map(propriedadesRaiz(globals));
    for (const [nome, valor] of props) {
      if (!nome.endsWith("-rgb")) continue;
      const hex = (TOKENS as Record<string, string>)[nome.slice(2, -4)];
      const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(" ");
      expect(valor, nome).toBe(rgb);
    }
  });

  it("classe com modificador de opacidade só usa cor que tem tripla RGB (com var() puro o Tailwind descarta a classe em silêncio)", () => {
    const cfg = ler("tailwind.config.ts");
    const comAlfa = new Set([...cfg.matchAll(/comAlfa\("([a-z0-9-]+)"\)/g)].map((m) => m[1]));
    const familias = ["carvao", "marfim", "papel", "bronze", "mineral", "linha", "linha-escura", "energia", "obee", "gas", "conect", "destaque", "painel-escuro", "superficie", "natureza", "erro", "sucesso", "aviso"];
    const re = new RegExp(`\\b(?:bg|text|border|decoration|ring|fill|stroke|outline|divide|from|to|via|accent|caret|placeholder|shadow)-((?:${familias.join("|")})(?:-[a-z]+)?)/(?:\\d+|\\[)`, "g");
    const semTripla: string[] = [];
    for (const arq of arquivosDoEscopo().filter((a) => a.endsWith(".tsx") || a.endsWith(".ts"))) {
      for (const m of ler(arq).matchAll(re)) if (!comAlfa.has(m[1])) semTripla.push(`${arq}: ${m[0]}`);
    }
    expect(semTripla).toEqual([]);
  });

  it("os derivados (public/obs/tokens.css e src/lib/tokens.gerado.ts) estão em sincronia com globals.css", () => {
    const { css, ts } = derivar(globals);
    expect(ler("public/obs/tokens.css"), "rodar node scripts/tokens-derivados.mjs").toBe(css);
    expect(ler("src/lib/tokens.gerado.ts"), "rodar node scripts/tokens-derivados.mjs").toBe(ts);
  });

  it("a aplicação do Crédito carrega os tokens antes das próprias folhas", () => {
    for (const html of ["public/obs/index.html", "public/obs/embed.html"]) {
      const t = ler(html);
      const tokens = t.indexOf('href="/obs/tokens.css"');
      expect(tokens, html).toBeGreaterThan(0);
      expect(tokens, html).toBeLessThan(t.indexOf('href="/obs/styles.css'));
    }
  });
});

// ---------------------------------------------------------------------------------------------------- contraste
const tom = (nome: string) => {
  const v = (TOKENS as Record<string, string>)[`cor-${nome}`] ?? (TOKENS as Record<string, string>)[nome];
  if (!v) throw new Error(`token ${nome} sem hexadecimal em globals.css`);
  return v;
};
function luminancia(hex: string) {
  const h = hex.length === 4 ? `#${[...hex.slice(1)].map((c) => c + c).join("")}` : hex;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contraste(a: string, b: string) {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** Tokens usados como cor de texto. */
const TEXTO = [
  "carvao", "carvao-soft", "carvao-muted", "mineral", "bronze-dark",
  "energia", "energia-dark", "obee", "obee-dark", "obee-tinta", "gas", "gas-dark", "conect", "conect-dark", "destaque",
  "erro", "sucesso",
  "natureza-observado", "natureza-calculado", "natureza-estimado", "natureza-previsto", "natureza-cenario",
];
const FUNDOS_CLAROS = ["papel", "marfim", "superficie"];

describe("contraste AA dos tokens de texto", () => {
  for (const nome of TEXTO) {
    for (const fundo of FUNDOS_CLAROS) {
      it(`${nome} sobre ${fundo} ≥ 4,5:1`, () => expect(contraste(tom(nome), tom(fundo))).toBeGreaterThanOrEqual(4.5));
    }
  }
  // aviso mede 4,24:1 sobre o marfim: texto de aviso fica sobre papel e superfície (os fundos dos painéis que o usam)
  for (const fundo of ["papel", "superficie"]) {
    it(`aviso sobre ${fundo} ≥ 4,5:1`, () => expect(contraste(tom("aviso"), tom(fundo))).toBeGreaterThanOrEqual(4.5));
  }
  it("aviso fica abaixo de AA sobre o marfim (por isso não aparece nele)", () => expect(contraste(tom("aviso"), tom("marfim"))).toBeLessThan(4.5));
  it("bronze (acento da marca) é texto grande ou marcação: abaixo de 4,5:1 sobre marfim e papel", () => {
    expect(contraste(tom("bronze"), tom("papel"))).toBeLessThan(4.5);
    expect(contraste(tom("bronze"), tom("superficie"))).toBeGreaterThanOrEqual(4.5);
  });
});

describe("fundos de domínio: texto só em carvão, carvão-muted e o acento do domínio", () => {
  const DOMINIOS: Record<string, string[]> = {
    "energia-fundo": ["energia", "energia-dark"],
    "obee-fundo": ["obee", "obee-dark", "obee-tinta"],
    "gas-fundo": ["gas", "gas-dark"],
    "conect-fundo": ["conect", "conect-dark"],
  };
  for (const [fundo, acentos] of Object.entries(DOMINIOS)) {
    for (const nome of ["carvao", "carvao-muted", ...acentos]) {
      it(`${nome} sobre ${fundo} ≥ 4,5:1`, () => expect(contraste(tom(nome), tom(fundo))).toBeGreaterThanOrEqual(4.5));
    }
  }
  it("mineral, abaixo de AA sobre energia-fundo, não aparece em elemento ativo", () => {
    const t = ler("src/components/energia/DiagramaFormacao.tsx");
    expect(t).toContain('ativo ? "text-carvao-muted" : "text-mineral"');
    expect(contraste(tom("mineral"), tom("energia-fundo"))).toBeLessThan(4.5);
  });
});

describe("painel escuro", () => {
  for (const nome of ["painel-escuro-texto", "painel-escuro-legenda"]) {
    it(`${nome} sobre o painel escuro ≥ 4,5:1`, () => expect(contraste(tom(nome), tom("painel-escuro"))).toBeGreaterThanOrEqual(4.5));
  }
});

describe("séries de gráfico: 3:1 sobre papel e marfim (WCAG 1.4.11)", () => {
  // abaixo de 3:1, documentadas: exigem rótulo direto e tabela equivalente (DESIGN_SYSTEM_OBSERVATORIOS.md, Gráficos)
  const ABAIXO = new Set(["serie-solar", "serie-5"]);
  const series = Object.keys(TOKENS).filter((n) => n.startsWith("serie-"));
  it("há séries para conferir", () => expect(series.length).toBeGreaterThan(10));
  for (const s of series) {
    for (const fundo of ["papel", "marfim"]) {
      if (ABAIXO.has(s)) it(`${s} sobre ${fundo}: abaixo de 3:1, só com rótulo direto`, () => expect(contraste(tom(s), tom(fundo))).toBeLessThan(3));
      else it(`${s} sobre ${fundo} ≥ 3:1`, () => expect(contraste(tom(s), tom(fundo))).toBeGreaterThanOrEqual(3));
    }
  }
});

describe("uso dos tokens", () => {
  it("energia-soft nunca é usado como cor de texto", () => {
    for (const arq of arquivosDoEscopo().filter((a) => /\.tsx?$/.test(a))) expect(ler(arq), arq).not.toMatch(/\btext-energia-soft\b/);
  });
});
