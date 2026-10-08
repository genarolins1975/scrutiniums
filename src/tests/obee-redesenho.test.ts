import { describe, expect, it } from "vitest";
import { dadosPainel, goldEducacao } from "@/lib/eficiencia/dados";
import { Indice, MEDIDA, MEDIDAS, anosDaMedida, comparar } from "@/lib/eficiencia/consulta";
import { contextos } from "@/lib/eficiencia/contexto";
import { montaPanorama } from "@/lib/eficiencia/panorama";
import { CAMINHO_COMPARAR, CAMINHO_METODOS, DEFINICAO_TEMA, ROTULO_NAVEGACAO, ROTA_BASE, TEMAS, anoValido, etapaEfetiva, href, hrefTema, temaDaMedida } from "@/lib/eficiencia/visao";

const g = goldEducacao()!;
const d = dadosPainel(g);
const ix = new Indice(d);
const panorama = montaPanorama(d, ix);
const PROIBIDAS = /\b(eficiente|ineficiente|desperd|melhor|pior|gasta demais|gestão|ranking|meta|ideal|bom|ruim|melhorou|piorou)\b/i;

describe("arquitetura de navegação", () => {
  it("quatro visões temáticas na ordem pedida, mais comparar e métodos como ações", () => {
    expect(ROTULO_NAVEGACAO.map((a) => a.rotulo)).toEqual(["Panorama", "Gastos", "Atendimento", "Resultados"]);
    expect(CAMINHO_COMPARAR).toBe("/comparar");
    expect(CAMINHO_METODOS).toBe("/metodos");
  });

  it("todas as medidas do painel pertencem a um tema: nenhum indicador some do explorador", () => {
    const nosTemas = TEMAS.flatMap((t) => DEFINICAO_TEMA[t].medidas);
    expect(new Set(nosTemas)).toEqual(new Set(MEDIDAS));
    expect(nosTemas).toHaveLength(MEDIDAS.length);
    for (const m of MEDIDAS) expect(DEFINICAO_TEMA[temaDaMedida(m)].medidas).toContain(m);
  });

  it("gastos tem as três escalas e cada tema abre por uma medida normalizada", () => {
    expect(DEFINICAO_TEMA.gastos.medidas).toEqual(["despesa", "despesa_hab", "despesa_mat"]);
    expect(DEFINICAO_TEMA.gastos.medidaInicial).toBe("despesa_hab");
  });

  it("links: só parâmetros que não valem o padrão, sem valores vazios, e a rota base nunca muda", () => {
    expect(href("")).toBe(ROTA_BASE);
    expect(hrefTema("gastos", { med: "despesa_mat", cap: "recife", ano: undefined, etapa: "" })).toBe(`${ROTA_BASE}/gastos?med=despesa_mat&cap=recife`);
  });

  it("ano e etapa efetivos nunca inventam um período ou uma etapa sem dado", () => {
    expect(anoValido(d, "ideb", 2024)).toBe(2023);
    expect(anoValido(d, "ideb", 2025)).toBe(2025);
    expect(anoValido(d, "atu", 1999)).toBe(anosDaMedida(d, "atu")[0]);
    expect(etapaEfetiva("ideb", "creche", "anos_iniciais")).toBe("anos_iniciais");
    expect(etapaEfetiva("atu", "creche", "anos_iniciais")).toBe("creche");
    expect(etapaEfetiva("despesa_hab", "creche", "anos_iniciais")).toBe("creche");
  });
});

