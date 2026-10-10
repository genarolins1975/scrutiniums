import Link from 'next/link';
import {CabecalhoEntrada} from '@/components/eficiencia/CabecalhoEntrada';
import {NavegacaoAssistencia} from '@/components/eficiencia/assistencia/NavegacaoAssistencia';
export default function Layout({children}:{children:React.ReactNode}){return <><CabecalhoEntrada/><main id="conteudo" className="mx-auto max-w-page px-4 pb-20 pt-7 sm:px-6"><Link href="/eficiencia-estatal" className="inline-flex min-h-[44px] items-center text-sm text-obee-dark underline">← Panorama do OBEE</Link><NavegacaoAssistencia/>{children}</main></>}
