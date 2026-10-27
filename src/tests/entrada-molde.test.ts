import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { inventario } from "@/lib/observatorios/inventario";
import { exigirBuild, htmlDe, raiz, subirServidor, temBuild, type ServidorProducao } from "./suporte/servidor-producao";
import { NO_MOLDE } from "./suporte/entradas-molde";

/**
 * Molde único das páginas de entrada (Iniciativa 4 do parecer de UX de 21/10/2026; EntradaColecao). No HTML que o servidor
 * entrega, com sessão: H1 único e com até 60 caracteres; a escala com um a quatro números, cada um com fonte e período; o bloco
 * "Para você"; um ModeloDidatico com a lista do que fica de fora; as fatias na ordem do molde; um único <details> de método, no
 * fim; nenhum link para destino em preparação; nenhuma forma antiga de prontidão.
 *
 * As entradas passam para o molde em PRs por grupo: `NO_MOLDE` cresce a cada PR e `A_MIGRAR` encolhe, e um teste confere que
 * toda entrada do inventário está numa das duas listas (nenhuma é esquecida).
 */

/** Entradas ainda fora do molde, com o grupo do PR que as migra (a aplicação do Crédito é a Iniciativa 8). Vazia desde o Grupo C. */
const A_MIGRAR: Record<string, string> = {};

/**
 * Coleções cuja porta é o próprio painel (os temas da Eficiência Estatal e do Território e Clima): não são páginas de entrada e
 * ficam fora do molde; valem para elas a navegação de módulo e o orçamento de comprimento (ux-orcamentos-comprimento).
 */
const PAINEIS: string[] = [
  "/eficiencia-estatal/trabalho-renda",
  "/eficiencia-estatal/assistencia-social",
  "/eficiencia-estatal/habitacao",
  "/eficiencia-estatal/saude-capitais",
  "/eficiencia-estatal/seguranca-publica",
  "/eficiencia-estatal/judiciario",
  "/eficiencia-estatal/cultura",
  "/eficiencia-estatal/mobilidade-transporte",
  "/eficiencia-estatal/meio-ambiente-clima",
  "/agronegocio/ambiente",
  "/territorio/queimadas",
  "/territorio/desastres",
];

/** H1 acima de 60 caracteres que ficou à espera de copy do dono (data da pendência). Vazia desde 22/10/2026: as três propostas foram aprovadas. */
const H1_PENDENTE: Record<string, string> = {};

/** Ordem das fatias do molde (data-fatia). */
// Pedido do dono, PROMPT_CODEX_EDUCACAO.md PR 1 (25/10/2026): extrato opcional antes da escala, sem mudar as demais fatias.
// Pedido do dono, 27/10/2026: escolha e resposta específica precedem o panorama nacional.
const ORDEM = ["abertura", "resposta", "seu-municipio", "escala", "consulta", "para-voce", "destinos", "secao-propria", "artefato", "caminhos", "recolhidos", "convite", "metodo"];

const texto = (h: string) => h.replace(/<[^>]+>/g, "").replace(/&nbsp;|\s+/g, " ").replace(/&amp;/g, "&").trim();

/**
 * O elemento do molde (data-entrada): o primeiro <main> da página, ou um <div> logo dentro do <main> do layout da coleção (o
 * Agronegócio abre o <main> no layout), do começo ao fecho do <main>.
 */
function principal(html: string): string {
  const ini = html.indexOf("<main");
  const m = html.slice(ini).match(/^<main[^>]*data-entrada="[a-z]+"|^<main[^>]*>\s*<div[^>]*data-entrada="[a-z]+"/);
  expect(m, "o elemento do molde (data-entrada)").not.toBeNull();
  return html.slice(ini, html.lastIndexOf("</main>") + 7);
}

/** Trecho de um elemento pelo marcador do atributo, até o fecho da mesma tag (com aninhamento). */
function elemento(h: string, marca: string): string {
  const pos = h.indexOf(marca);
  if (pos < 0) return "";
  const ini = h.lastIndexOf("<", pos);
  const tag = h.slice(ini + 1).match(/^[a-z0-9]+/)![0];
  let nivel = 0;
  for (const m of h.slice(ini).matchAll(new RegExp(`<(/?)${tag}\\b[^>]*>`, "g"))) {
    nivel += m[1] ? -1 : 1;
    if (nivel === 0) return h.slice(ini, ini + m.index! + m[0].length);
  }
  return h.slice(ini);
}

