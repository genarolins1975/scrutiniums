/* eslint-disable @typescript-eslint/no-explicit-any -- leitura do CSS da SPA */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Contraste WCAG 2.1 AA, calculado sobre os tokens do design system.
 *
 * A auditoria completa (axe-core num navegador real, 23 páginas × 2 temas) está
 * em docs/AUDITORIA_WCAG.md. Ela encontrou 161 nós reprovados em contraste, e
 * todos vinham de SEIS tokens — não de casos isolados. Este teste fecha essa
 * porta: recalcula a razão de contraste de cada par (cor de texto × fundo) que
 * o CSS de fato usa, nos dois temas, e reprova antes do deploy.
 *
 * Por que aqui e não no navegador: o que regride é o token. Quem mexer numa cor
 * do :root descobre no `npm test`, sem precisar subir servidor nem baixar
 * Chromium. O que este teste NÃO cobre — ordem de foco, leitor de tela, rótulos
 * dinâmicos — está declarado no documento da auditoria.
 */
const css = readFileSync(join(process.cwd(), "public/obs/styles.css"), "utf-8");

/* ---------- luminância relativa e razão de contraste (WCAG 2.x) ---------- */
function rgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "").trim();
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
}
function luminancia(hex: string) {
  const [r, g, b] = rgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contraste(a: string, b: string) {
  const [l1, l2] = [luminancia(a), luminancia(b)];
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
/** color-mix(in srgb, X p%, Y) — a SPA usa a forma simples, em sRGB. */
function mistura(x: string, y: string, p: number) {
  const [a, b] = [rgb(x), rgb(y)];
  return "#" + a.map((v, i) => Math.round(v * p + b[i] * (1 - p)).toString(16).padStart(2, "0")).join("");
}

/* ---------- tokens dos dois temas ---------- */
function tokens(bloco: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of bloco.match(/--[\w-]+:\s*#[0-9a-fA-F]{3,8}/g) ?? []) {
    const [nome, valor] = m.split(":");
    out[nome.trim()] = valor.trim().slice(0, 7);
  }
  return out;
}
const claro = tokens(css.slice(css.indexOf(":root {"), css.indexOf("}", css.indexOf(":root {"))));
const iEscuro = css.indexOf('[data-theme="dark"] {');
const escuro = { ...claro, ...tokens(css.slice(iEscuro, css.indexOf("}", iEscuro))) };

/**
 * Pares realmente usados na interface. Vêm da auditoria com axe: cada linha
 * corresponde a um seletor concreto do CSS, não a uma combinação hipotética.
 * `tinta` reproduz o color-mix quando o fundo é uma tintura do próprio token.
 */
const PARES: Array<{ onde: string; texto: string; fundo: string; tinta?: number }> = [
  { onde: ".src / .filterbar (texto auxiliar sobre cartão)", texto: "--text-3", fundo: "--surface-2" },
  { onde: ".seal.desc (selo descontinuado)", texto: "--text-3", fundo: "--surface-2" },
  { onde: ".sel .src (auxiliar sobre tinta do acento)", texto: "--text-3", fundo: "--accent-soft" },
  { onde: ".src sobre a superfície do cartão", texto: "--text-3", fundo: "--surface" },
  { onde: ".guiamais (entenda esta página)", texto: "--accent", fundo: "--surface" },
  { onde: ".seal.est / .seal.demo / .qbadge.q-mid / .nivel.nd", texto: "--warning", fundo: "--warning-soft" },
  { onde: ".alert.atencao .lvl", texto: "--warning", fundo: "--surface" },
  { onde: ".alert.informativo .lvl", texto: "--unavail", fundo: "--surface" },
  { onde: ".seal.obs (dado observado)", texto: "--positive", fundo: "--positive-soft" },
  { onde: ".alert.critico .lvl / .seal negativo", texto: "--negative", fundo: "--negative-soft" },
  { onde: ".seal.prev (previsão)", texto: "--accent-ink", fundo: "--accent-soft" },
  { onde: "nav.tabs button.active", texto: "--accent-ink", fundo: "--accent-soft" },
  { onde: ".seal.calc / .nivel.nb (tinta 12% do próprio tom)", texto: "--teal", fundo: "--surface", tinta: 0.12 },
  { onde: ".seal.cen (cenário)", texto: "--forecast", fundo: "--forecast-soft" },
  { onde: "texto principal sobre o cartão", texto: "--text", fundo: "--surface" },
  { onde: "texto secundário sobre o cartão", texto: "--text-2", fundo: "--surface" },
];

const AA = 4.5; // texto normal; a SPA usa 9,5–13 px, então nenhum se qualifica como "grande"

describe.each([["claro", claro], ["escuro", escuro]])("contraste AA — tema %s", (tema, T) => {
  it.each(PARES)("$onde", ({ texto, fundo, tinta }) => {
    const fg = T[texto], base = T[fundo];
    expect(fg, `token ${texto} não encontrado no tema ${tema}`).toBeTruthy();
    expect(base, `token ${fundo} não encontrado no tema ${tema}`).toBeTruthy();
    const bg = tinta ? mistura(fg, base, tinta) : base;
    const r = contraste(fg, bg);
    expect(
      Number(r.toFixed(2)),
      `${texto} (${fg}) sobre ${fundo}${tinta ? ` tinta ${tinta * 100}%` : ""} (${bg}) = ${r.toFixed(2)}:1, mínimo AA ${AA}:1`,
    ).toBeGreaterThanOrEqual(AA);
  });
});

describe("contraste: os tokens de gráfico usados como texto seguem os semânticos", () => {
  it.each([["claro", claro], ["escuro", escuro]])(
    "linha 2 e 3 e cinza acompanham teal, warning e unavail — tema %s",
    (_tema, T: any) => {
      // .comp (Mercado) pinta texto com as cores das séries: se divergirem dos
      // tokens semânticos, o texto reprova sem que ninguém perceba. Foi assim
      // que o cinza do tema escuro sobreviveu à primeira rodada de correções.
      expect(T["--c-line2"]).toBe(T["--teal"]);
      expect(T["--c-line3"]).toBe(T["--warning"]);
      expect(T["--c-gray"]).toBe(T["--unavail"]);
    });

  it.each([["claro", claro], ["escuro", escuro]])(
    "as cores de série passam em AA como texto sobre o cartão — tema %s",
    (_tema, T: any) => {
      for (const t of ["--c-line1", "--c-line2", "--c-line3", "--c-gray", "--c-pos", "--c-neg", "--c-forecast"]) {
        if (!T[t]) continue;
        const r = contraste(T[t], T["--surface"]);
        expect(Number(r.toFixed(2)), `${t} (${T[t]}) sobre --surface = ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA);
      }
    });

  it("o tom do Pix passa em AA sobre a própria tinta", () => {
    const pix = (css.match(/--pix:\s*(#[0-9a-f]{6})/i) ?? [])[1];
    expect(pix).toBeTruthy();
    expect(contraste(pix, mistura(pix, claro["--surface"], 0.12))).toBeGreaterThanOrEqual(AA);
  });
});

describe("estrutura: correções da auditoria que não podem voltar", () => {
  const app = readFileSync(join(process.cwd(), "public/obs/app.js"), "utf-8");
  const html = readFileSync(join(process.cwd(), "public/obs/index.html"), "utf-8");

  it("região rolável recebe foco de teclado (WCAG 2.1.1)", () => {
    expect(app).toContain("function acessibilizaRolagem(");
    const i = app.indexOf("function acessibilizaRolagem(");
    const corpo = app.slice(i, app.indexOf("\n}", i));
    expect(corpo).toContain("scrollWidth");           // só onde rola de fato
    expect(corpo).toContain('setAttribute("tabindex", "0")');
    expect(corpo).toContain("aria-label");
  });

  it("re-render interno também reavalia — não só a troca de página", () => {
    expect(app).toContain("MutationObserver");
    expect(app).toContain("agendaAcessibilidade");
  });

  it("o mapa não se declara imagem única tendo 27 UFs focáveis", () => {
    // role="img" com filhos interativos é interativo aninhado (axe: nested-interactive)
    expect(app).not.toMatch(/class="panmap"[^`]*role="img"/);
    expect((app.match(/class="panmap"[^`]*role="group"/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("clicáveis não nativos continuam alcançáveis por teclado", () => {
    expect(app).toContain("function a11yEnhance(");
    expect(app).toMatch(/e\.key !== "Enter" && e\.key !== " "/);
  });

  it("o documento declara idioma e título", () => {
    expect(html).toMatch(/<html[^>]+lang="pt-BR"/);
    expect(html).toMatch(/<title>/);
  });
});
