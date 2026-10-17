import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { DOMINIOS } from "@/lib/dominios";
import { ABAS_OBSERVATORIOS } from "@/components/observatorios/NavegacaoObservatorios";
import { PublicHeaderView } from "@/components/layout/PublicHeader";

vi.mock("next/navigation", async () => ({
  ...await vi.importActual<typeof import("next/navigation")>("next/navigation"),
  usePathname: () => "/sobre",
}));
vi.mock("next/headers", () => ({ cookies: () => ({ has: () => false }) }));
vi.mock("@/lib/session", () => ({ getSessionUser: vi.fn() }));

/**
 * Cabeçalho móvel da plataforma (etapa 4 de docs/saneamento/ARQUITETURA_2026-10-17.md, achado 4): abaixo de 640 px a lista
 * dos observatórios saía em três linhas no topo de cada página. Ela sai no celular, e os mesmos destinos ficam no seletor de
 * observatório da linha da marca. Estes testes garantem que nenhum cabeçalho perde o caminho para os outros observatórios.
 */
const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, p), "utf-8");

function fontes(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) fontes(p, out);
    else if (n.endsWith(".tsx")) out.push(p);
  }
  return out;
}

/** Trecho do HTML entre a abertura de um elemento com o atributo dado e o fechamento da mesma tag. */
function bloco(html: string, marca: string, fecho: string): string {
  const ini = html.indexOf(marca);
  expect(ini, marca).toBeGreaterThan(-1);
  return html.slice(ini, html.indexOf(fecho, ini));
}

describe("cabeçalho móvel: a lista de observatórios dá lugar ao seletor", () => {
  it("abaixo de 640 px a lista de observatórios sai", () => {
    const css = ler("public/observatorios.css").replace(/\s+/g, "");
    expect(css).toContain("@media(max-width:639px){.obs-dominios{display:none;}}");
  });

  it("todo cabeçalho que mostra a lista de observatórios também tem o seletor de observatório", () => {
    const usam = fontes(join(raiz, "src")).filter((f) => !f.includes("/tests/") && readFileSync(f, "utf-8").includes("<NavegacaoObservatorios"));
    expect(usam.length).toBeGreaterThanOrEqual(6);
    for (const f of usam) expect(readFileSync(f, "utf-8"), f).toContain("<SwitcherObservatorio");
  });

  it("quando o nome Scrutiniums some no celular, o link da marca mantém o alvo de toque de 44 px", () => {
    const usam = fontes(join(raiz, "src")).filter((f) => !f.includes("/tests/") && readFileSync(f, "utf-8").includes("<NavegacaoObservatorios"));
    let conferidos = 0;
    for (const f of usam) {
      const c = readFileSync(f, "utf-8");
      // abertura do link da marca (o que leva à página inicial) e o conteúdo até o fechamento
      for (const m of c.matchAll(/<(Link|a)\b([^>]*página inicial[^>]*)>([\s\S]*?)<\/\1>/g)) {
        if (!/className="hidden[^"]*sm:inline[^"]*"[^>]*>\s*Scrutiniums/.test(m[3])) continue;
        conferidos++;
        expect(m[2], f).toContain("min-w-[44px]");
      }
    }
    // Saneamento, Setor Elétrico, Gás Natural, Eficiência Estatal, Contas Federais e Contas Estaduais
    expect(conferidos).toBeGreaterThanOrEqual(6);
  });

  it("o seletor de observatório lista os oito observatórios do registro", () => {
    expect(ler("src/components/layout/SwitcherObservatorio.tsx")).toContain("DOMINIOS.map");
    expect(DOMINIOS).toHaveLength(8);
  });

  it("na SPA do Crédito, o seletor da barra da marca e o da barra lateral listam os oito observatórios com o nome do registro", () => {
    const spa = ler("public/obs/index.html");
    const trocar = bloco(spa, 'class="obs-trocar"', "</details>");
    const lateral = bloco(spa, 'class="obs-switcher"', "</details>");
    for (const d of DOMINIOS) {
      expect(trocar, d.id).toContain(`<a href="${d.rotaRaiz}"`);
      expect(trocar, d.id).toContain(d.nome);
      expect(lateral, d.id).toContain(`<a href="${d.rotaRaiz}"`);
      expect(lateral, d.id).toContain(d.nome);
    }
    // os dois fecham com Esc, toque fora e perda de foco
    expect(ler("public/obs/app.js")).toContain('["obsSwitcher", "obsTrocar"].forEach');
  });

  it("no cabeçalho público, o seletor do celular tem só os observatórios; Imprensa e Entrar ficam à vista", () => {
    const html = renderToStaticMarkup(createElement(PublicHeaderView, { authenticated: false }));
    const seletor = bloco(html, "<details", "</details>");
    expect(seletor).toContain("Observatórios");
    const destinos = [...seletor.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    expect(destinos).toEqual(ABAS_OBSERVATORIOS.map((a) => `/#obs-${a.id}`));
    expect(seletor).not.toContain("/imprensa");
    const nav = bloco(html, 'aria-label="Navegação principal"', "</nav>");
    expect(nav).toContain('href="/imprensa"');
    expect(nav).toContain('href="/entrar"');
  });
});
