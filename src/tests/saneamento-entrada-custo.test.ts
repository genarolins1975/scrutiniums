import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parse, type DefaultTreeAdapterMap } from "parse5";
import dados from "@/lib/saneamento/dados/tarifas.json";
import { calcularConta } from "@/lib/saneamento/conta";
import { categoriaComparavel } from "@/lib/saneamento/simulador";
import { TARIFAS } from "@/lib/saneamento/tarifas";
import { data, inteiro, reais } from "@/lib/saneamento/formato";
import { numeroContaResidencial, resumoContaResidencial } from "@/lib/saneamento/escala-conta";
import Entrada from "@/app/saneamento/page";

vi.mock("next/navigation", async () => ({
  ...(await vi.importActual<typeof import("next/navigation")>("next/navigation")),
  useRouter: () => ({ push() {}, replace() {}, prefetch() {} }),
  usePathname: () => "/saneamento",
  useSearchParams: () => new URLSearchParams(),
}));

type No = DefaultTreeAdapterMap["node"];
function elementos(no: No, atributo: string): DefaultTreeAdapterMap["element"][] {
  return [ ...("tagName" in no && no.attrs.some((a) => a.name === atributo) ? [no] : []),
    ...("childNodes" in no ? no.childNodes.flatMap((n) => elementos(n, atributo)) : []) ];
}
function texto(no: No): string {
  return "value" in no ? no.value : "childNodes" in no ? no.childNodes.map(texto).join(" ").replace(/\s+/g, " ") : "";
}

describe("Onda S1, pacote C: custo residencial na entrada", () => {
  it("usa todas as tabelas e o mesmo cálculo residencial do simulador, inclusive variantes", () => {
    const valores = TARIFAS.map((t) => calcularConta(t.categorias[categoriaComparavel(t, "residencial")!], 10).total).sort((a, b) => a - b);
    const r = resumoContaResidencial();
    expect(r.tabelas).toBe(dados.tarifas.length);
    expect(r.minimo).toBe(Math.min(...valores));
    expect(r.maximo).toBe(Math.max(...valores));
    const centro = (valores.length - 1) / 2;
    expect(r.mediana).toBe((valores[Math.floor(centro)] + valores[Math.ceil(centro)]) / 2);
    expect(r.prestadores).toBe(new Set(dados.tarifas.map((t) => t.prestadorSinisa)).size);
    expect(r.municipios).toBe(new Set(dados.tarifas.flatMap((t) => t.municipios)).size);
    const datas = dados.tarifas.map((t) => t.acessado).sort();
    expect([r.consultaInicial, r.consultaFinal]).toEqual([datas[0], datas.at(-1)]);
  });

  it("não converte amostra vazia ou serviço não verificado em conta de água e esgoto", () => {
    expect(resumoContaResidencial([])).toMatchObject({ minimo: null, maximo: null, mediana: null });
    const t = TARIFAS[0];
    const semEsgoto = { ...t, categorias: { residencial: { ...t.categorias.residencial, esgoto: undefined } } };
    expect(resumoContaResidencial([t, semEsgoto])).toMatchObject({ minimo: null, maximo: null, mediana: null });
    const unica = calcularConta(t.categorias.residencial, 10).total;
    expect(resumoContaResidencial([t])).toMatchObject({ minimo: unica, maximo: unica, mediana: unica });
  });

  it("publica o quarto número com faixa, mediana, amostra, período e caminho ao simulador", () => {
    const arvore = parse(renderToStaticMarkup(createElement(Entrada)));
    const escala = elementos(arvore, "data-numero-escala");
    // Decisão do dono, pacote C de 25/10/2026: quarto número e ressalva literal de amostra, dependentes de D-S1 para merge.
    expect(escala).toHaveLength(4);
    const r = resumoContaResidencial();
    const n = numeroContaResidencial();
    const custo = texto(escala[3]);
    expect(custo).toContain(`Conta de água e esgoto de ${r.consumo} m³ por mês, nas tabelas verificadas`);
    for (const valor of [r.minimo, r.maximo, r.mediana]) expect(custo).toContain(reais(valor));
    expect(custo).toContain(`Amostra: ${inteiro(r.tabelas)} tabelas de ${inteiro(r.prestadores)} prestadores, em ${inteiro(r.municipios)} municípios; não é média do Brasil`);
    for (const consulta of [r.consultaInicial, r.consultaFinal]) expect(custo).toContain(data(consulta));
    expect(custo).toContain(n.fonte);
    expect(elementos(escala[3], "href").some((e) => e.attrs.some((a) => a.name === "href" && a.value === n.href))).toBe(true);
    expect(custo).not.toMatch(/undefined|NaN|\b\d{4}-\d{2}-\d{2}\b/);
  });
});
