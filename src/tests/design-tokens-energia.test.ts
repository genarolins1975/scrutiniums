import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import config from "../../tailwind.config";

/**
 * Tokens do domínio Energia (docs/observatorios/DESIGN_SYSTEM_OBSERVATORIOS.md):
 * todo token usado como texto passa WCAG AA (4,5:1) sobre as superfícies
 * do domínio; o tom soft é só marcação não textual.
 */
type Cores = Record<string, string | Record<string, string>>;
const cores = (config.theme?.extend?.colors ?? {}) as Cores;
const tom = (nome: string, passo = "DEFAULT") => {
  const c = cores[nome];
  return typeof c === "string" ? c : c[passo];
};

function luminancia(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contraste(a: string, b: string) {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const SUPERFICIES = { superficie: tom("superficie"), papel: tom("papel") };

describe("contraste AA dos tokens de texto do domínio Energia", () => {
  const texto: Record<string, string> = {
    "energia": tom("energia"),
    "energia-dark": tom("energia", "dark"),
    "carvao": tom("carvao"),
    "carvao-muted": tom("carvao", "muted"),
    "mineral": tom("mineral"),
    "aviso": tom("aviso"),
    "erro": tom("erro"),
    ...Object.fromEntries(["observado", "calculado", "estimado", "previsto", "cenario"].map((n) => [`natureza-${n}`, tom("natureza", n)])),
  };
  for (const [nome, cor] of Object.entries(texto)) {
    for (const [sup, fundo] of Object.entries(SUPERFICIES)) {
      it(`${nome} sobre ${sup} ≥ 4,5:1`, () => {
        expect(contraste(cor, fundo)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});

describe("fundo teal claro (energia-fundo, estado ativo)", () => {
  // regra do design system: sobre energia-fundo o texto usa só carvão, carvão-muted, energia e energia-dark
  for (const [nome, cor] of Object.entries({ carvao: tom("carvao"), "carvao-muted": tom("carvao", "muted"), energia: tom("energia"), "energia-dark": tom("energia", "dark") })) {
    it(`${nome} sobre energia-fundo ≥ 4,5:1`, () => expect(contraste(cor, tom("energia", "fundo"))).toBeGreaterThanOrEqual(4.5));
  }
  it("mineral, abaixo de AA sobre energia-fundo, não aparece em elemento ativo", () => {
    const t = readFileSync(join(process.cwd(), "src/components/energia/DiagramaFormacao.tsx"), "utf-8");
    expect(t).toContain('ativo ? "text-carvao-muted" : "text-mineral"');
    expect(contraste(tom("mineral"), tom("energia", "fundo"))).toBeLessThan(4.5);
  });
});

describe("uso dos tokens", () => {
  it("energia-soft nunca é usado como cor de texto", () => {
    const arquivos: string[] = [];
    const varre = (d: string) => {
      for (const n of readdirSync(d)) {
        const p = join(d, n);
        if (statSync(p).isDirectory()) varre(p);
        else if (/\.(tsx|ts)$/.test(n)) arquivos.push(p);
      }
    };
    varre(join(process.cwd(), "src"));
    for (const f of arquivos) expect(readFileSync(f, "utf-8"), f).not.toMatch(/\btext-energia-soft\b/);
  });

  it("componentes do domínio não escrevem hexadecimal solto", () => {
    for (const d of ["src/components/energia", "src/components/evidencia"]) {
      for (const n of readdirSync(join(process.cwd(), d))) {
        const t = readFileSync(join(process.cwd(), d, n), "utf-8");
        expect(t, n).not.toMatch(/#[0-9a-fA-F]{6}\b/);
      }
    }
  });
});
