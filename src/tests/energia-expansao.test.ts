/* eslint-disable @typescript-eslint/no-explicit-any -- varredura genérica da gold publicada */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Sintese from "@/app/setor-eletrico/expansao/page";
import PaginaCarteira from "@/app/setor-eletrico/expansao/carteira/page";
import PaginaCronograma from "@/app/setor-eletrico/expansao/cronograma/page";
import PaginaTransmissao from "@/app/setor-eletrico/expansao/geracao-e-transmissao/page";
import PaginaCenarios from "@/app/setor-eletrico/expansao/cenarios/page";
import { problemasEvidencia } from "@/lib/energia/evidencia";
import { lerEstado, escreverEstado } from "@/lib/energia/estadoUrl";
import {
  CODIGO_UF,
  COLUNAS_CARTEIRA_UF,
  COLUNAS_CONFIABILIDADE,
  COLUNAS_GERACAO_REDE_UF,
  COLUNAS_LEILOES,
  DOWNLOADS_PAINEL,
  ESQUEMA_CARTEIRA,
  ESQUEMA_CENARIOS,
  ESQUEMA_CRONOGRAMA,
  ESQUEMA_TRANSMISSAO,
  FIGURAS_PDE,
  MEDIDAS_CARTEIRA,
  MEDIDAS_REDE,
  MEDIDA_REDE,
  PAINEIS_EXPANSAO,
  dadosFigura,
  dadosSerieKm,
  dadosSerieMva,
  dadosSerieMw,
  filtraRede,
  linhasAtrasadas,
  linhasCamadas,
  linhasCamadasComparaveis,
  linhasCarteiraUf,
  linhasConfiabilidade,
  linhasContratosAno,
  linhasCoortes,
  linhasDeslizamento,
  linhasDesvioPrazo,
  linhasEncerramentos,
  linhasEstagios,
  linhasGeracaoRedeUf,
  linhasLeiloes,
  linhasObraViabilidade,
  linhasPrevisoesAno,
  linhasRalieTipo,
  mudancaCarteira,
  mudancaCenarios,
  mudancaCronograma,
  mudancaTransmissao,
  mwTexto,
  pontosDoJson,
  projetaPonto,
  proximoPainel,
  respostaCarteira,
  respostaCenarios,
  respostaCronograma,
  respostaSintese,
  respostaTransmissao,
  rotaPainel,
  rotuloFigura,
  valoresMapaCarteira,
  valoresMapaRede,
  R_AUTALICO_GRS80,
} from "@/lib/energia/expansao";
import { lerCaminho, pontoNaRegiao, type CamadaGeo } from "@/lib/energia/geo";
import { MODULOS_ENERGIA, DESTINOS_NAVEGACAO } from "@/lib/energia/navegacao";
import { PAGINAS_MAPA } from "@/lib/energia/mapa";
import { conceito } from "@/lib/energia/conteudo/conceitos";
import { matrizExportacao } from "@/lib/energia/tabela";
import type { ExpansaoGold, LinhasRedeEpe, PontosUsinas } from "@/lib/energia/tipos-expansao";

/**
 * Páginas da Expansão (P040 a P043): contrato da gold, equivalência entre gráfico,
 * tabela e exportação (as mesmas linhas, conferidas contra os CSV publicados pelo
 * pipeline, relidos aqui por outro caminho), textos derivados dos números (mudar o
 * número muda o texto), projeção dos pontos das usinas na malha oficial e renderização
 * das páginas no servidor.
 */
const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, p), "utf-8");
const gold = (): ExpansaoGold => JSON.parse(ler("public/energia/gold/expansao.json"));
const G = gold();

/** Leitura própria dos CSV publicados (";" e ponto decimal), sem a lógica da página. */
function csv(nome: string): Record<string, string>[] {
  const t = ler(`public/energia/series/${nome}`).replace(/^﻿/, "");
  const linhas = t.split(/\r?\n/).filter((l) => l.length > 0);
  const cab = linhas[0].split(";");
  return linhas.slice(1).map((l) => {
    const c = l.split(";");
    return Object.fromEntries(cab.map((h, i) => [h, c[i] ?? ""]));
  });
}
const n = (s: string | undefined) => (s === undefined || s === "" ? null : Number(s));
const perto = (a: number | null | undefined, b: number | null | undefined, tol: number) => typeof a === "number" && typeof b === "number" && Math.abs(a - b) <= tol;

/* ================================================================ contrato da gold */

