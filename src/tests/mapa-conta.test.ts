import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { inventario, totais } from "@/lib/observatorios/inventario";
import { OBSERVATORIOS } from "@/lib/observatorios/lista";
import { FRESCOR_NO_MAPA } from "@/lib/observatorios/mapaConta";
import { FRESCOR_DAS_COLECOES } from "@/lib/frescor/entradas";
import { DOMINIOS } from "@/lib/dominios";
import { exigirBuild, htmlDe, raiz, subirServidor, temBuild, type ServidorProducao } from "./suporte/servidor-producao";

/**
 * Mapa da conta, "Encontre o painel" (/app/observatorios; Iniciativa M1 do parecer de UX de 23/10/2026). No HTML que o build
 * entrega com sessão, em dois casos: a conta nova (sem último acesso, recorte ou aviso) e a conta que volta (cookie
 * `c:setor-eletrico`, um recorte salvo e um aviso). Invariantes, sem texto literal além do que o dono decidiu (o H1 "Encontre o
 * painel", decisão registrada em navegacao-colecao.test.ts) e das frases de estado vazio que não podem voltar:
 *  - um elemento do mapa, fatias conhecidas e na ordem; `retomar` só quando há o que retomar;
 *  - cada uma das 28 coleções exatamente uma vez como link no diretório, os seis observatórios na ordem com link para a entrada;
 *  - nenhum formulário nem `data-view` no diretório; nenhum nome de domínio antigo; nenhum "Explorar";
 *  - a contagem de páginas de cada coleção igual à do inventário; todo cartão do "Para você" com prova ou motivo;
 *  - selo só pela forma única; página prevista nunca é link; um só `<details>` de método, no fim, com os totais;
 *  - nenhuma data ISO no texto visível; nenhum font-size nem `columns` no CSS da página.
 */

const ORDEM = ["retomar", "abertura", "para-voce", "destinos", "metodo"];
const VAZIOS = ["ainda sem último acesso", "nenhum ainda", "nenhum configurado", "só o painel de entrada"];

const texto = (h: string) =>
  h.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/&nbsp;|\s+/g, " ").replace(/&amp;/g, "&").trim();

/** Trecho de um elemento pelo marcador do atributo, até o fecho da mesma tag (com aninhamento). */
function elemento(h: string, marca: string): string {
  const ini = h.indexOf(marca);
  expect(ini, marca).toBeGreaterThan(-1);
  const abre = h.lastIndexOf("<", ini);
  const tag = h.slice(abre + 1).match(/^[a-z0-9]+/)![0];
  const re = new RegExp(`<${tag}[\\s>]|</${tag}>`, "g");
  re.lastIndex = abre;
  let nivel = 0;
  for (let m = re.exec(h); m; m = re.exec(h)) {
    nivel += m[0].startsWith("</") ? -1 : 1;
    if (nivel === 0) return h.slice(abre, m.index + m[0].length);
  }
  throw new Error(`sem fecho para ${marca}`);
}

const TOKEN_VOLTA = randomBytes(32).toString("hex");

