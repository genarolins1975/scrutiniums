import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PaginaVisaoGeral from "@/app/setor-eletrico/visao-geral/page";
import { carregaJson, lerCaminho } from "@/lib/energia/carregaJson";
import { ANCORAS_VISAO_GERAL } from "@/lib/energia/mapa";
import type { CargaGold, GeracaoGold, HidrologiaGold, PldGold, RedeGold } from "@/lib/energia/tipos";
import type { PainelDeterminante, RegraObservar, SinteseVisaoGold } from "@/lib/energia/tipos-visao";
import {
  ANCORAS_DETERMINANTES,
  PAINEIS_VISAO,
  ROTULO_FRASE,
  casasUnidade,
  colunasMultiplos,
  datasLegiveis,
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
    expect(datasLegiveis("snapshot ear_subsistema_di@2026-09-30T02:19:44Z")).toBe("snapshot ear_subsistema_di@2026-09-30T02:19:44Z");
    expect(datasLegiveis("PREVISÃO emitida em 2026-09-30T00:00Z (inicialização do modelo)")).toBe("PREVISÃO emitida em 30/09/2026 00:00 UTC (inicialização do modelo)");
    expect(datasLegiveis("das 2026-09-30T02:20 às 2026-10-01T06:40:15")).toBe("das 30/09/2026 02:20 às 01/10/2026 06:40");
    expect(datasLegiveis("arquivo ear_2026-09-30.csv")).toBe("arquivo ear_2026-09-30.csv");
    expect(datasLegiveis("sem data aqui")).toBe("sem data aqui");
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
      for (const x of s) expect(x.cor).toMatch(/^var\(--/);
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
    expect(html).toContain("Como ler");
    expect(html).toContain("O que não permite concluir");
    expect(html).toContain("Copiar link deste painel");
    expect(html).toContain("Próxima pergunta");
    expect(html).toContain("Baixar os dados deste painel");
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
