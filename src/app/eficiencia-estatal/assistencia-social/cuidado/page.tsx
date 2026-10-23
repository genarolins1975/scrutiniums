import type {Metadata} from "next";
import {PaginaPainel, type NumeroProps} from "@/components/painel";
import {FONTE_SUAS, FiguraSuasDoPainel, FontesSuas, MetodoSuas, numerosSuas} from "@/components/eficiencia/assistencia/PainelSuas";
import {dadosAssistencia} from "@/lib/eficiencia/assistencia/dados";
import {TEMAS_EFICIENCIA} from "@/lib/eficiencia/temas";
export const dynamic="force-static";
export const metadata:Metadata={title:"Cuidado e proteção"};

const ROTA="/eficiencia-estatal/assistencia-social/cuidado";
const IDS=["CRAS.q34", "CRAS.q36_1", "CRAS.q36_2", "CRAS.q36_3", "DIA.q23", "DIA.q24", "DIA.q15_4"];

/**
 * Cuidado e proteção no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026): a pergunta, os números da oferta no domicílio e
 * dos centros-dia no Brasil (os mesmos resumos que a figura desenha e a contagem de unidades respondentes do Censo), as respostas da rede
 * por território e o método das sete medidas.
 */
export default function Page(){
  const g=dadosAssistencia();
  const dia=g.stats.Brasil.counts.DIA;
  const centros:NumeroProps={rotulo:"Centros-dia e modalidades similares respondentes",valor:dia.total,formato:"inteiro",unidade:"unidades",periodo:String(g.year),recorte:"Brasil",fonte:FONTE_SUAS,natureza:"CALCULADO",nota:"Unidades governamentais e organizações da sociedade civil; não se presume financiamento público."};
  return <PaginaPainel
    rota={ROTA}
    principal={false}
    idioma="pt"
    abertura={{
      grupo:TEMAS_EFICIENCIA.assistencia.nome,
      acento:"obee",
      titulo:"Apoio quando a família não consegue cuidar sozinha.",
      lead:"A proteção básica no domicílio é um serviço específico, diferente de visitas do PAIF. Os volumes referem-se a agosto de 2025.",
      recorte:{periodo:`${g.year}, volumes de agosto de ${g.year}`,universo:"CRAS e centros-dia respondentes, Brasil e UFs",unidade:"unidades e pessoas declaradas",fonte:FONTE_SUAS},
      limite:"quantas pessoas diferentes receberam cuidado. Pessoas idosas e com deficiência podem pertencer aos dois grupos; não some essas categorias.",
      fontesDatasSiglas:<FontesSuas siglas={[["CRAS","Centro de Referência de Assistência Social"],["PAIF","Serviço de Proteção e Atendimento Integral à Família"],["SUAS","Sistema Único de Assistência Social"]]}/>,
    }}
    numeros={[...numerosSuas([
      {id:"CRAS.q34",rotulo:"CRAS que ofertam proteção básica no domicílio",resposta:"Sim",nota:"Oferta declarada; não comprova atendimento de cada pessoa."},
      {id:"CRAS.q36_1",rotulo:"Atendidos no domicílio: total declarado",nota:"Pode haver pessoas em mais de uma unidade; não é cobertura populacional."},
    ]),centros]}
    notaNumeros="Os centros-dia incluem modalidades similares e organizações não governamentais."
    figuras={<FiguraSuasDoPainel ids={IDS} rota={ROTA}/>}
    metodo={<MetodoSuas ids={IDS}/>}
  />;
}
