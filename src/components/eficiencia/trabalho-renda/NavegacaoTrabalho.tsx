'use client';
import Link from 'next/link';
import {usePathname,useRouter} from 'next/navigation';
import {BASE,PAGINAS} from './modelo';
export function NavegacaoTrabalho(){const pathname=usePathname();const router=useRouter();return <><nav className="tr-tabs" aria-label="Painéis de Trabalho e Renda">{PAGINAS.map(p=><Link key={p.slug} href={`${BASE}${p.slug?`/${p.slug}`:''}`} aria-current={pathname===`${BASE}${p.slug?`/${p.slug}`:''}`?'page':undefined}>{p.nome}</Link>)}</nav><label className="tr-nav-mobile">Painel de Trabalho e Renda<select value={pathname} onChange={e=>router.push(e.target.value)}>{PAGINAS.map(p=><option key={p.slug} value={`${BASE}${p.slug?`/${p.slug}`:''}`}>{p.nome}</option>)}</select></label></>}
