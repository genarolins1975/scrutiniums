import {NextResponse} from 'next/server';
import fonte from '@/lib/contas-publicas/snapshots/funcoes.json';
export const dynamic='force-static';
/** Snapshot da execução por função, subfunção e resultado primário (com conta, como todo arquivo dos painéis). */
export function GET(){return NextResponse.json(fonte,{headers:{'Content-Disposition':'attachment; filename="contas-publicas-funcoes.json"'}})}
