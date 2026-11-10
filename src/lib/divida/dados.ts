/**
 * Leitura do recorte de pessoa física da gold do Crédito (public/obs/data/gold/pulse.json) para o painel Dívida das
 * famílias. Só servidor. Nada é escrito à mão: valor, mês de referência e código da série saem da própria gold; falha de
 * leitura vira ausência declarada (numero, em perguntas/leitura.ts), nunca zero.
 */
import { lerPublico, mesAno, num, numero } from "@/lib/perguntas/leitura";
import type { NumeroPorta } from "@/lib/perguntas/tipos";
import { ROTA_DIVIDA } from "./paginas";

export type IdMedida = "comprometimento" | "endividamento" | "inad_pf" | "taxa_pf";

export type Medida = {
  id: IdMedida;
  /** Nome curto, como aparece em legenda e tabela. */
  nome: string;
  rotulo: string;
  unidade: string;
  casas: number;
  /** Ressalva material que acompanha o número. */
  nota: string;
  /** Seção da página onde a série está. */
  ancora: string;
};

export const MEDIDAS: readonly Medida[] = [
  {
    id: "comprometimento", nome: "Parcelas do mês", rotulo: "Parte da renda do mês usada para pagar dívidas com bancos", unidade: "% da renda mensal", casas: 1, ancora: "#peso-na-renda",
    nota: "Juros e amortizações sobre a renda disponível, com ajuste sazonal. Só dívidas no sistema financeiro.",
  },
  {
    id: "endividamento", nome: "Dívida total", rotulo: "Dívida total das famílias com bancos em relação à renda de 12 meses", unidade: "% da renda de 12 meses", casas: 1, ancora: "#peso-na-renda",
    nota: "Inclui financiamento imobiliário, que é dívida de prazo longo.",
  },
  {
    id: "inad_pf", nome: "Atraso", rotulo: "Crédito das famílias com atraso acima de 90 dias", unidade: "% da carteira", casas: 2, ancora: "#atraso",
    nota: "Parcela do saldo, não das pessoas. Só dívidas com bancos e financeiras; não inclui crediário informal nem contas de consumo.",
  },
  {
    id: "taxa_pf", nome: "Juros", rotulo: "Juros médios dos empréstimos novos às famílias", unidade: "% ao ano", casas: 1, ancora: "#juros",
    nota: "Média de todas as modalidades contratadas no mês, do consignado ao rotativo do cartão. Não é o custo efetivo total de um contrato.",
  },
];

export type Ponto = { ref: string; v: number };
export type SerieMedida = { medida: Medida; codigo: string; fonte: string; url: string; obs: Ponto[]; ultimo: Ponto; primeiro: Ponto; maximo: Ponto; minimo: Ponto };

export type DadosDivida = {
  geradoEm: string;
  series: Record<IdMedida, SerieMedida>;
  /** Linhas mensais com as quatro medidas; mês sem observação fica null (lacuna na linha, nunca zero). */
  linhas: ({ mes: string } & Record<IdMedida, number | null>)[];
};

/* eslint-disable @typescript-eslint/no-explicit-any -- leitura de gold JSON sem tipos gerados */
export function dadosDivida(): DadosDivida {
  const g = lerPublico("obs", "data", "gold", "pulse.json");
  const series = {} as Record<IdMedida, SerieMedida>;
  for (const medida of MEDIDAS) {
    const s = g.series[medida.id];
    const obs: Ponto[] = (s.obs as any[]).filter((o) => typeof o.v === "number" && Number.isFinite(o.v)).map((o) => ({ ref: String(o.ref).slice(0, 7), v: o.v }));
    if (obs.length === 0) throw new Error(`série sem observação: ${medida.id}`);
    const codigo = String(s.meta.series_code);
    series[medida.id] = {
      medida, codigo, fonte: `Banco Central, SGS série ${codigo}`, url: String(s.meta.url), obs,
      ultimo: obs[obs.length - 1], primeiro: obs[0],
      maximo: obs.reduce((a, b) => (b.v > a.v ? b : a)), minimo: obs.reduce((a, b) => (b.v < a.v ? b : a)),
    };
  }
  const meses = Array.from(new Set(MEDIDAS.flatMap((m) => series[m.id].obs.map((o) => o.ref)))).sort();
  const porMes = Object.fromEntries(MEDIDAS.map((m) => [m.id, new Map(series[m.id].obs.map((o) => [o.ref, o.v]))])) as Record<IdMedida, Map<string, number>>;
  const linhas = meses.map((mes) => ({
    mes,
    comprometimento: porMes.comprometimento.get(mes) ?? null,
    endividamento: porMes.endividamento.get(mes) ?? null,
    inad_pf: porMes.inad_pf.get(mes) ?? null,
    taxa_pf: porMes.taxa_pf.get(mes) ?? null,
  }));
  return { geradoEm: String(g.gerado_em), series, linhas };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Número de uma medida com a prova ao lado; o destino é a seção da própria página das Famílias. */
export function numeroDivida(id: IdMedida, href?: string): NumeroPorta {
  const medida = MEDIDAS.find((m) => m.id === id)!;
  const codigos: Record<IdMedida, string> = { comprometimento: "29034", endividamento: "29037", inad_pf: "21084", taxa_pf: "20716" };
  return numero(
    { rotulo: medida.rotulo, unidade: medida.unidade, fonte: `Banco Central, SGS série ${codigos[id]}`, href: href ?? `${ROTA_DIVIDA}${medida.ancora}`, nota: medida.nota },
    () => {
      const s = dadosDivida().series[id];
      if (s.codigo !== codigos[id]) throw new Error(`código da série mudou: ${id}`);
      return { valor: num(s.ultimo.v, medida.casas), periodo: mesAno(s.ultimo.ref) };
    },
  );
}
