import { describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import LeiloesAcrPage from "@/app/setor-eletrico/leiloes/page";
import LeiloesTransmissaoPage from "@/app/setor-eletrico/leiloes/transmissao/page";
import { LabLeilao, LinhaDosProdutos } from "@/components/energia/LeiloesLabs";
import { GruposControle } from "@/components/energia/LeiloesPagina";
import {
  PARAMETROS_LEILAO_INICIAIS,
  anosContinuos,
  frasesCitaveis,
  frasesTransmissao,
  leilaoDescendente,
  linhaProduto,
  linhasEnergiaPorAno,
  linhasEntregaPorAno,
  linhasPrecoPorAno,
  logoDoGrupo,
  normalizaManifestoLogos,
  participacao,
} from "@/lib/energia/leiloes";
import { lerManifestoLogos } from "@/lib/energia/logos-servidor";
import type { LeiloesGold } from "@/lib/energia/tipos-leiloes";

/**
 * Leilões: as linhas de gráfico copiam a gold (ano sem leilão é ausência), as frases citáveis saem da gold com data e fonte, o
 * laboratório reproduz um leilão calculado à mão, o logotipo só entra por CNPJ e a página traz as seções sem número digitado.
 */
const raiz = process.cwd();
const G: LeiloesGold = JSON.parse(readFileSync(join(raiz, "public/energia/gold/leiloes.json"), "utf-8"));
const MANIFESTO = JSON.parse(readFileSync(join(raiz, "src/tests/fixtures/logos-manifesto-exemplo.json"), "utf-8"));
const texto = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/&nbsp;| /g, " ").replace(/\s+/g, " ");

describe("leilões: gold publicada", () => {
  it("está disponível e os totais fecham por ano, por fonte e por situação", () => {
    expect(G.disponivel).toBe(true);
    const t = G.totais.energia_mwmed;
    const soma = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
    expect(soma(G.por_ano.map((a) => a.energia_mwmed))).toBeCloseTo(t, 0);
    expect(soma(G.por_categoria.map((a) => a.energia_mwmed))).toBeCloseTo(t, 0);
    expect(soma(Object.values(G.entrega.total).map((a) => a.energia_mwmed))).toBeCloseTo(t, 0);
    expect(soma(Object.values(G.entrega.total).map((a) => a.empreendimentos))).toBe(G.totais.empreendimentos);
    expect(G.leiloes).toHaveLength(G.cobertura.leiloes);
    // unidade da energia conferida nos estruturantes
    const est = Object.fromEntries(G.conferencias.estruturantes_mwmed.map((x) => [x.empreendimento, x.energia_mwmed]));
    expect(est["Belo Monte"]).toBe(3199);
    expect(est["Jirau"]).toBe(1382);
  });
});

