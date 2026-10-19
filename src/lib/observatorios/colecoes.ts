/**
 * Coleções de um observatório com os painéis próprios e os atalhos, para as
 * entradas com conta (src/app/observatorios/[id] e src/app/territorio). Cada atalho
 * leva o nome da coleção que mantém o painel.
 */
import { ATALHOS, observatorio, paineis, type ObservatorioId } from "@/lib/observatorios/registro";
import { dominio } from "@/lib/dominios";

export type ColecaoEntrada = {
  id: string;
  nome: string;
  href: string;
  /** Painéis que a coleção mantém e atalhos para painéis de outro observatório, com a coleção de origem. */
  paineis: { titulo: string; href: string; origem?: string }[];
};

export function colecoesDe(id: ObservatorioId): ColecaoEntrada[] {
  const todos = paineis();
  return observatorio(id).colecoes.map((c) => {
    const daColecao = todos.filter((p) => p.observatorio === id && p.colecao === c.id);
    const rotas = new Set(daColecao.map((p) => p.rota));
    // duplicata sai só quando o painel dono do tema está na mesma lista
    const proprios = daColecao.filter((p) => !(p.duplicataDe && rotas.has(p.duplicataDe))).map((p) => ({ titulo: p.titulo, href: p.rota }));
    const atalhos = ATALHOS.filter((x) => x.observatorio === id && x.colecao === c.id).flatMap((x) => {
      const dono = todos.find((p) => p.rota === x.rota);
      return dono ? [{ titulo: dono.titulo, href: dono.rota, origem: dono.origem ? dominio(dono.origem).nomeCurto : observatorio(dono.observatorio).nomeCurto }] : [];
    });
    return { id: c.id, nome: c.nome, href: c.href, paineis: [...proprios, ...atalhos] };
  });
}
