import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import CurtailmentPage from "@/app/setor-eletrico/geracao/curtailment/page";
import { LabMeiaHora, LabReceita, LabValorPerdido, SimuladorDia } from "@/components/energia/CurtailmentLabs";
import {
  CENARIOS_DIA,
  PARAMETROS_INICIAIS,
  RENDIMENTO_BATERIA,
  escalaNacional,
  formasDoDia,
  horasNoMenorValor,
  meiaHora,
  perfilEmGw,
  razoesPresentes,
  receitaDoCorte,
  serieDiariaPorRazao,
  serieEssConstrainedOff,
  serieMensalPorRazao,
  simularDia,
  ufsContraEnergia,
} from "@/lib/energia/curtailment";
import type { GeracaoGold, PldGold } from "@/lib/energia/tipos";
import type { GoldGeracaoDetalhe } from "@/lib/energia/tipos-geracao";
import type { MercadoGold } from "@/lib/energia/tipos-mercado";

/**
 * Seção Curtailment: as derivações copiam a gold (só unidade e contagem), o simulador fecha o balanço de cada hora e cada cenário diz a
 * verdade sobre o próprio resultado, e a página traz as seções, os laboratórios e o efeito para o setor sem número digitado no código.
 */
const raiz = process.cwd();
const ler = <T,>(f: string): T => JSON.parse(readFileSync(join(raiz, "public/energia/gold", f), "utf-8"));
const D = ler<GoldGeracaoDetalhe>("geracao_detalhe.json");
const G = ler<GeracaoGold>("geracao.json");
const P = ler<PldGold>("pld.json");
const M = ler<MercadoGold>("mercado.json");
const formas = formasDoDia(perfilEmGw(G.perfil_horario_sin))!;
const simular = (m = {}) => simularDia({ ...PARAMETROS_INICIAIS, ...m }, formas);
const cenario = (id: string) => simular(CENARIOS_DIA.find((c) => c.id === id)!.mudanca);

describe("curtailment: dados publicados", () => {
  it("série mensal e diária copiam a gold por razão, em GWh, e marcam o mês parcial", () => {
    for (const f of ["eolica", "solar"] as const) {
      const r = D.restricoes[f]!;
      const m = serieMensalPorRazao(r);
      expect(m).toHaveLength(r.mensal_sin.meses.length);
      m.forEach((l, i) => {
        for (const z of ["ENE", "CNF", "REL"] as const) expect(l[z], `${f} ${l.mes} ${z}`).toBe(r.mensal_sin.energia_nao_gerada_mwh[z][i]! / 1e3);
        expect(l.taxa).toBe(r.mensal_sin.taxa_pct[i]);
        expect(l.rotulo.includes("parcial")).toBe(!!r.mensal_sin.parcial[i]);
      });
      const d = serieDiariaPorRazao(r);
      expect(d).toHaveLength(r.diario_recente.dias.length);
      expect(d.at(-1)!.ENE).toBe(r.diario_recente.energia_nao_gerada_mwh.ENE.at(-1)! / 1e3);
      // razão sem energia em nenhum mês não vira série
      expect(razoesPresentes(m)).not.toContain("PAR");
    }
  });

  it("horas no menor valor do ano: contagem por hora, conferida linha a linha", () => {
    const menor = P.cartoes.find((c) => c.sm === "NE")!.menor_valor_ano;
    const r = horasNoMenorValor(P.horario_30d, "NE", menor);
    expect(r.linhas).toHaveLength(24);
    const meioDia = P.horario_30d.filter((x) => x.t.endsWith("12:00") && Math.abs((x.NE as number) - menor) < 0.005).length;
    expect(r.linhas[12].dias).toBe(meioDia);
    expect(r.linhas.reduce((s, l) => s + l.comDado, 0)).toBe(P.horario_30d.filter((x) => typeof x.NE === "number").length);
    expect(horasNoMenorValor(P.horario_30d, "NE", null).linhas).toHaveLength(0);
  });

  it("escala nacional: só compara com o consumo quando as janelas coincidem", () => {
    const consumo = M.livre_regulado.kpis.consumo_livre_12m!;
    const e = escalaNacional(D.restricoes, consumo)!;
    const soma = (D.restricoes.eolica!.ultimos_12m!.energia_nao_gerada_mwh! + D.restricoes.solar!.ultimos_12m!.energia_nao_gerada_mwh!) / 1e6;
    expect(e.cortadaTwh).toBeCloseTo(soma, 9);
    expect(e.mesmaJanela).toBe(consumo.periodo.inicio === e.inicio && consumo.periodo.fim === e.fim);
    if (e.mesmaJanela) expect(e.proporcaoPct).toBeCloseTo((100 * soma) / (consumo.total_mwh / 1e6), 9);
    const outra = escalaNacional(D.restricoes, { ...consumo, periodo: { inicio: "2020-01", fim: "2020-12" } })!;
    expect(outra.proporcaoPct).toBeNull();
  });

  it("UFs contra a energia não gerada: consumo = cativo + livre, UF sem janela fora", () => {
    const u = ufsContraEnergia(M.livre_regulado.epe_uf_12m, 41.3);
    expect(u.linhas.map((x) => x.uf)).not.toContain("RR");
    expect(u.acima.length + u.abaixo.length).toBe(u.linhas.length);
    for (const x of u.acima) expect(x.twh).toBeGreaterThan(41.3);
  });

  it("encargo de constrained-off: valor da CCEE em R$ milhões, como publicado", () => {
    const s = serieEssConstrainedOff(M.encargos.ess_mensal);
    expect(s).toHaveLength(M.encargos.ess_mensal.length);
    expect(s.at(-1)!.valor).toBe((M.encargos.ess_mensal.at(-1)!.ro_constrained_off as number) / 1e6);
  });
});

