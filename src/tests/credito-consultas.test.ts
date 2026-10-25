import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

const caminho = vi.hoisted(() => ({ atual: "/observatorio-do-credito/quanto-meu-banco-cobra" }));
vi.mock("next/navigation", async () => ({
  ...(await vi.importActual<typeof import("next/navigation")>("next/navigation")),
  usePathname: () => caminho.atual,
  useRouter: () => ({ replace: () => {}, push: () => {}, prefetch: () => {}, refresh: () => {}, back: () => {}, forward: () => {} }),
}));

import QuantoMeuBancoCobra from "@/app/observatorio-do-credito/quanto-meu-banco-cobra/page";
import SimuladorDaParcela from "@/app/observatorio-do-credito/simulador-da-parcela/page";
import MetodologiaCredito from "@/app/observatorio-do-credito/metodologia/page";
import ObservatorioPublicoPage from "@/app/observatorio-do-credito/page";
import * as juros from "@/lib/credito/juros";
import { compararTaxas, NOTA_TAXA_ZERO, goldJuros, resolverConsulta, rotuloModalidade, slugModalidade, type GoldJuros } from "@/lib/credito/juros";
import { dataBr, diaBrasilia, janela, num } from "@/lib/credito/formato";
import { PAGINAS_CREDITO } from "@/lib/credito/navegacao";
import { extrairClassificacao, extrairGlossario, extrairNomesInad, extrairNotaReguas, extrairRegras, metodologiaCredito } from "@/lib/credito/metodologia";
import { ehRotaPublica, exigeConta } from "@/lib/rotasPublicas";
import { ATALHOS, donoDaRota } from "@/lib/observatorios/registro";
import { SECTION_LABELS, isViewSection } from "@/lib/telemetry";

/**
 * Consultas de juros do Crédito em Next (Onda 2 da banca de 19/10/2026): "Quanto meu banco cobra?", o simulador do
 * custo da dívida e a metodologia estática. Renderiza com a gold real (public/obs/data/gold/juros.json) e confere que
 * cada número vem com unidade, janela e fonte datada, que o aviso de que taxa não é CET está à vista, que a ausência
 * é declarada (nunca zero) e que as rotas nascem fechadas.
 */
const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);
/** Texto visível, sem marcação, com espaços normalizados (entidades HTML mais comuns decodificadas). */
const texto = (h: string) =>
  h
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ");

const gold = goldJuros() as GoldJuros;

/** Um caso real: a modalidade PF com mais instituições, a instituição na posição do meio e uma instituição ausente dela. */
function casoReal() {
  const mod = gold.modalidades.filter((m) => m.segmento === "PF").sort((a, b) => b.stats.n - a.stats.n)[0];
  const linha = mod.ranking[Math.floor(mod.ranking.length / 2)];
  const presentes = new Set(mod.ranking.map((r) => r.cnpj8));
  const ausente = gold.perfis_if.find((p) => !presentes.has(p.cnpj8))!;
  return { mod, linha, ausente, seg: "pf", slug: slugModalidade(mod.modalidade) };
}

