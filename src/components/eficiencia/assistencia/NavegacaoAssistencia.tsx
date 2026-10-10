'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
export const ROTA_ASSISTENCIA='/eficiencia-estatal/assistencia-social';
export const LINKS_ASSISTENCIA=[['','Panorama'],['necessidades','Necessidades'],['acesso','Acesso'],['acompanhamento','Acompanhamento'],['cuidado','Cuidado e proteção'],['recursos','Recursos e capacidade'],['dados','Explorar dados'],['metodos','Dados e métodos']];
export function NavegacaoAssistencia(){const path=usePathname();return <nav aria-label="Assistência social e cuidado" className="my-6 flex flex-wrap gap-x-5 gap-y-1 border-y border-linha py-2">{LINKS_ASSISTENCIA.map(([r,n])=>{const href=ROTA_ASSISTENCIA+(r?'/'+r:'');return <Link key={href} href={href} aria-current={path===href?'page':undefined} className={`inline-flex min-h-[44px] items-center text-sm underline-offset-4 ${path===href?'font-semibold text-obee-tinta underline':'text-obee-dark hover:underline'}`}>{n}</Link>})}</nav>}
