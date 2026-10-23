/**
 * Dados da entrada do OBEE, SOMENTE para servidor e testes. Junta, sem recalcular
 * nada de método: as sete condições da edição v4 (valores originais e posições),
 * a despesa municipal por habitante em Educação e Saúde, a capacidade potencial da
 * atenção primária, a população do Censo 2022 e o contorno oficial de cada capital.
 * A página recebe o resultado por prop; nada disso entra nos arquivos públicos.
 */
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import contornos from './contornos-capitais.json';
import panorama from './panorama-atlas.json';
import {indiceSnapshot} from './indice-v4';
import {elegiveis, mediana, numero, type CapitalRetrato, type Medida, type RetratoDados, type ValorMedida} from './entrada-nucleo';
import type {NumeroPorta} from '@/lib/perguntas/tipos';

const UF: Record<string, [string, string]> = {
  '11': ['RO', 'Norte'], '12': ['AC', 'Norte'], '13': ['AM', 'Norte'], '14': ['RR', 'Norte'], '15': ['PA', 'Norte'], '16': ['AP', 'Norte'], '17': ['TO', 'Norte'],
  '21': ['MA', 'Nordeste'], '22': ['PI', 'Nordeste'], '23': ['CE', 'Nordeste'], '24': ['RN', 'Nordeste'], '25': ['PB', 'Nordeste'], '26': ['PE', 'Nordeste'], '27': ['AL', 'Nordeste'], '28': ['SE', 'Nordeste'], '29': ['BA', 'Nordeste'],
  '31': ['MG', 'Sudeste'], '32': ['ES', 'Sudeste'], '33': ['RJ', 'Sudeste'], '35': ['SP', 'Sudeste'],
  '41': ['PR', 'Sul'], '42': ['SC', 'Sul'], '43': ['RS', 'Sul'],
  '50': ['MS', 'Centro-Oeste'], '51': ['MT', 'Centro-Oeste'], '52': ['GO', 'Centro-Oeste'],
};

/** Perguntas da sociedade para cada condição. Descritivas: nenhuma embute julgamento sobre gestão.
 *  Rótulos curtos fiéis ao valor: quando menor é mais favorável, nomeiam a condição contada. */
const PERGUNTAS: Record<string, [string, string]> = {
  educacao: ['As crianças de 4 e 5 anos estão na escola?', 'Escola, 4 e 5 anos'],
  trabalho: ['Qual é a renda típica de cada morador?', 'Renda por pessoa'],
  mobilidade: ['Quantos levam mais de uma hora para chegar ao trabalho?', 'Mais de 1 h até o trabalho'],
  saneamento: ['As casas têm esgotamento por rede ou fossa séptica?', 'Rede ou fossa séptica'],
  seguranca: ['Quantas pessoas são vítimas de homicídio?', 'Homicídios por 100 mil'],
  habitacao: ['Quantos moram com mais de 3 pessoas por dormitório?', 'Moradia adensada'],
  conectividade: ['As casas têm acesso à internet?', 'Internet em casa'],
};

type Observacao = {indicador: string; ente: number; ano: number; componente: string | null; valor: number | null; status: string;
  elegivel_comparacao: boolean; conferencia?: {rotulo?: string; motivo_inelegibilidade?: string | null} | null};
const gold = (arquivo: string) => JSON.parse(readFileSync(join(process.cwd(), 'public/eficiencia/gold', arquivo), 'utf8')) as {observacoes: Observacao[]};

function serie(obs: Observacao[], indicador: string, ano: number, componente: string | null): Record<string, ValorMedida> {
  const out: Record<string, ValorMedida> = {};
  for (const o of obs) {
    if (o.indicador !== indicador || o.ano !== ano || o.componente !== componente) continue;
    out[String(o.ente)] = o.status === 'OBSERVADO' && o.valor !== null
      ? {valor: o.valor, ...(o.elegivel_comparacao ? {} : {foraDaComparacao: o.conferencia?.motivo_inelegibilidade || o.conferencia?.rotulo || 'Fora da comparação na política de conferência'})}
      : {valor: null};
  }
  return out;
}

