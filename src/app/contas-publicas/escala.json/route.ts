import {NextResponse} from 'next/server';
import {ESCALA} from '@/lib/contas-publicas/escala';
export const dynamic='force-static';
export function GET(){return NextResponse.json(ESCALA,{headers:{'Content-Disposition':'attachment; filename="contas-publicas-escala.json"'}})}
