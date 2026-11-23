import type { Metadata } from "next";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { NavegacaoColecao } from "@/components/layout/NavegacaoColecao";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { EntradaVarejo } from "@/components/varejo/EntradaVarejo";
import { tituloNaColecao } from "@/lib/observatorios/contexto";
import { goldEmpresas, goldSetor } from "@/lib/varejo/dados";
import { mesExtenso } from "@/lib/varejo/formato";
import { paginaVarejo, PERGUNTA_ENTRADA, ROTA_VAREJO } from "@/lib/varejo/paginas";

/**
 * Entrada da coleção Varejo, com conta. O endereço é público, mas sem sessão o middleware serve ali a versão aperitivo
 * (src/app/aperitivo/varejo); esta página só chega a quem tem conta. Estática: lê as golds no build.
 */
export const dynamic = "force-static";

export function generateMetadata(): Metadata {
  const g = goldSetor();
  return {
    title: tituloNaColecao(PERGUNTA_ENTRADA, ROTA_VAREJO),
    description: `As vendas do comércio varejista até ${mesExtenso(g.referencia.pmc)}, em volume e em receita, o tamanho do mercado na pesquisa anual de ${g.pac.ano} e o caminho de R$ 100 de venda até o lucro, pelas pesquisas do IBGE e pelos dados da CVM.`,
    alternates: { canonical: ROTA_VAREJO },
  };
}

export default function Page() {
  return (
    <>
      <header>
        <CabecalhoPlataforma observatorio="economia" destinoConta={ROTA_VAREJO} fontes={["varejo"]} />
        <NavegacaoColecao colecao="varejo" />
      </header>
      <MarcaVisita secao={paginaVarejo("inicio").secao} />
      <EntradaVarejo g={goldSetor()} e={goldEmpresas()} />
    </>
  );
}
