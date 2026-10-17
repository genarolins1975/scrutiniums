import Link from 'next/link';
import {LogoMark} from '@/components/ui/Logo';
import {DetalhesFechaveis} from '@/components/layout/DetalhesFechaveis';
import {AcessoConta} from '@/components/energia/AcessoConta';
import {OPCOES_OBSERVATORIOS} from '@/lib/opcoesObservatorios';
import {BASE_JUDICIARIO} from '@/lib/eficiencia/judiciario/modelo';
import s from './Judiciario.module.css';

/** Cabeçalho compacto do módulo, com os mesmos destinos e a conta compartilhada. */
export function CabecalhoJudiciario(){return <header className={s.platformHeader}><div className={s.platformInner}><div className={s.platformBrand}><Link href="/" className={s.platformLogo} aria-label="Scrutiniums: página inicial"><LogoMark size={22}/><span>Scrutiniums</span></Link><Link className={s.platformTitle} href={BASE_JUDICIARIO}>Judiciário</Link></div><DetalhesFechaveis className={s.platformMenu}><summary aria-label="Trocar de observatório e acessar a conta"><span className={s.platformMenuDesktop}>Observatórios</span><span className={s.platformMenuMobile}>Menu</span><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" aria-hidden="true"><path d="M2 5h14M2 9h14M2 13h14"/></svg></summary><div className={s.platformDropdown}><p className={s.eyebrow}>Seu espaço de análise</p><nav aria-label="Observatórios da plataforma">{OPCOES_OBSERVATORIOS.map(d=><Link key={d.id} href={d.rotaRaiz} prefetch={false} aria-current={d.id==='judiciario'?'true':undefined}>{d.nomeCurto}{d.id==='judiciario'&&<small>Módulo do OBEE</small>}</Link>)}</nav><div className={s.platformAccount}><Link href="/app/observatorios" prefetch={false}>Escolher observatório</Link><AcessoConta destino={BASE_JUDICIARIO}/></div></div></DetalhesFechaveis></div></header>;}
