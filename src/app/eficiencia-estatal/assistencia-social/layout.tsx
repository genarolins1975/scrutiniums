import {CabecalhoEntrada} from '@/components/eficiencia/CabecalhoEntrada';
import {LINKS_ASSISTENCIA,ROTA_ASSISTENCIA} from '@/components/eficiencia/assistencia/NavegacaoAssistencia';
const ACOES=['dados','metodos'];
export default function Layout({children}:{children:React.ReactNode}){return <><CabecalhoEntrada tema={{nome:'Assistência social e cuidado',rota:ROTA_ASSISTENCIA,abas:LINKS_ASSISTENCIA.filter(([r])=>!ACOES.includes(r)) as [string,string][],acoes:LINKS_ASSISTENCIA.filter(([r])=>ACOES.includes(r)) as [string,string][]}}/><main id="conteudo" className="mx-auto max-w-page px-4 pb-20 pt-8 sm:px-6 md:pt-10">{children}</main></>}
