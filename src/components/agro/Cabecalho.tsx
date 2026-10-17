import Link from 'next/link';
import { LogoMark } from '@/components/ui/Logo';
import { DetalhesFechaveis } from '@/components/layout/DetalhesFechaveis';
import { AcessoConta } from '@/components/energia/AcessoConta';
import { OPCOES_OBSERVATORIOS } from '@/lib/opcoesObservatorios';
import { NavegacaoAgro } from './Navegacao';
import s from './Agro.module.css';
export function CabecalhoAgro() { return <><header className={s.platform}><div className={s.platformInner}><div className={s.brand}><Link href="/" className={s.wordmark} aria-label="Scrutiniums: página inicial" prefetch={false}><LogoMark size={22}/><span>Scrutiniums</span></Link><Link className={s.brandTitle} href="/agronegocio" prefetch={false}>Agronegócio</Link></div><DetalhesFechaveis className={s.platformMenu}><summary aria-label="Trocar de observatório e acessar a conta"><span className={s.menuDesktop}>Observatórios</span><span className={s.menuMobile}>Menu</span><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" aria-hidden="true"><path d="M2 5h14M2 9h14M2 13h14"/></svg></summary><div className={s.dropdown}><p className={s.eyebrow}>Seu espaço de análise</p><nav aria-label="Observatórios da plataforma">{OPCOES_OBSERVATORIOS.map(d => <Link key={d.id} href={d.rotaRaiz} prefetch={false} aria-current={d.id === 'agro' ? 'true' : undefined}>{d.nomeCurto}</Link>)}</nav><div className={s.account}><Link href="/app/observatorios" prefetch={false}>Escolher observatório</Link><AcessoConta destino="/agronegocio"/></div></div></DetalhesFechaveis></div></header><NavegacaoAgro /></>; }
