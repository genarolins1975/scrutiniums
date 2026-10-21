import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { OBSERVATORIOS, donoDaRota, rotasDoObservatorio } from "@/lib/observatorios/registro";
import { escalaFamilias, orcamentoFamilia } from "@/lib/observatorios/entradas/familias";
import { escalaServicos, recursoAoResultado } from "@/lib/observatorios/entradas/servicos";
import { cartoesTerritorio, escalaTerritorio, numeroDoCaminho } from "@/lib/observatorios/entradas/territorio";
import { escalaContas, fluxoImposto } from "@/lib/observatorios/entradas/contas";
import { cadeias, escalaEnergia } from "@/lib/observatorios/entradas/energia";
import { circuitoCredito, escalaEconomia } from "@/lib/observatorios/entradas/economia";
import type { ObservatorioId } from "@/lib/observatorios/lista";
import type { NumeroPorta } from "@/lib/perguntas/tipos";
import { mesAno } from "@/lib/perguntas/leitura";

/** Número lido da base, com fonte e período, apontando para painel do próprio observatório ou atalho dele. */
function conferir(n: NumeroPorta, id: ObservatorioId) {
  expect(n.valor, n.rotulo).not.toBeNull();
  expect(n.valor, n.rotulo).not.toMatch(/NaN|undefined|Infinity/);
  expect(n.periodo, n.rotulo).not.toMatch(/indisponível|NaN|undefined/);
  expect(n.fonte.trim(), n.rotulo).not.toBe("");
  expect(rotasDoObservatorio(id).has(n.href) || donoDaRota(n.href)?.observatorio === id, `${n.rotulo}: ${n.href}`).toBe(true);
}
import { ehRotaPublica } from "@/lib/rotasPublicas";

