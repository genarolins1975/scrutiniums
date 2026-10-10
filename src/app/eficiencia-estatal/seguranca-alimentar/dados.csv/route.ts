import {readFile} from 'node:fs/promises';
import path from 'node:path';
import type {SnapshotAlimentar} from '@/lib/eficiencia/seguranca-alimentar/tipos';
import {streamCsvAlimentar} from '@/lib/eficiencia/seguranca-alimentar/csv';
export const dynamic='force-dynamic';
const BASES=['snapshot.json','precos.json','escolar.json','cadinsan.json','sisan.json','aquisicao.json','saude.json','paa.json'];
export async function GET(req:Request){const url=new URL(req.url);const arquivo=url.searchParams.get('base')??'snapshot.json';if(!BASES.includes(arquivo))return new Response('Conjunto inválido.',{status:400});let dados:SnapshotAlimentar;try{dados=JSON.parse(await readFile(path.join(process.cwd(),'public/eficiencia/seguranca-alimentar',arquivo),'utf8')) as SnapshotAlimentar}catch{return new Response('Conjunto não disponível nesta publicação.',{status:404});}const filtros=[['med','indicadorId'],['ter','territorioId'],['per','periodo'],['dim','dimensao'],['grp','grupo']] as const;const observacoes=dados.observacoes.filter(o=>filtros.every(([param,campo])=>!url.searchParams.has(param)||url.searchParams.get(param)===o[campo]));return new Response(streamCsvAlimentar(dados,observacoes),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="seguranca-alimentar-${arquivo.replace('.json','')}.csv"`,'Cache-Control':'public, max-age=300'}});}
