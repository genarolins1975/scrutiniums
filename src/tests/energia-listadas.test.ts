import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ListadasPage from "@/app/setor-eletrico/empresas/listadas/page";
import FichaListada, { generateStaticParams } from "@/app/setor-eletrico/empresas/listadas/[papel]/page";
import {
  contagemAtuacao,
  matrizAtuacao,
  participacoesCruzadas,
  respostaPanorama,
  serieBase100,
  textoControle,
  textoCruzada,
} from "@/lib/energia/listadas";
import type { ListadasGold, ManifestoLogos } from "@/lib/energia/tipos-listadas";

/**
 * Companhias listadas (carteira do IEE da B3): a gold reproduz os CSV publicados por outro caminho, a matriz de atuação lê os ativos
 * sem inventar zero, as frases saem só dos números da gold, os logos vêm do manifesto com origem e sha256, e as páginas renderizam
 * com as seções, os laboratórios e as fichas de todas as companhias.
 */
const raiz = process.cwd();
const G = JSON.parse(readFileSync(join(raiz, "public/energia/gold/listadas.json"), "utf-8")) as ListadasGold;
const L = JSON.parse(readFileSync(join(raiz, "public/energia/logos/manifesto.json"), "utf-8")) as ManifestoLogos;
const csv = (nome: string) => {
  const [cab, ...linhas] = readFileSync(join(raiz, "public/energia/series", nome), "utf-8").trim().split("\n");
  const cols = cab.replace(/^﻿/, "").split(";");
  return linhas.map((l) => Object.fromEntries(l.split(";").map((v, i) => [cols[i], v])));
};

describe("listadas: gold contra os arquivos publicados", () => {
  it("universo é a carteira do IEE, com pesos somando 100% e um CNPJ conferido por papel", () => {
    expect(G.disponivel).toBe(true);
    expect(G.companhias.length).toBe(G.universo.papeis);
    expect(G.companhias.reduce((a, c) => a + c.iee.peso_pct, 0)).toBeCloseTo(100, 1);
    for (const c of G.companhias) {
      expect(c.cnpj, c.papel).toMatch(/^\d{14}$/);
      expect(c.conferencia_cnpj.resultado, c.papel).toBe("igual");
    }
    const carteira = csv("listadas_carteira_iee.csv");
    expect(new Set(carteira.map((r) => r.papel))).toEqual(new Set(G.companhias.map((c) => c.papel)));
  });

  it("potência sob controle é a soma das usinas em operação do CSV de usinas da mesma companhia", () => {
    const us = csv("listadas_usinas.csv");
    for (const c of G.companhias) {
      const soma = us.filter((u) => u.papel === c.papel && u.fase === "Operação").reduce((a, u) => a + Number(u.mw), 0);
      expect(soma, c.papel).toBeCloseTo(c.geracao.mw_controle, 0);
      expect(us.filter((u) => u.papel === c.papel && u.fase === "Operação").length).toBe(c.geracao.usinas_controle);
    }
  });

  it("companhia no topo da cadeia tem a mesma potência do grupo no módulo Empresas", () => {
    const grupos = new Map(csv("empresas_grupos.csv").map((r) => [r.grupo_cnpj, r]));
    const topo = G.companhias.filter((c) => c.controle.topo_cnpj === c.cnpj && grupos.has(c.cnpj!));
    expect(topo.length).toBeGreaterThan(3);
    for (const c of topo) expect(c.geracao.mw_controle, c.papel).toBeCloseTo(Number(grupos.get(c.cnpj!)!.mw_controle), 0);
  });

  it("retorno total publicado fecha com o índice diário do CSV de cotações", () => {
    const cot = csv("listadas_cotacoes.csv");
    for (const c of G.companhias) {
      const r = c.bolsa?.retorno_12m;
      if (!r) continue;
      const linhas = new Map(cot.filter((x) => x.papel === c.papel).map((x) => [x.data, x]));
      const calc = 100 * (Number(linhas.get(r.ate)!.indice_retorno_total) / Number(linhas.get(r.de)!.indice_retorno_total) - 1);
      expect(calc, c.papel).toBeCloseTo(r.total_pct!, 1);
      // retorno total nunca abaixo do de preço: proventos não são negativos
      expect(r.total_pct! + 1e-9).toBeGreaterThanOrEqual(r.preco_pct!);
    }
  });

  it("série recomeçada por evento sem fator não publica retorno desde 2020", () => {
    for (const c of G.companhias) {
      const b = c.bolsa!;
      if (b.serie_reiniciada_em) {
        expect(b.retorno_desde_2020, c.papel).toBeNull();
        expect(b.primeiro_pregao).toBe(b.serie_reiniciada_em);
        expect(b.notas.join(" ")).toMatch(/não publica o fator/);
      }
      expect(b.saltos, c.papel).toEqual([]);
    }
  });

  it("pessoa física nunca aparece com nome nos acionistas", () => {
    const ac = csv("listadas_acionistas.csv");
    expect(ac.filter((a) => a.tipo === "PF")).toEqual([]);
    for (const a of ac.filter((x) => x.tipo === "pessoas_fisicas")) expect(a.acionista).toMatch(/^\d+ pessoas? físicas?$/);
  });
});

