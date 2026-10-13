import {DADOS} from '@/lib/contas-publicas/dados';

/** Conferência editorial da edição oficial em 13/10/2026; não é captura da série. */
export function AvisoAtualidadeRTN(){
 if(DADOS.referenciaRTN>='2026-08')return null;
 return <aside className="cp-status cp-freshness"><strong>Há uma edição mais recente na fonte.</strong> A série integrada abaixo vai até julho de 2026. O Tesouro publicou agosto em 29/09/2026; essa edição ainda não foi incorporada e conciliada neste painel. <a href="https://www.tesourotransparente.gov.br/publicacoes/boletim-resultado-do-tesouro-nacional-rtn/2026/8">Consultar a edição de agosto ↗</a><span>Conferência editorial: 13/10/2026. Captura recente não significa período de referência atualizado.</span></aside>;
}
