import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ParceriaTecnica } from "@/components/layout/ParceriaTecnica";
import { CERI } from "@/lib/parceiros";
import { ehRotaPublica } from "@/lib/rotasPublicas";

/**
 * Parceria técnica com o FGV CERI (decisão do mantenedor, 20/10/2026): a marca
 * oficial, servida localmente e registrada em manifesto, com link para o site
 * do centro, na página inicial e nos painéis de infraestrutura.
 */
const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, p), "utf-8");
const manifesto = JSON.parse(ler("public/home/parceiros/manifesto.json")) as {
  parceiros: { id: string; url: string; arquivos: { arquivo: string; sha256: string; bytes: number }[] }[];
};
const ceri = manifesto.parceiros.find((p) => p.id === CERI.id)!;

describe("marca do FGV CERI", () => {
  it("os arquivos publicados são os do manifesto (sha256 e bytes) e abrem sem sessão", () => {
    expect(ceri).toBeDefined();
    expect(ceri.url).toBe(CERI.url);
    expect(ceri.arquivos.map((a) => a.arquivo).sort()).toEqual([CERI.arquivo, CERI.arquivoEscuro].sort());
    for (const a of ceri.arquivos) {
      const bytes = readFileSync(join(raiz, "public", a.arquivo));
      expect(bytes.length, a.arquivo).toBe(a.bytes);
      expect(createHash("sha256").update(bytes).digest("hex"), a.arquivo).toBe(a.sha256);
      expect(ehRotaPublica(a.arquivo), `${a.arquivo} precisa carregar nas páginas abertas`).toBe(true);
    }
  });

  it("a pasta responde com a mesma CSP restritiva dos logos de empresas", () => {
    const config = ler("next.config.mjs");
    const regra = (pasta: string) => config.match(new RegExp(`\\{source: "${pasta}/:path\\*", headers: \\[(.*?)\\]\\}`))?.[1];
    expect(regra("/home/parceiros"), "regra de cabeçalhos da pasta de parceiros").toBeDefined();
    expect(regra("/home/parceiros")).toBe(regra("/energia/logos"));
  });

  it("o SVG é só desenho: sem script, evento, conteúdo embutido ou referência externa", () => {
    for (const a of ceri.arquivos) {
      const svg = ler(join("public", a.arquivo));
      expect(svg.startsWith("<svg "), a.arquivo).toBe(true);
      expect(svg, a.arquivo).not.toMatch(/<script|<image|<foreignObject|<use|<a\b|\son\w+=|xlink:href|\bhref=|<!ENTITY|@import/i);
      // url() só para o clip-path interno do próprio arquivo
      for (const m of svg.matchAll(/url\(([^)]*)\)/g)) expect(m[1], a.arquivo).toMatch(/^#clip-\d+$/);
    }
  });
});

describe("componente ParceriaTecnica", () => {
  const html = (variante: "faixa" | "linha" | "bloco" | "compacto", idioma: "pt" | "en" = "pt") =>
    renderToStaticMarkup(createElement(ParceriaTecnica, { variante, idioma }));

  it("sempre liga a marca oficial ao site do centro, em nova aba e com o nome completo no alt", () => {
    for (const v of ["faixa", "linha", "bloco", "compacto"] as const) {
      const h = html(v);
      expect(h, v).toContain(`href="${CERI.url}"`);
      expect(h, v).toContain('target="_blank"');
      expect(h, v).toContain('rel="noopener noreferrer"');
      expect(h, v).toContain(`src="${CERI.arquivo}"`);
      expect(h, v).toContain(`alt="${CERI.nome}, ${CERI.descricao}"`);
      expect(h, v).toContain("Parceria técnica");
      expect(h, v).toContain(`data-parceria="${CERI.id}"`);
      // alvo de toque de 44 px no próprio link, em toda variante
      expect(h, v).toMatch(/<a [^>]*href="https:\/\/ceri\.fgv\.br\/"[^>]*class="[^"]*min-h-\[44px\]/);
    }
  });

  it("segue o idioma da página e o bloco da home diz onde a marca aparece", () => {
    expect(html("faixa", "en")).toContain("Technical partnership");
    expect(html("faixa", "en")).not.toContain("Parceria técnica");
    const bloco = html("bloco");
    for (const nome of ["Setor Elétrico", "Gás Natural", "Saneamento", "Combustíveis"]) expect(bloco).toContain(nome);
  });
});

