/** Contrato de leitura da BMC. Derivações das fontes e distribuições vêm do pipeline. */
export type AlinhamentoBMC = 'A' | 'B' | 'C';
export type PrecisaoBMC = 'NAO_QUANTIFICADA' | 'QUANTIFICADA' | 'UNIVERSO' | 'NAO_APLICAVEL';
export type MedidaBMC = {
  id: string; titulo: string; unidade: string; unidade_diferenca: string;
  alinhamento: AlinhamentoBMC; precisao: PrecisaoBMC; desvios: string[];
  base_2022: boolean; nivel: string; base_geografica: string; ano_referencia: number;
  periodo: string; universo: string; fonte: string; tabela: number | null;
  variavel: string | null; amostra_censo: boolean; ressalva_precisao: string;
  limites: string; casas_publicadas: number;
};
export type MunicipioBMC = {id: string; nome: string; uf: string; grande_regiao: string; populacao: number; capital: boolean};
export type ObservacaoBMC = {
  municipio: string; nome: string; medida: string; valor: number | null;
  unidade: string; periodo: string; ano_referencia: number; estado: string;
  alinhamento: AlinhamentoBMC; marca_alinhamento: string; desvios: string[];
  precisao: PrecisaoBMC; ressalva_precisao: string; motivo_ausencia: string;
  numerador: number | null; denominador: number | null; erro_padrao: number | null;
  intervalo_95: [number, number] | null; fonte: string; arquivo_fonte: string;
  capturado_em: string; sha256: string;
};
export type DistribuicaoBMC = {
  municipios: string[]; n_universo: number; n_observados: number; n_ausentes: number;
  cobertura_completa: boolean; minimo: number | null; q1: number | null;
  mediana: number | null; q3: number | null; maximo: number | null;
};
export type BaseComparavel = {
  versao: string; natureza: string; ano_referencia: number; estado: string;
  contrato_sha256: string; medidas: MedidaBMC[]; municipios: MunicipioBMC[];
  capitais: ObservacaoBMC[]; observacoes: ObservacaoBMC[]; capacidade_servicos: ObservacaoBMC[];
  homicidios_registrados_capitais: ObservacaoBMC[];
  violencia_sim_universo: {estado: string; motivo: string};
  distribuicoes: Record<string, Record<string, DistribuicaoBMC>>;
  grupos_de_pares: string[]; pacote_v3: {arquivos: number; pacote_sha256: string};
};
export type SelecaoBMC = {cidade: string; comparador: string; medida: string; grupo: string; ordem: 'nome' | 'valor'};
export const RESSALVA_AMOSTRA_BMC = 'Estimativa preliminar da amostra do Censo 2022. Precisão municipal não quantificada; diferenças observadas não demonstram diferenças estatisticamente significativas.';
export const TITULO_PRECISAO: Record<PrecisaoBMC, string> = {
  NAO_QUANTIFICADA: 'Precisão não quantificada', QUANTIFICADA: 'Precisão quantificada, Poisson condicional',
  UNIVERSO: 'Universo, sem erro amostral', NAO_APLICAVEL: 'Precisão amostral não se aplica',
};
export const PORTE_BMC: Record<string, string> = {
  '100_a_250_mil': '100 a menos de 250 mil habitantes',
  '250_a_500_mil': '250 a menos de 500 mil habitantes',
  '500_mil_a_1_milhao': '500 mil a 1 milhão de habitantes',
  'acima_de_1_milhao': 'Acima de 1 milhão de habitantes',
};

export function validarBaseComparavel(data: BaseComparavel) {
  if (data.ano_referencia !== 2022 || data.capitais.length !== 208 || data.medidas.filter(m => m.base_2022).length !== 8)
    throw new Error('BMC: cobertura das capitais ou referência divergente');
  if (data.municipios.some(c => c.id === '5300108') || new Set(data.municipios.map(c => c.id)).size !== data.municipios.length)
    throw new Error('BMC: identidade municipal divergente');
  if (data.estado === 'UNIVERSO_ADQUIRIDO_E_RECONCILIADO' && data.municipios.length !== 318)
    throw new Error('BMC: o universo precisa conter 318 municípios');
  if (data.grupos_de_pares.length !== 2 || data.grupos_de_pares.some(v => !['populacao_censo_2022', 'grande_regiao'].includes(v)))
    throw new Error('BMC: variável de resultado não pode formar pares');
  const keys = data.observacoes.map(o => `${o.municipio}/${o.medida}`);
  if (new Set(keys).size !== keys.length || keys.length !== data.municipios.length * 8)
    throw new Error('BMC: observações duplicadas ou incompletas');
  for (const observation of data.observacoes) {
    if ((observation.valor === null) !== (observation.estado !== 'OBSERVADO') || !observation.ressalva_precisao)
      throw new Error('BMC: estado ou ressalva ausente');
    if (observation.valor !== null && !Number.isFinite(observation.valor)) throw new Error('BMC: valor inválido');
    if (observation.precisao !== 'QUANTIFICADA' && (observation.erro_padrao !== null || observation.intervalo_95 !== null))
      throw new Error('BMC: precisão não quantificada não recebe intervalo');
    const measure = data.medidas.find(m => m.id === observation.medida && m.base_2022);
    if (!measure || observation.alinhamento !== measure.alinhamento || observation.precisao !== measure.precisao || observation.ano_referencia !== 2022 || observation.periodo !== measure.periodo)
      throw new Error('BMC: observação diverge da ficha');
    if (measure.amostra_censo && observation.ressalva_precisao !== RESSALVA_AMOSTRA_BMC)
      throw new Error('BMC: ressalva amostral divergente');
  }
  return data;
}

