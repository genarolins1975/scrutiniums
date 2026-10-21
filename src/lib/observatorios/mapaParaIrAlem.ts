/**
 * Dados do bloco "Para ir além" (ParaIrAlem), lidos do registro: os painéis
 * com dono, os atalhos e a identidade dos observatórios. Serializáveis, para o
 * componente do navegador resolver o painel corrente pelo endereço.
 */
import { ATALHOS, OBSERVATORIOS, paineis } from "./registro";
import { destinoObservatorio } from "./lista";

export type MapaParaIrAlem = {
  paineis: { rota: string; observatorio: string; colecao: string }[];
  atalhos: { rota: string; observatorio: string; colecao: string }[];
  observatorios: { id: string; nome: string; destino: string; colecoes: { id: string; nome: string; href: string }[] }[];
};

let cache: MapaParaIrAlem | null = null;

export function mapaParaIrAlem(): MapaParaIrAlem {
  cache ??= {
    // sem títulos: dependem do idioma da página, e o bloco só nomeia observatórios e coleções
    paineis: paineis().map((p) => ({ rota: p.rota, observatorio: p.observatorio, colecao: p.colecao })),
    atalhos: ATALHOS.map((a) => ({ rota: a.rota, observatorio: a.observatorio, colecao: a.colecao })),
    observatorios: OBSERVATORIOS.map((o) => ({ id: o.id, nome: o.nome, destino: destinoObservatorio(o), colecoes: o.colecoes.map((c) => ({ id: c.id, nome: c.nome, href: c.href })) })),
  };
  return cache;
}
