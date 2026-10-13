import {NextResponse} from 'next/server';
import {IPCA} from '@/lib/contas-publicas/inflacao';
export const dynamic='force-static';
export function GET(){return NextResponse.json(IPCA,{headers:{'Content-Disposition':'attachment; filename="contas-publicas-ipca.json"'}})}