describe("onde a marca aparece", () => {
  it("na página inicial, no fim da primeira seção, em português nas duas homes (contrato da home inglesa)", () => {
    const home = ler("src/components/home/Home.tsx");
    expect(home).toContain('rodape={<ParceriaTecnica variante="bloco" idioma="pt" />}');
    expect(ler("src/components/home/HeroPerguntas.tsx")).toContain("{rodape}");
  });

  // Iniciativa 2 do parecer de UX de 21/10/2026 (recomendação seguida, decisão pendente do dono): a marca sai das linhas de
  // navegação e vai para o rodapé da coleção, sem deixar de aparecer em todos os painéis de infraestrutura, com e sem sessão.
  // As quatro coleções de infraestrutura já levam a marca no rodapé da coleção; nenhum cabeçalho a leva.
  it("a marca aparece em todos os painéis de infraestrutura, com e sem sessão", () => {
    // o rodapé do Setor Elétrico monta-se sobre o rodapé da coleção, que traz a marca
    expect(ler("src/components/energia/RodapeEnergia.tsx")).toContain('<RodapeColecao\n      colecao="setor-eletrico"');
    for (const f of ["src/app/setor-eletrico/layout.tsx", "src/app/en/setor-eletrico/layout.tsx"]) expect(ler(f), f).toContain("<RodapeEnergia />");
    expect(ler("src/app/aperitivo/conta-de-luz/page.tsx")).toContain('<RodapeColecao colecao="setor-eletrico" />');
    expect(ler("src/app/saneamento/layout.tsx")).toContain('<RodapeColecao colecao="saneamento"');
    expect(ler("src/app/aperitivo/saneamento/page.tsx")).toContain('<RodapeColecao colecao="saneamento" />');
    // rodapé da coleção: no painel do Gás (RodapeGas, no layout), no aperitivo do gás de cozinha e na casca dos Combustíveis
    expect(ler("src/components/gas/RodapeGas.tsx")).toContain('<RodapeColecao colecao="gas"');
    expect(ler("src/app/gas-natural/layout.tsx")).toContain("<RodapeGas />");
    expect(ler("src/app/aperitivo/gas-de-cozinha/layout.tsx")).toContain('<RodapeColecao colecao="gas" />');
    expect(ler("src/app/combustiveis/layout.tsx")).toContain('<RodapeColecao colecao="combustiveis" />');
  });

  it("o rodapé da coleção leva a marca nas quatro coleções de infraestrutura e em nenhuma outra", async () => {
    const { RodapeColecao, COLECOES_COM_PARCERIA } = await import("@/components/layout/RodapeColecao");
    const { idsDasColecoes } = await import("@/lib/observatorios/navegacaoColecao");
    expect([...COLECOES_COM_PARCERIA]).toEqual(["setor-eletrico", "gas", "saneamento", "combustiveis"]);
    for (const id of idsDasColecoes()) {
      const h = renderToStaticMarkup(createElement(RodapeColecao, { colecao: id }));
      expect(h.includes(`data-parceria="${CERI.id}"`), id).toBe((COLECOES_COM_PARCERIA as readonly string[]).includes(id));
    }
  });

  it("na entrada e no mapa do Observatório de Energia e Infraestrutura, e só nele", () => {
    const entrada = ler("src/app/observatorios/[id]/page.tsx");
    expect(entrada).toContain('id === "energia-e-infraestrutura" ? <ParceriaTecnica variante="compacto" />');
    const mapa = ler("src/app/app/(foco)/observatorios/page.tsx");
    expect(mapa).toContain('o.id === "energia-e-infraestrutura" && (');
    expect(mapa.match(/<ParceriaTecnica/g)).toHaveLength(1);
  });

  it("nenhum outro cabeçalho de observatório leva a marca", () => {
    for (const f of [
      "src/app/agronegocio/layout.tsx",
      "src/components/layout/NavegacaoColecao.tsx",
      "src/components/layout/NavegacaoColecaoCliente.tsx",
      "src/components/layout/CabecalhoPlataforma.tsx",
      "src/components/layout/PublicHeader.tsx",
      "src/components/layout/Footer.tsx",
    ]) expect(ler(f), f).not.toContain("ParceriaTecnica");
  });
});
