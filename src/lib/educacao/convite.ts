import { anosComIdeb, rotuloPorte } from "./dados";
import { num } from "./formato";
import { DO_ESTADO } from "@/lib/previdencia/paginas";
import { ETAPAS, type GoldEducacao, type MunicipioGold } from "./tipos";

/**
 * O que o painel completo mostra a mais (decisão do dono de 20/10/2026), na ordem das seções dele
 * (src/components/educacao/PainelEducacao.tsx), dimensionado pela própria gold. Com o município escolhido, cada item
 * fala do que ele tem: a série começa no primeiro ano com Ideb da rede dele (não no primeiro ano do INEP), a posição no
 * estado só aparece quando a rede municipal tem Ideb no ano mais recente, e o porte é o dele.
 */
export function comConta(g: GoldEducacao, municipio?: { m: MunicipioGold; uf: string } | null): string[] {
  const anos = g.ideb.anos;
  const ano = g.ideb.ano;
  const itens: string[] = [];
  if (municipio) {
    const { m, uf } = municipio;
    const doEstado = DO_ESTADO[uf] ?? `de ${uf}`;
    // a rede que o município tem: a municipal quando ela tem Ideb em algum ano; senão a pública toda
    const anosMun = [...new Set(ETAPAS.flatMap((e) => anosComIdeb(m[e].municipal, anos)))].sort();
    const anosPub = [...new Set(ETAPAS.flatMap((e) => anosComIdeb(m[e].publica, anos)))].sort();
    const [rede, anosRede] = anosMun.length ? ["da rede municipal", anosMun] : ["da rede pública", anosPub];
    if (anosRede.length > 1) {
      itens.push(`Ficha da cidade: Ideb ${rede} de ${anosRede[0]} a ${anosRede[anosRede.length - 1]}, nas duas etapas quando houver, e as ${g.ideb.anos_meta.length} metas por edição do INEP`);
    } else if (anosRede.length === 1) {
      itens.push(`O Ideb ${rede} em ${anosRede[0]}, com todas as partes do cálculo (o INEP não publicou outros anos para ela)`);
    }
    itens.push("Componentes, tabelas e laboratório: aprendizagem e aprovação, com decomposição entre edições quando houver dados");
    const temIdebRecente = ETAPAS.some((e) => m[e].municipal?.ideb[anos.length - 1] != null);
    const nUf = g.distribuicao.ai.ufs[uf]?.n;
    itens.push(
      temIdebRecente && nUf
        ? `Estado, Brasil e ${num(nUf)} redes municipais com Ideb ${ano}: a posição da rede entre elas`
        : `Comparação com a rede pública ${doEstado}, a mediana municipal do estado e o Brasil`,
    );
    const porte = rotuloPorte(g, m.porte);
    const nPorte = m.porte ? g.distribuicao.ai.portes[m.porte]?.n : null;
    if (porte && nPorte) itens.push(`Distribuições do Brasil, estado e ${num(nPorte)} redes do mesmo porte (${porte.toLowerCase()}), com sua cidade marcada`);
    if (m.censo) {
      itens.push(
        m.censo.mat_municipal > 0
          ? `Composição das matrículas por rede e etapa, escolas municipais e Censo Escolar ${g.censo.ano}`
          : `As matrículas e as escolas públicas do Censo Escolar ${g.censo.ano}, por rede (o município não tem rede municipal com alunos)`,
      );
    }
  } else {
    itens.push(`Fichas de ${num(g.municipios.total)} municípios: Ideb das redes municipal e pública de ${anos[0]} a ${ano}, com as ${g.ideb.anos_meta.length} metas por edição do INEP`);
    itens.push("Componentes, tabelas e laboratório: aprendizagem e aprovação, com decomposição entre edições quando houver dados");
    itens.push(`A comparação de cada município com o estado, com o Brasil e com as cidades do mesmo porte (${g.portes.length} faixas de população do IBGE)`);
    itens.push(`As matrículas e as escolas de cada rede municipal, por etapa, do Censo Escolar ${g.censo.ano}`);
  }
  itens.push(`Mapa de ${num(g.municipios.total)} municípios e séries de ${Object.keys(g.municipios.por_uf).length} UFs, com os motivos de ausência`);
  itens.push("Arquivos CSV: Ideb e componentes desde " + anos[0] + ", matrículas, escolas e resumo por estado");
  return itens;
}
