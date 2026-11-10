/**
 * Painéis do Observatório das Famílias reescritos como páginas Next, com endereço em português, a partir das vistas da
 * aplicação de página única do Crédito (decisão do dono de 10/11/2026, recomendação 5 do parecer estrutural). Fonte única
 * para o registro, a navegação e a busca. Arquivo leve, sem leitura de gold.
 *
 * `abaAntiga` é o caminho da vista na aplicação (/observatorio<abaAntiga>): ela sai do registro e continua servida no
 * endereço antigo até o redirecionamento. `redirecionar` só vira true depois de a paridade ser conferida no navegador; a
 * tabela de paridade de cada painel está em docs/familias/PARIDADE.md.
 */
import type { ObservatorioId } from "./lista";

export type PainelReescrito = {
  rota: string;
  titulo: string;
  colecao: string;
  observatorio: ObservatorioId;
  abaAntiga: string;
  resumo: string;
  termos: readonly string[];
  secao: string;
  redirecionar: boolean;
};

const d = (rota: string, titulo: string, abaAntiga: string, secao: string, resumo: string, termos: string[], colecao = "divida"): PainelReescrito => ({
  rota, titulo, colecao, observatorio: "familias", abaAntiga, resumo, termos, secao, redirecionar: false,
});

export const PAINEIS_REESCRITOS: readonly PainelReescrito[] = [
  d("/divida-das-familias/consignado", "Consignado e aposentados", "/payroll-lending-aging", "familias:consignado", "O consignado pesa mais onde há mais aposentados?", ["consignado", "aposentados", "INSS", "envelhecimento"]),
  d("/divida-das-familias/desenrola", "Desenrola Brasil", "/desenrola", "familias:desenrola", "Quem o Desenrola alcançou e com que descontos?", ["Desenrola", "renegociação", "desconto", "dívida negativada"]),
  d("/divida-das-familias/apostas", "Apostas e crédito das famílias", "/bets-financial-risk", "familias:apostas", "As apostas online pesam no crédito das famílias?", ["bets", "apostas online", "GGR", "autoexclusão", "Pix"]),
  d("/divida-das-familias/golpes-e-fraudes", "Golpes e fraudes", "/financial-fraud", "familias:golpes-e-fraudes", "Quanto se perde com golpes e fraudes financeiras?", ["golpe", "fraude", "golpe do Pix", "MED", "devolução"]),
  d("/divida-das-familias/clientes-contra-bancos", "Clientes contra bancos na Justiça", "/lawsuits", "familias:clientes-contra-bancos", "Quanto o Judiciário é acionado em temas bancários?", ["processos", "litígios", "CNJ", "DataJud", "consumidor"]),
  d("/divida-das-familias/bancos-cobrando-na-justica", "Bancos cobrando na Justiça", "/debt-collection-lawsuits", "familias:bancos-cobrando-na-justica", "Quantas ações de cobrança de crédito chegam à Justiça?", ["cobrança judicial", "busca e apreensão", "execução", "DataJud"]),
  d("/divida-das-familias/sancoes-e-reclamacoes", "Sanções e reclamações", "/conduct-enforcement", "familias:sancoes-e-reclamacoes", "Quais punições e reclamações recaem sobre o sistema financeiro?", ["sanções", "multa", "inabilitação", "reclamações"]),
  d("/credito-imobiliario", "Crédito imobiliário e moradia", "/housing-credit", "familias:credito-imobiliario", "Como o Brasil mora e onde o crédito imobiliário chega?", ["financiamento imobiliário", "casa própria", "prestação", "aluguel"], "moradia"),
  d("/emprego-formal", "Emprego formal por setor e estado", "/formal-employment", "familias:emprego-formal", "Como anda o emprego formal por setor e por estado?", ["Novo Caged", "admissões", "desligamentos", "carteira assinada"], "renda"),
];
