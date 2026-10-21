import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoEducacao } from "@/components/educacao/CabecalhoEducacao";
import { PainelEducacao } from "@/components/educacao/PainelEducacao";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { consultarMunicipio, goldEducacao } from "@/lib/educacao/dados";
import { dataBr, num } from "@/lib/educacao/formato";
import { PERGUNTA_PAINEL, ROTA_EDUCACAO, SECAO_PAINEL, TITULO_PAINEL } from "@/lib/educacao/paginas";

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
    title: c.estado === "ok" ? `${c.m.nome} (${c.uf}): a escola pública · ${TITULO_PAINEL}` : `${PERGUNTA_PAINEL} · ${TITULO_PAINEL} · Serviços Públicos`,
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
      <CabecalhoEducacao />
      <main id="conteudo-educacao" className="ed-pagina edm-main" data-painel="educacao-municipal">
        <nav className="edm-trilha" aria-label="Você está em">
          <Link href="/observatorios/servicos-publicos">Observatório dos Serviços Públicos</Link>
          <span>Coleção Educação</span>
        </nav>
        <header className="edm-cabeca">
          <h1>{PERGUNTA_PAINEL}</h1>
          <p className="edm-lead">
            O Ideb, a aprendizagem e a aprovação das escolas municipais e públicas de cada cidade, com as matrículas e as escolas da rede. Dados do INEP: Ideb {g.ideb.ano}, divulgado em{" "}
            {dataBr(g.fontes.ideb.publicado_em)}, e Censo Escolar {g.censo.ano}.
          </p>
        </header>
        <PainelEducacao g={g} consulta={consulta} />
      </main>
    </>
  );
}
