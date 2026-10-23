import type {Metadata} from "next";
import {PaginaPainel} from "@/components/painel";
import {FONTE_SUAS, FiguraSuasDoPainel, FontesSuas, MetodoSuas, numerosSuas} from "@/components/eficiencia/assistencia/PainelSuas";
import {dadosAssistencia} from "@/lib/eficiencia/assistencia/dados";
import {TEMAS_EFICIENCIA} from "@/lib/eficiencia/temas";
export const dynamic="force-static";
export const metadata:Metadata={title:"Acesso à proteção social"};

const ROTA="/eficiencia-estatal/assistencia-social/acesso";
const IDS=["CRAS.q9_1", "CRAS.q9_4", "CREAS.q9_1", "DIA.q15_1", "CRAS.q2_1", "CREAS.q4_1", "CRAS.q51_1"];

/**
 * Acesso à proteção social no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026): a pergunta, três números do Brasil lidos
 * dos mesmos resumos que a figura desenha (acessibilidade declarada, dias de funcionamento e a espera do Cadastro Único), as respostas
 * da rede por território e o método das sete medidas. O layout da Assistência social já abre o <main>: o molde entra como <div>.
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
      titulo:"A rede pode ser acessada?",
      lead:"Horários e adaptações declaradas mostram condições de oferta. A espera aqui se refere especificamente ao atendimento do Cadastro Único no CRAS; não é a fila geral da assistência social.",
      recorte:{periodo:String(g.year),universo:"unidades CRAS, CREAS e centros-dia respondentes, Brasil e UFs",unidade:"unidades e dias declarados",fonte:FONTE_SUAS},
      limite:"que as unidades cumprem a norma de acessibilidade. Adequação à norma é autodeclarada, sem auditoria técnica integrada.",
      fontesDatasSiglas:<FontesSuas siglas={[["CRAS","Centro de Referência de Assistência Social"],["CREAS","Centro de Referência Especializado de Assistência Social"],["ABNT","Associação Brasileira de Normas Técnicas"],["SUAS","Sistema Único de Assistência Social"]]}/>,
    }}
    numeros={numerosSuas([
      {id:"CRAS.q9_1",rotulo:"CRAS com acesso principal acessível de acordo com a norma",resposta:"Sim, de acordo com a Norma da ABNT (NBR9050)",nota:"Declaração da unidade."},
      {id:"CRAS.q2_1",rotulo:"CRAS que funcionam 5 dias por semana",resposta:"5 dias por semana"},
      {id:"CRAS.q51_1",rotulo:"Espera entre agendamento e atendimento do Cadastro Único no CRAS",nota:"Referência descritiva, sem interpretação de meta."},
    ])}
    notaNumeros="Respostas declaradas pelas próprias unidades. A espera é a do atendimento do Cadastro Único, não a fila geral da assistência social."
    figuras={<FiguraSuasDoPainel ids={IDS} rota={ROTA}/>}
    metodo={<MetodoSuas ids={IDS}/>}
  />;
}
