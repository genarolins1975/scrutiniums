/**
 * Domínios cuja atualização cada entrada com conta exibe na faixa de frescor.
 * Nas entradas que reúnem coleções (/observatorios/[id]), entram todos os
 * domínios de onde vêm os números da abertura, com o domínio próprio primeiro;
 * o teste frescor-dominios confere a lista contra os arquivos que cada entrada lê.
 */
import type { DominioFrescorId } from "./regras";
import type { ObservatorioId } from "@/lib/observatorios/registro";

export const FRESCOR_DAS_COLECOES = {
  "/setor-eletrico": ["energia"],
  "/gas-natural": ["gas"],
  "/saneamento": ["saneamento"],
  "/eficiencia-estatal": ["eficiencia"],
  "/contas-publicas": ["contas-federais", "previdencia"],
  "/agronegocio": ["agro"],
  "/combustiveis": ["gas"],
  "/conectividade": ["conectividade"],
  "/educacao-municipal": ["educacao"],
  "/custo-de-vida": ["inflacao"],
  "/contas-publicas/previdencia": ["previdencia"],
  "/contas-publicas-estaduais": ["contas-estaduais"],
} as const satisfies Record<string, readonly DominioFrescorId[]>;

export const FRESCOR_DOS_OBSERVATORIOS = {
  familias: ["inflacao", "credito", "agro", "gas", "eficiencia"],
  "servicos-publicos": ["educacao", "eficiencia"],
  "territorio-e-clima": ["territorio", "agro", "saneamento", "eficiencia", "energia"],
  "contas-publicas": ["contas-federais", "previdencia", "contas-estaduais"],
  "energia-e-infraestrutura": ["energia", "gas", "saneamento"],
  economia: ["credito", "agro"],
} as const satisfies Record<ObservatorioId, readonly DominioFrescorId[]>;