describe("contrato da gold expansao.json", () => {
  it("cabeçalho íntegro e blocos que as páginas leem", () => {
    expect(G.dominio).toBe("energia");
    expect(G.gold).toBe("expansao.json");
    expect(G.disponivel).toBe(true);
    for (const k of ["referencias", "regras", "ressalvas", "capacidade_instalada", "estagios", "cronograma", "transmissao", "cenarios", "conferencias", "proveniencia", "evidencias", "downloads"] as const) {
      expect(G[k], k).toBeTruthy();
    }
  });

  it("toda evidência passa no contrato do 'Comprove este número'", () => {
    const chaves = Object.keys(G.evidencias);
    expect(chaves.length).toBeGreaterThanOrEqual(8);
    for (const [k, ev] of Object.entries(G.evidencias)) expect(problemasEvidencia(ev!), k).toEqual([]);
  });

  it("toda proveniência declara natureza, fonte, unidade e limitações não vazias", () => {
    for (const [k, p] of Object.entries(G.proveniencia)) {
      if (!p) continue;
      expect(["OBSERVADO", "CALCULADO", "ESTIMADO", "PREVISTO", "CENARIO"], k).toContain(p.natureza);
      expect(p.fonte.orgao, k).toBeTruthy();
      expect(p.unidade, k).toBeTruthy();
      expect(p.limitacoes.length, k).toBeGreaterThan(0);
    }
    expect(G.proveniencia.cenarios.natureza).toBe("CENARIO");
    expect(G.proveniencia.previsoes.natureza).toBe("PREVISTO");
  });

  it("os downloads que cada painel lista existem na gold e no disco", () => {
    for (const [painel, urls] of Object.entries(DOWNLOADS_PAINEL)) {
      for (const u of urls) {
        expect(G.downloads.some((d) => d.url === u), `${painel}: ${u}`).toBe(true);
        expect(existsSync(join(raiz, "public", u)), u).toBe(true);
      }
    }
  });

  it("os códigos de UF do mapa são os da malha oficial publicada", () => {
    const geo = JSON.parse(ler("public/energia/geo/uf.json")) as CamadaGeo;
    expect(geo.features.length).toBe(27);
    for (const f of geo.features) expect(CODIGO_UF[f.uf], f.uf).toBe(f.id);
  });

  it("as figuras do PDE que o seletor oferece são as da gold", () => {
    expect([...FIGURAS_PDE].sort()).toEqual(Object.keys(G.cenarios.figuras).sort());
    expect(rotuloFigura("fig_3_25")).toBe("Figura 3-25");
    expect(rotuloFigura("fig_12_4")).toBe("Figura 12-4");
  });
});

/* ================================================================ critérios de aceite */

