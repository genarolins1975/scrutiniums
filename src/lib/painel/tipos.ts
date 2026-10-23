import type { ReactNode } from "react";

/**
 * Tipos do kit de painel (Iniciativa 1 do parecer de UX de 23/10/2026, docs/ux-2026-10-23/PARECER_UX_2026-10-23.md, seção 5).
 * Os tipos impedem o erro antes do teste: número sem fonte, período ou natureza não compila; valor ausente sem motivo não compila;
 * figura sem tabela equivalente, sem proveniência ou sem "não permite concluir" não compila; abertura sem recorte, fonte ou limite
 * não compila; prontidão só pelos valores do SeloProntidao.
 *
 * Natureza, Fonte, Periodo, Proveniencia e Download vieram de src/lib/energia/tipos.ts, que os reexporta: são o contrato de
 * auditabilidade da plataforma (docs/observatorios/MODELO_AUDITABILIDADE.md), não do Setor Elétrico.
 */

export type Natureza = "OBSERVADO" | "CALCULADO" | "ESTIMADO" | "PREVISTO" | "CENARIO";

export type Fonte = {
  orgao: string;
  dataset: string;
  recurso: string;
  url_dataset: string;
  url_primaria: string;
  licenca: string;
};

export type Periodo = { inicio: string; fim: string };

export type Proveniencia = {
  indicador: string;
  natureza: Natureza;
  fonte: Fonte;
  unidade: string;
  frequencia: string;
  periodo_referencia: Periodo;
  publicado_pela_fonte_em: string | null;
  capturado_em: string | null;
  validado_em: string;
  cobertura_historica: Periodo;
  transformacoes: string[];
  formula: string | null;
  snapshot: { id: string | null; sha256: string | null };
  versao_pipeline: string;
  versao_codigo: string | null;
  /** Revisões detectadas entre as vintages integradas; null quando a detecção não se aplica. */
  revisoes_conhecidas: {
    detectado_em: string;
    total: number;
    vintages_comparadas?: number;
    arquivos?: number;
    /** Downloads bem-sucedidos que vieram idênticos a uma captura já integrada (não viram vintage). */
    recapturas_sem_mudanca?: number;
    ultimo_download_ok?: string | null;
    exemplos: { serie: string; ref: string; valores: number }[];
  } | null;
  limitacoes: string[];
  download: string | null;
  notas_fonte: string | null;
};

export type Download = { rotulo: string; url: string };

/** Valores do SeloProntidao que uma página de painel pode declarar ao lado do grupo (publicado é o padrão e não se escreve). */
export type ProntidaoPainel = "parcial" | "piloto";

/* ---------------------------------------------------------------- abertura */

export type RecortePainel = {
  /** "30/09/2026", "set/2026", "2025": nunca data ISO nem hora UTC. */
  periodo: string;
  /** "quatro submercados", "Brasil, 52 distribuidoras". */
  universo: string;
  /** "R$/MWh nominais", "horas por UC". */
  unidade?: string;
  /** Fonte curta: "CCEE, PLD horário por submercado". */
  fonte: string;
};

export type AberturaProps = {
  /** Grupo da navegação da coleção ("Preços e mercado"); nunca "01 ·", nunca estado de prontidão escrito à mão. */
  grupo?: string;
  /** H1, até 60 caracteres de texto. */
  titulo: ReactNode;
  /** Até 220 caracteres. */
  lead: ReactNode;
  recorte: RecortePainel;
  /** O que a página não permite concluir, em uma frase; o kit escreve o prefixo "Não permite concluir:". */
  limite: ReactNode;
  /** A primeira ação do leitor (busca de lugar, seletor de capital, de estado ou de exercício), com rótulo visível. */
  acao?: ReactNode;
  /** Fontes por extenso, datas de cada parte e siglas: recolhido, no HTML do servidor, aberto em Auditar. */
  fontesDatasSiglas?: ReactNode;
  /** Vira SeloProntidao ao lado do grupo. */
  prontidao?: ProntidaoPainel;
  /** Cor do filete de 3 px (token da coleção). */
  acento?: AcentoPainel;
};

export type AcentoPainel = "energia" | "obee" | "gas" | "conect" | "bronze" | "destaque";

