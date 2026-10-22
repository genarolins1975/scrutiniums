/**
 * Contrato do índice da busca da plataforma (public/busca/indice.json). Leve e sem leitura de dado: importável pelo
 * navegador. O índice só leva o que qualquer pessoa pode ver sem conta: títulos, resumos, endereços, situação e termos;
 * nunca número, série ou arquivo de painel.
 */
import type { ObservatorioId } from "@/lib/observatorios/lista";

export type TipoEntrada = "observatorio" | "colecao" | "pagina" | "pergunta" | "consulta" | "verbete" | "metodo";

/** "previsto": consta do catálogo e ainda não tem página; aparece como "ainda sem página", sem link. */
export type SituacaoEntrada = "publicado" | "parcial" | "previsto";

export type EntradaBusca = {
  id: string;
  tipo: TipoEntrada;
  titulo: string;
  /** Uma frase sobre o destino; vazia quando o catálogo não traz. */
  resumo: string;
  /** null só para página prevista, que ainda não existe. */
  href: string | null;
  observatorio: ObservatorioId;
  /** Coleção do registro (lista.ts); null para o próprio observatório e as páginas dele. */
  colecao: string | null;
  situacao: SituacaoEntrada;
  /** O destino abre sem conta (ehRotaPublica); sem sessão, o fechado leva o selo "com conta". */
  aberta: boolean;
  /** Palavras que levam ao destino além do título: pergunta, nomes e sinônimos. */
  termos: string[];
  /** Listas de lugares e nomes do cabeçalho do índice que também levam ao destino (só nas consultas pessoais). */
  lugares?: TipoLugar[];
};

/** Capitais, estados, distribuidoras e bancos: guardados uma vez no índice, não repetidos em cada consulta. */
export type TipoLugar = "capital" | "uf" | "distribuidora" | "banco";

export type IndiceBusca = {
  versao: 1;
  observatorios: { id: ObservatorioId; nome: string }[];
  colecoes: { id: string; observatorio: ObservatorioId; nome: string; href: string }[];
  /** Três exemplos para o campo ("conta de luz, Ideb, dívida dos estados…"). */
  exemplos: string[];
  lugares: Record<TipoLugar, string[]>;
  entradas: EntradaBusca[];
};
