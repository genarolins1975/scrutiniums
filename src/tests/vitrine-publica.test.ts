/* eslint-disable @typescript-eslint/no-explicit-any -- leitura de fontes e gold sem tipos gerados */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Vitrine pública do Observatório: a porta de entrada editorial. Com o
 * Observatório aberto para leitura, o que precisa ser garantido é que a
 * vitrine e o próprio Observatório estejam fora do middleware, que os
 * números venham do gold real (nunca literais no código) e que a área
 * logada (/app) continue protegida.
 */
const pagina = readFileSync(join(process.cwd(), "src/app/observatorio-do-credito/page.tsx"), "utf-8");
const middleware = readFileSync(join(process.cwd(), "src/middleware.ts"), "utf-8");
const header = readFileSync(join(process.cwd(), "src/components/layout/PublicHeader.tsx"), "utf-8");
const sitemap = readFileSync(join(process.cwd(), "src/app/sitemap.ts"), "utf-8");

describe("vitrine pública do Observatório", () => {
  it("não está protegida pelo middleware — nem ela, nem o Observatório", () => {
    const matcher = middleware.slice(middleware.indexOf("matcher:"));
    expect(matcher).not.toMatch(/observatorio/);
    expect(matcher).not.toMatch(/\/obs/);
    // e o middleware precisa continuar protegendo a área logada
    expect(matcher).toMatch(/\/app\/:path\*/);
    expect(middleware).toMatch(/pathname\.startsWith\("\/app"\)/);
  });

  it("visitante que pede a área logada é levado ao login, com o destino preservado", () => {
    expect(middleware).toMatch(/url\.pathname = "\/entrar"/);
    expect(middleware).toMatch(/url\.searchParams\.set\("de", pathname\)/);
  });

  it("é estática e indexável", () => {
    expect(pagina).toMatch(/export const dynamic = "force-static"/);
    expect(pagina).toMatch(/alternates: \{ canonical: "\/observatorio-do-credito" \}/);
    expect(pagina).toMatch(/openGraph/);
    expect(sitemap).toMatch(/observatorio-do-credito/);
  });

  it("está acessível a partir do cabeçalho público", () => {
    expect(header).toMatch(/observatorio-do-credito/);
  });

  it("os números vêm do gold, não são literais no código", () => {
    expect(pagina).toMatch(/lerGold\("panorama"\)/);
    expect(pagina).toMatch(/lerGold\("pix"\)/);
    expect(pagina).toMatch(/lerGold\("judicial"\)/);
    // nenhum número de vitrine escrito à mão
    expect(pagina).not.toMatch(/R\$ 7,59 tri|7,7 bi|53,7 mi/);
  });

  it("cada número exibido declara fonte e data-base", () => {
    const notas = pagina.match(/nota: `[^`]+`/g) ?? [];
    expect(notas.length).toBeGreaterThanOrEqual(4);
    for (const n of notas) expect(n).toMatch(/\$\{/); // sempre interpolando a data-base real
  });

  it("o gold que alimenta a vitrine existe e está disponível", () => {
    for (const nome of ["panorama", "pix", "judicial", "meta"]) {
      const g = JSON.parse(
        readFileSync(join(process.cwd(), "public/obs/data/gold", `${nome}.json`), "utf-8"),
      );
      if ("disponivel" in g) expect(g.disponivel, nome).toBe(true);
    }
  });

  it("o link de login valida o destino contra redirecionamento aberto", () => {
    const comp = readFileSync(
      join(process.cwd(), "src/components/home/LinkEntrarComDestino.tsx"), "utf-8");
    expect(comp).toMatch(/startsWith\("\/observatorio"\)/);
    expect(comp).toMatch(/!de\.startsWith\("\/\/"\)/);
  });
});
