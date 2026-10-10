import { readFileSync } from "node:fs";
import { join } from "node:path";
export type Necessidade = { territory:string; year:number; secure:number; insecure:number; mild:number; moderate:number; severe:number };
export type Ficha = { id:string; variavel:string; nome:string; grupo:string; unidade:string; definicao:string; universo:string; periodo:string; frequencia:string; formula:string; numerador:string|null; denominador:string|null; fonte:string; registro:string; cobertura:number; ausencias:string; quebras:string; papel_escore:string; peso:number|null; referencia:string|null; limitacoes:string };
export type PanoramaAlimentar = { version:string; manifest:{captured_at:string;seed_sha256:string;sources:{file:string;url:string;sha256:string}[]}; needs:Necessidade[]; catalog:Ficha[]; ufs:string[]; municipal_records:number; score_status:string };
export function dadosAlimentares():PanoramaAlimentar { return JSON.parse(readFileSync(join(process.cwd(),"public/eficiencia/seguranca-alimentar/panorama.json"),"utf8")); }
export const BASE_ALIMENTAR = "/eficiencia/seguranca-alimentar";
export const fmtAlimentar = (v:number) => v.toLocaleString("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:1});
