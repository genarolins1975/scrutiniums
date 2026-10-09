import type { Metadata } from "next";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { AbreDetalhesAoImprimir } from "@/components/energia/AbreDetalhesAoImprimir";
import { AprendaIndice } from "@/components/energia/AprendaIndice";
import { AprendaTrilhas } from "@/components/energia/AprendaPagina";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { estadosDoAcervo, gruposDoIndice, recorteDoAcervo, resumoDoAcervo } from "@/lib/energia/conteudo/aprenda-indice";
import { PAGINAS_MAPA } from "@/lib/energia/mapa";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Aprenda: base de conhecimento do setor elétrico",
  description:
    "PLD, CMO, EAR, ENA, tarifa, perdas, DEC e FEC, Tarifa Social, fator de emissão e outros conceitos, cada um com fonte oficial e data de conferência, unidade, exemplo real com a ficha Comprove, o que não confundir e trilhas que ligam os conceitos aos números.",
  alternates: { canonical: "/setor-eletrico/aprenda" },
};

/**
 * Índice do Aprenda, a abertura do módulo: a pergunta da página (a mesma do mapa e do menu), o escopo dos verbetes em uma frase, a busca,
 * as trilhas como capítulos e, por tema, os verbetes curtos, cada um com a pergunta prática, o nome e o link direto ao painel onde o
 * conceito aparece. Tudo lido do acervo de verbetes (aprenda-indice.ts): contagens, estados e datas não são escritos aqui.
 */
export default function AprendaPage() {
  const grupos = gruposDoIndice();
  const resumo = resumoDoAcervo();
  return (
    <>
      <CabecalhoEnergia atual="aprenda" />
      <MarcaVisita secao="energia:aprenda" />
      <AbreDetalhesAoImprimir />
      <main id="conteudo" tabIndex={-1} className="ed-pagina pb-16" data-tipo-pagina="indice">
        <CabecalhoModulo recolher={false}
          titulo={PAGINAS_MAPA.aprenda.pergunta}
          lead="Os verbetes cobrem os conceitos que aparecem nos painéis deste observatório, não todo o vocabulário do setor. Procure um termo ou comece por uma trilha, que liga os conceitos aos números."
          recorte={recorteDoAcervo(resumo)}
          fonte="documentos oficiais citados em cada verbete"
        />
        <AprendaIndice
          grupos={grupos}
          trilhas={<AprendaTrilhas />}
          estados={estadosDoAcervo(resumo)}
          comRessalva={resumo.comRessalva}
          emPreparacao={resumo.pendentes}
        />
      </main>
    </>
  );
}
