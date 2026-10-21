import {CabecalhoEntrada} from '@/components/eficiencia/CabecalhoEntrada';
import {ROTA,PAGINAS} from '@/lib/eficiencia/habitacao/modelo';
export default function Layout({children}:{children:React.ReactNode}){return <><CabecalhoEntrada tema={{nome:'Habitação',rota:ROTA,abas:PAGINAS.filter(([s])=>s!=='dados'),acoes:PAGINAS.filter(([s])=>s==='dados')}}/><main id="conteudo" className="mx-auto max-w-page px-4 pb-20 pt-8 sm:px-6 md:pt-10">{children}</main></>}
