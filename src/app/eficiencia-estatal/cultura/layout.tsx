import Link from 'next/link';
import {CabecalhoEntrada} from '@/components/eficiencia/CabecalhoEntrada';
export default function Layout({children}:{children:React.ReactNode}){
 return <><CabecalhoEntrada/><main id="conteudo" className="mx-auto max-w-page px-4 pb-20 pt-7 sm:px-6"><Link href="/eficiencia-estatal" className="inline-flex min-h-[44px] items-center text-sm text-obee-dark underline">← Panorama do OBEE</Link><nav aria-label="Cultura" className="mt-4 flex flex-wrap gap-x-5 gap-y-1 border-y border-linha py-2">{[['','Panorama'],['rede','Equipamentos'],['acesso','Acesso digital'],['atividades','Atividades'],['acervos','Acervos'],['recursos','Recursos'],['metodos','Dados e métodos']].map(([slug,titulo])=><Link key={slug} href={`/eficiencia-estatal/cultura${slug?'/'+slug:''}`} className="inline-flex min-h-[44px] items-center text-sm text-obee-dark underline underline-offset-4">{titulo}</Link>)}</nav>{children}</main></>;
}
