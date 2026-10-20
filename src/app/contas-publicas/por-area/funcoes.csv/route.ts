import {ESTAGIOS_AREA,linhasDownload} from '@/lib/contas-publicas/areas';
export const dynamic='force-static';
const campo=(v:string|number|null)=>v===null?'':typeof v==='number'?String(v):/[";\n]/.test(v)?`"${v.replace(/"/g,'""')}"`:v;
/** CSV com ponto e vírgula; valores em R$ correntes com ponto decimal; estágio incompleto na fonte fica vazio, nunca zero. */
export function GET(){
 const colunas=['ano','funcao','nomeFuncao','subfuncao','nomeSubfuncao','rp','natureza','parcela',...ESTAGIOS_AREA] as const;
 const corpo=[colunas.join(';'),...linhasDownload().map(l=>colunas.map(c=>campo(l[c])).join(';'))].join('\n')+'\n';
 return new Response('﻿'+corpo,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="contas-publicas-despesa-por-area.csv"'}});
}
