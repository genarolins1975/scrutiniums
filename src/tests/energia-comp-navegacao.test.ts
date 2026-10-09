import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import {
  DESTINOS_NAVEGACAO,
  GRUPOS_NAVEGACAO,
  MODULOS_ENERGIA,
  destino,
  listaPorExtenso,
  menuNavegacao,
  type GrupoNavegacao,
} from "@/lib/energia/navegacao";

/**
 * Navegação em seis grupos (seção 5.1 da especificação). O que este teste protege:
 *
 *  1. o menu nunca leva a uma página que não existe, e uma página nova do domínio
 *     não fica fora do menu: `publicado` concorda com o page.tsx nos dois sentidos;
 *  2. todo destino do quadro da seção 6.2 C está no registro, com o nome do quadro
 *     no rótulo (o visitante acha o tema social sem saber a sigla) e uma pergunta
 *     própria, sem descrição genérica repetida;
 *  3. os grupos seguem a seção 5.1: nomes, ordem e quem fica em cada um;
 *  4. os módulos que o mapa, o sitemap e as páginas já leem continuam iguais;
 *  5. o HTML do servidor: todo destino publicado é link, nenhum destino sem página
 *     é link mas continua nomeado, aria-current só na página atual, faixa do grupo
 *     ativo com o id que AtivoVisivel procura.
 */
const raiz = process.cwd();
const pagina = (href: string) => join(raiz, "src", "app", "setor-eletrico", href.replace(/^\/setor-eletrico\/?/, ""), "page.tsx");

// Quadro da seção 6.2 C: nome do destino como o visitante o procura.
const QUADRO_6_2_C: Record<string, string> = {
  "visao-geral": "Visão geral",
  "agua-e-clima": "Água e clima",
  geracao: "Geração",
  carga: "Carga",
  rede: "Rede",
  pld: "PLD",
  "pld-modelos": "Previsões e modelos",
  mercado: "Mercado",
  "conta-de-luz": "Conta de luz",
  perdas: "Perdas",
  qualidade: "Qualidade",
  "inclusao-energetica": "Inclusão energética",
  empresas: "Empresas",
  expansao: "Expansão",
  transicao: "Transição e ambiente",
  regulacao: "Regulação",
  aprenda: "Aprenda",
  dados: "Dados",
  metodologia: "Metodologia",
};

// Seção 5.1: grupos, na ordem, e o que cada um reúne.
const SECAO_5_1: [string, string[]][] = [
  ["Comece aqui", ["mapa", "visao-geral", "territorio"]],
  ["Operação do sistema", ["agua-e-clima", "geracao", "carga", "rede"]],
  ["Preços e mercado", ["pld", "pld-modelos", "mercado"]],
  ["Consumidor e território", ["conta-de-luz", "perdas", "qualidade", "inclusao-energetica"]],
  ["Empresas e futuro", ["empresas", "expansao", "transicao"]],
  ["Conhecimento e evidência", ["regulacao", "aprenda", "dados", "metodologia"]],
];

