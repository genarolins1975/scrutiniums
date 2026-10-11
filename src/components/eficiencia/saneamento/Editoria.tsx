import Link from 'next/link';
import {ROTA} from '@/lib/eficiencia/saneamento/modelo';
export {Nota,Secao} from '@/components/eficiencia/justica/Editoria';
export {Numeros} from '@/components/eficiencia/habitacao/Editoria';
export function Abertura({numero,titulo,texto}:{numero:string;titulo:string;texto:string}){return <header className="mb-9"><p className="rotulo text-obee">{numero} / Saneamento</p><h1 className="mt-3 max-w-4xl break-words font-serif text-4xl leading-tight md:text-5xl">{titulo}</h1><p className="mt-5 max-w-prose2 text-base leading-relaxed text-carvao-muted">{texto}</p><p className="mt-4 text-sm text-obee-dark">Referência 2024 · SINISA 2025 · Ministério das Cidades</p></header>}
export function Fonte({children}:{children?:React.ReactNode}){return <p className="mt-4 max-w-prose2 text-xs leading-relaxed text-carvao-muted">Fonte: <a className="underline" href="https://www.gov.br/cidades/pt-br/acesso-a-informacao/acoes-e-programas/saneamento/sinisa/resultados-sinisa/resultados-sinisa-2025">SINISA 2025, dados de 2024</a>. {children} <Link className="underline" href={ROTA+'/dados'}>Fontes, universos e downloads.</Link></p>}
