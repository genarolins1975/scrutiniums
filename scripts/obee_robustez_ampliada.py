"""Robustez das comparações pareadas além da família contínua de 40% a 4/7.

Complementa `obee_sensibilidade_pares.py` com experimentos SEPARADOS, todos na
cesta conjunta de sete medidas, referência 2022 e coorte fixa:
  1. caixa de pesos: cada peso livre entre (1-r) e (1+r) vezes o peso de
     referência do bloco material em 40%, soma 1 (r = 25% e 50%);
  2. exclusão de um indicador, pesos de 40% renormalizados;
  3. normalizações alternativas sobre valores originais orientados
     (mínimo e máximo; escore z);
  4. homicídios apenas registrados (SIM) no lugar dos estimados, na família
     contínua com as quatro definições de habitação.
Nenhum resultado é intervalo de confiança, probabilidade ou significância.
Não altera o pacote congelado nem os pesos propostos.
"""
import hashlib
import json
import math
from collections import Counter
from fractions import Fraction as F
from itertools import combinations
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / 'docs/obee/resultados'
JOINT = DOCS / 'cesta-conjunta.json'
PILOT = DOCS / 'piloto-2022-v2.json'
PAIRS = DOCS / 'sensibilidade-pares-v3.json'
VIOLENCE = ROOT / 'pipeline/eficiencia_resultados/seed/expansao-2022.json'
OUTPUT = DOCS / 'robustez-ampliada-v3.json'
MATERIAL = ('trabalho', 'saneamento', 'habitacao', 'conectividade')
OTHER = ('educacao', 'mobilidade', 'seguranca')
DIMS = ('educacao', 'trabalho', 'mobilidade', 'saneamento', 'seguranca', 'habitacao', 'conectividade')
HIGHER = {'educacao', 'trabalho', 'saneamento', 'conectividade'}
DEFINITIONS = ('domicilios_gt2', 'domicilios_gt3', 'moradores_gt2', 'moradores_gt3')
PRIMARY = 'domicilios_gt2'
LOW, HIGH = F(2, 5), F(4, 7)
BOXES = (F(1, 4), F(1, 2))
Z_TIE = 1e-9  # só o escore z usa ponto flutuante (desvio padrão irracional)


def require(condition, message):
    if not condition:
        raise ValueError(message)


def sign(x):
    return (x > 0) - (x < 0)


def percentiles(values, higher):
    """Percentil médio por postos, exato: 100 × (piores + iguais/2) / n."""
    require(values and all(isinstance(v, F) for v in values.values()), 'Valores inválidos')
    n = len(values)
    return {i: F(100) * (2 * sum((y < x) if higher else (y > x) for y in values.values())
                         + sum(y == x for y in values.values())) / (2 * n)
            for i, x in values.items()}


def reference_weights():
    return {d: (F(1, 10) if d in MATERIAL else F(1, 5)) for d in DIMS}


def family_weights(budget):
    return {d: (budget / 4 if d in MATERIAL else (1 - budget) / 3) for d in DIMS}


def box_extremes(delta, ratio):
    """Mínimo e máximo exatos de Σ w·delta com l ≤ w ≤ u e Σ w = 1 (guloso é ótimo)."""
    ref = reference_weights()
    lows = {d: ref[d] * (1 - ratio) for d in DIMS}
    ups = {d: ref[d] * (1 + ratio) for d in DIMS}

    def extreme(minimize):
        w, rest = dict(lows), 1 - sum(lows.values())
        for d in sorted(DIMS, key=lambda k: delta[k], reverse=not minimize):
            add = min(ups[d] - lows[d], rest)
            w[d] += add
            rest -= add
        require(rest == 0 and sum(w.values()) == 1, 'Caixa de pesos inviável')
        return sum(w[d] * delta[d] for d in DIMS)
    return extreme(True), extreme(False)


def family_state(deltas):
    """Estado na família contínua para uma lista de vetores (um por definição)."""
    ends = []
    for delta in deltas:
        for budget in (LOW, HIGH):
            w = family_weights(budget)
            ends.append(sum(w[d] * delta[d] for d in DIMS))
    lo, hi = min(ends), max(ends)
    if lo > 0 or hi < 0:
        return 'estavel'
    if lo == hi == 0:
        return 'sempre_empatado'
    return 'inversao_possivel' if lo < 0 < hi else 'empate_possivel'


