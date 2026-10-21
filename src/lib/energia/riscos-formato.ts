import type { Idioma } from "@/lib/idioma";
import { campo, tiposUrl } from "./estadoUrl";
export const numeroRisco=(padrao:number,min:number,max:number,param:string,inteiro=false)=>campo(tiposUrl.numero({min,max,inteiro}),padrao,{param,historico:"replace"});
export const fmt=(v:number,casas=1,idioma:Idioma="pt")=>{
  // Corrige somente a apresentação de empates decimais e zero negativo, sem alterar o modelo.
  const magnitude=Math.abs(v), escala=10**casas;
  const arredondado=Math.round((magnitude+Number.EPSILON*Math.max(1,magnitude))*escala)/escala;
  return (arredondado===0?0:Math.sign(v)*arredondado).toLocaleString(idioma==="en"?"en-US":"pt-BR",{minimumFractionDigits:0,maximumFractionDigits:casas});
};
export const milhoes=(v:number,idioma:Idioma="pt")=>idioma==="en"?`R$ ${fmt(v/1e6,2,"en")} million`:`R$ ${fmt(v/1e6,2)} mi`;
