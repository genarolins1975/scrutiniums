import {CabecalhoPlataforma} from '@/components/layout/CabecalhoPlataforma';
import Link from 'next/link';
import type { Metadata } from "next";
import { modeloDeTitulo } from "@/lib/observatorios/contexto";

/** Títulos "Página · Coleção · Scrutiniums", com a coleção dona do tema no registro. */
export const metadata: Metadata = { title: modeloDeTitulo("/eficiencia-estatal/acesso-justica") };
export default function Layout({children}:{children:React.ReactNode}){return <><header><CabecalhoPlataforma colecao="eficiencia" destinoConta="/eficiencia-estatal/acesso-justica" navegacao="justica" /></header><main id="conteudo" className="mx-auto max-w-page px-4 pb-20 pt-7 sm:px-6"><Link href="/eficiencia-estatal" className="inline-flex min-h-[44px] items-center text-sm text-obee-dark underline">← Panorama do OBEE</Link>{children}</main></>}