def load(joint, pilot, violence):
    ids = joint['cohort']
    require(len(ids) == len(set(ids)) == 26 and '5300108' not in ids, 'Coorte divergente')
    require(joint['publication_ready'] is False and joint['approved_weights'] is None, 'Estado editorial divergente')
    scenarios = {(s['housing_definition'], s['weight_model']): s for s in joint['scenarios'] if s['inclusion'] == 'conjunta'}
    require(len(scenarios) == 8, 'Oito cenários conjuntos exigidos')
    base = {r['id']: r for r in pilot['rows']}
    require(set(base) == set(ids), 'Coorte v2 divergente')
    raw = {d: {i: F(str(base[i]['raw_values'][d])) for i in ids}
           for d in ('educacao', 'trabalho', 'mobilidade', 'saneamento', 'seguranca')}
    for definition in DEFINITIONS:
        rows = {r['id']: r for r in scenarios[definition, 'materiais_40pct']['rows']}
        raw[definition] = {i: F(rows[i]['candidate_raw_pct']['habitacao']) for i in ids}
        raw.setdefault('conectividade', {i: F(rows[i]['candidate_raw_pct']['conectividade']) for i in ids})
    # Taxa registrada exata a partir das contagens publicadas (Atlas 2024, tabela 3)
    violence_rows = {r['id']: r for r in violence['violence']}
    require(set(violence_rows) == set(ids), 'Coorte do Atlas divergente')
    raw['seguranca_registrada'] = {i: F(violence_rows[i]['registered'] * 100000, violence_rows[i]['population']) for i in ids}
    pct = {d: percentiles(raw[d], d in HIGHER) for d in ('educacao', 'trabalho', 'mobilidade', 'saneamento',
                                                          'seguranca', 'conectividade')}
    for definition in DEFINITIONS:
        pct[definition] = percentiles(raw[definition], False)
    pct['seguranca_registrada'] = percentiles(raw['seguranca_registrada'], False)
    # Reconciliação: os percentis reconstruídos devem ser os do experimento publicado
    for (definition, _), scenario in scenarios.items():
        for row in scenario['rows']:
            for d in DIMS:
                source = definition if d == 'habitacao' else d
                require(abs(float(pct[source][row['id']]) - row['indicator_scores'][d]) < 1e-9,
                        'Percentil não reconcilia com cesta-conjunta.json')
    names = {r['id']: r['name'] for r in pilot['rows']}
    return ids, names, raw, pct


def vector(pct, i, definition, security='seguranca'):
    return {d: pct[definition if d == 'habitacao' else security if d == 'seguranca' else d][i] for d in DIMS}