describe("critérios de aceite dos painéis", () => {
  it("P040: outorga não é contada como capacidade que certamente entrará", () => {
    // o desfecho da coorte de 2021 publica potência com outorga encerrada, e a resposta a cita
    const c0 = G.estagios.coortes.find((c) => c.coorte === "estoque_inicial")!;
    expect(c0.desfechos.outorga_encerrada.pct_mw).toBeGreaterThan(0);
    const r = respostaCarteira(G);
    expect(r).toContain("Outorga não é entrada garantida");
    expect(r).toContain(`${c0.desfechos.outorga_encerrada.pct_mw!.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}%`);
    // as participações de cada coorte somam 100 dentro do arredondamento publicado (0,1 por parcela)
    for (const l of linhasCoortes(G)) {
      const s = l.pct_operacao! + l.pct_em_implantacao! + l.pct_outorga_encerrada! + l.pct_sem_desfecho!;
      expect(Math.abs(s - 100), l.rotulo).toBeLessThanOrEqual(0.25);
    }
    // estágios disjuntos, conferidos contra o CSV do SIGA por outro caminho (contagem e potência outorgada)
    const siga = csv("expansao_usinas_siga.csv");
    for (const e of linhasEstagios(G)) {
      const linhas = siga.filter((x) => x.estagio === e.id);
      expect(linhas.length, e.id).toBe(e.usinas);
      const mw = linhas.reduce((s, x) => s + (n(x.kw_outorgado) ?? 0), 0) / 1000;
      expect(perto(mw, e.mw_outorgado, 0.05), `${e.id}: ${mw} × ${e.mw_outorgado}`).toBe(true);
    }
  });

  it("P041: toda previsão publicada tem a data-base conhecida e preservada", () => {
    const uni = csv("expansao_unidades_ralie.csv");
    expect(uni.length).toBe(G.estagios.ralie.ugs);
    for (const u of uni) expect(u.data_base_ralie).toBe(G.cronograma.data_ralie);
    // previsões por ano refeitas a partir das unidades do CSV (kW → MW), sem a lógica da página
    const porAno = new Map<string, number>();
    for (const u of uni) if (u.previsao_sfg) porAno.set(u.previsao_sfg.slice(0, 4), (porAno.get(u.previsao_sfg.slice(0, 4)) ?? 0) + (n(u.kw) ?? 0) / 1000);
    for (const a of linhasPrevisoesAno(G)) expect(perto(porAno.get(a.ano), a.mw, 0.1), `${a.ano}: ${porAno.get(a.ano)} × ${a.mw}`).toBe(true);
    // confiabilidade: cada janela começa numa fotografia (data-base) e termina 365 dias depois
    for (const c of G.cronograma.confiabilidade) {
      const dias = (Date.parse(c.fim_janela) - Date.parse(c.ralie)) / 86400000;
      expect(dias, c.ralie).toBe(365);
    }
    // o desvio contra a data outorgada é publicado como desvio, nunca como "atraso"
    expect(G.cronograma.desvio_prazo_vigente.definicao).toMatch(/não atraso|sem data-base/);
  });

  it("P042: km, MVA, MW e investimento em campos separados; nenhuma soma de unidades incompatíveis", () => {
    // cada medida do mapa tem uma única unidade e lê um único campo da gold
    for (const m of MEDIDAS_REDE) expect(MEDIDA_REDE[m].unidade, m).toMatch(/^(MW|km de circuito|km de traçado|MVA)$/);
    // as três séries anuais ficam em painéis por unidade
    const s = G.transmissao.serie_anual;
    for (const l of dadosSerieMw(s)) expect(Object.keys(l).sort()).toEqual(["ano", "id", "mw"]);
    for (const l of dadosSerieKm(s)) expect(Object.keys(l).sort()).toEqual(["ano", "contratos", "energizados", "id", "leilao"]);
    for (const l of dadosSerieMva(s)) expect(Object.keys(l).sort()).toEqual(["ano", "contratos", "energizados", "id", "leilao"]);
    // a tabela de leilões tem uma unidade por coluna numérica
    for (const c of COLUNAS_LEILOES.filter((x) => x.tipo === "numero" && x.unidade)) expect(c.unidade!.split(" e ").length, c.id).toBe(1);
    // anos depois do último leilão do arquivo: ausência (null), nunca zero
    const ultimo = G.transmissao.leiloes.ultimo_leilao.data!.slice(0, 4);
    for (const x of s.filter((a) => a.ano > ultimo)) {
      expect(x.km_contratados_leilao, x.ano).toBeNull();
      expect(x.mva_contratados_leilao, x.ano).toBeNull();
    }
  });

  it("P043: selo CENÁRIO, data-base, hipóteses e universo declarados; camadas sem diferença calculada", () => {
    const c = G.cenarios;
    expect(c.selo).toBe("CENÁRIO");
    expect(c.data_base_premissas).toBeTruthy();
    expect(c.universo).toBeTruthy();
    expect(c.hipoteses.length).toBeGreaterThan(3);
    for (const h of c.hipoteses) expect(h.texto).toBeTruthy();
    // nenhuma linha de camada traz diferença entre cenário e realizado
    for (const l of linhasCamadas(G)) expect(Object.keys(l).some((k) => /dif|delta|gap/i.test(k)), l.id).toBe(false);
    // o gráfico de camadas usa o valor comparável (sem Itaipu 50 Hz) para a hidrelétrica
    const uhe = linhasCamadasComparaveis(linhasCamadas(G)).find((l) => l.id === "UHE")!;
    const cam = c.camadas.find((x) => x.categoria === "UHE")!;
    expect(uhe.anexo_dez2035).toBe(cam.pde_anexo_i3!.dez2035_gw);
    expect(uhe.anexo_dez2035!).toBeLessThan(cam.pde_dez2035_gw!);
  });
});

/* ================================================================ equivalência com os CSV */

