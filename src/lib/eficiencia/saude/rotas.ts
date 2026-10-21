import type { TemaSaude } from "./medidas";

export const ROTA_ENTRADA = "/eficiencia-estatal";
export const ROTA_SAUDE = "/eficiencia-estatal/saude-capitais";

export const CAMINHO_TEMA: Record<TemaSaude, string> = { gastos: "/gastos", rede: "/rede-e-atencao-primaria", resultados: "/atendimento-e-resultados" };
export const CAMINHO_COMPARAR = "/comparar";
export const CAMINHO_METODOS = "/metodos";

export const ABAS_SAUDE: { id: "panorama" | TemaSaude; rotulo: string; caminho: string }[] = [
  { id: "panorama", rotulo: "Panorama", caminho: "" },
  { id: "gastos", rotulo: "Gastos", caminho: CAMINHO_TEMA.gastos },
  { id: "rede", rotulo: "Rede e APS", caminho: CAMINHO_TEMA.rede },
  { id: "resultados", rotulo: "Resultados", caminho: CAMINHO_TEMA.resultados },
];

export type Parametros = Record<string, string | number | undefined | null>;

export function hrefSaude(caminho: string, params: Parametros = {}): string {
  const q = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
  return `${ROTA_SAUDE}${caminho}${q ? `?${q}` : ""}`;
}

/** Parâmetros que mudam o que o módulo mostra; qualquer outro (utm_*, âncoras) não esconde nada. */
export const PARAMETROS_DO_RECORTE_SAUDE = ["cap", "vs", "med", "ano", "moeda", "den", "vis", "ord", "dir", "grp", "reg"];

/** Script embutido: marca o recorte pendente antes da primeira pintura e libera por prazo, se a hidratação falhar. */
export const SCRIPT_RECORTE_SAUDE = `(function(){try{var q=location.search;if(!q)return;var p=new URLSearchParams(q);var ks=${JSON.stringify(PARAMETROS_DO_RECORTE_SAUDE)};for(var i=0;i<ks.length;i++){if(p.has(ks[i])){document.documentElement.setAttribute("data-recorte","pendente");setTimeout(function(){document.documentElement.removeAttribute("data-recorte")},5000);return}}}catch(e){}})();`;
