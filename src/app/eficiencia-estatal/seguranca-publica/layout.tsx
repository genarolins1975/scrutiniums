import Link from 'next/link';
import {CabecalhoEntrada} from '@/components/eficiencia/CabecalhoEntrada';
export default function Layout({children}:{children:React.ReactNode}){
  return <><CabecalhoEntrada/><main id="conteudo" className="mx-auto max-w-page px-4 pb-20 pt-7 sm:px-6"><Link className="inline-flex min-h-[44px] items-center text-sm text-obee-dark underline" href="/eficiencia-estatal">← Panorama do OBEE</Link><nav aria-label="Segurança pública" className="mt-4 flex flex-wrap gap-x-5 gap-y-1 border-y border-linha py-2">{[['','Panorama'],['letalidade','Violência letal'],['mulheres','Mulheres'],['patrimonio','Patrimônio'],['resposta','Busca e atividade'],['recursos','Recursos'],['metodos','Dados e métodos']].map(([slug,titulo])=><Link key={slug} href={`/eficiencia-estatal/seguranca-publica${slug?'/'+slug:''}`} className="inline-flex min-h-[44px] items-center text-sm text-obee-dark underline underline-offset-4">{titulo}</Link>)}</nav>{children}</main></>;
}
