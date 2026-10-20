/**
 * Leitura da gold de combustíveis (public/gas/gold/combustiveis.json) para o painel e a consulta. Nada aqui calcula preço:
 * os números vêm prontos da gold (pipeline/gas/gold.py, função combustiveis); este módulo só escolhe o recorte que cada
 * página manda ao navegador. A consulta aberta recebe só o último mês.
 */
import { goldGas, type CombustiveisGold, type EventoPesquisa, type IdCombustivel } from "@/lib/gas/gold";
import type { DadosPrecoNoEstado, LinhaUfEnxuta, PrecoBrasil } from "@/components/combustiveis/PrecoNoEstado";

export function goldCombustiveis(): CombustiveisGold {
  return goldGas.combustiveis();
}

/** Preço Brasil do último mês de cada produto, da série publicada. */
export function brasilNoUltimoMes(g: CombustiveisGold): Record<IdCombustivel, PrecoBrasil> {
  const u = g.serie[g.serie.length - 1];
  const out = {} as Record<IdCombustivel, PrecoBrasil>;
  for (const p of g.produtos) {
    out[p.id] = {
      medio: u[p.id] as number,
      minimo: (u[`${p.id}_minimo`] as number | null) ?? null,
      maximo: (u[`${p.id}_maximo`] as number | null) ?? null,
      postos: (u[`${p.id}_postos`] as number | null) ?? null,
    };
  }
  return out;
}

/** O que a primeira tela precisa: último mês, produtos, Brasil e, de cada UF, só os campos que ela mostra. */
export function dadosDoEstado(g: CombustiveisGold): DadosPrecoNoEstado {
  const ufs = g.por_uf.map((u) => {
    const linha = { uf: u.uf, nome: u.nome, etanol_gasolina_pct: u.etanol_gasolina_pct } as LinhaUfEnxuta;
    for (const p of g.produtos) {
      const x = u[p.id];
      linha[p.id] = x ? { medio: x.medio, postos: x.postos, dif_brasil: x.dif_brasil, dif_brasil_pct: x.dif_brasil_pct } : null;
    }
    return linha;
  });
  return { ultimoMes: g.ultimo_mes, produtos: g.produtos, brasil: brasilNoUltimoMes(g), ufs };
}

/** Preço médio de cada UF no último mês, para a comparação entre as UFs. */
export function mediasPorUf(g: CombustiveisGold): ({ uf: string; nome: string } & Record<IdCombustivel, { medio: number } | null>)[] {
  return g.por_uf.map((u) => ({ uf: u.uf, nome: u.nome, ...Object.fromEntries(g.produtos.map((p) => [p.id, u[p.id] ? { medio: u[p.id]!.medio } : null])) }) as { uf: string; nome: string } & Record<IdCombustivel, { medio: number } | null>);
}

/** A série Brasil só com os campos pedidos (sufixos de cada produto), para não mandar ao navegador a série inteira a cada gráfico. */
export function serieCom(g: CombustiveisGold, sufixos: string[]): Record<string, string | number | null>[] {
  return g.serie.map((x) => {
    const o: Record<string, string | number | null> = { mes: x.mes };
    for (const p of g.produtos) for (const s of sufixos) o[`${p.id}${s}`] = x[`${p.id}${s}`] ?? null;
    return o;
  });
}

const ROTULO_EVENTO: Record<EventoPesquisa["tipo"], string> = {
  sem_pesquisa: "Sem pesquisa",
  abrangencia: "Menos municípios",
  amostra_reduzida: "Amostra reduzida",
  outro: "Observação da ANP",
};

/** Marcos dos gráficos: o primeiro mês de cada intervalo descrito nas observações da planilha. */
export function marcosDaPesquisa(g: CombustiveisGold): { x: string; rotulo: string }[] {
  return g.pesquisa.eventos.map((e) => ({
    x: e.tipo === "sem_pesquisa" ? (g.pesquisa.meses_sem_pesquisa.find((m) => e.meses.includes(m)) ?? e.meses[0]) : e.meses[0],
    rotulo: ROTULO_EVENTO[e.tipo],
  }));
}

/** "18/08/2020" a partir de "2020-08-18". */
export function dataNota(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

/**
 * Série mensal de cada UF com duas casas, a precisão que o gráfico e a tabela equivalente mostram (a ANP publica três
 * casas até abril de 2022). Corta o que a página manda ao navegador; o arquivo para baixar mantém o valor publicado.
 */
export function serieUfDuasCasas(g: CombustiveisGold): Record<IdCombustivel, Record<string, (number | null)[]>> {
  const out = {} as Record<IdCombustivel, Record<string, (number | null)[]>>;
  for (const p of g.produtos) {
    out[p.id] = Object.fromEntries(Object.entries(g.serie_uf.valores[p.id]).map(([uf, v]) => [uf, v.map((x) => (x === null ? null : Math.round(x * 100) / 100))]));
  }
  return out;
}
