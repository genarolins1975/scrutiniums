import { describe, expect, it, vi } from "vitest";

// O cabeçalho comum usa o roteador do Next, que não existe na renderização estática do teste.
vi.mock("next/navigation", async () => ({
  ...(await vi.importActual<typeof import("next/navigation")>("next/navigation")),
  useRouter: () => ({ push: () => {}, replace: () => {}, prefetch: () => {}, back: () => {}, forward: () => {}, refresh: () => {} }),
  usePathname: () => "/saneamento/contratado",
  useSearchParams: () => new URLSearchParams(),
}));

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import Pagina from "@/app/saneamento/contratado/page";
import Aperitivo from "@/app/aperitivo/saneamento/page";
import { NavegacaoColecaoCliente } from "@/components/layout/NavegacaoColecaoCliente";
import { navegacaoDaColecao } from "@/lib/observatorios/navegacaoColecao";
import { cenario2033, type AreaLab, type TrajetoriaBr } from "@/components/saneamento/Contratado";
import { CAPITULOS, capituloPorSlug } from "@/lib/saneamento/capitulos";
import { APERITIVOS, ehRotaPublica } from "@/lib/rotasPublicas";
import { goldContratado, metaNoAno, nosTotais, reaisMi, resumoContratado, ROTA_CONTRATADO, serieAnual } from "@/lib/saneamento/contratos";
import { respostasDosCapitulos } from "@/lib/saneamento/respostas";
import { inteiro } from "@/lib/saneamento/formato";
import { rotuloConferencia } from "@/lib/saneamento/contratos-apresentacao";
import { VIABILIDADE } from "@/lib/saneamento/viabilidade";

/**
 * Capítulo 15 do Saneamento: o que está contratado desde o novo marco (pipeline/saneamento_contratos).
 * Trava: página com conta, registrada no eixo D e no menu; totais só com contrato de serviço adjudicado e conferido; naturezas
 * de valor nunca somadas entre si; toda linha com fonte, data e grau à vista; metas com documento e hash; ausência escrita como
 * ausência; laboratório identificado como modelo didático e com conta reproduzível; convite do aperitivo dimensionado pela publicação.
 */
const raiz = process.cwd();
const texto = (h: string) => h.replace(/<!-- -->/g, "").replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ");
const g = goldContratado()!;
const html = renderToStaticMarkup(createElement(Pagina));
const t = texto(html);

