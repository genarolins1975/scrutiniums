import type { Categoria, Exponencial, TabelaServico, TarifaVerificada } from "./tarifas";

/**
 * Conta mensal simulada a partir de uma tabela verificada. Regra única, igual à
 * do gerador (pipeline/observatorio_saneamento/tarifas.py): parte fixa, valor
 * mínimo que cobre os primeiros m³ e, acima dele, cada m³ no preço da sua faixa
 * ou, quando a tabela traz exponencial, o preço-base vezes o consumo elevado ao expoente da faixa.
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
  if (t.exponencial) {
    const e = t.exponencial;
    const base = Math.max(c, e.minimoM3);
    const n = expoente(e, base);
    const v = Math.round(e.preco * Math.pow(base, n) * ESCALA);
    total += v;
    linhas.push({
      servico: nome,
      rotulo: c <= e.minimoM3 ? `Mínimo de ${fmt(e.minimoM3)} m³ (cobrado mesmo com consumo menor)` : `Consumo: volume elevado a ${fmtExpoente(n)}`,
      volume: base,
      preco: e.preco,
      valor: reais(v),
    });
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

const fmtExpoente = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 });

/** Expoente da faixa: o do último degrau que começa em consumo menor ou igual; 1 antes do primeiro. */
export function expoente(e: Exponencial, consumo: number): number {
  let n = 1;
  for (const d of e.degraus) if (d.de <= consumo) n = d.n;
  return n;
}

/** Categoria com teto de consumo no ato (como a tarifa social da Saneago, até 20 m³): acima dele não há preço definido. */
export const acimaDoLimite = (cat: Categoria, consumo: number) => cat.consumoMaximo != null && consumo > cat.consumoMaximo;

/** Quem chama confere `acimaDoLimite` antes: calcular acima do teto seria inventar um preço que o ato não traz. */
export function calcularConta(cat: Categoria, consumo: number, adicionais: { rotulo: string; percentual: number }[] = []): Conta {
  const c = cat.consumoInteiro ? Math.floor(Math.max(0, consumo)) : Math.max(0, consumo);
  if (acimaDoLimite(cat, c)) throw new RangeError(`${cat.rotulo}: o ato só define preço até ${cat.consumoMaximo} m³ por mês`);
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

export const CONSUMOS_EXPORTACAO = [5, 10, 15, 20, 30];
export const CABECALHO_EXPORTACAO = ["tabela", "prestador", "uf", "regulador", "ato", "vigencia", "categoria", "consumo_m3", "agua_R$", "esgoto_R$", "total_R$", "situacao"] as const;

/**
 * Uma linha por tabela, categoria e consumo. Categoria com teto de consumo mantém a linha acima do teto, com os valores vazios e a
 * situação dita, para que quem lê o arquivo distinga preço indefinido de linha omitida.
 */
export function linhasExportacao(tabelas: TarifaVerificada[], consumos: number[] = CONSUMOS_EXPORTACAO): (string | number | null)[][] {
  const linhas: (string | number | null)[][] = [];
  for (const t of tabelas) {
    for (const cat of Object.values(t.categorias)) {
      for (const m3 of consumos) {
        const base = [t.id, t.prestador, t.uf, t.regulador, t.ato, t.vigencia, cat.rotulo, m3];
        if (acimaDoLimite(cat, m3)) {
          linhas.push([...base, null, null, null, `sem preço no ato acima de ${cat.consumoMaximo} m³`]);
          continue;
        }
        const r = calcularConta(cat, m3);
        linhas.push([...base, r.agua, r.esgoto, r.total, "calculada"]);
      }
    }
  }
  return linhas;
}

/** Preço médio efetivo (R$/m³) e custo do metro cúbico seguinte (nulo quando o seguinte passa do teto da categoria). */
export function leituras(t: TarifaVerificada, categoria: string, consumo: number) {
  const cat = t.categorias[categoria];
  const atual = calcularConta(cat, consumo);
  const proximo = acimaDoLimite(cat, consumo + 1) ? null : calcularConta(cat, consumo + 1);
  return {
    conta: atual,
    precoMedio: consumo > 0 ? atual.total / consumo : null,
    m3Adicional: proximo ? Math.round((proximo.total - atual.total) * 100) / 100 : null,
  };
}
