import { campo, tiposUrl } from "./estadoUrl";
export const numeroRisco=(padrao:number,min:number,max:number,param:string,inteiro=false)=>campo(tiposUrl.numero({min,max,inteiro}),padrao,{param,historico:"replace"});
export const fmt=(v:number,casas=1)=>v.toLocaleString("pt-BR",{minimumFractionDigits:0,maximumFractionDigits:casas});
export const milhoes=(v:number)=>`R$ ${fmt(v/1e6,2)} mi`;
