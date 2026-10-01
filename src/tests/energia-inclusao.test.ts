/* eslint-disable @typescript-eslint/no-explicit-any -- varredura genérica da gold publicada */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Sintese from "@/app/setor-eletrico/inclusao-energetica/page";
import PaginaAcesso from "@/app/setor-eletrico/inclusao-energetica/acesso/page";
import PaginaCobertura from "@/app/setor-eletrico/inclusao-energetica/cobertura/page";
import PaginaOrcamento from "@/app/setor-eletrico/inclusao-energetica/orcamento/page";
import PaginaTarifa from "@/app/setor-eletrico/inclusao-energetica/tarifa-social/page";
import { problemasEvidencia, type Evidencia } from "@/lib/energia/evidencia";
import { pct } from "@/lib/energia/formato";
import {
  CODIGO_UF,
  ESQUEMA_COBERTURA,
  LIMIARES_POF,
  maiorCvPnad,
  minusculaInicial,
  mudancaOrcamento,
  rotulosEstadoPof,
  textoCusteioTarifaSocial,
  textoPrecisaoPnad,
  textoPrecisaoPof,
  COLUNAS_SERIE_TSEE,
  COLUNAS_UFS_TSEE,
  dadosClassesPof,
  dadosHistoricoPnadCsv,
  dadosHistoricoUf,
  dadosLptAnual,
  dadosMediaCde,
  dadosSerieCobertura,
  dadosSeriePnad,
  dadosSerieTsee,
  estimativa,
  inteiro,
  itensFaixaCobertura,
  lerCsv,
  linhaPof,
  linhasCoberturaUf,
  linhasIsoladosUf,
  linhasMesesCde,
  linhasTabelaSerieTsee,
  linhasUfsPnad,
  linhasUfsPof,
  linhasUfsTsee,
  localidadesDoJson,
  mudancaAcesso,
  mudancaTarifaSocial,
  municipiosDoCsv,
  orcamentoBase,
  respostaAcesso,
  respostaCobertura,
  respostaOrcamento,
  respostaTarifaSocial,
  textoMesesIncompletosScs,
  ufsAtingidasPorAusencia,
  valoresMapaCobertura,
  valoresMapaPnad,
  valoresMapaPof,
  valoresMapaTsee,
} from "@/lib/energia/inclusao";
import { DESTINOS_NAVEGACAO } from "@/lib/energia/navegacao";
import { conceito } from "@/lib/energia/conteudo/conceitos";
import { matrizExportacao } from "@/lib/energia/tabela";
import type { InclusaoGold, SerieCdeUf, SerieCoberturaMensal } from "@/lib/energia/tipos-inclusao";

/**
 * Página Inclusão energética (P059 a P062): contrato da gold, equivalência entre
 * gráfico, tabela e exportação (as mesmas linhas, conferidas contra os CSV
 * publicados pelo pipeline, por caminho independente quando há um), textos
 * derivados dos números (mudar o número muda o texto) e renderização no servidor.
 */
const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, p), "utf-8");
const gold = (): InclusaoGold => JSON.parse(ler("public/energia/gold/inclusao.json"));
const G = gold();
const csv = (n: string) => lerCsv(ler(`public/energia/series/${n}`));
const n = (s: string | undefined) => (s === undefined || s === "" ? null : Number(s));

function objetos(o: any, teste: (x: any) => boolean, out: any[] = []): any[] {
  if (Array.isArray(o)) o.forEach((x) => objetos(x, teste, out));
  else if (o && typeof o === "object") {
    if (teste(o)) out.push(o);
    Object.values(o).forEach((v) => objetos(v, teste, out));
  }
  return out;
}

