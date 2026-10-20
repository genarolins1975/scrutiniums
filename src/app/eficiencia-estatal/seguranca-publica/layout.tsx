import Link from 'next/link';
import {CabecalhoEntrada} from '@/components/eficiencia/CabecalhoEntrada';
import {SeloComConta} from '@/components/acesso/SeloComConta';
import {prefetchDoLink} from '@/lib/rotasPublicas';

const BASE = '/eficiencia-estatal/seguranca-publica';
/** Navegação do painel, na ordem da procura: a comparação por estado logo depois da visão geral. */
const ABAS_SEGURANCA: [string, string][] = [['', 'Panorama'], ['estados', 'Por estado'], ['letalidade', 'Violência letal'], ['mulheres', 'Mulheres'], ['patrimonio', 'Patrimônio'], ['resposta', 'Busca e atividade'], ['recursos', 'Recursos'], ['metodos', 'Dados e métodos']];

export default function Layout({children}: {children: React.ReactNode}) {
  return <><CabecalhoEntrada/><main id="conteudo" className="mx-auto max-w-page px-4 pb-20 pt-7 sm:px-6"><Link className="inline-flex min-h-[44px] items-center text-sm text-obee-dark underline" href="/eficiencia-estatal">← Panorama do OBEE</Link><nav aria-label="Segurança pública" className="mt-4 flex flex-wrap gap-x-5 gap-y-1 border-y border-linha py-2">{ABAS_SEGURANCA.map(([slug, titulo]) => { const href = `${BASE}${slug ? '/' + slug : ''}`; return <Link key={slug} href={href} prefetch={prefetchDoLink(href)} className="inline-flex min-h-[44px] items-center text-sm text-obee-dark underline underline-offset-4">{titulo}<SeloComConta href={href}/></Link>; })}</nav>{children}</main></>;
}
