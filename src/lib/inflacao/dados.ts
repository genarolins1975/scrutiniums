/**
 * Leitura da gold do IPCA por área (public/inflacao/gold/ipca.json) para o painel e a consulta, somente no servidor.
 * Nada aqui calcula variação: os números vêm prontos da gold (pipeline/inflacao/gold.py). Este módulo só escolhe o
 * recorte que cada página manda ao navegador; a consulta aberta recebe só o último mês.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BRASIL, type AreaNaTela, type AreaNoArtefato, type DadosPrimeiraTela, type DestaquesArea, type GoldInflacao, type Referencia } from "./tipos";

export { BRASIL };

export const ARQUIVO_GOLD = join("public", "inflacao", "gold", "ipca.json");

let cache: GoldInflacao | null = null;

export function goldInflacao(): GoldInflacao {
  cache ??= JSON.parse(readFileSync(join(process.cwd(), ARQUIVO_GOLD), "utf-8")) as GoldInflacao;
  return cache;
}

export function referencia(g: GoldInflacao): Referencia {
  return { ultimoMes: g.ultimo_mes, inicioJanela: g.inicio_janela, divulgadoEm: g.fonte.divulgado_em, tabela: g.fonte.tabela };
}

/** Primeira tela (painel e consulta): o índice geral e os nove grupos de cada área no último mês. */
export function primeiraTela(g: GoldInflacao): DadosPrimeiraTela {
  const areas: AreaNaTela[] = g.areas.map((a) => {
    const u = g.ultimo[a.id];
    return {
      ...a,
      geral: { mensal: u.geral.mensal, ano: u.geral.ano, doze: u.geral.doze, dif: u.geral.dif_brasil_pp },
      grupos: Object.fromEntries(g.grupos.map((gr) => [gr.id, { doze: u.grupos[gr.id].doze, peso: u.grupos[gr.id].peso, dif: u.grupos[gr.id].dif_brasil_pp }])),
    };
  });
  return { ref: referencia(g), grupos: g.grupos, areas };
}

/** O artefato do mecanismo: pesos no início da janela de 12 meses, variação e contribuição de cada grupo. */
export function artefato(g: GoldInflacao): AreaNoArtefato[] {
  return g.areas.map((a) => {
    const u = g.ultimo[a.id];
    return {
      id: a.id,
      grupos: Object.fromEntries(
        g.grupos.map((gr) => {
          const x = u.grupos[gr.id];
          return [gr.id, { pesoInicio: x.peso_inicio, peso: x.peso, doze: x.doze, contribuicao: x.contribuicao_pp }];
        }),
      ),
      doze: u.geral.doze,
      soma: u.soma_contribuicoes_pp,
      residuo: u.residuo_pp,
    };
  });
}

/** Série do índice geral de cada área, mês a mês: variação mensal e em 12 meses. */
export function series(g: GoldInflacao): { meses: string[]; porArea: Record<string, { mensal: (number | null)[]; doze: (number | null)[] }> } {
  return { meses: g.meses, porArea: g.serie };
}

/** Os produtos e serviços que mais subiram e mais caíram em cada área, só entre os de peso mínimo (regra da gold). */
export function destaques(g: GoldInflacao, n = 8): Record<string, DestaquesArea> {
  const out: Record<string, DestaquesArea> = {};
  for (const a of g.areas) {
    const porId = new Map(g.subitens[a.id].map((s) => [s.id, s]));
    const d = g.destaques[a.id];
    const lista = (ids: string[]) =>
      ids.slice(0, n).map((id) => {
        const s = porId.get(id)!;
        return { nome: s.nome, grupo: s.grupo, doze: s.doze, peso: s.peso, contribuicao: s.contribuicao_pp };
      });
    out[a.id] = { sobem: lista(d.sobem), caem: lista(d.caem), elegiveis: d.elegiveis, naCesta: d.na_cesta, pesoElegiveis: d.peso_elegiveis };
  }
  return out;
}

/** O número de manchete das entradas e da camada aberta: o IPCA em 12 meses no Brasil, com o mês e a fonte. */
export function manchete(g: GoldInflacao = goldInflacao()): { doze: number; mes: string; maior: { nome: string; doze: number }; menor: { nome: string; doze: number } } {
  const areas = g.areas.filter((a) => a.id !== BRASIL).map((a) => ({ nome: a.nome, doze: g.ultimo[a.id].geral.doze }));
  const ord = [...areas].sort((x, y) => y.doze - x.doze || x.nome.localeCompare(y.nome, "pt-BR"));
  return { doze: g.ultimo[BRASIL].geral.doze, mes: g.ultimo_mes, maior: ord[0], menor: ord[ord.length - 1] };
}
