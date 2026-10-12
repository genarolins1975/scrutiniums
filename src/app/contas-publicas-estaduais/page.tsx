import PainelEstadual from "@/components/contas-estaduais/PainelEstadual";
import { lerFiltrosComparacao } from "@/lib/contas-estaduais/comparacao";
import { recorte } from "@/lib/contas-estaduais/dados";
export default function Page({ searchParams }: { searchParams: { uf?: string; ano?: string; indicador?: string; regiao?: string; df?: string; ordem?: string } }) {
 return <PainelEstadual inicial={recorte(searchParams.uf, searchParams.ano)} comparacaoInicial={lerFiltrosComparacao(searchParams)} />;
}
