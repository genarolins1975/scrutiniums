import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseFragment, type DefaultTreeAdapterMap } from "parse5";
import { describe, expect, it, vi } from "vitest";
import type { ExpansaoGold } from "@/lib/energia/tipos-expansao";
import type { MetaGold } from "@/lib/energia/tipos";

// Só a leitura das duas golds nomeadas é substituída. Páginas, modelos,
// catálogo, demais arquivos e componentes continuam reais, sem prop EN fictícia.
const troca = vi.hoisted(() => {
  const estado: { expansao: ExpansaoGold | null; meta: MetaGold | null } = { expansao: null, meta: null };
  return estado;
});
vi.mock("@/lib/energia/gold", async (original) => {
  const modulo = await original<typeof import("@/lib/energia/gold")>();
  return { ...modulo,
    lerGold: (nome: string) => nome === "expansao.json" && troca.expansao !== null ? troca.expansao : modulo.lerGold(nome),
    gold: { ...modulo.gold, meta: () => troca.meta ?? modulo.gold.meta() },
  };
});

import AnaliseEmpresas from "@/app/setor-eletrico/empresas/analise/page";
import DatasetPage from "@/app/setor-eletrico/dados/[dataset]/page";
import CronogramaPage from "@/app/setor-eletrico/expansao/cronograma/page";
import GeracaoTransmissaoPage from "@/app/setor-eletrico/expansao/geracao-e-transmissao/page";

type No = DefaultTreeAdapterMap["node"];
type Elemento = DefaultTreeAdapterMap["element"];
const filhos = (no: No): No[] => "childNodes" in no ? no.childNodes : [];
const atributo = (no: Elemento, nome: string) => no.attrs.find((a) => a.name === nome)?.value;
function elementos(no: No): Elemento[] {
  return [...("tagName" in no ? [no] : []), ...filhos(no).flatMap(elementos)];
}
function texto(no: No): string {
  return "value" in no ? no.value : filhos(no).map(texto).join("");
}
function unico(nos: Elemento[], predicado: (no: Elemento) => boolean): Elemento {
  const encontrados = nos.filter(predicado);
  expect(encontrados).toHaveLength(1);
  return encontrados[0];
}
const tag = (nos: Elemento[], nome: string) => unico(nos, (no) => no.tagName === nome);
const analisar = (html: string) => elementos(parseFragment(html));
const ler = (arquivo: string) => readFileSync(join(process.cwd(), arquivo), "utf8");
function congelar<T extends object>(valor: T): T {
  for (const filho of Object.values(valor)) if (filho !== null && typeof filho === "object") congelar(filho);
  return Object.freeze(valor);
}

