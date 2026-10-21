/**
 * Rótulos do caminho de volta ao Aprenda, montados no servidor a partir dos verbetes e
 * das trilhas e passados ao RetornoContexto (cliente): só nomes curtos, para o cabeçalho de
 * cada página não carregar o texto dos verbetes.
 */
import type { Idioma } from "@/lib/idioma";
import { idiomaEnergia } from "../idioma";
import type { RotulosRetorno } from "../retorno";
import { CONCEITOS_IDIOMAS } from "./conceitos";
import { TRILHAS_APRENDA_IDIOMAS } from "./trilhas";

const cache: Partial<Record<Idioma, RotulosRetorno>> = {};

/** Nomes curtos no idioma da página (o nome do verbete e o título da trilha mudam; slugs e ids não). */
export function rotulosRetorno(idioma: Idioma = idiomaEnergia()): RotulosRetorno {
  cache[idioma] ??= {
    verbetes: Object.fromEntries(CONCEITOS_IDIOMAS[idioma].filter((c) => c.estado === "CONFERIDO").map((c) => [c.slug, c.sigla ?? c.nome])),
    trilhas: Object.fromEntries(TRILHAS_APRENDA_IDIOMAS[idioma].map((t) => [t.id, { titulo: t.titulo, passos: t.passos.map((p) => p.id) }])),
  };
  return cache[idioma];
}
