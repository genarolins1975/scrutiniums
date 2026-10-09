import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { VisaoRegraDetalhe, VisaoRegraResumo } from "@/components/energia/VisaoRegras";
import PaginaVisaoGeral from "@/app/setor-eletrico/visao-geral/page";
import { carregaJson, lerCaminho } from "@/lib/energia/carregaJson";
import { num } from "@/lib/energia/formato";
import { ANCORAS_VISAO_GERAL } from "@/lib/energia/mapa";
import type { CargaGold, GeracaoGold, HidrologiaGold, PldGold, RedeGold } from "@/lib/energia/tipos";
import type { PainelDeterminante, RegraObservar, SinteseVisaoGold } from "@/lib/energia/tipos-visao";
import {
  ANCORAS_DETERMINANTES,
  PAINEIS_VISAO,
  ROTULO_FRASE,
  casasUnidade,
  colunasMultiplos,
  corteEpisodios,
  determinantesDaPagina,
  expandeSiglas,
  linhasDeColunas,
  periodoDaJanela,
  textoCoberturaTarifa,
  textoDecApurado,
  textoJanelaTermica,
  textoMudouDeterminantes,
  textoUniversoDec,
  vereditoDeterminantes,
  textoDenominadorPerdas,
  textoLimiteAgregado,
  valorDoDiaNaSerie,
  datasLegiveis,
  snapshotLegivel,
  comUnidade,
  contagemEstados,
  dadosDeterminante,
  diasEntre,
  dominioEstados,
  faixasTempo,
  filtraRegras,
  fimDoPeriodo,
  inicioDoPeriodo,
  leituraDeterminante,
  linhasEpisodios,
  linhasFrases,
  linhasMultiplos,
  linhasRegras,
  linhasSensibilidade,
  linhasSociedade,
  minuscula,
  linhasValoresFrases,
  linhasVersoes,
  pedeAtencao,
  periodoCurto,
  posicaoDeterminante,
  recorteMultiplos,
  referenciasFrases,
  respostaDeterminantes,
  respostaObservar,
  respostaSistema,
  respostaSociedade,
  seriesDeterminante,
  somaDias,
  textoFrequenciaConjunta,
  textoLinhaEstado,
  textoValorRegra,
  trechosEstado,
  valorSociedade,
} from "@/lib/energia/visao";
import { contextoVisao } from "@/lib/energia/visao-servidor";

/**
 * Visão geral (P004 a P007): contrato da gold sintese.json, equivalência célula a célula
 * dos determinantes com as golds de origem (conferida aqui por outro caminho, além da
 * validação do pipeline), textos derivados dos números (mudar o número muda o texto),
 * linhas das tabelas equivalentes, âncoras antigas preservadas e renderização da página
 * no servidor com a anatomia da seção 7.2 e o peso abaixo da meta.
 */
const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, p), "utf-8");
const G: SinteseVisaoGold = JSON.parse(ler("public/energia/gold/sintese.json"));
const PLD: PldGold = JSON.parse(ler("public/energia/gold/pld.json"));
const HID: HidrologiaGold = JSON.parse(ler("public/energia/gold/hidrologia.json"));
const CARGA: CargaGold = JSON.parse(ler("public/energia/gold/carga.json"));
const GER: GeracaoGold = JSON.parse(ler("public/energia/gold/geracao.json"));
const REDE: RedeGold = JSON.parse(ler("public/energia/gold/rede.json"));
const clone = <T,>(x: T): T => structuredClone(x);
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const M = G.multiplos!;

/* ---------- contrato ---------- */

