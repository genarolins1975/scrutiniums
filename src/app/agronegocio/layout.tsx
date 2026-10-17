import type { Metadata } from 'next';
import { Footer } from '@/components/layout/Footer';
import { CabecalhoAgro } from '@/components/agro/Cabecalho';
import s from '@/components/agro/Agro.module.css';
export const metadata: Metadata = { title: { default: 'Observatório do Agronegócio Brasileiro', template: '%s · Agronegócio · Scrutiniums' }, description: 'Do campo à mesa e ao mercado: sete cadeias, perguntas econômicas e sociais, dados públicos, cenários e limites identificados.' };
export default function LayoutAgro({ children }: {
    children: React.ReactNode;
}) { return <div className={`${s.shell} dominio-energia`}><a href="#conteudo" className={s.skip}>Pular para o conteúdo</a><CabecalhoAgro /><main id="conteudo" className={`${s.main} ${s.wrap}`}>{children}</main><Footer compacto/></div>; }
