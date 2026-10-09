/* Página inicial como porta de entrada: os seis sinais (um seletor por pergunta, lendo a gold e as funções do módulo), o estado de
 * ausência de cada um, a ficha de prova que confere com o número exibido e a página renderizada (ordem da primeira tela, índice,
 * links preservados, texto sem "hoje", travessão, undefined ou NaN). Os valores esperados são lidos das golds por outro caminho,
 * sem repetir a regra do seletor, e comparados com a Visão geral, que lê os mesmos campos. */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Home from "@/app/setor-eletrico/page";
import { lerCaminho } from "@/lib/energia/carregaJson";
import { sinaisDaInicial, sinalAgua, sinalConta, sinalExpansao, sinalPerdas, sinalPld, sinalQualidade, universoPerdas, type SinalDisponivel, type SinalHome } from "@/lib/energia/home-sinais";
import { linhasAtualidade } from "@/lib/energia/home";
import { CARTOES, CAMINHOS_INTENCAO, ID_SINAIS, NOS_MAPA, PERGUNTAS_COTIDIANAS, PERGUNTAS_PRIORITARIAS, TRANSVERSAIS, TRILHAS } from "@/lib/energia/mapa";
import { DESTINOS_NAVEGACAO, destino } from "@/lib/energia/navegacao";
import { ANCORAS_VISAO_GERAL } from "@/lib/energia/mapa";
import { DATASETS_INTEGRADOS } from "@/lib/energia/datasets";
import type { PublicacaoAtualidade } from "@/lib/energia/home";
import type { SinteseVisaoGold } from "@/lib/energia/tipos-visao";
import type { ContaGold } from "@/lib/energia/tipos-conta";
import type { QualidadeGold } from "@/lib/energia/tipos-qualidade";
import type { PerdasGold } from "@/lib/energia/tipos-perdas";
import type { AguaDetalheGold } from "@/lib/energia/tipos-agua";
import type { ExpansaoGold } from "@/lib/energia/tipos-expansao";
import type { PldGold } from "@/lib/energia/tipos";

const raiz = process.cwd();
const gold = <T,>(arq: string) => JSON.parse(readFileSync(join(raiz, "public/energia/gold", arq), "utf-8")) as T;
const clone = <T,>(x: T): T => structuredClone(x);

const CONTA = gold<ContaGold>("conta.json");
const QUALIDADE = gold<QualidadeGold>("qualidade.json");
const PERDAS = gold<PerdasGold>("perdas.json");
const AGUA = gold<AguaDetalheGold>("agua_detalhe.json");
const PLD = gold<PldGold>("pld.json");
const EXPANSAO = gold<ExpansaoGold>("expansao.json");
const SINTESE = gold<SinteseVisaoGold>("sintese.json");

const disponivel = (s: SinalHome): SinalDisponivel => {
  expect(s.estado, s.id).toBe("disponivel");
  return s as SinalDisponivel;
};

/** Todo texto que o leitor lê de um sinal. */
function textos(s: SinalHome): string[] {
  if (s.estado !== "disponivel") return [s.medida, s.motivo, s.periodo ?? ""];
  return [s.medida, s.valorTexto, s.unidade, s.periodo, s.universo, s.ressalva, ...s.referencias, s.variacao?.referencia ?? ""];
}

