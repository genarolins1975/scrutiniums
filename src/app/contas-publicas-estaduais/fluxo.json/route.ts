import dados from '@/lib/contas-estaduais/fluxo.json';
export const dynamic='force-static';
export function GET(){return Response.json(dados,{headers:{'Content-Disposition':'attachment; filename="fluxo-dinheiro-estados-2025.json"'}})}
