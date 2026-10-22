import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import PainelEstadual from "@/components/contas-estaduais/PainelEstadual";
import { lerFiltrosComparacao } from "@/lib/contas-estaduais/comparacao";
import { recorte } from "@/lib/contas-estaduais/dados";
import { RotuloContexto } from "@/components/layout/RotuloContexto";
import aberturaStyles from "@/components/observatorios/EntradaEstado.module.css";
export default function Page({ searchParams }: { searchParams: { uf?: string; ano?: string; indicador?: string; regiao?: string; df?: string; ordem?: string } }) {
 return <><MarcaVisita secao="estados:ficha" /><PainelEstadual inicial={recorte(searchParams.uf, searchParams.ano)} comparacaoInicial={lerFiltrosComparacao(searchParams)} rotulo={<RotuloContexto rota="/contas-publicas-estaduais" className={`rotulo ${aberturaStyles.eyebrow}`} />} /></>;
}