describe("gold de juros", () => {
  it("existe e traz o que as consultas usam: janela, estatísticas, ranking com taxa ao ano e ao mês, e o conceito de que taxa não é CET", () => {
    expect(gold).not.toBeNull();
    expect(gold.modalidades.length).toBeGreaterThan(0);
    expect(gold.conceitos.taxa).toMatch(/CET/);
    for (const m of gold.modalidades) {
      expect(m.janela.inicio <= m.janela.fim, m.id).toBe(true);
      expect(m.stats.min <= m.stats.p25 && m.stats.p25 <= m.stats.mediana && m.stats.mediana <= m.stats.p75 && m.stats.p75 <= m.stats.max, m.id).toBe(true);
      expect(m.ranking.length, m.id).toBe(m.stats.n);
      for (const r of m.ranking) expect(Number.isFinite(r.taxa_aa) && Number.isFinite(r.taxa_am), `${m.id} ${r.nome}`).toBe(true);
    }
  });

  it("o endereço da modalidade separa os segmentos (cheque especial existe em PF e PJ)", () => {
    const repetidos = gold.modalidades.filter((m) => gold.modalidades.some((o) => o !== m && slugModalidade(o.modalidade) === slugModalidade(m.modalidade)));
    for (const m of repetidos) {
      const seg = m.segmento === "PJ" ? "pj" : "pf";
      expect(resolverConsulta(gold, { seg, mod: slugModalidade(m.modalidade) }).modalidade).toBe(m);
    }
  });

  it("parâmetro desconhecido abre no padrão e é avisado; posição conta empates sem esconder ninguém", () => {
    const c = resolverConsulta(gold, { seg: "xx", mod: "nao-existe", banco: "99999998" });
    expect(c.ignorados).toEqual(["segmento", "modalidade", "instituição"]);
    expect(c.banco).toBeNull();
    for (const m of gold.modalidades) {
      for (const r of m.ranking.slice(0, 5)) {
        const k = resolverConsulta(gold, { seg: m.segmento.toLowerCase(), mod: slugModalidade(m.modalidade), banco: r.cnpj8 });
        expect(k.modalidade).toBe(m);
        // D2, pacote C autorizado em 25/10/2026: zero preservado, fora da posição.
        if (r.taxa_aa === 0) { expect(k.posicao).toBeNull(); continue; }
        const p = k.posicao!;
        expect(p.menores + p.iguais + p.maiores + 1).toBe(k.comparacao.ranking.length);
      }
    }
  });
});

