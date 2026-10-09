import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { GraficoPontos } from "@/components/energia/GraficoPontos";
import { PequenosMultiplos } from "@/components/energia/PequenosMultiplos";
import {
  FONTE_SISTEMA,
  IDENTIFICACAO,
  LARGURA_MAXIMA,
  LARGURA_MINIMA,
  dataDoClique,
  enderecoDaPagina,
  escalaDoCanvas,
  escaparXml,
  extrairFonteEVersao,
  larguraTexto,
  montarSvgImagem,
  nomeArquivoImagem,
  quebrarTexto,
  resolverVariaveis,
  variaveisUsadas,
  type EntradaImagem,
} from "@/lib/energia/imagem-grafico";

/**
 * "Baixar imagem do gráfico" (src/lib/energia/imagem-grafico.ts e src/components/energia/BaixarImagem.tsx): as funções puras (nome do
 * arquivo, quebra de texto, troca de var(--token), escape de XML, fonte e versão do rodapé do painel, montagem do svg final) e o que o
 * botão deixa no HTML do servidor. O botão só aparece depois da hidratação: o HTML do servidor segue sem <button> (um teste de
 * GraficoLinhas exige isso) e traz só um espaço invisível, sem texto, do tamanho do botão, para o layout não saltar.
 */

const ler = (arquivo: string) => readFileSync(join(process.cwd(), arquivo), "utf-8");

/* ---------- nome do arquivo ---------- */

describe("nomeArquivoImagem", () => {
  it("sem acento, minúsculas, hífens entre as palavras e sufixo .png", () => {
    expect(nomeArquivoImagem("Variação da EAR do Sudeste/Centro-Oeste, 29/08/2026 a 28/09/2026")).toBe("variacao-da-ear-do-sudeste-centro-oeste-29-08-2026-a-28-09-2026.png");
    expect(nomeArquivoImagem("  Perdas:   técnicas & não técnicas (%)  ")).toBe("perdas-tecnicas-nao-tecnicas.png");
    expect(nomeArquivoImagem("Çãõ ÁÉÍÓÚ Ü")).toBe("cao-aeiou-u.png");
  });

  it("no máximo 80 caracteres com o .png, só a-z, 0-9 e hífen, sem hífen solto na ponta", () => {
    const longo = "Como a defluência de Serra da Mesa se divide entre turbinado vertido e outras estruturas no período de trinta dias";
    const nome = nomeArquivoImagem(longo);
    expect(nome.length).toBeLessThanOrEqual(80);
    expect(nome).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*\.png$/);
    expect(nome.startsWith("como-a-defluencia-de-serra-da-mesa-se-divide-entre-turbinado")).toBe(true);
    // o corte cai num hífen: a base não termina com hífen
    const base = "a".repeat(75);
    expect(nomeArquivoImagem(`${base} b c d`)).toBe(`${base}.png`);
  });

  it("título vazio ou só de símbolos vira 'grafico.png'", () => {
    expect(nomeArquivoImagem("")).toBe("grafico.png");
    expect(nomeArquivoImagem("— % / ( )")).toBe("grafico.png");
  });
});

/* ---------- quebra de texto ---------- */

