import { readFileSync } from 'node:fs';
import { join } from 'node:path';
export type Curso = {id:string;nome:string;programa:string;entidade:string;uf:string;cidade:string;modalidade:string;modalidadeOriginal?:string;horasTotal:number|null;cbo:string;ocupacoes:string;aprovacaoISO:string|null;validadeISO:string|null;status:'vigente'|'vencido'|'futuro'|'sem-data';originalLinha:number;localidade:'oferta-ead'|'sede'};
export type IndiceCursos = {porUF:{uf:string;registros:number;vigentes:number;codigos:number;localidades:number}[];fonte:{url:string;pagina:string;capturadoEm:string;sha256Zip:string;sha256Csv:string;bruto:string;referencia:string;limitacoes:string[]};totais:Record<string,number>;modalidades:string[]};
export type RecorteCursos={uf?:string;q?:string;modalidade?:string;status?:string;pagina?:string};
const pasta=join(process.cwd(),'public/eficiencia/trabalho-renda/cursos');
const modalidadeCanonica=(m:string)=>m.toLocaleLowerCase('pt-BR')==='à distância'?'À distância':m;
export function indiceCursos():IndiceCursos{const d=JSON.parse(readFileSync(join(pasta,'indice.json'),'utf8'));return {...d,modalidades:Array.from(new Set<string>(d.modalidades.map((m:string|{nome:string})=>modalidadeCanonica(typeof m==='string'?m:m.nome))))};}
export const normalizaCurso=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
export function filtraCursos(cursos:Curso[],recorte:RecorteCursos):Curso[]{const termos=normalizaCurso((recorte.q??'').slice(0,200)).trim().split(/\s+/).filter(Boolean);const status=['vigente','vencido','futuro','sem-data','todos'].includes(recorte.status??'')?recorte.status:'vigente';return cursos.filter(c=>(!recorte.uf||recorte.uf===c.uf)&&(!recorte.modalidade||recorte.modalidade===c.modalidade)&&(status==='todos'||c.status===status)&&termos.every(t=>normalizaCurso([c.nome,c.programa,c.entidade,c.cidade,c.cbo,c.ocupacoes].join(' ')).includes(t)));}
export function consultaCursos(recorte:RecorteCursos){const indice=indiceCursos();const uf=indice.porUF.some(x=>x.uf===recorte.uf)?recorte.uf!:'';const ufs=uf?[uf]:indice.porUF.map(x=>x.uf);const cursos=ufs.flatMap(u=>JSON.parse(readFileSync(join(pasta,`uf-${u}.json`),'utf8')) as Curso[]);const normalizados=cursos.map(c=>({...c,modalidadeOriginal:c.modalidade,modalidade:modalidadeCanonica(c.modalidade)}));const canonico:RecorteCursos={...recorte,uf,q:(recorte.q??'').slice(0,200),modalidade:indice.modalidades.includes(recorte.modalidade??'')?recorte.modalidade:'',status:['vigente','vencido','futuro','sem-data','todos'].includes(recorte.status??'')?recorte.status:'vigente'};const selecionados=filtraCursos(normalizados,canonico);selecionados.sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR')||a.uf.localeCompare(b.uf)||a.cidade.localeCompare(b.cidade,'pt-BR')||a.id.localeCompare(b.id));return {indice,uf,selecionados,recorte:canonico};}
const CABECALHO_CURSOS=['Código do curso','Curso','Programa','Entidade','UF indicada','Localidade indicada','Natureza da localidade','Modalidade normalizada','Modalidade original','Carga horária total','CBO','Ocupações','Aprovação','Validade','Situação no recorte','Linha original'];
const quoteCsvCurso=(v:unknown)=>`"${String(v??'').replaceAll('"','""')}"`;
const serializaLinhaCurso=(c:Curso)=>[c.id,c.nome,c.programa,c.entidade,c.uf,c.cidade,c.localidade,c.modalidade,c.modalidadeOriginal??c.modalidade,c.horasTotal,c.cbo,c.ocupacoes,c.aprovacaoISO,c.validadeISO,c.status,c.originalLinha].map(quoteCsvCurso).join(';');
/** Cada bloco continua o mesmo CSV: BOM/cabeçalho únicos, CRLF entre linhas, sem CRLF final. */
export function* partesCsvCursos(cursos:Curso[],tamanho=250):Generator<string>{
  const limite=Math.max(1,Math.min(500,Math.trunc(tamanho)||250));
  yield '\uFEFF'+CABECALHO_CURSOS.map(quoteCsvCurso).join(';');
  for(let inicio=0;inicio<cursos.length;inicio+=limite){yield '\r\n'+cursos.slice(inicio,inicio+limite).map(serializaLinhaCurso).join('\r\n');}
}
export function csvCursos(cursos:Curso[]){return Array.from(partesCsvCursos(cursos)).join('');}
/** Entrega progressiva para não transformar o recorte nacional em uma resposta bufferizada de 32 MB. */
export function streamCsvCursos(cursos:Curso[],tamanho=250):ReadableStream<Uint8Array>{
 const partes=partesCsvCursos(cursos,tamanho);const encoder=new TextEncoder();
 return new ReadableStream<Uint8Array>({pull(controller){const parte=partes.next();if(parte.done){controller.close();return;}controller.enqueue(encoder.encode(parte.value));},cancel(){partes.return(undefined);}});
}
