import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { COR } from "@/lib/gas/cores";
import { mesExtenso, num, reais } from "@/lib/gas/formato";
import type { CombustiveisGold, IdCombustivel } from "@/lib/gas/gold";
import { dataNota, marcosDaPesquisa, serieCom } from "@/lib/combustiveis/dados";

const CORES: Record<IdCombustivel, string> = { gasolina: COR.foco, etanol: COR.comp[0], diesel: COR.comp[1], diesel_s10: COR.comp[2] };

/**
 * Artefato do mecanismo: como a ANP chega ao preço médio que o painel mostra. Não há modelo nem número digitado: as etapas
 * descrevem o que a planilha publica (colunas e observações), a amostra é a série de postos pesquisados e a conferência da
 * média nacional usa os valores do último mês. A composição do preço (refinaria, impostos, distribuição e revenda) não
 * entra porque o pipeline não coleta uma fonte oficial para ela.
 */
export function ComoAnpMede({ g }: { g: CombustiveisGold }) {
  const mes = mesExtenso(g.ultimo_mes);
  const gas = g.pesquisa.conferencia_ultimo_mes.find((c) => c.produto === "gasolina")!;
  const eta = g.pesquisa.conferencia_ultimo_mes.find((c) => c.produto === "etanol")!;
  const comPostos = g.por_uf.filter((u) => u.gasolina?.postos != null);
  const menor = comPostos.reduce((a, b) => ((b.gasolina!.postos as number) < (a.gasolina!.postos as number) ? b : a));
  const maior = comPostos.reduce((a, b) => ((b.gasolina!.postos as number) > (a.gasolina!.postos as number) ? b : a));
  const lacuna = g.pesquisa.eventos.find((e) => e.tipo === "sem_pesquisa");
  const etapas = [
    {
      titulo: "Postos da amostra",
      texto: `A ANP pesquisa uma amostra de postos, não todos. Em ${mes}, informou ${num(gas.postos_brasil, 0)} postos pesquisados para a gasolina comum no Brasil, de ${num(menor.gasolina!.postos as number, 0)} (${menor.nome}) a ${num(maior.gasolina!.postos as number, 0)} (${maior.nome}).`,
    },
    {
      titulo: "Preço na bomba",
      texto: "O preço pesquisado é o de revenda: o que o posto cobra do consumidor, em reais por litro. É ele que a planilha resume como preço médio de revenda.",
    },
    {
      titulo: "Resumo do mês",
      texto: "Para cada estado e para o Brasil, a planilha mensal traz a média, o desvio padrão, o menor e o maior preço encontrados e o número de postos pesquisados.",
    },
    {
      titulo: "Média do Brasil",
      texto: `A média nacional é calculada pela própria ANP e não é a média dos estados. Em ${mes}, a gasolina comum teve média Brasil de ${reais(gas.media_anp, 2)}; a média simples das UFs daria ${reais(gas.media_simples_ufs, 2)}, e a média das UFs ponderada pelos postos, ${reais(gas.media_ponderada_postos_ufs, 2)}. No etanol, ${reais(eta.media_anp, 2)}, ${reais(eta.media_simples_ufs, 2)} e ${reais(eta.media_ponderada_postos_ufs, 2)}. A planilha não descreve a ponderação.`,
    },
  ];
  return (
    <div className="space-y-6">
      <ol className="grid gap-x-6 gap-y-5 md:grid-cols-2 xl:grid-cols-4">
        {etapas.map((e, i) => (
          <li key={e.titulo} className="min-w-0 border-t border-linha pt-3">
            <p className="flex items-baseline gap-2 text-carvao">
              <span aria-hidden="true" className="font-serif text-2xl leading-none text-gas-dark">{i + 1}</span>
              <span className="font-serif text-lg leading-snug">{e.titulo}</span>
            </p>
            <p className="mt-2 text-sm leading-relaxed text-carvao-muted">{e.texto}</p>
          </li>
        ))}
      </ol>
      <p className="max-w-prose2 text-xs leading-relaxed text-mineral">
        Conferência da Scrutiniums com os números da planilha: a soma dos postos das 27 UFs é igual ao total do Brasil em todos os{" "}
        {g.pesquisa.conferencia_postos.meses_produtos_conferidos.toLocaleString("pt-BR")} pares de mês e produto publicados; a publicação
        é retida se algum divergir. As etapas descrevem o que a planilha publica; o método completo da pesquisa está na página da ANP.
      </p>
      <figure className="space-y-2">
        <figcaption className="text-sm text-carvao">
          Postos pesquisados por mês no Brasil, desde janeiro de 2013. Quantidade informada pela ANP na série mensal; a planilha não diz se um posto
          pesquisado em mais de uma semana do mês conta uma vez ou mais.
        </figcaption>
        <GraficoLinhas
          titulo="Postos pesquisados por mês, Brasil"
          dados={serieCom(g, ["_postos"])}
          chaveX="mes"
          formatoX="mes"
          unidade="postos"
          casas={0}
          zeroNoEixo
          zoom
          legendaInterativa
          chaveUrl="postos"
          marcos={marcosDaPesquisa(g)}
          series={g.produtos.map((p, i) => ({ id: `${p.id}_postos`, rotulo: p.nome, sigla: p.curto, cor: CORES[p.id], espessura: i === 0 ? 2.5 : 2, tracejada: p.id === "diesel_s10" }))}
        />
      </figure>
      {lacuna && (
        <p className="max-w-prose2 border-l-2 border-gas pl-3 text-sm leading-relaxed text-carvao">
          Não houve pesquisa de {dataNota(lacuna.inicio)} a {dataNota(lacuna.fim)}: {g.pesquisa.meses_sem_pesquisa.map(mesExtenso).join(", ")} fica sem preço nos
          gráficos (lacuna, não zero); {g.pesquisa.meses_parciais.map(mesExtenso).join(" e ")} têm só parte do mês pesquisada, e os preços desses meses
          são os que a ANP publicou.
        </p>
      )}
    </div>
  );
}
