import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { urlComNivel } from "@/components/evidencia/ModoProfundidade";
import { COR_CATEGORIA } from "@/lib/energia/geracao";
import { criarIndiceBusca, termosBusca, type ColunaTabela } from "@/lib/energia/tabela";

/**
 * Revisão adversarial 2, lente de interface (achados I01 a I19): regressões do que foi corrigido.
 * O que depende de navegador (hidratação, impressão, alto contraste, histórico) foi conferido em Chromium e está
 * registrado em docs/observatorios/energia/avaliacao/revisao_mercado_geracao_visao.json; aqui ficam as regras que
 * a leitura do código e a renderização no servidor provam.
 */
const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf-8");
/** Todos os grupos 1 de uma expressão global (sem matchAll, que o alvo de compilação do projeto não aceita). */
function capturas(re: RegExp, texto: string): string[] {
  const out: string[] = [];
  const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);
  let m: RegExpExecArray | null;
  while ((m = g.exec(texto)) !== null) out.push(m[1]);
  return out;
}
const CSS = ler("src/app/globals.css");

const DADOS = [
  { m: "2026-07", a: 30.1 },
  { m: "2026-08", a: 31.4 },
  { m: "2026-09", a: 33.9 },
];
const grafico = (titulo: string, unidade: string) =>
  renderToStaticMarkup(createElement(GraficoLinhas, { titulo, dados: DADOS, chaveX: "m", formatoX: "mes", series: [{ id: "a", rotulo: "A", cor: "#256abf" }], unidade }));
const tituloDe = (html: string) => /data-titulo-grafico="true">([\s\S]*?)<\/p>/.exec(html)?.[1] ?? "";

describe("I08: gráfico de linhas diz a unidade de um caractere no eixo, sem repetir no título", () => {
  const rotulosDoEixo = (html: string) => capturas(/<text[^>]*text-anchor="end"[^>]*>(.*?)<\/text>/, html).map((r) => r.replace(/<[^>]+>/g, ""));
  it("percentual: cada rótulo do eixo vertical termina em ' %' e o título não ganha 'em %'", () => {
    const html = grafico("Participação do livre, mês a mês", "%");
    const eixo = rotulosDoEixo(html);
    expect(eixo.length).toBeGreaterThan(1);
    expect(eixo.every((r) => / %$/.test(r))).toBe(true);
    expect(tituloDe(html)).not.toContain(", em %");
  });
  it("horas: o eixo diz ' h'", () => {
    expect(rotulosDoEixo(grafico("DEC por ano", "h")).every((r) => / h$/.test(r))).toBe(true);
  });
  it("unidade longa continua no título e fora dos rótulos do eixo", () => {
    const html = grafico("Geração média mensal", "MWmed");
    expect(tituloDe(html)).toContain(", em MWmed");
    expect(rotulosDoEixo(html).some((r) => /MWmed/.test(r))).toBe(false);
  });
});

describe("I07: a coluna de rótulo da linha entra na busca", () => {
  const colunas: ColunaTabela[] = [
    { id: "m", rotulo: "Mês", tipo: "data" },
    { id: "v", rotulo: "Valor", tipo: "numero" },
    { id: "u", rotulo: "UF", tipo: "texto" },
  ];
  const linha = { m: "2026-09", v: 12, u: "SP" };
  const acha = (indice: (l: typeof linha) => string, busca: string) => termosBusca(busca).every((t) => indice(linha).includes(t));

  it("com colunaRotulo, o texto exibido (09/2026) e o ISO achados", () => {
    const indice = criarIndiceBusca(colunas, "m");
    expect(acha(indice, "09/2026")).toBe(true);
    expect(acha(indice, "2026-09")).toBe(true);
    expect(acha(indice, "sp")).toBe(true);
  });
  it("sem colunaRotulo o comportamento antigo vale: data e número só com buscavel: true", () => {
    const indice = criarIndiceBusca(colunas);
    expect(acha(indice, "09/2026")).toBe(false);
    expect(acha(indice, "12")).toBe(false);
  });
  it("coluna numérica que não é rótulo continua fora da busca", () => {
    expect(acha(criarIndiceBusca(colunas, "m"), "12")).toBe(false);
  });
});

