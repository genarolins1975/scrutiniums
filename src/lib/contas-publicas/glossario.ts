const MCASP='https://cdn.tesouro.gov.br/sistemas-internos/apex/producao/sistemas/thot/arquivos/publicacoes/51045_2434252/MCASP%20-%2011%C2%AA%20Edi%C3%A7%C3%A3o.pdf';
const MTO='https://www1.siop.planejamento.gov.br/mto/lib/exe/fetch.php/mto2026:mto2026.pdf';
const RTN='https://www.tesourotransparente.gov.br/temas/estatisticas-fiscais-e-planejamento/resultado-do-tesouro-nacional-rtn-conteudos-relacionados';
const consulta='2026-10-12';
const mcasp=(pagina:number)=>({fonte:`STN · MCASP · 11ª edição · p. ${pagina}`,url:`${MCASP}#page=${pagina}`,consulta});
const mto=(pagina:number)=>({fonte:`SOF · MTO 2026 · 7ª versão · p. ${pagina}`,url:`${MTO}#page=${pagina+2}`,consulta});
/** Paráfrases curtas de definições oficiais. Não alteram os contratos dos indicadores. */
export const GLOSSARIO={
 'dotacao-inicial':{termo:'Dotação inicial',definicao:'Valor autorizado originalmente na Lei Orçamentária Anual.',...mcasp(561)},
 'dotacao-atualizada':{termo:'Dotação atualizada',definicao:'Autorização inicial ajustada por créditos adicionais, atualizações e anulações do exercício.',...mcasp(562)},
 empenho:{termo:'Empenho',definicao:'Ato que reserva orçamento para uma despesa e cria obrigação de pagamento, sujeita ou não a condição.',...mcasp(105)},
 liquidacao:{termo:'Liquidação',definicao:'Verificação documental do direito do credor, do valor devido e de quem deve receber.',...mcasp(106)},
 pagamento:{termo:'Pagamento',definicao:'Entrega dos recursos ao credor após a liquidação regular da despesa.',...mcasp(106)},
 'rap-processados':{termo:'Restos a pagar processados',definicao:'Despesas empenhadas e liquidadas ainda sem pagamento no encerramento do exercício.',...mcasp(131)},
 'rap-nao-processados':{termo:'Restos a pagar não processados',definicao:'Despesas empenhadas, pendentes de liquidação e pagamento no encerramento do exercício.',...mcasp(131)},
 reinscricao:{termo:'Reinscrição',definicao:'Transferência ao exercício seguinte dos saldos de restos a pagar que continuam pendentes.',...mcasp(135)},
 gnd:{termo:'Grupo de natureza de despesa (GND)',definicao:'Agrupamento de elementos de despesa com características semelhantes quanto ao objeto do gasto.',...mcasp(78)},
 'resultado-primario':{termo:'Resultado primário',definicao:'Saldo entre receitas e despesas primárias. Juros da dívida ficam fora desse resultado. No painel, o perímetro é o Governo Central.',fonte:'Tesouro Nacional · conceitos do RTN',url:RTN,consulta},
 'acima-da-linha':{termo:'Acima da linha',definicao:'Apuração fiscal pelos fluxos de receitas e despesas. O saldo do RTN não substitui a apuração legal da meta fiscal.',fonte:'Tesouro Nacional · conceitos do RTN',url:RTN,consulta},
 'programacao-financeira':{termo:'Programação financeira',definicao:'Organização dos pagamentos em compatibilidade com os recebimentos previstos e as metas fiscais.',...mcasp(104)},
 localizador:{termo:'Localizador',definicao:'Detalhamento territorial da ação orçamentária, orientado pela localização dos beneficiários ou do objeto da ação.',...mcasp(76)},
 'plano-orcamentario':{termo:'Plano orçamentário',definicao:'Identificador gerencial vinculado a uma ação, com detalhamento maior que o da ação e do localizador. Não consta da LOA.',...mto(58)},
 'custo-contabil':{termo:'Custo contábil',definicao:'Consumo de recursos para produzir bens ou prestar serviços, reconhecido por competência. Não equivale ao pagamento orçamentário.',fonte:'Tesouro Nacional · definições do Portal de Custos',url:'https://www.tesourotransparente.gov.br/visualizacao/portal-de-custos-do-governo-federal',consulta}
} as const;
export type TermoId=keyof typeof GLOSSARIO;
