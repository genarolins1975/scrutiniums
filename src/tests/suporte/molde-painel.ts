import { parse } from "parse5";
import { expect } from "vitest";

/**
 * Conferência da anatomia do molde de painel (PaginaPainel, Iniciativa 1 do parecer de UX de 23/10/2026), sobre o HTML que o servidor
 * entrega. Usada pelo teste do build (painel-molde.test.ts, com sessão, para cada rota de NO_MOLDE_PAINEL) e pelos testes de página que
 * renderizam o componente direto (renderToStaticMarkup). Confere invariantes, não texto: fatias na ordem, H1 e lead no comprimento, a
 * prova e a natureza de cada número, a tabela, a proveniência e o "não permite concluir" de cada figura, nenhuma tabela fora do kit, um
 * só método no fim, nenhuma data crua nem forma antiga de prontidão.
 */

type No = { nodeName: string; tagName?: string; attrs?: { name: string; value: string }[]; childNodes?: No[]; value?: string; content?: No; parentNode?: No | null };

/** Ordem das fatias; `controles` pode aparecer em qualquer ponto depois da abertura, antes do bloco que controla, e repetir. */
export const ORDEM_FATIAS = ["abertura", "numeros", "figuras", "tabelas", "notas", "metodo", "fim"] as const;
const NATUREZAS = ["OBSERVADO", "CALCULADO", "ESTIMADO", "PREVISTO", "CENARIO"];

const attr = (n: No, nome: string) => n.attrs?.find((a) => a.name === nome)?.value;
const tem = (n: No, nome: string) => attr(n, nome) !== undefined;

function* percorrer(n: No): Generator<No> {
  yield n;
  for (const f of n.childNodes ?? []) yield* percorrer(f);
  if (n.content) yield* percorrer(n.content);
}

function todos(raiz: No, f: (n: No) => boolean): No[] {
  return [...percorrer(raiz)].filter((n) => n.tagName && f(n));
}

/** Texto visível de um nó: sem script, style e template; espaços normalizados. */
export function textoDe(n: No): string {
  const partes: string[] = [];
  const ir = (x: No) => {
    if (x.nodeName === "#text") partes.push(x.value ?? "");
    if (x.tagName && ["script", "style", "template", "noscript"].includes(x.tagName)) return;
    for (const f of x.childNodes ?? []) ir(f);
  };
  ir(n);
  return partes.join(" ").replace(/\s+/g, " ").trim();
}

/** Filhos elemento de um nó (ignora texto e comentário). */
const filhos = (n: No) => (n.childNodes ?? []).filter((f) => f.tagName);

/**
 * `comprimento`: o teto de 60 caracteres do H1 e de 220 do lead vale para o texto português, a língua da plataforma (decisão do dono de
 * 22/10/2026, "seguir sempre o padrão de comprimento"); a irmã inglesa do Setor Elétrico é tradução e fica fora desse teto.
 */
