import { acimaDoLimite, calcularConta } from "./conta";
import { data, inteiro, reais } from "./formato";
import { TARIFAS, type TarifaVerificada } from "./tarifas";
import type { NumeroPorta } from "@/lib/perguntas/tipos";

/** Onda S1, pacote C, 25/10/2026: uma observação por tabela, incluindo variantes municipais, sem ponderação por população. */
export function resumoContaResidencial(tabelas: readonly TarifaVerificada[] = TARIFAS) {
  const consumo = 10;
  const contas = tabelas.map((t) => {
    const categoria = t.categorias.residencial;
    if (!categoria || !categoria.esgoto || acimaDoLimite(categoria, consumo)) return null;
    const conta = calcularConta(categoria, consumo);
    return Number.isFinite(conta.total) && conta.esgoto !== null ? conta.total : null;
  });
  // Não publicar uma faixa de cobertura menor com o rótulo da amostra inteira.
  const completas = contas.length > 0 && contas.every((c) => c !== null);
  const valores = completas ? (contas as number[]).slice().sort((a, b) => a - b) : [];
  const meio = Math.floor(valores.length / 2);
  const consultas = tabelas.map((t) => t.acessado).sort();
  return {
    consumo,
    tabelas: tabelas.length,
    prestadores: new Set(tabelas.map((t) => t.prestadorSinisa)).size,
    municipios: new Set(tabelas.flatMap((t) => t.municipios)).size,
    minimo: valores[0] ?? null,
    maximo: valores[valores.length - 1] ?? null,
    mediana: !completas ? null : valores.length % 2 ? valores[meio] : (valores[meio - 1] + valores[meio]) / 2,
    consultaInicial: consultas[0] ?? null,
    consultaFinal: consultas[consultas.length - 1] ?? null,
  };
}

export function numeroContaResidencial(): NumeroPorta {
  const r = resumoContaResidencial();
  return {
    rotulo: `Conta de água e esgoto de ${r.consumo} m³ por mês, nas tabelas verificadas`,
    valor: r.minimo === null || r.maximo === null ? null : `${reais(r.minimo).replace(" ", "\u00a0")} a ${reais(r.maximo).replace(" ", "\u00a0")}`,
    unidade: "",
    periodo: "Conta mensal residencial",
    fonte: `Reguladores e prestadores; tabelas consultadas de ${data(r.consultaInicial)} a ${data(r.consultaFinal)}`,
    nota: `Mediana: ${reais(r.mediana)}. Amostra: ${inteiro(r.tabelas)} tabelas de ${inteiro(r.prestadores)} prestadores, em ${inteiro(r.municipios)} municípios; não é média do Brasil. Sem adicionais; cada tabela tem o mesmo peso.`,
    href: "/saneamento/preco-regulado/simulador",
  };
}
