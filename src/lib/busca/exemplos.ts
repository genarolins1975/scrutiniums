import sinonimos from "./sinonimos.json";

/**
 * Exemplos do campo de busca, os mesmos três do índice (`exemplos`), lidos do arquivo de sinônimos. Só para o servidor e
 * para o gerador da barra da SPA (barraSpa.ts): o campo recebe o texto pronto e não leva o arquivo de sinônimos ao navegador.
 */
export const EXEMPLOS_BUSCA: readonly string[] = (sinonimos as { _exemplos: string[] })._exemplos;

/** Texto de exemplo do campo: "conta de luz, Ideb, dívida dos estados…". */
export const EXEMPLO_DO_CAMPO = `${EXEMPLOS_BUSCA.join(", ")}…`;
