/**
 * Dados da consulta "Quanto custa o botijão de gás no meu estado?" (versão aperitivo de /gas-natural/gas-de-cozinha):
 * só o último mês da pesquisa da ANP, enxuto, para ir no HTML. Nenhum arquivo é buscado no navegador.
 *
 * A média do Brasil é a da própria ANP (série Brasil), não a média simples dos estados. A diferença é calculada aqui,
 * a partir dos dois valores publicados: preço médio do estado menos a média do Brasil, em reais e em percentual da média
 * do Brasil. Ausência continua null; nada é completado nem estimado.
 */
import type { PrecoConsumidorGold } from "./gold";

export type BotijaoUf = { uf: string; nome: string; medio: number; postos: number | null; dif_brasil: number; dif_brasil_pct: number };

export type DadosBotijaoNoEstado = {
  ultimoMes: string;
  brasil: { medio: number; postos: number | null };
  /** Em ordem alfabética do nome. */
  ufs: BotijaoUf[];
};

const arred = (v: number, casas: number) => Math.round(v * 10 ** casas) / 10 ** casas;

export function dadosBotijaoNoEstado(g: PrecoConsumidorGold): DadosBotijaoNoEstado {
  const ponto = g.serie.find((x) => x.mes === g.ultimo_mes);
  if (!ponto || ponto.medio === null) throw new Error(`gold do gás de cozinha sem média Brasil em ${g.ultimo_mes}`);
  const br = ponto.medio;
  const ufs = g.por_uf
    .map((u) => ({
      uf: u.uf,
      nome: u.nome,
      medio: u.medio,
      postos: u.postos,
      dif_brasil: arred(u.medio - br, 2),
      dif_brasil_pct: arred((u.medio / br - 1) * 100, 1),
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return { ultimoMes: g.ultimo_mes, brasil: { medio: br, postos: ponto.postos }, ufs };
}
