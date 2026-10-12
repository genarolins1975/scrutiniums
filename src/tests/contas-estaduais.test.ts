import { comparar, mediana, csvComparacao, lerFiltrosComparacao } from "../lib/contas-estaduais/comparacao";
import { GET as exportarComparacao } from "../app/contas-publicas-estaduais/comparacao.csv/route";
import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { ANOS, catalogo, conferir, cobertura, csvCobertura, dividaPrimaria, execucaoPrimaria, primarios, matriz, observacao, razao, recorte, snapshot } from "../lib/contas-estaduais/dados";

describe("Contas estaduais: elegibilidade e rastreabilidade", () => {
 it("preserva zero e dívida negativa; bloqueia denominadores inválidos", () => {
  expect(razao(0, 100)).toBe(0);
  expect(razao(-10, 100)).toBe(-10);
  for (const d of [null, 0, -1, NaN, Infinity]) expect(razao(10, d)).toBeNull();
  expect(razao(null, 100)).toBeNull();
  expect(razao(Infinity, 100)).toBeNull();
 });
 it("não promove compatibilidade aritmética a validação primária", () => {
  expect(conferir(24.4,100,24.4).compativel).toBe(true);
  expect(conferir(24.46,100,24.4).compativel).toBe(false);
  expect(conferir(null,100,24.4).compativel).toBe(false);
  expect(conferir(24.4,100,NaN).compativel).toBe(false);
  expect(matriz(2026).filter(r => r.conferidoNaFonte)).toHaveLength(27);
 });
 it("confere AM e TO pela resposta original sem alterar o snapshot", () => {
  const pendentes=snapshot.ufs.filter(u=>cobertura(u,2026,"CE-11")==="divergencia_aritmetica");
  expect(pendentes.map(u=>u.uf)).toEqual([]);
  expect(cobertura(snapshot.ufs.find(u=>u.uf==="PE")!,2026,"CE-11")).toBe("fonte_primaria_conferida");
 });
 it("cruza todas as UFs com todos os contratos, sem preencher ausências", () => {
  expect(new Set(snapshot.ufs.map(u=>u.uf)).size).toBe(27);
  expect(new Set(catalogo.indicadores.map(i=>i.id)).size).toBe(48);
  expect(matriz(2025)).toHaveLength(1296);
  expect(matriz(2025).filter(r=>r.status==="nao_sondado")).toHaveLength(27*43);
  const ap=snapshot.ufs.find(u=>u.uf==="AP")!;
  const falta=ANOS.find(a=>a!==ap.exercicio && !ap.serie.some(s=>s.ano===a))!;
  expect(observacao(ap,falta).valor).toBeNull();
  expect(cobertura(ap,falta,"CE-11")).toBe("sem_registro_snapshot");
  expect(cobertura(ap,falta,"CE-04")).toBe("nao_sondado");
 });
 it("distingue encerramento de exercício de período parcial", () => {
  const pe=snapshot.ufs.find(u=>u.uf==="PE")!;
  expect(observacao(pe,2025)).toMatchObject({valor:31.75,parcial:false});
  expect(observacao(pe,2026)).toMatchObject({valor:24.37,parcial:true});
  expect(observacao(pe,2026).periodo).toContain("1º quadrimestre");
 });
 it("conserva o DF e saneia os parâmetros compartilháveis", () => {
  expect(recorte("DF","2025")).toEqual({uf:"DF",ano:2025});
  expect(recorte("XX","2030")).toEqual({uf:"PE",ano:2025});
  expect(recorte(null,"NaN")).toEqual({uf:"PE",ano:2025});
 });
 it("exporta o universo completo e a incerteza, com CSV em português", () => {
  const csv=csvCobertura(2026);
  expect(csv.startsWith("\uFEFF")).toBe(true);
  expect(csv.split("\r\n")).toHaveLength(1297);
  expect(csv).toContain('"AM";"2026";"CE-11";"RGF";"fonte_primaria_conferida";"true"');
  expect(csv).toContain('"DF";"2026";"CE-48"');
 });
 it("preserva os valores monetários e séries da origem quando a gold tem o blob fixado", () => {
  const bytes=readFileSync("public/obs/data/gold/subnacional.json");
  const blob=createHash("sha1").update("blob "+bytes.length+"\0").update(bytes).digest("hex");
  // A gold de produção é atualizada pelo pipeline. Esta versão é independente
  // dessas atualizações, portanto a comparação de bytes só vale no mesmo blob.
  if(blob!==snapshot.proveniencia.gitBlob) return;
  const original=JSON.parse(bytes.toString()).divida.ufs;
  for(const u of snapshot.ufs) {
   const fonte=original.find((o: {uf:string})=>o.uf===u.uf);
   for(const campo of ["dcl","rcl","dcl_rcl_pct","serie"] as const) expect(u[campo]).toEqual(fonte[campo]);
  }
 });
 it("não estende a conferência para outro ano, UF ou indicador", () => {
  expect(matriz(2025).filter(r=>r.conferidoNaFonte)).toHaveLength(135);
  expect(matriz(2024).filter(r=>r.conferidoNaFonte)).toHaveLength(0);
  expect(execucaoPrimaria("PE",2026)).toBeUndefined();
  expect(execucaoPrimaria("XX",2025)).toBeUndefined();
  expect(dividaPrimaria("AM",2026)?.valores.percentual_declarado).toBe(20.65);
  expect(snapshot.ufs.find(u=>u.uf==="AM")!.dcl_rcl_pct).toBe(20.6);
 });
 it("publica percentuais reproduzíveis e preserva o sinal do erro da receita", () => {
  expect(execucaoPrimaria("SP",2025)!.indicadores["CE-01"]).toBeLessThan(0);
  for(const r of primarios.rreo) {
   expect(r.indicadores["CE-04"]).toBeCloseTo(100*r.valores.liquidada/r.valores.dotacao_atualizada,10);
   expect(r.indicadores["CE-06"]).toBeCloseTo(100*r.valores.paga/r.valores.liquidada,10);
  }
  for(const r of primarios.rgf) {
   expect(Math.abs(r.diferenca_pp)).toBeLessThanOrEqual(.005);
   for(const f of r.fontes) expect(createHash("sha256").update(readFileSync("public"+f.arquivo)).digest("hex")).toBe(f.sha256);
  }
 });

});


