import "@/components/previdencia/previdencia.css";
import type { Metadata } from "next";
import Link from "next/link";
import { RecorteCompartilhavel } from "@/components/contas-publicas/RecorteCompartilhavel";
import { PainelPrevidencia } from "@/components/previdencia/PainelPrevidencia";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { PAINEIS_NAVEGACAO } from "@/lib/contas-publicas/catalogo";
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
    title: `${PERGUNTA_PAINEL} · Previdência e INSS · Contas Públicas`,
    description: `Benefícios do INSS por tipo, por estado e por município, com a série desde ${g.serie.meses[0].slice(0, 4)} e o resultado do Regime Geral desde ${g.rgps.anos[0]}, pelos dados do Ministério da Previdência Social e do Tesouro Nacional.`,
    alternates: { canonical: ROTA_PREVIDENCIA },
  };
}

export default function Page({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const g = goldPrevidencia();
  const consulta = consultarMunicipio(searchParams.ibge);
  return (
    <main id="conteudo-contas" className="cp-wrap cp-main pv-root" data-painel="previdencia">
      <MarcaVisita secao={SECAO_PAINEL} />
      <div className="cp-breadcrumb">
        <Link href="/contas-publicas#capitulos">← Todos os temas</Link>
        <span>
          Complemento do capítulo&nbsp;<Link href="/contas-publicas/panorama">Panorama das contas</Link>
        </span>
      </div>
      <header className="cp-chapter-header pv-cabeca">
        <h1>{PERGUNTA_PAINEL}</h1>
        <p className="pv-lead">
          Os benefícios do INSS por tipo, por estado e no seu município, e quanto o Regime Geral arrecada e paga a cada ano. Dados do Ministério da Previdência Social e do Tesouro Nacional.
        </p>
      </header>
      <PainelPrevidencia
        g={g}
        consulta={consulta}
        ferramentas={
          <div className="cp-chapter-tools">
            <nav className="cp-panel-nav" aria-label="Painéis com dados">
              {PAINEIS_NAVEGACAO.map(([href, nome]) => (
                <Link key={href} href={href} aria-current={href === ROTA_PREVIDENCIA ? "page" : undefined}>
                  {nome}
                </Link>
              ))}
            </nav>
            <RecorteCompartilhavel />
          </div>
        }
      />
    </main>
  );
}