describe("curtailment: modelos didáticos", () => {
  it("meia hora: só a limitação do ONS entra na conta, e MWh = MW × 0,5", () => {
    expect(meiaHora(120, 70, true, 0)).toEqual({ verificadaMw: 70, naoGeradaMw: 50, naoGeradaMwh: 25, contada: true });
    expect(meiaHora(120, 150, true, 0).naoGeradaMw).toBe(0);
    const sem = meiaHora(120, 0, false, 80);
    expect(sem.contada).toBe(false);
    expect(sem.naoGeradaMwh).toBe(0);
    expect(sem.verificadaMw).toBe(80);
  });

  it("um dia: balanço fechado em todas as horas e cenários", () => {
    for (const c of CENARIOS_DIA) {
      const r = simular(c.mudanca);
      for (const h of r.horas) {
        expect(h.sincrona + h.renovavelUsada + h.bateriaDescarga, `${c.id} ${h.hora} demanda`).toBeCloseTo(h.demanda, 2);
        expect(h.renovavelUsada + h.bateriaCarga + h.ENE + h.CNF + h.REL, `${c.id} ${h.hora} recurso`).toBeCloseTo(h.disponivel, 2);
        for (const k of ["ENE", "CNF", "REL", "bateriaCarga", "bateriaDescarga", "sincrona"] as const) expect(h[k]).toBeGreaterThanOrEqual(-1e-9);
      }
      expect(r.taxaPct).toBeGreaterThanOrEqual(0);
      expect(r.taxaPct).toBeLessThanOrEqual(100);
    }
  });

  it("o ponto de partida tem corte pelas três razões", () => {
    const r = simular();
    expect(r.porRazaoGwh.ENE).toBeGreaterThan(0);
    expect(r.porRazaoGwh.CNF).toBeGreaterThan(0);
    expect(r.porRazaoGwh.REL).toBeGreaterThan(0);
  });

  it("cada cenário faz o que a explicação diz", () => {
    const base = simular();
    const t = cenario("transmissao");
    expect(t.porRazaoGwh.REL).toBe(0);
    expect(t.cortadaGwh).toBeCloseTo(base.cortadaGwh, 0);
    const b = cenario("bateria");
    expect(b.cortadaGwh).toBeLessThan(base.cortadaGwh);
    expect(b.bateriaDevolvidaGwh).toBeCloseTo(b.bateriaCarregadaGwh * RENDIMENTO_BATERIA, 1);
    expect(cenario("domingo").porRazaoGwh.ENE).toBeGreaterThan(base.porRazaoGwh.ENE);
    expect(cenario("seguranca").porRazaoGwh.CNF).toBeGreaterThan(base.porRazaoGwh.CNF);
    const fl = cenario("flexivel");
    expect(fl.porRazaoGwh.ENE).toBeLessThan(base.porRazaoGwh.ENE);
    expect(fl.cortadaGwh).toBeCloseTo(base.cortadaGwh, 0);
    const s = cenario("solar");
    expect((s.cortadaGwh - base.cortadaGwh) / (s.disponivelGwh - base.disponivelGwh)).toBeGreaterThan(0.8);
  });

  it("sem renovável não há corte; sem exigência e com escoamento farto, só o corte energético", () => {
    expect(simular({ eolicaPicoGw: 0, solarPicoGw: 0 }).cortadaGwh).toBe(0);
    const r = simular({ exigenciaSincronaPct: 0, escoamentoGw: 60 });
    expect(r.porRazaoGwh.CNF).toBe(0);
    expect(r.porRazaoGwh.REL).toBe(0);
  });

  it("quem gera: conta do ano com a energia cortada valorada nos dois preços", () => {
    const r = receitaDoCorte({ potenciaMw: 100, fatorCapacidadePct: 50, taxaCortePct: 20, parcelaEletricaPct: 10, precoContrato: 200, pldNasHorasDeCorte: 60 });
    expect(r.possivelMwh).toBe(438000);
    expect(r.cortadaMwh).toBeCloseTo(87600, 6);
    expect(r.eletricaMwh).toBeCloseTo(8760, 6);
    expect(r.valorContrato).toBeCloseTo(87600 * 200, 3);
    expect(r.valorPld).toBeCloseTo(87600 * 60, 3);
  });

  it("os laboratórios renderizam no servidor com controles rotulados e o aviso de modelo", () => {
    const h = [
      renderToStaticMarkup(createElement(LabMeiaHora)),
      renderToStaticMarkup(createElement(SimuladorDia, { formas, diaReferencia: "28/09/2026" })),
      renderToStaticMarkup(createElement(LabReceita, { padroes: [{ fonte: "eolica", rotulo: "Eólicas", taxaPct: 21.3, parcelaEletricaPct: 8.6, periodo: "set/2025 a ago/2026" }], pld: 57.31, pldNota: "nota" })),
      renderToStaticMarkup(createElement(LabValorPerdido, { cortadaTwh: 41.3, periodo: "set/2025 a ago/2026", pldMenor: 57.31, pldNota: "nota" })),
    ].join("");
    expect(h.match(/Modelo didático/g)?.length).toBe(3);
    expect(h).toContain("Fica de fora deste laboratório");
    expect(h.match(/type="range"/g)!.length).toBeGreaterThan(15);
    expect(h).not.toMatch(/NaN|undefined|\[object Object\]/);
  });
});

