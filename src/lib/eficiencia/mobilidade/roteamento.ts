import {PAGINAS_MOBILIDADE,ROTA_MOBILIDADE} from './modelo';
/** Apenas caminhos do novo capítulo; não muda o acesso a /app ou a outros domínios. */
export function estadoRotaMobilidade(pathname:string):'fora'|'valida'|'inexistente'{
  if(pathname!==ROTA_MOBILIDADE&&!pathname.startsWith(ROTA_MOBILIDADE+'/'))return 'fora';
  const sufixo=pathname.slice(ROTA_MOBILIDADE.length).replace(/^\//,'').replace(/\/$/,'');
  return PAGINAS_MOBILIDADE.some(p=>p.slug===sufixo)?'valida':'inexistente';
}