describe("panorama editorial", () => {
  it("três capítulos, na ordem: gasto, atendimento e resultados, cada um com uma medida normalizada", () => {
    expect(panorama.map((c) => c.id)).toEqual(["gastos", "atendimento", "resultados"]);
    expect(panorama.map((c) => c.medida)).toEqual(["despesa_hab", "atu", "ideb"]);
    expect(panorama.map((c) => c.pergunta)).toEqual(["Quanto se gasta?", "Quem é atendido?", "Quais resultados são observados?"]);
  });

  it("nenhuma capital vem selecionada: o panorama não carrega uma capital como padrão", () => {
    for (const c of panorama) expect(JSON.stringify(c)).not.toMatch(/"selecionada"|"destacada"/);
    expect(panorama.every((c) => c.pontos.length > 1)).toBe(true);
  });

  it("os pontos do capítulo são exatamente os elegíveis da comparação, com os valores da gold", () => {
    for (const c of panorama) {
      const comp = comparar(ix, c.medida, c.ano, c.etapa ?? "anos_iniciais", "nominal", c.disciplina, "todas", d.capitais[0], "alfabetica");
      expect(c.pontos.map((p) => [p.cod, p.valor])).toEqual(comp.incluidas.map((i) => [i.cap.cod, i.valor]));
      expect(c.universo).toBe(26);
      expect(c.pontos.length + c.semDado.length).toBe(26);
    }
    // contra a gold crua: despesa por habitante de 2025, elegível e observada
    const cru = g.observacoes.filter((o) => o.indicador === "edu.despesa.por_habitante" && o.ano === panorama[0].ano && o.componente === "nominal" && o.status === "OBSERVADO" && o.elegivel_comparacao);
    expect(panorama[0].pontos.map((p) => p.valor).sort((a, b) => a - b)).toEqual(cru.map((o) => Number(o.valor!.toPrecision(12))).sort((a, b) => a - b));
  });

  it("título factual: amplitude do próprio conjunto, extremos nomeados, sem juízo e sem meta", () => {
    for (const c of panorama) {
      const vs = c.pontos.map((p) => p.valor);
      expect(c.referencia?.minimo).toBe(Math.min(...vs));
      expect(c.referencia?.maximo).toBe(Math.max(...vs));
      expect(c.titulo).toMatch(/vai de .+ em .+ a .+ em .+ entre as 26 capitais com dado comparável/);
      expect(c.titulo).not.toMatch(PROIBIDAS);
      expect(c.subtitulo).not.toMatch(PROIBIDAS);
      expect(c.cobertura).toBe("Há dados comparáveis para as 26 capitais.");
    }
  });

  it("referência externa junto do capítulo só quando válida: INEP do mesmo universo ou cálculo do OBEE com origem declarada", () => {
    const [gasto, atend, result] = panorama;
    expect(gasto.externas.map((e) => e.classe)).toEqual(["calculada"]);
    expect(gasto.externas[0].texto).toContain("Cálculo do OBEE com dados do Siconfi/STN e do IBGE");
    expect(atend.externas.map((e) => e.classe)).toEqual(["oficial"]);
    expect(result.externas.map((e) => e.classe)).toEqual(["oficial"]);
    for (const c of panorama) for (const e of c.externas) expect(e.escopo.length).toBeGreaterThan(20);
  });

  it("cada capítulo leva a uma visão de aprofundamento com a medida e o ano do capítulo", () => {
    for (const c of panorama) {
      expect(c.aprofunda.params.med).toBe(c.medida);
      expect(c.aprofunda.params.ano).toBe(String(c.ano));
      expect(anosDaMedida(d, c.medida)).toContain(c.ano);
    }
  });

  it("todas as medidas do painel têm ficha e contexto para o 'Sobre este dado'", () => {
    const ctx = contextos(g);
    for (const m of MEDIDAS) {
      expect(d.fichas.some((f) => f.id === MEDIDA[m].indicador)).toBe(true);
      expect(ctx[MEDIDA[m].indicador]).toBeDefined();
    }
    for (const id of ["edu.despesa.ponte_matricula", "edu.despesa.subfuncao"]) expect(ctx[id]).toBeDefined();
  });
});

