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
      itens.push(`O Ideb ${rede} ano a ano, de ${anosRede[0]} a ${anosRede[anosRede.length - 1]}, nos anos iniciais e nos finais quando houver, com a meta do primeiro ciclo do INEP, que foi até 2021`);
    } else if (anosRede.length === 1) {
      itens.push(`O Ideb ${rede} em ${anosRede[0]}, com todas as partes do cálculo (o INEP não publicou outros anos para ela)`);
    }
    itens.push("Do que o Ideb é feito: a taxa de aprovação e as notas do Saeb em português e matemática a cada edição, e um laboratório que mostra como aprendizagem e aprovação formam o índice");
    const temIdebRecente = ETAPAS.some((e) => m[e].municipal?.ideb[anos.length - 1] != null);
    const nUf = g.distribuicao.ai.ufs[uf]?.n;
    itens.push(
      temIdebRecente && nUf
        ? `A comparação com o estado (a rede pública ${doEstado} e a mediana das ${num(nUf)} redes municipais com Ideb ${ano}), com o Brasil e a posição da rede entre elas`
        : `A comparação com o estado (a rede pública ${doEstado} e a mediana das redes municipais) e com o Brasil`,
    );
    const porte = rotuloPorte(g, m.porte);
    const nPorte = m.porte ? g.distribuicao.ai.portes[m.porte]?.n : null;
    if (porte && nPorte) itens.push(`A distribuição do Ideb ${ano} entre as ${num(nPorte)} redes municipais de cidades do mesmo porte (${porte.toLowerCase()}), com o lugar do seu município nela`);
    if (m.censo) {
      itens.push(
        m.censo.mat_municipal > 0
          ? `As matrículas da rede municipal por etapa (creche, pré escola, anos iniciais e finais) e as escolas, urbanas e rurais, do Censo Escolar ${g.censo.ano}, ao lado do estado`
          : `As matrículas e as escolas públicas do Censo Escolar ${g.censo.ano}, por rede (o município não tem rede municipal com alunos)`,
      );
    }
  } else {
    itens.push(`O Ideb de cada rede municipal e da rede pública de ${num(g.municipios.total)} municípios ano a ano, de ${anos[0]} a ${ano}, com a meta do primeiro ciclo do INEP, que foi até 2021`);
    itens.push("Do que o Ideb é feito: a taxa de aprovação e as notas do Saeb em português e matemática a cada edição, e um laboratório que mostra como aprendizagem e aprovação formam o índice");
    itens.push(`A comparação de cada município com o estado, com o Brasil e com as cidades do mesmo porte (${g.portes.length} faixas de população do IBGE)`);
    itens.push(`As matrículas e as escolas de cada rede municipal, por etapa, do Censo Escolar ${g.censo.ano}`);
  }
  itens.push(`Os 27 estados lado a lado, as redes municipais por porte de cidade e, para cada etapa, quantos municípios ficaram sem Ideb ${ano} e por quê`);
  itens.push("Os arquivos para baixar (CSV): Ideb e componentes por município desde " + anos[0] + ", matrículas e escolas por município e o resumo por estado");
  return itens;
}