describe("Quanto meu banco cobra?", () => {
  it("mostra a taxa do banco ao ano e ao mês, a mediana, a distância, a posição, a distribuição, a janela e a fonte datada", () => {
    caminho.atual = "/observatorio-do-credito/quanto-meu-banco-cobra";
    const { mod, linha, seg, slug } = casoReal();
    // D2, 25/10/2026: a referência exibida usa somente instituições elegíveis.
    const comparacao = compararTaxas(mod);
    const stats = comparacao.stats!;
    const posicao = comparacao.ranking.find((r) => r.cnpj8 === linha.cnpj8)!.posicao;
    const t = texto(html(createElement(QuantoMeuBancoCobra, { searchParams: { seg, mod: slug, banco: linha.cnpj8 } })));
    expect(t).toContain(linha.nome);
    expect(t).toContain(`${num(linha.taxa_aa)}% ao ano`);
    expect(t).toContain(`${num(linha.taxa_am)}% ao mês`);
    expect(t).toContain(`${num(stats.mediana)}% ao ano`);
    expect(t).toContain(`Mediana das ${stats.n} instituições`);
    expect(t).toContain(`${posicao.toLocaleString("pt-BR")}ª de ${stats.n}`);
    const dist = linha.taxa_aa - stats.mediana;
    if (Math.abs(dist) >= 0.005) expect(t).toContain(`${num(Math.abs(dist))} p.p. ${dist < 0 ? "abaixo" : "acima"}`);
    for (const v of [stats.min, stats.p25, stats.p75, stats.max]) expect(t).toContain(`${num(v)}% ao ano`);
    expect(t).toContain(janela(mod.janela));
    expect(t).toContain("Banco Central do Brasil");
    expect(t).toContain(`Publicação processada em ${diaBrasilia(gold.gerado_em)}`);
    // sem julgamento por adjetivo
    expect(t).not.toMatch(/\b(caro|cara|barato|barata|abusiv[oa])\b/i);
  });

  it("deixa à vista que taxa não é CET (tarifas, seguros e tributos ficam fora)", () => {
    const { linha, seg, slug } = casoReal();
    const h = html(createElement(QuantoMeuBancoCobra, { searchParams: { seg, mod: slug, banco: linha.cnpj8 } }));
    const aviso = h.slice(h.indexOf("data-aviso-cet"), h.indexOf("</aside>", h.indexOf("data-aviso-cet")));
    expect(texto(aviso)).toMatch(/não é o custo total do empréstimo \(CET\)/);
    expect(texto(aviso)).toMatch(/Tarifas, seguros e tributos/);
    // o aviso não fica em <details> recolhido
    const antes = h.slice(0, h.indexOf("data-aviso-cet"));
    expect((antes.match(/<details/g) ?? []).length).toBe((antes.match(/<\/details>/g) ?? []).length);
  });

  it("declara a ausência quando o banco não informou a modalidade, sem zero nem estimativa", () => {
    const { mod, ausente, seg, slug } = casoReal();
    const h = html(createElement(QuantoMeuBancoCobra, { searchParams: { seg, mod: slug, banco: ausente.cnpj8 } }));
    const t = texto(h);
    expect(h).toContain("data-ausencia");
    expect(t).toContain(`${ausente.nome} não aparece na publicação do Banco Central para ${rotuloModalidade(mod.modalidade).toLowerCase()}`);
    expect(t).toContain("Ausência não é taxa zero");
    expect(t).not.toContain(`Taxa de ${ausente.nome}`);
    // D2 do comitê de 25/10/2026; dono autorizou implementar o pacote C,
    // mantendo o merge pendente. Ausência não vira zero; zero da fonte exige nota.
    const comparacao = compararTaxas(mod);
    for (const r of comparacao.excluidas) {
      expect(h).toContain(`data-taxa-zero="${r.cnpj8}"`);
      expect(t).toContain(NOTA_TAXA_ZERO);
    }
    expect(comparacao.ranking.every((r) => r.taxa_aa !== 0)).toBe(true);
    // oferece as modalidades em que a instituição informou taxa
    const outra = gold.modalidades.find((m) => m.ranking.some((r) => r.cnpj8 === ausente.cnpj8))!;
    expect(t).toContain(rotuloModalidade(outra.modalidade));
  });

  it("sem banco escolhido, mostra a modalidade; modalidade com janela antiga avisa que o número é mais antigo", () => {
    const { mod, seg, slug } = casoReal();
    const t = texto(html(createElement(QuantoMeuBancoCobra, { searchParams: { seg, mod: slug } })));
    expect(t).toContain(`${num(compararTaxas(mod).stats!.p25)}% a ${num(compararTaxas(mod).stats!.p75)}%`);
    const antiga = gold.modalidades.find((m) => (Date.parse(gold.gerado_em) - Date.parse(m.janela.fim)) / 86_400_000 > 60);
    if (antiga) {
      const h = html(createElement(QuantoMeuBancoCobra, { searchParams: { seg: antiga.segmento.toLowerCase(), mod: slugModalidade(antiga.modalidade) } }));
      expect(h).toContain("data-janela-antiga");
      expect(texto(h)).toContain(dataBr(antiga.janela.fim));
    }
  });

  it("guarda o recorte na URL: o formulário funciona sem JavaScript, com seg, mod e banco", () => {
    const { linha, seg, slug } = casoReal();
    const h = html(createElement(QuantoMeuBancoCobra, { searchParams: { seg, mod: slug, banco: linha.cnpj8 } }));
    expect(h).toMatch(/<form[^>]*method="get"[^>]*action="\/observatorio-do-credito\/quanto-meu-banco-cobra"/);
    for (const nome of ["seg", "mod", "banco"]) expect(h).toContain(`name="${nome}"`);
    expect(h).toContain(`value="${linha.cnpj8}" selected=""`);
  });
});

