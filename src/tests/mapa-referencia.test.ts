import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DominioFrescorId } from "@/lib/frescor/regras";

const dados = vi.hoisted(() => ({ referencia: null as string | null }));
vi.mock("@/lib/frescor/dominios", () => ({
  dadosFrescor: (ids: DominioFrescorId[]) => ids.map(id => ({
    id, referencia: dados.referencia,
    publicadoEm: "2026-10-24T12:00:00Z", parteMaisRecente: null,
  })),
}));
import { paineis } from "@/lib/observatorios/registro";
import { diretorioDoMapa } from "@/lib/observatorios/mapaConta";

const colecoes = () => diretorioDoMapa(new Date("2026-10-24T13:00:00Z")).secoes.flatMap(o => o.colecoes);
beforeEach(() => { dados.referencia = null; });

describe("período dos indicadores no mapa", () => {
  it("não apresenta a publicação como período quando a referência está ausente", () => {
    const comFonte = colecoes().filter(c => c.fontes.length > 0);
    expect(comFonte.length).toBeGreaterThan(0);
    expect(comFonte.every(c => c.dadosAte === null)).toBe(true);
  });

  it.each([["2024", "2024"], ["2026-09", "set/2026"], ["2026-09-30", "30/09/2026"]])(
    "preserva a granularidade da referência %s, independentemente da publicação",
    (referencia, esperado) => {
      dados.referencia = referencia;
      const linhas = colecoes();
      expect(linhas.filter(c => c.fontes.length > 0).every(c => c.dadosAte === esperado)).toBe(true);
      expect(linhas.filter(c => c.fontes.length === 0).every(c => c.dadosAte === null)).toBe(true);
    },
  );
});

it("o resumo do mapa é o da rota de entrada exata, nunca o de uma página vizinha", () => {
  const entradas = new Map(paineis().filter(p => !p.duplicataDe).map(p => [p.rota, p.resumo]));
  const linhas = colecoes();
  expect(linhas.some(c => c.resumoEntrada)).toBe(true);
  for (const c of linhas) expect(c.resumoEntrada, c.href).toBe(entradas.get(c.href));
});
