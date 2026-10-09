/**
 * Registro das classes de LITERAL: texto que a página preserva exatamente como está, porque é
 * evidência (valor da fonte, trecho citado) ou identificador técnico, e não prosa do leitor.
 *
 * Contrato (verificado em src/tests/html-gerado.test.ts sobre o HTML gerado):
 *  - todo literal pertence a uma classe registrada aqui; classe nova exige entrada neste arquivo;
 *  - o conteúdo literal precisa casar com `padrao` e caber em `maxCaracteres` (um parágrafo
 *    inteiro não passa);
 *  - o rótulo visível vem do papel e cita a fonte curta; a origem é recuperável (`data-origem`);
 *  - o literal não autoriza ignorar o texto ao redor: datas ISO fora dele continuam reprovando.
 *
 * Política e exemplos: docs/obee/APRESENTACAO_DATAS_ENERGIA.md.
 */

export type PapelLiteral = "citacao" | "valor" | "registro" | "identificador";

/** Rótulo visível por papel. Distingue o que a fonte escreveu do que o observatório compôs. */
export const ROTULO_PAPEL: Record<PapelLiteral, string> = {
  citacao: "Trecho da fonte",
  valor: "Valor na fonte",
  registro: "Registro composto pelo observatório",
  identificador: "Identificador gerado pelo observatório",
};

export type DefLiteral = {
  papel: PapelLiteral;
  /** Origem em poucas palavras; aparece no rótulo visível. */
  fonteCurta: string;
  /** O que é, de onde vem e por que é preservado como está. */
  descricao: string;
  /** Contrato do conteúdo literal. */
  padrao: RegExp;
  maxCaracteres: number;
  /**
   * Onde está a explicação da condição constatada: "contexto" (a frase ou a linha da tabela que
   * envolve o literal) ou "inline" (elemento `data-literal-explicacao` dentro do literal).
   */
  explicacao: "contexto" | "inline";
  /** Quando o texto da fonte puder trazer os tokens undefined ou NaN. Nenhuma classe precisa hoje. */
  permiteUndefinedNaN?: boolean;
  /** Detecção do literal em texto corrido: o grupo 1 é o literal. Usada quando o texto vem do pipeline. */
  deteccao?: RegExp;
};

export const LITERAIS = {
  "texto-direitos-camada": {
    papel: "citacao",
    fonteCurta: "camada da EPE",
    descricao:
      "Texto de direitos (copyrightText) que o serviço de mapas da EPE informa para a camada, citado entre aspas na descrição da fonte. Preservado porque a data faz parte do texto da fonte.",
    padrao: /^[^;\n]{1,80}(;[^;\n]{1,80}){1,3}$/,
    maxCaracteres: 160,
    explicacao: "contexto",
    deteccao: /copyrightText da camada: '([^'\n]+)'/,
  },
  "marcador-ausencia-siga": {
    papel: "valor",
    fonteCurta: "SIGA/ANEEL",
    descricao:
      "Data que o SIGA grava no lugar de uma data de entrada em operação que não existe. A frase em que aparece diz o que significa; a data original é preservada para que o marcador seja reconhecível na fonte.",
    padrao: /^1900-01-03$/,
    maxCaracteres: 10,
    explicacao: "contexto",
    deteccao: /(?:marcador|com) (1900-01-03)(?= (?:do SIGA|e localização))/,
  },
  "data-planilha-inexistente": {
    papel: "valor",
    fonteCurta: "planilha do MCTI",
    descricao:
      "Valor da coluna de data de uma planilha do MCTI que não existe no calendário (por exemplo, 29 de fevereiro de um ano não bissexto). A linha da tabela traz o motivo do descarte. O original é preservado exatamente; não é corrigido nem convertido.",
    padrao: /^\d{4}-\d{2}-\d{2}$/,
    maxCaracteres: 10,
    explicacao: "contexto",
  },
  "data-fim-fora-da-cronologia": {
    papel: "valor",
    fonteCurta: "dados abertos da ANEEL",
    descricao:
      "Data de fim de um evento no arquivo da ANEEL. É uma data válida no calendário, mas posterior à data de geração do arquivo; a frase em que aparece registra essa incompatibilidade. O original é preservado.",
    padrao: /^\d{4}-\d{2}-\d{2}$/,
    maxCaracteres: 10,
    explicacao: "contexto",
    deteccao: /fim \((\d{4}-\d{2}-\d{2})\) posterior à geração do arquivo/,
  },
  "ato-retificacao-sem-numero": {
    papel: "identificador",
    fonteCurta: "dados abertos da ANEEL",
    descricao:
      "Código do ato quando o despacho de retificação não tem número: a espécie (DSP-RET) e a data de publicação, compostos pelo pipeline como chave do ato. Preservado porque é a chave usada nos arquivos analíticos.",
    padrao: /^[A-Z]{2,4}-[A-Z]{2,4} \d{4}-\d{2}-\d{2}$/,
    maxCaracteres: 24,
    explicacao: "contexto",
  },
  "registro-composto-bandeiras": {
    papel: "registro",
    fonteCurta: "dados abertos da ANEEL",
    descricao:
      "Campos do conjunto de dados das bandeiras tarifárias (ato, data de vigência ou competência, patamar e valor) reunidos pelo pipeline numa linha separada por ponto e vírgula. Não é citação do ato: o texto do ato não foi lido para esses eventos. Preservado como registro técnico.",
    // três ou mais campos separados por ponto e vírgula, cada um com até seis palavras: prosa não passa
    padrao: /^\S+(?: \S+){0,5}(?:; ?\S+(?: \S+){0,5}){2,}$/,
    maxCaracteres: 600,
    explicacao: "contexto",
  },
} as const satisfies Record<string, DefLiteral>;

export type ClasseLiteral = keyof typeof LITERAIS;

export const CLASSES_LITERAL = Object.keys(LITERAIS) as ClasseLiteral[];

export function defLiteral(classe: string): DefLiteral | null {
  return Object.prototype.hasOwnProperty.call(LITERAIS, classe) ? (LITERAIS as Record<string, DefLiteral>)[classe] : null;
}

/** Formato aceito para a origem: endereço https ou caminho absoluto do próprio site. */
export const ORIGEM_VALIDA = /^(https:\/\/[^\s]+|\/[^\s]*)$/;
