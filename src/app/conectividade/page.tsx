import type { Metadata } from "next";
import { PainelConectividade } from "@/components/conectividade/PainelConectividade";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { consultarMunicipio, goldConectividade } from "@/lib/conectividade/dados";
import { mesAcessos, mesExtenso } from "@/lib/conectividade/formato";
import { PERGUNTA_PAINEL, ROTA_CONECTIVIDADE, SECAO_PAINEL } from "@/lib/conectividade/paginas";

/**
 * Painel "Conectividade", com conta. O endereço é público, mas sem sessão o middleware serve ali a versão aperitivo
 * (src/app/aperitivo/conectividade); esta página só chega a quem tem conta. O município escolhido vive na URL (?ibge=)
 * e é lido no servidor: a gold municipal não vai para o navegador.
 */
export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  const g = goldConectividade();
  return {
    title: `${PERGUNTA_PAINEL} · Conectividade · Energia e Infraestrutura`,
    description: `Banda larga fixa, linhas móveis e cobertura 4G e 5G por município e estado, cada medida só onde a Anatel a publica, com ${mesAcessos(g.referencia)} e cobertura de ${mesExtenso(g.referencia.cobertura)}, pelos dados abertos da Anatel.`,
    alternates: { canonical: ROTA_CONECTIVIDADE },
  };
}

export default function Page({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const g = goldConectividade();
  const consulta = consultarMunicipio(searchParams.ibge);
  return (
    <>
      <CabecalhoPlataforma observatorio="energia-e-infraestrutura" destinoConta={ROTA_CONECTIVIDADE} fontes={["conectividade"]} />
      <main id="conteudo" className="cn-wrap cn-main" data-painel="conectividade">
        <MarcaVisita secao={SECAO_PAINEL} />
        <header className="cn-cabeca">
          <h1>{PERGUNTA_PAINEL}</h1>
          <p className="cn-lead">
            Quantos acessos de internet há em cada cidade, por fibra ou não, quantas empresas disputam o cliente, e quem está dentro da cobertura 4G e 5G. Dados abertos da Anatel,
            município a município.
          </p>
        </header>
        <PainelConectividade g={g} consulta={consulta} />
      </main>
    </>
  );
}
