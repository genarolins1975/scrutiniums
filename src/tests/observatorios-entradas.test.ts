import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { OBSERVATORIOS, donoDaRota, rotasDoObservatorio } from "@/lib/observatorios/registro";
import { escalaFamilias, orcamentoFamilia } from "@/lib/observatorios/entradas/familias";
import { escalaServicos, recursoAoResultado } from "@/lib/observatorios/entradas/servicos";
import { ehRotaPublica } from "@/lib/rotasPublicas";

describe("entradas com conta dos observatórios", () => {
  it("toda entrada declarada no registro é rota fechada e tem página", () => {
    const comEntrada = OBSERVATORIOS.filter((o) => o.entrada);
    expect(comEntrada.map((o) => o.id)).toEqual(["familias", "servicos-publicos"]);
    for (const o of comEntrada) {
      expect(o.entrada).toBe(`/observatorios/${o.id}`);
      expect(ehRotaPublica(o.entrada as string), o.entrada).toBe(false);
    }
    expect(existsSync(join(process.cwd(), "src", "app", "observatorios", "[id]", "page.tsx"))).toBe(true);
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
});
