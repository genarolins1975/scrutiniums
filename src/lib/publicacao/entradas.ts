import dados from "./entradas.json";
import type { Porta } from "@/lib/perguntas/tipos";
import type { Vitrine } from "@/lib/vitrine";
import type { DominioId } from "@/lib/dominios";
import type { SecaoObservatorio } from "@/lib/observatorios/mapaConta";
import type { TotaisInventario } from "@/lib/observatorios/inventario";
import { situacaoDominio, textoSituacao, type DadosFrescor, type DominioFrescorId } from "@/lib/frescor/regras";

/** Derivado da publicação, sem consultas ao banco ou leituras de golds em runtime. */
export const portasPublicadas = dados.portas as Porta[];
export const vitrinesPublicadas = dados.vitrines as Record<DominioId, Vitrine>;
export function atualizacaoPublicada(id: string): { rotulo: string; linhas: string[] } {
  return dados.atualizacoes[id as keyof typeof dados.atualizacoes];
}
export function frescorPublicado(ids: readonly DominioFrescorId[]): DadosFrescor[] {
  return ids.map(id => (dados.frescor as DadosFrescor[]).find(d => d.id === id)!);
}
export function diretorioPublicado(agora = new Date()): { secoes: SecaoObservatorio[]; totais: TotaisInventario } {
  return {
    totais: dados.mapa.totais,
    secoes: (dados.mapa.secoes as SecaoObservatorio[]).map(s => ({ ...s, colecoes: s.colecoes.map(c => {
      const [fonte] = frescorPublicado(c.fontes.slice(0, 1));
      const situacao = fonte ? situacaoDominio(fonte, agora) : null;
      return { ...c, atraso: situacao && (situacao.estado === "atrasado" || situacao.estado === "retida")
        ? textoSituacao(situacao).replace("Publicação retida em parte", "Parte dos dados está com atualização atrasada") : null };
    }) })),
  };
}