describe("Simulador do custo da dívida", () => {
  it("é rotulado como cálculo, pré-preenche a taxa publicada do banco e declara que a taxa média não é o CET", () => {
    caminho.atual = "/observatorio-do-credito/simulador-da-parcela";
    const { linha, seg, slug } = casoReal();
    const h = html(createElement(SimuladorDaParcela, { searchParams: { seg, mod: slug, banco: linha.cnpj8 } }));
    const t = texto(h);
    expect(t).toContain("Cálculo, não é previsão nem oferta");
    expect(t).toContain("Usa só a taxa publicada pelo Banco Central ou a que você digitar, e a taxa média não é o CET");
    expect(h).toContain(`value="${num(linha.taxa_aa)}"`);
    expect(t).toContain(`Taxa média publicada pelo Banco Central para ${linha.nome}`);
    expect(h).toContain("data-aviso-cet");
    expect(h).toContain('name="cet"');
    // fórmulas visíveis num bloco recolhido
    const como = h.slice(h.indexOf("data-como-calculamos"));
    expect(h.slice(0, h.indexOf("data-como-calculamos")).lastIndexOf("<details")).toBeGreaterThan(-1);
    expect(texto(como)).toContain("(1 + taxa ao ano)^(1/12) − 1");
    expect(texto(como)).toContain("parcela = valor × i ÷ [1 − (1 + i)^(−n)]");
    expect(texto(como)).toContain("Com taxa zero, a parcela é o valor dividido por n");
  });

  it("sem banco, usa a mediana da modalidade e diz que é a mediana; banco ausente não vira taxa do banco", () => {
    const { mod, ausente, seg, slug } = casoReal();
    const sem = html(createElement(SimuladorDaParcela, { searchParams: { seg, mod: slug } }));
    expect(sem).toContain(`value="${num(compararTaxas(mod).stats!.mediana)}"`);
    expect(texto(sem)).toContain(`Mediana das taxas das ${compararTaxas(mod).stats!.n} instituições`);
    const aus = texto(html(createElement(SimuladorDaParcela, { searchParams: { seg, mod: slug, banco: ausente.cnpj8 } })));
    expect(aus).toContain(`${ausente.nome} não informou taxa ao Banco Central`);
    expect(aus).toContain("não é a taxa desse banco");
  });

  it("calcula na primeira renderização com os campos da URL (valor, prazo, taxa digitada e CET)", () => {
    const { seg, slug } = casoReal();
    const t = texto(html(createElement(SimuladorDaParcela, { searchParams: { seg, mod: slug, valor: "10.000", prazo: "12", taxa: "1", un: "am", cet: "15" } })));
    expect(t).toContain("R$ 888,49");
    expect(t).toContain("Taxa digitada por você");
    expect(t).toContain("Parcela com o CET");
  });

  it("avisa quando a modalidade é pós-fixada ou não costuma ser paga em parcelas iguais", () => {
    const pos = gold.modalidades.find((m) => /pós-fixado/i.test(m.modalidade));
    if (pos) {
      const t = texto(html(createElement(SimuladorDaParcela, { searchParams: { seg: pos.segmento.toLowerCase(), mod: slugModalidade(pos.modalidade) } })));
      expect(t).toContain("Modalidade pós-fixada");
    }
    const rot = gold.modalidades.find((m) => /rotativo|cheque especial/i.test(m.modalidade));
    if (rot) {
      const t = texto(html(createElement(SimuladorDaParcela, { searchParams: { seg: rot.segmento.toLowerCase(), mod: slugModalidade(rot.modalidade) } })));
      expect(t).toContain("costuma não ser paga em parcelas iguais");
    }
  });
});

