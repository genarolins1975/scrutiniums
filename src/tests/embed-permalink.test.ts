/* eslint-disable @typescript-eslint/no-explicit-any -- validação estática da SPA */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Embeds e permalinks por gráfico (último P2 da auditoria: "OWID/FRED têm
 * embed/permalink por gráfico — aqui o compartilhável é a página"). O que se
 * trava: as ações de citação vivem no rodapé metodológico obrigatório; o
 * permalink usa o parâmetro `sec` e faz scroll com destaque; a página de
 * embed é a MESMA SPA sem cromo, recortada na seção citada, sempre com a
 * barra de atribuição e link de volta; e os elementos de cromo ausentes no
 * embed têm null-guard (a página não pode quebrar).
 */
const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf-8");
const app = read("public/obs/app.js");
const embed = read("public/obs/embed.html");

describe("citação no rodapé metodológico", () => {
  it("chartFooter oferece copiar link, Copiar citação e Incorporar, com o alvo na seção ancorada", () => {
    expect(app).toMatch(/grafLink\(this,0\)[^>]*>copiar link<\/a>/);
    expect(app).toMatch(/grafLink\(this,2\)[^>]*>Copiar citação<\/a>/);
    expect(app).toMatch(/grafLink\(this,1\)[^>]*>Incorporar<\/a>/);
    expect(app).toContain('const sec = el.closest("section[id]");');
    expect(app).toContain('u.searchParams.set("sec", sec.id)');
    expect(app).toMatch(/embedSnippet\(`\$\{location\.origin\}\/obs\/embed\.html\?g=/);
    // o código copiado leva crédito e link de volta além do iframe
    expect(app).toMatch(/function embedSnippet\(src, voltar, titulo\)[\s\S]*?<a href="\$\{voltar\}">/);
    // clipboard indisponível não engole a ação
    expect(app).toContain('prompt("Copie manualmente:", texto)');
  });

  it("permalink: parâmetro sec lido no parse e consumido com scroll + destaque", () => {
    expect(app).toContain('if (qs.get("sec")) state._secAlvo = qs.get("sec");');
    expect(app).toMatch(/classList\.add\("sec-alvo"\)/);
    expect(app).toMatch(/renderView\(v\); posRender\(v\);/);
  });
});

describe("página de embed", () => {
  it("mesma SPA sem cromo: __EMBED__ vem do ?g=, corpo .embed, core carregado", () => {
    expect(embed).toContain('window.__EMBED__ = { view: p[0], sec: p.slice(1).join(".") || null };');
    expect(embed).toContain('<body class="embed">');
    expect(embed).toMatch(/app\.min\.js\?v=/);
    expect(embed).toContain('<meta name="robots" content="noindex">');
  });

  it("o boot honra o embed e o recorte preserva só a seção citada + atribuição", () => {
    expect(app).toContain('document.body.classList.add("embed");');
    expect(app).toContain("function embRecorta(v)");
    expect(app).toMatch(/esconde tudo que não é ancestral nem descendente da seção citada/);
    expect(app).toContain('bar.id = "embAttr";');
    expect(app).toMatch(/ver no site →/);
  });

  it("cromo ausente no embed nunca derruba o script (null-guards)", () => {
    // desde a Iniciativa 2 do parecer de UX de 23/10/2026 a aplicação não tem alternador de tema, barra lateral nem botão de menu;
    // a casca da plataforma (navegação, rótulo, fim de página), que o embed não tem, é refeita só quando existe
    expect(app).toContain("if (!C || !ind) return;");
    expect(app).toContain("if (caixa && nav) {");
    expect(app).toContain("if (fim && nav) {");
    expect(app).toContain("if (upd && quando)");
    expect(app).toContain("if (_mainEl) new MutationObserver");
  });
});