describe("registro de destinos", () => {
  it("todo href publicado corresponde a um page.tsx existente", () => {
    for (const d of DESTINOS_NAVEGACAO.filter((x) => x.publicado)) {
      expect(existsSync(pagina(d.href)), `${d.slug}: ${d.href}`).toBe(true);
    }
  });

  it("destino não publicado não tem página; se a página passou a existir, o menu precisa publicá-lo", () => {
    for (const d of DESTINOS_NAVEGACAO.filter((x) => !x.publicado)) {
      expect(existsSync(pagina(d.href)), `${d.href} existe: marque publicado: true em src/lib/energia/navegacao.ts`).toBe(false);
    }
  });

  it("nenhum destino duplicado, e todo href é uma rota limpa do domínio", () => {
    const slugs = DESTINOS_NAVEGACAO.map((d) => d.slug);
    const hrefs = DESTINOS_NAVEGACAO.map((d) => d.href);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const h of hrefs) expect(h, h).toMatch(/^\/setor-eletrico(\/[a-z0-9-]+)*$/);
  });

  it("os seis grupos seguem a seção 5.1, nenhum vazio, e todo destino está em exatamente um grupo", () => {
    expect(GRUPOS_NAVEGACAO.map((g) => g.rotulo)).toEqual(SECAO_5_1.map(([r]) => r));
    expect(GRUPOS_NAVEGACAO.map((g) => g.n)).toEqual([1, 2, 3, 4, 5, 6]);
    GRUPOS_NAVEGACAO.forEach((g, i) => {
      expect(g.destinos.length, g.rotulo).toBeGreaterThan(0);
      expect(g.destinos.map((d) => d.slug), g.rotulo).toEqual(SECAO_5_1[i][1]);
      for (const d of g.destinos) expect(d.grupo, d.slug).toBe(g.id);
    });
    const nosGrupos = GRUPOS_NAVEGACAO.flatMap((g) => g.destinos.map((d) => d.slug));
    expect([...nosGrupos].sort()).toEqual(DESTINOS_NAVEGACAO.map((d) => d.slug).sort());
  });

  it("todo destino do quadro 6.2 C está no registro, publicado ou não, com o nome do quadro no rótulo", () => {
    for (const [slug, nome] of Object.entries(QUADRO_6_2_C)) {
      const d = DESTINOS_NAVEGACAO.find((x) => x.slug === slug);
      expect(d, slug).toBeTruthy();
      expect(d!.rotulo.toLowerCase(), slug).toContain(nome.toLowerCase());
    }
  });

  it("cada destino tem pergunta e resumo próprios, sem texto repetido entre destinos", () => {
    for (const d of DESTINOS_NAVEGACAO) {
      expect(d.pergunta, d.slug).toMatch(/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ].{10,}\?$/);
      expect(d.resumo.length, d.slug).toBeGreaterThan(20);
      expect(`${d.rotulo} ${d.pergunta} ${d.resumo}`, d.slug).not.toContain("—");
    }
    expect(new Set(DESTINOS_NAVEGACAO.map((d) => d.pergunta)).size).toBe(DESTINOS_NAVEGACAO.length);
    expect(new Set(DESTINOS_NAVEGACAO.map((d) => d.resumo)).size).toBe(DESTINOS_NAVEGACAO.length);
  });

  it("os módulos já lidos pelo mapa, pelo sitemap e pelas páginas continuam compatíveis", () => {
    expect(MODULOS_ENERGIA[0]).toMatchObject({ slug: "mapa", href: "/setor-eletrico" });
    for (const m of MODULOS_ENERGIA) {
      const d = destino(m.slug);
      expect(d.href, m.slug).toBe(m.href);
      expect(d.integrado, m.slug).toBe(m.integrado);
      expect(d.publicado, m.slug).toBe(true);
      expect(m.secao, m.slug).toBe(`energia:${m.slug}`);
    }
    expect(() => destino("nao-existe")).toThrow();
  });
});

describe("estrutura do menu", () => {
  it("destino sem página nunca vira link, mas continua nomeado no grupo", () => {
    const { itens } = menuNavegacao("geracao");
    for (const item of itens) {
      for (const d of item.links) expect(d.publicado, d.slug).toBe(true);
      for (const d of item.emPreparacao) expect(d.publicado, d.slug).toBe(false);
      expect(item.links.length + item.emPreparacao.length, item.grupo.rotulo).toBe(item.grupo.destinos.length);
    }
  });

  it("quando um tema social é publicado, ele vira link direto do seu grupo, sem outro nível de menu", () => {
    const comPerdas: GrupoNavegacao[] = GRUPOS_NAVEGACAO.map((g) => ({
      ...g,
      destinos: g.destinos.map((d) => (d.slug === "perdas" ? { ...d, publicado: true } : d)),
    }));
    const consumidor = menuNavegacao("perdas", comPerdas).itens.find((i) => i.grupo.id === "consumidor-e-territorio")!;
    expect(consumidor.links.map((d) => d.slug)).toContain("perdas");
    expect(consumidor.emPreparacao.map((d) => d.slug)).not.toContain("perdas");
    expect(consumidor.ativo).toBe(true);
  });

  it("o grupo ativo é o do destino atual; as páginas de modelos e previsões (atual 'pld') ficam em preços", () => {
    expect(menuNavegacao("pld").grupoAtual?.grupo.id).toBe("precos-e-mercado");
    expect(menuNavegacao("metodologia").grupoAtual?.grupo.id).toBe("conhecimento-e-evidencia");
    expect(menuNavegacao("mapa").grupoAtual?.grupo.id).toBe("comece-aqui");
    expect(menuNavegacao("pagina-inexistente").grupoAtual).toBeNull();
    expect(menuNavegacao("geracao").itens.filter((i) => i.ativo)).toHaveLength(1);
  });

  it("enumera em português, com 'e' antes do último item", () => {
    expect(listaPorExtenso([])).toBe("");
    expect(listaPorExtenso(["Perdas"])).toBe("Perdas");
    expect(listaPorExtenso(["Conta de luz", "Perdas"])).toBe("Conta de luz e Perdas");
    expect(listaPorExtenso(["a", "b", "c"])).toBe("a, b e c");
  });
});

