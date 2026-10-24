import type {Metadata} from "next";
import {PaginaPainel} from "@/components/painel";
import {FONTE_SUAS, FiguraSuasDoPainel, FontesSuas, MetodoSuas, numerosSuas} from "@/components/eficiencia/assistencia/PainelSuas";
import {dadosAssistencia} from "@/lib/eficiencia/assistencia/dados";
import {TEMAS_EFICIENCIA} from "@/lib/eficiencia/temas";
export const dynamic="force-static";
export const metadata:Metadata={title:"Recursos e capacidade"};

const ROTA="/eficiencia-estatal/assistencia-social/recursos";
const IDS=["CRAS.rh_vinculos", "CREAS.rh_vinculos", "CRAS.q2_2", "CREAS.q4_2", "DIA.q3_2"];

/**
 * Recursos e capacidade no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026): a pergunta, os vínculos de trabalho declarados
 * no Brasil (as mesmas somas que a figura mostra), as respostas da rede por território e o método das cinco medidas.
 */
export default function Page(){
  const g=dadosAssistencia();
  return <PaginaPainel
    rota={ROTA}
    principal={false}
    idioma="pt"
    abertura={{
      grupo:TEMAS_EFICIENCIA.assistencia.nome,
      acento:"obee",
      titulo:"Que condições sustentam o atendimento?",
      lead:"Os registros de recursos humanos contam vínculos declarados em cada unidade, sem identificar trabalhadores.",
      recorte:{periodo:String(g.year),universo:"unidades CRAS, CREAS e centros-dia respondentes, Brasil e UFs",unidade:"vínculos e horas declarados",fonte:FONTE_SUAS},
      limite:"quantas pessoas trabalham na rede: os vínculos não representam pessoas únicas ou equivalentes de jornada completa.",
      fontesDatasSiglas:<FontesSuas siglas={[["CRAS","Centro de Referência de Assistência Social"],["CREAS","Centro de Referência Especializado de Assistência Social"],["SUAS","Sistema Único de Assistência Social"]]}/>,
    }}
    numeros={numerosSuas([
      {id:"CRAS.rh_vinculos",rotulo:"Vínculos de trabalhadores registrados nos CRAS",nota:"Não representam pessoas únicas."},
      {id:"CREAS.rh_vinculos",rotulo:"Vínculos de trabalhadores registrados nos CREAS",nota:"Não representam pessoas únicas."},
    ])}
    notaNumeros="O recorte financeiro ainda não foi integrado; estas medidas não são uma nota de eficiência."
    figuras={<FiguraSuasDoPainel ids={IDS} rota={ROTA}/>}
    metodo={<MetodoSuas ids={IDS}/>}
  />;
}