/* ------------------------------------------------------------------ número */

export type FormatoIndicador = "inteiro" | "decimal" | "percentual" | "reais" | "texto";

export type VariacaoIndicador = {
  valor: number;
  /** "em relação ao dia anterior", "contra set/2025". */
  base: string;
  /** "pp": pontos percentuais; "%": variação percentual; "absoluta": na unidade do número. */
  unidade: "pp" | "%" | "absoluta";
  casas?: number;
};

type NumeroBase = {
  rotulo: string;
  formato?: FormatoIndicador;
  casas?: number;
  unidade: string;
  /** "set/2026", "30/09/2026", "12 meses até set/2026". */
  periodo: string;
  /** "Nordeste", "famílias com renda até 2 salários". */
  recorte?: string;
  /** Fonte curta, obrigatória. */
  fonte: string;
  natureza: Natureza;
  variacao?: VariacaoIndicador;
  nota?: ReactNode;
  /** "Comprove este número": o gatilho da ficha de prova do domínio (ComproveNumero no Setor Elétrico). */
  comprove?: ReactNode;
  /** "Ver no painel", só nas entradas e portas (SeloComConta automático). */
  href?: string;
  /** "g" só para o principal do bloco. */
  tamanho?: "g" | "m" | "p";
  /** Marcador de série (token --serie-*), quando o número tem a cor de uma série do gráfico; nunca a cor do texto. */
  marcador?: CorSerie;
  /** Endereço do número (âncora), repassado à prova. */
  id?: string;
};

/** União discriminada: valor presente sem motivo, ou ausência (null) com o motivo. Ausência nunca vira zero. */
export type NumeroProps =
  | (NumeroBase & { valor: number; valorTexto?: string; motivoAusencia?: never })
  | (NumeroBase & { valor: null; valorTexto?: never; motivoAusencia: string })
  | (NumeroBase & { valor?: never; valorTexto: string; formato: "texto"; motivoAusencia?: never });

/* ------------------------------------------------------------------ figura */

export type CelulaTabela = string | number | null;

export type TabelaEquivalente = {
  colunas: string[];
  linhas: CelulaTabela[][];
  /** Arquivo da série completa (rota de servidor fechada). */
  csv?: string;
  titulo?: string;
  /** Casas decimais por coluna numérica (null = até 2). */
  casas?: (number | null)[];
  /** Linhas à vista; o resto fica no CSV (padrão: 30, as últimas). */
  limite?: number;
};

export type FiguraProps = {
  id: string;
  /** Título, em pergunta ou conclusão factual. */
  pergunta: string;
  /** "indicador · unidade · universo". */
  subtitulo: string;
  natureza: Natureza;
  /** Um Grafico* do kit (ou o mapa legado, marcado data-mapa-legado, até a Iniciativa 5). */
  children: ReactNode;
  /** LeituraGuiada: uma frase factual do mesmo contrato do gráfico, sem causa. */
  leitura?: ReactNode;
  tabela: TabelaEquivalente;
  proveniencia: Proveniencia;
  /** Outras séries da mesma figura, com proveniência própria (selo e "Sobre este dado" próprios). */
  complementares?: { rotulo: string; p: Proveniencia }[];
  naoConcluir: ReactNode;
  porQueImporta?: ReactNode;
  oQueMudou?: ReactNode;
  comoInterpretar?: ReactNode;
  /** Limitação material, sempre à vista, nunca em dica. */
  ressalva?: ReactNode;
  /** Rota de servidor fechada; SeloComConta automático. */
  download?: { href: string; rotulo: string };
  nivel?: "entender" | "analisar" | "auditar";
  nivelTitulo?: 2 | 3;
  /** Conteúdo que acompanha a figura e não é o gráfico (o detalhe de um dia, a nota de empates); fica abaixo da leitura. */
  complemento?: ReactNode;
};

/* ------------------------------------------------------------------ tabela */

