/**
 * Capítulo "Sustentabilidade e riscos": duas medidas com fontes e perímetros diferentes, nunca somadas.
 *
 * 1. Rigidez do orçamento (SIOP, snapshot funcoes.json, uso no servidor): parcela da despesa primária marcada como
 *    obrigatória (identificador de resultado primário 1) no orçamento da União. Duas vistas:
 *    - na lei original (dotação inicial), de 2000 ao ano corrente: o orçamento aprovado já é completo no início do ano;
 *    - no liquidado, dos exercícios encerrados a partir de 2015 (até 2014 a fonte registra o liquidado igual ao
 *      empenhado; ver planejamento.ts).
 *    A reserva de contingência (funções 99 e 98) sai do numerador e do denominador: é dotação guardada, sem execução
 *    própria, e a fonte a marca ora como obrigatória, ora como discricionária.
 *    As emendas parlamentares (identificadores 6 a 9) são classificadas pela fonte como discricionárias, embora as
 *    individuais e as de bancada sejam de execução obrigatória pela Constituição (EC 86/2015 e EC 100/2019); a página
 *    mostra a parcela delas à parte, sem reclassificar.
 * 2. Dívida bruta do governo geral (Banco Central, SGS 13761 e 13762; snapshot divida.json, pequeno): saldo no fim
 *    do mês, em R$ e em % do PIB dos últimos 12 meses. Perímetro do governo geral (União, INSS, estados e municípios),
 *    diferente do orçamento da União.
 */
import {ANOS, REGISTROS, encerrado, exercicio, type Registro} from './areas';
import {razao, type Medida} from './metricas';
import {dataFonte} from './dados';
import {PRIMEIRO_ANO_PLANO} from './planejamento';
import divida from './snapshots/divida.json';

const RESERVA = ['99', '98'];
const EMENDAS = ['6', '7', '8', '9'];
export type EstagioRigidez = 'inicial' | 'liquidado';
/** emendas: null antes do primeiro exercício com marca própria de emenda (identificador 6, de 2014): sem marca, não zero. */
export type PartesRigidez = {obrigatoria: number; primaria: number; emendas: number | null} | null;
export type AnoRigidez = {ano: number; encerrado: boolean; atualizacao: string; inicial: PartesRigidez; liquidado: PartesRigidez};

/** Primeiro exercício em que a fonte marca emendas parlamentares com identificador próprio. */
export const PRIMEIRO_ANO_EMENDAS = Math.min(...REGISTROS.filter((r) => EMENDAS.includes(r.rp)).map((r) => r.ano));

function partes(rs: Registro[], estagio: EstagioRigidez, ano: number): PartesRigidez {
  let obrigatoria = 0, primaria = 0, emendas = 0;
  for (const r of rs) {
    const v = r.v[estagio];
    if (v === null) return null;
    primaria += v;
    if (r.rp === '1') obrigatoria += v;
    if (EMENDAS.includes(r.rp)) emendas += v;
  }
  return primaria > 0 ? {obrigatoria, primaria, emendas: ano >= PRIMEIRO_ANO_EMENDAS ? emendas : null} : null;
}

export function serieRigidez(): AnoRigidez[] {
  return ANOS.map((ano) => {
    const rs = REGISTROS.filter((r) => r.ano === ano && r.rp !== '0' && !RESERVA.includes(r.funcao));
    const fechado = encerrado(ano);
    return {
      ano,
      encerrado: fechado,
      atualizacao: dataFonte(exercicio(ano)?.atualizacao ?? ''),
      inicial: partes(rs, 'inicial', ano),
      liquidado: fechado && ano >= PRIMEIRO_ANO_PLANO ? partes(rs, 'liquidado', ano) : null,
    };
  });
}

export const rigidez = (p: PartesRigidez): Medida => razao(p?.obrigatoria ?? null, p?.primaria ?? null);
export const parcelaEmendas = (p: PartesRigidez): Medida => razao(p?.emendas ?? null, p?.primaria ?? null);

// ------------------------------------------------------------------ dívida bruta

export type PontoDivida = {periodo: string; milhoes: number; pctPIB: number};
export const DIVIDA = divida as {
  fonte: {nome: string; pagina: string; series: Record<string, string>};
  captura: string;
  perimetro: string;
  metodologia: string;
  unidade: {reais: string; pib: string};
  registros: PontoDivida[];
};
export const ultimoMesDivida = (): PontoDivida => DIVIDA.registros[DIVIDA.registros.length - 1];
/** Saldo de dezembro de cada ano completo, mais o mês mais recente (se não for dezembro). */
export function serieAnualDivida(): (PontoDivida & {fimDeAno: boolean})[] {
  const dez = DIVIDA.registros.filter((r) => r.periodo.endsWith('-12')).map((r) => ({...r, fimDeAno: true}));
  const u = ultimoMesDivida();
  return u.periodo.endsWith('-12') ? dez : [...dez, {...u, fimDeAno: false}];
}
/** Mesmo mês do ano anterior, para a comparação do mês mais recente. */
export function mesmoMesAnterior(p: PontoDivida): PontoDivida | null {
  const [a, m] = p.periodo.split('-');
  return DIVIDA.registros.find((r) => r.periodo === `${Number(a) - 1}-${m}`) ?? null;
}
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const nomeMes = (periodo: string) => `${MESES[Number(periodo.slice(5)) - 1]} de ${periodo.slice(0, 4)}`;

export const FONTE_RIGIDEZ = {
  fonte: 'SIOP · dados abertos · identificador de resultado primário',
  url: 'https://www1.siop.planejamento.gov.br/siopdoc/doku.php/acesso_publico:dados_abertos',
  perimetro: 'Orçamentos Fiscal e da Seguridade Social da União · despesa primária sem a reserva de contingência',
};
