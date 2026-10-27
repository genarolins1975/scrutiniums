import type { IndiceMunicipios } from "./conta";

const URL_INDICE = "/setor-eletrico/conta-de-luz/municipios.json";
let carga: Promise<IndiceMunicipios> | null = null;

/** Mesma carga sob demanda para buscar e recuperar o município; falha permite nova tentativa. */
export function carregarIndiceMunicipios(): Promise<IndiceMunicipios> {
  if (!carga) {
    carga = fetch(URL_INDICE)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<IndiceMunicipios>;
      })
      .catch((e: unknown) => {
        carga = null;
        throw e;
      });
  }
  return carga;
}