def build(joint, pilot, violence, pairs_doc, hashes):
    ids, names, raw, pct = load(joint, pilot, violence)
    family = {frozenset((p['a'], p['b'])): p for p in pairs_doc['pairs']}
    require(len(family) == 325, 'Diagnóstico da família incompleto')
    ref = reference_weights()
    full = {i: sum(vector(pct, i, PRIMARY)[d] * ref[d] for d in DIMS) for i in ids}

    # Normalizações alternativas na definição principal, pesos de referência
    def oriented(d, i):
        source = PRIMARY if d == 'habitacao' else d
        value = raw[source][i]
        return value if d in HIGHER else -value
    minmax, zscore = {}, {}
    for d in DIMS:
        values = {i: oriented(d, i) for i in ids}
        lo, hi = min(values.values()), max(values.values())
        minmax[d] = {i: 100 * (v - lo) / (hi - lo) for i, v in values.items()}
        mean = sum(values.values()) / 26
        sd = math.sqrt(float(sum((v - mean) ** 2 for v in values.values()) / 26))
        zscore[d] = {i: float(v - mean) / sd for i, v in values.items()}
    s_minmax = {i: sum(ref[d] * minmax[d][i] for d in DIMS) for i in ids}
    s_z = {i: sum(float(ref[d]) * zscore[d][i] for d in DIMS) for i in ids}

    # Exclusão de um indicador
    leave = {}
    for drop in DIMS:
        keep = [d for d in DIMS if d != drop]
        total = sum(ref[d] for d in keep)
        leave[drop] = {i: sum(vector(pct, i, PRIMARY)[d] * ref[d] / total for d in keep) for i in ids}

    pairs, summary = [], Counter()
    for a, b in combinations(ids, 2):
        base_sign = sign(full[a] - full[b])
        deltas = {definition: {d: vector(pct, a, definition)[d] - vector(pct, b, definition)[d] for d in DIMS}
                  for definition in DEFINITIONS}
        boxes = {}
        for ratio in BOXES:
            lo, hi = box_extremes(deltas[PRIMARY], ratio)
            boxes[f'{int(ratio * 100)}pct'] = lo < 0 < hi
            summary[f'caixa_{int(ratio * 100)}pct_inversao_possivel'] += lo < 0 < hi
        dropped = sorted(d for d in DIMS if sign(leave[d][a] - leave[d][b]) * base_sign == -1)
        for d in dropped:
            summary[f'exclusao_{d}'] += 1
        rev_minmax = sign(s_minmax[a] - s_minmax[b]) * base_sign == -1
        z_gap = s_z[a] - s_z[b]
        rev_z = (0 if abs(z_gap) <= Z_TIE else sign(z_gap)) * base_sign == -1
        summary['minmax_inversoes'] += rev_minmax
        summary['escore_z_inversoes'] += rev_z
        registered = family_state([{d: vector(pct, a, definition, 'seguranca_registrada')[d]
                                    - vector(pct, b, definition, 'seguranca_registrada')[d] for d in DIMS}
                                   for definition in DEFINITIONS])
        published = family[frozenset((a, b))]
        estimated = {'a_always_higher': 'estavel', 'b_always_higher': 'estavel', 'order_changes': 'inversao_possivel',
                     'tie_possible': 'empate_possivel', 'always_tied': 'sempre_empatado'}[published['state']]
        require(estimated == family_state(list(deltas.values())), 'Família não reconcilia com sensibilidade-pares-v3.json')
        summary[f'homicidios_registrados_{registered}'] += 1
        summary['homicidios_registrados_muda_estado'] += registered != estimated
        dominance = published['componentwise_dominance_all_definitions']
        if dominance is not None:
            require(not any(boxes.values()) and not rev_minmax and not rev_z and not dropped,
                    'Dominância não pode inverter sob pesos positivos ou normalização monotônica')
        robustness = ('dominancia' if dominance is not None else
                      'estavel_so_na_familia' if estimated == 'estavel' else estimated)
        summary[f'classe_{robustness}'] += 1
        pairs.append({'a': a, 'b': b, 'a_name': names[a], 'b_name': names[b], 'robustness': robustness,
                      'box_inversion_possible': boxes, 'leave_one_out_reversals': dropped,
                      'minmax_reversal': rev_minmax, 'zscore_reversal': rev_z,
                      'registered_homicides_family_state': registered})
    return {'version': 'robustez-ampliada-v3-v1', 'reference_year': 2022, 'publication_ready': False,
            'independent_review': False, 'input_sha256': hashes,
            'reference_weights': {d: str(w) for d, w in ref.items()}, 'primary_housing_definition': PRIMARY,
            'experiments': {
                'caixa_de_pesos': 'Cada peso entre (1-r) e (1+r) vezes o peso de referência (material 40%), soma 1; extremos exatos.',
                'exclusao_de_indicador': 'Retira um indicador; pesos de referência restantes renormalizados; inversão estrita frente à cesta completa.',
                'normalizacao': 'Mínimo e máximo exato; escore z em ponto flutuante com empate abaixo de 1e-9; mesmos pesos de referência.',
                'homicidios_registrados': 'Taxa só de registros (SIM) no lugar da estimada, família contínua 40% a 4/7, quatro definições.'},
            'classes': {
                'dominancia': 'Melhor ou igual nas sete medidas em todas as definições: ordem robusta a qualquer peso positivo e normalização monotônica, não a erro amostral.',
                'estavel_so_na_familia': 'Ordem estrita só garantida na família 40% a 4/7 com divisão igual nos blocos.',
                'inversao_possivel': 'A ordem pode inverter dentro da própria família.',
                'empate_possivel': 'Há escolha da família que empata, sem inverter.'},
            'summary': dict(sorted(summary.items())),
            'limits': ['Não é intervalo de confiança, probabilidade ou significância estatística.',
                       'Experimentos separados; não esgotam as especificações plausíveis.',
                       'Dados, coorte e ano fixos; erros das fontes não propagados.'],
            'pairs': pairs}


def main():
    raw = {path: path.read_bytes() for path in (JOINT, PILOT, PAIRS, VIOLENCE)}
    hashes = {str(p.relative_to(ROOT)): hashlib.sha256(b).hexdigest() for p, b in raw.items()}
    pairs_doc = json.loads(raw[PAIRS])
    require(pairs_doc['source_sha256'] == hashes[str(JOINT.relative_to(ROOT))], 'Diagnóstico de outra versão')
    return build(json.loads(raw[JOINT]), json.loads(raw[PILOT]), json.loads(raw[VIOLENCE]), pairs_doc, hashes)


if __name__ == '__main__':
    result = main()
    OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False) + '\n')
    print(json.dumps(result['summary'], ensure_ascii=False))