describe("entradas com conta dos observatórios", () => {
  it("toda entrada declarada no registro é rota fechada e tem página", async () => {
    const comEntrada = OBSERVATORIOS.filter((o) => o.entrada);
    expect(comEntrada.map((o) => o.id)).toEqual(OBSERVATORIOS.map((o) => o.id));
    for (const o of comEntrada) {
      // o Território e Clima mantém os próprios painéis e tem a entrada junto deles, em /territorio
      expect(o.entrada).toBe(o.id === "territorio-e-clima" ? "/territorio" : `/observatorios/${o.id}`);
      expect(ehRotaPublica(o.entrada as string), o.entrada).toBe(false);
    }
    expect(existsSync(join(process.cwd(), "src", "app", "observatorios", "[id]", "page.tsx"))).toBe(true);
    expect(existsSync(join(process.cwd(), "src", "app", "territorio", "page.tsx"))).toBe(true);
    // o endereço genérico antigo continua levando à entrada
    const config = (await import("../../next.config.mjs")).default as { redirects: () => Promise<{ source: string; destination: string }[]> };
    expect((await config.redirects()).find((r) => r.source === "/observatorios/territorio-e-clima")?.destination).toBe("/territorio");
  });

  it("os números de escala das Famílias são lidos das bases, com fonte e período, e no máximo quatro", () => {
    const escala = escalaFamilias();
    expect(escala.length).toBeGreaterThan(0);
    expect(escala.length).toBeLessThanOrEqual(4);
    for (const n of escala) {
      expect(n.valor, n.rotulo).not.toBeNull();
      expect(n.valor, n.rotulo).not.toMatch(/NaN|undefined|Infinity/);
      expect(n.periodo, n.rotulo).not.toMatch(/indisponível/);
      expect(n.fonte.trim(), n.rotulo).not.toBe("");
    }
  });

  it("o modelo do orçamento liga só painéis do observatório ou atalhos registrados, com números lidos", () => {
    const permitidas = rotasDoObservatorio("familias");
    const etapas = orcamentoFamilia();
    expect(etapas.map((e) => e.id)).toEqual(["entra", "essencial", "divida", "risco"]);
    for (const e of etapas) {
      for (const elo of e.elos) {
        expect(donoDaRota(elo.href), elo.href).not.toBeNull();
        expect(permitidas.has(elo.href) || donoDaRota(elo.href)?.observatorio === "familias", `${elo.titulo}: ${elo.href}`).toBe(true);
        if (elo.numero) {
          expect(elo.numero.valor, elo.numero.rotulo).not.toBeNull();
          expect(elo.numero.periodo, elo.numero.rotulo).not.toMatch(/indisponível/);
        }
      }
    }
  });

  it("números de escala apontam para painéis do próprio observatório ou atalhos dele", () => {
    const permitidas = rotasDoObservatorio("familias");
    for (const n of escalaFamilias()) {
      const dono = donoDaRota(n.href);
      expect(dono, n.href).not.toBeNull();
      expect(permitidas.has(n.href) || dono?.observatorio === "familias", n.href).toBe(true);
    }
  });

  it("Serviços Públicos: escala e modelo do recurso ao resultado lidos das bases, com destinos do próprio observatório", () => {
    const permitidas = rotasDoObservatorio("servicos-publicos");
    const escala = escalaServicos();
    expect(escala.length).toBeLessThanOrEqual(4);
    const numeros = [...escala, ...recursoAoResultado().flatMap((t) => [t.recursos.numero, t.atendimento.numero, t.resultados.numero]).filter((n) => n !== null)];
    for (const n of numeros) {
      expect(n!.valor, n!.rotulo).not.toBeNull();
      expect(n!.periodo, n!.rotulo).not.toMatch(/indisponível/);
      const dono = donoDaRota(n!.href);
      expect(permitidas.has(n!.href) || dono?.observatorio === "servicos-publicos", n!.href).toBe(true);
    }
    for (const t of recursoAoResultado()) {
      expect(donoDaRota(t.href)?.observatorio, t.href).toBe("servicos-publicos");
      for (const e of [t.recursos, t.atendimento, t.resultados]) expect(e.texto.trim(), t.id).not.toBe("");
    }
  });

  it("Território e Clima: escala, cartões dos painéis e números dos caminhos lidos das bases, com destinos do próprio observatório ou atalhos", () => {
    const escala = escalaTerritorio();
    expect(escala.length).toBeLessThanOrEqual(4);
    const cartoes = cartoesTerritorio();
    expect(cartoes.map((c) => c.id)).toEqual(["queimadas", "desastres", "emissoes"]);
    const caminhos = ["/agronegocio/ambiente", "/eficiencia-estatal/meio-ambiente-clima", "/saneamento/resiliencia", "/setor-eletrico/agua-e-clima"].map((h) => numeroDoCaminho(h)!);
    for (const n of [...escala, ...cartoes.map((c) => c.numero), ...caminhos]) conferir(n, "territorio-e-clima");
    for (const c of cartoes) {
      expect(donoDaRota(c.href)?.observatorio, c.href).toBe("territorio-e-clima");
      expect(c.lista, c.id).not.toBeNull();
      for (const it of c.lista!.itens) expect(it.valor, `${c.id}: ${it.nome}`).not.toMatch(/NaN|undefined|Infinity/);
    }
  });

  it("Contas Públicas: escala e modelo do imposto ao resultado fecham as identidades do RTN", () => {
    const escala = escalaContas();
    expect(escala.length).toBeLessThanOrEqual(4);
    for (const n of escala) conferir(n, "contas-publicas");
    const f = fluxoImposto();
    expect(f).not.toBeNull();
    const etapa = (id: string) => f!.etapas.find((e) => e.id === id)!;
    expect(f!.etapas.map((e) => e.id)).toEqual(["arrecadacao", "transferencias", "liquida", "despesa", "resultado"]);
    expect(etapa("arrecadacao").porCem).toBe(100);
    expect(etapa("arrecadacao").porCem - etapa("transferencias").porCem).toBeCloseTo(etapa("liquida").porCem, 6);
    expect(etapa("liquida").porCem - etapa("despesa").porCem).toBeCloseTo(etapa("resultado").porCem, 6);
    expect(etapa("despesa").partes!.reduce((s, p) => s + p.bilhoes, 0)).toBeCloseTo(etapa("despesa").bilhoes, 3);
    conferir(f!.juros, "contas-publicas");
  });

  it("Energia e Infraestrutura: escala e cadeias de luz, gás e água lidas das bases", () => {
    const escala = escalaEnergia();
    expect(escala.length).toBeLessThanOrEqual(4);
    for (const n of escala) conferir(n, "energia-e-infraestrutura");
    const c = cadeias();
    expect(c.map((x) => x.id)).toEqual(["luz", "gas", "agua"]);
    for (const x of c) {
      expect(x.elos).toHaveLength(4);
      for (const e of x.elos) {
        expect(e.texto.trim(), e.titulo).not.toBe("");
        if (e.numero) conferir(e.numero, "energia-e-infraestrutura");
      }
      for (const p of x.paineis) expect(donoDaRota(p.href)?.observatorio, p.href).toBe("energia-e-infraestrutura");
    }
    // medida combinada na nota com janela própria leva o próprio período
    const imp = JSON.parse(readFileSync(join(process.cwd(), "public", "gas", "gold", "importacao.json"), "utf-8")).indicadores;
    const importado = c.find((x) => x.id === "gas")!.elos[2].numero!;
    if (imp.gnl_participacao_massa_12m.periodo !== imp.participacao_12m.periodo) {
      expect(importado.nota).toContain(`(${imp.gnl_participacao_massa_12m.periodo.split(" a ").map(mesAno).join(" a ")})`);
    }
  });

  it("Economia: escala e circuito do crédito lidos das séries do Banco Central, com código da série na fonte", () => {
    const escala = escalaEconomia();
    expect(escala.length).toBeLessThanOrEqual(4);
    for (const n of escala) conferir(n, "economia");
    const c = circuitoCredito();
    expect(c.passos.map((p) => p.id)).toEqual(["juro", "preco", "volume", "risco"]);
    for (const n of [...c.passos.flatMap((p) => p.numeros), ...c.trilhos, ...c.producao]) {
      conferir(n, "economia");
      if (n.fonte.startsWith("Banco Central, SGS")) expect(n.fonte, n.rotulo).toMatch(/SGS série \d+$/);
    }
    for (const p of c.passos) expect(donoDaRota(p.href)?.observatorio, p.href).toBe("economia");
  });
});