describe("gráfico, tabela e exportação usam as mesmas linhas, conferidas contra os CSV publicados", () => {
  it("confiabilidade por fotografia = linhas TOTAL do CSV (kW ÷ 1.000)", () => {
    const tot = csv("expansao_confiabilidade_previsoes.csv").filter((x) => x.tipo === "TOTAL");
    const linhas = linhasConfiabilidade(G);
    expect(linhas.length).toBe(tot.length);
    for (const l of linhas) {
      const x = tot.find((t) => t.ralie === l.ralie)!;
      expect(x, l.ralie).toBeTruthy();
      expect(perto((n(x.kw_prometido) ?? 0) / 1000, l.mw_prometido, 0.05), l.ralie).toBe(true);
      expect(perto((n(x.kw_no_prazo) ?? 0) / 1000, l.mw_no_prazo, 0.05), l.ralie).toBe(true);
      expect(Number(x.ugs), l.ralie).toBe(l.ugs);
    }
    // a exportação da tabela tem as mesmas linhas e os mesmos valores do gráfico
    const m = matrizExportacao(COLUNAS_CONFIABILIDADE, linhas);
    expect(m.linhas.length).toBe(linhas.length);
    const iPct = COLUNAS_CONFIABILIDADE.findIndex((c) => c.id === "pct_no_prazo");
    linhas.forEach((l, i) => expect(m.linhas[i][iPct]).toBe(l.pct_no_prazo));
  });

  it("liberações por ano = soma do CSV por ano e tipo (e a linha TOTAL do próprio CSV)", () => {
    const lib = csv("expansao_liberacoes_anuais.csv");
    for (const l of linhasDesvioPrazo(G)) {
      const kw = lib.filter((x) => x.ano === l.id && x.tipo !== "TOTAL").reduce((s, x) => s + (n(x.kw_liberado) ?? 0), 0);
      expect(perto(kw / 1000, l.mw_liberado, 0.05), `${l.id}: ${kw / 1000} × ${l.mw_liberado}`).toBe(true);
      const total = lib.find((x) => x.ano === l.id && x.tipo === "TOTAL");
      expect(perto((n(total?.kw_liberado) ?? 0) / 1000, l.mw_liberado, 0.05), `${l.id}: TOTAL`).toBe(true);
    }
  });

  it("leilões por ano = soma dos lotes contratados do CSV por lote", () => {
    const lotes = csv("expansao_leiloes_transmissao.csv");
    for (const l of linhasLeiloes(G.transmissao.leiloes.por_ano)) {
      const doAno = lotes.filter((x) => x.ano === l.ano);
      expect(doAno.length, l.ano).toBe(l.lotes_ofertados);
      const contratados = doAno.filter((x) => x.contratado === "sim");
      expect(contratados.length, l.ano).toBe(l.lotes_contratados);
      const km = contratados.reduce((s, x) => s + (n(x.km) ?? 0), 0);
      expect(perto(km, l.km, 0.1), `${l.ano}: ${km} × ${l.km}`).toBe(true);
    }
    // caso concreto do documento do módulo: 2024, 18 lotes e 7.247,0 km
    const a2024 = linhasLeiloes(G.transmissao.leiloes.por_ano).find((x) => x.ano === "2024")!;
    expect([a2024.lotes_contratados, a2024.km]).toEqual([18, 7247.0]);
  });

  it("carteira do RALIE por obra e viabilidade = CSV da carteira por usina; cruzamento exaustivo", () => {
    const cart = csv("expansao_carteira_ralie.csv");
    const linhas = linhasObraViabilidade(G);
    expect(linhas.reduce((s, l) => s + l.usinas, 0)).toBe(G.estagios.ralie.usinas);
    expect(G.estagios.ralie.obra_x_viabilidade.reduce((s, x) => s + x.usinas, 0)).toBe(G.estagios.ralie.usinas);
    for (const l of linhas) {
      const doCsv = cart.filter((x) => x.situacao_obra === l.obra);
      expect(doCsv.length, l.obra).toBe(l.usinas);
      const mw = doCsv.reduce((s, x) => s + (n(x.kw_ugs_em_implantacao) ?? 0), 0) / 1000;
      expect(perto(mw, l.alta + l.media + l.baixa, 0.2), `${l.obra}: ${mw}`).toBe(true);
    }
  });

  it("encerramentos por ano = atos do CSV por ano de publicação; contratos por ano = CSV do SIGET", () => {
    const atos = csv("expansao_encerramentos_outorga.csv");
    for (const l of linhasEncerramentos(G.estagios.encerramentos.por_ano)) expect(atos.filter((x) => x.publicacao.startsWith(l.id)).length, l.id).toBe(l.atos);
    const ctr = csv("expansao_contratos_transmissao.csv");
    for (const l of linhasContratosAno(G)) expect(ctr.filter((x) => x.assinatura.startsWith(l.id)).length, l.id).toBe(l.contratos);
  });

  it("figuras do PDE = CSV das figuras, valor a valor", () => {
    const pde = csv("expansao_pde2035.csv");
    for (const id of FIGURAS_PDE) {
      const f = G.cenarios.figuras[id];
      const rotulo = rotuloFigura(id);
      const d = dadosFigura(f);
      let conferidos = 0;
      for (const l of f.linhas) {
        for (const col of f.colunas) {
          const x = pde.find((r) => r.figura === rotulo && r.referencia === l.ref && r.serie === col);
          if (!x) continue;
          conferidos++;
          expect(n(x.valor), `${id} ${l.ref} ${col}`).toBe(l[col]);
        }
      }
      expect(conferidos, id).toBeGreaterThan(0);
      // o gráfico recebe os mesmos números, só com ids posicionais
      if (d.modo === "linhas") expect(d.dados.length).toBe(f.linhas.length);
      else expect(d.dados.length).toBe(f.colunas.length);
    }
  });

  it("mapa, tabela e exportação por UF têm as mesmas 27 UF e os mesmos valores", () => {
    const car = linhasCarteiraUf(G);
    expect(car.length).toBe(27);
    for (const m of MEDIDAS_CARTEIRA) {
      const v = valoresMapaCarteira(car, m);
      expect(Object.keys(v).length).toBe(27);
      const exp = matrizExportacao(COLUNAS_CARTEIRA_UF, car);
      const col = COLUNAS_CARTEIRA_UF.findIndex((c) => c.id === `${m}_mw`);
      car.forEach((l, i) => expect(exp.linhas[i][col], `${m} ${l.id}`).toBe(v[CODIGO_UF[l.id]]));
    }
    // RALIE por UF: zero observado onde a UF não tem usina, nunca null
    expect(car.find((l) => l.id === "AC")!.ralie_mw).toBe(0);
    const rede = linhasGeracaoRedeUf(G);
    for (const m of MEDIDAS_REDE) {
      const v = valoresMapaRede(rede, m);
      const exp = matrizExportacao(COLUNAS_GERACAO_REDE_UF, rede);
      const col = COLUNAS_GERACAO_REDE_UF.findIndex((c) => c.id === m);
      rede.forEach((l, i) => expect(exp.linhas[i][col], `${m} ${l.id}`).toBe(v[CODIGO_UF[l.id]]));
    }
  });

  it("maiores atrasadas marcam a previsão em data em bloco", () => {
    const bloco = new Set(G.cronograma.previsoes_atuais.datas_em_bloco.datas);
    for (const l of linhasAtrasadas(G)) {
      if (l.previsao_max === null) expect(l.previsao_em_bloco).toBeNull();
      else expect(l.previsao_em_bloco).toBe(bloco.has(l.previsao_max) ? "sim" : "não");
    }
  });
});

