/** Contratos para AFFO/SIOP. Base física 2025 integrada por localizador.
 * As fórmulas relativas à meta atualizada seguem o orientador, seção 7.
 * Não agregar localizadores e planos orçamentários, nem somar produtos distintos.
 */
export type MedidaEntrega = {valor:number|null;estado:'calculado'|'ausente'|'inelegivel';motivo:string};
const invalida=(estado:'ausente'|'inelegivel',motivo:string):MedidaEntrega=>({valor:null,estado,motivo});
export function cumprimentoFisico(realizado:number|null,meta:number|null):MedidaEntrega{
 if(realizado===null||meta===null)return invalida('ausente','Realizado ou meta não informado.');
 if(!Number.isFinite(realizado)||!Number.isFinite(meta)||realizado<0||meta<=0)return invalida('inelegivel','Exige realizado não negativo e meta positiva, ambos finitos.');
 const valor=100*realizado/meta;
 return Number.isFinite(valor)?{valor,estado:'calculado',motivo:'Realizado dividido pela meta selecionada; resultado não limitado a 100%.'}:invalida('inelegivel','Resultado fora do intervalo numérico representável.');
}
export function eficienciaRelativaSIOP(realizado:number|null,metaAtual:number|null,autorizado:number|null,liquidado:number|null):MedidaEntrega{
 const cumprimento=cumprimentoFisico(realizado,metaAtual);
 if(cumprimento.estado!=='calculado')return cumprimento;
 if(autorizado===null||liquidado===null)return invalida('ausente','Autorização ou liquidação não informada.');
 if(!Number.isFinite(autorizado)||!Number.isFinite(liquidado)||autorizado<=0||liquidado<=0)return invalida('inelegivel','Exige autorização e liquidação positivas e finitas.');
 const valor=cumprimento.valor!*autorizado/liquidado;
 return Number.isFinite(valor)?{valor,estado:'calculado',motivo:'EFLOA/SIOP: cumprimento físico relativo à execução financeira; não mede custo contábil, qualidade ou impacto.'}:invalida('inelegivel','Resultado fora do intervalo numérico representável.');
}
export type Programacao={
 exercicio:number;esfera:string;orgao:string;uo:string;programa:string;acao:string;localizador:string;
 nivel:'localizador'|'plano-orcamentario';po:string|null;
};
export function chaveProgramacao(p:Programacao):string{
 if(!Number.isInteger(p.exercicio)||p.exercicio<1900||![p.esfera,p.orgao,p.uo,p.programa,p.acao,p.localizador].every(v=>v.trim().length>0))throw new Error('Identificação incompleta da programação.');
 if(p.nivel==='localizador'&&p.po!==null)throw new Error('Localizador não pode carregar identificação de PO.');
 if(p.nivel==='plano-orcamentario'&&(!p.po||!p.po.trim()))throw new Error('Plano orçamentário exige código de PO.');
 return JSON.stringify([p.exercicio,p.esfera,p.orgao,p.uo,p.programa,p.acao,p.localizador,p.nivel,p.po]);
}
/** Uma vista mantém apenas um nível. Duplicação é erro de importação, não soma. */
export function validarUniversoProgramacoes(programacoes:Programacao[]):void{
 const niveis=new Set(programacoes.map(p=>p.nivel));
 if(niveis.size>1)throw new Error('Localizadores e POs são níveis sobrepostos.');
 const chaves=programacoes.map(chaveProgramacao);
 if(new Set(chaves).size!==chaves.length)throw new Error('Programação duplicada na fonte.');
}
/** Conversão do CSV brasileiro. Ausência permanece nula; valor malformado falha. */
export function numeroAFFO(texto:string):number|null{
 const s=texto.trim();
 if(s===''||s==='NA')return null;
 if(!/^-?\d+(?:,\d+)?$/.test(s))throw new Error('Número AFFO inválido: formato não reconhecido.');
 const valor=Number(s.replace(',','.'));
 if(!Number.isFinite(valor))throw new Error('Número AFFO não finito.');
 return valor;
}
