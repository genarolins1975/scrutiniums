import s from './Judiciario.module.css';

export type TemaFiguraJudiciario = 'panorama'|'internacional'|'recursos'|'tempo'|'filas'|'entrega'|'consistencia'|'criminal'|'acesso'|'comparar'|'metodos'|'tribunal'|'ingresso'|'conhecimento'|'decisao'|'recurso'|'execucao'|'cumprimento';

/** Pictogramas conceituais: não representam quantidade, localização ou tribunal real. */
export function IconeJudiciario({tema,className=''}:{tema:TemaFiguraJudiciario;className?:string}){
 const documento=<><path d="M33 16h37l16 16v52H33V16Z"/><path d="M70 16v18h16M44 44h29M44 55h29M44 66h18"/></>;
 return <svg className={className} viewBox="0 0 120 100" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
  <circle cx="60" cy="50" r="43" fill="currentColor" fillOpacity=".045" stroke="none"/>
  {tema==='consistencia'&&<><path d="M60 18v64M30 82h60M24 34h72"/><path d="M24 34 12 58h24L24 34Zm72 0-12 24h24L96 34Z"/><path d="M12 58a12 7 0 0 0 24 0M84 58a12 7 0 0 0 24 0"/></>}
  {tema==='criminal'&&<><path d="M30 30h60v44H30V30Zm10 0v44m10-44v44m10-44v44m10-44v44m10-44v44M24 74h72M24 30h72"/></>}
  {tema==='internacional'&&<><circle cx="60" cy="50" r="32"/><ellipse cx="60" cy="50" rx="15" ry="32"/><path d="M28 50h64M34 31h52M34 69h52"/></>}
  {tema==='panorama'||tema==='tribunal'?<><path d="m18 35 42-22 42 22H18ZM24 82h72M17 88h86M31 43v29m19-29v29m20-29v29m19-29v29"/><circle cx="60" cy="27" r="4"/></>:tema==='recursos'?<><path d="M25 31h63v49H25V31Zm-7-9h63v9M34 44h46M34 54h22"/><circle cx="77" cy="66" r="15" fill="var(--cor-papel)"/><path d="M77 56v20m6-16h-9a4 4 0 0 0 0 8h6a4 4 0 0 1 0 8h-9"/></>:tema==='tempo'?<><circle cx="60" cy="53" r="31"/><path d="M60 32v22l15 10M48 12h24M60 12v10m26 5 7-7M28 20l7 7"/><path d="M60 27v4m26 22h-4M60 79v-4M34 53h4"/></>:tema==='filas'?<><path d="M20 65h23v20H20V65Zm28-22h23v42H48V43Zm28-23h23v65H76V20M17 89h85"/><path d="M26 58h11M54 36h11M82 13h11"/></>:tema==='entrega'||tema==='cumprimento'?<>{documento}<circle cx="82" cy="72" r="17" fill="var(--cor-papel)"/><path d="m73 72 6 6 12-14"/></>:tema==='acesso'||tema==='ingresso'?<><path d="M28 84V24h61v60M48 84V43h21v41M20 88h80M37 34h8m28 0h8"/><circle cx="22" cy="55" r="7" fill="var(--cor-papel)"/><path d="M13 79v-8a9 9 0 0 1 18 0v8m-13 0v9m9-9v9"/></>:tema==='comparar'?<><path d="M23 24h74M23 50h74M23 76h74" opacity=".35"/><circle cx="44" cy="24" r="7" fill="var(--cor-papel)"/><circle cx="76" cy="50" r="7" fill="var(--cor-papel)"/><circle cx="57" cy="76" r="7" fill="var(--cor-papel)"/><path d="M65 14v72" strokeDasharray="3 5"/></>:tema==='recurso'?<><path d="M34 34a29 29 0 1 1-3 35M34 17v19H15"/>{<path d="M48 42h24M48 52h24M48 62h15"/>}</>:tema==='execucao'?<><path d="M19 34h36v47H19V34Zm6-12h36v12M27 45h19M27 55h15"/><path d="M65 57h34m-10-10 10 10-10 10M73 30h29v12M73 73v12h29"/></>:tema==='conhecimento'?<><path d="M20 25h34l6 6 6-6h34v53H66l-6 6-6-6H20V25Zm40 6v53M29 38h16M29 49h16M29 60h16M75 38h16M75 49h16M75 60h16"/></>:tema==='internacional'||tema==='consistencia'||tema==='criminal'?null:documento}
 </svg>;
}

export function FiguraCabecalhoJudiciario({tema}:{tema:TemaFiguraJudiciario}){
 const legendas:Partial<Record<TemaFiguraJudiciario,string>>={panorama:'Entradas · saídas · acervo',internacional:'Países diferentes. Perguntas em comum.',recursos:'Recursos que sustentam o serviço',tempo:'Cada espera tem seu universo',filas:'Fluxo do ano e estoque acumulado',entrega:'Registro processual e cumprimento',acesso:'Estrutura, território e atendimento',comparar:'Mesmo ramo. Mesma referência.',consistencia:'Mesma causa, mesma regra',criminal:'Do crime à execução da pena',tribunal:'O tribunal e o contexto dos pares'};
 return <figure className={s.chapterFigure}><IconeJudiciario tema={tema}/><figcaption>{legendas[tema]??'Conceitos, fontes e cobertura'}</figcaption></figure>;
}
