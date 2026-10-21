/**
 * Tipos da gold do IPCA por área (public/inflacao/gold/ipca.json, pipeline/inflacao/gold.py) e dos recortes que cada
 * página manda ao navegador. Sem leitura de disco: importável por componentes do navegador.
 */
/** Código do Brasil no SIDRA: a opção padrão do seletor e a referência de cada área. */
export const BRASIL = "1";

export type TipoArea = "pais" | "regiao_metropolitana" | "municipio";

export type Area = { id: string; nome: string; uf: string | null; tipo: TipoArea; rotulo: string };
export type Grupo = { id: string; numero: number; nome: string; principais: string[] };

export type UltimoGrupo = {
  mensal: number;
  ano: number;
  doze: number;
  peso: number;
  peso_inicio: number;
  contribuicao_pp: number;
  dif_brasil_pp: number;
};

export type UltimoArea = {
  geral: { mensal: number; ano: number; doze: number; dif_brasil_pp: number };
  grupos: Record<string, UltimoGrupo>;
  soma_contribuicoes_pp: number;
  residuo_pp: number;
};

export type Subitem = { id: string; nome: string; grupo: string; doze: number; peso: number; peso_inicio: number; contribuicao_pp: number };

export type GoldInflacao = {
  versao: string;
  fonte: {
    orgao: string;
    pesquisa: string;
    tabela: string;
    nome_tabela: string;
    url_tabela: string;
    url_metodo: string;
    divulgado_em: string | null;
    proxima_divulgacao: { data: string; referencia: string } | null;
  };
  capturado_em: string;
  hash_dados: string;
  primeiro_mes: string;
  ultimo_mes: string;
  inicio_janela: string;
  primeiro_mes_doze: string;
  meses: string[];
  areas: Area[];
  grupos: Grupo[];
  serie: Record<string, { mensal: (number | null)[]; doze: (number | null)[] }>;
  ultimo: Record<string, UltimoArea>;
  subitens: Record<string, Subitem[]>;
  destaques: Record<string, { elegiveis: number; na_cesta: number; peso_elegiveis: number; sobem: string[]; caem: string[] }>;
  regras: { peso_minimo_destaque: number };
};

/** Identidade do último mês, que toda medida da página repete. */
export type Referencia = { ultimoMes: string; inicioJanela: string; divulgadoEm: string | null; tabela: string };

/** O que a primeira tela usa de cada área: o índice geral e os nove grupos no último mês. */
export type AreaNaTela = {
  id: string;
  nome: string;
  uf: string | null;
  tipo: TipoArea;
  rotulo: string;
  geral: { mensal: number; ano: number; doze: number; dif: number };
  grupos: Record<string, { doze: number; peso: number; dif: number }>;
};

export type DadosPrimeiraTela = { ref: Referencia; grupos: Grupo[]; areas: AreaNaTela[] };

/** O artefato "Como o IPCA pesa o seu orçamento": pesos no início da janela, variação e contribuição de cada grupo. */
export type AreaNoArtefato = {
  id: string;
  grupos: Record<string, { pesoInicio: number; peso: number; doze: number; contribuicao: number }>;
  doze: number;
  soma: number;
  residuo: number;
};

export type Destaque = { nome: string; grupo: string; doze: number; peso: number; contribuicao: number };
export type DestaquesArea = { sobem: Destaque[]; caem: Destaque[]; elegiveis: number; naCesta: number; pesoElegiveis: number };
