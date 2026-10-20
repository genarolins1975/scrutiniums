/**
 * Origem de cada página com a barra comum (CabecalhoPlataforma): a coleção
 * (domínio de src/lib/dominios.ts) ou o observatório inteiro, com o nome que
 * aparece no recorte salvo e na citação e as fontes de dados (domínios de
 * frescor, src/lib/frescor/limiares.json) que alimentam o "Citar" e o "Avisar
 * quando atualizar". Código puro, sem leitura de disco.
 */
import { DOMINIOS, type DominioId } from "@/lib/dominios";
import { OBSERVATORIOS, type ObservatorioId } from "@/lib/observatorios/lista";
import { FRESCOR_DOS_OBSERVATORIOS } from "@/lib/frescor/entradas";
import type { DominioFrescorId } from "@/lib/frescor";

export type OrigemId = DominioId | ObservatorioId;

/** Fontes de dados de cada coleção. */
export const FRESCOR_DA_COLECAO: Record<DominioId, readonly DominioFrescorId[]> = {
  credito: ["credito"],
  energia: ["energia"],
  eficiencia: ["eficiencia"],
  contas: ["contas-federais", "previdencia"],
  estados: ["contas-estaduais"],
  saneamento: ["saneamento"],
  gas: ["gas"],
  agro: ["agro"],
};

/** Entrada com conta de cada fonte de dados: o link do aviso por e-mail. */
export const ENTRADA_DO_DOMINIO: Record<DominioFrescorId, string> = {
  credito: "/observatorio",
  energia: "/setor-eletrico",
  gas: "/gas-natural",
  saneamento: "/saneamento",
  agro: "/agronegocio",
  territorio: "/territorio",
  inflacao: "/custo-de-vida",
  previdencia: "/contas-publicas/previdencia",
  conectividade: "/conectividade",
  educacao: "/educacao-municipal",
  "contas-federais": "/contas-publicas",
  "contas-estaduais": "/contas-publicas-estaduais",
  eficiencia: "/eficiencia-estatal",
};

const ORIGENS = new Set<string>([...DOMINIOS.map((d) => d.id), ...OBSERVATORIOS.map((o) => o.id)]);

export function ehOrigem(valor: unknown): valor is OrigemId {
  return typeof valor === "string" && ORIGENS.has(valor);
}

/** Nome completo da origem ("Observatório Brasileiro do Setor Elétrico"); id desconhecido volta como está. */
export function nomeOrigem(id: string): string {
  return DOMINIOS.find((d) => d.id === id)?.nome ?? OBSERVATORIOS.find((o) => o.id === id)?.nome ?? id;
}

/**
 * Origem e fontes de uma página a partir do que o cabeçalho recebe. A coleção
 * vale mais que o observatório (é a dona do painel); sem nenhuma das duas, não
 * há origem e a barra de ferramentas não aparece.
 */
export function origemDoCabecalho(
  colecao: DominioId | null | undefined,
  observatorio: ObservatorioId | null | undefined,
  dominios?: readonly DominioFrescorId[],
): { id: OrigemId; nome: string; dominios: readonly DominioFrescorId[] } | null {
  if (colecao) return { id: colecao, nome: nomeOrigem(colecao), dominios: dominios ?? FRESCOR_DA_COLECAO[colecao] };
  if (observatorio) return { id: observatorio, nome: nomeOrigem(observatorio), dominios: dominios ?? FRESCOR_DOS_OBSERVATORIOS[observatorio] };
  return null;
}
