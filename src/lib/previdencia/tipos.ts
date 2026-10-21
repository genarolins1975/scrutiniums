/**
 * Contrato da gold do painel Previdência e INSS (public/previdencia/gold), gerada por pipeline/previdencia/gold.py.
 * Valores em reais (R$) no BEPS e no arquivo municipal; em R$ milhões correntes no RTN; em R$ mil correntes no AEPS.
 * Ausência é null, nunca zero.
 */

export type FonteBeps = {
  orgao: string;
  nome: string;
  edicao: string | null;
  referencia: string;
  url: string;
  pagina: string;
  sha256: string;
  capturado_em: string;
  tabelas: Record<"14" | "15" | "19", string>;
};

export type FonteMunicipios = {
  orgao: string;
  nome: string;
  pagina: string;
  referencia: string;
  capturado_em: string;
  arquivos: { ano: number; url: string; sha256: string }[];
};

export type FonteRtn = {
  orgao: string;
  nome: string;
  edicao: string;
  publicado_em: string | null;
  url: string;
  pagina: string;
  sha256: string;
  capturado_em: string;
  tabela: string;
  unidade: string;
  metodo_resultado: string;
};

export type TabelaAeps = {
  titulo: string;
  url: string;
  unidade: string;
  fonte: string;
  notas: string;
  atualizado_em: string | null;
  sha256: string | null;
  sha256_tabela: string;
};

export type FonteAeps = {
  orgao: string;
  nome: string;
  edicao: number;
  pagina: string;
  raiz: string | null;
  capturado_em: string;
  atualizado_em: string;
  tabelas: Record<IdTabelaAeps, TabelaAeps>;
  /** Edições anteriores à principal, só com o atendimento e a rede (43.1 e 43.2): um ano por edição. */
  anteriores: { edicao: number; raiz: string | null; capturado_em: string; atualizado_em: string | null; tabelas: Partial<Record<"43.1" | "43.2", TabelaAeps>> }[];
};

export type IdTabelaAeps = "a.1" | "a.14" | "b.1" | "b.2" | "b.3" | "43.1" | "43.2";

/** Grupos de espécie do AEPS (tabelas A.1, B.1, B.2 e B.3), na ordem de pipeline/previdencia/fontes.py. */
export type IdEspecieAeps =
  | "total" | "rgps" | "previdenciarios" | "aposentadorias" | "apo_tempo" | "apo_idade" | "apo_invalidez" | "pensoes"
  | "auxilios" | "aux_doenca" | "aux_reclusao" | "aux_acidente" | "salario_maternidade" | "prev_outros" | "salario_familia"
  | "abono_permanencia" | "vantagem_servidor" | "acidentarios" | "acid_apo_invalidez" | "acid_pensao" | "acid_auxilios"
  | "acid_aux_doenca" | "acid_aux_acidente" | "acid_aux_suplementar" | "assistenciais" | "bpc" | "bpc_deficiencia" | "bpc_idoso"
  | "pmv" | "rmv" | "rmv_invalidez" | "rmv_idade" | "epu";

/**
 * Nove valores por linha, na ordem da fonte: total dos três anos, clientela urbana dos três anos, clientela rural dos
 * três anos. Traço da fonte é null.
 */
export type NoveValores = (number | null)[];

export type EspecieAeps = {
  id: IdEspecieAeps;
  pai: IdEspecieAeps | null;
  rotulo_fonte: string;
  concedidos: NoveValores;
  emitidos: NoveValores;
  /** R$ mil correntes, posição de dezembro. */
  valor_dez: NoveValores;
  /** R$ mil correntes, acumulado no ano. */
  valor_ano: NoveValores;
};

export type UfAeps = { uf: string; nome: string; regiao: string; v: (number | null)[] };

/** Atendimentos nas unidades do INSS num ano (tabela 43.2): os doze meses do Brasil e de cada UF; o total é a soma. */
export type AtendimentoAno = { ano: number; edicao?: number; brasil: number[]; total: number; ufs: (UfAeps & { total: number })[] };

/** Rede de unidades do INSS em dezembro de um ano (tabela 43.1), nas colunas de Aeps["rede"]["colunas"]. */
export type RedeAno = { ano: number; edicao: number; referencia: string; brasil: (number | null)[]; ufs: UfAeps[] };

export type IdRedeAeps =
  | "superintendencias" | "gerencias" | "aps_fixas" | "aps_adj" | "aps_ai" | "aps_tel" | "aps_moveis" | "prevcidade"
  | "auditorias" | "procuradorias_regionais" | "procuradorias_seccionais" | "corregedorias";

