/**
 * Tipos do módulo Saúde nas capitais (OBEE). Espelham public/eficiencia/gold/saude_capitais.json, escrita por pipeline/eficiencia_saude/gold.py,
 * e o payload compacto que a página entrega ao navegador (dados.ts). Estados de dado, ficha e referência de grupo são os mesmos de Educação.
 */
import type { FichaExibivel, StatusDado, ReferenciaGrupo, Validacao, Fonte, LinhaCobertura, Capital, Trilha } from "../tipos";

export type { StatusDado, ReferenciaGrupo, Validacao, Fonte, LinhaCobertura, Capital, Trilha, FichaExibivel };

export type ObservacaoSaude = {
  indicador: string;
  ente: number;
  ano: number;
  etapa: null;
  componente: string | null;
  valor: number | null;
  status: StatusDado;
  nota: string | null;
  nota_material: boolean;
  elegivel_comparacao: boolean;
  fonte: string;
  registro: string;
  participacao?: number | null;
  quebra_serie?: boolean;
  fator_ipca?: number;
  minimo_pct?: number | null;
  total_siops?: number;
  conferencia?: {
    situacao: string;
    rotulo: string;
    elegivel_comparacao: boolean;
    quebra_serie: boolean;
    motivo_inelegibilidade: string | null;
    explicacao: string;
    rreo?: { exceto_intra: number; intra: number | null } | null;
    msc?: { liquidado_total: number; intra_mod91: number; sem_intra: number } | null;
    diferenca?: number | null;
    diferenca_pct_dca?: number | null;
    evidencias?: string[];
    fontes_sha256?: { dca: string | null; rreo: string | null; msc: string | null };
  };
  calculo?: { numerador: number; denominador: number; numerador_ref: string; denominador_ref: string; numerador_componente?: string };
  populacao_referencia_ms?: number;
  ano_base_populacao_ms?: string;
  origem_populacao_ms?: string | null;
  tipo_populacao?: string | null;
  base_populacional?: string | null;
  data_referencia?: string | null;
};

export type ReferenciaExternaSaude = {
  id: string;
  indicador: string;
  componente: string | null;
  ano: number | null;
  tipo: "nacional_oficial" | "nacional_calculado" | "normativa";
  rotulo: string;
  valor: number;
  unidade: string;
  escopo: string;
  fonte: string;
  registro: string;
  origem: string;
  comparabilidade: "direta" | "contexto" | "incompativel";
  classe: string;
};

export type LinhaMatrizFonte = { id: string; medida: string; fonte: string; acesso_testado: string; cobertura: string; periodo: string; decisao: string; fundamento: string };

export type GoldSaude = {
  meta: {
    dominio: string;
    painel: string;
    versao_pipeline: string;
    versao_catalogo: string;
    versao_codigo: string | null;
    gerado_em: string;
    dados_capturados_ate: string;
    hash_dados: string;
    observacoes: number;
    proveniencia?: { codigo_gerador: { sha256: string; arquivos: number; escopo: string }; entradas: { manifesto_do_seed_sha256: string; capturas_no_manifesto: number; nota: string }; saidas: { hash_dados: string; observacoes: number }; git: { commit_de_partida: string | null; codigo_com_mudanca_nao_commitada: boolean | null }; nota: string };
  };
  politica_conferencia: { versao: string; tolerancia_arredondamento_reais: number; tolerancia_relativa: number; elegiveis: string[]; rotulos: Record<string, string> };
  painel: { id: string; titulo: string; frase: string; rede: string };
  universo: { capitais: Capital[]; excluidos: { cod_ibge: number; nome: string; uf: string; tipo_ente: string; motivo: string }[]; regioes: Record<string, string> };
  periodos: { financeiros: number[]; resultados: number[]; dezembros: number[]; retrato: string };
  subfuncoes: Record<string, string>;
  categorias_natureza: Record<string, string>;
  fontes_recurso: Record<string, string>;
  grupos_icsap: Record<string, string>;
  tipos_equipe: Record<string, string>;
  componentes_ubs: Record<string, string>;
  ipca: { fatores_para_2025: Record<string, number>; media_anual_numero_indice: Record<string, number> };
  indicadores: (FichaExibivel & { motivo_nao_publicacao?: string[] })[];
  cobertura: Record<string, LinhaCobertura[]>;
  validacoes: Validacao[];
  trilhas: Trilha[];
  fontes: Fonte[];
  status: Record<StatusDado, string>;
  politica_referencias: Record<string, string | number>;
  referencias: ReferenciaGrupo[];
  referencias_externas: ReferenciaExternaSaude[];
  matriz_fontes: LinhaMatrizFonte[];
  observacoes: ObservacaoSaude[];
};
