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
const ROTAS_ASSISTENCIA = ["", "necessidades", "acesso", "acompanhamento", "cuidado", "recursos", "dados", "metodos"].map(s => `eficiencia-estatal/assistencia-social${s ? "/"+s : ""}.html`);
const ROTAS_OBRIGATORIAS = [
  ...ROTAS_ASSISTENCIA,
  "setor-eletrico.html",
  "setor-eletrico/agua-e-clima/chuva-e-temperatura.html",
  "eficiencia-estatal/educacao-municipal-capitais.html",
  "eficiencia-estatal/educacao-municipal-capitais/gastos.html",
  "eficiencia-estatal/educacao-municipal-capitais/atendimento.html",
  "eficiencia-estatal/educacao-municipal-capitais/resultados.html",
  "eficiencia-estatal/educacao-municipal-capitais/comparar.html",
  "eficiencia-estatal/educacao-municipal-capitais/metodos.html",
  "eficiencia-estatal.html",
  "eficiencia-estatal/seguranca-alimentar.html",
  "eficiencia-estatal/seguranca-alimentar/necessidades.html",
  "eficiencia-estatal/seguranca-alimentar/acesso.html",
  "eficiencia-estatal/seguranca-alimentar/qualidade.html",
  "eficiencia-estatal/seguranca-alimentar/recursos.html",
  "eficiencia-estatal/seguranca-alimentar/dados.html",
  "eficiencia-estatal/seguranca-alimentar/metodos.html",

  "eficiencia-estatal/saude-capitais.html",
  "eficiencia-estatal/saude-capitais/gastos.html",
  "eficiencia-estatal/saude-capitais/rede-e-atencao-primaria.html",
  "eficiencia-estatal/saude-capitais/atendimento-e-resultados.html",
  "eficiencia-estatal/saude-capitais/comparar.html",
  "eficiencia-estatal/saude-capitais/metodos.html",
];
/** Piso de páginas do setor elétrico: um build que gerou muito menos que isto está incompleto. */
const MINIMO_PAGINAS_SETOR_ELETRICO = 100;
/** A análise estrutural de ~360 páginas leva cerca de 7 s numa máquina local (limite padrão do Vitest: 5 s); folga para runners mais lentos. */
const LIMITE_ANALISE_MS = 120_000;

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

const ROTAS_ALIMENTARES = ROTAS_OBRIGATORIAS.filter(r => r.includes("seguranca-alimentar"));

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
  }, LIMITE_ANALISE_MS);

  it("Assistência: oito páginas de produção respeitam o contrato de HTML", (ctx) => {
    if (!temBuild && !EXIGIR) ctx.skip(AVISO_SEM_BUILD);
    const arquivos = ROTAS_ASSISTENCIA.map(r => join(APP,r));
    expect(arquivos.every(existsSync)).toBe(true);
    const { violacoes } = analisa(arquivos);
    expect(violacoes).toEqual([]);
  }, LIMITE_ANALISE_MS);

  it("Segurança alimentar: sete rotas geradas e obedecendo ao contrato de HTML", (ctx) => {
    if (!temBuild && !EXIGIR) ctx.skip(AVISO_SEM_BUILD);
    const arquivos = ROTAS_ALIMENTARES.map(r => join(APP, r));
    for (const arquivo of arquivos) expect(existsSync(arquivo), arquivo).toBe(true);
    expect(analisa(arquivos).violacoes).toEqual([]);
    expect(readFileSync(arquivos[0], "utf8")).toContain("Segurança alimentar");
  });

  it("OBEE: as páginas do painel pré-renderizadas (panorama e as cinco visões) obedecem ao mesmo contrato", (ctx) => {
    if (!temBuild && !EXIGIR) ctx.skip(AVISO_SEM_BUILD);
    if (!cobertura.obee) {
      if (EXIGIR) expect.fail(`rota do painel ausente do build: ${join(APP, "eficiencia-estatal", "educacao-municipal-capitais.html")}`);
      ctx.skip("build sem a rota do painel OBEE");
    }
    const { analises, violacoes } = analisa(cobertura.obeePaginas);
    expect(readFileSync(cobertura.obee as string, "utf-8")).toContain("Educação nas capitais");
    console.info(`HTML verificado (OBEE): ${cobertura.obeePaginas.length} páginas; literais: ${resumoLiterais(analises)}`);
    expect(violacoes).toEqual([]);
  });

  it("OBEE, Saúde nas capitais: a entrada do observatório e as seis páginas do módulo obedecem ao mesmo contrato", (ctx) => {
    if (!temBuild && !EXIGIR) ctx.skip(AVISO_SEM_BUILD);
    if (!cobertura.saude || !cobertura.entrada) {
      if (EXIGIR) expect.fail(`rota ausente do build: ${!cobertura.saude ? join(APP, "eficiencia-estatal", "saude-capitais.html") : join(APP, "eficiencia-estatal.html")}`);
      ctx.skip("build sem as rotas de Saúde nas capitais");
    }
    const arquivos = [cobertura.entrada as string, ...cobertura.saudePaginas];
    const { analises, violacoes } = analisa(arquivos);
    expect(readFileSync(cobertura.saude as string, "utf-8")).toContain("Saúde nas capitais");
    expect(cobertura.saudePaginas.length).toBeGreaterThanOrEqual(6);
    console.info(`HTML verificado (OBEE, Saúde e entrada): ${arquivos.length} páginas; literais: ${resumoLiterais(analises)}`);
    expect(violacoes).toEqual([]);
  });
});
