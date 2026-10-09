/* TEMPORÁRIO (executor da Inclusão): recorte do T1 só com as páginas da família. Apagar depois da verificação. */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PaginaInclusao from "@/app/setor-eletrico/inclusao-energetica/page";
import PaginaInclusaoAcesso from "@/app/setor-eletrico/inclusao-energetica/acesso/page";
import PaginaInclusaoCobertura from "@/app/setor-eletrico/inclusao-energetica/cobertura/page";
import PaginaInclusaoOrcamento from "@/app/setor-eletrico/inclusao-energetica/orcamento/page";
import PaginaInclusaoTarifaSocial from "@/app/setor-eletrico/inclusao-energetica/tarifa-social/page";
import * as I from "@/lib/energia/inclusao";
import type { InclusaoGold } from "@/lib/energia/tipos-inclusao";

const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, p), "utf-8");
const json = <X>(p: string) => JSON.parse(ler(p)) as X;
const GI = json<InclusaoGold>("public/energia/gold/inclusao.json");

/** CSV do pipeline (separador ";"), lido aqui por outro código que o dos módulos. */
function csv(p: string): Record<string, string>[] {
  const [cab, ...linhas] = ler(p).trim().split(/\r?\n/);
  const cols = cab.split(";");
  return linhas.map((l) => Object.fromEntries(l.split(";").map((v, i) => [cols[i], v])));
}

const palavras = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
const numeros = (t: string) => (t.match(/\d[\d.,]*\d|\d/g) ?? []).length;
const ESPACOS = /[\s ]+/g;
const decodifica = (s: string) => s.replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const norm = (s: string) => s.replace(ESPACOS, " ").trim();

/** Todo o texto da página, com os blocos de Analisar e Auditar. */
function textoCompleto(html: string): string {
  return norm(decodifica(html.slice(html.indexOf("<main")).replace(/<(script|style)[\s\S]*?<\/\1>/g, " ").replace(/<[^>]+>/g, " ")));
}

const VOID = new Set(["br", "img", "input", "hr", "meta", "link", "path", "circle", "rect", "line", "polygon", "polyline", "use", "source", "wbr", "col"]);

/** Texto de Entender: sem os blocos data-nivel analisar e auditar, sem a ficha "Sobre este dado" (dialog), sem svg, script e style. */
function textoEntender(html: string): string {
  const corpo = html.slice(html.indexOf("<main"));
  const saida: string[] = [];
  const ocultas: string[] = [];
  const re = /<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(corpo))) {
    if (m[5] !== undefined) {
      if (!ocultas.length) saida.push(m[5]);
      continue;
    }
    const [, fecha, tag, attrs, auto] = m;
    const t = tag.toLowerCase();
    if (VOID.has(t) || auto) continue;
    if (fecha) {
      if (ocultas.length && ocultas[ocultas.length - 1] === t) ocultas.pop();
      else if (ocultas.length) {
        // fecha de outra tag dentro de bloco oculto: ignora
      }
      continue;
    }
    if (ocultas.length) {
      if (ocultas[ocultas.length - 1] === t) ocultas.push(t);
      continue;
    }
    if (/data-nivel="(?:analisar|auditar)"/.test(attrs) || ["dialog", "svg", "script", "style"].includes(t)) ocultas.push(t);
    else saida.push(" ");
  }
  return norm(decodifica(saida.join(" ")));
}

const render = (P: () => JSX.Element | Promise<JSX.Element>) => renderToStaticMarkup(createElement(P as never));
const H = {
  inclusao: render(PaginaInclusao as never),
  acesso: render(PaginaInclusaoAcesso as never),
  cobertura: render(PaginaInclusaoCobertura as never),
  orcamento: render(PaginaInclusaoOrcamento as never),
  tarifaSocial: render(PaginaInclusaoTarifaSocial as never),
};
type Pagina = keyof typeof H;
const COMPLETO = Object.fromEntries(Object.entries(H).map(([k, h]) => [k, textoCompleto(h)])) as Record<Pagina, string>;
const ENTENDER = Object.fromEntries(Object.entries(H).map(([k, h]) => [k, textoEntender(h)])) as Record<Pagina, string>;


const t = GI.tarifa_social;
const PAINEIS: [Pagina, string, string, string][] = [
  ["inclusao", "p059", I.vereditoTarifaSocial(t), I.respostaTarifaSocial(t)],
  ["inclusao", "p060", I.vereditoCobertura(GI.cobertura), I.respostaCobertura(GI.cobertura)],
  ["inclusao", "p062", I.vereditoAcesso(GI.acesso), I.respostaAcesso(GI.acesso)],
  ["tarifaSocial", "p059", I.vereditoTarifaSocial(t), I.respostaTarifaSocial(t)],
  ["cobertura", "p060", I.vereditoCobertura(GI.cobertura), I.respostaCobertura(GI.cobertura)],
  ["acesso", "p062", I.vereditoAcesso(GI.acesso), I.respostaAcesso(GI.acesso)],
];