export type TabelaDadosProps = {
  titulo: string;
  colunas: string[];
  linhas: CelulaTabela[][];
  csv?: string;
  /** Linhas à vista (as últimas); o resto fica no arquivo. */
  limite?: number;
  casas?: (number | null)[];
  /** Por coluna: texto que vem dos dados em português ("nome" sai em <Nome>, "portugues" em <TrechoPortugues> na página inglesa). */
  idiomaTexto?: ("nome" | "portugues" | null)[];
  /** Ordenação pelo cabeçalho, com o estado visível e aria-sort. */
  ordenavel?: boolean;
  /** Como mostrar null por coluna ("não elegível", "não publicado"); sempre texto, padrão "sem dado". */
  ausencia?: Record<string, string>;
  fixarPrimeiraColuna?: boolean;
  /** Recolhida em <details> (tabela equivalente de figura) ou à vista (fatia `tabelas`). */
  recolhida?: boolean;
  /** Frase sob a tabela (o que ela mostra e o que não). */
  nota?: ReactNode;
  /** No celular a tabela rola dentro do próprio bloco; a página nunca rola na horizontal. */
  rolagem?: "tabela";
  idioma?: "pt" | "en";
};

/* --------------------------------------------------------------- controles */

export type ControlesProps = {
  /** Nome acessível do grupo ("Recorte da comparação"). */
  rotulo: string;
  /** <select>, <input>, busca de lugar; cada um com <label> visível. */
  children: ReactNode;
  /** Link para o estado padrão. */
  limpar?: { href: string };
  /** "Mostrando 26 capitais, exercício 2025". */
  resumo?: ReactNode;
  idioma?: "pt" | "en";
};

/* --------------------------------------------------------------- didática */

export type ItemParaLer = {
  /** Termo ou unidade, como aparece na página. */
  termo: ReactNode;
  /** Uma ou duas frases em palavras simples. */
  definicao: ReactNode;
  /** Exemplo com número da base da página (opcional). */
  exemplo?: ReactNode;
};

export type ParaLerProps = {
  id: string;
  titulo?: ReactNode;
  itens: ItemParaLer[];
  nivelTitulo?: 2 | 3;
  nota?: ReactNode;
};

/* ---------------------------------------------------------------- gráficos */

/** Cores de série: só tokens de série e de escala, e o acento da coleção para a série focal. Texto nunca na cor da série. */
export type CorSerie = `var(--serie-${string})` | `var(--escala-${string})` | `var(--cor-${AcentoPainel})`;

/** y: null é lacuna na linha, nunca zero nem interpolação. */
export type PontoGrafico = { x: string | number; y: number | null };

export type SerieGrafico = {
  id: string;
  nome: string;
  pontos: readonly PontoGrafico[];
  /** Ordem fixa: sem cor, a série i recebe --serie-(i+1). */
  cor?: CorSerie;
  /** Previsão tracejada; cenário pontilhado (o kit desenha o traço). */
  natureza?: "observado" | "previsto" | "cenario";
};

export type EixoY = { unidade: string; zero?: boolean; casas?: number };

/* ------------------------------------------------------------------- molde */

export type PaginaPainelProps = {
  /** Endereço público; o RotuloContexto e o teste do molde leem por ele. */
  rota: string;
  abertura: AberturaProps;
  /** De 1 a 4. */
  numeros?: readonly NumeroProps[];
  /** Ressalva da faixa inteira. */
  notaNumeros?: ReactNode;
  /** Nome acessível da faixa de números. */
  rotuloNumeros?: string;
  /** Só FiguraAnalitica e Recolhido. */
  figuras?: ReactNode;
  /** Só TabelaDados e Recolhido. */
  tabelas?: ReactNode;
  /** Controles junto do bloco que afetam: cada um vem dentro da fatia que ele controla (Controles com `fatia`). */
  notas?: ParaLerProps;
  metodo: ReactNode;
  frescorMetodo?: ReactNode;
  /** Mostra o ModoProfundidade (Entender, Analisar, Auditar) abaixo dos números. */
  profundidade?: boolean;
  idioma?: "pt" | "en";
  /** false quando o layout da coleção já abre o <main> (Agronegócio). */
  principal?: boolean;
  /** Antes da abertura, fora das fatias: o aviso de defasagem da base, quando há. */
  aviso?: ReactNode;
  /** Navegação local entre as páginas de um tema (os capítulos do PLD), logo depois dos números. */
  navegacaoLocal?: ReactNode;
};