describe("listadas: derivações da interface", () => {
  it("matriz não transforma ausência de segmento em barra zero", () => {
    const m = matrizAtuacao(G);
    for (const linha of m) {
      const c = G.companhias.find((x) => x.papel === linha.papel)!;
      if (!c.transmissao) expect(linha.celulas.transmissao.valor).toBeNull();
      if (!c.distribuicao) expect(linha.celulas.distribuicao.texto).toBe("não atua");
      for (const cel of Object.values(linha.celulas)) expect(cel.fracao).toBeLessThanOrEqual(1);
    }
    const n = contagemAtuacao(G);
    expect(respostaPanorama(G)).toContain(`${n.geracao} controlam usinas`);
  });

  it("frase de controle cita só controladores marcados no FRE e soma pessoas físicas", () => {
    for (const c of G.companhias) {
      const t = textoControle(c);
      const ctrl = (c.controle.fre?.acionistas ?? []).filter((a) => a.controlador && a.tipo !== "coletivo");
      if (!ctrl.length && !c.controle.fre?.pessoas_fisicas?.controladores) expect(t).toMatch(/Nenhum acionista marcado/);
      expect(t).not.toMatch(/\.\./);
    }
  });

  it("participação cruzada em controle compartilhado fica fora das medidas da investidora", () => {
    const cx = participacoesCruzadas(G);
    for (const x of cx) {
      const t = textoCruzada(x, (c) => c.papel);
      if (x.em.controle.motivo_parada === "compartilhado" && x.em.controle.topo_cnpj === x.em.cnpj) expect(t).toMatch(/compartilhado/);
    }
  });

  it("base 100 começa em 100 nas duas linhas", () => {
    for (const c of G.companhias) {
      const s = serieBase100(c.bolsa!);
      if (!s.length) continue;
      expect(s[0].preco).toBeCloseTo(100, 6);
      expect(s[0].total).toBeCloseTo(100, 6);
    }
  });
});

describe("listadas: logos", () => {
  it("cada papel tem logo com origem e sha256 ou ausência com motivo", () => {
    for (const c of G.companhias) {
      const l = L.logos.find((x) => x.papel === c.papel);
      expect(l, c.papel).toBeTruthy();
      expect(l!.cnpj_holding).toBe(c.cnpj);
      if (l!.arquivo) {
        expect(l!.url_origem).toMatch(/^https:\/\//);
        expect(l!.sha256).toMatch(/^[0-9a-f]{64}$/);
        expect(l!.arquivo).toMatch(/^\/energia\/logos\/[a-z0-9]+\.(svg|png)$/);
        expect(["claro", "escuro"]).toContain(l!.fundo);
        const bytes = readFileSync(join(raiz, "public", l!.arquivo));
        expect(bytes.length).toBe(l!.bytes);
      } else {
        expect(l!.ausencia?.motivo.length).toBeGreaterThan(10);
      }
    }
  });
});

describe("listadas: páginas", () => {
  const html = renderToStaticMarkup(createElement(ListadasPage));
  it("panorama tem as seções, os laboratórios, a tabela e os logos", () => {
    for (const id of ["quem", "ativos", "controle", "desempenho", "comparacao", "movimentos", "lab-controle", "lab-retorno"]) expect(html, id).toContain(`id="${id}"`);
    expect(html).toContain('data-matriz-atuacao=""');
    expect(html).toContain('data-lab="controle"');
    expect(html).toContain('data-lab="retorno"');
    expect((html.match(/data-logo="/g) ?? []).length).toBeGreaterThanOrEqual(L.logos.filter((l) => l.arquivo).length);
    expect(html).not.toMatch(/undefined|NaN/);
  });
  it("uma ficha por companhia, com estrutura, finanças, bolsa e movimentos", () => {
    const ps = generateStaticParams();
    expect(ps.map((p) => p.papel).sort()).toEqual(G.companhias.map((c) => c.slug).sort());
    for (const p of ps) {
      const f = renderToStaticMarkup(createElement(FichaListada, { params: p }));
      for (const id of ["ativos", "controle", "movimentos"]) expect(f, `${p.papel} ${id}`).toContain(`id="${id}"`);
      expect(f, p.papel).toContain('data-estrutura=""');
      expect(f, p.papel).not.toMatch(/undefined|NaN/);
    }
  });
});
