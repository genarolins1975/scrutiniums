/**
 * Painéis do Observatório das Famílias reescritos como páginas Next, com endereço em português, a partir das vistas da
 * aplicação de página única do Crédito (decisão do dono de 10/11/2026, recomendação 5 do parecer estrutural). Fonte única
 * para o registro, a navegação, a busca e o redirecionamento. Arquivo leve, sem leitura de gold.
 *
 * Os dados ficam em paineis-reescritos.json, ao lado, porque o next.config.mjs (que não importa TypeScript) lê a mesma lista para
 * montar os redirecionamentos: este arquivo só lhe dá tipo. Não existe segunda lista.
 *
 * `abaAntiga` é o caminho da vista na aplicação (/observatorio<abaAntiga>): ela sai do registro, da navegação e da busca.
 * `redirecionar: true` faz o endereço antigo responder com redirecionamento permanente para `rota`, com a consulta preservada
 * (redirects() em next.config.mjs), e faz a aplicação do Crédito sair para a página nova em todo caminho interno que levava à
 * vista (índice "Início do painel", pontes e alertas; `substituidas` no índice de barraSpa.ts).
 *
 * Decisão do dono de 10/11/2026: redirecionar já as seis vistas cujo painel novo não tem perda declarada (Desenrola, Apostas,
 * Golpes e fraudes, Clientes contra bancos, Bancos cobrando na Justiça, Sanções e reclamações) e manter no endereço antigo as
 * três com perda (Consignado, Crédito imobiliário e Emprego formal) até os mapas serem migrados. No mesmo dia a perda das três
 * foi fechada e as nove passaram a redirecionar. A tabela de paridade de cada painel e o fechamento estão em
 * docs/familias/PARIDADE.md.
 */
import type { ObservatorioId } from "./lista";
import DADOS from "./paineis-reescritos.json";

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

export const PAINEIS_REESCRITOS: readonly PainelReescrito[] = DADOS.map((r) => ({ ...r, observatorio: "familias" as const }));

/** Prefixo da aplicação de página única do Crédito: o endereço antigo de uma vista é PREFIXO_APLICACAO + abaAntiga. */
export const PREFIXO_APLICACAO = "/observatorio";

/** Painéis cujo endereço antigo já redireciona para a página nova. */
export const PAINEIS_REDIRECIONADOS: readonly PainelReescrito[] = PAINEIS_REESCRITOS.filter((r) => r.redirecionar);

/** Endereço antigo (com o prefixo da aplicação) → página nova, só para os redirecionados. */
export const DESTINO_DO_ENDERECO_ANTIGO: ReadonlyMap<string, string> = new Map(PAINEIS_REDIRECIONADOS.map((r) => [PREFIXO_APLICACAO + r.abaAntiga, r.rota]));
