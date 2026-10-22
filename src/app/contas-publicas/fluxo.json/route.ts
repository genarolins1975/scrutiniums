import dados from '@/lib/contas-publicas/snapshots/fluxo.json';
export const dynamic='force-static';
export function GET(){return Response.json(dados,{headers:{'Content-Disposition':'attachment; filename="fluxo-dinheiro-federal-2025.json"'}})}
