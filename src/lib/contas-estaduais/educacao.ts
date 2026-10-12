import { ANOS, snapshot } from './dados';

export const ETAPAS_EDUCACAO = {
  fundamental_anos_iniciais_regular: 'Ensino fundamental · anos iniciais · regular',
  fundamental_anos_finais_regular: 'Ensino fundamental · anos finais · regular',
  ensino_medio_regular: 'Ensino médio · regular',
} as const;
export type EtapaEducacao = keyof typeof ETAPAS_EDUCACAO;
export const ETAPA_PADRAO: EtapaEducacao = 'ensino_medio_regular';
export const etapaValida = (etapa: string | null): etapa is EtapaEducacao =>
  etapa !== null && Object.prototype.hasOwnProperty.call(ETAPAS_EDUCACAO, etapa);
export const lerEtapa = (etapa: string | null): EtapaEducacao =>
  etapaValida(etapa) ? etapa : ETAPA_PADRAO;

export const STATUS_EDUCACAO = {
  nao_conciliado: 'Perímetro ainda não conciliado',
  fonte_nao_incorporada: 'Fonte ainda não incorporada',
  nao_levantado: 'Ainda não levantado',
} as const;

const PORTAIS = {
  ideb: 'https://www.gov.br/inep/pt-br/areas-de-atuacao/pesquisas-estatisticas-e-indicadores/ideb/resultados',
  matriculas: 'https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/sinopses-estatisticas/educacao-basica',
};
export const TENTATIVA_EDUCACAO = {
  ano: 2025,
  data: '2026-10-12T14:15:13.982812+00:00',
  manifesto: 'https://github.com/genarolins1975/scrutiniums/blob/c64a31c50174550ab00c580f307816c7e0234fc7/docs/contas-publicas-estaduais/evidencias/educacao-captura-20261012.json',
} as const;

type EvidenciaEducacao = {
  id: string;
  nome: string;
  status: keyof typeof STATUS_EDUCACAO;
  requisito: string;
  fonte: string;
  url: string | null;
  valor: null;
};

// Registro de disponibilidade. Não representa observações nem avalia desempenho.
export function disponibilidadeEducacao(uf: string, ano: number, etapa: string) {
  if (!snapshot.ufs.some(u => u.uf === uf) || !ANOS.includes(ano) || !etapaValida(etapa)) return null;
  const emLevantamento = ano === TENTATIVA_EDUCACAO.ano;
  const evidencias: EvidenciaEducacao[] = [
    {
      id: 'despesa', nome: 'Despesa da rede e da etapa',
      status: emLevantamento ? 'nao_conciliado' : 'nao_levantado',
      requisito: 'Despesa liquidada anual; conciliar contas, rateios e exclusões com a rede estadual e a etapa selecionada.',
      fonte: 'Demonstrativo estadual e documento de conciliação', url: null, valor: null,
    },
    {
      id: 'matriculas', nome: 'Matrículas',
      status: emLevantamento ? 'fonte_nao_incorporada' : 'nao_levantado',
      requisito: 'Censo Escolar: mesma UF inteira, ano, rede e etapa. Matrícula não equivale a estudante único.',
      fonte: 'Inep · Sinopse Estatística da Educação Básica', url: PORTAIS.matriculas, valor: null,
    },
    {
      id: 'aprendizagem', nome: 'Aprendizagem',
      status: emLevantamento ? 'fonte_nao_incorporada' : 'nao_levantado',
      requisito: 'Ideb da rede estadual e etapa; registrar universo avaliado, participação e critérios de divulgação ou supressão.',
      fonte: 'Inep · resultados do Ideb', url: PORTAIS.ideb, valor: null,
    },
    {
      id: 'metas', nome: 'Metas e entregas físicas',
      status: 'nao_levantado',
      requisito: 'Meta formal, unidade, público, prazo e entrega observada compatíveis; identificar revisões da meta.',
      fonte: 'PPA, programa e relatório oficial de acompanhamento do estado', url: null, valor: null,
    },
  ];
  return {
    versao: '1.0.0',
    tipo_registro: 'disponibilidade_sem_observacoes',
    uf, ano, rede: 'estadual', etapa, etapa_nome: ETAPAS_EDUCACAO[etapa],
    abrangencia: 'uf_inteira',
    evidencias,
    observacoes: [] as never[],
    despesa_por_matricula: null,
    ideb: null,
    cumprimento_meta: null,
    pareamento_elegivel: false,
    tentativa_fontes: emLevantamento ? TENTATIVA_EDUCACAO : null,
    nota: 'Ausência neste observatório não significa ausência de publicação na fonte nem desempenho zero. Não há avaliação de eficiência ou eficácia neste registro.',
  };
}

export function csvDisponibilidadeEducacao(uf: string, ano: number, etapa: string) {
  const d = disponibilidadeEducacao(uf, ano, etapa);
  if (!d) return null;
  const cell = (v: unknown) => '"' + String(v ?? '').replaceAll('"', '""') + '"';
  const rows: unknown[][] = [
    ['tipo_registro', 'UF', 'ano', 'rede', 'etapa', 'evidencia', 'status', 'requisito', 'fonte', 'url_fonte', 'registro_tentativa', 'nota'],
    ...d.evidencias.map(e => [d.tipo_registro, uf, ano, d.rede, etapa, e.nome, STATUS_EDUCACAO[e.status], e.requisito, e.fonte, e.url, (e.id === 'matriculas' || e.id === 'aprendizagem') ? d.tentativa_fontes?.manifesto : null, d.nota]),
  ];
  return '\uFEFF' + rows.map(r => r.map(cell).join(';')).join('\r\n');
}