export type Aeps = {
  edicao: number;
  anos: number[];
  colunas: string;
  unidade_valor: string;
  especies: EspecieAeps[];
  concessoes_uf: { brasil: NoveValores; ufs: UfAeps[] };
  /** Rede em dezembro do último ano e a série por edição (o último ano se repete na série). */
  rede: { referencia: string; colunas: IdRedeAeps[]; brasil: (number | null)[]; ufs: UfAeps[]; anos: number[]; serie: RedeAno[] };
  /** Atendimento no último ano e a série por edição (o último ano se repete na série). */
  atendimento: AtendimentoAno & { anos: number[]; serie: AtendimentoAno[] };
  /** Tabela de uma edição anterior que ficou fora da série, com o motivo: o ano fica sem ela, nada é estimado. */
  fora_da_serie: { edicao: number; tabela: "43.1" | "43.2"; motivo: string }[];
  conferencia_beps: { ano: number; total_aeps: number; total_beps: number; rgps_aeps: number; rgps_beps: number; pmv_epu_aeps: number; ble_beps: number }[];
};

export type IdTipo =
  | "total" | "rgps" | "previdenciarios" | "aposentadorias" | "apo_idade" | "apo_invalidez" | "apo_tempo" | "pensoes"
  | "auxilios" | "aux_doenca" | "aux_acidente" | "aux_reclusao" | "salario_maternidade" | "prev_outros" | "acidentarios"
  | "acid_apo_invalidez" | "acid_pensao" | "acid_aux_doenca" | "acid_aux_acidente" | "acid_aux_suplementar"
  | "assistenciais" | "loas" | "loas_idoso" | "loas_deficiencia" | "loas_outros" | "rmv" | "rmv_idade" | "rmv_invalidez" | "ble";

export type TipoMes = {
  id: IdTipo;
  pai: IdTipo | null;
  rotulo_fonte: string;
  q: number;
  v: number;
  medio: number | null;
  q_urbana: number | null;
  q_rural: number | null;
};

export type UfMes = {
  q: number;
  v: number;
  medio: number | null;
  q_urbana: number;
  q_rural: number;
  medio_urbana: number | null;
  medio_rural: number | null;
  pct_rural: number | null;
};

export type GrupoSerie = "total" | "rgps" | "assist" | "ble";

/** Campos das listas anuais, na ordem da gold (CAMPOS_Q_GOLD e CAMPOS_V_GOLD). */
export const CAMPOS_Q = ["total", "previdenciarios", "aposentadorias", "apo_idade", "apo_invalidez", "apo_tempo", "pensoes", "auxilios", "outros_prev", "assistenciais"] as const;
export const CAMPOS_V = ["total", "aposentadorias", "pensoes", "auxilios", "outros_prev", "assistenciais"] as const;
export type CampoQ = (typeof CAMPOS_Q)[number];
export type CampoV = (typeof CAMPOS_V)[number];

export type Anual = { q: number[]; v: number[]; municipios: number };

export type GoldPrevidencia = {
  versao: string;
  gerado_por: string;
  capturado_em: string;
  hash_dados: string;
  referencia: string;
  fontes: { beps: FonteBeps; municipios: FonteMunicipios; rtn: FonteRtn; aeps: FonteAeps };
  brasil_mes: { referencia: string; tipos: TipoMes[] };
  ufs_mes: {
    referencia: string;
    brasil: UfMes;
    sem_localizacao: number;
    notas: string[];
    ufs: (UfMes & { uf: string; nome: string; regiao: string })[];
  };
  serie: { meses: string[]; abono: boolean[]; q: Record<GrupoSerie, (number | null)[]>; v: Record<GrupoSerie, (number | null)[]> };
  anual: { anos: number[]; campos_q: string[]; campos_v: string[]; brasil: Record<string, Anual>; ufs: Record<string, Record<string, Anual>> };
  municipios: { anos: number[]; por_uf: Record<string, number>; total: number };
  rgps: {
    anos: number[];
    unidade: string;
    arrecadacao: number[];
    arrecadacao_urbana: (number | null)[];
    arrecadacao_rural: (number | null)[];
    beneficios: number[];
    beneficios_urbano: (number | null)[];
    beneficios_rural: (number | null)[];
    sentencas_urbano: (number | null)[];
    sentencas_rural: (number | null)[];
    bpc_rmv: (number | null)[];
    sentencas_bpc: (number | null)[];
    compensacao: number[];
    despesa_total: number[];
    pib: number[];
    resultado: number[];
    resultado_urbano: (number | null)[];
    resultado_rural: (number | null)[];
    pct_pib: { arrecadacao: number[]; beneficios: number[]; resultado: number[]; bpc_rmv: (number | null)[] };
    pct_despesa_primaria: number[];
    inicio_divisao_urbana_rural: number;
    inicio_bpc: number;
    inicio_sentencas: number;
  };
  aeps: Aeps;
};

export type MunicipioGold = { id: string; nome: string; q: (number[] | null)[]; v: (number[] | null)[] };

export type ArquivoUf = {
  versao: string;
  uf: string;
  nome_uf: string;
  anos: number[];
  campos_q: string[];
  campos_v: string[];
  municipios: MunicipioGold[];
};