/* ================================================================ textos derivados */

describe("textos derivados dos números da gold", () => {
  it("as respostas citam os números publicados", () => {
    const con = G.estagios.resumo.find((r) => r.estagio === "construcao")!;
    expect(respostaCarteira(G)).toContain(mwTexto(con.mw_outorgado));
    expect(respostaCronograma(G)).toContain(mwTexto(G.cronograma.previsoes_atuais.datas_em_bloco.mw));
    expect(respostaTransmissao(G)).toContain(G.transmissao.obras.em_andamento.empreendimentos.toLocaleString("pt-BR"));
    expect(respostaSintese(G)).toContain(mwTexto(G.estagios.ralie.mw_ugs_em_implantacao));
    expect(respostaCenarios(G)).toContain(G.cenarios.data_base_premissas);
  });

  it("P040: a abertura 'Outorga não é entrada garantida' só aparece com outorga encerrada ou sem desfecho", () => {
    const g2 = gold();
    const c0 = g2.estagios.coortes.find((c) => c.coorte === "estoque_inicial")!;
    c0.desfechos.outorga_encerrada.pct_mw = 0;
    c0.desfechos.sem_desfecho.pct_mw = 0;
    expect(respostaCarteira(g2)).not.toContain("Outorga não é entrada garantida");
    expect(respostaSintese(g2)).not.toContain("Carteira não é entrada certa");
    c0.desfechos.operacao.pct_mw = 12.3;
    expect(respostaCarteira(g2)).toContain("12,3%");
    // ausência vira "sem dado", nunca zero
    c0.desfechos.operacao.pct_mw = null;
    expect(respostaCarteira(g2)).toContain("sem dado da potência entrou em operação");
  });

  it("P040: a direção da carteira no 'o que mudou' sai da comparação dos números", () => {
    const g2 = gold();
    const h = g2.estagios.historico_mensal;
    h[h.length - 1].mw_ugs = h[0].mw_ugs + 1;
    expect(mudancaCarteira(g2)).toContain("subiu");
    h[h.length - 1].mw_ugs = h[0].mw_ugs - 1;
    expect(mudancaCarteira(g2)).toContain("caiu");
    h[h.length - 1].mw_ugs = h[0].mw_ugs;
    expect(mudancaCarteira(g2)).toContain("ficou igual");
    // ano parcial declarado
    expect(mudancaCarteira(G)).toContain("ano parcial");
  });

  it("P041: o ano da fotografia é 'o restante do ano'; os demais, o ano", () => {
    expect(respostaCronograma(G)).toContain(`no restante de ${G.cronograma.data_ralie.slice(0, 4)}`);
    const g2 = gold();
    g2.cronograma.previsoes_atuais.data_ralie = "2025-12-31";
    expect(respostaCronograma(g2)).not.toContain("no restante de");
    expect(mudancaCronograma(G)).toContain("Sem as unidades em data em bloco");
  });

  it("P042: as três UF citadas são as de maior geração em implantação, em ordem", () => {
    const g2 = gold();
    const ac = g2.transmissao.geracao_e_rede_por_uf.find((u) => u.uf === "AC")!;
    ac.mw_ugs_em_implantacao = 999999;
    const r = respostaTransmissao(g2);
    expect(r).toContain("Acre tem 999.999,0 MW");
    expect(r.indexOf("Acre")).toBeLessThan(r.indexOf("Bahia"));
    // anos sem leilão no arquivo são ausência; um ano preenchido sai da lista
    expect(mudancaTransmissao(G)).toMatch(/2025 e 2026 aparecem como ausência/);
    const s = g2.transmissao.serie_anual.find((x) => x.ano === "2025")!;
    s.km_contratados_leilao = 10;
    expect(mudancaTransmissao(g2)).toMatch(/: 2026 aparece como ausência, não como ano sem leilão/);
  });

  it("P043: a categoria citada é a maior entre as de correspondência direta", () => {
    expect(respostaCenarios(G)).toContain("eólicas");
    const g2 = gold();
    g2.cenarios.camadas.find((x) => x.categoria === "Biomassa")!.pde_dez2035_gw = 80;
    expect(respostaCenarios(g2)).toContain("biomassa, com 80,0 GW");
    expect(mudancaCenarios(G)).toContain("Lei nº 15.269/2025");
    g2.cenarios.hipoteses.forEach((h) => (h.ressalva = null));
    expect(mudancaCenarios(g2)).toContain("não registra mudança");
  });

  it("nenhum texto gerado usa travessão ou hífen como pontuação", () => {
    const textos = [respostaSintese(G), respostaCarteira(G), mudancaCarteira(G), respostaCronograma(G), mudancaCronograma(G), respostaTransmissao(G), mudancaTransmissao(G), respostaCenarios(G), mudancaCenarios(G)];
    for (const x of textos) {
      expect(x).not.toMatch(/ [—–-] /);
      expect(x).not.toMatch(/—/);
    }
  });
});

