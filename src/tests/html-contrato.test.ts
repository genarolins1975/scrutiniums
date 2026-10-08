import { describe, expect, it } from "vitest";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LiteralFonte } from "@/components/LiteralFonte";
import { TextoComDatas } from "@/components/TextoComDatas";
import { LITERAIS } from "@/lib/literais-fonte";
import { analisaHtml, coberturaDoBuild } from "./support/html-contrato";

/**
 * Contrato do HTML gerado, exercitado com fixtures sintéticas (nunca publicadas): o que o gate
 * aceita (prosa formatada, atributos de máquina, literais registrados) e o que reprova (data crua
 * em prosa, literal sem contrato, contêiner amplo, exceção por tag genérica).
 */
const ORIGEM = "https://dados.exemplo.gov.br/recurso";
const pagina = (corpo: string) => `<!doctype html><html><head><title>Página de teste</title></head><body><main>${corpo}</main></body></html>`;
const roda = (corpo: string) => analisaHtml(pagina(corpo), "/teste");
const regras = (corpo: string) => roda(corpo).violacoes.map((v) => v.regra);
const lit = (classe: string, valor: string, origem = ORIGEM, extra = "") =>
  `<span data-literal-fonte="${classe}" data-origem="${origem}"><span data-literal-rotulo="">${rotulo(classe)}</span> <code data-literal-valor="">${valor}</code>${extra}</span>`;
const rotulo = (classe: string) => {
  const def = (LITERAIS as Record<string, { papel: string; fonteCurta: string }>)[classe];
  const nome = { citacao: "Trecho da fonte", valor: "Valor na fonte", registro: "Registro composto pelo observatório", identificador: "Identificador gerado pelo observatório" }[def.papel];
  return `${nome} · ${def.fonteCurta}`;
};

describe("prosa formatada e dados de máquina", () => {
  it("competência, data civil e instante em prosa, formatados, passam; o original fica em <time datetime>", () => {
    const html = renderToStaticMarkup(h("p", null, h(TextoComDatas, { texto: "Competência 2026-06, dia 2025-12-31, instante 2026-09-30T00:00Z." })));
    expect(html).toContain('<time dateTime="2026-09-30T00:00Z">30/09/2026 às 00h00 UTC</time>');
    expect(html).toContain("junho de 2026");
    expect(roda(html).violacoes).toEqual([]);
  });

  it("data ISO em atributo de máquina é livre; em rótulo acessível não", () => {
    expect(regras('<time datetime="2026-09-30T00:00Z">30/09/2026</time><a href="/x/2026-09-30.csv" data-id="2026-09-30|X" id="d2026-09">Baixar</a>')).toEqual([]);
    expect(regras('<button aria-label="Série de 2026-09-30">Abrir</button>')).toEqual(["data-iso-em-prosa"]);
  });

  it("URL, identificador e nome de arquivo em prosa, com data, não reprovam", () => {
    expect(regras("<p>Veja https://x.gov.br/a/2024-04-01.csv, o arquivo Despacho_2025-02-29.xlsx e a chave ref@2026-09-30.</p>")).toEqual([]);
  });

  it("script e style não contam como prosa", () => {
    expect(regras('<script>{"d":"2026-09-30T00:00Z"}</script><style>/* 2026-09 */</style><p>ok</p>')).toEqual([]);
  });
});

describe("data crua e valores quebrados em prosa", () => {
  it("data, competência e instante crus reprovam", () => {
    expect(regras("<p>em 2026-09-30</p>")).toEqual(["data-iso-em-prosa"]);
    expect(regras("<p>competência 2026-06 fechada</p>")).toEqual(["data-iso-em-prosa"]);
    expect(regras("<p>emitida em 2026-09-30T00:00Z</p>")).toEqual(["data-iso-em-prosa"]);
  });

  it("data inexistente em prosa não passa por ser inválida", () => {
    expect(roda("<p>valor de 2021-02-29</p>").violacoes[0]).toMatchObject({ regra: "data-iso-em-prosa", detalhe: expect.stringContaining("inválida") });
  });

  it("data partida por interpolação no mesmo elemento é encontrada", () => {
    expect(regras("<p>mês 2026<!-- -->-<!-- -->09 aberto</p>")).toEqual(["data-iso-em-prosa"]);
  });

  it("undefined e NaN reprovam em prosa", () => {
    expect(regras("<p>valor undefined</p>")).toEqual(["undefined-nan"]);
    expect(regras("<p>NaN%</p>")).toEqual(["undefined-nan"]);
  });
});