describe("cabeçalho renderizado no servidor", () => {
  const html = (atual: string) => renderToStaticMarkup(createElement(CabecalhoEnergia, { atual }));
  const ancoras = (h: string) => Array.from(h.matchAll(/<a\b[^>]*>/g)).map((m) => m[0]);
  const hrefDe = (tag: string) => tag.match(/\bhref="([^"]*)"/)?.[1] ?? null;
  const faixa = (h: string) => {
    const i = h.indexOf('id="modulos-energia"');
    return i < 0 ? "" : h.slice(h.lastIndexOf("<ul", i), h.indexOf("</ul>", i));
  };

  it("todo destino publicado é link, e nenhum destino sem página é link, mas o tema continua nomeado", () => {
    const h = html("geracao");
    const hrefs = ancoras(h).map(hrefDe);
    for (const d of DESTINOS_NAVEGACAO) {
      if (d.publicado) expect(hrefs, d.href).toContain(d.href);
      else {
        expect(hrefs, d.href).not.toContain(d.href);
        expect(h, d.rotulo).toContain(d.rotulo);
      }
    }
    // o aviso só existe enquanto houver destino sem página; com todos publicados, não pode sobrar
    if (DESTINOS_NAVEGACAO.some((d) => !d.publicado)) expect(h).toContain("Em preparação, ainda sem página:");
    else expect(h).not.toContain("Em preparação, ainda sem página:");
  });

  it("nav nomeada, seis grupos como disclosure e o botão Menu", () => {
    const h = html("geracao");
    expect(h).toMatch(/<nav[^>]*aria-label="Navegação do Observatório do Setor Elétrico"/);
    for (const g of GRUPOS_NAVEGACAO) expect(h, g.rotulo).toMatch(new RegExp(`<summary[^>]*>${g.rotulo}`));
    expect(h).toMatch(/<summary[^>]*>Menu/);
    // só o grupo da página atual é anunciado como tal
    expect(h.match(/\(grupo da página atual\)/g)).toHaveLength(1);
    expect(h).toMatch(/<summary[^>]*>Operação do sistema<span class="sr-only"> \(grupo da página atual\)/);
  });

  it("aria-current só nos links da página atual; a faixa do grupo ativo traz os irmãos e o id de AtivoVisivel", () => {
    for (const atual of ["geracao", "metodologia", "mapa"]) {
      const h = html(atual);
      const atuais = ancoras(h).filter((a) => a.includes('aria-current="page"'));
      expect(atuais.length, atual).toBeGreaterThan(0);
      for (const a of atuais) expect(hrefDe(a), atual).toBe(destino(atual).href);
      const f = faixa(h);
      const grupo = menuNavegacao(atual).grupoAtual!;
      expect(f, atual).toContain(`aria-label="Páginas do grupo ${grupo.grupo.rotulo}"`);
      expect(ancoras(f).map(hrefDe), atual).toEqual(grupo.links.map((d) => d.href));
      expect(ancoras(f).filter((a) => a.includes('aria-current="page"')), atual).toHaveLength(1);
    }
  });

  it("nas páginas do PLD a faixa mostra previsões e o mercado, já integrado (sem a marca de módulo em integração)", () => {
    const f = faixa(html("pld"));
    expect(ancoras(f).map(hrefDe)).toEqual(["/setor-eletrico/pld", "/setor-eletrico/pld/modelos", "/setor-eletrico/mercado"]);
    expect(f).not.toContain("(em integração)");
  });

  it("página fora do registro: sem faixa e sem aria-current, mas com o menu completo", () => {
    const h = html("pagina-inexistente");
    expect(faixa(h)).toBe("");
    expect(h).not.toContain('aria-current="page"');
    expect(h).toMatch(/<summary[^>]*>Menu/);
  });
});
