import type { CadeiaSocietaria, Companhia, ContaCvm, EscopoCvm, SeriesFinanceiras } from "./tipos-empresas";
import { razaoPositiva, variacaoComparavel } from "./leitura-integrada";

export const CONTAS_LEITURA = ["receita", "ebit", "lucro_liquido", "caixa_operacional", "caixa_investimento", "divida_bruta", "caixa"] as const satisfies readonly ContaCvm[];
export type ContaLeitura = typeof CONTAS_LEITURA[number];
export type AnoEmpresa = { ano: number; valores: Record<ContaLeitura, number | null> };
export type EmpresaLeitura = {
  cnpj: string; nome: string; setor: string | null; alerta: string[]; escala: string[];
  distribuidora: string | null; controladoraAberta: Companhia["controladora_aberta"];
  controladorDireto: { cnpj: string; nome: string | null } | null;
  motivoControle: string | null; controladasAbertas: number;
  series: Record<EscopoCvm, AnoEmpresa[]>;
};

export function anosDaEmpresa(serie: SeriesFinanceiras["series"][string] | undefined, escopo: EscopoCvm): AnoEmpresa[] {
  const a = serie?.anual[escopo];
  if (!a) return [];
  const anos = [...new Set(CONTAS_LEITURA.flatMap(c => (a[c] ?? []).map(p => p[0])))].sort((x, y) => x - y).slice(-6);
  return anos.map(ano => ({ ano, valores: Object.fromEntries(CONTAS_LEITURA.map(c => {
    const v = a[c]?.find(p => p[0] === ano)?.[1];
    return [c, typeof v === "number" && Number.isFinite(v) ? v : null];
  })) as AnoEmpresa["valores"] }));
}

export function leituraEmpresa(atual: AnoEmpresa | undefined, anterior: AnoEmpresa | undefined) {
  const par = atual && anterior && atual.ano === anterior.ano + 1 ? anterior : undefined;
  const v = atual?.valores;
  return {
    margemLiquida: razaoPositiva(v?.lucro_liquido ?? null, v?.receita ?? null),
    variacaoReceita: variacaoComparavel(v?.receita ?? null, par?.valores.receita ?? null),
    variacaoDivida: variacaoComparavel(v?.divida_bruta ?? null, par?.valores.divida_bruta ?? null),
    deltaLucro: v?.lucro_liquido != null && par?.valores.lucro_liquido != null ? v.lucro_liquido - par.valores.lucro_liquido : null,
    caixaAposInvestimento: v?.caixa_operacional != null && v.caixa_investimento != null ? v.caixa_operacional + v.caixa_investimento : null,
  };
}

export function prepararEmpresas(companhias: Companhia[], series: SeriesFinanceiras["series"], cadeia: CadeiaSocietaria | null): EmpresaLeitura[] {
  return companhias.filter(c => c.situacao === "ATIVO").map(c => {
    const no = cadeia?.nos[c.cnpj];
    const pai = no?.[1];
    return {
      cnpj: c.cnpj, nome: c.nome ?? c.cnpj, setor: c.setor, alerta: c.alertas,
      escala: series[c.cnpj]?.escala_corrigida ?? [], distribuidora: c.distribuidora_slug,
      controladoraAberta: c.controladora_aberta, controladasAbertas: c.controla_abertas.length,
      controladorDireto: pai ? { cnpj: pai, nome: cadeia?.nos[pai]?.[0] ?? null } : null,
      motivoControle: no?.[2] ?? null,
      series: { con: anosDaEmpresa(series[c.cnpj], "con"), ind: anosDaEmpresa(series[c.cnpj], "ind") },
    };
  }).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
