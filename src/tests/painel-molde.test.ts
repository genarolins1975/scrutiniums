import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { paineis } from "@/lib/observatorios/registro";
import { exigirBuild, htmlDe, raiz, subirServidor, temBuild, type ServidorProducao } from "./suporte/servidor-producao";
import { NO_MOLDE } from "./suporte/entradas-molde";
import { A_MIGRAR, FORA_DO_MOLDE, NO_MOLDE_PAINEL, NO_MOLDE_PAINEL_EN } from "./suporte/paineis-molde";
import { conferirPainel } from "./suporte/molde-painel";

/**
 * Molde único das páginas de painel (PaginaPainel, Iniciativa 1 do parecer de UX de 23/10/2026). No HTML que o servidor entrega, com
 * sessão, para cada rota de NO_MOLDE_PAINEL e a irmã inglesa: o elemento do molde, as fatias na ordem, H1 e lead no comprimento, recorte e
 * limite na abertura, a natureza e a prova de cada número, a tabela equivalente, a proveniência e o "não permite concluir" de cada figura,
 * nenhuma tabela fora do kit, um só método no fim, nenhuma data ISO nem hora UTC no texto, nenhuma forma antiga de prontidão nem seção
 * numerada (conferirPainel, em suporte/molde-painel.ts).
 *
 * Inventário: toda rota de painel do registro e toda rota de src/app abaixo das entradas está no molde, a migrar (com o grupo) ou fora
 * do molde com o motivo; nenhuma é esquecida, nenhuma está em duas listas e nenhuma lista cita rota que não existe.
 */

/** Seção 5.1 do prompt (calculada em 23/10/2026 de paraVoce.ts e navegacaoDaColecao). */
const GRUPO_1 = `/agronegocio/atlas /agronegocio/clima-ambiente /agronegocio/prato /agronegocio/tamanho /combustiveis/no-meu-estado
/contas-publicas/metas /contas-publicas/por-area /eficiencia-estatal/assistencia-social/necessidades /eficiencia-estatal/cultura/rede
/eficiencia-estatal/educacao-municipal-capitais /eficiencia-estatal/energia-conectividade /eficiencia-estatal/habitacao/deficit
/eficiencia-estatal/indice-de-resultados /eficiencia-estatal/judiciario/panorama /eficiencia-estatal/meio-ambiente-clima/riscos
/eficiencia-estatal/mobilidade-transporte/tempo /eficiencia-estatal/saude-capitais /eficiencia-estatal/saude-capitais/gastos
/eficiencia-estatal/seguranca-publica/estados /eficiencia-estatal/trabalho-renda/acesso-ao-trabalho /gas-natural/gas-de-cozinha
/gas-natural/gnv-e-gas-encanado /observatorio-do-credito/quanto-meu-banco-cobra /observatorio-do-credito/simulador-da-parcela
/saneamento/municipio /saneamento/preco-regulado/simulador /saneamento/tarifa-social /setor-eletrico/conta-de-luz
/setor-eletrico/inclusao-energetica/tarifa-social /setor-eletrico/qualidade /territorio/desastres /territorio/queimadas`.split(/\s+/);

const rotasDoApp: string[] = JSON.parse(readFileSync(join(raiz, "src/lib/uso/rotas-do-app.json"), "utf-8"));

/** A rota concreta existe no app: igual a uma página, ou casa com o padrão dinâmico dela ([x] é um segmento; [[...x]], o resto opcional). */
function existeNoApp(rota: string): boolean {
  // rota de servidor (route.ts) que entrega HTML não está na lista de páginas; a aplicação do Crédito (/observatorio) vem do registro
  if (existsSync(join(raiz, "src/app", rota, "route.ts"))) return true;
  if (paineis().some((p) => p.rota.split(/[?#]/)[0] === rota)) return true;
  return rotasDoApp.some((p) => {
    if (p === rota) return true;
    const re = new RegExp(
      `^${p
        .replace(/\/\[\[\.\.\.[^\]]+\]\]/g, "(?:/.+)?")
        .replace(/\/\[\.\.\.[^\]]+\]/g, "/.+")
        .replace(/\/\[[^\]]+\]/g, "/[^/]+")}$`,
    );
    return re.test(rota);
  });
}

describe("molde de painel: inventário", () => {
  it("toda rota de painel está no molde, a migrar com o grupo, ou fora do molde com o motivo, e só numa lista", () => {
    const entradas = NO_MOLDE.filter((e) => !e.startsWith("/observatorios/"));
    const universo = new Set<string>();
    for (const p of paineis()) universo.add(p.rota.split(/[?#]/)[0]);
    for (const r of rotasDoApp) if (entradas.some((e) => r.startsWith(`${e}/`))) universo.add(r);
    const listas = [new Set(NO_MOLDE_PAINEL), new Set(Object.keys(A_MIGRAR)), new Set(Object.keys(FORA_DO_MOLDE))];
    const esquecidas = [...universo].filter((r) => !listas.some((l) => l.has(r)));
    expect(esquecidas, "rotas sem lista").toEqual([]);
    const repetidas = [...universo, ...listas.flatMap((l) => [...l])].filter((r) => listas.filter((l) => l.has(r)).length > 1);
    expect([...new Set(repetidas)], "rotas em mais de uma lista").toEqual([]);
    for (const [r, motivo] of Object.entries(FORA_DO_MOLDE)) expect(motivo.length, r).toBeGreaterThan(10);
  });

  it("nenhuma lista cita rota que não existe no app", () => {
    for (const r of [...NO_MOLDE_PAINEL, ...NO_MOLDE_PAINEL_EN, ...Object.keys(A_MIGRAR), ...Object.keys(FORA_DO_MOLDE)]) expect(existeNoApp(r), r).toBe(true);
  });

  // PR 1 (Grupo 1): as 32 páginas da seção 5.1 do prompt estão no molde e nenhuma rota fica a migrar no Grupo 1; o teste do PR 0 contava
  // as que faltavam, este confere a lista inteira
  it("o Grupo 1 tem as 32 páginas da seção 5.1 do prompt, todas no molde", () => {
    expect(GRUPO_1.length).toBe(32);
    expect(GRUPO_1.filter((r) => !NO_MOLDE_PAINEL.includes(r)), "do Grupo 1 fora do molde").toEqual([]);
    expect(Object.entries(A_MIGRAR).filter(([, g]) => g === 1).map(([r]) => r), "a migrar no Grupo 1").toEqual([]);
  });
});

describe("molde de painel: build", () => {
  it("o build existe quando o CI exige", () => {
    if (exigirBuild) expect(temBuild, "rodar npm run build antes dos testes").toBe(true);
  });
});

describe.skipIf(!temBuild)("molde de painel no HTML do servidor (build de produção, com sessão)", () => {
  let s: ServidorProducao;
  beforeAll(async () => {
    s = await subirServidor("painel");
  }, 120_000);
  afterAll(async () => {
    await s?.parar();
  });

  it.each(NO_MOLDE_PAINEL)("%s segue o molde", async (rota) => {
    const { status, html } = await htmlDe(s, rota, true);
    expect(status, rota).toBe(200);
    conferirPainel(rota, html);
  }, 60_000);

  it.each(NO_MOLDE_PAINEL_EN)("%s segue o molde (irmã inglesa)", async (rota) => {
    const { status, html } = await htmlDe(s, rota, true);
    expect(status, rota).toBe(200);
    // o mesmo componente marca a rota portuguesa do painel (é o mesmo painel)
    conferirPainel(rota.replace(/^\/en/, ""), html, { comprimento: false });
  }, 60_000);
});
