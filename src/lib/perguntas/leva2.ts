/**
 * Leva 2 na camada aberta "O Brasil em perguntas". Lê a LEVA_2 de
 * src/lib/rotasPublicas.ts: só item com a data da aprovação do dono aparece,
 * como consulta em "Para o seu caso", como página de método ou como artefato
 * da própria porta. Enquanto a aprovação for null, nada daqui chega à página.
 */
import { LEVA_2, itemAprovado, type IdLeva2, type ItemLeva2 } from "@/lib/rotasPublicas";
import type { ObservatorioId } from "@/lib/observatorios/lista";
import type { ConsultaAberta } from "./tipos";

function daPorta(porta: ObservatorioId, forma: ItemLeva2["forma"], leva: readonly ItemLeva2[]): ItemLeva2[] {
  return leva.filter((i) => i.forma === forma && i.portas.includes(porta) && itemAprovado(i));
}

/** Consultas aprovadas da leva 2 para o bloco "Para o seu caso" da porta. */
export function consultasLeva2(porta: ObservatorioId, leva: readonly ItemLeva2[] = LEVA_2): ConsultaAberta[] {
  return daPorta(porta, "consulta", leva).map((i) => ({ pergunta: i.pergunta, resumo: i.resumo, href: i.rotas[0] }));
}

/** Páginas de método aprovadas da leva 2 para a lista de métodos da porta. */
export function metodosLeva2(porta: ObservatorioId, leva: readonly ItemLeva2[] = LEVA_2): { rotulo: string; href: string }[] {
  return daPorta(porta, "metodo", leva).map((i) => ({ rotulo: i.pergunta, href: i.rotas[0] }));
}

/** Artefatos aprovados da leva 2 que a própria página da porta mostra. */
export function artefatosLeva2(porta: ObservatorioId, leva: readonly ItemLeva2[] = LEVA_2): IdLeva2[] {
  return daPorta(porta, "artefato", leva).map((i) => i.id);
}
