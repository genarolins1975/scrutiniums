/**
 * Contrato da gold do painel Conectividade (pipeline/conectividade/gold.py): public/conectividade/gold/conectividade.json e
 * um arquivo por UF em public/conectividade/gold/municipios/{UF}.json. Tudo aqui vem da Anatel; o que é cálculo da
 * Scrutiniums (partes em %, médias ponderadas, posições, quantis) está dito na gold (`notas`). Ausência é `null`.
 */

export type TecnologiaCobertura = "todas" | "g2" | "g3" | "g4" | "g5" | "g4g5";

/** Banda larga fixa: o mês mais recente. */
export type Fixa = {
  acessos: number;
  /** Acessos por 100 habitantes, como a Anatel publica (ver notas.densidade). */
  densidade: number | null;
  fibra_pct: number | null;
  coaxial_pct: number | null;
  radio_pct: number | null;
  satelite_pct: number | null;
  metalico_pct: number | null;
  vel_ate_10_pct: number | null;
  vel_10_25_pct: number | null;
  vel_25_100_pct: number | null;
  vel_100_mais_pct: number | null;
  pessoa_fisica_pct: number | null;
  prestadoras: number;
  maior_grupo: string | null;
  maior_grupo_pct: number | null;
};

/** Telefonia móvel: o mês mais recente. `acessos` é o total que a Anatel publica (sem M2M e pontos de serviço). */
export type Movel = {
  acessos: number;
  linhas: number;
  densidade: number | null;
  g2_pct: number | null;
  g3_pct: number | null;
  g4_pct: number | null;
  g5_pct: number | null;
  pre_pct: number | null;
  pos_pct: number | null;
  pessoa_fisica_pct: number | null;
  m2m_pct: number | null;
  ponto_servico_pct: number | null;
  maior_grupo: string | null;
  maior_grupo_pct: number | null;
};

/** Cobertura das redes móveis do município no trimestre mais recente; medidas em [% moradores, % domicílios, % área]. */
export type CoberturaMunicipio = {
  moradores: number;
  domicilios: number;
  area_km2: number | null;
  tecnologias: Partial<Record<TecnologiaCobertura, [number, number, number] | null>>;
  operadoras: Record<string, { g4g5_moradores: number | null; todas_moradores: number | null }>;
  serie_g4_moradores: (number | null)[];
  serie_g5_moradores: (number | null)[];
};

export type MedidaPosicao =
  | "fixa_densidade"
  | "fixa_fibra_pct"
  | "fixa_vel_100_mais_pct"
  | "movel_densidade"
  | "movel_g5_pct"
  | "cobertura_g4_moradores"
  | "cobertura_g5_moradores";

export type MunicipioGold = {
  id: string;
  nome: string;
  uf: string;
  fixa: Fixa | null;
  movel: Movel | null;
  cobertura: CoberturaMunicipio | null;
  ausencias: ("fixa" | "movel" | "cobertura")[];
  posicao: Record<MedidaPosicao, { uf: number | null; brasil: number | null }>;
};

export type ArquivoUf = {
  uf: string;
  nome_uf: string;
  referencia: Referencia;
  trimestres_cobertura: string[];
  operadoras: string[];
  municipios_brasil: number;
  municipios: MunicipioGold[];
};

export type Referencia = { fixa: string; movel: string; cobertura: string };

export type Quantis = { n: number; p10: number; p25: number; p50: number; p75: number; p90: number } | null;

export type UfGold = {
  uf: string;
  nome: string;
  municipios: number;
  fixa: Fixa | null;
  movel: Movel | null;
  cobertura: {
    moradores: number;
    municipios_com_dado: number;
    todas_moradores: number | null;
    g4_moradores: number | null;
    g5_moradores: number | null;
    g4g5_moradores: number | null;
    municipios_sem_5g: number;
    municipios_4g_abaixo_50: number;
  };
  sem_fibra: number;
  uma_prestadora: number;
};

export type Membro = { membro: string; bytes: number; sha256: string; modificado_no_zip: string };
export type Fonte = {
  orgao: string;
  nome: string;
  pagina: string;
  licenca: string;
  url: string;
  zip_bytes: number;
  zip_modificado_em: string | null;
  membros: Membro[];
  capturado_em: string;
  referencia: string;
};

export type GoldConectividade = {
  versao: string;
  gerado_por: string;
  capturado_em: string;
  referencia: Referencia;
  trimestres_cobertura: string[];
  operadoras: string[];
  notas: { densidade: string; movel_acessos: string; cobertura: string; ausencia: string };
  fontes: { fixa: Fonte; movel: Fonte; cobertura: Fonte };
  brasil: {
    fixa: Fixa & {
      acessos_mensal: { meses: string[]; acessos: (number | null)[] };
      produto: Record<string, number>;
      grupos: { grupo: string; acessos: number; pct: number | null }[];
    };
    movel: Movel & {
      acessos_mensal: { meses: string[]; acessos: (number | null)[] };
      grupos: { grupo: string; acessos: number; pct: number | null }[];
    };
    cobertura: {
      populacao: { moradores: number; domicilios: number; censo: number } | null;
      tecnologias: Partial<Record<TecnologiaCobertura, [number, number, number]>>;
      operadoras: Record<string, { g4g5_moradores: number | null; todas_moradores: number | null }>;
      trimestres: string[];
      serie: Record<TecnologiaCobertura, (number | null)[]>;
      populacao_por_trimestre: Record<string, { moradores: number; domicilios: number; censo: number }>;
    };
  };
  ufs: UfGold[];
  distribuicao: Record<MedidaPosicao, Quantis>;
  destaques: {
    municipios: number;
    sem_fibra: number;
    uma_prestadora: number;
    sem_5g: number;
    g4_abaixo_50: number;
    sem_dado: { fixa: string[]; movel: string[]; cobertura: string[] };
    nao_municipios_descartados: Record<string, string>;
  };
  hash_dados: string;
};