describe("contrato da gold inclusao.json", () => {
  it("cabeçalho, disponibilidade, validação sem crítico e os quatro blocos", () => {
    expect(G.dominio).toBe("energia");
    expect(G.gold).toBe("inclusao.json");
    expect(G.disponivel).toBe(true);
    expect(G.validacao.criticos).toEqual([]);
    for (const b of ["tarifa_social", "cobertura", "orcamento", "acesso"] as const) expect(G[b], b).toBeTruthy();
    expect(G.referencias.scs_mes_referencia).toMatch(/^\d{4}-\d{2}$/);
  });

  it("toda proveniência tem natureza, fonte com URL e licença, período, snapshot e limitações; calculado tem fórmula; download existe", () => {
    const provs = objetos(G, (x) => "natureza" in x && "fonte" in x && "limitacoes" in x);
    expect(provs.length).toBeGreaterThanOrEqual(10);
    for (const p of provs) {
      expect(["OBSERVADO", "CALCULADO", "ESTIMADO", "PREVISTO", "CENARIO"], p.indicador).toContain(p.natureza);
      expect(p.fonte.url_dataset, p.indicador).toMatch(/^https:\/\//);
      expect(p.fonte.licenca, p.indicador).toBeTruthy();
      expect(p.periodo_referencia.inicio && p.periodo_referencia.fim, p.indicador).toBeTruthy();
      expect(p.snapshot.sha256, p.indicador).toMatch(/^[0-9a-f]{64}$/);
      expect(p.limitacoes.length, p.indicador).toBeGreaterThan(0);
      if (p.natureza === "CALCULADO") expect(p.formula, p.indicador).toBeTruthy();
      if (p.download) expect(existsSync(join(raiz, "public", p.download)), p.download).toBe(true);
    }
  });

  it("todas as fichas 'Comprove este número' passam na verificação da interface", () => {
    const evs = objetos(G, (x) => "valor_exibido" in x && "citacao" in x) as Evidencia[];
    // P059 (4), P060 (1), P061 (3), P062 (3: sem energia, população isolada, Luz para Todos)
    expect(evs.length).toBeGreaterThanOrEqual(11);
    for (const e of evs) expect(problemasEvidencia(e), e.indicador).toEqual([]);
    expect(G.acesso.sistemas_isolados?.evidencia_populacao?.valor_calculo).toBe(1964825);
  });

  it("downloads declarados e JSON sob demanda existem e batem com os tipos", () => {
    for (const d of G.downloads) expect(existsSync(join(raiz, "public", d.url)), d.url).toBe(true);
    const uf: SerieCdeUf = JSON.parse(ler(`public${G.tarifa_social.serie_cde_uf_json}`));
    expect(uf.faturas_tsee.length).toBe(uf.ufs.length);
    for (const l of uf.faturas_tsee) expect(l.length).toBe(uf.meses.length);
    expect(uf.completo.length).toBe(uf.meses.length);
    const cob: SerieCoberturaMensal = JSON.parse(ler(`public${G.cobertura.serie_mensal_json}`));
    expect(cob.natureza_da_medida).toBe("PROXY");
    expect(cob.serie.length).toBe(G.cobertura.serie_mensal_meses);
    expect(cob.serie.at(-1)).toEqual(G.cobertura.serie_mensal_ultimo);
  });

  it("nenhum dado pessoal de beneficiário na gold nem nos arquivos publicados", () => {
    const textos = [ler("public/energia/gold/inclusao.json"), ler("public/energia/series/inclusao_municipios.csv"), ler("public/energia/series/inclusao_cde_mensal_uf.csv")];
    for (const t of textos) {
      expect(t).not.toMatch(/NomCliente|NumCPFCNPJCliente/);
      expect(t).not.toMatch(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/); // CPF formatado
    }
  });

  it("proxy rotulada como proxy; ausência nunca vira zero", () => {
    expect(G.cobertura.natureza_da_medida).toBe("PROXY");
    expect(G.cobertura.brasil?.proxy).toBe(true);
    for (const l of [...G.acesso.pnad_serie, ...G.acesso.pnad_situacao]) {
      expect(l.domicilios_sem_energia_mil, `${l.territorio} ${l.ano} ${l.situacao}`).not.toBe(0);
      if (l.domicilios_sem_energia_estado === "menos_de_1_mil") expect(l.domicilios_sem_energia_mil).toBeNull();
    }
    for (const m of G.tarifa_social.cde_meses.filter((x) => !x.original_no_bronze)) {
      expect(m.faturas_tsee, m.mes).toBeNull();
      expect(m.motivo_sem_valores, m.mes).toBeTruthy();
    }
  });
});

describe("códigos de UF do mapa", () => {
  it("cada sigla tem o código da malha oficial publicada (uf.json)", () => {
    const geo = JSON.parse(ler("public/energia/geo/uf.json"));
    const daMalha = Object.fromEntries(geo.features.map((f: any) => [f.uf, f.id]));
    expect(Object.keys(CODIGO_UF).length).toBe(27);
    for (const [uf, cod] of Object.entries(CODIGO_UF)) expect(daMalha[uf], uf).toBe(cod);
  });
});

describe("P059: gráfico, tabela e exportação usam as mesmas linhas", () => {
  const t = G.tarifa_social;
  const mensal = new Map(csv("inclusao_tsee_mensal.csv").map((r) => [r.mes, r]));

  it("série nacional: cada mês em uma só série (completo ou incompleto), igual ao CSV do pipeline", () => {
    const dados = dadosSerieTsee(t.serie_mensal, "uc");
    const tabela = linhasTabelaSerieTsee(t.serie_mensal);
    expect(dados.map((d) => d.m)).toEqual(tabela.map((l) => l.m));
    const m = matrizExportacao(COLUNAS_SERIE_TSEE, tabela);
    const iUc = COLUNAS_SERIE_TSEE.findIndex((c) => c.id === "uc_tsee");
    dados.forEach((d, i) => {
      const r = mensal.get(d.m)!;
      expect(r, d.m).toBeTruthy();
      const v = d.completo ?? d.incompleto;
      expect(d.completo === null || d.incompleto === null, d.m).toBe(true);
      expect(Math.round((v as number) * 1e6), d.m).toBe(n(r.uc_tsee));
      expect(m.linhas[i][iUc], d.m).toBe(n(r.uc_tsee));
      expect(d.completo === null, d.m).toBe(r.completo === "0");
    });
    // participação e DMR na mesma linha do CSV
    const part = dadosSerieTsee(t.serie_mensal, "part");
    for (const d of part) expect(d.completo ?? d.incompleto, d.m).toBe(n(mensal.get(d.m)!.participacao_pct));
  });

  it("série da CDE: tabela e gráfico iguais ao CSV por UF (linha BR) e meses sem original sem valor", () => {
    const br = new Map(
      csv("inclusao_cde_mensal_uf.csv")
        .filter((r) => r.territorio === "BR")
        .map((r) => [r.mes, r]),
    );
    const tab = linhasMesesCde(t.cde_meses);
    for (const l of tab) {
      const r = br.get(l.mes);
      if (!r) {
        expect(l.faturas, l.mes).toBeNull();
        continue;
      }
      expect(l.faturas, l.mes).toBe(n(r.faturas_tsee));
      expect(l.desconto, l.mes).toBe(n(r.desconto_faturas_reais));
      expect(l.liquido, l.mes).toBe(n(r.desconto_liquido_reais));
    }
    const graf = dadosMediaCde(t.cde_meses);
    expect(graf.map((d) => d.m)).toEqual(Array.from(br.keys()));
    for (const d of graf) expect(d.completo ?? d.incompleto, d.m).toBe(n(br.get(d.m)!.desconto_medio_por_fatura_reais));
  });

  it("mapa e tabela por UF: mesmos números, iguais ao CSV no mês do mapa; UF mais inválidos fecham o total", () => {
    const linhas = linhasUfsTsee(t.ufs);
    const mapa = valoresMapaTsee(t.ufs, "faturas");
    const medio = valoresMapaTsee(t.ufs, "medio");
    const doCsv = new Map(
      csv("inclusao_cde_mensal_uf.csv")
        .filter((r) => r.mes === t.mes_mapa)
        .map((r) => [r.territorio, r]),
    );
    expect(Object.keys(mapa).length).toBe(linhas.length);
    for (const l of linhas) {
      expect(mapa[CODIGO_UF[l.uf]], l.uf).toBe(l.faturas);
      expect(medio[CODIGO_UF[l.uf]], l.uf).toBe(l.medio);
      expect(l.faturas, l.uf).toBe(n(doCsv.get(l.uf)!.faturas_tsee));
    }
    const exp = matrizExportacao(COLUNAS_UFS_TSEE, linhas);
    expect(exp.linhas.length).toBe(linhas.length);
    const mm = t.cde_meses.find((m) => m.mes === t.mes_mapa)!;
    const soma = linhas.reduce((s, l) => s + l.faturas, 0);
    // faturas_municipio_invalido já inclui as de código inexistente (formato inválido mais código fora da lista do IBGE)
    expect(mm.faturas_municipio_inexistente ?? 0).toBeLessThanOrEqual(mm.faturas_municipio_invalido ?? 0);
    expect(soma + (mm.faturas_municipio_invalido ?? 0)).toBe(mm.faturas_tsee);
  });

  it("histórico por UF: lacuna só onde a distribuidora da UF faltou no arquivo (CELESC em set/2025 atinge SC)", () => {
    const at = ufsAtingidasPorAusencia(t.cde_meses, t.distribuidoras);
    expect(at["2025-09"].SC).toEqual(["CELESC"]);
    expect(at["2025-09"].BA).toBeUndefined();
    const j: SerieCdeUf = JSON.parse(ler(`public${t.serie_cde_uf_json}`));
    const h = dadosHistoricoUf(j, ["SC", "BA"], "faturas", at);
    const set = h.find((x) => x.m === "2025-09")!;
    expect(set.SC).toBeNull();
    expect(set.BA).toBe(j.faturas_tsee[j.ufs.indexOf("BA")][j.meses.indexOf("2025-09")]);
    expect(h.every((x) => typeof x.BA === "number")).toBe(true);
  });
});

describe("P060: proxy por UF e municípios", () => {
  const c = G.cobertura;
  const mun = municipiosDoCsv(ler("public/energia/series/inclusao_municipios.csv"));

  it("faturas e famílias por UF iguais à soma dos municípios do CSV (caminho independente)", () => {
    for (const l of linhasCoberturaUf(c.ufs)) {
      const ms = mun.filter((m) => m.uf === l.uf);
      expect(ms.reduce((s, m) => s + (m.faturas ?? 0), 0), l.uf).toBe(l.faturas);
      expect(ms.reduce((s, m) => s + (m.atualizadas ?? 0), 0), l.uf).toBe(l.atualizadas);
    }
  });

  it("mapa, faixa e tabela mostram a mesma razão", () => {
    const mapa = valoresMapaCobertura(c.ufs, "atualizadas");
    const cad = valoresMapaCobertura(c.ufs, "cadastradas");
    const itens = itensFaixaCobertura(c.ufs);
    for (const l of linhasCoberturaUf(c.ufs)) {
      expect(mapa[CODIGO_UF[l.uf]]).toBe(l.razao_atualizadas);
      expect(cad[CODIGO_UF[l.uf]]).toBe(l.razao_cadastradas);
      const it_ = itens.find((x) => x.id === l.uf)!;
      expect([it_.valor, it_.referencia]).toEqual([l.razao_atualizadas, l.razao_cadastradas]);
    }
  });

  it("série nacional do gráfico igual ao CSV publicado", () => {
    const j: SerieCoberturaMensal = JSON.parse(ler(`public${c.serie_mensal_json}`));
    const doCsv = new Map(csv("inclusao_cobertura_mensal.csv").map((r) => [r.mes, r]));
    for (const d of dadosSerieCobertura(j.serie)) {
      expect(d.atualizadas, d.m).toBe(n(doCsv.get(d.m)!.razao_proxy_atualizadas_pct));
      expect(d.cadastradas, d.m).toBe(n(doCsv.get(d.m)!.razao_proxy_cadastradas_pct));
    }
  });

  it("todo município do CSV tem polígono na malha municipal pelo prefixo de 6 dígitos", () => {
    const geo = JSON.parse(ler("public/energia/geo/municipios.json"));
    const prefixos = new Set(geo.features.map((f: any) => String(f.id).slice(0, 6)));
    expect(mun.filter((m) => !prefixos.has(m.cod6))).toEqual([]);
    expect(mun.filter((m) => m.base_pequena).length).toBe(c.distribuicao_municipal!.base_pequena_excluidos);
  });
});

describe("P061: POF com precisão e domínios suportados", () => {
  const o = G.orcamento;
  const pof = csv("inclusao_pof.csv").filter((r) => r.fonte === "microdados");
  const doCsv = (t: string, cl: string, m: string) => pof.find((r) => r.territorio === t && r.classe === cl && r.medida === m);

  it("barras por classe iguais ao CSV (gold com 3 casas, CSV com 4); suprimido vira ausência", () => {
    const base = orcamentoBase(o);
    for (const t of ["BR", "RG-NE"]) {
      for (const d of dadosClassesPof(base, t, "despesa")) {
        for (const m of ["razao_medias_pct", "media_razoes_desp_pct"] as const) {
          const [v, , est] = estimativa(linhaPof(base, t, String(d.id)), m);
          expect(d[m]).toBe(v);
          const r = doCsv(t, String(d.id), m);
          if (est === "suprimido") expect(d[m]).toBeNull();
          else if (r && r.valor !== "") expect(Math.abs((d[m] as number) - Number(r.valor)), `${t} ${d.id} ${m}`).toBeLessThanOrEqual(0.0005 + 1e-9);
        }
      }
    }
  });

  it("razão de médias e média das razões são publicadas lado a lado e diferem", () => {
    const base = orcamentoBase(o);
    const baixa = linhaPof(base, "BR", o.classes[1].codigo)!;
    expect(estimativa(baixa, "razao_medias_pct")[0]).not.toBe(estimativa(baixa, "media_razoes_desp_pct")[0]);
  });

  it("UF só no total, mapa igual à tabela; nenhuma linha municipal", () => {
    const base = orcamentoBase(o);
    const linhas = linhasUfsPof(base);
    expect(linhas.length).toBe(27);
    const mapa = valoresMapaPof(base, "razao_medias_pct");
    for (const l of linhas) expect(mapa[CODIGO_UF[String(l.uf)]]).toBe(l.razao_medias_pct);
    expect(o.linhas.every((l) => l.territorio.length <= 5)).toBe(true);
  });
});

describe("P062: acesso, isolados e Luz para Todos", () => {
  const a = G.acesso;
  const pnadCsv = ler("public/energia/series/inclusao_acesso_pnad.csv");

  it("anos que o IBGE não publicou entram como lacuna, nunca como emenda", () => {
    const d = dadosSeriePnad(a.pnad_serie, ["BR"], "sem");
    const anos = d.map((x) => x.ano);
    expect(anos).toContain("2020");
    expect(d.find((x) => x.ano === "2020")!.BR).toBeNull();
    expect(d.find((x) => x.ano === "2021")!.BR).toBeNull();
    expect(d.find((x) => x.ano === a.ano_referencia)!.BR).toBe(a.pnad_serie.find((l) => l.territorio === "BR" && l.ano === a.ano_referencia)!.pct_sem_energia);
  });

  it("histórico das UF lido do CSV igual à gold nos anos que a gold traz", () => {
    const h = dadosHistoricoPnadCsv(pnadCsv, ["AM", "PA"], "integral");
    for (const l of a.pnad_serie.filter((x) => x.territorio === "AM" || x.territorio === "PA")) {
      expect(h.find((x) => x.ano === l.ano)![l.territorio], `${l.territorio} ${l.ano}`).toBe(l.pct_integral_entre_rede);
    }
    const s = dadosHistoricoPnadCsv(pnadCsv, ["AM"], "sem");
    const am = a.pnad_serie.find((x) => x.territorio === "AM" && x.ano === a.ano_referencia)!;
    expect(s.find((x) => x.ano === a.ano_referencia)!.AM).toBe(am.pct_sem_energia);
  });

  it("mapa e tabela por UF usam as mesmas linhas, nas duas situações", () => {
    for (const sit of ["total", "rural"] as const) {
      const linhas = linhasUfsPnad(a, sit);
      expect(linhas.length, sit).toBe(27);
      const mapa = valoresMapaPnad(a, sit, "sem");
      for (const l of linhas) expect(mapa[CODIGO_UF[l.uf]]).toBe(l.pct_sem);
    }
    const rr = linhasUfsPnad(a, "rural").find((l) => l.uf === "RR")!;
    expect([rr.sem_mil, rr.sem_estado]).toEqual([null, "menos de 1 mil"]);
  });

  it("Luz para Todos por ano igual à soma do CSV mensal (caminho independente); programa sem linha fica nulo", () => {
    const lpt = a.universalizacao.luz_para_todos!;
    const porAno = new Map<string, number>();
    for (const r of csv("inclusao_luz_para_todos_mensal.csv")) porAno.set(r.mes.slice(0, 4), (porAno.get(r.mes.slice(0, 4)) ?? 0) + Number(r.domicilios));
    for (const d of dadosLptAnual(lpt, "total")) expect(d.valor, d.id).toBe(porAno.get(d.id));
    const remotas = dadosLptAnual(lpt, "regioes_remotas");
    expect(remotas.find((d) => d.id === "2004")!.valor).toBeNull();
    expect(dadosLptAnual(lpt, "recurso_distribuidora").find((d) => d.id === "2017")!.valor).toBe(0);
    expect(dadosLptAnual(lpt, "total").at(-1)!.rotulo).toContain("até");
  });

  it("sistemas isolados: soma das UF igual à ficha; lista completa do JSON com as localidades do ciclo", () => {
    const si = a.sistemas_isolados!;
    const linhas = linhasIsoladosUf(si);
    expect(linhas.reduce((s, l) => s + (l.populacao ?? 0), 0)).toBe(si.evidencia_populacao!.valor_calculo);
    const pts = JSON.parse(ler(`public${si.pontos_json}`));
    const locs = localidadesDoJson(pts);
    expect(locs.length).toBe(si.ciclos.find((c) => c.ciclo === si.ciclo)!.localidades);
    expect(locs.filter((l) => l.populacao === null).map((l) => l.sigla)).toEqual(["PA-101", "PA-102"]);
  });
});

describe("textos derivados dos números (mudar o número muda o texto)", () => {
  it("P059: resposta traz os números publicados e acompanha a gold", () => {
    const t = G.tarifa_social;
    const r = respostaTarifaSocial(t);
    expect(r).toContain(inteiro(t.kpis.uc_tsee.valor));
    expect(r).toContain(pct(t.kpis.participacao_pct.valor, 1));
    expect(r).toContain("mai/2025");
    const g2 = gold();
    g2.tarifa_social.kpis.uc_tsee.valor = 1234567;
    g2.tarifa_social.kpis.participacao_pct.valor = null;
    const r2 = respostaTarifaSocial(g2.tarifa_social);
    expect(r2).toContain("1.234.567");
    expect(r2).not.toContain(inteiro(t.kpis.uc_tsee.valor));
    expect(r2).toContain("participação nas UC residenciais sem dado");
    expect(r2).not.toMatch(/\b0,0%/);
  });

  it("P059: mudança da regra de 5/7/2025 lida do desconto médio por fatura publicado", () => {
    const m = mudancaTarifaSocial(G.tarifa_social);
    const jun = G.tarifa_social.cde_meses.find((x) => x.mes === "2025-06")!;
    const jul = G.tarifa_social.cde_meses.find((x) => x.mes === "2025-07")!;
    expect(m).toContain(`R$ ${jun.desconto_medio_por_fatura_reais!.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);
    expect(m).toContain(`R$ ${jul.desconto_medio_por_fatura_reais!.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);
    const g2 = gold();
    g2.tarifa_social.eventos = [];
    expect(() => mudancaTarifaSocial(g2.tarifa_social)).not.toThrow();
    expect(textoMesesIncompletosScs(G.tarifa_social.serie_mensal)).toMatch(/abr\/2025.*jun\/2025/);
  });

  it("P060: resposta se declara proxy e usa a razão publicada", () => {
    const r = respostaCobertura(G.cobertura);
    expect(r).toMatch(/^Proxy/);
    expect(r).toContain("67,8");
    const g2 = gold();
    g2.cobertura.brasil!.razao_atualizadas_pct = 55.55;
    expect(respostaCobertura(g2.cobertura)).toContain("55,6");
    g2.cobertura.brasil = null;
    expect(respostaCobertura(g2.cobertura)).toMatch(/^Sem dado/);
  });

  it("P061: classe mais baixa contra o total, nas duas medidas", () => {
    const r = respostaOrcamento(G.orcamento);
    const baixa = G.orcamento.linhas.find((l) => l.territorio === "BR" && l.classe === G.orcamento.classes[1].codigo)!;
    expect(r).toContain(pct(baixa.microdados.razao_medias_pct![0], 1));
    expect(r).toContain(pct(baixa.microdados.media_razoes_desp_pct![0], 1));
    const g2 = gold();
    g2.orcamento.linhas.find((l) => l.territorio === "BR" && l.classe === G.orcamento.classes[1].codigo)!.microdados.razao_medias_pct = [9.87, 1, "publicado"];
    expect(respostaOrcamento(g2.orcamento)).toContain("9,9%");
  });

  it("P062: contagem com estado 'menos de 1 mil' não vira zero no texto", () => {
    const r = respostaAcesso(G.acesso);
    expect(r).toContain("135 mil domicílios");
    expect(r).toContain(inteiro(G.acesso.universalizacao.luz_para_todos!.evidencia_total.valor_calculo));
    const g2 = gold();
    const br = g2.acesso.pnad_serie.find((l) => l.territorio === "BR" && l.ano === g2.acesso.ano_referencia)!;
    br.domicilios_sem_energia_mil = null;
    br.domicilios_sem_energia_estado = "menos_de_1_mil";
    expect(respostaAcesso(g2.acesso)).toContain("menos de 1 mil domicílios");
    expect(mudancaAcesso(G.acesso)).toMatch(/2020 e 2021/);
  });

  it("nenhum texto gerado usa travessão ou hífen como pontuação", () => {
    const textos = [respostaTarifaSocial(G.tarifa_social), mudancaTarifaSocial(G.tarifa_social), respostaCobertura(G.cobertura), respostaOrcamento(G.orcamento), respostaAcesso(G.acesso), mudancaAcesso(G.acesso)];
    for (const x of textos) expect(x).not.toMatch(/ [—–-] /);
  });
});

describe("páginas renderizadas no servidor", () => {
  const paginas = {
    sintese: { mod: Sintese, rota: "" },
    p059: { mod: PaginaTarifa, rota: "/tarifa-social" },
    p060: { mod: PaginaCobertura, rota: "/cobertura" },
    p061: { mod: PaginaOrcamento, rota: "/orcamento" },
    p062: { mod: PaginaAcesso, rota: "/acesso" },
  } as const;
  const html = Object.fromEntries(Object.entries(paginas).map(([k, p]) => [k, renderToStaticMarkup(createElement(p.mod))])) as Record<keyof typeof paginas, string>;
  const principal = (h: string) => h.slice(h.indexOf("<main"));
  const perguntas = { p059: G.tarifa_social.pergunta, p060: G.cobertura.pergunta, p061: G.orcamento.pergunta, p062: G.acesso.pergunta };
  const respostas = { p059: respostaTarifaSocial(G.tarifa_social), p060: respostaCobertura(G.cobertura), p061: respostaOrcamento(G.orcamento), p062: respostaAcesso(G.acesso) };

  it("cada painel renderiza sem erro na sua página, com a pergunta como título e a resposta derivada", () => {
    for (const id of ["p059", "p060", "p061", "p062"] as const) {
      const h = html[id];
      expect(h, id).toContain(`id="${id}"`);
      expect(h, id).toContain(`id="${id}-titulo"`);
      expect(h, id).toContain(`data-resposta="${id}"`);
      expect(h, id).toContain(perguntas[id]);
      // React escapa aspas e apóstrofos; o começo da resposta não tem nenhum
      expect(h, id).toContain(respostas[id].slice(0, 30));
      // anatomia 7.2: período, universo e unidade; como ler e o que não permite concluir; próxima pergunta e link
      for (const parte of ["Período", "Universo", "Unidade", "Como interpretar", "O que não é possível concluir", "Próxima pergunta", "Copiar link deste painel", "Baixar"]) {
        expect(h, `${id}: ${parte}`).toContain(parte);
      }
      expect((h.match(/Comprove este número/g) ?? []).length, id).toBeGreaterThanOrEqual(1);
      expect((h.match(/<table/g) ?? []).length, id).toBeGreaterThanOrEqual(3);
      expect(h, id).toContain('role="radiogroup" aria-label="Nível de profundidade"');
    }
  });

  it("a síntese traz as quatro perguntas, respostas, números com prova e links para os painéis", () => {
    const h = html.sintese;
    for (const id of ["p059", "p060", "p061", "p062"] as const) {
      expect(h).toContain(perguntas[id]);
      expect(h).toContain(`data-resposta="${id}"`);
      expect(h).toContain(`href="/setor-eletrico/inclusao-energetica${paginas[id].rota}"`);
    }
    expect((h.match(/Comprove este número/g) ?? []).length).toBeGreaterThanOrEqual(4);
  });

  it("tabelas equivalentes e mapas presentes onde há mapa; proxy rotulada", () => {
    expect(html.p059).toContain("Faturas com desconto por UF");
    expect(html.p060).toContain("Proxy");
    expect(html.p060).toContain("Faixa de sensibilidade ao denominador por UF");
    expect(html.p061).toContain("Razão de médias");
    expect(html.p061).toContain("Média das participações");
    expect(html.p062).toContain("Domicílios sem energia elétrica de nenhuma fonte por UF");
  });

  it("sem estado de construção no conteúdo, sem hexadecimal solto e abaixo de 600 KB de HTML por página", () => {
    for (const [k, h] of Object.entries(html)) {
      expect(principal(h), k).not.toMatch(/em breve|em integração|em construção/i);
      expect(h, k).not.toMatch(/#[0-9a-fA-F]{6}\b/);
      expect(h.length, k).toBeLessThan(600_000);
    }
  });

  it("o destino está publicado na navegação, com a síntese marcada como página atual", () => {
    const d = DESTINOS_NAVEGACAO.find((x) => x.slug === "inclusao-energetica")!;
    expect(d.publicado).toBe(true);
    expect(d.href).toBe("/setor-eletrico/inclusao-energetica");
    for (const h of Object.values(html)) expect(h).toContain('aria-current="page"');
  });
});

/**
 * Revisão de interface: cada defeito corrigido tem um teste que o pegaria de volta
 * (texto com número fixo, direção afirmada sem conferir o número, KPI sem prova,
 * rótulo que perde a grafia de "R$", filtro fora da URL).
 */
describe("revisão de interface: textos e números vêm da gold", () => {
  it("P061: a direção 'pesou mais/menos' sai da comparação dos números publicados", () => {
    const g2 = gold();
    const baixa = G.orcamento.classes.find((c) => c.codigo !== "7999")!.codigo;
    const lb = g2.orcamento.linhas.find((l) => l.territorio === "BR" && l.classe === baixa)!;
    expect(respostaOrcamento(G.orcamento)).toContain("pesou mais nas famílias de menor renda");
    lb.microdados.razao_medias_pct = [1.2, 1, "publicado"];
    const r = respostaOrcamento(g2.orcamento);
    expect(r).toContain("pesou menos nas famílias de menor renda");
    expect(r).not.toContain("pesou mais");
    lb.microdados.razao_medias_pct = [null, null, "suprimido"];
    const r2 = respostaOrcamento(g2.orcamento);
    expect(r2).not.toMatch(/pesou (mais|menos)/);
    expect(r2).toContain("sem dado");
  });

  it("P061: 'a participação média é maior' só quando é maior nas duas linhas", () => {
    expect(respostaOrcamento(G.orcamento)).toContain("a participação média é maior");
    const g2 = gold();
    const t = g2.orcamento.linhas.find((l) => l.territorio === "BR" && l.classe === "7999")!;
    t.microdados.media_razoes_desp_pct = [1.0, 1, "publicado"];
    expect(respostaOrcamento(g2.orcamento)).not.toContain("é maior");
  });

  it("P061: rótulo de classe entra na frase sem perder a grafia de R$", () => {
    expect(minusculaInicial("Até R$ 1.908")).toBe("até R$ 1.908");
    for (const x of [respostaOrcamento(G.orcamento), mudancaOrcamento(G.orcamento)]) {
      expect(x).not.toMatch(/r\$/);
      expect(x).toContain("R$ 1.908");
    }
  });

  it("P061: limites de precisão e limiares vêm da gold", () => {
    const r = { cautela_cv_pct: 10, suprime_cv_pct: 25 };
    expect(textoPrecisaoPof(r)).toContain("10%");
    expect(textoPrecisaoPof(r)).toContain("25%");
    expect(rotulosEstadoPof(r).suprimido).toContain("25%");
    expect(textoPrecisaoPof(G.orcamento.regra_precisao)).toContain(pct(G.orcamento.regra_precisao.suprime_cv_pct, 0));
    // as opções do limiar na URL são as mesmas que a gold publica
    expect(LIMIARES_POF.map(Number)).toEqual(G.orcamento.limiares_pct);
  });

  it("P062: a frase de precisão cita o maior CV publicado, lido da gold", () => {
    const a = { ano_referencia: G.acesso.ano_referencia, pnad_serie: G.acesso.pnad_serie, pnad_situacao: G.acesso.pnad_situacao };
    const m = maiorCvPnad(a)!;
    let maior = 0;
    for (const l of [...a.pnad_serie.filter((x) => x.ano === a.ano_referencia), ...a.pnad_situacao]) {
      if (!CODIGO_UF[l.territorio]) continue;
      for (const v of [l.cv_pct_com_energia, l.cv_pct_rede_geral, l.cv_pct_integral]) if (typeof v === "number" && v > maior) maior = v;
    }
    expect(m.cv).toBe(maior);
    expect(textoPrecisaoPnad(a)).toContain(pct(maior, 1));
    const g2 = gold();
    g2.acesso.pnad_situacao[0] = { ...g2.acesso.pnad_situacao.find((l) => CODIGO_UF[l.territorio])!, cv_pct_integral: 77.7 };
    expect(textoPrecisaoPnad({ ano_referencia: g2.acesso.ano_referencia, pnad_serie: g2.acesso.pnad_serie, pnad_situacao: g2.acesso.pnad_situacao })).toContain("77,7%");
  });

  it("P059: o evento do 'o que mudou' vem da gold, não de uma data no código", () => {
    const g2 = gold();
    const ev = g2.tarifa_social.eventos.find((e) => e.data.startsWith("2025-07"))!;
    ev.data = "2025-09-01";
    ev.rotulo = "Evento de teste";
    const m = mudancaTarifaSocial(g2.tarifa_social);
    expect(m).toContain("Evento de teste");
    expect(m).toContain("set/2025");
    // evento no dia 1: o arquivo do mês não mistura regras
    expect(m).not.toContain("mistura faturas");
  });

  it("P059: o ano em curso do custeio é dito orçado, nunca realizado", () => {
    const c = G.tarifa_social.custeio_cde!;
    const x = textoCusteioTarifaSocial(c);
    expect(x).toContain(`Em ${c.ano_corrente}, ano em curso, o valor orçado`);
    expect(x).not.toContain(`Em ${c.ano_corrente}, a Tarifa Social foi`);
  });

  it("P060: o total de famílias cadastradas citado na página é a soma do CSV de municípios", () => {
    const linhas = municipiosDoCsv(ler("public/energia/series/inclusao_municipios.csv"));
    const soma = linhas.reduce((s, l) => s + (l.cadastradas ?? 0), 0);
    expect(soma).toBe(G.cobertura.brasil!.familias_cadastradas);
    // a seleção municipal vai para a URL, como a da UF
    expect(ESQUEMA_COBERTURA.msel).toBeDefined();
  });
});

describe("revisão de interface: páginas", () => {
  const paginas = { sintese: Sintese, p059: PaginaTarifa, p060: PaginaCobertura, p061: PaginaOrcamento, p062: PaginaAcesso };
  const html = Object.fromEntries(Object.entries(paginas).map(([k, p]) => [k, renderToStaticMarkup(createElement(p))]));
  const MARCA_NUMERO = 'class="relative flex h-full flex-col border border-linha bg-superficie p-5"';

  /** Conteúdo de cada bloco Numero (div com a classe do componente), pela contagem de div abertos e fechados. */
  function blocosNumero(h: string): string[] {
    const out: string[] = [];
    let i = h.indexOf(MARCA_NUMERO);
    while (i >= 0) {
      const ini = h.lastIndexOf("<div", i);
      let prof = 0;
      let j = ini;
      const re = /<div\b|<\/div>/g;
      re.lastIndex = ini;
      let mm: RegExpExecArray | null;
      while ((mm = re.exec(h))) {
        prof += mm[0] === "</div>" ? -1 : 1;
        if (prof === 0) {
          j = re.lastIndex;
          break;
        }
      }
      out.push(h.slice(ini, j));
      i = h.indexOf(MARCA_NUMERO, j);
    }
    return out;
  }

  it("todo número de destaque tem 'Comprove este número' (ou declara ausência)", () => {
    for (const [k, h] of Object.entries(html)) {
      const blocos = blocosNumero(h);
      expect(blocos.length, k).toBeGreaterThan(0);
      for (const b of blocos) expect(b.includes("Comprove este número") || b.includes("sem dado"), `${k}: ${b.slice(0, 160)}`).toBe(true);
    }
  });

  it("nenhum ano, período ou limite da fonte escrito à mão onde a gold o publica", () => {
    // o ano da frase é o da publicação, e o código das páginas não escreve ano à mão
    expect(html.p061).toContain(`Não representa ${G.gerado_em.slice(0, 4)}`);
    expect(ler("src/app/setor-eletrico/inclusao-energetica/orcamento/page.tsx")).not.toMatch(/Não representa 20\d\d|jul\/2017|15\/01\/2018/);
    expect(html.p062).not.toContain("o CV passa de 5%");
    // o limite de base pequena aparece só pelas limitações da gold, não escrito no componente
    expect(ler("src/components/energia/InclusaoCobertura.tsx")).not.toMatch(/\b50 famílias|\b2 anos/);
    for (const h of Object.values(html)) expect(h).not.toMatch(/r\$ \d/);
  });

  it("todo href interno das páginas aponta para página existente ou arquivo publicado", () => {
    for (const [k, h] of Object.entries(html)) {
      const hrefs = Array.from(principalDe(h).matchAll(/href="(\/[^"#?]*)/g)).map((x) => x[1]);
      for (const href of Array.from(new Set(hrefs))) {
        const arquivo = existsSync(join(raiz, "public", href));
        const pagina = existsSync(join(raiz, "src/app", href, "page.tsx"));
        // verbete: rota dinâmica /setor-eletrico/aprenda/[conceito], gerada só para os slugs do catálogo
        const verbete = /^\/setor-eletrico\/aprenda\/[^/]+$/.test(href) && !!conceito(href.split("/").at(-1)!);
        expect(arquivo || pagina || verbete, `${k}: ${href}`).toBe(true);
      }
    }
  });
  const principalDe = (h: string) => h.slice(h.indexOf("<main"));
});

