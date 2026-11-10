/**
 * Painel "Dívida das famílias" (Observatório das Famílias, coleção Dívida e crédito das famílias): fonte única de rota,
 * título, pergunta, resumo e seção de telemetria. Registro (src/lib/observatorios/registro.ts), navegação da coleção,
 * telemetria, camada aberta e entradas leem daqui.
 *
 * É a porta da coleção desde 10/11/2026 (pedido do dono: o mesmo painel de crédito aparecia nas Famílias e na Economia).
 * A página é do próprio Observatório das Famílias (origem null no registro) e lê a gold do Crédito
 * (public/obs/data/gold/pulse.json) só no recorte de pessoa física: o dado é compartilhado, a página pertence a uma
 * pergunta. O painel do sistema inteiro, com famílias e empresas, segue em /observatorio/credit, na Economia.
 */
export const ROTA_DIVIDA = "/divida-das-familias";
export const TITULO_PAINEL = "Dívida das famílias";
export const PERGUNTA_DIVIDA = "Quanto da renda das famílias vai para as dívidas?";
export const SECAO_DIVIDA = "familias:divida";
export const DESCRICAO_DIVIDA =
  "Quanto da renda das famílias vai para as parcelas, quanto elas devem em relação à renda do ano, quanto do crédito está em atraso e quanto custam os juros, mês a mês desde 2012, com fonte, período e ressalva em cada número.";
/** Uma frase para a busca da plataforma (até 140 caracteres) e os termos que levam à página. */
export const RESUMO_DIVIDA = "Quanto da renda das famílias vai para as parcelas, quanto devem, quanto atrasam e quanto pagam de juros.";
export const TERMOS_DIVIDA = ["endividamento", "comprometimento de renda", "inadimplência", "atraso", "juros", "pessoa física", "parcela", "dívida"] as const;