describe("literais com contrato", () => {
  it("data inexistente da fonte, como literal registrado, é aceita e a linha explica o motivo", () => {
    const a = roda(`<table><tr><th>${lit("data-planilha-inexistente", "2021-02-29")}</th><td>data inexistente no calendário</td></tr></table>`);
    expect(a.violacoes).toEqual([]);
    expect(a.literais).toEqual([{ rota: "/teste", classe: "data-planilha-inexistente", origem: ORIGEM, valor: "2021-02-29" }]);
  });

  it("data distante citada como anomalia: literal preservado, frase ao redor formatada", () => {
    const html = renderToStaticMarkup(
      h("p", null, h(TextoComDatas, { texto: "evento (fim (3036-03-13) posterior à geração do arquivo (2026-08-12))", literais: [{ classe: "data-fim-fora-da-cronologia", origem: ORIGEM }] })),
    );
    expect(html).toContain("3036-03-13");
    expect(html).toContain("12/08/2026");
    expect(roda(html).violacoes).toEqual([]);
  });

  it("citação fiel detectada em texto corrido, com origem e rótulo visível", () => {
    const html = renderToStaticMarkup(
      h("p", null, h(TextoComDatas, { texto: "copyrightText da camada: 'EPE, ONS, IBGE; 2020-09-11; criação'.", literais: [{ classe: "texto-direitos-camada", origem: ORIGEM }] })),
    );
    expect(html).toContain("<q ");
    expect(html).toContain("EPE, ONS, IBGE; 2020-09-11; criação");
    expect(html).toContain("Trecho da fonte · camada da EPE");
    expect(roda(html).violacoes).toEqual([]);
  });

  it("o componente LiteralFonte gera exatamente o que o contrato exige", () => {
    const html = renderToStaticMarkup(h(LiteralFonte, { classe: "marcador-ausencia-siga", origem: ORIGEM, children: "1900-01-03" }));
    expect(roda(`<p>marcador ${html}</p>`).violacoes).toEqual([]);
  });

  it("literal fora do padrão da classe reprova com mensagem útil", () => {
    const a = roda(`<p>${lit("marcador-ausencia-siga", "2021-02-29")}</p>`);
    expect(a.violacoes.map((v) => v.regra)).toEqual(["literal-fora-do-padrao"]);
    expect(a.violacoes[0].detalhe).toContain("não casa com o padrão da classe");
  });

  it("prosa crua em <code> genérico não passa automaticamente", () => {
    expect(regras("<p><code>Competência 2026-06 revista em 2026-09-30</code></p>")).toEqual(["data-iso-em-prosa", "data-iso-em-prosa"]);
    expect(regras('<p><span data-literal="1">revista em 2026-09-30</span></p>')).toEqual(["data-iso-em-prosa"]);
  });

  it("contêiner amplo marcado como literal reprova", () => {
    const longo = "Esta frase explica o indicador, cita 2026-06 e 2026-09-30 e continua por muitas palavras para parecer um parágrafo inteiro de prosa. ".repeat(6);
    const a = roda(`<div>${lit("registro-composto-bandeiras", longo)}</div>`);
    expect(a.violacoes.map((v) => v.regra)).toEqual(["literal-fora-do-padrao"]);
    expect(a.violacoes[0].detalhe).toMatch(/máximo 600|não casa/);
    // mesmo curto, prosa não casa com o padrão de registro composto
    expect(roda(`<p>${lit("registro-composto-bandeiras", "Prosa sem campos separados por ponto e vírgula, só uma frase longa o bastante")}</p>`).violacoes.map((v) => v.regra)).toEqual(["literal-fora-do-padrao"]);
  });

  it("literal sem origem, com origem malformada, com classe desconhecida ou aninhado reprova", () => {
    expect(regras(`<p>${lit("marcador-ausencia-siga", "1900-01-03", "")}</p>`)).toEqual(["literal-sem-origem"]);
    expect(regras(`<p>${lit("marcador-ausencia-siga", "1900-01-03", "javascript:alert(1)")}</p>`)).toEqual(["literal-sem-origem"]);
    expect(regras('<p><span data-literal-fonte="inventada" data-origem="https://x.gov.br"><span data-literal-rotulo="">x</span><code data-literal-valor="">2026-09</code></span></p>')).toEqual(["literal-classe-desconhecida"]);
    const interno = lit("marcador-ausencia-siga", "1900-01-03");
    expect(regras(`<p><span data-literal-fonte="marcador-ausencia-siga" data-origem="${ORIGEM}"><span data-literal-rotulo="">${rotulo("marcador-ausencia-siga")}</span>${interno}<code data-literal-valor="">1900-01-03</code></span></p>`).length).toBeGreaterThan(0);
  });

  it("rótulo oculto ou diferente do papel reprova", () => {
    const base = lit("marcador-ausencia-siga", "1900-01-03");
    expect(regras(`<p>${base.replace('data-literal-rotulo=""', 'data-literal-rotulo="" class="sr-only"')}</p>`)).toEqual(["literal-sem-rotulo-visivel"]);
    expect(regras(`<p>${base.replace("Valor na fonte", "Qualquer coisa")}</p>`)).toEqual(["literal-sem-rotulo-visivel"]);
  });

  it("texto solto ou elemento extra dentro do literal reprova", () => {
    const base = lit("marcador-ausencia-siga", "1900-01-03");
    expect(regras(`<p>${base.replace("</span> <code", "</span> texto solto <code")}</p>`)).toEqual(["literal-estrutura"]);
    expect(regras(`<p>${base.replace("</code>", "</code><b>extra</b>")}</p>`)).toEqual(["literal-estrutura"]);
  });

  it("data crua em prosa fora do literal reprova mesmo quando o literal vizinho é válido", () => {
    const a = roda(`<p>Marcador ${lit("marcador-ausencia-siga", "1900-01-03")} e depois 2026-06 sem tratamento.</p>`);
    expect(a.violacoes.map((v) => v.regra)).toEqual(["data-iso-em-prosa"]);
    expect(a.literais).toHaveLength(1);
  });

  it("nenhuma classe do registro admite undefined ou NaN, e o literal com esses tokens reprova", () => {
    for (const def of Object.values(LITERAIS)) expect((def as { permiteUndefinedNaN?: boolean }).permiteUndefinedNaN ?? false).toBe(false);
    expect(regras(`<p>${lit("registro-composto-bandeiras", "REH undefined;2024-04-01;Amarela;NaN")}</p>`)).toContain("undefined-nan");
  });
});

