import { describe, expect, it, vi } from "vitest";
import { createElement, type FunctionComponent, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// A busca da página de entrada usa o roteador do Next, que não existe na renderização estática do teste.
vi.mock("next/navigation", async () => ({
  ...(await vi.importActual<typeof import("next/navigation")>("next/navigation")),
  useRouter: () => ({ push: () => {}, replace: () => {}, prefetch: () => {}, back: () => {}, forward: () => {}, refresh: () => {} }),
  usePathname: () => "/saneamento",
  useSearchParams: () => new URLSearchParams(),
}));

import { agregado, etes, jmpPaises } from "@/lib/saneamento/gold";
import { BalancoHidrico, DiagramaF, EscadaJmp, NiveisTratamento, TresTs } from "@/components/saneamento/Ilustracoes";
import { DiagramaSistema } from "@/components/saneamento/DiagramaSistema";
import Entrada from "@/app/saneamento/page";
import Esgoto from "@/app/saneamento/esgoto/page";
import Financiamento from "@/app/saneamento/financiamento/page";
import Internacional from "@/app/saneamento/internacional/page";
import CompararPrestadores from "@/app/saneamento/prestadores/comparar/page";
import Saude from "@/app/saneamento/saude-ambiente/page";

/** Figuras didáticas da etapa 2: cada uma diz se é ilustração ou figura com dado, e os números recontam da gold. */
const texto = (h: string) => h.replace(/<!-- -->/g, "").replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ");
function html<P extends object>(c: (p: P) => ReactNode, p?: P): string {
  return texto(renderToStaticMarkup(createElement(c as unknown as FunctionComponent<P>, p ?? ({} as P))));
}
const br = (v: number, casas = 1) => v.toFixed(casas).replace(".", ",");

describe("Do manancial ao rio", () => {
  it("as oito etapas aparecem na ilustração, marcada como conceitual, e nas listas com o capítulo", () => {
    const h = html(DiagramaSistema);
    expect(h).toContain("Ilustração conceitual, sem escala e sem dado");
    for (const e of ["Manancial", "Captação e tratamento", "Reservação e distribuição", "Domicílio", "Coleta", "Transporte e elevatória", "Tratamento (ETE)", "Corpo receptor"]) {
      expect(h, e).toContain(e);
    }
    const bruto = renderToStaticMarkup(createElement(DiagramaSistema));
    expect(bruto.match(/role="img"/g)?.length).toBe(2); // composição larga e estreita, cada uma com descrição
  });
});

describe("Escada do JMP", () => {
  it("cada degrau reconta da gold: básico é pelo menos básico menos gerenciado", () => {
    const b24 = jmpPaises().brasil.find((b) => b.ano === 2024)!;
    const h = html(EscadaJmp);
    const g = b24.esgoto!.t.gerenciada!;
    const so = b24.esgoto!.t.basica! - g;
    expect(h).toContain(`${br(g)}%`);
    expect(h).toContain(`${br(so)}%`);
    expect(h).toContain("Figura com dados");
    expect(h).toContain("sem estimativa"); // a água superficial de 2024 não é publicada, e não vira zero
  });
});

describe("Níveis de tratamento", () => {
  it("as contagens por nível batem com o cadastro de estações em operação", () => {
    const op = etes().filter((e) => e.em_operacao === "Sim");
    const sec = op.filter((e) => e.nivel === "Secundário").length;
    const sem = op.filter((e) => !e.nivel).length;
    const contagem = Object.fromEntries(["Preliminar/acondicionamento", "Primário", "Secundário", "Terciário"].map((n) => [n, op.filter((e) => e.nivel === n).length]));
    const h = html(NiveisTratamento, { contagem, emOperacao: op.length, semNivel: sem });
    expect(h).toContain(`${sec.toLocaleString("pt-BR")} estações em operação`);
    expect(h).toContain(`${sem.toLocaleString("pt-BR")} das ${op.length.toLocaleString("pt-BR")} estações em operação`);
    expect(h).toContain("Ilustração conceitual com dados");
  });
});

describe("Diagrama F", () => {
  it("barreiras, caminhos, autoria e o que o diagrama não cobre", () => {
    const h = html(DiagramaF);
    for (const t of ["Barreira primária", "Barreira secundária", "Água", "Moscas", "Mãos", "Alimentos", "Wagner e Lanoix", "WEDC", "leptospirose"]) expect(h, t).toContain(t);
    expect(h).toContain("sem dado e sem escala");
  });
});

describe("Balanço hídrico", () => {
  it("categorias da IWA e as perdas totais do Brasil pelo IAG2013", () => {
    const iag = agregado("BR")!.sinisa.agua.indicadores.IAG2013!;
    const h = html(BalancoHidrico, { perdasBrasil: iag });
    for (const t of ["Perdas aparentes", "Perdas reais", "Água faturada", "Água não faturada", "International Water Association"]) expect(h, t).toContain(t);
    expect(h).toContain(`${br(iag)}%`);
    expect(html(BalancoHidrico, { perdasBrasil: null })).toContain("sem dado");
  });
});

describe("Tarifas, tributos e transferências", () => {
  it("as três origens somam o total e cada parcela reconta", () => {
    const h = html(TresTs, { proprios: 20, onerosos: 6, naoOnerosos: 2 });
    expect(h).toContain(`${br((20 / 28) * 100)}% do total`);
    expect(h).toContain("OCDE");
    expect(h).toContain("Financiamento");
  });
});

describe("Figuras nas páginas", () => {
  const casos: [string, () => ReactNode, string[]][] = [
    ["entrada", Entrada, ["Ilustração conceitual, sem escala e sem dado"]],
    ["internacional", Internacional, ["A escada de serviço do JMP no Brasil"]],
    ["esgoto", Esgoto, ["O que cada nível de tratamento faz, e quantas estações declaram cada um"]],
    ["saude", Saude, ["Por onde as doenças ligadas às fezes chegam a outra pessoa"]],
    ["comparar", CompararPrestadores, ["O que as perdas de água medem?", "Para onde vai a água que entra no sistema"]],
    ["financiamento", Financiamento, ["Quem paga, no fim?", "Quem paga o investimento, no fim"]],
  ];
  for (const [nome, Pagina, esperados] of casos) {
    it(`${nome}: figura presente`, () => {
      const h = html(Pagina);
      for (const t of esperados) expect(h, t).toContain(t);
    });
  }

  it("o gráfico de barras por nível saiu do capítulo 4: a ilustração traz as mesmas contagens", () => {
    expect(html(Esgoto)).not.toContain("Estações em operação por nível de tratamento informado");
  });
});