function conferirMolde(rota: string, html: string) {
  const m = principal(html);
  // H1 único, com até 60 caracteres (ou a pendência de copy registrada)
  const h1s = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)].map((x) => texto(x[1]));
  expect(h1s, `${rota}: H1 único`).toHaveLength(1);
  if (!H1_PENDENTE[rota]) expect(h1s[0].length, `${rota}: "${h1s[0]}" com até 60 caracteres`).toBeLessThanOrEqual(60);
  // fatias na ordem do molde
  const fatias = [...m.matchAll(/data-fatia="([a-z-]+)"/g)].map((x) => x[1]);
  const posicoes = fatias.map((f) => ORDEM.indexOf(f));
  expect(posicoes.every((p) => p >= 0), `${rota}: fatias conhecidas ${fatias.join(", ")}`).toBe(true);
  expect([...posicoes].sort((a, b) => a - b), `${rota}: ordem ${fatias.join(", ")}`).toEqual(posicoes);
  // escala: de um a quatro números, cada um com fonte e período
  const escala = elemento(m, 'data-fatia="escala"');
  const numeros = escala.split("data-numero-escala").slice(1);
  expect(numeros.length, `${rota}: números da escala`).toBeGreaterThanOrEqual(1);
  expect(numeros.length).toBeLessThanOrEqual(4);
  for (const n of numeros) {
    const prova = n.match(/data-prova-numero="">([\s\S]*?)<\/span>/);
    expect(prova, `${rota}: prova do número`).not.toBeNull();
    const [fonte, periodo] = texto(prova![1]).split(" · ");
    expect(fonte?.length && periodo?.length, `${rota}: fonte e período em "${texto(prova![1])}"`).toBeTruthy();
  }
  // Para você e o modelo didático com o que fica de fora
  expect(fatias, `${rota}: Para você`).toContain("para-voce");
  const artefato = elemento(m, 'data-fatia="artefato"');
  expect(artefato, `${rota}: ModeloDidatico`).toContain("data-modelo-didatico");
  expect(elemento(artefato, "data-deixa-de-fora"), `${rota}: o que fica de fora`).toMatch(/<li\b/);
  // um único <details> de método, a última fatia
  expect(fatias.filter((f) => f === "metodo"), `${rota}: método`).toHaveLength(1);
  expect(fatias.at(-1)).toBe("metodo");
  expect(elemento(m, 'data-fatia="metodo"')).toMatch(/^<details\b/);
  // destino em preparação nunca é link
  for (const a of m.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/g)) expect(a[1], `${rota}: link para destino em preparação`).not.toContain('data-prontidao="preparacao"');
  // nenhuma forma antiga de prontidão
  expect(texto(m)).not.toMatch(/Versão em desenvolvimento|Em desenvolvimento|\(previsto\)|Estados · Piloto/);
}

describe("molde das entradas: inventário", () => {
  it("toda entrada do inventário está no molde ou na lista do grupo que a migra", () => {
    const entradas = new Set<string>();
    for (const o of inventario()) {
      if (o.entrada) entradas.add(o.entrada);
      for (const c of o.colecoes) entradas.add(c.href.split(/[?#]/)[0]);
    }
    // a aplicação do Crédito (/observatorio) e as coleções servidas por ela são a Iniciativa 8
    const fora = [...entradas].filter((r) => r !== "/observatorio" && !r.startsWith("/observatorio/") && !NO_MOLDE.includes(r) && !(r in A_MIGRAR) && !PAINEIS.includes(r));
    expect(fora).toEqual([]);
    for (const r of NO_MOLDE) expect(r in A_MIGRAR, r).toBe(false);
  });

  it("nenhuma forma antiga de prontidão no código da interface: todas passam pelo SeloProntidao", () => {
    const antigas = /Versão em desenvolvimento|['">]Em desenvolvimento|\(previsto\)|Estados · Piloto|tx\("[Ee]m (integração|preparação)"|· em integração|· Em preparação/;
    const achados: string[] = [];
    const varrer = (dir: string) => {
      for (const n of readdirSync(dir)) {
        const p = join(dir, n);
        if (statSync(p).isDirectory()) varrer(p);
        else if (/\.(tsx?|css)$/.test(n) && !p.endsWith("SeloProntidao.tsx")) {
          readFileSync(p, "utf-8")
            .split("\n")
            .forEach((l, i) => {
              // comentário pode citar a forma antiga para explicar a troca
              if (antigas.test(l) && !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l)) achados.push(`${p.slice(raiz.length + 1)}:${i + 1}`);
            });
        }
      }
    };
    varrer(join(raiz, "src", "components"));
    varrer(join(raiz, "src", "app"));
    expect(achados).toEqual([]);
  });
});

describe("molde das entradas: build", () => {
  it("o build existe quando o CI exige", () => {
    if (exigirBuild) expect(temBuild, "rodar npm run build antes dos testes").toBe(true);
  });
});

describe.skipIf(!temBuild)("molde das entradas no HTML do servidor (build de produção, com sessão)", () => {
  let s: ServidorProducao;
  beforeAll(async () => {
    s = await subirServidor("molde");
  }, 120_000);
  afterAll(async () => {
    await s?.parar();
  });

  it.each(NO_MOLDE)("%s segue o molde", async (rota) => {
    const { status, html } = await htmlDe(s, rota, true);
    expect(status, rota).toBe(200);
    conferirMolde(rota, html);
  }, 60_000);
});