describe("Metodologia do Crédito em página estática", () => {
  const app = readFileSync(join(process.cwd(), "public/obs/app.js"), "utf-8");

  it("os textos fixos da vista da SPA são extraídos inteiros (se a SPA mudar a forma, este teste acusa)", () => {
    const corpo = app.slice(app.indexOf("function renderMethod() {"));
    const selos = (corpo.slice(0, corpo.indexOf("\n}\n")).match(/<p>\$\{badge\("\w+"\)\}/g) ?? []).length;
    expect(extrairClassificacao(app)?.length).toBe(selos);
    expect(selos).toBeGreaterThan(0);
    expect(extrairRegras(app, 7)).toMatch(/ausência de dado ≠ zero · revisões registradas \(7\)/);
    expect(extrairNotaReguas(app)).toMatch(/Nenhuma régua é "a certa"/);
    expect(Object.keys(extrairNomesInad(app) ?? {})).toEqual(expect.arrayContaining(["sgs", "scr", "atraso15"]));
    const linhas = app.slice(app.indexOf("const GLOSSARIO = ["), app.indexOf("\n];", app.indexOf("const GLOSSARIO = ["))).split("\n").filter((l) => /^\s*\{ t: /.test(l)).length;
    expect(extrairGlossario(app)?.length).toBe(linhas);
  });

  it("mostra o mesmo conteúdo das golds que a vista lê: catálogo, dicionário, model cards, score cards, versões, linhagem e glossário", () => {
    caminho.atual = "/observatorio-do-credito/metodologia";
    const m = metodologiaCredito();
    const h = html(createElement(MetodologiaCredito));
    const t = texto(h);
    const method = JSON.parse(readFileSync(join(process.cwd(), "public/obs/data/gold/method.json"), "utf-8"));
    const quality = JSON.parse(readFileSync(join(process.cwd(), "public/obs/data/gold/quality.json"), "utf-8"));
    expect(t).toContain(`Catálogo de dados: ${Object.keys(quality).length.toLocaleString("pt-BR")} séries`);
    for (const q of Object.values(quality as Record<string, { nome: string }>)) expect(t, q.nome).toContain(q.nome);
    for (const d of method.dicionario_indicadores) expect(t).toContain(d.formula);
    for (const c of method.model_cards) expect(t).toContain(c.nome);
    for (const c of method.score_cards) expect(t).toContain(c.nome);
    for (const v of method.changelog) expect(t).toContain(`v${v.versao}`);
    for (const g of m.glossario!) expect(t).toContain(g.definicao);
    for (const c of m.classificacao!) expect(t).toContain(c.texto);
    expect(t).toContain(m.regras!);
    expect(t).toContain(gold.conceitos.taxa);
    expect(t).toContain(`processados em ${diaBrasilia(m.geradoEm!)}`);
  });
});

describe("acesso e navegação", () => {
  it("as três rotas nascem fechadas: nenhuma consta das rotas públicas", () => {
    for (const p of PAGINAS_CREDITO) {
      expect(ehRotaPublica(p.href), p.href).toBe(false);
      expect(ehRotaPublica(`${p.href}?seg=pf`), p.href).toBe(false);
      expect(exigeConta(`${p.href}?seg=pf&mod=x&banco=1`), p.href).toBe(true);
    }
    expect(ehRotaPublica("/obs/data/gold/juros.json")).toBe(false);
  });

  it("estão no registro dos observatórios (Crédito, na Economia) e como atalho em Famílias, com telemetria própria", () => {
    for (const p of PAGINAS_CREDITO) {
      expect(donoDaRota(p.href)).toMatchObject({ rota: p.href, observatorio: "economia", colecao: "credito", origem: "credito" });
      expect(isViewSection(p.secao), p.secao).toBe(true);
      expect(SECTION_LABELS[p.secao]).toMatch(/^Crédito · /);
    }
    expect(ATALHOS.filter((a) => a.observatorio === "familias" && a.rota.startsWith("/observatorio-do-credito/")).map((a) => a.rota).sort()).toEqual([
      "/observatorio-do-credito/quanto-meu-banco-cobra",
      "/observatorio-do-credito/simulador-da-parcela",
    ]);
  });

  it("a página aberta do Crédito leva às consultas e à metodologia com o selo com conta e sem pré-carregamento", () => {
    caminho.atual = "/observatorio-do-credito";
    const h = html(createElement(ObservatorioPublicoPage));
    for (const p of PAGINAS_CREDITO) {
      const m = h.match(new RegExp(`<a [^>]*href="${p.href}"[^>]*>([\\s\\S]*?)</a>`));
      expect(m, p.href).not.toBeNull();
      expect(m![1], p.href).toContain("data-selo-conta");
    }
    const lerFonte = readFileSync(join(process.cwd(), "src/app/observatorio-do-credito/page.tsx"), "utf-8");
    // as consultas (a taxa do banco e o simulador da parcela) são cartões do "Para você" desde o orçamento de comprimento
    // (Iniciativa 4): o pré-carregamento segue a mesma regra, no componente
    expect(lerFonte).toContain('<ParaVoce entrada="/observatorio-do-credito" />');
    expect(readFileSync(join(process.cwd(), "src/components/observatorios/ParaVoce.tsx"), "utf-8")).toContain("prefetch={prefetchDoLink(p.href)}");
    expect(lerFonte).toContain('prefetch={prefetchDoLink("/observatorio-do-credito/metodologia")}');
  });

  it("o cabeçalho é a barra comum da plataforma, com o Crédito marcado na Economia", () => {
    caminho.atual = "/observatorio-do-credito/quanto-meu-banco-cobra";
    const { linha, seg, slug } = casoReal();
    const h = html(createElement(QuantoMeuBancoCobra, { searchParams: { seg, mod: slug, banco: linha.cnpj8 } }));
    expect(h.match(/data-barra-plataforma=""/g)).toHaveLength(1);
    expect(h).toMatch(/aria-current="page"[^>]*>Quanto meu banco cobra\?</);
  });
});


describe("D2: taxa zero preservada e comparação explícita (pacote C, 25/10/2026)", () => {
  function amostra(taxas: number[]) {
    const m = structuredClone(gold.modalidades[0]);
    m.ranking = taxas.map((v, i) => ({ cnpj8: String(i + 1).padStart(8, "0"), nome: `Instituição de teste ${i + 1}`, taxa_am: v / 12, taxa_aa: v, posicao: i + 1, vs_mediana: v - 20 }));
    m.stats = { n: taxas.length, min: 0, p25: 10, mediana: 20, p75: 20, max: 30 };
    return { ...gold, modalidades: [m], perfis_if: [] };
  }

  it("recalcula a mediana, os quartis e as posições sem alterar a gold nem perder empates", () => {
    const g = amostra([0, 10, 20, 20, 30]);
    const antes = structuredClone(g);
    const m = g.modalidades[0];
    const consulta = (banco: string) => resolverConsulta(g, { seg: m.segmento.toLowerCase(), mod: slugModalidade(m.modalidade), banco });
    const zero = consulta(m.ranking[0].cnpj8);
    expect(zero.linha?.taxa_aa).toBe(0);
    expect(zero.posicao).toBeNull();
    expect(zero.distanciaPp).toBeNull();
    expect(zero.distanciaPct).toBeNull();
    expect(zero.comparacao.stats).toEqual({ n: 4, min: 10, p25: 17.5, mediana: 20, p75: 22.5, max: 30 });
    const k = consulta(m.ranking[2].cnpj8);
    expect(k.posicao).toEqual({ posicao: 2, n: 4, menores: 1, iguais: 1, maiores: 1 });
    expect(k.distanciaPp).toBe(0);
    expect(g).toEqual(antes);
  });

  it("zero tem nota visível e não entra no gráfico nem na tabela comparativa, inclusive sem banco selecionado", () => {
    const g = amostra([0, 10, 20, 20, 30]);
    const m = g.modalidades[0];
    const spy = vi.spyOn(juros, "goldJuros").mockReturnValue(g);
    try {
      for (const banco of [undefined, m.ranking[0].cnpj8, m.ranking[1].cnpj8]) {
        const h = html(createElement(QuantoMeuBancoCobra, { searchParams: { seg: m.segmento.toLowerCase(), mod: slugModalidade(m.modalidade), banco } }));
        expect(h).toContain(`data-taxa-zero="${m.ranking[0].cnpj8}"`);
        // Texto decidido pelo dono no pacote C, 25/10/2026, recomendação D2.
        expect(texto(h)).toContain(NOTA_TAXA_ZERO);
        const figura = h.slice(h.indexOf('id="distribuicao"'), h.indexOf('id="como-ler"'));
        expect(figura).not.toContain(m.ranking[0].nome);
        expect(figura).toContain(m.ranking[1].nome);
        expect(texto(h)).not.toMatch(/undefined|NaN|2026-\d{2}-\d{2}/);
      }
      const h = html(createElement(SimuladorDaParcela, { searchParams: { seg: m.segmento.toLowerCase(), mod: slugModalidade(m.modalidade), banco: m.ranking[0].cnpj8 } }));
      expect(texto(h)).toContain(NOTA_TAXA_ZERO);
    } finally { spy.mockRestore(); }
  });

  it("todos os bancos com zero deixam a comparação ausente, nunca inventam estatísticas", () => {
    const g = amostra([0, 0]);
    expect(compararTaxas(g.modalidades[0]).stats).toBeNull();
    const spy = vi.spyOn(juros, "goldJuros").mockReturnValue(g);
    try {
      const h = html(createElement(QuantoMeuBancoCobra));
      expect(h).toContain('data-comparacao-ausente');
      expect(h).not.toContain('id="distribuicao"');
      for (const r of g.modalidades[0].ranking) expect(h).toContain(`data-taxa-zero="${r.cnpj8}"`);
      expect(texto(h)).not.toMatch(/undefined|NaN/);
    } finally { spy.mockRestore(); }
    expect(compararTaxas(amostra([0, 10]).modalidades[0]).stats).toEqual({ n: 1, min: 10, p25: 10, mediana: 10, p75: 10, max: 10 });
  });

  it("mantém a troca de recorte no simulador sem taxa elegível e permite usar o zero de um banco", () => {
    // Revisão #384, 25/10/2026: ausência de referência não pode remover a saída do recorte.
    const g = amostra([0, 0]);
    const m = g.modalidades[0];
    const outra = gold.modalidades.find((candidata) => candidata.modalidade !== m.modalidade && candidata.segmento === m.segmento)!;
    g.modalidades.push(outra);
    const ausente = outra.ranking.find((r) => !m.ranking.some((linha) => linha.cnpj8 === r.cnpj8))!.cnpj8;
    const spy = vi.spyOn(juros, "goldJuros").mockReturnValue(g);
    try {
      for (const banco of [undefined, ausente]) {
        const h = html(createElement(SimuladorDaParcela, { searchParams: { seg: m.segmento.toLowerCase(), mod: slugModalidade(m.modalidade), banco, valor: "3.000", prazo: "12", cet: "15" } }));
        expect(h).toContain('data-ausencia');
        for (const campo of ["seg", "mod", "banco"]) expect(h).toMatch(new RegExp(`<select[^>]+name="${campo}"`));
        expect(h).toContain(`value="${slugModalidade(outra.modalidade)}"`);
        for (const r of m.ranking) expect(h).toContain(`value="${r.cnpj8}"`);
        expect(h).toMatch(/<form[^>]+method="get"[^>]+action="\/observatorio-do-credito\/simulador-da-parcela"/);
        for (const [campo, valor] of Object.entries({ valor: "3.000", prazo: "12", cet: "15" })) expect(h).toContain(`name="${campo}" value="${valor}"`);
        expect(h).not.toContain('name="taxa"');
        expect(texto(h)).not.toMatch(/undefined|NaN/);
      }
      const recuperado = html(createElement(SimuladorDaParcela, { searchParams: { seg: m.segmento.toLowerCase(), mod: slugModalidade(m.modalidade), banco: m.ranking[0].cnpj8 } }));
      expect(recuperado).toContain(`data-taxa-zero="${m.ranking[0].cnpj8}"`);
      expect(recuperado).toContain('name="taxa"');
      expect(recuperado).not.toContain('data-ausencia');
    } finally { spy.mockRestore(); }
  });
});