export function montarRetrato(): RetratoDados {
  const edu = gold('educacao_capitais.json').observacoes, sau = gold('saude_capitais.json').observacoes;
  const populacao = serie(edu, 'ctx.populacao.residente', 2022, null);
  const contorno = new Map(contornos.capitais.map(c => [c.id, c]));
  const capitais: CapitalRetrato[] = indiceSnapshot.rows.map(r => {
    const c = contorno.get(r.id);
    const [uf, regiao] = UF[r.id.slice(0, 2)];
    return {id: r.id, nome: r.name, uf, regiao, populacao: populacao[r.id]?.valor ?? null, areaKm2: c?.area_km2 ?? null,
      contorno: c ? {d: c.d, largura: c.largura, altura: c.altura, kmPorUnidade: c.km_por_unidade,
        partesDistantes: c.partes_distantes_omitidas, partesPequenas: c.partes_pequenas_omitidas} : null};
  }).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  const painelPanorama = (id: string) => panorama.metrics.find(m => m.id === id)!;
  const painel: Record<string, Medida['painel']> = {
    educacao: {href: '#atlas-comparacao', rotulo: 'Frequência por idade e aprendizagem'},
    trabalho: {href: `${painelPanorama('trabalho').detailPath}?ter={a}&med=renda-mediana&per=2022&sexo=total&grp=Total`, rotulo: 'Abrir Trabalho e renda'},
    mobilidade: {href: `${painelPanorama('mobilidade').detailPath}?territorio={a}&nivel=municipio&medida=censo.tempo.longo`, rotulo: 'Abrir Mobilidade'},
  };
  const condicoes: Medida[] = indiceSnapshot.indicators.map(i => ({
    id: i.id, pergunta: PERGUNTAS[i.id][0], curto: PERGUNTAS[i.id][1], titulo: i.label, unidade: i.unit, periodo: i.period,
    direcao: i.direction === 'higher' ? 'maior' : 'menor', natureza: 'Condição dos moradores', nota: i.note, precisao: i.precision,
    fonte: i.source, fonteUrl: i.source_url, painel: painel[i.id] ?? null,
    valores: Object.fromEntries(indiceSnapshot.rows.map(r => [r.id, {valor: r.raw_values[i.id] ?? null}])),
    posicoes: Object.fromEntries(indiceSnapshot.rows.map(r => [r.id, r.percentiles[i.id]])),
  }));

  const aps = painelPanorama('saude');
  const recursos: Medida[] = [
    {id: 'educacao_despesa', pergunta: 'Quanto a prefeitura aplica em Educação por morador?', curto: 'Educação por habitante',
      titulo: 'Despesa liquidada na função Educação por habitante', unidade: 'R$', periodo: 'Exercício de 2025', direcao: 'nenhuma',
      natureza: 'Recurso municipal', nota: 'Orçamento do município na função 12, todas as redes que ele financia, dividido pela população residente. Reais nominais de 2025.',
      precisao: 'Declaração contábil conferida com o RREO; população estimada pelo IBGE.', fonte: 'Tesouro Nacional (Siconfi, DCA) e IBGE',
      fonteUrl: 'https://siconfi.tesouro.gov.br/', painel: {href: '/eficiencia-estatal/educacao-municipal-capitais/gastos', rotulo: 'Abrir gastos em Educação'},
      valores: serie(edu, 'edu.despesa.por_habitante', 2025, 'nominal')},
    {id: 'saude_despesa', pergunta: 'Quanto a prefeitura aplica em Saúde por morador?', curto: 'Saúde por habitante',
      titulo: 'Despesa liquidada na função Saúde por habitante', unidade: 'R$', periodo: 'Exercício de 2025', direcao: 'nenhuma',
      natureza: 'Recurso municipal', nota: 'Orçamento do município na função 10, dividido pela população residente. Não inclui o gasto da União e do estado no território. Reais nominais de 2025.',
      precisao: 'Declaração contábil conferida com o RREO; população estimada pelo IBGE.', fonte: 'Tesouro Nacional (Siconfi, DCA) e IBGE',
      fonteUrl: 'https://siconfi.tesouro.gov.br/', painel: {href: '/eficiencia-estatal/saude-capitais/gastos', rotulo: 'Abrir gastos em Saúde'},
      valores: serie(sau, 'sau.despesa.por_habitante', 2025, 'nominal')},
    {id: 'aps', pergunta: 'Quanta capacidade de atenção primária está registrada?', curto: 'Atenção primária',
      titulo: aps.title, unidade: '%', periodo: aps.period, direcao: 'nenhuma', natureza: aps.kind, nota: aps.warning,
      precisao: aps.universe, fonte: aps.source, fonteUrl: aps.sourceUrl,
      painel: {href: `${aps.detailPath}?cap={a}&vs={b}&med=cobertura_aps&ano=2025`, rotulo: 'Comparar na Saúde nas capitais', chaves: aps.territoryKeys as Record<string, string>},
      valores: Object.fromEntries(aps.observations.map(o => [o.territory, o.eligible && o.value !== null ? {valor: o.value} : {valor: null}]))},
  ];

  return {capitais, condicoes, recursos,
    fonteContornos: {fonte: contornos.fonte, url: contornos.fonte_url, capturadoEm: contornos.capturado_em, tratamento: contornos.tratamento},
    fontePopulacao: 'IBGE, Censo 2022 (SIDRA 4714), população residente em 31 de julho de 2022'};
}

/**
 * Os quatro números da escala da entrada (molde único, Iniciativa 4 do parecer de UX, 22/10/2026): as quatro primeiras condições
 * do retrato, cada uma pela mediana simples das 26 capitais, da mesma edição do índice de resultados que a régua usa. Mediana,
 * nunca nota composta (decisão do dono de 19/10/2026).
 */
export function escalaEntrada(retrato: RetratoDados): NumeroPorta[] {
  return retrato.condicoes.slice(0, 4).map((m) => {
    const med = mediana(elegiveis(m).map((x) => x.valor));
    return {
      rotulo: m.curto,
      valor: med === null ? null : numero(med, m.unidade),
      unidade: "mediana das 26 capitais",
      periodo: m.periodo,
      fonte: m.fonte,
      href: "#perguntas",
    };
  });
}
