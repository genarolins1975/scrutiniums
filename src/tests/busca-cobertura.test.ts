import { describe, expect, it, vi } from "vitest";
import { inventario } from "@/lib/observatorios/inventario";
import { indiceDeBusca } from "@/lib/busca/indice";

/**
 * Contrato do índice da busca para as páginas (ciclo 2 da busca, bloco 3, 23/10/2026; diagnóstico da busca, achado A2): toda
 * página publicada ou parcial do inventário tem, no catálogo do seu domínio, um resumo de uma frase (até 140 caracteres, de
 * preferência a pergunta que a página responde) e de 3 a 12 termos (siglas, fontes, indicadores e o vocabulário leigo que o
 * título não diz). Em 23/10/2026 eram 61 páginas sem resumo nem termos, que só entravam na busca pelo título; a lista chegou a
 * zero no PR deste bloco e o teste passou a exigir os dois campos de todas.
 */
vi.setConfig({ testTimeout: 60_000 });

const paginas = () => {
  const vistas = new Map<string, { titulo: string; rota: string; resumo?: string; termos?: readonly string[] }>();
  for (const o of inventario()) for (const c of o.colecoes) for (const p of c.paginas) {
    if (p.situacao === "previsto" || !p.rota || vistas.has(p.rota)) continue;
    vistas.set(p.rota, { titulo: p.titulo, rota: p.rota, resumo: p.resumo, termos: p.termos });
  }
  return Array.from(vistas.values());
};

describe("toda página com pergunta e termos", () => {
  it("o inventário tem as páginas de todos os observatórios", () => {
    expect(paginas().length).toBeGreaterThan(100);
  });

  it("toda página publicada ou parcial tem resumo de uma frase, até 140 caracteres", () => {
    const sem = paginas().filter((p) => !p.resumo?.trim() || p.resumo.length > 140).map((p) => `${p.rota}: ${p.resumo ?? "(sem resumo)"}`);
    expect(sem).toEqual([]);
  });

  it("toda página publicada ou parcial tem de 3 a 12 termos, sem repetir o título", () => {
    const fora = paginas()
      .filter((p) => {
        const t = (p.termos ?? []).filter((x) => x.trim() && x !== p.titulo);
        return t.length < 3 || (p.termos?.length ?? 0) > 12;
      })
      .map((p) => `${p.rota}: ${(p.termos ?? []).length} termos`);
    expect(fora).toEqual([]);
  });

  it("o resumo e os termos do catálogo chegam à entrada da página no índice", () => {
    const porHref = new Map(indiceDeBusca().entradas.filter((e) => e.href).map((e) => [e.href, e]));
    const perdidos = paginas()
      .filter((p) => {
        const e = porHref.get(p.rota);
        // a página pode ter virado consulta ou pergunta no índice (outro catálogo com o mesmo endereço): os termos vão junto
        return !e || !(p.termos ?? []).every((t) => e.termos.includes(t) || e.titulo === t);
      })
      .map((p) => p.rota);
    expect(perdidos).toEqual([]);
  });
});
