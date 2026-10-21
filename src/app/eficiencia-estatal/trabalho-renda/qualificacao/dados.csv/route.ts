import {consultaCursos,streamCsvCursos} from '@/lib/eficiencia/trabalho-renda/cursos';
export const dynamic='force-dynamic';
export function GET(req:Request){const recorte=Object.fromEntries(new URL(req.url).searchParams);const {selecionados}=consultaCursos(recorte);return new Response(streamCsvCursos(selecionados),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="cursos-aprendizagem-recorte.csv"','Cache-Control':'public, max-age=300'}});}
