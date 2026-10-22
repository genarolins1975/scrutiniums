/* eslint-disable @typescript-eslint/no-explicit-any -- leitura de fontes e gold sem tipos gerados */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ehRotaPublica } from "@/lib/rotasPublicas";

/**
 * Vitrine pública do Observatório: a porta de entrada editorial. Com o
 * Observatório aberto para leitura, o que precisa ser garantido é que a
 * vitrine e o próprio Observatório estejam fora do middleware, que os
 * números venham do gold real (nunca literais no código) e que a área
 * logada (/app) continue protegida.
 */
const pagina = readFileSync(join(process.cwd(), "src/app/observatorio-do-credito/page.tsx"), "utf-8");
const middleware = readFileSync(join(process.cwd(), "src/middleware.ts"), "utf-8");
const sitemap = readFileSync(join(process.cwd(), "src/app/sitemap.ts"), "utf-8");

describe("vitrine pública do Observatório", () => {
  it("a vitrine é pública; o Observatório e a área logada exigem sessão", () => {
    expect(ehRotaPublica("/observatorio-do-credito")).toBe(true);
    for (const p of ["/observatorio", "/observatorio/overview", "/obs/index.html", "/app", "/app/conta"]) expect(ehRotaPublica(p), p).toBe(false);
    expect(middleware).toContain("if (ehRotaPublica(pathname)) return NextResponse.next();");
    expect(middleware).toMatch(/pathname\.startsWith\("\/app"\)/);
  });

  it("visitante que pede um painel é levado ao login, com o destino (e o recorte) preservado", () => {
    expect(middleware).toMatch(/url\.pathname = "\/entrar"/);
    expect(middleware).toContain("const destino = pathname + request.nextUrl.search;");
    expect(middleware).toMatch(/url\.searchParams\.set\("de", destino\)/);
  });

  it("é estática e indexável", () => {
    expect(pagina).toMatch(/export const dynamic = "force-static"/);
    expect(pagina).toMatch(/alternates: \{ canonical: "\/observatorio-do-credito" \}/);
    expect(pagina).toMatch(/openGraph/);
    expect(sitemap).toMatch(/observatorio-do-credito/);
  });

  it("está acessível a partir do rodapé público", () => {
    expect(readFileSync(join(process.cwd(), "src/components/layout/Footer.tsx"), "utf-8")).toMatch(/href=\{h\("\/observatorio-do-credito"\)\}/);
  });

  it("os números vêm do gold, não são literais no código", () => {
    expect(pagina).toMatch(/lerGold\("panorama"\)/);
    expect(pagina).toMatch(/lerGold\("pix"\)/);
    expect(pagina).toMatch(/lerGold\("judicial"\)/);
    // nenhum número de vitrine escrito à mão
    expect(pagina).not.toMatch(/R\$ 7,59 tri|7,7 bi|53,7 mi/);
  });

  it("cada número exibido declara fonte e data-base", () => {
    // molde único (Iniciativa 4, 22/10/2026): os números da escala são NumeroPorta, com a fonte e o período em campos próprios
    // (antes, uma nota em texto); o período sempre lido da gold, nunca escrito à mão
    const numeros = pagina.match(/out\.push\(\{[\s\S]*?\}\);/g) ?? [];
    expect(numeros.length).toBeGreaterThanOrEqual(4);
    for (const n of numeros) {
      expect(n).toMatch(/fonte: "[^"]+"/);
      expect(n).toMatch(/periodo: ([a-z]|`[^`]*\$\{)/);
    }
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