describe("I09: séries claras da Geração têm 3:1 contra o fundo (WCAG 1.4.11)", () => {
  const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const lum = (c: number[]) => {
    const [r, g, b] = c.map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrasteContraBranco = (c: number[]) => 1.05 / (lum(c) + 0.05);
  // a mistura é "color-mix(in srgb, <token> 75%, #000)": cada canal vale 75% do token
  const tokens = { "--serie-solar": "#c98500", "--serie-termica": "#d95926" };

  for (const [cat, token] of [["solar_mmgd", "--serie-solar"], ["termica_sem_combustivel", "--serie-termica"]] as const) {
    it(`${cat} usa o tom escuro da série de origem e passa de 3:1`, () => {
      const cor = COR_CATEGORIA[cat];
      expect(cor).toBe(`color-mix(in srgb, var(${token}) 75%, #000)`);
      const base = rgb(tokens[token]);
      expect(contrasteContraBranco(base.map((v) => Math.round(v * 0.75)))).toBeGreaterThan(3);
    });
  }
});

describe("I06 e D050: o nível escolhido acompanha o link interno", () => {
  const aqui = { origin: "https://exemplo.test", pathname: "/setor-eletrico/mercado", search: "?modo=auditar" };
  it("aba do módulo e 'Abrir o painel' levam o ?modo=", () => {
    expect(urlComNivel("/setor-eletrico/mercado/agentes", aqui)).toBe("/setor-eletrico/mercado/agentes?modo=auditar");
    expect(urlComNivel("https://exemplo.test/setor-eletrico/geracao#p021", { ...aqui, search: "?modo=analisar" })).toBe("/setor-eletrico/geracao?modo=analisar#p021");
  });
  it("preserva os outros parâmetros do destino", () => {
    expect(urlComNivel("/setor-eletrico/mercado/encargos?f=ess", aqui)).toBe("/setor-eletrico/mercado/encargos?f=ess&modo=auditar");
  });
  it("não leva o nível a quem não tem seletor, a outra origem, à mesma página ou a link com ?modo= próprio", () => {
    expect(urlComNivel("/setor-eletrico/aprenda/gsf", aqui)).toBeNull();
    expect(urlComNivel("/setor-eletrico", aqui)).toBeNull();
    expect(urlComNivel("/pld", aqui)).toBeNull();
    expect(urlComNivel("https://outro.test/setor-eletrico/geracao", aqui)).toBeNull();
    expect(urlComNivel("/setor-eletrico/mercado#livre", aqui)).toBeNull();
    expect(urlComNivel("/setor-eletrico/geracao?modo=entender", aqui)).toBeNull();
  });
  it("em Entender (sem ?modo=) nada muda", () => {
    expect(urlComNivel("/setor-eletrico/mercado/agentes", { ...aqui, search: "" })).toBeNull();
    expect(urlComNivel("/setor-eletrico/mercado/agentes", { ...aqui, search: "?modo=invalido" })).toBeNull();
  });
  it("clique e seta do teclado criam entrada no histórico: o Voltar desfaz a troca (I17 rejeitado, r6 mediu a regressão)", () => {
    const t = ler("src/components/evidencia/ModoProfundidade.tsx");
    expect(t).toContain("escolher(MODOS[j].id);");
    expect(t).not.toContain("escolher(MODOS[j].id, false)");
    expect(t).toContain("onClick={() => escolher(m.id)}");
    expect(t).toMatch(/function escolher\(m: Modo\) \{\s*setModo\(m\);\s*gravaUrl\(m, true\);/);
  });
});

describe("I01 a I04: recorte dos gráficos e tabelas na URL", () => {
  it("os sete gráficos com período ou série ligável têm chaveUrl", () => {
    const esperado: [string, string][] = [
      ["src/app/setor-eletrico/mercado/page.tsx", 'chaveUrl="liv"'],
      ["src/app/setor-eletrico/mercado/agentes/page.tsx", 'chaveUrl="ulv"'],
      ["src/app/setor-eletrico/geracao/capacidade/page.tsx", 'chaveUrl="fcm"'],
      ["src/app/setor-eletrico/geracao/capacidade/page.tsx", 'chaveUrl="pot"'],
      ["src/app/setor-eletrico/geracao/termica/page.tsx", 'chaveUrl="cvu"'],
      // as séries diária e horária do SIN são lidas sob demanda: o gráfico mora em GeracaoSerieRecente, que escolhe a chave pelo tipo
      ["src/components/energia/GeracaoSerieRecente.tsx", 'tipo === "diaria" ? "dia" : "hor"'],
      ["src/components/energia/GeracaoSerieRecente.tsx", "chaveUrl={chaveUrl}"],
      ["src/app/setor-eletrico/geracao/page.tsx", '<GeracaoSerieRecente tipo="diaria"'],
      ["src/app/setor-eletrico/geracao/page.tsx", '<GeracaoSerieRecente tipo="horaria"'],
      ["src/app/setor-eletrico/geracao/page.tsx", 'chaveUrl="dzg"'],
    ];
    for (const [f, trecho] of esperado) expect(ler(f), `${f}: ${trecho}`).toContain(trecho);
  });
  it("todo GraficoLinhas com zoom ou legenda interativa nas páginas de Mercado e Geração tem chaveUrl ou é controlado", () => {
    const arquivos = [
      "src/app/setor-eletrico/mercado/page.tsx",
      "src/app/setor-eletrico/mercado/agentes/page.tsx",
      "src/app/setor-eletrico/mercado/encargos/page.tsx",
      "src/app/setor-eletrico/mercado/mre-e-gsf/page.tsx",
      "src/app/setor-eletrico/geracao/page.tsx",
      "src/components/energia/GeracaoSerieRecente.tsx",
      "src/components/energia/GeracaoMatriz.tsx",
      "src/app/setor-eletrico/geracao/capacidade/page.tsx",
      "src/app/setor-eletrico/geracao/termica/page.tsx",
    ];
    for (const f of arquivos) {
      for (const corpo of capturas(/<GraficoLinhas\b([\s\S]*?)\/>/, ler(f))) {
        if (/\bzoom\b|legendaInterativa/.test(corpo)) expect(corpo, `${f}: ${corpo.slice(0, 80)}`).toMatch(/chaveUrl=|onIntervalo|onOcultas/);
      }
    }
  });
  it("GraficoLinhas grava intervalo e séries ocultas na URL só com chaveUrl e sem controle externo", () => {
    const t = ler("src/components/energia/GraficoLinhas.tsx");
    expect(t).toContain("`${chaveUrl}.de`");
    expect(t).toContain("`${chaveUrl}.ate`");
    expect(t).toContain("`${chaveUrl}.oc`");
    expect(t).toMatch(/ocultasControladas \?\? \(usaUrl \? vUrl\.oc : ocultasInternas\)/);
  });
  it("as sete tabelas que não gravavam busca, filtro, ordem e página agora gravam", () => {
    const esperado: [string, string][] = [
      ["src/app/setor-eletrico/mercado/agentes/page.tsx", 'chaveUrl="perf"'],
      ["src/app/setor-eletrico/geracao/capacidade/page.tsx", 'chaveUrl="fxm"'],
      ["src/app/setor-eletrico/geracao/restricoes/page.tsx", "chaveUrl={`det-${f}`}"],
      ["src/components/energia/GeracaoRestricoes.tsx", 'chaveUrl="um"'],
      ["src/components/energia/GeracaoRestricoes.tsx", 'chaveUrl="rz"'],
      ["src/components/energia/GeracaoRestricoes.tsx", 'chaveUrl="ss"'],
      ["src/components/energia/GeracaoRestricoes.tsx", 'chaveUrl="ds"'],
    ];
    for (const [f, trecho] of esperado) expect(ler(f), `${f}: ${trecho}`).toContain(trecho);
  });
});

describe("I10, I11, I12, I13, I15, I16: regras de CSS e impressão", () => {
  it("antes da hidratação, com JavaScript ligado, vale Entender; sem JavaScript tudo continua à vista", () => {
    expect(CSS).toMatch(/@media \(scripting: enabled\)\s*\{[^}]*\.modo-profundidade\[data-modo="todos"\] \[data-nivel="analisar"\]/);
    // a regra de "todos" só existe dentro da consulta de scripting
    const fora = CSS.replace(/@media \(scripting: enabled\)\s*\{[\s\S]*?\n\}\n/, "");
    expect(fora).not.toContain('[data-modo="todos"]');
  });
  it("a barra fixa de profundidade não cobre o foco: scroll-padding-top", () => {
    expect(CSS).toMatch(/html:has\(\.modo-profundidade\)\s*\{\s*scroll-padding-top:\s*4\.5rem/);
  });
  it("alto contraste: o selecionado ganha cor de sistema, borda grossa e sublinhado", () => {
    const bloco = /@media \(forced-colors: active\)\s*\{([\s\S]*?)\n\}/.exec(CSS)?.[1] ?? "";
    for (const trecho of ['[role="radio"][aria-checked="true"]', 'button[aria-pressed="true"]', "label:has(> input:checked)", "Highlight", "text-decoration: underline"]) {
      expect(bloco, trecho).toContain(trecho);
    }
  });
  it("impressão: tabela na largura da página, controles fora e endereço dos links internos", () => {
    const bloco = /@media print\s*\{([\s\S]*?)\n\}/.exec(CSS)?.[1] ?? "";
    for (const trecho of [
      "main .tabela-scroll { overflow: visible !important",
      "white-space: normal !important",
      '.modo-profundidade > .sticky',
      "[data-controles=\"intervalo\"]",
      'main a[href^="/"]:not(nav a)::after',
      'nav[aria-label^="Paginação"] :is(button, label)',
    ]) {
      expect(bloco, trecho).toContain(trecho);
    }
  });
  it("os detalhes recolhidos abrem ao imprimir em toda página com profundidade", () => {
    expect(ler("src/components/evidencia/ModoProfundidade.tsx")).toContain("<AbreDetalhesAoImprimir />");
  });
});

describe("I18 e I19: títulos e anúncios", () => {
  it("a Visão geral não salta de h2 para h4", () => {
    for (const f of ["VisaoDeterminantes", "VisaoSociedade", "VisaoObservar"]) expect(ler(`src/components/energia/${f}.tsx`), f).not.toContain("<h4");
  });
  it("as duas tabelas de detalhamento por usina de Restrições têm nomes diferentes", () => {
    expect(ler("src/app/setor-eletrico/geracao/restricoes/page.tsx")).toContain("contra o arquivo principal, ${NOME_FONTE_RESTRICAO[f].toLowerCase()}");
  });
  it("trocar linhas por página e exportar sem linhas são anunciados", () => {
    const t = ler("src/components/energia/TabelaInterativa.tsx");
    expect(t).toContain("linhas por página:");
    expect(t).toContain("Nenhuma linha para exportar");
  });
});
