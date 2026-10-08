import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Verificação do HTML pré-renderizado pelo `next build`: nenhum "undefined" ou "NaN" e nenhuma
 * data ISO crua no texto que o leitor vê.
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

const SEM_UNDEFINED_NAN = /\bundefined\b|\bNaN\b/;
// data crua (AAAA-MM, AAAA-MM-DD ou instante ISO) solta no texto; identificadores com "@" ou "_" ficam de fora
const DATA_CRUA = /(^|[\s(])20\d\d[-/]\d\d([-/]\d\d)?(T[\d:]+Z?)?(?=[\s).,;]|$)/;

function htmlsEm(dir: string): string[] {
  const out: string[] = [];
  const varre = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) varre(p);
      else if (e.name.endsWith(".html")) out.push(p);
    }
  };
  if (existsSync(dir)) varre(dir);
  return out;
}

function textoVisivel(arquivo: string): string {
  return readFileSync(arquivo, "utf-8").replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ");
}

/** Todas as violações de uma lista de páginas, com o trecho, para o diagnóstico completo de uma vez. */
function violacoes(arquivos: string[]): string[] {
  const out: string[] = [];
  for (const a of arquivos) {
    const t = textoVisivel(a);
    for (const [nome, re] of [["undefined/NaN", SEM_UNDEFINED_NAN], ["data crua", DATA_CRUA]] as const) {
      const m = re.exec(t);
      if (m) out.push(`${a.replace(raiz + "/", "")}: ${nome}: «${t.slice(Math.max(0, (m.index ?? 0) - 60), (m.index ?? 0) + 80).replace(/\s+/g, " ").trim()}»`);
    }
  }
  return out;
}

const temBuild = existsSync(APP);

describe(`HTML gerado pelo build (${EXIGIR ? "verificação obrigatória" : "modo local, build opcional"})`, () => {
  it("o build existe e contém as rotas esperadas", (ctx) => {
    if (!temBuild && !EXIGIR) ctx.skip(AVISO_SEM_BUILD);
    expect(temBuild, `EXIGIR_BUILD_HTML=1, mas ${APP} não existe: o CI precisa gerar o build (npm run build) antes dos testes`).toBe(true);
    if (EXIGIR) {
      const faltando = ROTAS_OBRIGATORIAS.filter((r) => !existsSync(join(APP, r)));
      expect(faltando, `rotas esperadas ausentes do build: ${faltando.join(", ")}`).toEqual([]);
    }
  });

  it("setor elétrico: páginas pré-renderizadas não exibem undefined, NaN nem data ISO crua", (ctx) => {
    if (!temBuild && !EXIGIR) ctx.skip(AVISO_SEM_BUILD);
    const paginas = htmlsEm(join(APP, "setor-eletrico"));
    if (existsSync(join(APP, "setor-eletrico.html"))) paginas.push(join(APP, "setor-eletrico.html"));
    if (EXIGIR) {
      expect(paginas.length, `poucas páginas do setor elétrico no build (${paginas.length}); mínimo ${MINIMO_PAGINAS_SETOR_ELETRICO}`).toBeGreaterThanOrEqual(
        MINIMO_PAGINAS_SETOR_ELETRICO,
      );
    } else if (paginas.length === 0) {
      ctx.skip("build sem páginas do setor elétrico");
    }
    console.info(`HTML verificado (setor elétrico): ${paginas.length} páginas`);
    expect(violacoes(paginas)).toEqual([]);
  });

  it("OBEE: a página do painel pré-renderizada não exibe undefined, NaN nem data ISO crua", (ctx) => {
    if (!temBuild && !EXIGIR) ctx.skip(AVISO_SEM_BUILD);
    const pagina = join(APP, "eficiencia-estatal", "educacao-municipal-capitais.html");
    if (!existsSync(pagina)) {
      if (EXIGIR) expect.fail(`rota do painel ausente do build: ${pagina}`);
      ctx.skip("build sem a rota do painel OBEE");
    }
    const t = textoVisivel(pagina);
    expect(t).toContain("Educação municipal nas capitais");
    console.info("HTML verificado (OBEE): 1 página");
    expect(violacoes([pagina])).toEqual([]);
  });
});
