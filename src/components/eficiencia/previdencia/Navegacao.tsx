'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {PAGINAS,ROTA} from '@/lib/eficiencia/previdencia/dados';
export function Navegacao(){const path=usePathname();return <nav aria-label="Previdência" className="my-6 flex flex-wrap gap-x-6 border-y border-linha py-2">{PAGINAS.map(([slug,nome])=><Link key={slug} href={ROTA+(slug?'/'+slug:'')} aria-current={path===ROTA+(slug?'/'+slug:'')?'page':undefined} className={'inline-flex min-h-[44px] items-center text-sm text-obee-dark underline-offset-4 '+(path===ROTA+(slug?'/'+slug:'')?'font-semibold underline':'hover:underline')}>{nome}</Link>)}</nav>}
