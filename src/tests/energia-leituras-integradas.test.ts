import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { BLOCOS_COMERCIAIS, bateriaDidatica, cargaDataCenter, liquidacaoDidatica, razaoPositiva, variacaoComparavel } from "../lib/energia/leitura-integrada";
import { anosDaEmpresa, leituraEmpresa, prepararEmpresas, type AnoEmpresa } from "../lib/energia/empresas-leitura";
import type { EmpresasGold, SeriesFinanceiras } from "../lib/energia/tipos-empresas";

describe("liquidação didática preserva perfil e sinais", () => {
  it("saldo de volume zero pode produzir débito financeiro", () => {
    const r = liquidacaoDidatica(BLOCOS_COMERCIAIS, 180)!;
    expect(r.consumo).toBe(100); expect(r.contrato).toBe(100);
    expect(r.saldo).toBe(0); expect(r.resultado).toBe(-5250); expect(r.custoEnergia).toBe(23250);
  });
  it("casamento por bloco elimina apenas o ajuste de energia modelado", () => {
    const r = liquidacaoDidatica(BLOCOS_COMERCIAIS.map(b => ({ ...b, contrato: b.consumo })), 180)!;
    expect(r.resultado).toBe(0); expect(r.custoEnergia).toBe(18000);
  });
  it("o efeito de subir o preço só incide no saldo do bloco", () => {
    const base = liquidacaoDidatica(BLOCOS_COMERCIAIS, 180)!;
    const alta = liquidacaoDidatica(BLOCOS_COMERCIAIS.map((b,i) => ({...b,pld:b.pld+(i===3?100:0)})),180)!;
    expect(alta.custoEnergia-base.custoEnergia).toBe(1500);
  });
  it("crédito reduz custo contratual e agregação com preço uniforme concilia", () => {
    const r = liquidacaoDidatica([{nome:"a",contrato:2,consumo:1,pld:100}],180)!;
    expect(r.resultado).toBe(100);expect(r.custoEnergia).toBe(260);
    expect(liquidacaoDidatica(BLOCOS_COMERCIAIS.map(b=>({...b,pld:200})),180)!.resultado).toBe(0);
  });
  it("rejeita valores inválidos sem transformá-los em zero", () => {
    expect(liquidacaoDidatica([], 180)).toBeNull();
    expect(liquidacaoDidatica([{nome:"a",consumo:NaN,contrato:1,pld:100}],180)).toBeNull();
  });
});
describe("energia, duração e rendimento", () => {
  it("conserva energia no ciclo e usa a energia de entrada para o custo", () => {
    const b = bateriaDidatica(50,200,.85,100,300)!;
    expect(b.duracao).toBe(4);expect(b.entrada*.85).toBeCloseTo(200);
    expect(b.entrada-b.perdas).toBeCloseTo(200);
    expect(b.margemBruta).toBeCloseTo(36470.588235);
  });
  it("mesmo preço de compra e venda gera margem negativa quando há perdas", () => {
    expect(bateriaDidatica(50,200,.85,100,100)!.margemBruta).toBeLessThan(0);
    expect(bateriaDidatica(50,200,1,100,100)!.margemBruta).toBe(0);
  });
  it("dobrar potência reduz duração sem criar energia", () => {
    const a=bateriaDidatica(50,200,.85,100,300)!, b=bateriaDidatica(100,200,.85,100,300)!;
    expect(b.duracao).toBe(a.duracao/2);expect(b.entrada).toBe(a.entrada);
  });
  it("bloqueia rendimento impossível e potência nula", () => {
    expect(bateriaDidatica(0,200,.85,100,300)).toBeNull();
    expect(bateriaDidatica(50,200,1.1,100,300)).toBeNull();
  });
  it("converte MW médios em GWh anuais sem confundir potência TI com instalação", () => {
    const d=cargaDataCenter(100,.8,1.3)!;
    expect(d.mwMedios).toBe(104);expect(d.gwhAno).toBeCloseTo(911.04);expect(d.gwhTI).toBeCloseTo(700.8);
    expect(cargaDataCenter(100,.8,.9)).toBeNull();
  });
});
describe("comparação financeira", () => {
  it("não produz percentuais com denominador nulo ou negativo", () => {
    expect(variacaoComparavel(10,0)).toBeNull();expect(variacaoComparavel(10,-5)).toBeNull();
    expect(variacaoComparavel(null,10)).toBeNull();expect(razaoPositiva(0,10)).toBe(0);
    expect(razaoPositiva(-5,10)).toBe(-50);
  });
  it("não compara exercícios não consecutivos", () => {
    const atual: AnoEmpresa = {ano:2025,valores:{receita:100,ebit:10,lucro_liquido:5,caixa_operacional:12,caixa_investimento:-9,divida_bruta:40,caixa:8}};
    const l=leituraEmpresa(atual,{...atual,ano:2023});
    expect(l.variacaoReceita).toBeNull();expect(l.deltaLucro).toBeNull();expect(l.caixaAposInvestimento).toBe(3);
  });
  it("não faz fallback de consolidado para individual", () => {
    const serie: SeriesFinanceiras["series"][string]={anual:{ind:{receita:[[2025,100]],lucro_liquido:[[2025,0]]}},trimestral:{}};
    expect(anosDaEmpresa(serie,"con")).toEqual([]);
    expect(anosDaEmpresa(serie,"ind")[0].valores).toMatchObject({receita:100,lucro_liquido:0,caixa:null});
  });
  it("preserva os valores e a unidade da publicação em todas as companhias ativas", () => {
    const g=JSON.parse(readFileSync("public/energia/gold/empresas.json","utf8")) as EmpresasGold;
    const f=JSON.parse(readFileSync("public/energia/series/empresas_financas.json","utf8")) as SeriesFinanceiras;
    const es=prepararEmpresas(g.financas.companhias,f.series,null);
    expect(es.length).toBe(g.financas.companhias.filter(c=>c.situacao==="ATIVO").length);
    for(const e of es) for(const esc of ["con","ind"] as const) for(const a of e.series[esc]) for(const [conta,valor] of Object.entries(a.valores)) {
      const original=f.series[e.cnpj]?.anual[esc]?.[conta as keyof AnoEmpresa["valores"]]?.find(p=>p[0]===a.ano)?.[1] ?? null;
      expect(valor).toBe(original);
    }
  });
});
describe("estudo documental da Copel", () => {
  it("reconcilia categorias e totais da fonte sem arredondar parcelas", () => {
    const c=JSON.parse(readFileSync("public/energia/estudos/copel-2025.json","utf8"));
    expect(c.investimentos.reduce((s:number,x:Record<string,number>)=>s+x["2025"],0)).toBeCloseTo(c.total_investimentos["2025"]);
    expect(c.investimentos.reduce((s:number,x:Record<string,number>)=>s+x["2024"],0)).toBeCloseTo(c.total_investimentos["2024"]);
    expect(c.ebitda_2025.reduce((s:number,x:{valor:number})=>s+x.valor,0)).toBeCloseTo(c.total_ebitda_2025);
  });
});
