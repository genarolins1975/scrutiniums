'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {ROTA,PAGINAS} from '@/lib/eficiencia/saneamento/modelo';
export function Navegacao(){const path=usePathname();return <nav aria-label="Saneamento" className="my-6 flex flex-wrap gap-x-6 gap-y-1 border-y border-linha py-2">{PAGINAS.map(([s,n])=>{const href=ROTA+(s?'/'+s:'');return <Link key={href} href={href} aria-current={path===href?'page':undefined} className={'inline-flex min-h-[44px] items-center text-sm underline-offset-4 '+(path===href?'font-semibold text-obee-tinta underline':'text-obee-dark hover:underline')}>{n}</Link>})}</nav>}
