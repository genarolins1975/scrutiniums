import type {Metadata} from 'next';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {RecursosCarregados,type Dados} from '@/components/eficiencia/trabalho-renda/RecursosTrabalho';
export const metadata:Metadata={title:'Recursos públicos para o trabalho'};
export default async function Pagina(){let dados:Dados;try{dados=JSON.parse(await readFile(path.join(process.cwd(),'public/eficiencia/trabalho-renda/recursos.json'),'utf8')) as Dados}catch{return <section className="tr-empty"><h1>Recursos indisponíveis nesta publicação</h1><p>Nenhum valor é substituído por zero.</p></section>}return <RecursosCarregados dados={dados}/>}