/* ================================================================ mapas sob demanda e URL */

describe("mapas sob demanda e estado na URL", () => {
  it("os pontos das usinas, projetados na grade da malha, caem na UF que o SIGA informa", () => {
    const geo = JSON.parse(ler("public/energia/geo/uf.json")) as CamadaGeo;
    expect(geo.projecao.superficie).toContain(String(R_AUTALICO_GRS80));
    const aneis = new Map(geo.features.map((f) => [f.uf, lerCaminho(f.d)]));
    const j = JSON.parse(ler("public/energia/series/expansao_usinas_pontos.json")) as PontosUsinas;
    const pts = pontosDoJson(j, geo.projecao, ["construcao", "construcao_nao_iniciada"]);
    expect(pts.length).toBeGreaterThan(1000);
    let dentro = 0;
    let comUf = 0;
    for (const p of pts) {
      const a = p.uf ? aneis.get(p.uf) : undefined;
      if (!a) continue;
      comUf++;
      if (pontoNaRegiao([p.x, p.y], a)) dentro++;
    }
    // centróide aproximado e usina na divisa: tolerância de 3% fora da própria UF
    expect(dentro / comUf).toBeGreaterThan(0.97);
    // um ponto conhecido: Brasília (−15,79; −47,88) cai no DF
    const [x, y] = projetaPonto(-47.88, -15.79, geo.projecao);
    expect(pontoNaRegiao([x, y], aneis.get("DF")!)).toBe(true);
  });

  it("o filtro da rede da EPE respeita camada e tensão mínima", () => {
    const r = JSON.parse(ler("public/energia/series/expansao_rede_epe.json")) as LinhasRedeEpe;
    const todas = filtraRede(r.linhas, ["existente", "planejada"], 0);
    expect(todas.length).toBe(G.transmissao.rede_epe!.existente.linhas + G.transmissao.rede_epe!.planejada.linhas);
    const alta = filtraRede(r.linhas, ["planejada"], 500);
    expect(alta.every((l) => l[0] === "planejada" && (l[2] ?? 0) >= 500)).toBe(true);
    expect(alta.length).toBeGreaterThan(0);
  });

  it("os esquemas leem e escrevem a URL sem perder o recorte", () => {
    const v = lerEstado(ESQUEMA_CARTEIRA, "?car.med=ralie&car.uf=BA&car.cmp=BA,MG,XX&car.usina=37748&modo=analisar");
    expect(v).toMatchObject({ med: "ralie", uf: "BA", cmp: ["BA", "MG"], usina: 37748 });
    expect(escreverEstado(ESQUEMA_CARTEIRA, { uf: "CE" }, "?modo=analisar")).toBe("?modo=analisar&car.uf=CE");
    expect(lerEstado(ESQUEMA_CARTEIRA, "?car.med=invalida").med).toBe("nao_iniciada");
    expect(lerEstado(ESQUEMA_CRONOGRAMA, "?cro.via=alta&cro.bloco=sem").via).toEqual(["alta"]);
    expect(lerEstado(ESQUEMA_TRANSMISSAO, "?tra.med=km_epe&rede.kv=500").kv).toBe("500");
    expect(lerEstado(ESQUEMA_CENARIOS, "?cen.fig=fig_4_24").fig).toBe("fig_4_24");
    // o deslizamento sem datas em bloco é outra matriz, não um filtro escondido
    expect(linhasDeslizamento(G, "sem")[0].mw).toBe(G.cronograma.deslizamento[0].sem_datas_em_bloco.mw);
  });

  it("a próxima pergunta de cada painel é a seguinte, e a do último volta à primeira", () => {
    expect(PAINEIS_EXPANSAO.map((p) => proximoPainel(p.id))).toEqual(["p041", "p042", "p043", "p040"]);
    for (const p of PAINEIS_EXPANSAO) expect(existsSync(join(raiz, "src/app", rotaPainel(p.id), "page.tsx")), p.id).toBe(true);
    expect(linhasRalieTipo(G)[0].id).toBe([...G.estagios.ralie.por_tipo].sort((a, b) => b.mw_ugs_em_implantacao - a.mw_ugs_em_implantacao)[0].tipo);
  });
});

