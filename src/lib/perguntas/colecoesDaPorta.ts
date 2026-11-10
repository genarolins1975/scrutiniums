/**
 * O bloco "Tudo o que este observatório reúne" da página aberta (/perguntas/[porta]): as coleções do observatório, com exemplos
 * de painéis, a origem dos dados e o retrato de tamanho e prontidão (recomendação 6 do parecer estrutural, "portfólio honesto").
 * Os exemplos e a origem saem do registro; a contagem e o selo, de `retratoDoPortfolio`, a mesma conta do mapa da área logada.
 * Nada é escrito à mão: `src/tests/portfolio-honesto.test.ts` confere os números com o registro.
 */
import { dominio } from "@/lib/dominios";
import { observatorio, paineis } from "@/lib/observatorios/registro";
import { retratoDoPortfolio, type RetratoColecao, type RetratoObservatorio } from "@/lib/observatorios/mapaConta";
import type { PortaId } from "./tipos";

/**
 * Coleção com até quatro painéis de exemplo e o retrato dela (páginas no ar e selo de prontidão), o mesmo da linha do mapa da
 * conta: a entrada mais as páginas do inventário. Subpáginas fora do registro (fichas por município, por exemplo) não contam.
 */
export type ColecaoPorta = { id: string; nome: string; href: string; destaques: string[]; mais: boolean; origens: string; retrato: RetratoColecao };

export function colecoesDaPorta(id: PortaId): { colecoes: ColecaoPorta[]; retrato: RetratoObservatorio } {
  const retrato = retratoDoPortfolio().find((r) => r.id === id);
  if (!retrato) throw new Error(`observatório sem retrato no inventário: ${id}`);
  const o = observatorio(id);
  const todos = paineis();
  const colecoes = o.colecoes.map((c): ColecaoPorta => {
    const retratoDaColecao = retrato.colecoes.find((x) => x.id === c.id);
    if (!retratoDaColecao) throw new Error(`coleção sem retrato no inventário: ${id}/${c.id}`);
    const proprios = todos.filter((p) => p.observatorio === id && p.colecao === c.id);
    const origens = Array.from(new Set(proprios.map((p) => (p.origem ? dominio(p.origem).nomeCurto : o.nomeCurto))));
    const destaques = proprios.filter((p) => p.rota !== c.href).map((p) => p.titulo);
    return { id: c.id, nome: c.nome, href: c.href, destaques: destaques.slice(0, 4), mais: destaques.length > 4, origens: `vem de ${origens.join(" e ")}`, retrato: retratoDaColecao };
  });
  return { colecoes, retrato };
}
