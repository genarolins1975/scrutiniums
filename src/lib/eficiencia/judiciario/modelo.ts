export const BASE_JUDICIARIO = '/eficiencia-estatal/judiciario';
export const CAPITULOS = [
  ['panorama', 'Panorama', 'O que entra, o que sai e o que permanece?'],
  ['recursos', 'Recursos e custos', 'Quanto custa a Justiça e o que esse valor mede?'],
  ['tempo', 'Tempo de resposta', 'Onde se acumula a espera?'],
  ['filas', 'Filas e capacidade', 'As saídas acompanham as entradas?'],
  ['entrega', 'Entrega e efetividade', 'Uma baixa significa direito cumprido?'],
  ['acesso', 'Acesso e desigualdade', 'Onde a Justiça e a assistência estão presentes?'],
  ['comparar', 'Comparar tribunais', 'Como um tribunal se situa entre seus pares?'],
  ['metodos', 'Dados e método', 'Qual é a cobertura e como reproduzir?'],
] as const;
export type CapituloJudiciario = typeof CAPITULOS[number][0];
export type RamoJudiciario = 'estadual' | 'federal' | 'trabalho';
export type TribunalJudiciario = {id:string;sigla:string;uf:string|null;ramo:RamoJudiciario;ano:number;tempoBaixados:number;idadePendentes:number;pagina:number;porte:string|null;despesaTotal:number|null;novos:number|null;pendentes:number|null;magistrados:number|null;servidores:number|null;ipcJus:number;ipcPagina:number;congestionamento:number;congestionamentoPagina:number;estruturaPagina:number|null};
export type RamoAgregado = {id:RamoJudiciario;nome:string;ano:number;novos:number;baixados:number;pendentes:number;idadePendente:number;conhecimento:number;execucao:number;cejuscs:number;atendimentoAproximado:number;resolucaoVolumes:number;nota:string;despesaTotal:number;despesaPorBaixaAproximada:number;iadOficial:number;congestionamentoBruto:number;congestionamentoLiquido:number;desempenhoPagina:number;conciliacaoDespesas?:{somaTribunais:number;totalRamo:number;residuo:number;tolerancia:number;regra:string}};
export type MedidaTribunal = 'tempoBaixados' | 'idadePendentes';
export const MEDIDAS_TRIBUNAL: Record<MedidaTribunal,{titulo:string;nota:string}> = {
  tempoBaixados:{titulo:'Duração média dos processos baixados',nota:'Da entrada à primeira baixa dos processos baixados no ano. Não acompanha uma coorte única de ingressantes.'},
  idadePendentes:{titulo:'Idade média dos processos pendentes',nota:'Tempo já decorrido nos processos ainda pendentes em dezembro. Não é a espera restante nem uma previsão individual.'},
};
export function medianaDasMedias(values:number[]):number|null {
  if(!values.length || values.some(v=>!Number.isFinite(v))) return null;
  const sorted=[...values].sort((a,b)=>a-b), middle=Math.floor(sorted.length/2);
  return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;
}
export function csvJudiciario(headers:string[],rows:(string|number|null)[][]):string {
  const quote=(v:string|number|null)=>{
    // Texto de uma fonte não deve virar fórmula ao abrir em planilha.
    const text=String(v??'');
    return '"'+(typeof v==='string'&&/^[=+@\-\t\r]/.test(text)?"'"+text:text).replaceAll('"','""')+'"';
  };
  return '\ufeff'+[headers,...rows].map(r=>r.map(quote).join(';')).join('\r\n');
}
export const NOMES_UF:Record<string,string>={AC:'Acre',AL:'Alagoas',AP:'Amapá',AM:'Amazonas',BA:'Bahia',CE:'Ceará',DF:'Distrito Federal e Territórios',ES:'Espírito Santo',GO:'Goiás',MA:'Maranhão',MT:'Mato Grosso',MS:'Mato Grosso do Sul',MG:'Minas Gerais',PA:'Pará',PB:'Paraíba',PR:'Paraná',PE:'Pernambuco',PI:'Piauí',RJ:'Rio de Janeiro',RN:'Rio Grande do Norte',RS:'Rio Grande do Sul',RO:'Rondônia',RR:'Roraima',SC:'Santa Catarina',SP:'São Paulo',SE:'Sergipe',TO:'Tocantins'};