describe("quebrarTexto", () => {
  const medir = (t: string) => t.length * 10; // 10 px por caractere
  const op = { medir: (t: string, _tam: number, _neg: boolean) => medir(t) };

  it("quebra por palavra, cada linha cabe na largura e nenhuma palavra se perde", () => {
    const texto = "Fonte: ONS, ENA Diário por Subsistema; ENA Diário por REE";
    const linhas = quebrarTexto(texto, 200, 12, op);
    expect(linhas.length).toBeGreaterThan(2);
    for (const l of linhas) expect(medir(l)).toBeLessThanOrEqual(200);
    expect(linhas.join(" ")).toBe(texto);
  });

  it("palavra que sozinha não cabe (endereço) é cortada, de preferência depois de um separador como / ou -", () => {
    const url = "http://localhost:3200/setor-eletrico/agua-e-clima/afluencia#p018";
    const linhas = quebrarTexto(url, 300, 12, op);
    expect(linhas.length).toBeGreaterThan(1);
    for (const l of linhas) expect(medir(l)).toBeLessThanOrEqual(300);
    expect(linhas.join("")).toBe(url);
    expect(linhas[0]).toMatch(/[/?&=#_.,;:)-]$/);
  });

  it("com maxLinhas o excedente vira reticências, sem passar da largura", () => {
    const linhas = quebrarTexto("um dois três quatro cinco seis sete oito nove dez onze doze", 100, 12, { ...op, maxLinhas: 2 });
    expect(linhas).toHaveLength(2);
    expect(linhas[1].endsWith("…")).toBe(true);
    for (const l of linhas) expect(medir(l)).toBeLessThanOrEqual(100);
  });

  it("sem maxLinhas nada é cortado, texto vazio dá nenhuma linha e espaços repetidos viram um", () => {
    const longo = Array.from({ length: 60 }, (_, i) => `palavra${i}`).join(" ");
    expect(quebrarTexto(longo, 150, 12, op).join(" ")).toBe(longo);
    expect(quebrarTexto("   ", 150, 12, op)).toEqual([]);
    expect(quebrarTexto("a   b \n c", 500, 12, op)).toEqual(["a b c"]);
  });

  it("sem medidor usa a estimativa por caractere: negrito é mais largo e letra larga custa mais que letra estreita", () => {
    expect(larguraTexto("Título", 20, true)).toBeGreaterThan(larguraTexto("Título", 20, false));
    expect(larguraTexto("MMMM", 14)).toBeGreaterThan(larguraTexto("iiii", 14));
    expect(larguraTexto("é", 14)).toBe(larguraTexto("e", 14));
    const linhas = quebrarTexto("Variação da EAR do Sudeste/Centro-Oeste por reservatório", 200, 14);
    for (const l of linhas) expect(larguraTexto(l, 14)).toBeLessThanOrEqual(200);
  });
});

/* ---------- var(--token) e XML ---------- */

describe("resolverVariaveis", () => {
  const mapa = { "--cor-carvao": "rgb(26 29 33)", "--serie-1": "rgb(37 106 191)", "--serie-referencia": "rgb(138 133 120)" };

  it("troca cada var(--token) pelo valor já calculado, em atributo e em função de cor", () => {
    const svg = '<rect fill="var(--serie-1)" stroke="var(--cor-carvao)"/><path fill="color-mix(in srgb, var(--serie-referencia) 22%, transparent)"/>';
    const r = resolverVariaveis(svg, mapa);
    expect(r).toBe('<rect fill="rgb(37 106 191)" stroke="rgb(26 29 33)"/><path fill="color-mix(in srgb, rgb(138 133 120) 22%, transparent)"/>');
    expect(r).not.toContain("var(");
  });

  it("token ausente usa a reserva do próprio var() e, sem ela, currentColor: nenhum var( sobra e nada vira preto por engano", () => {
    expect(resolverVariaveis('fill="var(--nao-existe, rgb(1 2 3))"', mapa)).toBe('fill="rgb(1 2 3)"');
    expect(resolverVariaveis('fill="var(--nao-existe)"', mapa)).toBe('fill="currentColor"');
    expect(resolverVariaveis('fill="var(--a, var(--serie-1))"', mapa)).toBe('fill="rgb(37 106 191)"');
    expect(resolverVariaveis('x="var( --serie-1 )"', mapa)).toBe('x="rgb(37 106 191)"');
  });

  it("valor do mapa que tem outro var() também é resolvido, e var malformado não sobra", () => {
    expect(resolverVariaveis('fill="var(--a)"', { "--a": "var(--serie-1)", "--serie-1": "rgb(0 0 0)" })).toBe('fill="rgb(0 0 0)"');
    expect(resolverVariaveis('fill="var(--circular)"', { "--circular": "var(--circular)" })).not.toContain("var(");
    expect(resolverVariaveis('fill="var(foo)"', mapa)).not.toContain("var(");
  });

  it("variaveisUsadas lista os nomes, sem repetir, na ordem em que aparecem", () => {
    expect(variaveisUsadas('a="var(--x)" b="var(--y, var(--z))" c="var(--x)"')).toEqual(["--x", "--y", "--z"]);
    expect(variaveisUsadas("nada aqui")).toEqual([]);
  });
});

describe("escaparXml", () => {
  it("escapa os cinco caracteres do XML e tira os de controle que o XML 1.0 não aceita", () => {
    expect(escaparXml(`A & B <C> "d" 'e'`)).toBe("A &amp; B &lt;C&gt; &quot;d&quot; &apos;e&apos;");
    expect(escaparXml("a\u0000b\u0008c\u000bd\ufffee")).toBe("abcde");
    expect(escaparXml("linha\ncom\ttab")).toBe("linha\ncom\ttab");
    expect(escaparXml("R$\u00a05,0 MWmês − ³")).toBe("R$\u00a05,0 MWmês − ³");
  });
});

/* ---------- fonte e versão do rodapé do painel ---------- */

describe("extrairFonteEVersao", () => {
  it("rodapé de painel: a fonte é o texto do próprio painel e a versão vem das datas de 'referência até'", () => {
    const r = extrairFonteEVersao("Fonte: ONS, ENA Diário por Subsistema; ENA Diário por REE (referência até 29/09/2026). ");
    expect(r.fonte).toBe("Fonte: ONS, ENA Diário por Subsistema; ENA Diário por REE (referência até 29/09/2026).");
    expect(r.versao).toBe("referência até 29/09/2026");
  });

  it("várias fontes com datas diferentes listam cada data uma vez", () => {
    const r = extrairFonteEVersao("Fontes: ONS, A (referência até 29/09/2026); ANEEL, B (referência até 30/09/2026); ONS, C (referência até 29/09/2026).");
    expect(r.versao).toBe("referência até 29/09/2026 e 30/09/2026");
    const tres = extrairFonteEVersao("Fontes: ANEEL, A (referência até 30/09/2026); ANEEL, B (referência até 09/2026); IBGE, C (referência até 08/2026).");
    expect(tres.versao).toBe("referência até 30/09/2026, 09/2026 e 08/2026");
  });

  it("rodapé de tabela traz 'Versão dos dados: X' e o texto seguinte não entra na fonte", () => {
    const r = extrairFonteEVersao("Fonte: ANEEL, SAMP. Versão dos dados: 30/09/2026. “sem dado” indica ausência na fonte, nunca zero.");
    expect(r.fonte).toBe("Fonte: ANEEL, SAMP.");
    expect(r.versao).toBe("30/09/2026");
  });

  it("sem rótulo 'Fonte:' acrescenta o rótulo; sem parágrafo, nada é inventado", () => {
    expect(extrairFonteEVersao("ONS, EAR Diário").fonte).toBe("Fonte: ONS, EAR Diário");
    expect(extrairFonteEVersao("ONS, EAR Diário").versao).toBeNull();
    expect(extrairFonteEVersao("")).toEqual({ fonte: null, versao: null });
    expect(extrairFonteEVersao(null)).toEqual({ fonte: null, versao: null });
    expect(extrairFonteEVersao(undefined)).toEqual({ fonte: null, versao: null });
  });
});

describe("endereço, data e escala do canvas", () => {
  it("endereço da página: origem, caminho, recorte da URL e âncora do painel", () => {
    const local = { origin: "https://exemplo.org", pathname: "/setor-eletrico/agua-e-clima/afluencia", search: "?r=SE&modo=analisar" };
    expect(enderecoDaPagina(local, "p018")).toBe("https://exemplo.org/setor-eletrico/agua-e-clima/afluencia?r=SE&modo=analisar#p018");
    expect(enderecoDaPagina({ ...local, search: "" })).toBe("https://exemplo.org/setor-eletrico/agua-e-clima/afluencia");
  });

  it("data do clique em dd/mm/aaaa, com zero à esquerda", () => {
    expect(dataDoClique(new Date(2026, 9, 9, 15, 30))).toBe("09/10/2026");
    expect(dataDoClique(new Date(2027, 0, 1))).toBe("01/01/2027");
    expect(dataDoClique(new Date(2026, 11, 31, 23, 59))).toBe("31/12/2026");
  });

  it("canvas em 2x; imagem enorme usa escala menor para não passar do limite de pixels", () => {
    expect(escalaDoCanvas(800, 600)).toBe(2);
    expect(escalaDoCanvas(720, 4000)).toBe(2);
    const alta = escalaDoCanvas(800, 12000);
    expect(alta).toBeLessThan(2);
    expect(800 * alta * (12000 * alta)).toBeLessThanOrEqual(16_000_000 + 1);
    expect(escalaDoCanvas(800, 100000)).toBeGreaterThanOrEqual(0.5);
  });
});

/* ---------- svg montado ---------- */

/** Confere que o texto é XML bem formado (tags balanceadas, sem '<' solto, só as cinco entidades), que é o que o navegador exige de um svg usado como imagem. */
function bemFormado(xml: string): void {
  const pilha: string[] = [];
  const tag = /<(\/?)([A-Za-z][\w:-]*)((?:\s+[\w:.-]+="[^"<]*")*)\s*(\/?)>/g;
  let fim = 0;
  let m: RegExpExecArray | null;
  const texto = (t: string) => {
    expect(t, `texto solto: ${t.slice(0, 60)}`).not.toContain("<");
    expect(t.replace(/&(amp|lt|gt|quot|apos);/g, ""), `entidade inválida em: ${t.slice(0, 60)}`).not.toContain("&");
  };
  while ((m = tag.exec(xml))) {
    texto(xml.slice(fim, m.index));
    fim = tag.lastIndex;
    const [, fecha, nome, atributos, auto] = m;
    expect(atributos.replace(/&(amp|lt|gt|quot|apos);/g, ""), `entidade inválida em atributo de <${nome}>`).not.toContain("&");
    if (auto) continue;
    if (fecha) expect(pilha.pop(), `fechamento </${nome}>`).toBe(nome);
    else pilha.push(nome);
  }
  texto(xml.slice(fim));
  expect(pilha).toEqual([]);
}

const hachura = '<pattern id="h1" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" fill="var(--cor-superficie)"/><line x1="0" y1="0" x2="0" y2="5" stroke="var(--cor-mineral)" stroke-width="1.5"/></pattern>';
const TOKENS = {
  "--cor-superficie": "rgb(255 255 255)",
  "--cor-carvao": "rgb(26 29 33)",
  "--cor-carvao-muted": "rgb(61 65 71)",
  "--cor-mineral": "rgb(107 109 106)",
  "--cor-linha": "rgb(216 210 198)",
  "--serie-hidraulica": "rgb(37 106 191)",
  "--serie-referencia": "rgb(138 133 120)",
};

function entrada(largura: number, extra: Partial<EntradaImagem> = {}): EntradaImagem {
  return {
    titulo: "Variação da EAR por reservatório",
    unidade: "MWmês",
    legenda: [
      { texto: "Sudeste/Centro-Oeste", amostra: { largura: 18, altura: 8, interno: '<line x1="0" y1="4" x2="18" y2="4" stroke="var(--serie-hidraulica)" stroke-width="2.5"/>' } },
      { texto: "sem dado (ausência, não zero)", amostra: { largura: 12, altura: 12, interno: '<rect x="0.5" y="0.5" width="11" height="11" fill="url(#h1)" stroke="var(--cor-mineral)" stroke-dasharray="2 2"/>' } },
      { texto: "Média do SIN: 62,0 MWmês", amostra: { largura: 18, altura: 8, interno: '<line x1="0" y1="4" x2="18" y2="4" stroke="var(--cor-carvao-muted)" stroke-width="1.5" stroke-dasharray="5 4"/>' } },
    ],
    grafico: {
      largura,
      altura: 260,
      elementos: [
        {
          tipo: "svg",
          x: 0,
          y: 0,
          largura,
          altura: 260,
          viewBox: `0 0 ${largura} 260`,
          interno: '<rect x="10" y="10" width="100" height="20" fill="url(#h1)"/><path d="M0,0L10,10" stroke="var(--serie-hidraulica)" fill="none"/><text x="4" y="40" font-size="12" fill="var(--cor-carvao-muted)" class="tabular-nums">R$\u00a05,0 &amp; mais</text>',
        },
      ],
    },
    definicoes: hachura,
    fonte: "Fonte: ONS, EAR Diário por Reservatório (referência até 29/09/2026).",
    versao: "referência até 29/09/2026",
    endereco: "https://exemplo.org/setor-eletrico/agua-e-clima/reservatorios#p020",
    geradoEm: "09/10/2026",
    ...extra,
  };
}

describe("montarSvgImagem", () => {
  it("leva título, unidade, legenda, fonte, versão, endereço, data e a identificação, e nenhum var( sobra", () => {
    const { svg } = montarSvgImagem(entrada(760), { tokens: TOKENS });
    for (const t of [
      "Variação da EAR por reservatório",
      "Valores em MWmês",
      "Sudeste/Centro-Oeste",
      "sem dado (ausência, não zero)",
      "Média do SIN: 62,0 MWmês",
      "Fonte: ONS, EAR Diário por Reservatório (referência até 29/09/2026).",
      "Versão dos dados: referência até 29/09/2026",
      "Endereço da página: https://exemplo.org/setor-eletrico/agua-e-clima/reservatorios#p020",
      "Gerado em 09/10/2026",
      IDENTIFICACAO,
    ]) {
      expect(svg, t).toContain(escaparXml(t));
    }
    expect(IDENTIFICACAO).toBe("Scrutiniums, Observatório Brasileiro do Setor Elétrico");
    expect(svg).not.toContain("var(");
    expect(svg).toContain('stroke="rgb(37 106 191)"');
    expect(svg).toContain('fill="rgb(255 255 255)"');
  });

  it("é XML bem formado, com título em negrito, svg do gráfico aninhado com viewBox e padrão de hachura em <defs>", () => {
    const { svg } = montarSvgImagem(entrada(760), { tokens: TOKENS });
    bemFormado(svg);
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg).toMatch(/<text [^>]*font-weight="700"[^>]*>Variação da EAR/);
    expect(svg).toContain('viewBox="0 0 760 260"');
    expect(svg).toMatch(/<defs><pattern id="h1"[^>]*>.*<\/pattern><\/defs>/);
    expect(svg).toContain('fill="url(#h1)"');
    // o espaço não separável segue como caractere, não como entidade HTML (que o XML recusa)
    expect(svg).toContain("R$\u00a05,0 &amp; mais");
    expect(svg).not.toContain("&nbsp;");
    expect(svg).toContain(`font-family="${FONTE_SISTEMA}"`);
    // fundo da cor de superfície
    expect(svg).toMatch(/<rect width="[\d.]+" height="[\d.]+" fill="rgb\(255 255 255\)"\/>/);
  });

  it("largura final entre 720 e 1600 px (e o PNG em 2x também), do celular à tela larga, e altura inteira", () => {
    expect(LARGURA_MINIMA).toBe(720);
    expect(LARGURA_MAXIMA).toBeLessThanOrEqual(1600);
    for (const largura of [120, 358, 700, 760, 1160, 3000]) {
      const r = montarSvgImagem(entrada(largura), { tokens: TOKENS });
      expect(r.largura, `largura ${largura}`).toBeGreaterThanOrEqual(720);
      expect(r.largura, `largura ${largura}`).toBeLessThanOrEqual(1600);
      expect(r.largura * 2, `png ${largura}`).toBeGreaterThanOrEqual(720);
      expect(r.largura * 2, `png ${largura}`).toBeLessThanOrEqual(1600);
      expect(Number.isInteger(r.altura)).toBe(true);
      expect(r.svg).toContain(`width="${r.largura}" height="${r.altura}"`);
      bemFormado(r.svg);
    }
  });

  it("gráfico estreito (celular) é ampliado e o largo é reduzido, com texto e desenho na mesma proporção (o viewBox faz a conta)", () => {
    const estreito = montarSvgImagem(entrada(358), { tokens: TOKENS });
    const largo = montarSvgImagem(entrada(1160), { tokens: TOKENS });
    const vb = (s: string) => (s.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/) ?? []).slice(1).map(Number);
    const [vbE] = vb(estreito.svg);
    const [vbL] = vb(largo.svg);
    expect(vbE).toBeLessThan(estreito.largura); // ampliado: o desenho tem 390 unidades e a imagem 720 px
    expect(vbL).toBeGreaterThan(largo.largura); // reduzido: o desenho tem 1216 unidades e a imagem 800 px
    // a razão entre o viewBox e o tamanho em px é a mesma na largura e na altura
    const [, hE] = vb(estreito.svg);
    expect(estreito.largura / vbE).toBeCloseTo(estreito.altura / hE, 2);
  });

  it("título longo, fonte longa e endereço longo quebram em linhas e nada é cortado", () => {
    const titulo = "Variação da EAR do Sudeste/Centro-Oeste por reservatório, 29/08/2026 a 28/09/2026: maiores quedas e maiores altas, em MWmês, ordenadas";
    const fonte = `Fonte: ${Array.from({ length: 30 }, (_, i) => `Conjunto ${i + 1}`).join("; ")} (referência até 29/09/2026).`;
    const endereco = `https://exemplo.org/setor-eletrico/agua-e-clima/reservatorios?${"recorte=SE&".repeat(12)}modo=analisar#p020`;
    const { svg } = montarSvgImagem(entrada(358, { titulo, fonte, endereco }), { tokens: TOKENS });
    expect(svg).not.toContain("…");
    const textos = Array.from(svg.matchAll(/<text [^>]*>([^<]*)<\/text>/g)).map((m) => m[1]);
    expect(textos.join(" ")).toContain("ordenadas");
    expect(textos.join(" ")).toContain("Conjunto 30 (referência até 29/09/2026).");
    // a URL quebrada em linhas, juntas, é o endereço inteiro (o rótulo fica sozinho na linha de cima)
    const i = textos.indexOf("Endereço da página:");
    const j = textos.findIndex((t) => t.startsWith("Scrutiniums,"));
    expect(i).toBeGreaterThan(0);
    expect(j).toBeGreaterThan(i + 1);
    expect(textos.slice(i + 1, j).join("")).toBe(escaparXml(endereco));
    // o título quebrado em mais de uma linha: várias linhas de negrito
    expect((svg.match(/font-weight="700"/g) ?? []).length).toBeGreaterThan(2);
    bemFormado(svg);
  });

  it("identificação e data na mesma linha quando cabem e em linhas separadas quando não cabem (no celular uma escrevia por cima da outra)", () => {
    const y = (svg: string, texto: string) => Number(svg.match(new RegExp(`<text x="[\\d.]+" y="([\\d.]+)"[^>]*>${escaparXml(texto)}</text>`))?.[1]);
    const largo = montarSvgImagem(entrada(1160), { tokens: TOKENS }).svg;
    expect(y(largo, "Gerado em 09/10/2026")).toBe(y(largo, IDENTIFICACAO));
    expect(largo).toMatch(/<text [^>]*text-anchor="end"[^>]*>Gerado em 09\/10\/2026<\/text>/);
    const estreito = montarSvgImagem(entrada(358), { tokens: TOKENS }).svg;
    expect(y(estreito, "Gerado em 09/10/2026")).toBeGreaterThan(y(estreito, IDENTIFICACAO) + 10);
    expect(estreito).not.toMatch(/<text [^>]*text-anchor="end"[^>]*>Gerado em/);
  });

  it("sem fonte e sem versão (gráfico fora de painel) a imagem leva só endereço, data e identificação, sem inventar fonte", () => {
    const { svg } = montarSvgImagem(entrada(760, { fonte: null, versao: null }), { tokens: TOKENS });
    expect(svg).not.toContain("Fonte:");
    expect(svg).not.toContain("Versão dos dados");
    expect(svg).toContain("Endereço da página: https://exemplo.org/");
    expect(svg).toContain("Gerado em 09/10/2026");
    expect(svg).toContain(escaparXml(IDENTIFICACAO));
    expect(svg).not.toContain("var(");
  });

  it("notas do estado do gráfico (recorte parcial, intervalo, escala) entram abaixo do desenho", () => {
    const nota = "O gráfico mostra as 12 primeiras das 30 categorias, na ordem escolhida.";
    const { svg } = montarSvgImagem(entrada(760, { notas: [nota, "  "] }), { tokens: TOKENS });
    expect(svg).toContain(nota);
    expect(svg.indexOf(nota)).toBeGreaterThan(svg.indexOf("R$\u00a05,0"));
    expect(svg.indexOf(nota)).toBeLessThan(svg.search(/<text [^>]*>Fonte: ONS/));
  });

  it("caracteres especiais do título, da legenda e da fonte são escapados e o svg segue bem formado", () => {
    const { svg } = montarSvgImagem(
      entrada(760, {
        titulo: 'Perdas "técnicas" & <não técnicas>',
        unidade: "R$/MWh <ref>",
        legenda: [{ texto: "A & B <C>" }],
        fonte: "Fonte: ONS & ANEEL <dados abertos>.",
      }),
      { tokens: TOKENS },
    );
    bemFormado(svg);
    expect(svg).toContain("Perdas &quot;técnicas&quot; &amp; &lt;não técnicas&gt;");
    expect(svg).toContain("A &amp; B &lt;C&gt;");
    expect(svg).not.toContain("<não");
  });

  it("sem mapa de tokens usa valores de reserva da moldura e ainda assim não deixa var(", () => {
    const { svg } = montarSvgImagem(entrada(760));
    expect(svg).not.toContain("var(");
    expect(svg).toMatch(/<rect width="[\d.]+" height="[\d.]+" fill="white"\/>/);
    // token do gráfico fora do mapa vira currentColor (herda a cor do texto), nunca fica inválido
    expect(svg).toContain('stroke="currentColor"');
  });

  it("usa o medidor recebido (a medida real do canvas) para decidir onde as linhas quebram", () => {
    const larga = (_t: string) => 50; // cada caractere mede 50 px: tudo quebra a cada poucos caracteres
    const normal = montarSvgImagem(entrada(760, { fonte: "Fonte: uma frase curta de teste." }), { tokens: TOKENS });
    const apertada = montarSvgImagem(entrada(760, { fonte: "Fonte: uma frase curta de teste." }), { tokens: TOKENS, medir: (t) => larga(t) * t.length });
    expect(apertada.altura).toBeGreaterThan(normal.altura);
  });
});

/* ---------- o botão no HTML do servidor ---------- */

describe("o botão e o HTML do servidor dos gráficos", () => {
  const dados = [
    { d: "2024-01-01", a: 10, b: 100 },
    { d: "2024-01-02", a: 12, b: 110 },
    { d: "2024-01-03", a: 11, b: 120 },
  ];
  const linhas = renderToStaticMarkup(
    createElement(GraficoLinhas, { titulo: "Carga diária", dados, chaveX: "d", series: [{ id: "a", rotulo: "A", cor: "var(--serie-1)" }, { id: "b", rotulo: "B", cor: "var(--serie-3)" }], unidade: "MWmed" }),
  );
  const barrasV = renderToStaticMarkup(
    createElement(GraficoBarras, { titulo: "Perdas", dados: [{ id: "A", v: 3 }, { id: "B", v: 5 }], chaveCategoria: "id", series: [{ id: "v", rotulo: "Perda", cor: "var(--serie-1)" }], unidade: "GWh" }),
  );
  const barrasH = renderToStaticMarkup(
    createElement(GraficoBarras, { titulo: "Perdas", dados: [{ id: "A", v: 3 }, { id: "B", v: 5 }], chaveCategoria: "id", series: [{ id: "v", rotulo: "Perda", cor: "var(--serie-1)" }], unidade: "GWh", orientacao: "horizontal" }),
  );
  const pontos = renderToStaticMarkup(
    createElement(GraficoPontos, { titulo: "Realizado e referência", itens: [{ id: "A", rotulo: "Alfa", valor: 10, referencia: 8 }, { id: "B", rotulo: "Beta", valor: 5, referencia: 9 }], unidade: "%", rotuloValor: "Realizado", rotuloReferencia: "Referência" }),
  );
  const multiplos = renderToStaticMarkup(
    createElement(PequenosMultiplos, { titulo: "Carga por subsistema", dados, chaveX: "d", paineis: [{ id: "a", titulo: "A" }, { id: "b", titulo: "B" }, { id: "c", titulo: "C", nota: "sem medição" }], unidade: "MWmed" }),
  );
  const espaco = /<span aria-hidden="true" class="invisible ml-auto w-\[6\.3rem\] print:hidden [^"]*min-h-\[24px\][^"]*\[@media\(pointer:coarse\)\]:min-h-\[44px\]">\u00a0<\/span>/;

  it("no servidor não há <button> do botão nem o texto 'Baixar imagem': só um espaço invisível, sem texto, do tamanho do botão", () => {
    for (const [nome, h] of Object.entries({ linhas, barrasV, barrasH, pontos, multiplos })) {
      expect(h, nome).toMatch(espaco);
      expect(h, nome).not.toContain("Baixar imagem");
      expect(h, nome).not.toContain("data-baixar-imagem");
    }
    // o teste de GraficoLinhas exige HTML sem <button> na legenda estática
    expect(linhas).not.toContain("<button");
  });

  it("o espaço fica ao lado da legenda, na mesma linha, e a legenda continua com o mesmo rótulo e a mesma lista", () => {
    for (const [nome, h] of Object.entries({ linhas, barrasV, barrasH, pontos, multiplos })) {
      expect(h, nome).toMatch(/<div class="flex flex-wrap items-baseline gap-x-4"><ul class="[^"]*" aria-label="Legenda">[\s\S]*?<\/ul><span aria-hidden="true" class="invisible/);
    }
  });

  it("cada svg do desenho é marcado com data-svg-grafico, e só eles (legenda, definições e dica não)", () => {
    const marcados = (h: string) => (h.match(/<svg [^>]*data-svg-grafico=""/g) ?? []).length;
    expect(marcados(linhas)).toBe(1);
    expect(marcados(barrasV)).toBe(1);
    expect(marcados(barrasH)).toBe(2); // eixo de valores acima e barras
    expect(marcados(pontos)).toBe(2); // eixo acima e linhas
    expect(marcados(multiplos)).toBe(3); // um por painel
    // o svg oculto das definições (hachura) e os da legenda ficam de fora
    expect(barrasH.match(/<svg width="0" height="0"[^>]*>/)?.[0]).not.toContain("data-svg-grafico");
    expect(multiplos).toContain('<li class="min-w-0 border-b border-r border-linha bg-superficie" data-painel="a">');
  });

  it("estado vazio não tem botão nem espaço", () => {
    const vazioBarras = renderToStaticMarkup(createElement(GraficoBarras, { titulo: "X", dados: [], chaveCategoria: "id", series: [{ id: "v", rotulo: "V", cor: "var(--serie-1)" }], unidade: "GWh" }));
    const vazioPontos = renderToStaticMarkup(createElement(GraficoPontos, { titulo: "X", itens: [], unidade: "%", rotuloValor: "A", rotuloReferencia: "B" }));
    const vazioMultiplos = renderToStaticMarkup(createElement(PequenosMultiplos, { titulo: "X", dados: [], chaveX: "d", paineis: [], unidade: "MWmed" }));
    for (const h of [vazioBarras, vazioPontos, vazioMultiplos]) {
      expect(h).not.toContain("invisible");
      expect(h).not.toContain("Baixar");
    }
    expect(vazioBarras).toContain("Nenhuma categoria com dados para exibir.");
  });
});

