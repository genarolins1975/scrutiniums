import "@/components/previdencia/previdencia.css";
import type { Metadata } from "next";
import { RecorteCompartilhavel } from "@/components/contas-publicas/RecorteCompartilhavel";
import { PainelPrevidencia } from "@/components/previdencia/PainelPrevidencia";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { consultarMunicipio, goldPrevidencia } from "@/lib/previdencia/dados";
import { PERGUNTA_PAINEL, ROTA_PREVIDENCIA, SECAO_PAINEL } from "@/lib/previdencia/paginas";

/**
 * Painel "Previdência e INSS" (aprovado pelo dono em 20/10/2026), com conta. O endereço é público, mas sem sessão o
 * middleware serve ali a versão aperitivo (src/app/aperitivo/previdencia); esta página só chega a quem tem conta. O
 * município escolhido vive na URL (?ibge=) e é lido no servidor: a gold municipal não vai para o navegador.
 */
export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  const g = goldPrevidencia();
  return {
    title: `${PERGUNTA_PAINEL} · Previdência e INSS`,
    description: `Benefícios do INSS por tipo, por estado e por município, com a série desde ${g.serie.meses[0].slice(0, 4)} e o resultado do Regime Geral desde ${g.rgps.anos[0]}, pelos dados do Ministério da Previdência Social e do Tesouro Nacional.`,
    alternates: { canonical: ROTA_PREVIDENCIA },
  };
}

export default function Page({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const g = goldPrevidencia();
  const consulta = consultarMunicipio(searchParams.ibge);
  return (
    <>
      <MarcaVisita secao={SECAO_PAINEL} />
      <PainelPrevidencia
        g={g}
        consulta={consulta}
        ferramentas={
          // os outros painéis estão na navegação da coleção (NavegacaoColecao), acima do título
          <div className="cp-chapter-tools">
            <RecorteCompartilhavel />
          </div>
        }
      />
    </>
  );
}
