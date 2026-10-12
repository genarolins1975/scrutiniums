import {NextResponse} from 'next/server';
import dados from '@/lib/contas-publicas/snapshots/rap.json';
export const dynamic='force-static';
export function GET(){return NextResponse.json(dados,{headers:{'Content-Disposition':'attachment; filename="restos-a-pagar-relatorio-2026.json"'}})}
