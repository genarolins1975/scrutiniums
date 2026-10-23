import { describe, expect, it } from "vitest";
import { DESTINO_ABAS_CREDITO } from "@/lib/observatorios/registro";
import { OBSERVATORIOS } from "@/lib/observatorios/lista";
import { htmlRotuloSpa } from "@/lib/observatorios/barraSpa";

/**
 * Abas do Crédito que pertencem a outro observatório. Até 23/10/2026 o cabeçalho da SPA escrevia à mão "Este painel faz parte
 * do Observatório X" (VIEW_OBSERVATORIO no app.js); desde a Iniciativa 2 do parecer de UX de 23/10/2026 (o Crédito na mesma
 * casca) é o rótulo de contexto da plataforma, lido do registro, que diz o observatório e a coleção donos de cada aba.
 */
describe("abas do Crédito que pertencem a outro observatório", () => {
  it("o rótulo acima do título diz o observatório e a coleção que o registro atribui a cada aba", () => {
    for (const [caminho, [obs, col]] of Object.entries(DESTINO_ABAS_CREDITO)) {
      const o = OBSERVATORIOS.find((x) => x.id === obs)!;
      const c = o.colecoes.find((x) => x.id === col)!;
      expect(htmlRotuloSpa(`/observatorio${caminho}`), caminho).toContain(`<span>${o.nome} · ${c.nome}`);
    }
  });
});