describe("contrato da gold sintese.json", () => {
  it("cabeçalho, painéis e blocos", () => {
    expect(G.disponivel).toBe(true);
    expect(G.modulo).toBe("visao");
    expect(G.paineis).toEqual(["P004", "P005", "P006", "P007"]);
    expect(G.data_processamento).toMatch(ISO);
    expect(G.frases.length).toBeGreaterThan(0);
    expect(M).toBeTruthy();
    expect(G.sociedade.itens.length).toBeGreaterThan(0);
    expect(G.observar.length).toBeGreaterThan(0);
    expect(G.downloads.length).toBeGreaterThan(0);
    for (const d of G.downloads) expect(d.url).toMatch(/^\/energia\/series\/.+\.csv$/);
  });

  it("cada frase é um fato com modelo, valores com caminho, versões com sha256 e evidência", () => {
    for (const f of G.frases) {
      expect(f.tipo).toBe("fato");
      expect(ROTULO_FRASE[f.id]).toBeTruthy();
      expect(f.ref).toMatch(ISO);
      expect(f.texto.length).toBeGreaterThan(20);
      // os trechos, concatenados, são a frase publicada
      expect(f.trechos.map((t) => t.texto).join("")).toBe(f.texto);
      expect(Object.keys(f.valores).length).toBeGreaterThan(0);
      for (const v of Object.values(f.valores)) expect(v.caminho, f.id).toMatch(/\.json#/);
      expect(f.versoes.gold).toMatch(/\.json$/);
      expect(f.versoes.dataset).toBeTruthy();
      expect(f.versoes.snapshot_sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(typeof f.qualidade.texto_defasagem).toBe("string");
      expect(f.evidencia ?? f.evidencia_problemas, f.id).toBeTruthy();
      if (f.evidencia) expect(f.evidencia.valor_exibido).toBeTruthy();
    }
  });

  it("determinantes: 90 dias alinhados, datas ordenadas e uma data de referência por painel", () => {
    expect(M.chave_x).toBe("d");
    expect(M.dados).toHaveLength(M.janela.dias);
    const datas = M.dados.map((l) => l.d);
    expect([...datas].sort()).toEqual(datas);
    expect(datas[0]).toBe(M.janela.inicio);
    expect(datas[datas.length - 1]).toBe(M.janela.fim);
    expect(M.paineis.map((p) => p.id)).toEqual(["preco", "agua", "geracao", "carga", "rede"]);
    for (const p of M.paineis) {
      expect(M.datas_referencia[p.id]).toBe(p.data_referencia);
      expect(p.colunas.length).toBeGreaterThan(0);
      expect(p.href).toMatch(/^\/setor-eletrico\//);
      expect(p.evidencia ?? p.evidencia_problemas, p.id).toBeTruthy();
    }
    expect(M.aviso_datas).toMatch(/datas diferentes/);
  });

  it("energia e sociedade: período tipado, nunca situação do dia, evidência e módulo de origem", () => {
    for (const it of G.sociedade.itens) {
      expect(["vigencia", "anual", "mensal"]).toContain(it.periodo.tipo);
      expect(it.nao_e_situacao_do_dia).toBe(true);
      expect(it.evidencia.valor_exibido).toBeTruthy();
      expect(it.href).toMatch(/^\/setor-eletrico\//);
      expect(it.gold).toMatch(/\.json$/);
      expect(typeof it.defasagem.texto).toBe("string");
    }
  });

  it("o que observar: regras com condição, limiar, retorno, materialidade e o que não implica", () => {
    const regras = G.observar.filter((o) => o.tipo !== "evento");
    expect(regras).toHaveLength(G.observar_resumo.total_regras);
    for (const o of regras) {
      for (const k of ["condicao", "regra_retorno", "materialidade", "nao_implica", "alerta_nao_implica_causa"] as const) expect(o[k], `${o.id}.${k}`).toBeTruthy();
      expect(["ativo", "em_retorno", "em_observacao", "normal", "sem_dado"]).toContain(o.estado);
      expect(o.ativo).toBe(o.estado === "ativo" || o.estado === "em_retorno");
      if (o.linha_estado?.inicio) {
        expect(o.linha_estado.estados.length).toBeLessThanOrEqual(366);
        expect(o.linha_estado.estados).toMatch(/^[Ao.\-]+$/);
      }
      if (o.historico) {
        expect(o.historico.pct_dias_exibidos).toBeGreaterThanOrEqual(0);
        expect(o.historico.pct_dias_exibidos).toBeLessThanOrEqual(100);
        expect(o.historico.dias_avaliados).toBeGreaterThan(0);
      }
    }
    for (const id of G.observar_resumo.ativas) expect(G.observar.find((o) => o.id === id)?.ativo, id).toBe(true);
  });
});

/* ---------- equivalência com as golds de origem (outro caminho) ---------- */

describe("determinantes copiados das golds de origem, célula a célula", () => {
  const porData = <T extends { d: string }>(s: T[]) => new Map(s.map((x) => [x.d, x]));
  const pld = porData(PLD.diario as unknown as ({ d: string } & Record<string, number | null>)[]);
  const ear = porData(HID.serie_ear as unknown as ({ d: string } & Record<string, number | null>)[]);
  const carga = porData(CARGA.serie as unknown as ({ d: string } & Record<string, number | null>)[]);
  const term = porData(GER.serie_termica_7d as unknown as ({ d: string } & Record<string, number | null>)[]);
  const rede = porData(REDE.serie_fluxos as unknown as ({ d: string } & Record<string, number | null>)[]);
  const ultimos = M.dados.slice(-10);

  it("preço, água, geração, carga e rede batem com a gold de origem nos últimos dez dias", () => {
    let conferidas = 0;
    for (const l of ultimos) {
      for (const sm of ["SE", "S", "NE", "N"]) {
        const o = pld.get(l.d)?.[sm];
        if (o !== undefined) {
          expect(l[`preco_${sm}`], `${l.d} preco_${sm}`).toBe(o);
          conferidas++;
        }
      }
      const e = ear.get(l.d)?.SIN;
      if (e !== undefined) {
        expect(l.agua_SIN, `${l.d} agua_SIN`).toBe(e);
        conferidas++;
      }
      const c = carga.get(l.d)?.SIN;
      if (c !== undefined) {
        expect(l.carga_SIN, `${l.d} carga_SIN`).toBe(c);
        conferidas++;
      }
      const t = term.get(l.d)?.termica_7d;
      if (t !== undefined) {
        expect(l.geracao_termica_7d, `${l.d} termica`).toBe(t);
        conferidas++;
      }
      for (const par of ["N_NE", "N_SE", "NE_SE", "S_SE"]) {
        const r = rede.get(l.d)?.[par];
        if (r !== undefined) {
          expect(l[`rede_${par}`], `${l.d} rede_${par}`).toBe(r);
          conferidas++;
        }
      }
    }
    expect(conferidas).toBeGreaterThan(40);
  });

  it("dia sem valor na origem fica vazio, nunca zero nem repetido", () => {
    const ultimo = M.dados[M.dados.length - 1];
    // o preço vai até 30/09 e a água até 28/09: a célula de água do último dia é null
    if (ultimo.d > (M.datas_referencia.agua ?? "")) expect(ultimo.agua_SIN).toBeNull();
    expect(M.dados.some((l) => l.agua_SIN === 0)).toBe(false);
  });

  it("a faixa da água vem das bandas do mesmo dia do calendário em hidrologia.json", () => {
    const bandas = new Map(HID.bandas_ear.map((b) => [b.md as string, b as Record<string, number | null>]));
    for (const l of ultimos.filter((x) => x.agua_SIN !== null)) {
      const md = l.d.slice(5, 10) === "02-29" ? "02-28" : l.d.slice(5, 10);
      expect(l.agua_p10, l.d).toBe(bandas.get(md)?.SIN_p10);
      expect(l.agua_p90, l.d).toBe(bandas.get(md)?.SIN_p90);
    }
  });
});

/* ---------- lógica pura ---------- */

describe("utilidades de data e unidade", () => {
  it("dias entre datas, soma de dias e limites de período", () => {
    expect(diasEntre("2026-09-28", "2026-10-01")).toBe(3);
    expect(somaDias("2026-12-30", 3)).toBe("2027-01-02");
    expect(inicioDoPeriodo("2025-05")).toBe("2025-05-01");
    expect(fimDoPeriodo("2025-02")).toBe("2025-02-28");
    expect(fimDoPeriodo("2024-02")).toBe("2024-02-29");
    expect(fimDoPeriodo("2026-09-30")).toBe("2026-09-30");
  });
  it("número com unidade na forma da página", () => {
    expect(comUnidade(105.274, "R$/MWh", 2)).toBe("R$ 105,27/MWh");
    expect(comUnidade(61.65, "% da EAR máxima", 1)).toBe("61,7% da EAR máxima");
    expect(comUnidade(88896, "MWmed", 0)).toBe("88.896 MWmed");
    expect(comUnidade(null, "MWmed", 0)).toBe("sem dado");
    expect(casasUnidade("R$/MWh")).toBe(2);
    expect(casasUnidade("% da MLT")).toBe(1);
    expect(casasUnidade("MWmed")).toBe(0);
  });
});

describe("leitura sob demanda da gold e datas legíveis", () => {
  it("o caminho de cada ficha de prova aponta para uma evidência existente na gold publicada", () => {
    G.frases.forEach((f, i) => expect(lerCaminho(G, `frases[${i}].evidencia`), f.id).toBe(f.evidencia));
    M.paineis.forEach((p, i) => expect(lerCaminho(G, `multiplos.paineis[${i}].evidencia`), p.id).toBe(p.evidencia));
    G.sociedade.itens.forEach((it, i) => {
      expect(lerCaminho(G, `sociedade.itens[${i}].evidencia`), it.id).toBe(it.evidencia);
      (it.evidencias_complementares ?? []).forEach((c, k) => expect(lerCaminho(G, `sociedade.itens[${i}].evidencias_complementares[${k}].evidencia`)).toBe(c.evidencia));
    });
    G.observar.forEach((o, i) => {
      if (o.evidencia_numero) expect(lerCaminho(G, `observar[${i}].evidencia_numero`), o.id).toBe(o.evidencia_numero);
    });
    expect(lerCaminho(G, "frases[99].evidencia")).toBeUndefined();
    expect(lerCaminho(null, "a.b")).toBeUndefined();
    expect(typeof carregaJson).toBe("function");
  });
  it("datas ISO soltas no texto do pipeline viram datas da página; identificadores ficam", () => {
    expect(datasLegiveis("de 2025-04-13 a 2026-09-28; meta 33.3%")).toBe("de 13/04/2025 a 28/09/2026; meta 33.3%");
    expect(datasLegiveis("último período 2025-06, 367 dias")).toBe("último período jun/2025, 367 dias");
    // intervalo ISO de dias vira "de a"; datas coladas a CNPJ, identificador ou barra de caminho não mudam
    expect(datasLegiveis("02291077000193 ind DFP DFC 2013-01-01/2013-12-31: fluxos")).toBe("02291077000193 ind DFP DFC 01/01/2013 a 31/12/2013: fluxos");
    expect(datasLegiveis("2013-01-01/2013-12-31")).toBe("01/01/2013 a 31/12/2013");
    expect(datasLegiveis("33.541.368/0001-86 e 2021-13-01/2021-14-01")).toBe("33.541.368/0001-86 e 2021-13-01/2021-14-01");
    expect(datasLegiveis("data/2013-01-01/2013-12-31")).toBe("data/2013-01-01/2013-12-31");
    expect(datasLegiveis("snapshot ear_subsistema_di@2026-09-30T02:19:44Z")).toBe("snapshot ear_subsistema_di@2026-09-30T02:19:44Z");
    expect(datasLegiveis("PREVISÃO emitida em 2026-09-30T00:00Z (inicialização do modelo)")).toBe("PREVISÃO emitida em 30/09/2026 00:00 UTC (inicialização do modelo)");
    // só data válida vira data: o "0001-86" de um CNPJ e meses ou dias impossíveis ficam como vieram
    expect(datasLegiveis("33.541.368/0001-86")).toBe("33.541.368/0001-86");
    expect(datasLegiveis("2025-13 e 2024-00 e 20241-05")).toBe("2025-13 e 2024-00 e 20241-05");
    // identificador com data (ato, chave de escala) sai legível, sem perder o prefixo
    expect(datasLegiveis("DSP-RET 2016-11-24; DFP 2019-12-31 individual: x1000")).toBe("DSP-RET 24/11/2016; DFP 31/12/2019 individual: x1000");
    expect(datasLegiveis("das 2026-09-30T02:20 às 2026-10-01T06:40:15")).toBe("das 30/09/2026 02:20 às 01/10/2026 06:40");
    expect(datasLegiveis("arquivo ear_2026-09-30.csv")).toBe("arquivo ear_2026-09-30.csv");
    expect(datasLegiveis("sem data aqui")).toBe("sem data aqui");
  });
  it("data fora do século corrente e id de snapshot legível", () => {
    expect(datasLegiveis("o SIGA marca usina sem data com 1900-01-03 e fim (3036-03-13)")).toBe("o SIGA marca usina sem data com 03/01/1900 e fim (13/03/3036)");
    expect(snapshotLegivel("ccee_pld_horario@2026-09-30T02:20:14Z")).toBe("ccee_pld_horario (captura de 30/09/2026 02:20 UTC)");
    expect(snapshotLegivel("corte@2026-09-30T10:00:00Z:b673ea95d1c4")).toBe("corte (captura de 30/09/2026 10:00 UTC):b673ea95d1c4");
    expect(snapshotLegivel("sem_data")).toBe("sem_data");
  });
});

describe("P004: respostas e tabelas derivadas das frases", () => {
  it("a resposta conta as frases, cita as datas e a caixa de destaques", () => {
    const r = respostaSistema(G);
    expect(r).toContain(`${G.frases.length} fatos`);
    const refs = referenciasFrases(G.frases)!;
    expect(r).toContain(refs.min.slice(8, 10));
    if (!G.destaques.itens.length && G.destaques.vazio) expect(r).toContain(G.destaques.vazio);
    const dados = G.observar.filter((o) => o.assunto === "dados" && o.tipo !== "evento" && o.ativo);
    if (dados.length) expect(r).toMatch(/Em alerta sobre os próprios dados/);
  });
  it("mudar os destaques muda a resposta", () => {
    const g = clone(G);
    g.destaques.itens = [{ ...(g.destaques.itens[0] ?? { regra: "ear_faixa", titulo: "Reservatórios em nível extremo", texto: "x", tipo: "fato", estado: "ativo", desde: "2026-09-01", confirmado_em: "2026-09-08", dias: 10, dias_desde_confirmacao: 3, referencia: "2026-09-28", normaliza_quando: "", frequencia_historica_pct: 1, historico_avaliavel_desde: "2021-01-01", dias_avaliados: 100, valor: null, evidencia_caminho: "", evidencia: null, hipoteses_a_verificar: [], nao_implica: "", href: "/setor-eletrico/agua-e-clima" }) }];
    expect(respostaSistema(g)).toContain("Um destaque de regra sobre o sistema: reservatórios em nível extremo");
  });
  it("as tabelas têm uma linha por frase e uma por valor, com caminho e sha256", () => {
    expect(linhasFrases(G.frases).map((l) => l.id)).toEqual(G.frases.map((f) => f.id));
    const valores = linhasValoresFrases(G.frases);
    expect(valores.length).toBe(G.frases.reduce((s, f) => s + Object.keys(f.valores).length, 0));
    for (const v of valores) expect(String(v.caminho)).toMatch(/#/);
    for (const v of linhasVersoes(G.frases)) expect(String(v.sha256)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("P005: recorte, séries, posição e leitura dos determinantes", () => {
  it("o recorte devolve os últimos n dias, em ordem", () => {
    const r = recorteMultiplos(M, 30);
    expect(r).toHaveLength(30);
    expect(r[29].d).toBe(M.janela.fim);
    expect(r.map((l) => l.d)).toEqual([...r.map((l) => l.d)].sort());
    expect(recorteMultiplos(M, 1000)).toHaveLength(M.dados.length);
  });
  it("as linhas do gráfico copiam as colunas da gold e acrescentam a faixa constante", () => {
    for (const p of M.paineis) {
      const linhas = dadosDeterminante(p, M.dados.slice(-3));
      expect(linhas).toHaveLength(3);
      for (const c of p.colunas) expect(linhas[2][c.id]).toBe(M.dados[M.dados.length - 1][c.id] ?? null);
      if (p.referencia.tipo === "faixa_constante") {
        expect(linhas[0][`${p.id}_ref_inf`]).toBe(p.referencia.inferior);
        expect(linhas[0][`${p.id}_ref_sup`]).toBe(p.referencia.superior);
      }
      const s = seriesDeterminante(p);
      expect(s.length).toBeGreaterThanOrEqual(p.colunas.length);
      // só tokens do domínio: direto (var) ou misturados com preto para passar de 3:1 de contraste (o verde do Sul)
      for (const x of s) expect(x.cor).toMatch(/^(var\(--[a-z0-9-]+\)|color-mix\(in srgb, var\(--[a-z0-9-]+\) \d+%, #000\))$/);
    }
  });
  it("a posição frente à referência usa a linha da data de referência do painel", () => {
    const agua = M.paineis.find((p) => p.id === "agua") as PainelDeterminante;
    const pos = posicaoDeterminante(agua, M);
    const linha = M.dados.find((l) => l.d === agua.data_referencia)!;
    expect(pos.valor).toBe(agua.valor_atual.valor);
    expect(pos.inferior).toBe(linha.agua_p10);
    expect(pos.superior).toBe(linha.agua_p90);
    const v = pos.valor as number;
    expect(pos.situacao).toBe(v < (pos.inferior as number) ? "abaixo" : v > (pos.superior as number) ? "acima" : "dentro");
    const carga = M.paineis.find((p) => p.id === "carga") as PainelDeterminante;
    const pc = posicaoDeterminante(carga, M);
    if (pc.referencia !== null) expect(pc.diferenca).toBeCloseTo((pc.valor as number) - pc.referencia, 6);
    const rede = M.paineis.find((p) => p.id === "rede") as PainelDeterminante;
    expect(posicaoDeterminante(rede, M).situacao).toBe("sentido");
  });
  it("uma leitura por painel, com o valor exibido; mudar o valor muda a leitura", () => {
    const leituras = respostaDeterminantes(M);
    expect(leituras).toHaveLength(M.paineis.length);
    for (const [i, p] of Array.from(M.paineis.entries())) {
      expect(leituras[i]).toContain(p.titulo);
      if (p.valor_atual.valor !== null) expect(leituras[i]).toContain(comUnidade(p.valor_atual.valor, p.unidade, p.casas).replace(/^R\$ /, ""));
    }
    const p = clone(M.paineis.find((x) => x.id === "carga") as PainelDeterminante);
    const antes = leituraDeterminante(p, M);
    p.valor_atual.valor = (p.valor_atual.valor ?? 0) + 1234;
    expect(leituraDeterminante(p, M)).not.toBe(antes);
  });
  it("a tabela equivalente tem a data e todas as colunas do recorte, com uma linha por dia", () => {
    const cols = colunasMultiplos(M).map((c) => c.id);
    for (const k of Object.keys(M.dados[0])) expect(cols, k).toContain(k);
    const linhas = linhasMultiplos(M.dados.slice(-5));
    expect(linhas.map((l) => l.id)).toEqual(M.dados.slice(-5).map((l) => l.d));
  });
});

describe("P006: período, valor e tempo dos indicadores de sociedade", () => {
  it("período curto por tipo e valor com unidade quando o texto é só número", () => {
    expect(periodoCurto({ periodo: { tipo: "vigencia", inicio: "2026-09-30", fim: "2026-09-30", rotulo: "" } })).toBe("vigente em 30/09/2026");
    expect(periodoCurto({ periodo: { tipo: "anual", inicio: "2025-01", fim: "2025-12", rotulo: "" } })).toBe("ano de 2025");
    expect(periodoCurto({ periodo: { tipo: "mensal", inicio: "2025-05", fim: "2025-05", rotulo: "" } })).toBe("mai/2025");
    expect(valorSociedade({ valor_exibido: "17.246.524", unidade: "unidades consumidoras", equivalente: null })).toBe("17.246.524 unidades consumidoras");
    expect(valorSociedade({ valor_exibido: "R$ 0,8212/kWh", unidade: "R$/kWh", equivalente: null })).toBe("R$ 0,8212/kWh");
  });
  it("a resposta diz que nenhum número descreve o dia e cita cada indicador; mudar o valor muda a resposta", () => {
    const r = respostaSociedade(G.sociedade);
    expect(r).toMatch(/nenhum descreve o dia/);
    for (const it of G.sociedade.itens) expect(r).toContain(it.titulo);
    const s = clone(G.sociedade);
    s.itens[0].valor_exibido = "R$ 9,9999/kWh";
    expect(respostaSociedade(s)).not.toBe(r);
    expect(linhasSociedade(G.sociedade).map((l) => l.id)).toEqual(G.sociedade.itens.map((i) => i.id));
  });
  it("a linha do tempo termina na data de processamento e a defasagem é a distância até ela", () => {
    const faixas = faixasTempo(G.sociedade, G.data_processamento);
    for (const f of faixas) {
      expect(f.fim <= G.data_processamento).toBe(true);
      expect(f.defasagemDias).toBe(diasEntre(f.fim, G.data_processamento));
    }
  });
});

describe("P007: estados, filtros, linhas de estado e frequência", () => {
  it("a resposta conta as regras em alerta e em observação a partir dos estados publicados", () => {
    const r = respostaObservar(G.observar);
    const regras = G.observar.filter((o) => o.tipo !== "evento");
    const alerta = regras.filter((o) => o.ativo);
    if (alerta.length) {
      expect(r).toContain(`${alerta.length === 1 ? "1 está" : `${alerta.length} estão`} em alerta`);
      for (const o of alerta) expect(r.toLowerCase()).toContain(o.titulo.toLowerCase());
    } else expect(r).toMatch(/Nenhuma das/);
    const obs = regras.filter((o) => o.estado === "em_observacao");
    if (obs.length) expect(r).toMatch(/em observação/);
    const g = clone(G.observar);
    g.filter((o) => o.tipo !== "evento").forEach((o) => {
      o.ativo = false;
      o.estado = "normal";
    });
    expect(respostaObservar(g)).toMatch(/Nenhuma das \d+ regras está em alerta/);
  });
  it("filtros e atenção", () => {
    expect(filtraRegras(G.observar, "todas")).toHaveLength(G.observar.length);
    expect(filtraRegras(G.observar, "sistema").every((o) => o.assunto === "sistema")).toBe(true);
    expect(filtraRegras(G.observar, "dados").every((o) => o.assunto === "dados")).toBe(true);
    for (const o of filtraRegras(G.observar, "atencao")) expect(pedeAtencao(o)).toBe(true);
    expect(pedeAtencao({ tipo: "evento", estado: "evento" })).toBe(false);
  });
  it("a linha de estado em trechos reproduz a string publicada e a contagem por estado", () => {
    for (const o of G.observar) {
      const le = o.linha_estado;
      if (!le?.inicio) continue;
      const trechos = trechosEstado(le);
      expect(trechos.reduce((s, t) => s + t.dias, 0)).toBe(le.estados.length);
      expect(trechos.map((t) => t.estado.repeat(t.dias)).join("")).toBe(le.estados);
      expect(trechos[0].inicio).toBe(le.inicio);
      const c = contagemEstados(le);
      expect(Object.values(c).reduce((a, b) => a + b, 0)).toBe(le.estados.length);
      const txt = textoLinhaEstado(o)!;
      expect(txt).toMatch(/^De \d{2}\/\d{2}\/\d{4} a \d{2}\/\d{2}\/\d{4}:/);
      if (c["A"]) expect(txt).toContain("com alerta exibido");
    }
    const dom = dominioEstados(G.observar);
    expect(dom).toBeTruthy();
    expect(dom!.inicio <= dom!.fim).toBe(true);
  });
  it("valor avaliado com limiares, tabelas e frequência conjunta", () => {
    for (const o of G.observar as RegraObservar[]) {
      const t = textoValorRegra(o);
      if (o.valor) expect(t).toMatch(/alerta|sem limiar/);
    }
    expect(linhasRegras(G.observar)).toHaveLength(G.observar.length);
    expect(linhasSensibilidade(G.observar).length).toBe(G.observar.reduce((s, o) => s + (o.historico?.sensibilidade_duracao?.length ?? 0), 0));
    expect(linhasEpisodios(G.observar).length).toBe(G.observar.reduce((s, o) => s + (o.historico?.ultimos_episodios?.length ?? 0), 0));
    const f = textoFrequenciaConjunta(G);
    if (G.destaques.frequencia_conjunta) {
      expect(f).toContain("a meta é no máximo");
      expect(f).toContain(G.destaques.frequencia_conjunta.atende_meta ? "cumprida" : "não cumprida");
    }
  });
});

/* ---------- âncoras e página ---------- */

describe("página da Visão geral", () => {
  const html = renderToStaticMarkup(createElement(PaginaVisaoGeral));

  it("as âncoras antigas da página inicial estão nos blocos ou nos cartões dos determinantes", () => {
    const nosCartoes = Object.values(ANCORAS_DETERMINANTES).flatMap((a) => [a.id, a.painel]);
    for (const a of ANCORAS_VISAO_GERAL) {
      const esperada = a === "sistema" || a === "observar" ? a : nosCartoes.includes(a) ? a : null;
      expect(esperada, a).toBe(a);
      expect(html, a).toContain(`id="${a}"`);
    }
    for (const p of PAINEIS_VISAO) {
      expect(html).toContain(`id="${p.id}"`);
      expect(html).toContain(`data-resposta="${p.id}"`);
      expect(html).toContain(p.pergunta);
    }
  });

  it("anatomia da seção 7.2: resposta, recorte, prova, tabela, download, link e próxima pergunta", () => {
    for (const f of G.frases) expect(html).toContain(f.texto.slice(0, 40));
    expect(html).toContain("Comprove este número");
    // redesenho: as notas do painel são "Como interpretar" e "O que não é possível concluir", e o rodapé é o SeguirPainel
    expect(html).toContain("Como interpretar");
    expect(html).toContain("O que não é possível concluir");
    expect(html).toContain("Copiar link deste painel");
    expect(html).toContain("Próxima pergunta");
    expect(html).toContain("Baixar os dados");
    expect(html).toContain('data-nivel="analisar"');
    expect(html).toContain('data-nivel="auditar"');
    expect(html).toContain(G.multiplos!.aviso_datas.slice(0, 60));
    for (const it of G.sociedade.itens) expect(html).toContain(`id="sociedade-${it.id}"`);
    for (const o of G.observar) expect(html).toContain(`id="regra-${o.id}"`);
  });

  it("sem valor de reserva, sem vazamento de objeto, sem data crua no texto e abaixo da meta de peso", () => {
    expect(html).not.toMatch(/NaN|undefined|\[object Object\]/);
    const texto = html.replace(/<[^>]+>/g, " ");
    // a mesma regra da auditoria das páginas pré-renderizadas (energia-reauditoria)
    expect(texto).not.toMatch(/(^|[\s(])20\d\d[-/]\d\d([-/]\d\d)?(T[\d:]+Z?)?(?=[\s).,;]|$)/);
    expect(Buffer.byteLength(html, "utf-8")).toBeLessThan(600 * 1024);
    // as fichas de prova e as tabelas pesadas não vêm no HTML: são lidas da gold publicada sob demanda
    expect(html).toContain('data-tabelas="observar-analise"');
    expect(html).toContain('data-tabelas="sistema-auditoria"');
  });

  it("linguagem causal só negada", () => {
    for (const m of Array.from(html.matchAll(/caus\w*/gi))) {
      const ctx = html.slice(Math.max(0, m.index! - 80), m.index! + 20).toLowerCase();
      expect(/nunca|não|nenhuma|sem /.test(ctx), `...${ctx}...`).toBe(true);
    }
  });
});


describe("minúscula no meio da frase", () => {
  it("poupa a primeira palavra quando é sigla: CMO publicado, e não cMO", () => {
    expect(minuscula("CMO publicado pelo ONS para a semana operativa mais recente")).toBe("CMO publicado pelo ONS para a semana operativa mais recente");
    expect(minuscula("Carga extrema no dia")).toBe("carga extrema no dia");
    expect(minuscula("PLD no piso")).toBe("PLD no piso");
    expect(minuscula("")).toBe("");
  });
});


describe("bastidor das regras fora de Entender", () => {
  const sem = (html: string, nivel: string) => html.replace(new RegExp(`<(span|p|ul)[^>]*data-nivel="${nivel}"[^>]*>[\\s\\S]*?</\\1>`, "g"), "");

  it("o resumo da regra de coleta da CCEE manda firewall, HTTP e nome de arquivo para Analisar", () => {
    const o = G.observar.find((x) => /firewall/.test(x.evidencia))!;
    expect(o).toBeTruthy();
    const html = renderToStaticMarkup(createElement(VisaoRegraResumo, { o }));
    const entender = sem(html, "analisar");
    expect(entender).not.toMatch(/firewall|HTTP \d{3}|\.json/);
    expect(entender).toContain("Último dia integrado");
    expect(html).toContain("firewall");
  });

  it("o detalhe da regra põe coleta direta, bloqueios e conjuntos avaliados em Auditar", () => {
    const o = G.observar.find((x) => x.bloqueios_registrados && x.bloqueios_registrados.length > 0)!;
    const html = renderToStaticMarkup(createElement(VisaoRegraDetalhe, { o }));
    const entender = sem(html, "auditar");
    expect(entender).not.toContain("Bloqueio registrado");
    expect(entender).not.toContain("Última tentativa de coleta direta");
    expect(html).toContain("Bloqueio registrado");
    const comConjuntos = G.observar.find((x) => x.conjuntos_avaliados && x.conjuntos_avaliados.length > 0);
    if (comConjuntos) expect(sem(renderToStaticMarkup(createElement(VisaoRegraDetalhe, { o: comConjuntos })), "auditar")).not.toContain("Conjuntos avaliados");
  });
});


/* ---------- r10: a ressalva essencial, o corte e a data de cada medida ---------- */

describe("r10: DEC apurado, perdas, tarifa de referência e EAR com a ressalva junto do número", () => {
  const ctx = contextoVisao(G);
  const html = renderToStaticMarkup(createElement(PaginaVisaoGeral));
  const texto = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");
  const csv = (p: string) => {
    const [cab, ...l] = ler(p).replace(/^\uFEFF/, "").trim().split(/\r?\n/).map((x) => x.split(";"));
    return l.map((r) => Object.fromEntries(cab.map((c, i) => [c, r[i]])) as Record<string, string>);
  };
  const bloco = (atributo: string) => {
    const i = html.indexOf(atributo);
    expect(i, atributo).toBeGreaterThan(0);
    return texto(html.slice(i, i + 4000));
  };

  it("o DEC apurado diz o que a regra exclui e o total de todas as origens, relidos de qualidade.json", () => {
    const q = JSON.parse(ler("public/energia/gold/qualidade.json"));
    const ano = Number(G.sociedade.itens.find((i) => i.id === "continuidade")!.periodo.fim.slice(0, 4));
    const a = q.brasil.anual.find((x: { ano: number }) => x.ano === ano);
    const p = a.parcelas_dec;
    const excluido = p.emergencia + p.dia_critico + p.externa + p.ons;
    // a reconciliação do pipeline: apurado mais excluído é o tempo de todas as origens
    expect(Math.abs(a.dec + excluido - a.dec_todas_parcelas)).toBeLessThan(0.011);
    expect(ctx.dec).not.toBeNull();
    expect(ctx.dec!.apurado).toBe(a.dec);
    expect(ctx.dec!.todasOrigens).toBe(a.dec_todas_parcelas);
    expect(ctx.dec!.excluido).toBeCloseTo(excluido, 6);
    const t = textoDecApurado(ctx.dec!);
    expect(t).toContain(`${num(a.dec, 2)} h`);
    expect(t).toContain(`${num(excluido, 2)} h`);
    expect(t).toContain(`${num(a.dec_todas_parcelas, 2)} h`);
    for (const rotulo of ["situação de emergência", "dia crítico", "origem externa", "racionamento ou alívio de carga pelo ONS"]) expect(t).toContain(rotulo);
    // o texto está junto do cartão, em Entender, e o cartão leva à parte da Qualidade que explica os expurgos
    const c = bloco('data-ressalva-sociedade="continuidade"');
    expect(c).toContain(`${num(a.dec_todas_parcelas, 2)} h`);
    expect(html).toContain('href="/setor-eletrico/qualidade#expurgos"');
    expect(texto(html)).toContain("Continuidade do fornecimento (DEC apurado)");
  });

  it("o limite agregado de DEC não é um limite nacional e diz quantos conjuntos o ultrapassam", () => {
    const q = JSON.parse(ler("public/energia/gold/qualidade.json"));
    const t = textoLimiteAgregado(ctx.dec!);
    expect(t).toContain("Não existe limite nacional de DEC");
    expect(t).toContain(`${num(q.conjuntos.acima_limite_dec, 0)} de ${num(q.conjuntos.com_limite, 0)} conjuntos`);
    expect(bloco('data-limite-agregado=""')).toContain(`${num(q.conjuntos.acima_limite_dec, 0)} de ${num(q.conjuntos.com_limite, 0)}`);
    expect(bloco('data-dispersao="continuidade"')).toContain("metade dos conjuntos ficou entre");
  });

  it("a taxa de perdas nomeia o denominador: contagem relida do CSV por distribuidora, taxa com a injetada publicada e dispersão", () => {
    const ano = Number(G.sociedade.itens.find((i) => i.id === "perdas")!.periodo.fim.slice(0, 4));
    const linhas = csv("public/energia/series/perdas_distribuidoras.csv").filter((l) => l.ano === String(ano) && l.classificacao === "Concessionária" && l.completo === "1" && !l.alertas);
    const mistas = linhas.filter((l) => l.origem_injetada === "requerida" || l.origem_injetada === "mista").length;
    expect(ctx.perdas).not.toBeNull();
    expect(ctx.perdas!.concessionarias).toBe(linhas.length);
    expect(ctx.perdas!.requeridaOuMista).toBe(mistas);
    const perdas = linhas.reduce((s, l) => s + Number(l.perdas_totais_mwh), 0);
    const publicada = linhas.reduce((s, l) => s + Number(l.injetada_publicada_mwh), 0);
    expect(ctx.perdas!.taxaPublicadaPct).toBeCloseTo((100 * perdas) / publicada, 6);
    const t = textoDenominadorPerdas(ctx.perdas!);
    expect(t).toContain(`${num(mistas, 0)} das ${num(linhas.length, 0)} concessionárias`);
    expect(t).toContain(`${num(ctx.perdas!.taxaPublicadaPct, 1)}%`);
    expect(bloco('data-ressalva-sociedade="perdas"')).toContain(`${num(mistas, 0)} das ${num(linhas.length, 0)}`);
    const q = ctx.perdas!.dispersao!;
    expect(q.min).toBeLessThanOrEqual(q.p25);
    expect(q.p25).toBeLessThanOrEqual(q.mediana);
    expect(q.mediana).toBeLessThanOrEqual(q.p75);
    expect(q.p75).toBeLessThanOrEqual(q.max);
  });

  it("a tarifa de referência diz de quantas distribuidoras é a mediana e por que as demais ficaram fora", () => {
    const conta = JSON.parse(ler("public/energia/gold/conta.json"));
    const sem = conta.tarifas.sem_vigente as { dias_sem_tarifa: number | null }[];
    expect(ctx.tarifa!.comTarifa).toBe(conta.tarifas.resumo.n);
    expect(ctx.tarifa!.fora).toBe(sem.length);
    expect(ctx.tarifa!.foraRecente + ctx.tarifa!.foraAntigas).toBe(sem.length);
    expect(ctx.tarifa!.comTarifa + ctx.tarifa!.fora).toBe(ctx.tarifa!.cnpjs);
    const t = textoCoberturaTarifa(ctx.tarifa!);
    expect(t).toContain(`${num(ctx.tarifa!.comTarifa, 0)} distribuidoras`);
    expect(t).toContain(`Ficaram fora ${num(sem.length, 0)}`);
    const b = bloco('data-ressalva-sociedade="tarifa"');
    expect(b).toContain(`${num(ctx.tarifa!.comTarifa, 0)} distribuidoras`);
    // o cartão mostra R$/kWh e diz que é o mesmo valor que a página Conta de luz traz em R$/MWh
    expect(b).toContain("R$/MWh");
  });

  it("a EAR do SIN é arredondada uma só vez: cartão, gráfico, tabela e arquivo leem a mesma célula", () => {
    const serie = new Map(csv("public/energia/series/ear_diario.csv").map((l) => [l.data, Number(l.SIN_calculado)]));
    const { leves, m } = determinantesDaPagina(M, ctx.earSin, ctx.bandasAgua, ctx.medianaAgua.base);
    const linhas = linhasDeColunas(leves.campos, leves.linhas);
    let trocadas = 0;
    let comEar = 0;
    for (const l of M.dados) {
      const x = serie.get(l.d);
      if (typeof l.agua_SIN !== "number" || x === undefined) continue;
      comEar++;
      // o defeito que a correção remove: arredondar 61,6473 a 61,65 e depois a 61,7
      if (num(l.agua_SIN, 1) !== num(x, 1)) trocadas++;
      const linha = linhas.find((r) => r.d === l.d)!;
      expect(num(linha.agua_SIN as number, 1), l.d).toBe(num(x, 1));
    }
    expect(comEar).toBeGreaterThan(60);
    expect(trocadas).toBeGreaterThan(0);
    // o cartão e a tabela do dia de referência mostram o mesmo texto, na casa exibida
    const agua = leves.paineis.find((p) => p.id === "agua")!;
    const doDia = linhas.find((r) => r.d === agua.dataReferencia)!;
    expect(agua.valorTexto).toBe(comUnidade(doDia.agua_SIN as number, agua.unidade, agua.casas));
    expect(html).toContain(`data-valor-atual="agua">${agua.valorTexto}`);
    // o gráfico (e a dica e o anúncio por teclado) recebe as mesmas linhas
    const painel = m.paineis.find((p) => p.id === "agua")!;
    const grafico = dadosDeterminante(agua, linhas, leves.extras.agua ?? []);
    expect(grafico.find((r) => r.d === agua.dataReferencia)!.agua_SIN).toBe(doDia.agua_SIN);
    expect(valorDoDiaNaSerie(painel, linhas)).toBe(doDia.agua_SIN);
  });

  it("a mediana da data da água é uma série desenhada, copiada de hidrologia.json, e a tabela a traz", () => {
    const { leves } = determinantesDaPagina(M, ctx.earSin, ctx.bandasAgua, ctx.medianaAgua.base);
    const linhas = linhasDeColunas(leves.campos, leves.linhas);
    expect(leves.extras.agua?.[0].id).toBe("agua_p50");
    expect(leves.colunasTabela.some((c) => c.id === "agua_p50")).toBe(true);
    const dia = linhas[linhas.length - 1].d as string;
    const md = dia.slice(5, 10);
    const banda = HID.bandas_ear.find((b) => String(b.md) === md)!;
    expect(linhas[linhas.length - 1].agua_p50).toBe((banda as unknown as { SIN_p50: number }).SIN_p50);
    expect(seriesDeterminante({ id: "agua", colunas: leves.paineis[1].colunas, referencia: leves.paineis[1].referencia }, leves.extras.agua).some((x) => x.id === "agua_p50" && x.tracejada)).toBe(true);
  });

  it("o período dos determinantes segue a janela escolhida", () => {
    const { leves } = determinantesDaPagina(M, ctx.earSin, ctx.bandasAgua, ctx.medianaAgua.base);
    const todas = linhasDeColunas(leves.campos, leves.linhas);
    const t30 = periodoDaJanela(todas.slice(-30));
    const t90 = periodoDaJanela(todas);
    expect(t30).toContain("30 dias");
    expect(t90).toContain("90 dias");
    expect(t30).toContain(dataBR30(todas.slice(-30)[0].d as string));
    expect(t30).not.toBe(t90);
  });

  it("a tabela de episódios diz quantos episódios lista e quantos existem", () => {
    const c = corteEpisodios(G.observar, G.historico_regras.inicio);
    const listados = G.observar.reduce((s, o) => s + (o.historico?.ultimos_episodios.length ?? 0), 0);
    const total = G.observar.reduce((s, o) => s + (o.historico?.episodios ?? 0), 0);
    expect(c.listados).toBe(listados);
    expect(c.total).toBe(total);
    if (listados < total) expect(c.texto).toContain(`${num(listados, 0)} dos ${num(total, 0)} registrados`);
    expect(ler("src/components/energia/VisaoTabelasSobDemanda.tsx")).toContain("corteEpisodios(g.observar, g.historico_regras.inicio)");
  });

  it("a regra do piso do PLD diz 'alerta com 24 horas', e não 'acima de 24 horas'", () => {
    const regra = G.observar.find((o) => o.id === "pld_piso")!;
    const t = textoValorRegra(regra)!;
    expect(t).toContain("alerta com 24 horas");
    expect(t).not.toContain("acima de 24");
    const teto = G.observar.find((o) => o.id === "pld_teto")!;
    expect(textoValorRegra(teto)!).toContain("alerta acima de");
  });

  it("a rede diz que o fluxo é o saldo líquido do dia e quantas horas foram contra o saldo, relidas de rede_detalhe.json", () => {
    const r = JSON.parse(ler("public/energia/gold/rede_detalhe.json"));
    const d = r.circulacao.diario;
    const dia = M.paineis.find((p) => p.id === "rede")!.data_referencia;
    const i = d.dias.indexOf(dia);
    const sul = d.por_par.S_SE;
    const contra = sul.liquido_mwh[i] >= 0 ? sul.horas_inverso[i] : sul.horas[i] - sul.horas_inverso[i];
    expect(ctx.saldoRede).toContain(`Sul → Sudeste/Centro-Oeste, ${num(contra, 0)} de ${num(sul.horas[i], 0)}`);
    expect(ctx.saldoRede).toContain("Saldo líquido do dia");
    const rede = leituraDeterminante(M.paineis.find((p) => p.id === "rede")!, M);
    expect(rede).toContain("saldo líquido do dia");
    expect(html).toContain('data-nota-determinante="rede"');
  });

  it("siglas no primeiro uso e valores de enumeração em palavras comuns", () => {
    const t = expandeSiglas("o conjunto SCS está atrasado; o SCS segue", ["SCS"]);
    expect(t).toContain("SCS (Sistema de Controle de Subvenções e Programas Sociais) está atrasado");
    expect(t.match(/Sistema de Controle de Subvenções/g)).toHaveLength(1);
    expect(expandeSiglas(t, ["SCS"])).toBe(t);
    const e = texto(html);
    expect(e).not.toMatch(/\bATRASADO\b|\bEM DIA\b/);
    expect(e).toContain("Alcance da Tarifa Social, mai/2025");
  });

  it("o topo cita as regras em observação, a frase leva a marca da regra e as regras normais ficam recolhidas", () => {
    const obs = G.observar.filter((o) => o.tipo !== "evento" && o.estado === "em_observacao");
    expect(obs.length).toBeGreaterThan(0);
    const topo = bloco("data-atencao");
    for (const o of obs) {
      expect(topo).toContain(o.titulo);
      expect(html).toContain(`href="#regra-${o.id}"`);
    }
    expect(html).toContain('data-marca-regra="ena_faixa"');
    expect(html).toContain("data-regras-normais");
    // a ligação entre as partes (da geração ao consumidor) fica à vista na abertura, e o bloco recolhido "Por que isso importa" saiu dos painéis
    expect(html).toContain("mapa do sistema");
    expect(html).toContain('href="/setor-eletrico#mapa-conceitual"');
    expect(html).not.toContain("data-por-que-importa");
  });
});

/** Data dd/mm/aaaa de uma data ISO, para conferir o texto do período sem depender da função do módulo. */
function dataBR30(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

/* ---------- r2: landmarks únicos, "O que mudou" sem repetir a abertura, um critério por número e o universo do DEC conciliado ---------- */

describe("r2: Visão geral", () => {
  const html = renderToStaticMarkup(createElement(PaginaVisaoGeral));
  const ctx = contextoVisao(G);
  const texto = (h: string) => h.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");
  const T = texto(html);
  const q = JSON.parse(ler("public/energia/gold/qualidade.json"));

  it("as 12 regiões 'O que mudou', 'Como interpretar' e 'O que não é possível concluir' têm nome único: cada uma leva a pergunta do painel (axe landmark-unique)", () => {
    const rotulos = Array.from(html.matchAll(/aria-label="(O que mudou|Como interpretar|O que não é possível concluir)(: [^"]*)?"/g)).map((m) => m[0]);
    expect(rotulos).toHaveLength(12);
    expect(new Set(rotulos).size).toBe(12);
    for (const p of PAINEIS_VISAO) {
      for (const base of ["O que mudou", "Como interpretar", "O que não é possível concluir"]) expect(html, `${base} ${p.id}`).toContain(`aria-label="${base}: ${p.pergunta}"`);
    }
  });

  it("'O que mudou' de Determinantes e de Regras não repete a frase de abertura do painel", () => {
    const m = G.multiplos!;
    const mudou = textoMudouDeterminantes(m);
    expect(mudou).not.toBe(vereditoDeterminantes(m));
    expect(mudou).toContain("Os gráficos cobrem");
    for (const p of m.paineis) expect(mudou).toContain(dataBR30(p.data_referencia));
    // a abertura do painel (o veredito) aparece uma vez só, e o "O que mudou" traz o período dos gráficos
    expect(T.split(vereditoDeterminantes(m)).length - 1).toBe(1);
    expect(T.split(respostaObservar(G.observar)).length - 1).toBe(1);
    expect(T).toContain("Sem comparação com a publicação anterior nesta página");
  });

  it("a abertura traz a razão numa frase, o caminho da geração ao consumidor à vista e a linha 'Não permite concluir'; o bloco recolhido saiu dos quatro painéis", () => {
    expect(html).toContain('data-limite=""');
    expect(T).toContain("Não permite concluir Alinhar as medidas pelo calendário não diz que uma determina a outra");
    expect(T).toContain("no mesmo calendário, cada um com a data da sua fonte");
    expect(T).toMatch(/A ligação entre essas partes, da geração ao consumidor, está no mapa do sistema\s*\./);
    expect(html).not.toContain("data-por-que-importa");
    expect(T).not.toContain("Por que isso importa");
  });

  it("Preço: o Norte é tracejado para não esconder o Sudeste/Centro-Oeste; Rede: as fronteiras alternam o traço e têm rótulo direto", () => {
    const d = determinantesDaPagina(G.multiplos!, ctx.earSin, ctx.bandasAgua, ctx.medianaAgua.base);
    const preco = d.leves.paineis.find((p) => p.id === "preco")!;
    const sp = seriesDeterminante(preco);
    expect(sp.find((x) => x.id === "preco_N")!.tracejada).toBe(true);
    for (const x of sp.filter((x) => x.id !== "preco_N" && x.id.startsWith("preco_"))) expect(x.tracejada, x.id).toBeFalsy();
    const rede = d.leves.paineis.find((p) => p.id === "rede")!;
    const sr = seriesDeterminante(rede).slice(0, rede.colunas.length);
    sr.forEach((x, i) => expect(Boolean(x.tracejada), x.id).toBe(i % 2 === 1));
    expect(T).toContain("a do Norte é tracejada para a do Sudeste/Centro-Oeste continuar visível");
    expect(ler("src/components/energia/VisaoDeterminantes.tsx")).toContain('rotulosDiretos={p.id === "rede"}');
  });

  it("DEC: as 102 distribuidoras que enviaram, as 98 com os 12 meses e os 3.146 conjuntos se conciliam, e as de ano parcial são nomeadas", () => {
    const ano = ctx.dec!.ano;
    const ds = (q.distribuidoras as { sigla: string; ano: number; meses: number; conjuntos: number }[]).filter((x) => x.ano === ano);
    const anuais = ds.filter((x) => x.meses >= 12);
    const parciais = ds.filter((x) => x.meses < 12);
    const u = ctx.dec!.universo!;
    expect(u.distribuidoras).toBe(ds.length);
    expect(u.anuais).toBe(anuais.length);
    expect(u.parciais.map((x) => x.sigla).sort()).toEqual(parciais.map((x) => x.sigla).sort());
    expect(u.conjuntosAnuais).toBe(anuais.reduce((a, x) => a + x.conjuntos, 0));
    // os conjuntos das distribuidoras de ano completo são os que têm limite: a conta de 810 de 3.146 usa esses
    expect(u.conjuntosAnuais).toBe(q.conjuntos.com_limite);
    const t = textoUniversoDec(ctx.dec!);
    expect(t).toContain(`${num(ds.length, 0)} distribuidoras enviaram DEC`);
    expect(t).toContain(`${num(anuais.length, 0)} têm os 12 meses`);
    expect(t).toContain(`${num(u.conjuntosAnuais, 0)} conjuntos`);
    for (const x of parciais) expect(t).toContain(`${x.sigla} (${x.meses} meses)`);
    expect(T).toContain(t);
  });

  it("Carga: o destaque é de um dia e as janelas de 7 dias, 28 dias e 52 semanas vêm com o mesmo critério; o outro critério (mesmas datas) vem explicado", () => {
    const c = JSON.parse(ler("public/energia/gold/carga_detalhe.json"));
    const sin = c.p025.comparacoes.subsistemas.find((x: { sm: string }) => x.sm === "SIN").janelas;
    const f = (v: number) => `${num(Math.abs(v), 1)}% ${v >= 0 ? "acima" : "abaixo"}`;
    expect(T).toContain("O destaque compara um dia.");
    expect(T).toContain(`7 dias ${f(sin["7d"].equivalente.variacao_pct)}`);
    expect(T).toContain(`28 dias ${f(sin["28d"].equivalente.variacao_pct)}`);
    expect(T).toContain(`52 semanas ${f(sin["52_semanas"].equivalente.variacao_pct)}`);
    expect(T).toContain(`Com as mesmas datas do ano anterior, em vez do mesmo dia da semana, os 7 dias ficam em ${f(sin["7d"].mesmas_datas.variacao_pct)}`);
    expect(ctx.cargaJanelas).toMatchObject({ semana7: sin["7d"].equivalente.variacao_pct, dias28: sin["28d"].equivalente.variacao_pct, semanas52: sin["52_semanas"].equivalente.variacao_pct });
  });

  it("Geração: a faixa térmica diz que são 365 janelas de 7 dias que terminam de 7 a 371 dias antes e não se sobrepõem à atual", () => {
    const t = ctx.termica!;
    const dia = G.multiplos!.paineis.find((p) => p.id === "geracao")!.data_referencia;
    const txt = textoJanelaTermica({ p10: t.p10, p90: t.p90 }, dia);
    expect(txt).toContain("365 janelas de 7 dias");
    expect(txt).toContain("de 7 a 371 dias antes do dia de referência");
    expect(txt).toContain(`entre ${dataBR30(somaDias(dia, -371))} e ${dataBR30(somaDias(dia, -7))}`);
    expect(txt).toContain("sem sobreposição com a janela de 7 dias que termina no dia de referência");
    expect(T).toContain(txt);
    expect(T).not.toContain("Faixa dos 365 dias anteriores");
  });

  it("CMO: a natureza do dado (resultado de modelo, não previsão) fica à vista na regra do calendário", () => {
    expect(T).toContain("Resultado de modelo do ONS (DECOMP), não previsão da Scrutiniums.");
  });

  it("os dois CSV de Regras mostram o estado da validação junto do link; o 'reprovado' de uma versão anterior vem explicado sem tocar na publicação", () => {
    expect(html).toContain('data-arquivo="/energia/series/sintese_regras_diario.csv"');
    expect(T).toContain("Arquivos para baixar e o estado de cada um");
    expect(html).toContain('data-estado-arquivo="reprovado"');
    expect(T).toContain("Validação automática: reprovada na versão de");
    expect(T).toContain("o arquivo publicado é outra versão");
    expect(T).toContain("Relido como CSV, o arquivo publicado tem");
  });

  it("o CSV do painel diz o que não traz, e a mediana de tarifa diz que é simples e que muda com o conjunto do arquivo", () => {
    expect(T).toContain("não traz a mediana da água nem as faixas de referência do gráfico");
    expect(textoCoberturaTarifa(ctx.tarifa!)).toContain("A mediana é simples (cada distribuidora pesa o mesmo");
    expect(T).toContain("a tabela de quartis de Minha região traz também a mediana pesada pelas unidades consumidoras");
  });

  it("o código interno do painel (P004 a P007) não aparece em nenhum nível", () => {
    expect(html).not.toMatch(/data-nivel="analisar"[^>]*>\s*P00[4-7]\s*</);
  });
});