/* ---------- o botão depois da hidratação (efeitos executados na renderização) ---------- */

describe("BaixarImagem depois da hidratação", () => {
  afterEach(() => {
    vi.doUnmock("react");
    vi.resetModules();
  });

  it("botão com texto 'Baixar imagem', aria-label com o título, alvo de 44 px em ponteiro grosso, oculto na impressão e região viva", async () => {
    vi.resetModules();
    // o servidor não roda efeitos: aqui o efeito roda na hora e a atualização de estado refaz a renderização, como depois da hidratação
    vi.doMock("react", async (importOriginal) => {
      const real = await importOriginal<typeof import("react")>();
      let rodou = false;
      return {
        ...real,
        default: real,
        useEffect: (f: () => void) => {
          if (rodou) return;
          rodou = true;
          f();
        },
      };
    });
    const { BaixarImagem } = await import("@/components/energia/BaixarImagem");
    const { createElement: criar } = await import("react");
    const h = renderToStaticMarkup(criar(BaixarImagem, { raiz: { current: null }, titulo: "Carga diária", unidade: "MWmed" }));
    expect(h).toMatch(/<button type="button" aria-label="Baixar imagem do gráfico: Carga diária" class="[^"]*min-h-\[24px\][^"]*\[@media\(pointer:coarse\)\]:min-h-\[44px\][^"]*">Baixar imagem<\/button>/);
    expect(h).toContain("print:hidden");
    expect(h).toContain("data-baixar-imagem");
    expect(h).toMatch(/<span role="status" aria-live="polite" class="sr-only"><\/span>/);
    expect(h).not.toContain("invisible");
    expect(h).not.toContain("alert");
  });
});

