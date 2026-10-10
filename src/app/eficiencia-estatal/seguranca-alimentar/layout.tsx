import Link from "next/link";
import { CabecalhoEntrada } from "@/components/eficiencia/CabecalhoEntrada";
import { NavegacaoAlimentar } from "@/components/eficiencia/alimentar/NavegacaoAlimentar";
export default function LayoutAlimentar({children}:{children:React.ReactNode}){return <><CabecalhoEntrada/><main id="conteudo" className="mx-auto max-w-page px-4 pb-20 pt-7 sm:px-6"><Link href="/eficiencia-estatal" className="inline-flex min-h-[44px] items-center text-sm text-obee-dark underline underline-offset-4">← Panorama do OBEE</Link><NavegacaoAlimentar/>{children}</main></>}
