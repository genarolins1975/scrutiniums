import type { BalancoPrestador, Prestador } from "./tipos";
import { MARCA_AUTODECLARADO } from "./autodeclarado";

/**
 * Medidas de prestador calculadas sobre as somas que o próprio prestador
 * declarou em todos os municípios em que atua (perímetro do SINISA 2024).
 * Fórmulas oficiais aplicadas às somas; nunca média de percentuais municipais.
 * Valores de balanço vêm em milhares de reais (unidade da planilha).
 */

export type MedidaPrestador = {
  id: string;
  rotulo: string;
  unidade: "%" | "R$/m³" | "pessoas" | "municípios" | "R$" | "ligações" | "estações" | "l/hab/dia";
  casas: number;
  valor: (p: Prestador) => number | null;
  nota: string;
  /** Valor financeiro autodeclarado ao SINISA: leva a marca de src/lib/saneamento/autodeclarado.ts. */
  financeira?: boolean;
};

/** Nota da medida como vai para a tela e para o CSV: a fórmula e, se financeira, a marca de autodeclarado. */
export function notaMedidaPrestador(m: MedidaPrestador): string {
  return m.financeira ? `${m.nota} ${MARCA_AUTODECLARADO}` : m.nota;
}

/** Balanço do prestador: prefere a planilha de água; a de esgoto quando só ela existe. */
export function balancoDe(p: Prestador): BalancoPrestador | null {
  return p.balanco.find((b) => b.planilha === "agua") ?? p.balanco[0] ?? null;
}

const razao = (a: number | null | undefined, b: number | null | undefined, fator = 100) =>
  a == null || b == null || !(b !== 0) ? null : (a / b) * fator;

export const MEDIDAS_PRESTADOR: MedidaPrestador[] = [
  { id: "mun_agua", rotulo: "Municípios atendidos com água", unidade: "municípios", casas: 0, valor: (p) => p.municipios_agua.length, nota: "Vínculos declarados ao SINISA 2024." },
  { id: "mun_esgoto", rotulo: "Municípios atendidos com esgoto", unidade: "municípios", casas: 0, valor: (p) => p.municipios_esgoto.length, nota: "Inclui municípios com delegação sem atendimento." },
  { id: "pop_agua", rotulo: "População atendida com água", unidade: "pessoas", casas: 0, valor: (p) => p.populacao_atendida_agua, nota: "GTA0019, soma dos municípios." },
  { id: "pop_esgoto", rotulo: "População atendida com esgoto", unidade: "pessoas", casas: 0, valor: (p) => p.populacao_atendida_esgoto, nota: "GTE0023, soma dos municípios." },
  { id: "perdas", rotulo: "Perdas na distribuição", unidade: "%", casas: 1, valor: (p) => p.perdas_distribuicao_pct, nota: "Fórmula do IAG2013 sobre as somas de volumes." },
  {
    id: "micromedicao",
    rotulo: "Micromedição do volume consumido",
    unidade: "%",
    casas: 1,
    valor: (p) => razao(p.volumes_mil_m3.GTA1214, p.volumes_mil_m3.GTA1211),
    nota: "Fórmula do IAG2002: GTA1214 ÷ GTA1211.",
  },
  {
    id: "consumo_pc",
    rotulo: "Consumo total médio per capita de água",
    unidade: "l/hab/dia",
    casas: 1,
    valor: (p) => p.consumo_per_capita_agua,
    nota: "Fórmula do IAG2006 sobre as somas: (GTA1211 + GTA1207) ÷ 365 ÷ (GTA0001 + GTA0002), com a população de 2024; o SINISA usa a média com a de 2023, que as planilhas de 2024 não trazem.",
  },
  {
    id: "receita_m3",
    rotulo: "Receita direta de água por m³ faturado",
    unidade: "R$/m³",
    casas: 2,
    valor: (p) => p.receita_por_m3_faturado_agua,
    nota: "GFI1001 ÷ GTA1221; não desconta volume exportado.",
    financeira: true,
  },
  {
    id: "despesa_m3",
    rotulo: "Despesa de exploração de água por m³ faturado",
    unidade: "R$/m³",
    casas: 2,
    valor: (p) => razao(p.despesa_exploracao_agua, p.volumes_mil_m3.GTA1221 == null ? null : p.volumes_mil_m3.GTA1221 * 1000, 1),
    nota: "Fórmula do IFA2004: GFI2008 ÷ GTA1221.",
    financeira: true,
  },
  {
    id: "inv_agua",
    rotulo: "Investimento em água (prestador e governo estadual)",
    unidade: "R$",
    casas: 0,
    valor: (p) => p.investimento_agua,
    nota: "GFI2024 + GFI2036, reais correntes de 2024; a parcela estadual é a que o prestador informa.",
    financeira: true,
  },
  {
    id: "inv_esgoto",
    rotulo: "Investimento em esgoto (prestador e governo estadual)",
    unidade: "R$",
    casas: 0,
    valor: (p) => p.investimento_esgoto,
    nota: "GFI2124 + GFI2136, reais correntes de 2024.",
    financeira: true,
  },
  {
    id: "inv_hab",
    rotulo: "Investimento em água e esgoto por pessoa atendida com água",
    unidade: "R$",
    casas: 0,
    valor: (p) => (p.investimento_agua == null && p.investimento_esgoto == null ? null : razao((p.investimento_agua ?? 0) + (p.investimento_esgoto ?? 0), p.populacao_atendida_agua, 1)),
    nota: "Denominador: população atendida com água declarada pelo prestador.",
    financeira: true,
  },
  {
    id: "margem_liquida",
    rotulo: "Margem líquida com depreciação",
    unidade: "%",
    casas: 1,
    valor: (p) => razao(balancoDe(p)?.lucro_liquido_com_depreciacao, balancoDe(p)?.receita_liquida),
    nota: "Fórmula do IFB3005: GFI3011 ÷ GFI3008, balanço declarado.",
    financeira: true,
  },
  {
    id: "endividamento",
    rotulo: "Grau de endividamento",
    unidade: "%",
    casas: 1,
    valor: (p) => {
      const b = balancoDe(p);
      return b?.passivo_circulante == null || b.passivo_nao_circulante == null ? null : razao(b.passivo_circulante + b.passivo_nao_circulante, b.ativo_total);
    },
    nota: "Fórmula do IFB3003: (GFI3004 + GFI3005) ÷ GFI3001, em percentual.",
    financeira: true,
  },
  { id: "etes", rotulo: "Estações de tratamento de esgoto cadastradas", unidade: "estações", casas: 0, valor: (p) => p.etes, nota: "Cadastro de ETEs do SINISA 2024." },
];

export function formatarMedidaPrestador(m: MedidaPrestador, v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "sem dado";
  const n = v.toLocaleString("pt-BR", { minimumFractionDigits: m.casas, maximumFractionDigits: m.casas });
  switch (m.unidade) {
    case "%":
      return `${n}%`;
    case "R$/m³":
      return `R$ ${n}/m³`;
    case "l/hab/dia":
      return `${n} l/hab/dia`;
    case "R$": {
      const a = Math.abs(v);
      const f = (x: number, c: number) => x.toLocaleString("pt-BR", { minimumFractionDigits: c, maximumFractionDigits: c });
      if (a >= 1e9) return `R$ ${f(v / 1e9, 2)} bi`;
      if (a >= 1e6) return `R$ ${f(v / 1e6, 1)} mi`;
      return `R$ ${n}`;
    }
    default:
      return n;
  }
}
