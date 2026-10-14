import type { Categoria, TabelaServico, TarifaVerificada } from "./tarifas";

/**
 * Conta mensal simulada a partir de uma tabela verificada. Regra única, igual à
 * do gerador (pipeline/observatorio_saneamento/tarifas.py): parte fixa, valor
 * mínimo que cobre os primeiros m³ e, acima dele, cada m³ no preço da sua faixa.
 * Aritmética em décimos de milésimo de centavo para não acumular erro binário;
 * arredondamento só no fim, ao centavo (nenhum ato consultado traz regra própria).
 */
const ESCALA = 1e7;
const int = (x: number) => Math.round(x * ESCALA);
const reais = (x: number) => Math.round(x / (ESCALA / 100)) / 100;

export type LinhaConta = { servico: "agua" | "esgoto" | "adicional"; rotulo: string; volume: number | null; preco: number | null; valor: number };
export type Conta = {
  consumo: number;
  agua: number;
  esgoto: number | null;
  adicionais: number;
  total: number;
  linhas: LinhaConta[];
  esgotoNaoVerificado?: string;
};

function servico(t: TabelaServico, c: number, nome: "agua" | "esgoto"): { total: number; linhas: LinhaConta[] } {
  const linhas: LinhaConta[] = [];
  let total = 0;
  if (t.fixo != null) {
    total += int(t.fixo);
    linhas.push({ servico: nome, rotulo: "Tarifa fixa", volume: null, preco: null, valor: t.fixo });
  }
  if (t.minimo) {
    total += int(t.minimo.valor);
    linhas.push({ servico: nome, rotulo: `Valor até ${fmt(t.minimo.m3)} m³ (cobrado mesmo com consumo menor)`, volume: Math.min(c, t.minimo.m3), preco: null, valor: t.minimo.valor });
  }
  for (const f of t.faixas) {
    const vol = Math.max(0, (f.ate == null ? c : Math.min(c, f.ate)) - f.de);
    if (vol <= 0) continue;
    const v = int(vol) * f.preco; // vol em escala × preço
    total += v;
    linhas.push({
      servico: nome,
      rotulo: f.ate == null ? `Acima de ${fmt(f.de)} m³` : `De ${fmt(f.de)} a ${fmt(f.ate)} m³`,
      volume: vol,
      preco: f.preco,
      valor: reais(v),
    });
  }
  return { total, linhas };
}

function fmt(n: number) {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

export function calcularConta(cat: Categoria, consumo: number, adicionais: { rotulo: string; percentual: number }[] = []): Conta {
  const c = Math.max(0, consumo);
  const a = servico(cat.agua, c, "agua");
  let esgoto: { total: number; linhas: LinhaConta[] } | null = null;
  if (cat.esgoto) {
    if ("percentual" in cat.esgoto) {
      const v = Math.round((a.total * cat.esgoto.percentual) / 100);
      esgoto = { total: v, linhas: [{ servico: "esgoto", rotulo: `Esgoto: ${fmt(cat.esgoto.percentual)}% da conta de água`, volume: null, preco: null, valor: reais(v) }] };
    } else {
      esgoto = servico(cat.esgoto, c, "esgoto");
    }
  }
  const base = a.total + (esgoto?.total ?? 0);
  const linhasAd: LinhaConta[] = [];
  let ad = 0;
  for (const x of adicionais) {
    const v = Math.round((base * x.percentual) / 100);
    ad += v;
    linhasAd.push({ servico: "adicional", rotulo: x.rotulo, volume: null, preco: null, valor: reais(v) });
  }
  return {
    consumo: c,
    agua: reais(a.total),
    esgoto: esgoto ? reais(esgoto.total) : null,
    adicionais: reais(ad),
    total: reais(base + ad),
    linhas: [...a.linhas, ...(esgoto?.linhas ?? []), ...linhasAd],
    esgotoNaoVerificado: cat.esgotoNaoVerificado,
  };
}

/** Preço médio efetivo (R$/m³) e custo do metro cúbico seguinte. */
export function leituras(t: TarifaVerificada, categoria: string, consumo: number) {
  const cat = t.categorias[categoria];
  const atual = calcularConta(cat, consumo);
  const proximo = calcularConta(cat, consumo + 1);
  return {
    conta: atual,
    precoMedio: consumo > 0 ? atual.total / consumo : null,
    m3Adicional: Math.round((proximo.total - atual.total) * 100) / 100,
  };
}