describe("Comparação estadual: população da referência",()=>{
 it("calcula mediana sem ponderação e preserva zero e negativos",()=>{
  expect(mediana([])).toBeNull();
  expect(mediana([-3,0,3])).toBe(0);
  expect(mediana([1,100,2,3])).toBe(2.5);
 });
 it("separa as competências do DF na referência por padrão",()=>{
  const estados=comparar(2025,"CE-04"), todos=comparar(2025,"CE-04","Todas",true);
  expect(estados.elegiveis).toBe(26);expect(estados.universo).toBe(26);
  expect(estados.linhas.some(l=>l.uf==="DF")).toBe(false);
  expect(todos.elegiveis).toBe(27);
  expect(comparar(2025,"CE-04","Nordeste").elegiveis).toBe(9);
  expect(comparar(2025,"CE-04","Centro-Oeste").elegiveis).toBe(3);
 });
 it("não usa o snapshot herdado nem mistura anos na mediana",()=>{
  expect(comparar(2024,"CE-11").elegiveis).toBe(0);
  expect(comparar(2026,"CE-04").referencia).toBeNull();
  expect(comparar(2026,"CE-11").elegiveis).toBe(26);
 });
 it("exporta precisamente o universo e as fontes do recorte",()=>{
  const csv=csvComparacao(2025,"CE-04","Nordeste");
  expect(csv.split("\r\n")).toHaveLength(10);
  expect(csv).toContain('"PE";"Pernambuco";"Nordeste";"2025";"CE-04"');
  expect(csv).not.toContain('"DF";');
  expect(csv).toContain('sha256');
 });
 it("rejeita filtros inválidos e entrega CSV como arquivo",async()=>{
  expect(exportarComparacao(new Request('https://example.test?indicador=CE-48')).status).toBe(400);
  const r=exportarComparacao(new Request('https://example.test?ano=2025&indicador=CE-04&regiao=Nordeste'));
  expect(r.status).toBe(200);expect(r.headers.get('content-disposition')).toContain('attachment');
  expect((await r.text()).split('\r\n')).toHaveLength(10);
 });
});

describe("Comparação compartilhável",()=>{
 it("restaura todos os filtros do endereço e saneia entradas desconhecidas",()=>{
  expect(lerFiltrosComparacao({indicador:'CE-11',regiao:'Norte',df:'1',ordem:'valor'})).toEqual({indicador:'CE-11',regiao:'Norte',df:true,ordem:'valor'});
  expect(lerFiltrosComparacao({indicador:'CE-48',regiao:'Inválida',df:'true',ordem:'melhor'})).toEqual({indicador:'CE-04',regiao:'Todas',df:false,ordem:'uf'});
 });
 it("recusa opção ambígua do DF na exportação",()=>{
  expect(exportarComparacao(new Request('https://example.test?df=true')).status).toBe(400);
 });
});
