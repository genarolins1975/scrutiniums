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
  expect(matriz(2026).filter(r => r.conferidoNaFonte)).toHaveLength(6);
 });
 it("mantém TO pendente e confere AM pela resposta original sem alterar o snapshot", () => {
  const pendentes=snapshot.ufs.filter(u=>cobertura(u,2026,"CE-11")==="divergencia_aritmetica");
  expect(pendentes.map(u=>u.uf)).toEqual(["TO"]);
  expect(cobertura(snapshot.ufs.find(u=>u.uf==="PE")!,2026,"CE-11")).toBe("fonte_primaria_conferida");
 });
 it("cruza todas as UFs com todos os contratos, sem preencher ausências", () => {
  expect(new Set(snapshot.ufs.map(u=>u.uf)).size).toBe(27);
  expect(new Set(catalogo.indicadores.map(i=>i.id)).size).toBe(48);
  expect(matriz(2025)).toHaveLength(1296);
  expect(matriz(2025).filter(r=>r.status==="nao_sondado")).toHaveLength(27*47-24);
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
  expect(matriz(2025).filter(r=>r.conferidoNaFonte)).toHaveLength(30);
  expect(matriz(2024).filter(r=>r.conferidoNaFonte)).toHaveLength(0);
  expect(execucaoPrimaria("PE",2026)).toBeUndefined();
  expect(execucaoPrimaria("TO",2025)).toBeUndefined();
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