describe("payload por tema", () => {
  const temas = ["gastos", "atendimento", "resultados"] as const;
  it("o comparador leva a tabela completa idêntica, sem a ponte nem a composição", async () => {
    const { dadosPainelTema } = await import("@/lib/eficiencia/dados");
    const { tabelaComparativa } = await import("@/lib/eficiencia/consulta");
    const dc = dadosPainelTema(g, "comparar");
    const ixc = new Indice(dc);
    expect(JSON.stringify(dc).length).toBeLessThan(JSON.stringify(d).length * 0.85);
    for (const [m, etapa] of [["despesa_hab", "anos_iniciais"], ["ideb", "anos_finais"], ["despesa_mat", "total"]] as const) {
      const a = tabelaComparativa(ix, 2025, etapa, "nominal", "matematica", "todas", d.capitais[0], m);
      const b = tabelaComparativa(ixc, 2025, etapa, "nominal", "matematica", "todas", dc.capitais[0], m);
      expect(b.linhas.map((l) => [l.cap.cod, ...Object.values(l.celulas).map((c) => c.valor), ...l.ressalvas.map((r) => r.texto)])).toEqual(a.linhas.map((l) => [l.cap.cod, ...Object.values(l.celulas).map((c) => c.valor), ...l.ressalvas.map((r) => r.texto)]));
    }
  });

  it("cada tema leva só o que usa, bem menos que a base completa", async () => {
    const { dadosPainelTema } = await import("@/lib/eficiencia/dados");
    const cheio = JSON.stringify(d).length;
    for (const t of temas) {
      const r = JSON.stringify(dadosPainelTema(g, t)).length;
      expect(r, t).toBeLessThan(cheio * 0.6);
    }
  });

  it("os valores dos indicadores do tema são idênticos nos dois payloads (comparação, ponto, referência, ponte e composição)", async () => {
    const { dadosPainelTema, INDICADORES_DO_TEMA } = await import("@/lib/eficiencia/dados");
    const { ponteMatricula, composicaoDespesa, distribuicaoMatriculas } = await import("@/lib/eficiencia/consulta");
    for (const t of temas) {
      const dt = dadosPainelTema(g, t);
      const ixt = new Indice(dt);
      for (const m of DEFINICAO_TEMA[t].medidas) {
        expect(INDICADORES_DO_TEMA[t]).toContain(MEDIDA[m].indicador);
        const etapa = etapaEfetiva(m, "anos_iniciais", "anos_iniciais");
        for (const ano of anosDaMedida(d, m).slice(-3)) {
          const a = comparar(ix, m, ano, etapa, "nominal", "matematica", "todas", d.capitais[0], "alfabetica");
          const b = comparar(ixt, m, ano, etapa, "nominal", "matematica", "todas", dt.capitais[0], "alfabetica");
          expect(b.incluidas.map((i) => [i.cap.cod, i.valor, i.ponto.nota, i.ponto.motivo])).toEqual(a.incluidas.map((i) => [i.cap.cod, i.valor, i.ponto.nota, i.ponto.motivo]));
          expect(b.excluidas.map((x) => [x.cap.cod, x.motivo])).toEqual(a.excluidas.map((x) => [x.cap.cod, x.motivo]));
          expect(b.ref?.mediana).toBe(a.ref?.mediana);
        }
      }
    }
    const dg = dadosPainelTema(g, "gastos");
    const ixg = new Indice(dg);
    for (const cap of d.capitais) {
      expect(ponteMatricula(ixg, cap.cod, 2025)).toEqual(ponteMatricula(ix, cap.cod, 2025));
      expect(composicaoDespesa(ixg, cap.cod, 2025)).toEqual(composicaoDespesa(ix, cap.cod, 2025));
    }
    const da = dadosPainelTema(g, "atendimento");
    const ixa = new Indice(da);
    for (const cap of d.capitais) expect(distribuicaoMatriculas(ixa, cap.cod, 2025)).toEqual(distribuicaoMatriculas(ix, cap.cod, 2025));
  });
});