describe("gold do capítulo 15", () => {
  it("existe, com leilões desde 2020, fonte, data e grau em cada linha", () => {
    expect(g).not.toBeNull();
    expect(g.leiloes.length).toBeGreaterThan(10);
    for (const l of g.leiloes) {
      expect(Number(l.data_leilao.slice(0, 4))).toBeGreaterThanOrEqual(2020);
      expect(l.fonte.url).toMatch(/^https?:\/\//);
      expect(["V", "S"]).toContain(l.fonte.grau);
      expect(l.fonte.data.length).toBeGreaterThan(3);
    }
    const datas = g.leiloes.map((l) => l.data_leilao);
    expect(datas).toEqual([...datas].sort());
  });

  it("totais só com concessão ou PPP adjudicada e conferida; venda de ações e leilão sem propostas ficam fora com o motivo", () => {
    const base = g.leiloes.filter(nosTotais);
    expect(g.totais.nos_totais).toBe(base.length);
    for (const l of base) expect(["concessao", "ppp"]).toContain(l.tipo);
    const fora = new Map(g.totais.fora_dos_totais.map((f) => [f.id, f.motivo]));
    for (const l of g.leiloes) {
      if (!nosTotais(l)) expect(fora.get(l.id), l.id).toBeTruthy();
      if (l.tipo === "alienacao_de_acoes" || l.resultado === "sem_propostas") expect(fora.has(l.id), l.id).toBe(true);
    }
    for (const campo of ["outorga_rs_mi", "contraprestacao_rs_mi", "investimento_previsto_rs_mi"] as const) {
      const soma = base.reduce((s, l) => s + (l[campo] ?? 0), 0);
      expect(g.totais[campo].soma).toBeCloseTo(soma, 2);
    }
  });

  it("metas transcritas têm documento com sha256, cláusula e série monotônica; a regra 'vale em diante' preenche os anos", () => {
    const transcritos = g.contratos.filter((c) => c.situacao === "transcrito");
    expect(transcritos.length).toBeGreaterThanOrEqual(1);
    for (const c of transcritos) {
      expect(c.documento!.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(c.documento!.url).toMatch(/^https?:\/\//);
      expect(c.clausula!.length).toBeGreaterThan(3);
      expect(["civil", "contratual"]).toContain(c.calendario);
      const chave = c.calendario === "contratual" ? "ano_contrato" : "ano";
      for (const m of c.metas) expect(typeof m[chave], `${c.id} ${m.indicador}`).toBe("number");
    }
    // calendário contratual não se situa em ano civil: metaNoAno devolve null e a série vem em anos de contrato
    const contratual = transcritos.find((c) => c.calendario === "contratual");
    if (contratual) {
      expect(metaNoAno(contratual, "ICA", 2033)).toBeNull();
      const ind = contratual.metas[0].indicador;
      const serie = serieAnual(contratual, ind, 0);
      expect(serie[serie.length - 1].ano).toBe(Math.max(...contratual.metas.filter((m) => m.indicador === ind).map((m) => m.ano_contrato!)));
      expect(serie[0].valor).toBe(contratual.metas.filter((m) => m.indicador === ind).sort((a, b) => a.ano_contrato! - b.ano_contrato!)[0].valor);
    }
    const sab = g.contratos.find((c) => c.id === "sp-sabesp-urae1-2024")!;
    expect(metaNoAno(sab, "ICA", 2026)).toBe(97);
    expect(metaNoAno(sab, "ICA", 2033)).toBe(99);
    expect(metaNoAno(sab, "ICE", 2028)).toBe(96);
    expect(metaNoAno(sab, "IPL", 2030)).toBeNull();
    const serie = serieAnual(sab, "ICE", 2033);
    expect(serie[0]).toEqual({ ano: 2026, valor: 90 });
    expect(serie[serie.length - 1]).toEqual({ ano: 2033, valor: 99 });
  });

  it("o resumo confere com a gold", () => {
    const r = resumoContratado()!;
    expect(r.hash_dados).toBe(g.hash_dados);
    expect(r.nos_totais).toBe(g.totais.nos_totais);
    expect(r.contratos_com_metas).toBe(g.contratos.filter((c) => c.situacao === "transcrito").length);
    expect(r.municipios_proxy_sinisa).toBe(g.proxy_sinisa.municipios);
  });
});

describe("página /saneamento/contratado", () => {
  it("é capítulo 15 do eixo D, com conta, no menu, e os arquivos não abrem sem sessão", () => {
    const c = capituloPorSlug("contratado")!;
    expect(c.numero).toBe(15);
    expect(c.situacao).toBe("parcial");
    expect(CAPITULOS.map((x) => x.numero)).toContain(15);
    expect(ehRotaPublica(ROTA_CONTRATADO)).toBe(false);
    for (const a of ["contratado.json", "resumo.json", "leiloes.csv"]) {
      expect(existsSync(join(raiz, "public", "saneamento", "contratos", a)), a).toBe(true);
      expect(ehRotaPublica(`/saneamento/contratos/${a}`), a).toBe(false);
    }
    expect(APERITIVOS.some((a) => a.rota === ROTA_CONTRATADO || a.painelCompleto === ROTA_CONTRATADO)).toBe(false);
    // navegação da coleção (Iniciativa 2): o capítulo está no eixo dele e, aberto, aparece na segunda linha
    const cab = renderToStaticMarkup(createElement(NavegacaoColecaoCliente, { nav: navegacaoDaColecao("saneamento"), caminho: ROTA_CONTRATADO, atual: ROTA_CONTRATADO, idioma: "pt" }));
    expect(cab).toContain('href="/saneamento/contratado"');
  });

  it("abre com os números da gold e a resposta da entrada aparece na página", () => {
    expect(t).toContain(inteiro(g.totais.contratos_de_servico_adjudicados));
    expect(t).toContain(inteiro(g.proxy_sinisa.municipios));
    expect(t).toContain(reaisMi(g.totais.investimento_previsto_rs_mi.soma));
    const r = respostasDosCapitulos()[15]!;
    expect(t).toContain(r.valor);
    expect(r.frase).not.toMatch(/sem dado|NaN|undefined/);
  });

  it("toda linha da tabela está na página com fonte, grau e o motivo quando fica fora dos totais", () => {
    for (const l of g.leiloes) {
      expect(html, l.id).toContain(`data-leilao="${l.id}"`);
      expect(html).toContain(`href="${l.fonte.url}"`);
      // Pacote B, decisão do dono em 25/10/2026: grau por extenso; a natureza da fonte não muda.
      expect(t).toContain(rotuloConferencia(l.fonte.grau, l.fonte.tipo_fonte));
    }
    for (const f of g.totais.fora_dos_totais) expect(t).toContain(f.motivo);
    expect(t).not.toMatch(/undefined|NaN/);
    // naturezas de valor somadas em separado: cada uma com a sua soma e nunca um total geral
    for (const r of ["Outorga, soma", "Contraprestação, soma", "Investimento previsto, soma"]) expect(t).toContain(r);
    expect(t).not.toMatch(/total geral|outorga mais contraprestação|somando outorga e contraprestação/i);
  });

  it("metas com cláusula e hash; ausência escrita como ausência; laboratório identificado como modelo didático", () => {
    for (const c of g.contratos.filter((x) => x.situacao === "transcrito")) {
      expect(html).toContain(`data-contrato="${c.id}"`);
      expect(t).toContain(c.clausula!);
      expect(t).toContain(c.documento!.sha256.slice(0, 12));
      if (c.calendario === "contratual") expect(t).toContain("não é possível dizer em que ano civil cada meta vence");
      if (c.entidades_com_metas > 0) expect(html).toContain('data-faixa-inicial=""');
    }
    for (const c of g.contratos.filter((x) => x.situacao !== "transcrito")) expect(t).toContain(c.nome);
    expect(existsSync(join(raiz, "public", "saneamento", "contratos", "metas_municipios.csv"))).toBe(true);
    if (!g.posicao_2024.length) expect(t).toContain("Nenhum bloco com composição municipal pública");
    if (!g.custos.length) expect(t).toContain("Nenhuma estimativa de custo conferida");
    expect(t).toContain("Modelo didático");
    expect(t).toContain("Quatro ressalvas");
    expect(t).not.toMatch(/cumprido com sucesso|descumpriu|cumpriu a meta/i);
  });

  it("a matriz de viabilidade cobre o capítulo e o texto não usa travessão", () => {
    expect(VIABILIDADE.some((v) => v.capitulo === "15")).toBe(true);
    for (const a of ["src/app/saneamento/contratado/page.tsx", "src/components/saneamento/Contratado.tsx", "src/lib/saneamento/contratos.ts"]) {
      expect(readFileSync(join(raiz, a), "utf-8"), a).not.toMatch(/—|–/);
    }
  });
});

describe("laboratório: conta reproduzível", () => {
  const br: TrajetoriaBr = { pop22: 100, agua: { v2010: 80, v2022: 85 }, esgoto: { v2010: 50, v2022: 60 } };
  const areas: AreaLab[] = [{ id: "a", nome: "Área A", pop22: 20, agua: { v2022: 70, meta2033: 99 }, esgoto: { v2022: 40, meta2033: 90 } }];

  it("sem contratos tudo anda no ritmo; com contratos a área vai à meta e o restante anda no ritmo", () => {
    const r = cenario2033(br, areas, "esgoto", 0);
    expect(r.popResto).toBe(80);
    // restante em 2022: (60×100 − 40×20) / 80 = 65
    expect(r.vResto2022).toBeCloseTo(65, 6);
    expect(r.semContratos).toBeCloseTo(60, 6);
    // com contratos e ritmo zero: (90×20 + 65×80) / 100 = 70
    expect(r.comContratos).toBeCloseTo(70, 6);
  });

  it("o ritmo acrescenta pontos por ano ao restante e satura em 100%", () => {
    const r = cenario2033(br, areas, "agua", 10);
    expect(r.resto2033).toBe(100);
    expect(r.semContratos).toBe(100);
    expect(r.comContratos).toBeCloseTo((99 * 20 + 100 * 80) / 100, 6);
  });

  it("área sem meta para o serviço não entra na conta", () => {
    const r = cenario2033(br, [{ ...areas[0], esgoto: { v2022: 40, meta2033: null } }], "esgoto", 1);
    expect(r.validas).toHaveLength(0);
    expect(r.comContratos).toBeCloseTo(r.semContratos, 6);
  });
});

describe("aperitivo do Saneamento", () => {
  it("o convite lista o capítulo 15, dimensionado pela publicação", () => {
    const r = resumoContratado()!;
    const h = texto(renderToStaticMarkup(createElement(Aperitivo, { searchParams: {} })));
    expect(h).toContain("Concessões contratadas desde o novo marco de 2020");
    expect(h).toContain(`${inteiro(r.leiloes_registrados)} leilões e desestatizações registrados`);
  });
});