describe("T1 recortado: vereditos", () => {
  it("cada veredito é curto, sem número digitado fora do dado e sem travessão, 'hoje', undefined ou NaN", () => {
    for (const [pagina, id, veredito, completa] of PAINEIS) {
      const rotulo = `${pagina} ${id}`;
      expect(veredito.length, rotulo).toBeGreaterThan(0);
      expect(palavras(veredito), rotulo).toBeLessThanOrEqual(50);
      expect(numeros(veredito), rotulo).toBeLessThanOrEqual(8);
      expect(palavras(veredito), rotulo).toBeLessThan(palavras(completa));
      expect(veredito, rotulo).not.toMatch(/[—–]|\bhoje\b|undefined|NaN/);
    }
  });

  it("o veredito fica à vista (Entender) e a resposta completa continua no HTML, só fora de Entender", () => {
    for (const [pagina, id, veredito, completa] of PAINEIS) {
      const rotulo = `${pagina} ${id}`;
      expect(H[pagina], rotulo).toContain(`data-resposta="${id}"`);
      expect(ENTENDER[pagina], rotulo).toContain(norm(veredito));
      expect(COMPLETO[pagina], rotulo).toContain(norm(completa));
      expect(ENTENDER[pagina], rotulo).not.toContain(norm(completa));
    }
  });

  it("a direção dita em cada veredito confere com o dado publicado em outro arquivo", () => {
    const m = csv("public/energia/series/inclusao_tsee_mensal.csv");
    const uc = (mes: string) => Number(m.find((l) => l.mes === mes)!.uc_tsee);
    const alta = (uc("2025-05") / uc("2024-05") - 1) * 100;
    expect(I.vereditoTarifaSocial(t)).toContain(`${alta.toFixed(1).replace(".", ",")}% a mais que em mai/2024`);
    expect(I.vereditoTarifaSocial(t)).toContain("Em mai/2025, 17.246.524 unidades consumidoras");
  });
});

describe("r8 T1: Inclusão energética", () => {
  it("mai/2025 e jun/2025: jun/2025 está no arquivo do SCS mas é incompleto (4 distribuidoras ausentes); o último completo é mai/2025", () => {
    const m = csv("public/energia/series/inclusao_tsee_mensal.csv");
    const mai = m.find((l) => l.mes === "2025-05")!;
    const jun = m.find((l) => l.mes === "2025-06")!;
    expect(mai.completo).toBe("1");
    expect(jun.completo).toBe("0");
    expect(jun.distribuidoras_faltantes).toBe("4");
    expect(m[m.length - 1].mes).toBe("2025-06");
    expect(Number(mai.uc_tsee)).toBe(t.kpis.uc_tsee.valor);
    const quadro = ENTENDER.tarifaSocial;
    expect(quadro).toContain("Fonte defasada, declarada. Um mês só entra nas comparações quando todas as distribuidoras enviaram o informe.");
    expect(quadro).toContain("SCS (UC): arquivo gerado em 20/09/2026, publicado até jun/2025; o último mês com todas as distribuidoras é mai/2025, o dos números de UC.");
    expect(quadro).toContain("o último mês com todas as distribuidoras é mar/2026, o dos números de fatura e do mapa.");
    for (const x of ["arquivos sondados", "original guardado", "regra do mês do mapa"]) expect(quadro, x).not.toContain(x);
  });

  it("72 passam de 100 e 75 estão nas faixas de 100 em diante: três municípios têm razão exatamente 100 (inclusao_municipios.csv)", () => {
    const r = csv("public/energia/series/inclusao_municipios.csv").map((l) => Number(l.razao_proxy_atualizadas));
    expect(r.filter((x) => x > 100).length).toBe(72);
    expect(r.filter((x) => x >= 100).length).toBe(75);
    expect(r.filter((x) => x === 100).length).toBe(3);
    expect(I.mudancaCobertura(GI.cobertura)).toContain("72 passam de 100 (as faixas do histograma de 100 em diante somam 75 porque a faixa começa em 100, inclusive)");
    expect(COMPLETO.cobertura).toContain("72 passam de 100 (as faixas do histograma de 100 em diante somam 75");
  });

  it("nomes de arquivo, 'hoje' e a repetição do intervalo estatístico saíram de Entender", () => {
    for (const x of ["inclusao_municipios.csv", "inclusao_cobertura_mensal.csv", "Dados_20230713.zip", "Tradutores_20230713.zip"]) {
      expect(ENTENDER.cobertura, x).not.toContain(x);
      expect(ENTENDER.orcamento, x).not.toContain(x);
    }
    expect(COMPLETO.orcamento).toContain("Dados_20230713.zip");
    expect(COMPLETO.orcamento).not.toMatch(/\bhoje\b/);
    expect((ENTENDER.cobertura.match(/intervalo estatístico/g) ?? []).length).toBe(1);
  });
});

describe("r8 T1: texto de todas as páginas tocadas", () => {
  it("sem travessão, 'hoje', undefined ou NaN no texto do leitor (fora das fichas e dos trechos citados da fonte)", () => {
    for (const [p, texto] of Object.entries(ENTENDER)) {
      expect(texto, p).not.toMatch(/—|\bhoje\b|\bundefined\b|\bNaN\b/);
    }
  });

  it("nenhum identificador novo nos vereditos e nos avisos que mudaram", () => {
    const novos = [
      ...PAINEIS.map((p) => p[2]),
      T.textoAtualidade(GT),
      T.textoUniverso(GT),
      P.respostaRegulatorio(linhasReg),
      I.mudancaCobertura(GI.cobertura),
    ];
    for (const x of novos) {
      expect(x).not.toMatch(/\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b|\.(?:csv|json|parquet|zip)\b|sha256|HTTP \d{3}|\bP0\d\d\b|\bGDAL\b|\bpipeline\b|\bsilver\b|\bvintage\b/);
    }
  });
});
