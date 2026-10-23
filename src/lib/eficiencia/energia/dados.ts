import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import type {Proveniencia} from '@/lib/painel/tipos';
export const ROTA='/eficiencia-estatal/energia-conectividade';
export type Acesso={territorio:string;ano:string;situacao:string;pct_com_energia:number|null;pct_rede_geral:number|null;pct_integral_entre_rede:number|null;cv_pct_com_energia:number|null;domicilios_sem_energia_mil:number|null;domicilios_sem_energia_estado:string};
export type Anual={ano:number;completo:boolean;dec:number|null;fec:number|null;dec_limite:number|null;dec_todas_parcelas:number|null};
export type Distribuidora={cnpj:string;nome_comercial:string;sigla:string;ano:number;meses:number;dec:number|null;fec:number|null;dec_limite:number|null;dec_todas_parcelas:number|null;iasc:{ano:number;valor:number;amostra:number}|null};
export type Tarifa={cnpj:string;nome:string;sigla:string;inicio:string;fim:string;ato:string;te:number;tusd:number;total:number};
type Evidencia={fonte:{url:string};universo:string;reconciliacao:{descricao:string}|null};
type Medida={valor:number;unidade:string;mes:string;evidencia:Evidencia};
export type Inclusao={gerado_em:string;acesso:{ano_referencia:string;pnad_serie:Acesso[];proveniencia:{pnad:Proveniencia};universalizacao:{luz_para_todos:{evidencia_total:{valor_calculo:number;periodo:{inicio:string;fim:string};cobertura:string}}}};tarifa_social:{kpis:{uc_tsee:Medida;participacao_pct:Medida}}};
export type Qualidade={gerado_em:string;proveniencia:Record<string,Proveniencia>;ano_referencia:number;disponivel:boolean;brasil:{anual:Anual[]};distribuidoras:Distribuidora[];regras:{universo:string;apurado:string;parcial:string};parcial:{aviso:string}};
export type Conta={gerado_em:string;data_referencia:string;tarifas:{vigentes:Tarifa[];resumo:{n:number;ponderacao:string}};definicoes:{tarifa_homologada:string}};
function ler<T>(nome:string):T{return JSON.parse(readFileSync(join(process.cwd(),'public/energia/gold',nome+'.json'),'utf8')) as T;}
/** Adaptador das mesmas publicações do setor elétrico. Não copia séries nem recalcula agregados. */
export function dadosEnergia(){return {inclusao:ler<Inclusao>('inclusao'),qualidade:ler<Qualidade>('qualidade'),conta:ler<Conta>('conta')};}
export function numero(v:number|null|undefined,d=1){return v==null?'Não disponível':v.toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d});}
export function data(v:string){return v.slice(0,10).split('-').reverse().join('/');}
export const internet={ano:2025,publicado:'2026-07-02',verificado:'2026-10-11',fonte:'https://agenciadenoticias.ibge.gov.br/agencia-noticias/2012-agencia-de-noticias/noticias/47410-internet-chega-a-95-de-domicilios-do-pais-em-2025',universo:'Domicílios particulares permanentes; utilização da internet no domicílio',registros:[{territorio:'Brasil',valor:95},{territorio:'Urbana',valor:95.8},{territorio:'Rural',valor:88}],natureza:'Estimativa amostral do IBGE; transcrição da divulgação oficial. Recorte selecionado, não microdados.'};
