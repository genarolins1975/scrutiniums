import { campo, tiposUrl } from "@/lib/painel/estadoUrl";
import { calcularConta } from "@/lib/saneamento/conta";
import { TARIFAS, type TarifaVerificada } from "@/lib/saneamento/tarifas";

/**
 * Peças puras do simulador da conta de água e esgoto (capítulo 5.1), fora do componente de cliente para que a página do servidor monte
 * a curva e a tabela equivalente com as mesmas regras que os controles usam no navegador. Molde de painel (Iniciativa 1 do parecer de
 * UX de 23/10/2026): os controles, os números, a decomposição e a comparação são ilhas separadas que leem o mesmo recorte da URL.
 */

/** Tabelas próprias de município ou grupo (Corsan: Canoas e Esteio, Santa Cruz do Sul, Erechim) não entram no gráfico de curvas. */
export const TARIFAS_NA_CURVA = TARIFAS.filter((x) => !x.variante);
export const TARIFAS_FORA_DA_CURVA = TARIFAS.filter((x) => x.variante);

export const PRESETS = [5, 10, 15, 20];

export const CORES_CURVA = [
  "var(--serie-comp-1)",
  "var(--serie-comp-2)",
  "var(--serie-comp-3)",
  "var(--serie-comp-4)",
  "var(--escala-seq-3)",
  "var(--san-div-neg-2)",
  "var(--escala-seq-5)",
  "var(--san-div-neg-1)",
  "var(--serie-comp-5)",
];

/** O recorte na URL: tabela, categoria, consumo, adicionais e a categoria da comparação. Constante de módulo: o esquema é estável. */
export const ESQUEMA_SIMULADOR = {
  t: campo(tiposUrl.opcao(TARIFAS.map((t) => t.id)), TARIFAS[0].id),
  cat: campo(tiposUrl.texto({ max: 40 }), "residencial"),
  m3: campo(tiposUrl.numero({ min: 0, max: 100 }), 10, { historico: "replace" }),
  ad: campo(tiposUrl.booleano(), false),
  comp: campo(tiposUrl.opcao(["residencial", "social"] as const), "residencial"),
};

/** Rótulo curto da tabela para gráficos: sigla, UF e recorte. */
export function curto(t: TarifaVerificada) {
  const sigla = t.prestador.match(/\(([^)]+)\)/)?.[1] ?? t.prestador;
  const recorte = t.recorte ? `, ${t.recorte}` : t.id.endsWith("curitiba") ? ", Curitiba" : t.id.endsWith("demais") ? ", demais" : t.id.endsWith("t1") ? ", Tabela 1" : "";
  return `${sigla} (${t.uf}${recorte})`;
}

/** Categoria equivalente entre tabelas para a comparação padronizada. */
export function categoriaComparavel(t: TarifaVerificada, tipo: "residencial" | "social"): string | null {
  if (tipo === "residencial") return "residencial";
  const prefer = ["social_2", "social", "social_pernambucana"];
  return prefer.find((k) => k in t.categorias) ?? null;
}

/** Conta residencial de cada tabela da curva, de 0 a 40 m³: um ponto por metro cúbico inteiro. */
export function curvaResidencial(): Record<string, number | string | null>[] {
  const pts: Record<string, number | string | null>[] = [];
  for (let c = 0; c <= 40; c++) {
    const p: Record<string, number | string | null> = { consumo: String(c) };
    for (const x of TARIFAS_NA_CURVA) p[x.id] = calcularConta(x.categorias.residencial, c).total;
    pts.push(p);
  }
  return pts;
}
