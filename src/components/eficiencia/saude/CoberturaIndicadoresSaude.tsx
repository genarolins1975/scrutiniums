import { TabelaDados } from "@/components/painel";
import type { GoldSaude } from "@/lib/eficiencia/saude/tipos";
import { competenciaBr } from "@/lib/eficiencia/saude/mensal";

/** Inventário de todas as linhas, inclusive componentes e bases monetárias; não é uma contagem de pessoas. */
export function CoberturaIndicadoresSaude({ gold: g }: { gold: GoldSaude }) {
  const linhas = g.indicadores.map((f) => {
    const obs = g.observacoes.filter((o) => o.indicador === f.id);
    const anos = [...new Set(obs.map((o) => o.ano))].sort();
    const comValor = obs.filter((o) => o.valor !== null);
    return [f.nome_curto, anos.length ? `${anos[0]}–${anos.at(-1)}` : "Não publicado", new Set(comValor.map((o) => o.ente)).size, comValor.length, obs.length - comValor.length];
  });
  const pendentes = g.indicadores.filter((f) => f.estado === "NAO_PUBLICAVEL");
  return <div>
    <p className="t-meta text-carvao-muted sm:hidden">Ao abrir a tabela, deslize para a direita para consultar também os registros sem valor.</p>
    <TabelaDados idioma="pt" recolhida titulo="Cobertura dos indicadores de Saúde nas capitais" colunas={["Indicador", "Período na base", "Capitais com algum valor", "Registros com valor", "Registros sem valor"]} linhas={linhas} limite={linhas.length} casas={[null, null, 0, 0, 0]} fixarPrimeiraColuna nota="Registros incluem componentes, bases monetárias e anos distintos. Ter algum valor não significa cobertura integral nem elegibilidade para comparação. Consulte a ficha e os estados de cada registro no CSV; indicadores não publicados não têm registros." />
    {g.aps_mensal && <p className="mt-4 max-w-prose2 text-sm leading-relaxed text-carvao-muted">A consulta mensal da APS acrescenta {g.aps_mensal.linhas.length.toLocaleString("pt-BR")} registros capital/mês, de {competenciaBr(g.aps_mensal.competencias[0])} a {competenciaBr(g.aps_mensal.competencias.at(-1)!)}. São 11 campos por registro, incluindo sete tipos de equipe. Não são 11 novos indicadores independentes. A série de 2021 tem regra anterior; 2026 permanece provisório por cadastro vinculado incompleto.</p>}
    <p className="mt-4 max-w-prose2 text-sm leading-relaxed text-carvao-muted">Ainda sem publicação: {pendentes.map((f) => f.nome_curto).join("; ")}. A matriz de fontes abaixo registra os motivos. Divergências nas aberturas contábeis permanecem sem valor; não são completadas por rateio.</p>
  </div>;
}
