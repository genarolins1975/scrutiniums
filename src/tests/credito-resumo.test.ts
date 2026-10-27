import { describe, expect, it } from "vitest";
import { htmlResumoCredito } from "@/lib/observatorios/cascaPura";

describe("Resumo do Crédito no HTML inicial", () => {
  it("distingue ausência de zero e conserva período e definição da fonte", () => {
    const html = htmlResumoCredito({ carteira_conceitos: { sgs: { v: 0, ref: "09/2026", def: "Estoque observado" } } });
    expect(html).toContain("R$ 0 bi");
    expect(html).toContain("BCB · SGS 20539 · 09/2026");
    expect(html).toContain("Estoque observado");
    expect(html.match(/Indicador não disponível/g)).toHaveLength(2);
    expect(html).not.toMatch(/undefined|NaN/);
  });
  it("não transforma não finitos em números e escapa metadados no HTML", () => {
    const html = htmlResumoCredito({ carteira_conceitos: { sgs: { v: Infinity, ref: '<img src=x onerror="alert(1)">', def: "<script>malicioso</script>" } }, inad_conceitos: { scr: { v: NaN } } });
    expect(html.match(/Indicador não disponível/g)).toHaveLength(3);
    expect(html).not.toMatch(/<script>|<img|Infinity|NaN/);
    expect(html).toContain("&lt;script&gt;");
  });
});
