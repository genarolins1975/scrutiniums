import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ObservatorioPublicoPage from "@/app/observatorio-do-credito/page";
import { SecaoRecursos } from "@/components/home/SecaoRecursos";
import { ehRotaPublica } from "@/lib/rotasPublicas";

// o selo "com conta" (SeloComConta) lê o endereço da página: aqui, a página aberta do Crédito
vi.mock("next/navigation", async () => ({
  ...(await vi.importActual<typeof import("next/navigation")>("next/navigation")),
  usePathname: () => "/observatorio-do-credito",
}));

/**
 * Banca de 19/10/2026 (achado A6): página aberta não anuncia como público um
 * recurso que exige conta. Destino fechado aparece com o selo "com conta".
 */
const PROMESSAS = ["RSS público", "API pública", "Indicadores abertos", "metodologia aberta", "12 fontes oficiais"];

function linksFechadosSemSelo(html: string, excecoes: string[]): string[] {
  return [...html.matchAll(/<a [^>]*href="(\/[^"#?]*)[^"]*"[^>]*>([\s\S]*?)<\/a>/g)]
    .filter(([, href]) => !ehRotaPublica(href) && !excecoes.includes(href))
    .filter(([, , corpo]) => !/com conta/.test(corpo))
    .map(([, href]) => href);
}

describe("promessas da camada aberta", () => {
  it("a página aberta do Crédito marca cada destino fechado e não promete abertura", () => {
    const html = renderToStaticMarkup(createElement(ObservatorioPublicoPage));
    for (const p of PROMESSAS) expect(html, p).not.toContain(p);
    // Só o corpo da página: cabeçalho e rodapé são navegação comum a todas as páginas.
    const corpo = html.slice(html.indexOf("<main"), html.indexOf("</main>"));
    expect(corpo.length).toBeGreaterThan(1000);
    // O botão principal leva ao Observatório pelo login, com o destino guardado.
    expect(linksFechadosSemSelo(corpo, ["/observatorio"])).toEqual([]);
  });

  it("a seção de recursos da home não chama de público o que exige conta", () => {
    const html = renderToStaticMarkup(createElement(SecaoRecursos));
    for (const p of PROMESSAS) expect(html, p).not.toContain(p);
    expect(linksFechadosSemSelo(html, [])).toEqual([]);
  });
});
