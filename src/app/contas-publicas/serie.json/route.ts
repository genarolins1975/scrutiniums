import {NextResponse} from 'next/server';
import {DADOS} from '@/lib/contas-publicas/dados';
export const dynamic='force-static';
export function GET(){return NextResponse.json(DADOS,{headers:{'Content-Disposition':'attachment; filename="contas-publicas-dados.json"'}})}
