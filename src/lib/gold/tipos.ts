/**
 * Contratos do leitor único de gold (docs/DADOS_FORA_DO_DEPLOY.md).
 *
 * Preparado e desligado: nenhuma página ou rota importa este diretório. Com GOLD_ORIGEM ausente ou igual a
 * "repositorio", a leitura é a de hoje (arquivo em public/); só "externo" passa pelo manifesto e pela rede.
 */

/** Versão do formato do manifesto e do ponteiro. Mudança incompatível troca o número; o leitor recusa o que não conhece. */
export const ESQUEMA_GOLD = 1;

export type OrigemGold = "repositorio" | "externo";

/** Um arquivo da edição: o caminho é relativo à pasta do domínio em public/ (ex.: "gold/snapshot.json"). */
export interface ArquivoGold {
  caminho: string;
  bytes: number;
  /** SHA-256 do conteúdo, 64 dígitos hexadecimais minúsculos. */
  sha256: string;
}

/** Manifesto de uma edição: imutável, endereçado pela própria edição. */
export interface ManifestoGold {
  esquema: number;
  dominio: string;
  /** SHA-256 da lista canônica de arquivos (calcularEdicao): mesmos bytes, mesma edição. */
  edicao: string;
  total_arquivos: number;
  total_bytes: number;
  /** Ordenados por caminho (ordem de unidades de código, a do operador `<`). */
  arquivos: ArquivoGold[];
}

/** Ponteiro "edição corrente" do domínio: o único objeto mutável do armazenamento. */
export interface PonteiroGold {
  esquema: number;
  dominio: string;
  edicao: string;
  /** Onde está o manifesto da edição e como conferi-lo antes de confiar nele. */
  manifesto: { caminho: string; bytes: number; sha256: string };
  /** ISO 8601 da troca do ponteiro; informativo. */
  publicado_em?: string;
  /** Edição que estava corrente antes desta; informativo, serve à volta atrás. */
  anterior?: string | null;
}

export type CodigoErroGold =
  | "configuracao"
  | "caminho_invalido"
  | "ausente"
  | "fora_do_manifesto"
  | "hash_divergente"
  | "tamanho_divergente"
  | "ponteiro_invalido"
  | "manifesto_invalido"
  | "http"
  | "rede";

/**
 * Toda falha do leitor é esta exceção, com o domínio e o caminho pedidos. O leitor nunca devolve conteúdo parcial,
 * conteúdo de outra edição, valor vazio ou zero no lugar de um arquivo que não conseguiu ler e conferir.
 */
export class ErroGold extends Error {
  readonly codigo: CodigoErroGold;
  readonly dominio: string;
  readonly caminho: string;

  constructor(codigo: CodigoErroGold, dominio: string, caminho: string, mensagem: string, causa?: unknown) {
    super(`Gold ${dominio}/${caminho}: ${mensagem}`, causa === undefined ? undefined : { cause: causa });
    this.name = "ErroGold";
    this.codigo = codigo;
    this.dominio = dominio;
    this.caminho = caminho;
  }
}
