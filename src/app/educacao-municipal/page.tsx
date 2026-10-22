import type { Metadata } from "next";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { NavegacaoColecao } from "@/components/layout/NavegacaoColecao";
import { PainelEducacao } from "@/components/educacao/PainelEducacao";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { consultarMunicipio, goldEducacao } from "@/lib/educacao/dados";
import { num } from "@/lib/educacao/formato";
import { PERGUNTA_PAINEL, ROTA_EDUCACAO, SECAO_PAINEL, TITULO_PAINEL } from "@/lib/educacao/paginas";
import { tituloNaColecao } from "@/lib/observatorios/contexto";

/**
 * Painel "Educação nos municípios" (aprovado pelo dono em 20/10/2026), com conta. O endereço é público, mas sem sessão o
 * middleware serve ali a versão aperitivo (src/app/aperitivo/educacao-municipal); esta página só chega a quem tem conta. O
 * município escolhido vive na URL (?ibge=) e é lido no servidor: a gold municipal não vai para o navegador.
 */
export const dynamic = "force-dynamic";

type Busca = { searchParams: Record<string, string | string[] | undefined> };

export function generateMetadata({ searchParams }: Busca): Metadata {
  const g = goldEducacao();
  const c = consultarMunicipio(searchParams.ibge);
  return {
    title: tituloNaColecao(c.estado === "ok" ? `${c.m.nome} (${c.uf}): a escola pública · ${TITULO_PAINEL}` : `${PERGUNTA_PAINEL} · ${TITULO_PAINEL}`, "/educacao-municipal"),
    description: `O Ideb das redes municipais e públicas de ${num(g.municipios.total)} municípios desde ${g.ideb.anos[0]}, com aprendizagem, aprovação, comparação com o estado, o Brasil e cidades do mesmo porte, e as matrículas do Censo Escolar ${g.censo.ano}. Dados do INEP.`,
    alternates: { canonical: ROTA_EDUCACAO },
  };
}

export default function Page({ searchParams }: Busca) {
  const g = goldEducacao();
  const consulta = consultarMunicipio(searchParams.ibge);
  return (
    <>
      <MarcaVisita secao={SECAO_PAINEL} />
      <header>
        <CabecalhoPlataforma observatorio="servicos-publicos" destinoConta="/educacao-municipal" fontes={["educacao"]} />
        <NavegacaoColecao colecao="educacao" />
      </header>
      <PainelEducacao g={g} consulta={consulta} />
    </>
  );
}
