export type RegistroCusto={id:string;parent:string|null;nome:string;ano2024:number;ano2025:number;diferencaPublicada:number;nominalPublicado:number;realPublicado:number};
export type MedidaCustos='diferencaPublicada'|'nominalPublicado'|'realPublicado';
export const valorVariacao=(r:RegistroCusto,medida:MedidaCustos)=>r[medida];
/** Compare only siblings; use published changes to retain source precision. */
export function resumirCustos<T extends RegistroCusto>(registros:T[],grupo:string){
 const linhas=registros.filter(r=>r.parent===grupo);
 return {linhas,maiores:[...linhas].sort((a,b)=>b.ano2025-a.ano2025),altas:linhas.filter(r=>r.diferencaPublicada>0).sort((a,b)=>b.diferencaPublicada-a.diferencaPublicada),quedas:linhas.filter(r=>r.diferencaPublicada<0).sort((a,b)=>a.diferencaPublicada-b.diferencaPublicada),percentuais:linhas.filter(r=>r.realPublicado>0).sort((a,b)=>b.realPublicado-a.realPublicado)};
}
