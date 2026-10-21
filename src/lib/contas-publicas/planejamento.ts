/**
 * Capítulo "Qualidade do planejamento": o que a lei orçamentária aprovou (dotação inicial), o que o Congresso e o
 * Executivo autorizaram ao longo do ano (dotação atualizada) e o que foi liquidado, pelo SIOP por função e
 * identificador de resultado primário (snapshot funcoes.json, o mesmo do painel Despesa por área).
 *
 * Uso no servidor: a base de 2000 em diante não vai para o navegador; a página entrega só os totais por ano.
 *
 * Regras:
 * - A série começa no primeiro exercício em que o SIOP registra o liquidado separado do empenhado (2015). Até 2014
 *   o liquidado da fonte é igual ao empenhado (despesa inscrita em restos a pagar não processados contava como
 *   liquidada), então a comparação com a dotação inicial mudaria de conceito no meio da série.
 * - "Primária" exclui as linhas com identificador de resultado primário 0 (juros, amortização e refinanciamento da
 *   dívida, concessão de empréstimos). "Total" inclui tudo: a dotação do refinanciamento costuma ficar muito acima
 *   do executado e domina o desvio.
 * - A reserva de contingência (funções 99 e 98) faz parte da lei original, mas não é executada diretamente: o que
 *   é usado vira crédito em outra área. O desvio a inclui (é o plano aprovado) e a página informa o seu tamanho.
 * - O ano em curso não tem desvio calculado: o liquidado ainda é parcial. Mostra só o que já foi autorizado.
 * - Estágio incompleto na fonte (null) continua null: "não informado", nunca zero.
 */
import {ANOS, ANOS_LIQUIDADO_IGUAL, FUNCOES, REGISTROS, encerrado, exercicio, type Registro} from './areas';
import {desvioPercentual, type Medida} from './metricas';
import {dataFonte} from './dados';

import {ESTAGIOS_PLANO, type AnoPlano, type BasePlano, type ValoresPlano} from './planejamento-modelo';
export * from './planejamento-modelo';
const RESERVA = ['99', '98'];

/** Primeiro exercício com liquidado distinto do empenhado na fonte. */
export const PRIMEIRO_ANO_PLANO = ANOS_LIQUIDADO_IGUAL.length ? Math.max(...ANOS_LIQUIDADO_IGUAL) + 1 : Math.min(...ANOS);

function somar(registros: Registro[]): ValoresPlano {
  const s: ValoresPlano = {inicial: 0, atualizada: 0, liquidado: 0};
  for (const e of ESTAGIOS_PLANO) {
    for (const r of registros) {
      const v = r.v[e];
      if (v === null) { s[e] = null; break; }
      s[e] = (s[e] as number) + v;
    }
  }
  return s;
}

export function anoPlano(ano: number): AnoPlano | null {
  const ex = exercicio(ano);
  if (!ex) return null;
  const doAno = REGISTROS.filter((r) => r.ano === ano);
  const primarias = doAno.filter((r) => r.rp !== '0');
  const fechado = encerrado(ano);
  const porFuncao = new Map<string, Registro[]>();
  for (const r of primarias) {
    if (RESERVA.includes(r.funcao)) continue;
    const l = porFuncao.get(r.funcao);
    if (l) l.push(r);
    else porFuncao.set(r.funcao, [r]);
  }
  return {
    ano,
    encerrado: fechado,
    atualizacao: dataFonte(ex.atualizacao),
    captura: dataFonte(ex.captura),
    primaria: somar(primarias),
    total: somar(doAno),
    reservaPrimaria: somar(primarias.filter((r) => RESERVA.includes(r.funcao))).inicial,
    reservaTotal: somar(doAno.filter((r) => RESERVA.includes(r.funcao))).inicial,
    funcoes: fechado
      ? [...porFuncao.entries()]
          .map(([codigo, rs]) => ({codigo, nome: FUNCOES[codigo] ?? `Função ${codigo}`, ...somar(rs)}))
          .sort((a, b) => (b.inicial ?? 0) - (a.inicial ?? 0))
      : [],
  };
}

/** Exercícios do capítulo: de PRIMEIRO_ANO_PLANO ao ano corrente (o último pode estar em curso). */
export function seriePlano(): AnoPlano[] {
  return ANOS.filter((a) => a >= PRIMEIRO_ANO_PLANO).map(anoPlano).filter((a): a is AnoPlano => a !== null);
}

/** Desvio do liquidado frente à dotação inicial, em %. Ano em curso não tem desvio: o liquidado é parcial. */
export function desvioPlano(a: AnoPlano, base: BasePlano): Medida {
  if (!a.encerrado) return {valor: null, status: 'inelegivel', motivo: 'Exercício em curso: liquidado parcial.'};
  return desvioPercentual(a[base].liquidado, a[base].inicial);
}
/** Créditos líquidos do ano: dotação atualizada frente à inicial, em %. */
export function creditosPlano(a: AnoPlano, base: BasePlano): Medida {
  return desvioPercentual(a[base].atualizada, a[base].inicial);
}
