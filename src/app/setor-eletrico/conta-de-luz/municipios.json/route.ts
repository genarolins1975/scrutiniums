import { readFileSync } from "node:fs";
import { join } from "node:path";
import { criarIndiceMunicipios } from "@/lib/energia/conta";

/**
 * Índice compacto município → distribuidoras para a busca da Conta de luz ("em que distribuidora fica o meu município?"). É gerado no
 * build a partir de `territorio_municipios.csv` (relação oficial da ANEEL entre município e distribuidora, estado do vínculo incluído)
 * e servido como arquivo estático: o navegador só o baixa quando o leitor começa a digitar, em vez de a página carregar 5.571 nomes.
 * Sem o CSV, devolve o índice vazio e a busca diz que está indisponível.
 */
export const dynamic = "force-static";

export function GET() {
  let indice = { d: [], m: [] } as ReturnType<typeof criarIndiceMunicipios>;
  try {
    indice = criarIndiceMunicipios(readFileSync(join(process.cwd(), "public", "energia", "series", "territorio_municipios.csv"), "utf-8"));
  } catch {
    // arquivo ausente: índice vazio
  }
  return Response.json(indice, { headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" } });
}