describe("mapa da conta: regras de código", () => {
  it("o build existe quando o CI exige", () => {
    if (exigirBuild) expect(temBuild, "rodar npm run build antes dos testes").toBe(true);
  });

  it("toda coleção tem a sua linha de fontes, e as que têm faixa de frescor na porta repetem a faixa", () => {
    const ids = OBSERVATORIOS.flatMap((o) => o.colecoes.map((c) => c.id));
    expect(Object.keys(FRESCOR_NO_MAPA).sort()).toEqual([...ids].sort());
    for (const o of OBSERVATORIOS) {
      for (const c of o.colecoes) {
        const porta = (FRESCOR_DAS_COLECOES as Record<string, readonly string[]>)[c.href];
        if (porta) expect(FRESCOR_NO_MAPA[c.id], c.id).toEqual(porta);
      }
    }
  });

  it("CSS da página: grade de verdade, sem font-size nem columns, e os módulos antigos saíram", () => {
    const css = readFileSync(join(raiz, "src/components/observatorios/MapaDaConta.module.css"), "utf-8").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(css).not.toMatch(/font-size|font:\s/);
    expect(css).not.toMatch(/(^|[;{\s])columns\s*:/);
    expect(css).toMatch(/grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
    expect(existsSync(join(raiz, "src/components/observatorios/DiretorioPaineis.module.css"))).toBe(false);
    expect(existsSync(join(raiz, "src/app/app/(foco)/observatorios/escolha.module.css"))).toBe(false);
  });

  it("a página não usa formulário para navegar nem lista os domínios antigos", () => {
    const fonte = ["src/app/app/(foco)/observatorios/page.tsx", "src/components/observatorios/MapaDaConta.tsx"].map((f) => readFileSync(join(raiz, f), "utf-8")).join("\n");
    expect(fonte).not.toMatch(/<form|<button/);
    expect(fonte).not.toMatch(/OPCOES_OBSERVATORIOS|opcoesObservatorios/);
  });
});

describe.skipIf(!temBuild)("mapa da conta no HTML do build", () => {
  let servidor: ServidorProducao;
  const casos: Record<"nova" | "volta", string> = { nova: "", volta: "" };

  beforeAll(async () => {
    servidor = await subirServidor("mapa", async (db, schema) => {
      // a conta que volta: outra pessoa, com um recorte salvo e um aviso de atualização
      const agora = new Date();
      const id = "mapa-volta";
      await db.insert(schema.users).values({ id, email: `${id}@example.invalid`, emailVerifiedAt: agora, phoneVerifiedAt: agora, onboardingStatus: "COMPLETE", createdAt: agora, updatedAt: agora });
      await db.insert(schema.sessions).values({ id: `${id}-sessao`, userId: id, tokenHash: createHash("sha256").update(TOKEN_VOLTA).digest("hex"), expiresAt: new Date(Date.now() + 3_600_000), createdAt: agora });
      await db.insert(schema.recortesSalvos).values({ id: `${id}-r1`, userId: id, titulo: "PLD do Sudeste", caminho: "/setor-eletrico/pld?submercado=SE", observatorio: "energia", criadoEm: agora });
      await db.insert(schema.alertasAtualizacao).values({ id: `${id}-a1`, userId: id, dominio: "energia", referenciaAvisada: null, criadoEm: agora });
    });
    casos.nova = (await htmlDe(servidor, "/app/observatorios", true)).html;
    const r = await fetch(`${servidor.origem}/app/observatorios`, {
      redirect: "manual",
      headers: { cookie: `scrutiniums_session=${servidor.assinar(TOKEN_VOLTA)}; scrutiniums_observatorio=c:setor-eletrico` },
    });
    expect(r.status).toBe(200);
    casos.volta = await r.text();
  }, 180_000);

  afterAll(async () => {
    await servidor?.parar();
  });

  const mapa = (h: string) => elemento(h, 'data-mapa-conta=""');
  const fatias = (h: string) => [...mapa(h).matchAll(/data-fatia="([a-z-]+)"/g)].map((m) => m[1]).filter((f) => ORDEM.includes(f));

  it("um elemento do mapa dentro do <main>, fatias na ordem; retomar só para quem volta", () => {
    for (const [nome, h] of Object.entries(casos)) {
      expect(h.match(/data-mapa-conta=""/g), nome).toHaveLength(1);
      // o <main> é o do layout da conta; o outro que o HTML traz é o esqueleto de carregamento (aria-busy), trocado no streaming
      const mains = (h.match(/<main[^>]*>/g) ?? []).filter((m) => !m.includes('aria-busy="true"'));
      expect(mains, nome).toHaveLength(1);
      const inicio = h.indexOf(mains[0]);
      expect(inicio, nome).toBeLessThan(h.indexOf('data-mapa-conta=""'));
      expect(h.slice(inicio, h.indexOf('data-mapa-conta=""')), nome).not.toContain("</main>");
      const f = fatias(h);
      expect(f, nome).toEqual(ORDEM.filter((x) => f.includes(x)));
      expect(new Set(f).size, nome).toBe(f.length);
    }
    expect(fatias(casos.nova)).toEqual(ORDEM.slice(1));
    expect(fatias(casos.volta)).toEqual(ORDEM);
    const r = elemento(casos.volta, 'data-fatia="retomar"');
    expect(r).toMatch(/<a [^>]*href="\/setor-eletrico"[^>]*>Continuar em Setor Elétrico/);
    expect(r).toContain('href="/setor-eletrico/pld?submercado=SE"');
    expect(r).toContain('href="/app/conta#alertas"');
  });

  it("nenhuma frase de estado vazio; H1 único 'Encontre o painel' (decisão do dono)", () => {
    for (const h of Object.values(casos)) {
      const t = texto(mapa(h));
      for (const v of VAZIOS) expect(t).not.toContain(v);
      expect(h.match(/<h1[\s>]/g)).toHaveLength(1);
      expect(texto(elemento(h, "<h1"))).toBe("Encontre o painel");
    }
  });

  it("as 28 coleções uma vez cada como link no diretório; os seis observatórios na ordem, com link para a entrada", () => {
    const d = elemento(casos.nova, 'data-fatia="destinos"');
    for (const o of OBSERVATORIOS) {
      for (const c of o.colecoes) expect(d.match(new RegExp(`<a [^>]*href="${c.href}"`, "g")), c.href).toHaveLength(1);
    }
    const ordem = [...d.matchAll(/data-observatorio="([a-z-]+)"/g)].map((m) => m[1]);
    expect(ordem).toEqual(OBSERVATORIOS.map((o) => o.id));
    for (const o of OBSERVATORIOS) {
      const s = elemento(d, `data-observatorio="${o.id}"`);
      expect(s, o.id).toMatch(new RegExp(`<h2[^>]*><a [^>]*href="${o.entrada}"`));
    }
    expect(d).not.toMatch(/<form|data-view/);
  });

  it("nenhum nome de domínio antigo, nenhum 'Explorar'", () => {
    const nomesDeColecao = new Set(OBSERVATORIOS.flatMap((o) => o.colecoes.map((c) => c.nome)));
    for (const h of Object.values(casos)) {
      // fora da conta: as faixas de frescor do método nomeiam as fontes como limiares.json as registra (a fonte "Eficiência
      // Estatal" alimenta a Síntese das capitais e a Saúde); é nome de base de dados, não título de seção
      let t = texto(mapa(h).replace(/<li data-frescor-dominio=[\s\S]*?<\/li>/g, ""));
      for (const n of nomesDeColecao) t = t.split(n).join(" ");
      for (const d of DOMINIOS) expect(t, d.nomeLegado).not.toContain(d.nomeLegado);
      expect(t).not.toContain("Eficiência Estatal");
      expect(t).not.toContain("Explorar");
    }
  });

  it("a linha de estado de cada coleção conta a entrada e as páginas que existem, como o inventário", () => {
    const d = elemento(casos.nova, 'data-fatia="destinos"');
    for (const o of inventario()) {
      for (const c of o.colecoes) {
        const linha = texto(elemento(elemento(d, `data-colecao="${c.id}"`), "data-estado-colecao"));
        const m = linha.match(/^(\d+) páginas?( · dados até .+)?/);
        expect(m, `${c.id}: ${linha}`).not.toBeNull();
        expect(Number(m![1]), c.id).toBe(1 + c.paginas.filter((p) => p.rota !== null).length);
      }
    }
  });

  it("todo cartão do 'Para você' traz a prova do número ou o motivo de não ter", () => {
    const p = elemento(casos.nova, 'data-fatia="para-voce"');
    const itens = [...p.matchAll(/<li [^>]*data-para-voce-pergunta="[^"]+"[^>]*>/g)].map((m) => m[0]);
    expect(itens.length).toBeGreaterThanOrEqual(8);
    for (const li of itens) expect(li).toMatch(/data-prova-numero="[^"]+ · [^"]*\d{4}[^"]*"|data-sem-numero="[^"]+"/);
  });

  it("selos só pela forma única; página prevista nunca é link", () => {
    const d = elemento(casos.nova, 'data-fatia="destinos"');
    expect(texto(d)).not.toMatch(/\(previsto\)|Em desenvolvimento|Versão em desenvolvimento/);
    for (const a of d.match(/<a [\s\S]*?<\/a>/g) ?? []) expect(a).not.toContain('data-prontidao="preparacao"');
    // "cobertura parcial" só pelo selo
    const soltos = texto(d.replace(/<span data-prontidao="parcial"[^>]*><span aria-hidden="true">[^<]*<\/span>cobertura parcial(<span class="sr-only">[^<]*<\/span>)?<\/span>/g, "")).match(/cobertura parcial/g) ?? [];
    expect(soltos).toEqual([]);
  });

  it("um só <details> de método, a última fatia, com os totais do inventário", () => {
    const h = casos.nova;
    expect(h.match(/data-fatia="metodo"/g)).toHaveLength(1);
    const m = elemento(h, 'data-fatia="metodo"');
    expect(m.startsWith("<details")).toBe(true);
    const t = totais(inventario());
    const tt = texto(elemento(m, "data-totais"));
    for (const n of [t.colecoes, t.publicadas, t.parciais, t.previstas]) expect(tt).toContain(n.toLocaleString("pt-BR"));
  });

  it("nenhum texto visível com data ISO, nem undefined, NaN ou objeto cru", () => {
    for (const h of Object.values(casos)) {
      const t = texto(mapa(h));
      expect(t).not.toMatch(/\b\d{4}-\d{2}-\d{2}\b/);
      expect(t).not.toMatch(/undefined|NaN|\[object Object\]/);
    }
  });
});
