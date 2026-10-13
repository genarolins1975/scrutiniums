import {CAPITULOS,FONTES,INDICADORES,REFERENCIAS,VERSAO} from '@/lib/contas-publicas/catalogo';
export const dynamic='force-static';
export function GET(){return Response.json({versao:VERSAO,natureza:'catalogo-metodologico-sem-observacoes',capitulos:CAPITULOS,indicadores:INDICADORES,fontes:FONTES,referencias:REFERENCIAS},{headers:{'Content-Disposition':'attachment; filename="catalogo-contas-publicas.json"'}})}