describe("curtailment: a página", () => {
  const h = renderToStaticMarkup(createElement(CurtailmentPage));
  const texto = h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").replace(/&#x27;/g, "'");

  it("traz as seções, os quatro laboratórios e a navegação de geração com a seção marcada", () => {
    for (const id of ["o-que-e", "por-que", "meio-dia", "tamanho", "ultimos-dias", "efeito", "respostas", "descricoes", "regras-curtailment"]) expect(h, id).toContain(`id="${id}"`);
    for (const lab of ["lab-meia-hora", "lab-dia", "lab-valor", "lab-receita"]) expect(h, lab).toContain(`data-laboratorio="${lab}"`);
    expect(h).toMatch(/aria-current="page"[^>]*>[\s\S]{0,200}Curtailment|href="\/setor-eletrico\/geracao\/curtailment"[^>]*aria-current="page"/);
    expect(h).toContain('data-nivel="analisar"');
    expect(h).toContain('data-nivel="auditar"');
  });

  it("efeito para o setor: escala, UFs, encargo e quem arca, com as ressalvas", () => {
    expect(texto).toContain("O efeito para o setor e para a sociedade");
    expect(texto).toContain("ordem de grandeza");
    expect(texto).toMatch(/supera o consumo na rede de \d+ das \d+ UFs com dado/);
    expect(texto).toContain("O conjunto da CCEE não separa o constrained-off por fonte");
    expect(texto).toContain("o observatório não estimou se o corte mudou a geração térmica");
  });

  it("sem valor de reserva, sem data crua, causalidade só negada e abaixo do peso", () => {
    expect(h).not.toMatch(/NaN|undefined|\[object Object\]/);
    expect(texto).not.toMatch(/(^|[\s(])20\d\d[-/]\d\d([-/]\d\d)?(T[\d:]+Z?)?(?=[\s).,;]|$)/);
    for (const m of Array.from(texto.matchAll(/caus\w*/gi))) {
      const ctx = texto.slice(Math.max(0, m.index! - 80), m.index! + 20).toLowerCase();
      expect(/nunca|não|nenhuma|sem /.test(ctx), ctx).toBe(true);
    }
    expect(Buffer.byteLength(h, "utf-8")).toBeLessThan(400 * 1024);
  });

  it("nenhum número publicado fica digitado no código da página", () => {
    const fonte = readFileSync(join(raiz, "src/app/setor-eletrico/geracao/curtailment/page.tsx"), "utf-8");
    expect(fonte).not.toMatch(/28[.,]9|12[.,]4|41[.,]3|21[.,]3|25[.,]7|57[.,]31|574/);
  });
});