describe("leilões: derivações da interface", () => {
  it("energia por ano copia a gold e ano sem leilão na base é ausência, nunca zero", () => {
    const linhas = linhasEnergiaPorAno(G, "categoria");
    expect(linhas.map((l) => l.ano)).toEqual(anosContinuos(G));
    for (const a of G.cobertura.anos_sem_leilao_na_base) {
      const l = linhas.find((x) => x.ano === String(a))!;
      expect(Object.entries(l).filter(([k]) => k !== "ano").every(([, v]) => v === null), String(a)).toBe(true);
    }
    for (const a of G.por_ano) {
      const l = linhas.find((x) => x.ano === a.ano)!;
      const s = Object.entries(l).filter(([k]) => k !== "ano").reduce((x, [, v]) => x + (v as number), 0);
      expect(s, a.ano).toBeCloseTo(a.energia_mwmed, 0);
    }
    const porTipo = linhasEnergiaPorAno(G, "tipo");
    for (const a of G.por_ano) expect(porTipo.find((x) => x.ano === a.ano)![G.cobertura.tipos_presentes[0].id]).toBe(a.por_tipo[G.cobertura.tipos_presentes[0].id] ?? 0);
  });

  it("preço por ano copia a gold, com lacuna onde a fonte não vendeu", () => {
    for (const real of [true, false]) {
      const linhas = linhasPrecoPorAno(G, real);
      for (const x of G.preco_ano_categoria) expect(linhas.find((l) => l.ano === x.ano)![x.categoria]).toBe(real ? x.preco_medio_real : x.preco_medio);
      const vendas = new Set(G.preco_ano_categoria.map((x) => `${x.ano}|${x.categoria}`));
      for (const l of linhas) for (const [k, v] of Object.entries(l)) if (k !== "ano" && !vendas.has(`${l.ano}|${k}`)) expect(v).toBeNull();
    }
  });

  it("entrega por ano soma a energia do ano e a participação usa o total publicado", () => {
    const linhas = linhasEntregaPorAno(G);
    for (const a of G.por_ano) {
      const l = linhas.find((x) => x.ano === a.ano)!;
      expect(Object.entries(l).filter(([k]) => k !== "ano").reduce((s, [, v]) => s + (v as number), 0), a.ano).toBeCloseTo(a.energia_mwmed, 0);
    }
    expect(participacao(G, "operacao")).toBeCloseTo((100 * G.entrega.total.operacao.energia_mwmed) / G.totais.energia_mwmed, 9);
  });

  it("as frases citáveis saem da gold, com fonte e data, sem 'hoje' nem travessão", () => {
    const fs = frasesCitaveis(G);
    expect(fs.map((f) => f.id)).toEqual(expect.arrayContaining(["total", "entrega", "ultimo", "desagio"]));
    const total = fs.find((f) => f.id === "total")!;
    expect(total.texto).toContain(G.totais.energia_mwmed.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
    expect(total.texto).toContain(String(G.cobertura.leiloes));
    for (const f of [...fs, ...frasesTransmissao(G)]) {
      expect(f.texto, f.id).not.toMatch(/\bhoje\b|—|undefined|NaN/);
      expect(f.referencia, f.id).toMatch(/ANEEL/);
    }
    const grupo = fs.find((f) => f.id === "grupo");
    if (grupo) expect(grupo.texto).toContain("não é necessariamente o vencedor");
  });

  it("produto A-x: ano A = ano do leilão + x; reserva sem ano A", () => {
    expect(linhaProduto("A-5", 2025).anoA).toBe(2030);
    expect(linhaProduto("A-3", 2006).anos[0]).toBe(2006);
    expect(linhaProduto("LER", 2014).anoA).toBeNull();
  });
});

describe("leilões: laboratório", () => {
  it("reproduz um leilão calculado à mão", () => {
    // 10 proponentes com custo de 180 a 380 (passo de 22,2), lote de 100, demanda de 600, teto de 400 e queda de 5 por rodada:
    // a 315 ainda há 7 proponentes (700 > 600); a 310 sobram 6 (custo até 291,1), que cabem na demanda
    const r = leilaoDescendente(PARAMETROS_LEILAO_INICIAIS);
    expect(r.preco).toBe(310);
    expect(r.desagioPct).toBeCloseTo(22.5, 9);
    expect(r.vencedores).toBe(6);
    expect(r.contratada).toBe(600);
    expect(r.faltou).toBe(0);
    expect(r.margemMedia).toBeCloseTo(310 - (180 + 291.111) / 2, 2);
    expect(r.rodadas.at(-1)!.preco).toBe(310);
    expect(r.rodadas).toHaveLength(19);
  });

  it("mais concorrência não sobe o preço; teto abaixo de todo custo não vende; oferta curta fecha no teto", () => {
    let anterior = Infinity;
    for (const n of [4, 6, 8, 12, 20, 30]) {
      const p = leilaoDescendente({ ...PARAMETROS_LEILAO_INICIAIS, proponentes: n }).preco!;
      expect(p, String(n)).toBeLessThanOrEqual(anterior);
      anterior = p;
    }
    const semVenda = leilaoDescendente({ ...PARAMETROS_LEILAO_INICIAIS, teto: 150 });
    expect(semVenda.preco).toBeNull();
    expect(semVenda.contratada).toBe(0);
    const curta = leilaoDescendente({ ...PARAMETROS_LEILAO_INICIAIS, demanda: 2000 });
    expect(curta.preco).toBe(400);
    expect(curta.desagioPct).toBe(0);
    expect(curta.faltou).toBe(1000);
  });

  it("os laboratórios renderizam no servidor com rótulo de modelo e o que deixam de fora", () => {
    const h = renderToStaticMarkup(createElement(LabLeilao));
    expect(h).toContain("Modelo didático");
    expect(texto(h)).toContain("O que o modelo deixa de fora");
    const p = renderToStaticMarkup(
      createElement(LinhaDosProdutos, {
        produtos: [{ id: "A-5", rotulo: "Energia nova A-5", antecedencia: 5, leiloes: 2, energiaMwmed: 10, exemplo: { nome: "X", data: "01/01/2020", ano: 2020 }, entrada: { antes_do_leilao: 1, ate_ano_a: 5, depois_ano_a: 4, sem_data: 0 } }],
        dataSiga: "30/09/2026",
      }),
    );
    expect(texto(p)).toContain("Ano A: começa a entrega");
    expect(texto(p)).toContain("2025");
    expect(texto(p)).toContain("não prova descumprimento");
  });
});

describe("leilões: logotipos", () => {
  const m = normalizaManifestoLogos(MANIFESTO);

  it("o manifesto de exemplo é fixture de teste e só entram itens com CNPJ válido e caminho local", () => {
    expect(MANIFESTO._fixture).toMatch(/FIXTURE DE TESTE/);
    expect(m.map((e) => e.nome)).toEqual(["Holding Exemplo A", "Grupo Exemplo B"]);
    expect(m[0].arquivo).toBe("/energia/logos/exemplo-a.svg");
    expect(m[0].cnpjs).toEqual(["02474103000119", "06132057000120"]);
    expect(normalizaManifestoLogos(null)).toEqual([]);
    expect(normalizaManifestoLogos([{ arquivo: "a.svg", cnpj: "00001180000126" }])).toHaveLength(1);
  });

  it("o logotipo vem do topo do grupo, ou da holding mais alta da cadeia, e nunca por nome", () => {
    const topo = logoDoGrupo(m, { cnpj: "00001180000126", cadeia_cnpjs: ["00001180000126", "09391823000160"] });
    expect(topo).toMatchObject({ nome: "Grupo Exemplo B", noTopo: true });
    const cadeia = logoDoGrupo(m, { cnpj: "99999999000199", cadeia_cnpjs: ["99999999000199", "02474103000119", "11111111000111"] });
    expect(cadeia).toMatchObject({ nome: "Holding Exemplo A", noTopo: false, cnpj: "02474103000119" });
    expect(logoDoGrupo(m, { cnpj: "33453598000123", cadeia_cnpjs: [] })).toBeNull();
    expect(logoDoGrupo([], { cnpj: "00001180000126", cadeia_cnpjs: [] })).toBeNull();
  });

  it("a leitura do manifesto funciona sem ele e descarta item cujo arquivo não foi publicado", () => {
    const d = mkdtempSync(join(tmpdir(), "logos-"));
    expect(lerManifestoLogos(d)).toEqual([]);
    mkdirSync(join(d, "public/energia/logos"), { recursive: true });
    writeFileSync(join(d, "public/energia/logos/manifesto.json"), JSON.stringify(MANIFESTO));
    writeFileSync(join(d, "public/energia/logos/exemplo-a.svg"), "<svg xmlns='http://www.w3.org/2000/svg'/>");
    expect(lerManifestoLogos(d).map((e) => e.nome)).toEqual(["Holding Exemplo A"]);
  });

  it("a tabela de grupos mostra o logotipo com alt, o aviso de que o grupo não é a vencedora e o sem vínculo à parte", () => {
    if (!G.grupos_controle) return;
    const grupo = G.grupos_controle.maiores[0];
    const fixture = [{ arquivo: "/energia/logos/x.svg", nome: "Marca do topo", cnpjs: [grupo.cnpj], origem: null, data: null, papel: null }];
    const h = renderToStaticMarkup(createElement(GruposControle, { g: G.grupos_controle, logos: fixture, dataSiga: "30/09/2026" }));
    expect(h).toContain('alt="Marca do topo"');
    expect(h).toContain('width="56"');
    expect(texto(h)).toContain("não a vencedora na data do leilão");
    expect(texto(h)).toContain("Sem vínculo provado com um grupo");
    const sem = renderToStaticMarkup(createElement(GruposControle, { g: G.grupos_controle, logos: [], dataSiga: "30/09/2026" }));
    expect(sem).not.toContain("<img");
  });
});

describe("leilões: páginas", () => {
  const acr = renderToStaticMarkup(createElement(LeiloesAcrPage));
  const tr = renderToStaticMarkup(createElement(LeiloesTransmissaoPage));

  it("a página do ACR traz as seções, os números da gold e cabe no teto de HTML", () => {
    for (const id of ["como-funciona", "produtos", "laboratorio", "quanto", "preco", "desagio", "onde", "quem", "entrega", "citar", "lista", "regras"]) expect(acr, id).toContain(`id="${id}"`);
    const t = texto(acr);
    expect(t).toContain(G.ultimo_leilao.nome!);
    expect(t).toContain("Números para citar");
    expect(t).not.toMatch(/\bhoje\b|undefined|NaN|—/);
    expect(Buffer.byteLength(acr, "utf-8")).toBeLessThan(400 * 1024);
  });

  it("a página de transmissão traz deságio por lote, RAP corrigida e o fim do arquivo", () => {
    for (const id of ["como-funciona", "quanto", "desagio", "quem", "regras"]) expect(tr, id).toContain(`id="${id}"`);
    const t = texto(tr);
    expect(t).toContain("Deságio de cada lote");
    expect(t).not.toMatch(/\bhoje\b|undefined|NaN|—/);
    expect(Buffer.byteLength(tr, "utf-8")).toBeLessThan(400 * 1024);
  });
});
