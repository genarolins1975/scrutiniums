import dados from '@/lib/contas-publicas/snapshots/custos.json';
export const dynamic='force-static';
export function GET(){return Response.json(dados,{headers:{'Content-Disposition':'attachment; filename="custos-uniao-rfc-2025.json"'}})}