/* ---------- o que o código garante ---------- */

describe("contratos do código do botão", () => {
  const botao = ler("src/components/energia/BaixarImagem.tsx");
  const lib = ler("src/lib/energia/imagem-grafico.ts");

  it("sem hexadecimal solto, sem alert, sem rede, sem fonte nem imagem externa, só fonte do sistema", () => {
    for (const t of [botao, lib]) {
      expect(t).not.toMatch(/#[0-9a-fA-F]{6}\b/);
      expect(t).not.toMatch(/\balert\(/);
      expect(t).not.toMatch(/\bfetch\(|XMLHttpRequest|@font-face|<image\b|xlink:href|https?:\/\/(?!www\.w3\.org)/);
    }
    expect(lib).toContain("system-ui");
  });

  it("clona só os svgs marcados, tira a cruz do cursor e os realces do momento, resolve var() com o estilo da página e rasteriza em canvas", () => {
    expect(botao).toContain('"svg[data-svg-grafico]"');
    expect(botao).toContain("[data-cursor]");
    expect(botao).toContain("[data-selecao]");
    expect(botao).toContain("[data-nao-exportar]");
    expect(botao).toContain("getComputedStyle(document.documentElement)");
    expect(botao).toContain("closest(\"section[data-painel-evidencia]\")");
    expect(botao).toContain("data:image/svg+xml;charset=utf-8,");
    expect(botao).toContain("canvas.toBlob");
    expect(botao).toContain('role="status" aria-live="polite"');
  });

  it("os realces que são do momento (passagem do ponteiro e anel de foco) levam data-nao-exportar nos gráficos de barras e de pontos", () => {
    for (const f of ["GraficoBarras", "GraficoPontos"]) {
      const t = ler(`src/components/energia/${f}.tsx`);
      expect(t, f).toMatch(/<rect (?:key=\{i\} )?data-nao-exportar="" [^>]*opacity="0\.55"/);
      expect(t, f).toMatch(/<rect data-nao-exportar="" [^>]*stroke="var\(--cor-energia\)" strokeWidth="2" rx="2"/);
    }
  });
});
