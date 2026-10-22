import {CabecalhoEntrada} from '@/components/eficiencia/CabecalhoEntrada';
import {LINKS_ASSISTENCIA,ROTA_ASSISTENCIA} from '@/components/eficiencia/assistencia/NavegacaoAssistencia';
import type { Metadata } from "next";
import { modeloDeTitulo } from "@/lib/observatorios/contexto";

/** Títulos "Página · Coleção · Scrutiniums", com a coleção dona do tema no registro. */
export const metadata: Metadata = { title: modeloDeTitulo("/eficiencia-estatal/assistencia-social") };
const ACOES=['dados','metodos'];
export default function Layout({children}:{children:React.ReactNode}){return <><CabecalhoEntrada tema={{nome:'Assistência social e cuidado',rota:ROTA_ASSISTENCIA,abas:LINKS_ASSISTENCIA.filter(([r])=>!ACOES.includes(r)) as [string,string][],acoes:LINKS_ASSISTENCIA.filter(([r])=>ACOES.includes(r)) as [string,string][]}}/><main id="conteudo" className="mx-auto max-w-page px-4 pb-20 pt-8 sm:px-6 md:pt-10">{children}</main></>}
