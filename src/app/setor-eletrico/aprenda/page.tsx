import type { Metadata, ResolvingMetadata } from "next";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { AbreDetalhesAoImprimir } from "@/components/energia/AbreDetalhesAoImprimir";
import { AprendaIndice } from "@/components/energia/AprendaIndice";
import { AprendaTrilhas } from "@/components/energia/AprendaPagina";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { estadosDoAcervo, gruposDoIndice, recorteDoAcervo, resumoDoAcervo } from "@/lib/energia/conteudo/aprenda-indice";
import { PAGINAS_MAPA } from "@/lib/energia/mapa";
import { tx } from "@/lib/energia/idioma";

export const dynamic = "force-static";
export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/aprenda", {
    title: tx("Aprenda: base de conhecimento do setor elétrico", "Learn: Brazilian power sector knowledge base"),
    description: tx(
      "PLD, CMO, EAR, ENA, tarifa, perdas, DEC e FEC, Tarifa Social, fator de emissão e outros conceitos, cada um com fonte oficial e data de conferência, unidade, exemplo real com a ficha Comprove, o que não confundir e trilhas que ligam os conceitos aos números.",
      "Spot price (PLD), marginal operating cost (CMO), stored energy (EAR), natural inflow energy (ENA), tariffs, losses, DEC and FEC, the Tarifa Social, the emission factor and other concepts of the Brazilian power sector, each with its official source and check date, unit, a real example with the Check this number record, what not to confuse it with, and learning paths that link the concepts to the numbers.",
    ),
    alternates: { canonical: "/setor-eletrico/aprenda" },
  }, anterior);
}

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
      <header><CabecalhoPlataforma colecao="energia" destinoConta="/setor-eletrico" navegacao="setor-eletrico" idiomas /></header>
      <MarcaVisita secao="energia:aprenda" />
      <AbreDetalhesAoImprimir />
      <main id="conteudo" tabIndex={-1} className="ed-pagina pb-16" data-tipo-pagina="indice">
        <CabecalhoModulo recolher={false}
          titulo={tx(PAGINAS_MAPA.aprenda.pergunta, "What does each concept mean and where does it appear?")}
          lead={tx(
            "Os verbetes cobrem os conceitos que aparecem nos painéis deste observatório, não todo o vocabulário do setor. Procure um termo ou comece por uma trilha, que liga os conceitos aos números.",
            "The entries cover the concepts that appear in this observatory's panels, not the whole vocabulary of the sector. Search for a term or start with a learning path, which links the concepts to the numbers.",
          )}
          recorte={recorteDoAcervo(resumo)}
          fonte={tx("documentos oficiais citados em cada verbete", "official documents cited in each entry")}
        />
        <AprendaIndice
          grupos={grupos}
          trilhas={<AprendaTrilhas />}
          estados={estadosDoAcervo(resumo)}
        />
      </main>
    </>
  );
}