describe("cobertura do build", () => {
  const fs = { existsSync, readdirSync: (p: string, o: { withFileTypes: true }) => readdirSync(p, o) };
  const novo = () => mkdtempSync(join(tmpdir(), "obee-build-"));
  const escreve = (raiz: string, rel: string) => {
    mkdirSync(join(raiz, rel, ".."), { recursive: true });
    writeFileSync(join(raiz, rel), "<html></html>");
  };
  const ROTAS = ["setor-eletrico.html", "eficiencia-estatal/educacao-municipal-capitais.html"];

  it("sem o diretório do build, reprova com a instrução de gerar o build", () => {
    const r = coberturaDoBuild(join(novo(), "nao-existe"), ROTAS, 2, fs, join);
    expect(r.erros[0]).toContain("o CI precisa gerar o build");
  });

  it("rota esperada ausente ou poucas páginas reprovam", () => {
    const raiz = novo();
    try {
      escreve(raiz, "setor-eletrico.html");
      const r = coberturaDoBuild(raiz, ROTAS, 2, fs, join);
      expect(r.erros.join(" | ")).toContain("rotas esperadas ausentes do build: eficiencia-estatal/educacao-municipal-capitais.html");
      expect(r.erros.join(" | ")).toContain("poucas páginas do setor elétrico no build (1); mínimo 2");
    } finally {
      rmSync(raiz, { recursive: true, force: true });
    }
  });

  it("build completo não reprova", () => {
    const raiz = novo();
    try {
      escreve(raiz, "setor-eletrico.html");
      escreve(raiz, "setor-eletrico/a.html");
      escreve(raiz, "eficiencia-estatal/educacao-municipal-capitais.html");
      expect(coberturaDoBuild(raiz, ROTAS, 2, fs, join).erros).toEqual([]);
    } finally {
      rmSync(raiz, { recursive: true, force: true });
    }
  });
});
