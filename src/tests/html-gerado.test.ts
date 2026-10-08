import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { CLASSES_LITERAL } from "@/lib/literais-fonte";
import { analisaHtml, coberturaDoBuild, descreve, type Analise } from "./support/html-contrato";

/**
 * Verificação do HTML pré-renderizado pelo `next build`, pelo contrato estrutural de
 * src/tests/support/html-contrato.ts: prosa sem data ISO crua nem undefined/NaN, atributos de
 * máquina livres e literais da fonte só dentro do registro de src/lib/literais-fonte.ts.
 *
 * Dois modos, ditos no log de cada execução:
 *  - obrigatório (EXIGIR_BUILD_HTML=1, definido no CI): ausência do build, de uma rota esperada
 *    ou de páginas a inspecionar REPROVA. Nunca retorna sucesso sem verificar nada.
 *  - local sem build: os testes ficam marcados como ignorados (não como aprovados), com o motivo.
 *
 * Antes, o teste do setor elétrico retornava cedo sem o diretório `.next`, e o CI não gerava build:
 * a asserção nunca rodava no CI (achado de 08/10/2026, PR #117).
 */
const raiz = process.cwd();
const EXIGIR = process.env.EXIGIR_BUILD_HTML === "1";
const APP = join(raiz, ".next", "server", "app");
const AVISO_SEM_BUILD = "sem build local (.next/server/app); rode `npm run build` e defina EXIGIR_BUILD_HTML=1 para a verificação obrigatória";

/** Rotas que precisam existir no build quando a verificação é obrigatória. */
const ROTAS_OBRIGATORIAS = [
  "setor-eletrico.html",
  "setor-eletrico/agua-e-clima/chuva-e-temperatura.html",
  "eficiencia-estatal/educacao-municipal-capitais.html",
];
/** Piso de páginas do setor elétrico: um build que gerou muito menos que isto está incompleto. */
const MINIMO_PAGINAS_SETOR_ELETRICO = 100;

const cobertura = coberturaDoBuild(APP, ROTAS_OBRIGATORIAS, MINIMO_PAGINAS_SETOR_ELETRICO, { existsSync, readdirSync }, join);
const temBuild = cobertura.existe;
const rotaDe = (arquivo: string) => "/" + relative(APP, arquivo).replace(/\.html$/, "");

function analisa(arquivos: string[]): { analises: Analise[]; violacoes: string[] } {
  const analises = arquivos.map((a) => analisaHtml(readFileSync(a, "utf-8"), rotaDe(a)));
  return { analises, violacoes: analises.flatMap((x) => x.violacoes).map(descreve) };
}

/** Linha de resumo dos literais encontrados, por classe, para o log do CI. */
function resumoLiterais(analises: Analise[]): string {
  const n: Record<string, number> = {};
  for (const a of analises) for (const l of a.literais) n[l.classe] = (n[l.classe] ?? 0) + 1;
  return CLASSES_LITERAL.map((c) => `${c}=${n[c] ?? 0}`).join(", ");
}

describe(`HTML gerado pelo build (${EXIGIR ? "verificação obrigatória" : "modo local, build opcional"})`, () => {
  it("o build existe e contém as rotas esperadas", (ctx) => {
    if (!temBuild && !EXIGIR) ctx.skip(AVISO_SEM_BUILD);
    expect(cobertura.erros, cobertura.erros.join("; ")).toEqual([]);
  });

  it("setor elétrico: prosa sem data ISO crua nem undefined/NaN; literais só dentro do contrato", (ctx) => {
    if (!temBuild && !EXIGIR) ctx.skip(AVISO_SEM_BUILD);
    if (EXIGIR) expect(cobertura.erros, cobertura.erros.join("; ")).toEqual([]);
    else if (cobertura.setor.length === 0) ctx.skip("build sem páginas do setor elétrico");
    const { analises, violacoes } = analisa(cobertura.setor);
    console.info(`HTML verificado (setor elétrico): ${cobertura.setor.length} páginas; literais: ${resumoLiterais(analises)}`);
    expect(violacoes).toEqual([]);
  });

  it("OBEE: a página do painel pré-renderizada obedece ao mesmo contrato", (ctx) => {
    if (!temBuild && !EXIGIR) ctx.skip(AVISO_SEM_BUILD);
    if (!cobertura.obee) {
      if (EXIGIR) expect.fail(`rota do painel ausente do build: ${join(APP, "eficiencia-estatal", "educacao-municipal-capitais.html")}`);
      ctx.skip("build sem a rota do painel OBEE");
    }
    const { analises, violacoes } = analisa([cobertura.obee as string]);
    expect(readFileSync(cobertura.obee as string, "utf-8")).toContain("Educação municipal nas capitais");
    console.info(`HTML verificado (OBEE): 1 página; literais: ${resumoLiterais(analises)}`);
    expect(violacoes).toEqual([]);
  });
});