/* ================================================================ páginas no servidor */

describe("páginas renderizadas no servidor", () => {
  const paginas = { p040: PaginaCarteira, p041: PaginaCronograma, p042: PaginaTransmissao, p043: PaginaCenarios } as const;
  const html = Object.fromEntries(Object.entries(paginas).map(([k, P]) => [k, renderToStaticMarkup(createElement(P))])) as Record<keyof typeof paginas, string>;
  const sintese = renderToStaticMarkup(createElement(Sintese));
  const principal = (h: string) => h.slice(h.indexOf("<main"));
  const respostas = { p040: respostaCarteira(G), p041: respostaCronograma(G), p042: respostaTransmissao(G), p043: respostaCenarios(G) };
  const escapa = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

  it("cada painel renderiza com a pergunta como título, a resposta derivada e a anatomia da seção 7.2", () => {
    for (const p of PAINEIS_EXPANSAO) {
      const h = html[p.id];
      expect(h, p.id).toContain(`id="${p.id}"`);
      expect(h, p.id).toContain(`id="${p.id}-titulo"`);
      expect(h, p.id).toContain(p.pergunta);
      expect(h, p.id).toContain(`data-resposta="${p.id}"`);
      expect(h, p.id).toContain(escapa(respostas[p.id]));
      for (const parte of ["Período", "Universo", "Unidade", "Como interpretar", "O que não é possível concluir", "Próxima pergunta", "Copiar link deste painel", "Baixar"]) {
        expect(h, `${p.id}: ${parte}`).toContain(parte);
      }
      // o diálogo da ficha só existe no cliente (portal); no HTML do servidor cada ficha é o seu gatilho
      expect((h.match(/data-comprove=""/g) ?? []).length, p.id).toBeGreaterThanOrEqual(1);
      expect((h.match(/<table/g) ?? []).length, p.id).toBeGreaterThanOrEqual(3);
      expect(h, p.id).toContain('role="radiogroup" aria-label="Nível de profundidade"');
      expect(h, p.id).toContain(`href="${rotaPainel(proximoPainel(p.id))}"`);
    }
  });

  it("tabelas equivalentes e visualizações principais presentes em cada painel", () => {
    expect(html.p040).toContain("Usinas do SIGA por estágio");
    expect(html.p040).toContain("Desfecho das usinas acompanhadas pelo RALIE, por coorte");
    expect(html.p040).toContain("Carteira e operação por UF");
    expect(html.p040).toContain("Carregar o mapa das usinas");
    expect(html.p041).toContain("Potência com previsão de operação comercial por ano, fotografia do RALIE de");
    expect(html.p041).toContain("Confiabilidade das previsões por fotografia mensal");
    expect(html.p041).toContain("Maiores usinas com cronograma atrasado");
    expect(html.p042).toContain("Geração e rede por UF, lado a lado");
    expect(html.p042).toContain("Carregar o mapa da rede");
    expect(html.p042).toContain("Leilões depois do arquivo aberto: ausência na fonte");
    expect(html.p043).toContain("CENÁRIO");
    expect(html.p043).toContain("Cenário, realizado e carteira por categoria, em camadas separadas");
    expect(html.p043).toContain("Hipóteses da edição");
  });

  it("a síntese responde à pergunta do mapa e leva aos quatro painéis com números provados", () => {
    expect(sintese).toContain(PAGINAS_MAPA.expansao.pergunta);
    expect(sintese).toContain('data-resposta="sintese"');
    for (const p of PAINEIS_EXPANSAO) {
      expect(sintese).toContain(p.pergunta);
      expect(sintese).toContain(`data-resposta="${p.id}"`);
      expect(sintese).toContain(`href="${rotaPainel(p.id)}"`);
    }
    expect((sintese.match(/Comprove este número/g) ?? []).length).toBeGreaterThanOrEqual(5);
  });

  it("sem estado de construção, sem hexadecimal solto e abaixo de 600 KB de HTML por página", () => {
    for (const [k, h] of Object.entries({ ...html, sintese })) {
      expect(principal(h), k).not.toMatch(/em breve|em integração|integração em andamento|página em construção|em preparação/i);
      expect(h, k).not.toMatch(/#[0-9a-fA-F]{6}\b/);
      expect(h.length, k).toBeLessThan(600_000);
    }
  });

  it("todo número de destaque tem 'Comprove este número' ou declara ausência; só as medidas derivadas sem evidência na gold ficam numa lista explícita", () => {
    // A medida da abertura é o Numero variante="faixa" (data-metrica), no lugar do cartão antigo. A gold publica evidência só para parte
    // delas; as outras são derivadas das mesmas tabelas (a etapa Construção, as datas convencionais, o cenário no início do horizonte)
    // e entram aqui por nome, para que um número novo sem prova falhe o teste.
    const SEM_FICHA: Record<string, RegExp[]> = {
      sintese: [/^Em construção$/],
      p040: [/^Em construção$/],
      p041: [/^Prevista para o restante de \d{4}$/, /^Em datas convencionais em bloco$/, /^Com cronograma atrasado, segundo a fiscalização$/],
      p042: [/^Transformação nova em obras em andamento$/],
      p043: [/^Capacidade instalada nacional em [a-z]{3}\/\d{4}$/],
    };
    // grupos de medida com os <div> balanceados: o gatilho da prova e a ausência ficam dentro do próprio grupo
    const grupos = (h: string) => {
      const saida: { rotulo: string; html: string }[] = [];
      const re = /<div role="group" aria-label="([^"]*)" data-metrica=""[^>]*>/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(h))) {
        let prof = 0;
        let fim = h.length;
        for (const t of h.slice(m.index).matchAll(/<div\b|<\/div>/g)) {
          prof += t[0] === "</div>" ? -1 : 1;
          if (prof === 0) {
            fim = m.index + t.index! + t[0].length;
            break;
          }
        }
        saida.push({ rotulo: m[1], html: h.slice(m.index, fim) });
      }
      return saida;
    };
    for (const [k, h] of Object.entries({ ...html, sintese })) {
      const g = grupos(h);
      expect(g.length, k).toBeGreaterThan(0);
      let comFicha = 0;
      for (const { rotulo, html: trecho } of g) {
        const prova = trecho.includes("Comprove este número");
        if (prova) comFicha++;
        const permitido = (SEM_FICHA[k] ?? []).some((r) => r.test(rotulo));
        expect(prova || trecho.includes("sem dado") || permitido, `${k}: ${rotulo}`).toBe(true);
      }
      expect(comFicha, k).toBeGreaterThan(0);
    }
  });

  it("todo href interno aponta para página existente ou arquivo publicado", () => {
    for (const [k, h] of Object.entries({ ...html, sintese })) {
      const hrefs = Array.from(principal(h).matchAll(/href="(\/[^"#?]*)/g)).map((x) => x[1]);
      for (const href of Array.from(new Set(hrefs))) {
        const arquivo = existsSync(join(raiz, "public", href));
        const pagina = existsSync(join(raiz, "src/app", href, "page.tsx"));
        const verbete = /^\/setor-eletrico\/aprenda\/[^/]+$/.test(href) && !!conceito(href.split("/").at(-1)!);
        expect(arquivo || pagina || verbete, `${k}: ${href}`).toBe(true);
      }
    }
  });

  it("o destino está publicado e integrado na navegação, com a página atual marcada", () => {
    const d = DESTINOS_NAVEGACAO.find((x) => x.slug === "expansao")!;
    expect(d.publicado).toBe(true);
    expect(MODULOS_ENERGIA.find((m) => m.slug === "expansao")?.integrado).toBe(true);
    for (const h of [...Object.values(html), sintese]) expect(h).toContain('aria-current="page"');
    // a página antiga de escopo não volta: o componente de módulo em integração não é usado
    expect(ler("src/app/setor-eletrico/expansao/page.tsx")).not.toContain("ModuloEmIntegracao");
  });

  it("nenhum ano ou número da fonte escrito à mão nos textos das páginas", () => {
    for (const f of ["page.tsx", "carteira/page.tsx", "cronograma/page.tsx", "geracao-e-transmissao/page.tsx", "cenarios/page.tsx"]) {
      const t = ler(`src/app/setor-eletrico/expansao/${f}`);
      // números com separador de milhar ou vírgula decimal só podem vir da gold
      expect(t, f).not.toMatch(/\b\d{1,3}\.\d{3},\d\b|\b\d+,\d+ (MW|GW|km|MVA)\b/);
      expect(t, f).not.toMatch(/\b20(1\d|2\d)\b(?![-_])/);
    }
  });
});
