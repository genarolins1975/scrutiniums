import { describe, expect, it } from "vitest";
import { LEVA_2, PAINEL_COMPLETO_DA_CONSULTA, consultasAbertasLeva1, exigeConta } from "@/lib/rotasPublicas";
import { OBSERVATORIOS, donoDaRota } from "@/lib/observatorios/registro";

/**
 * Princípio do aperitivo (decisão do dono de 20/10/2026): tudo o que a área
 * aberta mostra existe na área com conta, com nível de detalhe muito maior; a
 * área aberta mostra só um aperitivo. Cada consulta aberta, ligada ou
 * preparada, aponta um painel com conta registrado que a aprofunda.
 */
describe("princípio do aperitivo", () => {
  const conferePainel = (origem: string, destino: string) => {
    expect(destino, origem).not.toBe(origem);
    expect(exigeConta(destino), `${origem}: o painel completo ${destino} precisa exigir conta`).toBe(true);
    expect(donoDaRota(destino), `${origem}: o painel completo ${destino} não está no registro`).not.toBeNull();
  };

  it("toda consulta aberta da leva 1 aponta o painel com conta que a aprofunda", () => {
    expect(Object.keys(PAINEL_COMPLETO_DA_CONSULTA).sort()).toEqual(consultasAbertasLeva1().sort());
    for (const [origem, destino] of Object.entries(PAINEL_COMPLETO_DA_CONSULTA)) conferePainel(origem, destino);
  });

  it("todo item da leva 2, ligado ou não, aponta o painel com conta; só método fica sem", () => {
    for (const item of LEVA_2) {
      if (item.forma === "metodo") {
        expect(item.painelCompleto, item.id).toBeNull();
        continue;
      }
      expect(item.painelCompleto, `${item.id} sem painel completo`).not.toBeNull();
      conferePainel(item.rotas[0] ?? `/perguntas (${item.id})`, item.painelCompleto as string);
    }
  });

  it("cada porta de O Brasil em perguntas tem a entrada completa do observatório com conta", () => {
    for (const o of OBSERVATORIOS) expect(exigeConta(`/observatorios/${o.id}`), o.id).toBe(true);
  });
});
