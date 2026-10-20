import {NextResponse} from 'next/server';
import dados from '@/lib/contas-publicas/snapshots/divida.json';
export const dynamic='force-static';
/** Dívida bruta do governo geral, mensal, do Banco Central (com conta, como todo arquivo dos painéis). */
export function GET(){return NextResponse.json(dados,{headers:{'Content-Disposition':'attachment; filename="contas-publicas-divida-bruta-governo-geral.json"'}})}
