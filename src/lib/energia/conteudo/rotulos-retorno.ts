/**
 * Rótulos do caminho de volta ao Aprenda, montados no servidor a partir dos verbetes e
 * das trilhas e passados ao RetornoContexto (cliente): só nomes curtos, para o cabeçalho de
 * cada página não carregar o texto dos verbetes.
 */
import type { RotulosRetorno } from "../retorno";
import { CONCEITOS } from "./conceitos";
import { TRILHAS_APRENDA } from "./trilhas";

let cache: RotulosRetorno | null = null;

export function rotulosRetorno(): RotulosRetorno {
  cache ??= {
    verbetes: Object.fromEntries(CONCEITOS.filter((c) => c.estado === "CONFERIDO").map((c) => [c.slug, c.sigla ?? c.nome])),
    trilhas: Object.fromEntries(TRILHAS_APRENDA.map((t) => [t.id, { titulo: t.titulo, passos: t.passos.map((p) => p.id) }])),
  };
  return cache;
}