describe("os seis sinais da inicial: o número é o da gold do módulo", () => {
  const sinais = sinaisDaInicial();

  it("são seis, na ordem da página, cada um com valor, unidade, período, universo, natureza e ressalva", () => {
    expect(sinais.map((s) => s.id)).toEqual([...ID_SINAIS]);
    expect(sinais.map((s) => s.id)).toEqual(PERGUNTAS_PRIORITARIAS.map((p) => p.id));
    for (const s of sinais) {
      const d = disponivel(s);
      expect(Number.isFinite(d.valor), s.id).toBe(true);
      expect(d.valorTexto, s.id).not.toBe("sem dado");
      expect(d.unidade.length, s.id).toBeGreaterThan(1);
      expect(d.periodo.length, s.id).toBeGreaterThan(3);
      expect(d.universo.length, s.id).toBeGreaterThan(20);
      expect(d.ressalva.length, s.id).toBeGreaterThan(20);
      expect(["OBSERVADO", "CALCULADO", "ESTIMADO", "PREVISTO", "CENARIO"], s.id).toContain(d.natureza);
      // o endereço da citação é o painel do módulo, o mesmo link da pergunta
      expect(d.endereco, s.id).toBe(PERGUNTAS_PRIORITARIAS.find((p) => p.id === s.id)!.link.href);
    }
  });

  it("conta: a tarifa mediana B1 residencial em R$/kWh, a de 200 kWh e os quartis vêm do resumo publicado", () => {
    const s = disponivel(sinalConta());
    const r = CONTA.tarifas.resumo;
    expect(s.valor).toBeCloseTo(r.mediana! / 1000, 10);
    expect(s.formato).toBe("reais");
    expect(s.valorTexto).toBe(`R$ ${(r.mediana! / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`);
    expect(s.periodo).toBe(`vigente em ${CONTA.data_referencia.split("-").reverse().join("/")}`);
    expect(s.universo).toContain(`${r.n} distribuidoras`);
    expect(s.referencias[0]).toContain(`R$ ${r.perfis_mediana["200"]!.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);
    expect(s.referencias[1]).toMatch(/Metade das distribuidoras fica entre/);
    // tarifa homologada não é fatura: a ressalva está junto do número
    expect(s.ressalva).toMatch(/sem tributos, bandeira nem iluminação pública/);
    expect(s.ressalva).toMatch(/não é o valor da fatura/);
  });

  it("qualidade: o DEC apurado do Brasil no ano de referência, com o ano anterior como variação e o equivalente em horas e minutos", () => {
    const s = disponivel(sinalQualidade());
    const ref = QUALIDADE.ano_referencia;
    const a = QUALIDADE.brasil.anual.find((x) => x.ano === ref)!;
    const ant = QUALIDADE.brasil.anual.find((x) => x.ano === ref - 1)!;
    expect(s.valor).toBe(a.dec);
    expect(s.periodo).toBe(`ano de ${ref}`);
    expect(s.variacao).toMatchObject({ casas: 2, sufixo: " h", referencia: `contra ${ref - 1}` });
    expect(s.variacao!.valor).toBeCloseTo(a.dec! - ant.dec!, 10);
    // 9,33 h são 9 h 20 min, nunca 9 h 33 min
    expect(s.referencias[0]).toMatch(/^Equivale a \d+ h \d+ min/);
    expect(s.referencias[0]).not.toContain(`${Math.floor(a.dec!)} h ${String(a.dec).split(".")[1]} min`);
    // o apurado não é tudo: a soma com o que a regra exclui está junto do número
    expect(s.ressalva).toContain("não inclui as interrupções que a regra exclui");
    expect(s.ressalva).toContain(`${a.dec_todas_parcelas!.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} h`);
  });

  it("perdas: a taxa das concessionárias no ano de referência, a variação nas mesmas distribuidoras e o universo com as permissionárias fora", () => {
    const s = disponivel(sinalPerdas());
    const ano = PERDAS.referencia.ano;
    const nac = PERDAS.nacional.find((l) => l.ano === ano && l.universo === "concessionarias")!;
    expect(s.valor).toBe(nac.taxa_total_pct);
    expect(s.periodo).toBe(`ano de ${ano}`);
    const par = nac.mesmas_ano_anterior!.taxa_total_pct!;
    expect(s.variacao!.valor).toBeCloseTo(par[1]! - par[0]!, 2);
    expect(s.variacao!.referencia).toContain(`nas mesmas ${nac.mesmas_ano_anterior!.n_total} concessionárias`);
    const u = universoPerdas(PERDAS)!;
    expect(u).toMatchObject({ ano });
    expect(s.universo).toContain(`${u.permissionarias} permissionárias ficam fora deste total`);
    expect(s.ressalva).toMatch(/não é sinônimo de furto/);
  });

  it("reservatórios: a EAR do SIN em % da EAR máxima, a mediana do mesmo dia na base publicada e a variação em 30 dias", () => {
    const s = disponivel(sinalAgua());
    const sin = AGUA.armazenamento.subsistemas.find((x) => x.sm === "SIN")!;
    expect(s.valor).toBe(sin.ear_pct);
    expect(s.periodo).toBe(sin.dia.split("-").reverse().join("/"));
    expect(s.referencias[0]).toContain(`${sin.periodo_base!.replace("-", " a ")}`);
    expect(s.referencias[0]).toContain(`${sin.p50!.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`);
    expect(s.variacao).toMatchObject({ valor: sin.variacao_30d_pp, sufixo: " p.p.", referencia: "em 30 dias" });
    expect(s.ressalva).toMatch(/não mede risco de desabastecimento/);
  });

  it("PLD: a média do dia no Sudeste/Centro-Oeste e os outros três submercados, cada um com o nome e o valor, sem média dos quatro", () => {
    const s = disponivel(sinalPld());
    const se = PLD.cartoes.find((c) => c.sm === "SE")!;
    expect(s.valor).toBe(se.media_dia);
    expect(s.periodo).toBe(PLD.dia_referencia.split("-").reverse().join("/"));
    for (const sm of ["S", "NE", "N"] as const) {
      const c = PLD.cartoes.find((x) => x.sm === sm)!;
      expect(s.referencias[0], sm).toContain(`${c.nome} R$ ${c.media_dia.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);
    }
    const media = PLD.cartoes.reduce((a, c) => a + c.media_dia, 0) / PLD.cartoes.length;
    expect(s.valor).not.toBeCloseTo(media, 6);
    // PLD não é tarifa
    expect(s.ressalva).toMatch(/não a tarifa/);
  });

  it("expansão: a potência outorgada em construção no SIGA, com operação e obra não iniciada como referências separadas, sem soma", () => {
    const s = disponivel(sinalExpansao());
    const [op, con, nao] = ["operacao", "construcao", "construcao_nao_iniciada"].map((e) => EXPANSAO.estagios.resumo.find((r) => r.estagio === e)!);
    expect(s.valor).toBe(con.mw_outorgado);
    expect(s.periodo).toBe(EXPANSAO.estagios.data_referencia.split("-").reverse().join("/"));
    expect(s.referencias).toHaveLength(2);
    expect(s.referencias[0]).toContain(`${op.mw_fiscalizado.toLocaleString("pt-BR", { minimumFractionDigits: 1 })} MW fiscalizados`);
    expect(s.referencias[1]).toContain(`${nao.mw_outorgado.toLocaleString("pt-BR", { minimumFractionDigits: 1 })} MW`);
    expect(s.ressalva).toMatch(/as três etapas não se somam/);
    expect(s.ressalva).toMatch(/MW é potência/);
    // a gold não publica ficha para a fase de construção: sem ficha, sem prova
    expect(s.prova).toBeNull();
  });

  it("os números da Visão geral são os mesmos, quando o período é o mesmo (a Visão geral lê as mesmas golds)", () => {
    const por = new Map(SINTESE.sociedade.itens.map((i) => [i.id, i]));
    const tarifa = por.get("tarifa")!;
    const dec = por.get("continuidade")!;
    const perdas = por.get("perdas")!;
    const conta = disponivel(sinalConta());
    expect(tarifa.periodo.fim).toBe(CONTA.data_referencia);
    expect(conta.valor * 1000).toBeCloseTo(tarifa.valor, 6);
    const qual = disponivel(sinalQualidade());
    expect(dec.periodo.inicio.slice(0, 4)).toBe(String(QUALIDADE.ano_referencia));
    expect(qual.valor).toBeCloseTo(dec.valor, 6);
    const per = disponivel(sinalPerdas());
    expect(perdas.periodo.inicio.slice(0, 4)).toBe(String(PERDAS.referencia.ano));
    expect(per.valor).toBeCloseTo(perdas.valor, 6);
    const preco = SINTESE.multiplos!.paineis.find((p) => p.id === "preco")!;
    const pld = disponivel(sinalPld());
    expect(preco.data_referencia).toBe(PLD.dia_referencia);
    expect(pld.valor).toBeCloseTo(preco.valor_atual.valor!, 6);
  });

  it("nenhum texto de sinal tem travessão, hífen como separador, 'hoje', 'agora', undefined ou NaN", () => {
    for (const s of sinais) {
      for (const t of textos(s)) {
        expect(t, `${s.id}: ${t}`).not.toMatch(/[–—]/);
        expect(t, `${s.id}: ${t}`).not.toMatch(/ - /);
        expect(t, `${s.id}: ${t}`).not.toMatch(/\bhoje\b|\bagora\b/i);
        expect(t, `${s.id}: ${t}`).not.toMatch(/undefined|NaN|\[object Object\]/);
      }
    }
  });

  it("a ficha de prova de cada sinal existe no JSON público da gold, com o mesmo valor exibido e o valor de cálculo que confere com o número", () => {
    let comProva = 0;
    for (const s of sinais) {
      const d = disponivel(s);
      if (!d.prova) continue;
      comProva++;
      expect(d.prova.url, s.id).toMatch(/^\/energia\/gold\/[a-z_]+\.json$/);
      const json = JSON.parse(readFileSync(join(raiz, "public", d.prova.url), "utf-8"));
      const ev = lerCaminho(json, d.prova.caminho) as { valor_exibido: string; valor_calculo: number; fonte: { sha256: string | null } } | undefined;
      expect(ev, `${s.id}: ${d.prova.caminho}`).toBeTruthy();
      expect(ev!.valor_exibido, s.id).toBe(d.prova.valorExibido);
      // o valor de cálculo arredonda, na escala do exibido, para o número da tela
      const escala = s.id === "conta" ? 1000 : 1;
      expect(Math.abs(ev!.valor_calculo / escala - d.valor), s.id).toBeLessThanOrEqual(0.5 * 10 ** -d.casas + 1e-9);
    }
    // cinco dos seis números têm ficha (a gold de Expansão não publica a da fase de construção)
    expect(comProva).toBe(5);
  });

  it("a ficha do PLD só vale se o dia e o valor da Visão geral forem os do sinal; senão não há ficha", () => {
    const outraData = clone(SINTESE);
    outraData.multiplos!.paineis.find((p) => p.id === "preco")!.data_referencia = "2026-01-01";
    expect(disponivel(sinalPld(PLD, outraData)).prova).toBeNull();
    const outroValor = clone(SINTESE);
    outroValor.multiplos!.paineis.find((p) => p.id === "preco")!.evidencia!.valor_calculo = 99;
    expect(disponivel(sinalPld(PLD, outroValor)).prova).toBeNull();
    expect(disponivel(sinalPld(PLD, null)).prova).toBeNull();
    expect(disponivel(sinalPld(PLD, SINTESE)).prova?.caminho).toMatch(/^multiplos\.paineis\[\d+\]\.evidencia$/);
  });
});

describe("ausência é um estado, com motivo, e nunca vira zero", () => {
  const semGold = [sinalConta(null), sinalQualidade(null), sinalPerdas(null), sinalAgua(null), sinalPld(null), sinalExpansao(null)];

  it("sem a gold do módulo, o sinal fica indisponível, com o motivo, sem valor", () => {
    for (const s of semGold) {
      expect(s.estado, s.id).toBe("indisponivel");
      expect("valor" in s, s.id).toBe(false);
      expect((s as { motivo: string }).motivo, s.id).toMatch(/não foi processada nesta publicação/);
    }
  });

  it("gold que se declara indisponível usa o motivo que ela publica", () => {
    const g = { ...clone(CONTA), disponivel: false, motivo: "A fonte recusou o acesso." } as unknown as ContaGold;
    const s = sinalConta(g);
    expect(s.estado).toBe("indisponivel");
    expect((s as { motivo: string }).motivo).toBe("A fonte recusou o acesso.");
  });

  it("valor que falta dentro de uma gold publicada vira 'ausente', com o período e o motivo, nunca zero", () => {
    const conta = clone(CONTA);
    conta.tarifas.resumo.mediana = null;
    const q = clone(QUALIDADE);
    q.brasil.anual.find((a) => a.ano === q.ano_referencia)!.dec = null;
    const p = clone(PERDAS);
    p.nacional = p.nacional.filter((l) => !(l.ano === p.referencia.ano && l.universo === "concessionarias"));
    const a = clone(AGUA);
    a.armazenamento.subsistemas.find((s) => s.sm === "SIN")!.ear_pct = null;
    const l = clone(PLD);
    l.cartoes.find((c) => c.sm === "SE")!.media_dia = null as unknown as number;
    const e = clone(EXPANSAO);
    e.estagios.resumo = e.estagios.resumo.filter((r) => r.estagio !== "construcao");
    const ausentes = [sinalConta(conta), sinalQualidade(q), sinalPerdas(p), sinalAgua(a), sinalPld(l), sinalExpansao(e)];
    for (const s of ausentes) {
      expect(s.estado, s.id).toBe("ausente");
      expect("valor" in s, s.id).toBe(false);
      expect((s as { motivo: string }).motivo.length, s.id).toBeGreaterThan(20);
      for (const t of textos(s)) expect(t, s.id).not.toMatch(/undefined|NaN|\b0,00\b|R\$\s*0\b/);
    }
    // o período que a gold publica continua dito, para o leitor saber de que dia falta o dado
    expect((ausentes[0] as { periodo: string }).periodo).toMatch(/vigente em \d{2}\/\d{2}\/\d{4}/);
    expect((ausentes[1] as { periodo: string }).periodo).toBe(`ano de ${QUALIDADE.ano_referencia}`);
  });

  it("sem o ano anterior, ou sem as mesmas distribuidoras, a variação não existe (nunca 'sem variação' como zero)", () => {
    const q = clone(QUALIDADE);
    q.brasil.anual = q.brasil.anual.filter((a) => a.ano !== q.ano_referencia - 1);
    expect(disponivel(sinalQualidade(q)).variacao).toBeNull();
    const p = clone(PERDAS);
    p.nacional.find((l) => l.ano === p.referencia.ano && l.universo === "concessionarias")!.mesmas_ano_anterior = null;
    expect(disponivel(sinalPerdas(p)).variacao).toBeNull();
    const a = clone(AGUA);
    a.armazenamento.subsistemas.find((s) => s.sm === "SIN")!.variacao_30d_pp = null;
    expect(disponivel(sinalAgua(a)).variacao).toBeNull();
  });

  it("sem mediana sazonal (poucos anos de base) a referência de reservatórios não é inventada", () => {
    const a = clone(AGUA);
    a.armazenamento.subsistemas.find((s) => s.sm === "SIN")!.p50 = null;
    expect(disponivel(sinalAgua(a)).referencias).toEqual([]);
  });

  it("a ficha de prova some quando a evidência da gold não confere com o número exibido", () => {
    const q = clone(QUALIDADE);
    q.evidencias.dec_brasil!.valor_calculo = 12.5;
    expect(disponivel(sinalQualidade(q)).prova).toBeNull();
    const c = clone(CONTA);
    c.tarifas.evidencia_mediana.valor_calculo = null;
    expect(disponivel(sinalConta(c)).prova).toBeNull();
  });
});

/* ---------- a página renderizada ---------- */

const html = renderToStaticMarkup(createElement(Home as never));
const texto = (h: string) =>
  h
    .replace(/<(script|style)[\s\S]*?<\/\1>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ");
const hrefs = new Set(Array.from(html.matchAll(/<a [^>]*?href="([^"]+)"/g)).map((m) => m[1].replace(/&amp;/g, "&")));
const SECOES = ["perguntas", "destinos", "mapa-conceitual", "trilhas", "como-confiar", "aprofundar"];
/** O HTML de uma seção de primeiro nível: do início dela ao início da seguinte (ou ao fim do <main>). */
const secao = (id: string) => {
  const i = html.indexOf(`<section id="${id}"`);
  const proximas = SECOES.map((x) => html.indexOf(`<section id="${x}"`)).filter((j) => j > i);
  const fim = proximas.length ? Math.min(...proximas) : html.indexOf("</main>");
  return { i, html: html.slice(i, fim) };
};

describe("a página renderizada", () => {
  it("a primeira tela tem, nesta ordem, o título de 5 a 9 palavras, a frase, a busca e os quatro caminhos, antes das seis perguntas", () => {
    const h1 = /<h1[^>]*>([^<]+)<\/h1>/.exec(html)![1];
    expect(h1).toBe("Energia, do sistema à sua conta");
    expect(h1.split(/\s+/).length).toBeGreaterThanOrEqual(5);
    expect(h1.split(/\s+/).length).toBeLessThanOrEqual(9);
    const ordem = [html.indexOf("<h1"), html.indexOf('type="search"'), html.indexOf('aria-label="Por onde começar"'), html.indexOf('<section id="perguntas"')];
    expect(ordem.every((x) => x > 0)).toBe(true);
    expect([...ordem].sort((a, b) => a - b)).toEqual(ordem);
    // a busca é real: o campo e o índice vêm do mesmo conteúdo que a página publica (o teste da busca confere o índice)
    expect(html).toContain("Busque por pergunta");
  });

  it("os quatro caminhos têm link real: Visão geral, Território, Aprenda e Dados e Metodologia", () => {
    for (const c of CAMINHOS_INTENCAO) {
      expect(html, c.id).toContain(`data-caminho="${c.id}"`);
      for (const s of c.slugs) expect(hrefs.has(destino(s).href), `${c.id}: ${s}`).toBe(true);
    }
  });

  it("as seis perguntas aparecem em ordem, com o número, o período e o link; perdas e qualidade trazem 'sua distribuidora'", () => {
    const ordem = PERGUNTAS_PRIORITARIAS.map((p) => html.indexOf(`data-sinal="${p.id}"`));
    expect(ordem.every((x) => x > 0)).toBe(true);
    expect([...ordem].sort((a, b) => a - b)).toEqual(ordem);
    for (const p of PERGUNTAS_PRIORITARIAS) expect(texto(html), p.id).toContain(p.pergunta);
    expect(html.match(/data-sinal="/g)).toHaveLength(6);
    expect(html.match(/data-estado="disponivel"/g)).toHaveLength(6);
    expect(html.match(/Sua distribuidora/g)).toHaveLength(2);
    // seis medidas, cada uma com período e selo de natureza em texto
    expect(html.match(/data-medida="/g)).toHaveLength(6);
    expect(html.match(/Natureza do dado: /g)!.length).toBeGreaterThanOrEqual(6);
    // a ficha "Comprove este número": cinco dos sinais e o exemplo de "Como ler e conferir"
    expect(html.match(/Comprove este número/g)!.length).toBeGreaterThanOrEqual(6);
    for (const p of PERGUNTAS_PRIORITARIAS) {
      if (p.porDistribuidora) continue;
      expect(hrefs.has(p.link.href), p.id).toBe(true);
    }
  });

  it("o índice lista os 20 destinos, agrupados nos seis grupos, cada um com a pergunta curta e o estado vindo de navegacao.ts", () => {
    const indice = secao("destinos").html;
    const destinos = DESTINOS_NAVEGACAO.filter((d) => d.slug !== "mapa");
    expect(destinos).toHaveLength(20);
    for (const d of destinos) {
      expect(indice, d.slug).toContain(`href="${d.href}"`);
      expect(texto(indice), d.slug).toContain(d.pergunta);
    }
    for (const g of ["Comece aqui", "Operação do sistema", "Preços e mercado", "Consumidor e território", "Empresas e futuro", "Conhecimento e evidência"]) expect(texto(indice), g).toContain(g);
    // sem módulo em integração nesta publicação, a página não escreve "Em integração" no índice (só no cartão condicional, que não aparece)
    const emIntegracao = destinos.filter((d) => d.publicado && !d.integrado).length;
    expect(texto(indice.slice(0, indice.indexOf("<details"))).includes("Em integração")).toBe(emIntegracao > 0);
    expect(texto(indice)).toContain(emIntegracao === 0 ? "As 20 páginas publicam números." : "em integração");
  });

  it("o índice não repete o mesmo destino: cada link de destino aparece uma vez no índice visível", () => {
    const indice = secao("destinos").html;
    const visivel = indice.slice(0, indice.indexOf("<details"));
    for (const d of DESTINOS_NAVEGACAO.filter((x) => x.slug !== "mapa")) expect(visivel.split(`href="${d.href}"`).length - 1, d.slug).toBe(1);
  });

  it("o mapa conceitual está à vista (desenho no desktop, versão em texto no celular), com os tipos de ligação e 'O que o mapa não diz' junto", () => {
    const mapa = secao("mapa-conceitual").html;
    expect(mapa).not.toMatch(/<details/);
    expect(mapa).toContain("O mapa em texto");
    expect(mapa).toContain("O que o mapa não diz");
    for (const f of ["Caminho físico", "Coordenação da operação", "Relações econômicas", "Experiência das pessoas"]) expect(texto(mapa), f).toContain(f);
    for (const n of NOS_MAPA) expect(texto(mapa), n.id).toContain(n.titulo);
    // cada ligação aparece uma vez na versão em texto (no elo de onde parte), com o tipo
    for (const t of ["fluxo físico", "decisão de operação", "regra de mercado", "componente de custo", "associação analítica"]) expect(texto(mapa), t).toContain(t);
  });

  it("o que saiu do fluxo principal continua no HTML, em blocos recolhíveis, com todos os links", () => {
    // blocos recolhíveis: outras perguntas, detalhe de cada página, atualidade por fonte, sete de 'Como ler e conferir' e uma de cada trilha
    expect(html.match(/<details/g)!.length).toBeGreaterThanOrEqual(1 + 1 + 1 + 7 + TRILHAS.length);
    expect(html).not.toMatch(/<details[^>]* open/);
    const links = new Set<string>();
    for (const c of Object.values(CARTOES)) for (const e of c.encontra) links.add(e.href);
    for (const p of PERGUNTAS_COTIDIANAS) for (const d of p.destinos) links.add(d.href);
    for (const t of TRILHAS) for (const s of t.paradas) links.add(s.href);
    for (const n of NOS_MAPA) for (const s of n.destinos) links.add(destino(s).href);
    for (const t of TRANSVERSAIS) for (const s of t.destinos) links.add(destino(s).href);
    for (const d of DESTINOS_NAVEGACAO.filter((x) => x.slug !== "mapa")) links.add(d.href);
    for (const l of ["/observatorio/suggestions", "/setor-eletrico/metodologia", "/setor-eletrico/dados", "/setor-eletrico/dados/saude", "/setor-eletrico/dados/reproducao"]) links.add(l);
    const falta = Array.from(links).filter((h) => !hrefs.has(h));
    expect(falta).toEqual([]);
    // textos das cinco explicações, do exemplo real e das notas de atualidade
    const t = texto(html);
    for (const x of ["Cada data diz uma coisa", "Dados revisados", "Nomes e réguas que se confundem", "Ausência nunca vira zero", "Correções e sugestões", "Cinco naturezas de número", "Um número real, do arquivo à página"]) {
      expect(t, x).toContain(x);
    }
    expect(t).toContain("Ao todo, 103 distribuidoras têm dado de 2025; este total soma só as 51 concessionárias, e as 52 permissionárias ficam fora dele.");
    expect(t).toContain("Sem calendário declarado: a fonte não informa de quanto em quanto tempo atualiza");
    expect(t).toContain("O que se aprende em cada parada");
    for (const tr of TRILHAS) for (const s of tr.paradas) expect(t, s.rotulo).toContain(`você aprende ${s.aprende}`);
  });

  it("as âncoras antigas da Visão geral não existem na inicial, e as sete da inicial existem", () => {
    for (const a of ANCORAS_VISAO_GERAL) expect(html, a).not.toContain(`id="${a}"`);
    for (const id of ["proposito", "perguntas", "destinos", "mapa-conceitual", "trilhas", "como-confiar", "aprofundar"]) expect(html, id).toContain(`id="${id}"`);
  });

  it("fontes e atualidade em resumo: contagens e atrasadas à vista, a tabela por fonte recolhida, e o acesso à lista completa", () => {
    const f = secao("aprofundar").html;
    expect(f).toContain("data-resumo-atualidade");
    for (const l of ["/setor-eletrico/dados", "/setor-eletrico/dados/saude", "/setor-eletrico/dados/reproducao"]) expect(f, l).toContain(`href="${l}"`);
    const antes = f.slice(0, f.indexOf("<details"));
    expect(antes).not.toContain("<table");
    expect(f.slice(f.indexOf("<details"))).toContain("<table");
    // a cronologia de capturas de todas as bases não abre a página
    expect(texto(html.slice(0, html.indexOf('<section id="aprofundar"')))).not.toMatch(/Capturado pela plataforma em .*Capturado pela plataforma em/);
  });

  it("o texto da página não tem travessão, hífen como separador, 'hoje', undefined nem NaN", () => {
    const t = texto(html.replace(/<blockquote[\s\S]*?<\/blockquote>/g, "").replace(/<a [^>]*target="_blank"[^>]*>[\s\S]*?<\/a>/g, ""));
    expect(t).not.toMatch(/[–—]/);
    expect(t).not.toMatch(/ - /);
    expect(t).not.toMatch(/\bhoje\b/i);
    expect(t).not.toMatch(/undefined|NaN|\[object Object\]/);
  });

  it("os dois seletores de distribuidora seguem na inicial, com o ano e a contagem no rótulo", () => {
    const t = texto(html);
    expect(t).toContain("Escolha (103 distribuidoras com dado de 2025)");
    expect(t).toContain("Escolha (102 distribuidoras com dado de 2025)");
  });

  it("a ficha da atualidade usa os conjuntos que a publicação traz (a tabela recolhida lista todas as fontes principais)", () => {
    const pub = gold<PublicacaoAtualidade & { disponivel?: boolean }>("publicacao.json");
    const linhas = linhasAtualidade(pub.disponivel === false ? null : pub, new Set(DATASETS_INTEGRADOS.map((d) => d.slug)));
    const tabela = html.slice(html.indexOf('<table class="w-full min-w-[44rem]'), html.indexOf("</table>", html.indexOf('<table class="w-full min-w-[44rem]')));
    expect(tabela.match(/<tr/g)!.length).toBe(linhas.length + 1);
  });
});