describe("folhas PT: formatos privados no SSR das páginas reais", () => {
  it("mantém uma casa fixa, percentual e totais do estudo documental da Copel", () => {
    const arquivo = "public/energia/estudos/copel-2025.json", antes = ler(arquivo);
    const nos = analisar(renderToStaticMarkup(createElement(AnaliseEmpresas)));
    const estudo = elementos(unico(nos, (no) => atributo(no, "id") === "estudos-empresas"));
    const barras = estudo.filter((no) => no.tagName === "div" && filhos(no).filter((filho) => "tagName" in filho).map((filho) => "tagName" in filho ? filho.tagName : "").join(",") === "span,div,span");
    expect(barras.map((no) => filhos(no).filter((filho) => "tagName" in filho && filho.tagName === "span").map(texto)))
      .toEqual([["Geração e transmissão", "626,7"], ["Distribuição", "2.959,0"], ["Comercialização", "2,0"], ["Serviços", "1,1"], ["Holding", "3,7"]]);
    expect(estudo.filter((no) => no.tagName === "p").map(texto)).toContain("Barras partem de zero; escala comum de 0 a R$ 3.000 milhões. Total: R$ 3.592,5 milhões. Distribuição: 82,4% do total.");
    expect(elementos(tag(estudo, "tbody")).filter((no) => no.tagName === "td").map(texto))
      .toEqual(["2.875,0", "979,3", "2.790,2", "54,7", "-172,4", "6.526,9"]);
    expect(ler(arquivo)).toBe(antes);
  });

  it("preserva o callback em cada grupo de quatro dígitos, inclusive ano e zeros iniciais", () => {
    const arquivo = "public/energia/gold/meta.json", original = ler(arquivo);
    const fixture: MetaGold = JSON.parse(original);
    const fonte = fixture.fontes.ear_subsistema_di;
    if (!fonte) throw new Error("A fixture de meta precisa conter ear_subsistema_di.");
    if (!fonte.ultima_tentativa) throw new Error("A fixture de meta precisa conter a última tentativa da fonte.");
    fonte.ultima_tentativa.detalhe = "lote 00001234, ano 2026, linhas 12345, código 123";
    const antes = structuredClone(fixture);
    congelar(fixture);
    const props: ComponentProps<typeof DatasetPage> = { params: { dataset: "ons-ear-subsistema" } };
    troca.meta = fixture;
    try {
      const nos = analisar(renderToStaticMarkup(createElement(DatasetPage, props)));
      const dt = unico(nos, (no) => no.tagName === "dt" && texto(no) === "Última tentativa de coleta direta");
      if (!dt.parentNode) throw new Error("Tentativa sem linha de definição.");
      expect(texto(tag(elementos(dt.parentNode), "dd")).endsWith(" · lote 1.234, ano 2.026, linhas 12.345, código 123")).toBe(true);
      expect(fixture).toEqual(antes);
      expect(ler(arquivo)).toBe(original);
    } finally { troca.meta = null; }
  });

  it("mantém precisão nativa da tolerância fracionária em kW", () => {
    const arquivo = "public/energia/gold/expansao.json", original = ler(arquivo);
    const fixture: ExpansaoGold = JSON.parse(original);
    expect(fixture.disponivel).toBe(true);
    fixture.conferencias.liberacoes_detalhado_x_resumo.tolerancia_kw = 1234.5678;
    const antes = structuredClone(fixture);
    congelar(fixture);
    troca.expansao = fixture;
    try {
      const nos = analisar(renderToStaticMarkup(createElement(CronogramaPage)));
      const auditoria = elementos(unico(nos, (no) => atributo(no, "id") === "auditoria-cronograma"));
      const nota = unico(auditoria, (no) => no.tagName === "p" && texto(no).startsWith("Histórico da fonte:"));
      expect(texto(nota)).toContain(" grupos (ano e tipo) iguais, tolerância de 1.234,568 kW; resultado: ");
      expect(fixture).toEqual(antes);
      expect(ler(arquivo)).toBe(original);
    } finally { troca.expansao = null; }
  });

  it("mostra deságios divergentes, nulos e a generalização sem arredondar os dados", () => {
    const arquivo = "public/energia/gold/expansao.json", original = ler(arquivo);
    const fixture: ExpansaoGold = JSON.parse(original);
    expect(fixture.disponivel).toBe(true);
    const rede = fixture.transmissao.rede_epe;
    if (!rede) throw new Error("A fixture de expansão precisa conter rede_epe.");
    // Valores sintéticos de apresentação; nenhuma conferência é recalculada ou publicada.
    fixture.transmissao.leiloes.desagio_inconsistente = [
      { lote: "Fixture divergente", desagio_fonte_pct: 12.3456, desagio_calculado_pct: 23.4567 },
      { lote: "Fixture ausente", desagio_fonte_pct: null, desagio_calculado_pct: null },
    ];
    rede.generalizacao_grau = 0.0123456;
    const antes = structuredClone(fixture);
    congelar(fixture);
    troca.expansao = fixture;
    try {
      const nos = analisar(renderToStaticMarkup(createElement(GeracaoTransmissaoPage)));
      const auditoria = elementos(unico(nos, (no) => atributo(no, "id") === "auditoria-transmissao"));
      const tabela = unico(auditoria, (no) => no.tagName === "table" && elementos(no).some((filho) => filho.tagName === "caption" && texto(filho) === "Lotes com deságio publicado divergente do calculado pela RAP"));
      const linhas = elementos(tag(elementos(tabela), "tbody")).filter((no) => no.tagName === "tr");
      expect(linhas.map((no) => elementos(no).filter((celula) => celula.tagName === "td" || celula.tagName === "th").map(texto)))
        .toEqual([["Fixture divergente", "12,346", "23,457"], ["Fixture ausente", "sem dado", "sem dado"]]);
      const nota = unico(auditoria, (no) => no.tagName === "p" && texto(no).startsWith("Rede da EPE:"));
      expect(texto(nota)).toContain("; geometria generalizada a 0,012 grau;");
      expect(elementos(nota).filter((no) => no.tagName === "span").map(texto)).toEqual([rede.existente.sha256, rede.planejada.sha256]);
      expect(fixture).toEqual(antes);
      expect(ler(arquivo)).toBe(original);
    } finally { troca.expansao = null; }
  });
});
