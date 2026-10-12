import PainelEstadual from "@/components/contas-estaduais/PainelEstadual";
import { recorte } from "@/lib/contas-estaduais/dados";
export default function Page({ searchParams }: { searchParams: { uf?: string; ano?: string } }) {
 return <PainelEstadual inicial={recorte(searchParams.uf, searchParams.ano)} />;
}
