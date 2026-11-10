/* eslint-disable @typescript-eslint/no-explicit-any -- validação de JSON gold sem tipos gerados */
import { ABAS_SUBSTITUIDAS } from "@/lib/observatorios/registro";
import { DESTINO_DO_ENDERECO_ANTIGO } from "@/lib/observatorios/reescritos";
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { rotuloNaNavegacao } from "./suporte/navegacao-spa";
import { registroNaAplicacao, soEnderecoETitulo } from "./suporte/vistas-reescritas";

/**
 * Sanções e reclamações. O que se trava:
 * - BCB: janela de 12 meses coerente (multas ≤ decisões, PJ + PF ≤ decisões), penalidades somam as decisões,
 *   cobrança das multas soma 100, ano corrente marcado como parcial, lista recente em ordem cronológica;
 * - CVM: fases somam os processos, em curso + finalizados = processos, lista recente cronológica;
 * - regra editorial: sem ranking por instituição (cautela declarada, listas cronológicas, sem ordenação por nome);
 * - a SPA registra a aba em todos os mapas e o pipeline registra os dois coletores.
 */
const raiz = process.cwd();
const read = (p: string) => readFileSync(join(raiz, p), "utf-8");
const lerGold = (n: string) => (existsSync(join(raiz, "public/obs/data/gold", n)) ? JSON.parse(read("public/obs/data/gold/" + n)) : null);
const D = lerGold("conduta.json") ?? { disponivel: false };
const comBcb = !!D.disponivel && !!D.bcb?.disponivel;
const comCvm = !!D.disponivel && !!D.cvm?.disponivel;
const soma = (xs: any[], k: string) => xs.reduce((s, x) => s + (x[k] || 0), 0);
const cronologica = (xs: any[], k: string) => xs.every((x, i) => i === 0 || x[k] <= xs[i - 1][k]);

describe.skipIf(!comBcb)("conduta.json: PAS do BCB", () => {
  const B = D.bcb;
  it("janela de 12 meses coerente e penalidades somam as decisões", () => {
    const j = B.janela_12m;
    expect(j.decisoes).toBeGreaterThan(0);
    expect(j.processos).toBeLessThanOrEqual(j.decisoes);
    expect(j.multas_n).toBeLessThanOrEqual(j.decisoes);
    expect(j.pj + j.pf).toBeLessThanOrEqual(j.decisoes);
    expect(soma(B.penas_12m, "n")).toBe(j.decisoes);
    expect(soma(B.cobranca_multas, "share")).toBeCloseTo(100, 0);
    expect(j.multa_mediana).toBeGreaterThan(0);
  });
  it("ano a ano: corrente marcado como parcial; multas ≤ decisões; a lista recente é cronológica", () => {
    const ult = B.anual[B.anual.length - 1];
    expect(ult.incompleto).toBe(ult.ano === B.ultima_decisao.slice(0, 4));
    for (const a of B.anual) {
      expect(a.multas_n, a.ano).toBeLessThanOrEqual(a.decisoes);
      expect(a.processos, a.ano).toBeLessThanOrEqual(a.decisoes);
    }
    expect(cronologica(B.recentes, "decisao")).toBe(true);
    expect(B.recentes[0].decisao).toBe(B.ultima_decisao);
    expect(B.inabilitados.vigentes).toBe(soma(B.inabilitados.por_prazo, "n"));
  });
});

describe.skipIf(!comCvm)("conduta.json: PAS da CVM", () => {
  const C = D.cvm;
  it("fases somam os processos; em curso + finalizados = processos; lista recente cronológica", () => {
    expect(soma(C.fases, "n")).toBe(C.acervo.processos);
    expect(C.acervo.em_curso + C.acervo.finalizados).toBe(C.acervo.processos);
    expect(soma(C.anual, "processos")).toBeLessThanOrEqual(C.acervo.processos);
    expect(cronologica(C.recentes, "abertura")).toBe(true);
    expect(C.duracao_finalizados_meses.mediana).toBeGreaterThan(0);
    expect(C.nota).toMatch(/não traz o resultado/);
  });
});

describe.skipIf(!D.disponivel)("regra editorial: sem ranking por instituição", () => {
  it("cautelas declaram a regra; as listas nominais são cronológicas, sem ordenação por nome ou valor", () => {
    expect(D.cautelas.join(" ")).toMatch(/não ordena instituições/);
    // Aposentadas em 10/11/2026 (3 asserções): o texto "ordem cronológica, nunca por valor ou por nome" e a ausência de
    // "recentes.sort(" e de ordenação por multa em public/obs/app.js. Liam renderConduta, removido nessa data. A mesma regra é
    // conferida na página nova por src/tests/familias-sancoes-e-reclamacoes.test.ts ("as listas nominais seguem a ordem da
    // gold (cronológica, da mais recente para a mais antiga) e não são ordenáveis"). Aqui fica a guarda no código da página.
    const pagina = read("src/app/divida-das-familias/sancoes-e-reclamacoes/page.tsx") + read("src/lib/familias/sancoes-e-reclamacoes.ts");
    expect(pagina).not.toMatch(/recentes\w*\.sort\(|\.sort\(\(a, b\) => b\.multa/);
  });
});

describe("Aplicação do Crédito: a vista saiu, o endereço antigo fica", () => {
  it("fica o endereço antigo, que leva à página das Famílias", () => {
    // Aposentadas em 10/11/2026 (8 asserções): 'conduta: "render..."' em RENDER, a lista de golds em VIEW_DATA, a fonte em
    // VIEW_VINTAGE, os coletores em VIEW_COLETORES, o pedaço em CHUNK_OF_VIEW, o verbete do GUIA, o estado da vista (state) e
    // o contêiner id="view-conduta" do index.html. Só conferiam o registro do desenho da vista, removido de public/obs/app.js
    // nessa data. No lugar, o registro inteiro: o endereço antigo e o título ficam, o resto saiu. Pergunta, fonte, período e
    // natureza de cada número da página nova (/divida-das-familias/sancoes-e-reclamacoes) são conferidos por src/tests/familias-sancoes-e-reclamacoes.test.ts; o aviso de fonte em pane (fontePane) não
    // foi migrado, como registra docs/familias/PARIDADE.md.
    expect(registroNaAplicacao("conduta")).toEqual(soEnderecoETitulo("/conduct-enforcement", "Sanções e reclamações"));
    expect(rotuloNaNavegacao("/observatorio/conduct-enforcement")).toBeNull();
    expect(ABAS_SUBSTITUIDAS.get("/conduct-enforcement")).toBe("/divida-das-familias/sancoes-e-reclamacoes");
    expect(DESTINO_DO_ENDERECO_ANTIGO.get("/observatorio/conduct-enforcement")).toBe("/divida-das-familias/sancoes-e-reclamacoes");
  });
  it("o pipeline registra coletores e gold", () => {
    // Aposentadas em 10/11/2026 (2 asserções): a posição de "function renderConduta(" entre os marcadores do pedaço
    // emergentes. A função foi removida de public/obs/app.js; a página nova é do Next e não tem pedaço da aplicação.
    expect(read("pipeline/run.py")).toContain('("bcb_pas", bcb_pas), ("cvm_pas", cvm_pas)');
    expect(read("pipeline/gold.py")).toContain('common.write_gold("conduta.json", r_cd)');
    expect(read("src/lib/data/observatorioAbas.ts")).toContain('caminho: "/conduct-enforcement"');
  });
});
