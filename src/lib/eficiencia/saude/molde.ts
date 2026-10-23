import type { MedidaSaudeId, TemaSaude } from "./medidas";

/**
 * Textos e opções das páginas da Saúde nas capitais no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026), num módulo sem
 * "use client": a página do servidor (abertura, faixa) e as ilhas do navegador (figuras) leem as mesmas constantes.
 */

/** Os três perímetros do panorama: o que cada grupo de medidas permite mostrar e o que não permite presumir. */
export const GRUPOS: { id: string; titulo: string; pergunta: string; mostra: string; naoPresume: string; tema: TemaSaude; medidas: MedidaSaudeId[] }[] = [
  {
    id: "recursos",
    titulo: "Recursos executados pelo município",
    pergunta: "Quanto o município aplica?",
    mostra: "Orçamento municipal e despesa declarada em Saúde (DCA e SIOPS).",
    naoPresume: "Gasto total de União, estado e município no território.",
    tema: "gastos",
    medidas: ["despesa_hab", "asps_pct"],
  },
  {
    id: "servicos",
    titulo: "Serviços localizados no território",
    pergunta: "Que estrutura está registrada?",
    mostra: "Estabelecimentos, equipes e cobertura potencial, conforme o CNES e o Relatório APS.",
    naoPresume: "Que a rede pertença à prefeitura, funcione de fato ou atenda só seus moradores.",
    tema: "rede",
    medidas: ["ubs_10mil", "esf_10mil", "cobertura_aps"],
  },
  {
    id: "residentes",
    titulo: "População residente",
    pergunta: "Que resultados são observados entre os moradores?",
    mostra: "Eventos por município de residência, com o universo declarado (SUS, AIH tipo 1).",
    naoPresume: "Que o resultado seja causado exclusivamente pela gestão municipal.",
    tema: "resultados",
    medidas: ["icsap_taxa", "icsap_part"],
  },
];

/** Opções fixas do panorama: valores nominais e a população do Ministério da Saúde (as visões dos temas trocam as duas). */
export const OPCOES_PANORAMA = { moeda: "nominal" as const, denominador: "ripsa" as const };

/** Casas decimais do gráfico, as mesmas do formatador de cada medida (MEDIDAS_SAUDE[id].formata): o arredondamento não muda. */
export const CASAS: Partial<Record<MedidaSaudeId, number>> = { despesa: 0, icsap_n: 0, despesa_hab: 0, asps_pct: 1, ubs_10mil: 2, esf_10mil: 2, eap_10mil: 2, cobertura_aps: 1, icsap_taxa: 0, icsap_part: 1 };

/**
 * Pergunta (H1, até 60 caracteres) e frase de abertura de cada tema. A pergunta de antes ("Quanto a prefeitura executa em Saúde, por
 * habitante e em quais componentes?") passa inteira para a abertura: a primeira parte no título, o resto na frase.
 */
export const TITULO_TEMA: Record<TemaSaude, { titulo: string; pergunta: string; h1: string; lead: string }> = {
  gastos: {
    titulo: "Gastos",
    pergunta: "Quanto a prefeitura executa em Saúde, por habitante e em quais componentes?",
    h1: "Quanto a prefeitura executa em Saúde?",
    lead: "Por habitante e em quais componentes: a despesa que a prefeitura executa; não é o gasto de União e estado no território.",
  },
  rede: {
    titulo: "Rede e atenção primária",
    pergunta: "Que estabelecimentos, equipes e cobertura estão registrados?",
    h1: "Que estabelecimentos, equipes e cobertura estão registrados?",
    lead: "O cadastro de estabelecimentos e equipes situados na capital e a cobertura potencial das equipes; não prova funcionamento nem acesso.",
  },
  resultados: {
    titulo: "Atendimento e resultados",
    pergunta: "Que resultados são observados entre os moradores, e que parte do atendimento a fonte não permite mostrar?",
    h1: "Que resultados são observados entre os moradores?",
    lead: "E que parte do atendimento a fonte não permite mostrar: as internações dos moradores, onde quer que ocorram; não é produção da prefeitura.",
  },
};

