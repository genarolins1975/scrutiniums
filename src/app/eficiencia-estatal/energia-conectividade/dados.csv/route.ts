import {internet} from '@/lib/eficiencia/energia/dados';
export const dynamic='force-static';
export function GET(){const linhas=['territorio;ano;indicador;valor;unidade;universo;fonte;publicado_em;verificado_em',...internet.registros.map(r=>[r.territorio,internet.ano,'uso_internet_domicilio',r.valor,'%',internet.universo,internet.fonte,internet.publicado,internet.verificado].join(';'))];return new Response('\uFEFF'+linhas.join('\r\n')+'\r\n',{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="obee-conectividade-recorte.csv"'}});}
