import {NextResponse} from 'next/server';
import dados from '@/lib/contas-publicas/snapshots/beneficios.json';
export const dynamic='force-static';
/** Gastos tributários da Receita (DGT Bases Efetivas 2023), com as conferências (com conta, como todo arquivo dos painéis). */
export function GET(){return NextResponse.json(dados,{headers:{'Content-Disposition':'attachment; filename="contas-publicas-gastos-tributarios-dgt-2023.json"'}})}