export function conferirPainel(rota: string, html: string, { comprimento = true }: { comprimento?: boolean } = {}): void {
  const doc = parse(html) as unknown as No;
  const paineis = todos(doc, (n) => attr(n, "data-painel") !== undefined);
  expect(paineis.map((p) => attr(p, "data-painel")), `${rota}: um só elemento do molde (data-painel)`).toEqual([rota]);
  const painel = paineis[0];
  expect(["main", "div"], `${rota}: o molde é o <main> ou um <div> dentro do <main> do layout`).toContain(painel.tagName);

  // fatias conhecidas e na ordem; controles repete e fica junto do bloco
  const fatias = todos(painel, (n) => tem(n, "data-fatia")).map((n) => attr(n, "data-fatia")!);
  const semControles = fatias.filter((f) => f !== "controles");
  const posicoes = semControles.map((f) => (ORDEM_FATIAS as readonly string[]).indexOf(f));
  expect(posicoes.every((p) => p >= 0), `${rota}: fatias conhecidas (${fatias.join(", ")})`).toBe(true);
  expect(new Set(semControles).size, `${rota}: nenhuma fatia repetida além de controles (${fatias.join(", ")})`).toBe(semControles.length);
  expect([...posicoes].sort((a, b) => a - b), `${rota}: ordem ${fatias.join(", ")}`).toEqual(posicoes);
  expect(semControles[0], `${rota}: a abertura vem primeiro`).toBe("abertura");
  expect(semControles.slice(-2), `${rota}: método e fim por último`).toEqual(["metodo", "fim"]);
  if (fatias.includes("controles")) expect(fatias.indexOf("controles"), `${rota}: controles depois da abertura`).toBeGreaterThan(0);

  // H1 único com até 60 caracteres; lead com até 220
  const h1s = todos(doc, (n) => n.tagName === "h1").map(textoDe);
  expect(h1s.length, `${rota}: H1 único`).toBe(1);
  if (comprimento) expect(h1s[0].length, `${rota}: H1 "${h1s[0]}" com até 60 caracteres`).toBeLessThanOrEqual(60);
  const abertura = todos(painel, (n) => attr(n, "data-abertura") === "painel");
  expect(abertura.length, `${rota}: AberturaPainel`).toBe(1);
  const lead = todos(abertura[0], (n) => n.tagName === "p" && (attr(n, "class") ?? "").split(" ").includes("t-lead"));
  expect(lead.length, `${rota}: lead`).toBe(1);
  if (comprimento) expect(textoDe(lead[0]).length, `${rota}: lead com até 220 caracteres`).toBeLessThanOrEqual(220);
  const recorte = todos(abertura[0], (n) => tem(n, "data-recorte"));
  expect(recorte.length, `${rota}: linha de recorte`).toBe(1);
  expect(textoDe(recorte[0]), `${rota}: recorte com período, universo e fonte`).toMatch(/\S · \S[\s\S]*(Fonte|Source): \S/);
  const limite = todos(abertura[0], (n) => tem(n, "data-limite"));
  expect(limite.length, `${rota}: limite`).toBe(1);
  expect(textoDe(limite[0]).length, `${rota}: limite escrito`).toBeGreaterThan(30);

  // números: natureza, prova (fonte · período) e, ausente, o motivo
  const numeros = todos(painel, (n) => tem(n, "data-numero-indicador"));
  for (const n of numeros) {
    const nome = attr(n, "aria-label");
    expect(NATUREZAS, `${rota}: natureza de "${nome}"`).toContain(attr(n, "data-natureza"));
    const [fonte, periodo] = (attr(n, "data-prova-numero") ?? "").split(" · ");
    expect(Boolean(fonte?.trim() && periodo?.trim()), `${rota}: fonte e período de "${nome}"`).toBe(true);
    if (tem(n, "data-ausente")) {
      const motivo = todos(n, (x) => tem(x, "data-motivo-ausencia")).map(textoDe).join("");
      expect(motivo.length, `${rota}: motivo da ausência de "${nome}"`).toBeGreaterThan(10);
    }
  }
  const faixa = todos(painel, (n) => attr(n, "data-fatia") === "numeros");
  if (faixa.length) {
    const nNumeros = todos(faixa[0], (n) => tem(n, "data-numero-indicador")).length;
    expect(nNumeros, `${rota}: de 1 a 4 números na faixa`).toBeGreaterThanOrEqual(1);
    expect(nNumeros).toBeLessThanOrEqual(4);
  }

  // figuras: gráfico (ou mapa e figura legados), tabela equivalente, proveniência e "não permite concluir"
  const figuras = todos(painel, (n) => tem(n, "data-figura-analitica"));
  for (const f of figuras) {
    const id = attr(f, "id");
    expect(todos(f, (n) => tem(n, "data-grafico") || tem(n, "data-mapa-legado") || tem(n, "data-figura-legado")).length, `${rota}#${id}: gráfico`).toBeGreaterThan(0);
    const equivalente = todos(f, (n) => tem(n, "data-tabela-equivalente"));
    expect(equivalente.length, `${rota}#${id}: tabela equivalente`).toBe(1);
    if (tem(equivalente[0], "data-na-figura")) {
      // a figura aponta a tabela que já traz (o ranking ordenável): ela tem de estar dentro da figura, no kit
      expect(todos(f, (n) => n.tagName === "table" && tem(n, "data-tabela-dados")).length, `${rota}#${id}: a tabela que a figura aponta`).toBeGreaterThan(0);
    } else {
      expect(todos(equivalente[0], (n) => n.tagName === "details").length, `${rota}#${id}: tabela equivalente em <details>`).toBeGreaterThan(0);
      expect(todos(equivalente[0], (n) => n.tagName === "table").length, `${rota}#${id}: <table> na tabela equivalente`).toBe(1);
    }
    expect(todos(f, (n) => tem(n, "data-proveniencia")).length, `${rota}#${id}: proveniência`).toBe(1);
    const nao = todos(f, (n) => tem(n, "data-nao-concluir"));
    expect(nao.length, `${rota}#${id}: não permite concluir`).toBe(1);
    expect(textoDe(nao[0]).length, `${rota}#${id}: não permite concluir escrito`).toBeGreaterThan(40);
  }
  // figuras e tabelas: só peças do kit e Recolhido como blocos de primeiro nível
  for (const [fatia, aceitos] of [
    ["figuras", ["data-figura-analitica", "data-recolhido", "data-fatia"]],
    ["tabelas", ["data-bloco-tabela", "data-tabela-a-vista", "data-tabela-recolhida", "data-tabela-ordenavel", "data-recolhido", "data-fatia"]],
  ] as const) {
    for (const bloco of todos(painel, (n) => attr(n, "data-fatia") === fatia)) {
      for (const filho of filhos(bloco)) {
        expect(aceitos.some((a) => tem(filho, a)), `${rota}: bloco de primeiro nível em ${fatia} fora do kit (<${filho.tagName} ${(filho.attrs ?? []).map((a) => a.name).join(" ")}>)`).toBe(true);
      }
    }
  }
  // nenhuma <table> fora do kit: a TabelaDados (data-tabela-dados) ou a tabela equivalente que o próprio gráfico monta (dentro de data-grafico)
  const tabelas = todos(painel, (n) => n.tagName === "table");
  const dentroDeGrafico = (t: No) => {
    for (let p = t.parentNode; p; p = p.parentNode) if (tem(p, "data-grafico")) return true;
    return false;
  };
  const fora = tabelas.filter((t) => !tem(t, "data-tabela-dados") && !dentroDeGrafico(t));
  expect(fora.map((t) => attr(t, "class") ?? "(sem classe)"), `${rota}: <table> fora de TabelaDados`).toEqual([]);

  // um só método, um <details>, antes do fim
  const metodo = todos(painel, (n) => attr(n, "data-fatia") === "metodo");
  expect(metodo.length, `${rota}: um só método`).toBe(1);
  expect(metodo[0].tagName, `${rota}: método em <details>`).toBe("details");

  // texto visível: nenhuma data ISO, nenhum UTC, nenhuma forma antiga de prontidão, nenhuma numeração "01 ·", nenhum undefined ou NaN
  const texto = textoDe(painel);
  expect(texto.match(/\b\d{4}-\d{2}-\d{2}\b/g) ?? [], `${rota}: data ISO no texto`).toEqual([]);
  expect(texto, `${rota}: hora em UTC no texto`).not.toMatch(/\bUTC\b/);
  expect(texto, `${rota}: forma antiga de prontidão`).not.toMatch(/Versão em desenvolvimento|Em desenvolvimento|\(previsto\)|Estados · Piloto|RECORTE PARCIAL/);
  const rotulos = todos(painel, (n) => /\brotulo\b/.test(attr(n, "class") ?? "") || /^h[2-4]$/.test(n.tagName ?? "")).map(textoDe);
  expect(rotulos.filter((r) => /^\d{2}\s*·/.test(r)), `${rota}: seção numerada "01 ·"`).toEqual([]);
  expect(texto, `${rota}: undefined ou NaN no texto`).not.toMatch(/\bundefined\b|\bNaN\b/);

  // navegação é link: nenhum data-view nem onclick em <a>
  for (const a of todos(doc, (n) => n.tagName === "a")) expect(tem(a, "data-view") || tem(a, "onclick"), `${rota}: link com data-view ou onclick`).toBe(false);
}