export function grupoDePorte(population: number) {
  if (population < 100000 || !Number.isInteger(population)) throw new Error('População fora do universo BMC');
  return population < 250000 ? '100_a_250_mil' : population < 500000 ? '250_a_500_mil' : population <= 1000000 ? '500_mil_a_1_milhao' : 'acima_de_1_milhao';
}

export function selecaoBMC(query: URLSearchParams, data: BaseComparavel): SelecaoBMC {
  const ids = data.municipios.map(c => c.id);
  const cidade = ids.includes(query.get('territorio') ?? '') ? query.get('territorio')! : ids.includes('2611606') ? '2611606' : ids[0];
  const comparador = ids.includes(query.get('comparador') ?? '') && query.get('comparador') !== cidade ? query.get('comparador')! : ids.find(id => id === '4106902' && id !== cidade) ?? ids.find(id => id !== cidade)!;
  const measures = data.medidas.filter(m => m.base_2022).map(m => m.id);
  const medida = measures.includes(query.get('bmc_medida') ?? '') ? query.get('bmc_medida')! : measures[0];
  const grupo = ['universo', 'a_porte', 'a_regiao', 'b_porte', 'b_regiao'].includes(query.get('bmc_pares') ?? '') ? query.get('bmc_pares')! : 'universo';
  return {cidade, comparador, medida, grupo, ordem: query.get('bmc_ordem') === 'valor' ? 'valor' : 'nome'};
}

export function urlBMC(url: URL, selection: SelecaoBMC) {
  const next = new URL(url);
  next.searchParams.set('visao', 'cidades');
  next.searchParams.set('territorio', selection.cidade);
  next.searchParams.set('comparador', selection.comparador);
  next.searchParams.set('bmc_medida', selection.medida);
  next.searchParams.set('bmc_pares', selection.grupo);
  next.searchParams.set('bmc_ordem', selection.ordem);
  return next;
}

export function diferencaBMC(a: ObservacaoBMC | undefined, b: ObservacaoBMC | undefined, measure: MedidaBMC, markedB = true) {
  if (measure.alinhamento === 'C' || measure.ano_referencia !== 2022 || measure.base_geografica !== 'residencia')
    throw new Error('Medida C ou outro recorte não pode ser justaposto à BMC 2022');
  if (measure.alinhamento === 'B' && (!markedB || measure.desvios.length !== 1))
    throw new Error('Medida B exige marca e motivo do desvio');
  for (const o of [a, b]) if (o) {
    if (o.medida !== measure.id || o.alinhamento !== measure.alinhamento || o.precisao !== measure.precisao)
      throw new Error('Observação fora do contrato da medida');
    if (o.ano_referencia !== 2022 || o.periodo !== measure.periodo || o.municipio === '5300108')
      throw new Error('Período ou território divergente do contrato');
    if (measure.alinhamento === 'B' && (o.marca_alinhamento !== 'B' || o.desvios.length !== 1))
      throw new Error('Observação B sem marca ou motivo');
  }
  return a?.valor != null && b?.valor != null && a.estado === 'OBSERVADO' && b.estado === 'OBSERVADO' ? a.valor - b.valor : null;
}

export function grupoBMC(data: BaseComparavel, selection: SelecaoBMC) {
  if (selection.grupo === 'universo') return 'universo';
  const city = data.municipios.find(c => c.id === (selection.grupo.startsWith('a_') ? selection.cidade : selection.comparador))!;
  return selection.grupo.endsWith('porte') ? `porte:${grupoDePorte(city.populacao)}` : `regiao:${city.grande_regiao}`;
}

export function formataBMC(value: number | null, measure: Pick<MedidaBMC, 'unidade' | 'casas_publicadas'>) {
  if (value === null) return 'Não disponível';
  const number = value.toLocaleString('pt-BR', {minimumFractionDigits: measure.casas_publicadas, maximumFractionDigits: measure.casas_publicadas});
  return measure.unidade === 'R$' ? `R$ ${number}` : `${number} ${measure.unidade}`;
}
